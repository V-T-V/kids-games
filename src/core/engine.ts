/**
 * 游戏引擎基类 —— 统一所有游戏的生命周期与公共能力。
 *
 * 每个游戏继承 BaseGame，实现 mount()/unmount() 与 onResult 回调，
 * 即可自动获得：难度自适应、答错计数护盾、结算上报、夸赞联动等能力。
 *
 * 这样 8 个游戏可以保持一致的"手感"和反馈节奏。
 */
import type {
  Difficulty,
  GameId,
  GameResult,
  ParentSettings,
} from "../types.ts";
import {
  loadSave,
  recordResult as persistResult,
  unlockAchievement,
} from "./storage.ts";
import {
  mascotClear,
  mascotCorrect,
  mascotRest,
  mascotWrong,
} from "./mascot.ts";
import { sfxClear, sfxCorrect, sfxWrong } from "./audio.ts";
import { burst, confetti } from "./particles.ts";
import { showAchievement } from "./toast.ts";
import { getAchievementMeta } from "./achievements.ts";

/** 游戏上下文：基类向子类暴露的能力集合。 */
export interface GameContext {
  /** 当前难度 */
  difficulty: Difficulty;
  /** 当前存档设置（只读快照） */
  settings: ParentSettings;
  /** 根容器（游戏在此渲染） */
  root: HTMLElement;
}

/** 子游戏实现接口。 */
export abstract class BaseGame {
  readonly gameId: GameId;
  protected ctx!: GameContext;
  protected root!: HTMLElement;
  protected difficulty: Difficulty = "easy";
  /** 通关回调（由 App 层注入，用于展示统一结算页）。 */
  onGameClear: ((result: GameResult) => void) | null = null;
  /** 进度回调（由 App 层注入，更新顶栏统一进度条）。 */
  onProgress: ((current: number, total: number) => void) | null = null;
  /** 本局连续答错次数（用于休息护盾） */
  private wrongStreak = 0;
  /** 本局累计答错总次数（用于动态算星，不清零）。 */
  protected wrongCount = 0;
  private startedAt = 0;
  /** 是否已结算（幂等锁，防止重复 finishClear）。 */
  private finished = false;
  /** 子类注册的 pending 定时器，unmount 时统一清理。 */
  private pendingTimers: number[] = [];

  constructor(gameId: GameId) {
    this.gameId = gameId;
  }

  /** 初始化并渲染游戏。子类实现具体逻辑。 */
  protected abstract mount(): void;

  /** 清理：移除事件、定时器、动画。子类实现。 */
  protected abstract unmount(): void;

  /**
   * 挂载游戏到容器。由路由层调用。
   * 读取存档决定初始难度。
   */
  start(container: HTMLElement, forceDifficulty?: Difficulty): void {
    const save = loadSave();
    const settings = save.settings;
    this.difficulty =
      forceDifficulty ??
      settings.lockedDifficulty ??
      save.progress[this.gameId].bestDifficulty ??
      "easy";
    this.root = container;
    this.ctx = {
      difficulty: this.difficulty,
      settings,
      root: container,
    };
    this.wrongStreak = 0;
    this.wrongCount = 0;
    this.finished = false;
    this.startedAt = Date.now();
    this.mount();
  }

  /** 销毁游戏。 */
  destroy(): void {
    this.clearPending();
    try {
      this.unmount();
    } finally {
      this.root.innerHTML = "";
    }
  }

  /**
   * 注册一个会被 unmount 自动清理的 setTimeout。
   * 子类应优先用这个而非裸 window.setTimeout，避免销毁后回调泄漏。
   * 返回 timer id。
   */
  protected trackTimeout(fn: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      this.pendingTimers = this.pendingTimers.filter((t) => t !== id);
      if (!this.finished) fn();
    }, ms);
    this.pendingTimers.push(id);
    return id;
  }

  /** 清理所有 pending 定时器。 */
  private clearPending(): void {
    this.pendingTimers.forEach((t) => window.clearTimeout(t));
    this.pendingTimers = [];
  }

  /* ===== 子类调用的反馈钩子 ===== */

  /** 答对时调用：播放音效、粒子、吉祥物夸赞。 */
  protected onCorrect(x?: number, y?: number): void {
    sfxCorrect();
    if (x != null && y != null) burst(x, y);
    mascotCorrect();
  }

  /**
   * 上报关卡进度，更新顶栏统一进度条。
   * 游戏在 startRound / 答对后调用，如 this.reportProgress(this.roundsDone, this.roundTotal)。
   * 不调用则进度条保持隐藏。
   */
  protected reportProgress(current: number, total: number): void {
    this.onProgress?.(current, total);
  }

  /**
   * 答错时调用：温柔提示，累加连错计数。
   * 当启用休息护盾且连续答错 >=3 次时，触发休息提示。
   * 返回是否触发了休息（游戏可据此暂停）。
   */
  protected onWrong(): boolean {
    sfxWrong();
    mascotWrong();
    this.wrongStreak += 1;
    this.wrongCount += 1;
    if (this.ctx.settings.restShield && this.wrongStreak >= 3) {
      this.wrongStreak = 0;
      mascotRest();
      return true;
    }
    return false;
  }

  /** 重置连错计数（成功一次即清零）。 */
  protected resetWrongStreak(): void {
    this.wrongStreak = 0;
  }

  /**
   * 通关结算。记录存档、播放庆典、上报结果。
   * 幂等：重复调用不会二次结算。
   * @param stars 0-3 星
   */
  protected finishClear(stars: number): GameResult | null {
    if (this.finished) return null; // 幂等锁：防重复结算
    this.finished = true;
    const durationMs = Date.now() - this.startedAt;
    const result: GameResult = {
      gameId: this.gameId,
      cleared: true,
      stars: Math.max(0, Math.min(3, stars)),
      difficulty: this.difficulty,
      durationMs,
    };
    const save = loadSave();
    persistResult(save, result);
    // 基于本局表现触发技能类成就
    if (this.wrongCount === 0) {
      this.unlock("no-mistake");
    }
    if (this.wrongCount >= 3) {
      this.unlock("comeback");
    }
    sfxClear();
    confetti(90);
    mascotClear();
    this.afterClear(save, result);
    // 延迟弹出结算页，让彩纸和庆祝先展现
    const r = result;
    this.trackTimeout(() => this.onGameClear?.(r), 1400);
    return result;
  }

  /** 子类可覆盖：通关后的额外逻辑（如解锁成就）。 */
  protected afterClear(
    _save: ReturnType<typeof loadSave>,
    _result: GameResult,
  ): void {
    void _save;
    void _result;
  }

  /** 解锁成就的便捷方法。新解锁时弹出 toast 提示。 */
  protected unlock(id: string): void {
    const save = loadSave();
    const isNew = unlockAchievement(save, id);
    if (isNew) {
      const meta = getAchievementMeta(id);
      showAchievement(meta.icon, meta.name, "成就已解锁");
    }
  }
}
