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
import { sfxClear, sfxCorrect, sfxPop, sfxWrong } from "./audio.ts";
import { burst, confetti } from "./particles.ts";
import { showAchievement, showToast } from "./toast.ts";
import { getAchievementMeta } from "./achievements.ts";
import { resolveDifficulty } from "./adaptive.ts";
import { countHardFeedback } from "./feedback.ts";

/** 难度档 → 中文（toast 提示用）。 */
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "简单",
  medium: "普通",
  hard: "困难",
};

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
  /** 当前连击数（连续答对不中断）。 */
  private combo = 0;
  private startedAt = 0;
  /**
   * 最近一次 onCorrect 的时间戳。
   * 用于"答对后宽限期"：孩子在答对后的过关动画（通常 1~1.2s）期间
   * 的误触点击不应计入 wrongCount，避免无辜扣星。
   */
  private lastCorrectAt = 0;
  /** 是否已结算（幂等锁，防止重复 finishClear）。 */
  private finished = false;
  /** 子类注册的 pending 定时器，unmount 时统一清理。 */
  private pendingTimers: number[] = [];
  /** 本局注入的 <style> 标签 id 列表，destroy 时清理避免 head 累积。 */
  private injectedStyles: string[] = [];

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
    const progress = save.progress[this.gameId];
    // 难度解析：强制 > 家长锁 > 自适应(基于近局表现) > 历史最高 > easy
    const prevDifficulty =
      progress.recentResults.length > 0
        ? progress.recentResults[progress.recentResults.length - 1]!.difficulty
        : (progress.bestDifficulty ?? "easy");
    const suggested = resolveDifficulty(
      settings.lockedDifficulty,
      progress.recentResults,
      progress.bestDifficulty,
      countHardFeedback(this.gameId),
    );
    this.difficulty = forceDifficulty ?? suggested;
    // 自适应升降档时弹 toast 提示（仅当非家长锁定、非强制时）
    if (
      !forceDifficulty &&
      !settings.lockedDifficulty &&
      this.difficulty !== prevDifficulty &&
      progress.recentResults.length > 0
    ) {
      showToast(
        `难度调整为「${DIFFICULTY_LABEL[this.difficulty]}」`,
        this.difficulty === "hard"
          ? "🔥"
          : this.difficulty === "easy"
            ? "🌱"
            : "⭐",
      );
    }
    this.root = container;
    this.ctx = {
      difficulty: this.difficulty,
      settings,
      root: container,
    };
    this.wrongStreak = 0;
    this.wrongCount = 0;
    this.combo = 0;
    this.finished = false;
    this.startedAt = Date.now();
    this.mount();
  }

  /** 销毁游戏。 */
  destroy(): void {
    // 先 unmount（让子类有机会注销监听器/定时器），再清 pending 定时器，
    // 这样子类 unmount 内通过 trackTimeout 注册的清理回调也能被一并取消。
    try {
      this.unmount();
    } finally {
      this.clearPending();
      this.root.innerHTML = "";
      // 清理本局注入的 <style> 标签，避免 head 累积（大量游戏切换会累积 CSS）。
      // 历史上绝大多数游戏自写 injectStyle() 用 getElementById 防重，不走 injectGameStyle，
      // 因此 injectedStyles 常为空。这里兜底：移除所有 id 以 "-style" 结尾的游戏专属样式。
      // （全局样式由 Vite 注入无 id；唯一例外 fb-style 是长生命周期反馈样式，单独保留。）
      for (const sid of this.injectedStyles) {
        document.getElementById(sid)?.remove();
      }
      this.injectedStyles = [];
      document
        .querySelectorAll('style[id$="-style"]:not(#fb-style)')
        .forEach((el) => el.remove());
    }
  }

  /**
   * 注入专属 CSS（防重复 + 自动追踪清理）。
   * 子类应优先用这个替代手写 getElementById + appendChild。
   * @param id style 标签的 id（如 "bw-style"）
   * @param css CSS 字符串
   */
  protected injectGameStyle(id: string, css: string): void {
    if (document.getElementById(id)) return;
    const st = document.createElement("style");
    st.id = id;
    st.textContent = css;
    document.head.appendChild(st);
    this.injectedStyles.push(id);
  }

  /**
   * 注册一个会被 unmount 自动清理的 setTimeout。
   * 子类应优先用这个而非裸 window.setTimeout，避免销毁后回调泄漏。
   * 默认在游戏已结算（finished）后不触发，避免残留的游戏内逻辑回调。
   * @param evenIfFinished 设为 true 则即使已结算也触发（用于结算页等"必须在结束后执行"的回调）
   * 返回 timer id。
   */
  protected trackTimeout(
    fn: () => void,
    ms: number,
    evenIfFinished = false,
  ): number {
    const id = window.setTimeout(() => {
      this.pendingTimers = this.pendingTimers.filter((t) => t !== id);
      if (evenIfFinished || !this.finished) fn();
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
    this.combo += 1;
    this.lastCorrectAt = Date.now();
    sfxCorrect();
    if (x != null && y != null) burst(x, y);
    mascotCorrect();
    // 连击里程碑：5/10 连击时额外粒子奖励（不弹文字提示，避免遮挡干扰）
    if (this.combo >= 10) {
      if (x != null && y != null) {
        burst(x, y, 30);
        burst(x - 40, y, 10);
        burst(x + 40, y, 10);
      }
      sfxPop();
    } else if (this.combo >= 5) {
      if (x != null && y != null) burst(x, y, 12);
    }
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
   * 获取当前游戏上下文（供反馈系统附带调试信息）。
   * main.ts 在创建反馈对话框时调用，让反馈带上"答错几次/已玩时长"。
   * 关卡进度由 main.ts 通过 onProgress 回调单独跟踪（因 roundsDone 是子类私有）。
   */
  getFeedbackContext(): { wrong: number; durationMs: number } {
    return {
      wrong: this.wrongCount,
      durationMs: Date.now() - this.startedAt,
    };
  }

  /**
   * 答错时调用：温柔提示，累加连错计数。
   * 当启用休息护盾且连续答错 >=3 次时，触发休息提示。
   * 返回是否触发了休息（游戏可据此暂停）。
   *
   * 宽限期：若距最近一次 onCorrect 不足 1.5s（典型过关动画时长），
   * 视为孩子在"答对后动画期间"的误触，不计入 wrongCount、不触发休息护盾，
   * 避免已经答对却被无辜扣星/打断。
   */
  protected onWrong(): boolean {
    const inGrace =
      this.lastCorrectAt > 0 && Date.now() - this.lastCorrectAt < 1500;
    sfxWrong();
    mascotWrong();
    this.combo = 0;
    if (!inGrace) {
      this.wrongStreak += 1;
      this.wrongCount += 1;
    }
    if (!inGrace && this.ctx.settings.restShield && this.wrongStreak >= 3) {
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
      // 防御：stars 若为 NaN（游戏自定义算星异常）Math.max(0,Math.min(3,NaN))===NaN，
      // 会污染存档/成就/结算页。先 Number.isFinite 兜底为 0，再 clamp 到 0-3。
      stars: Math.max(0, Math.min(3, Number.isFinite(stars) ? stars : 0)),
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
    // 延迟弹出结算页，让彩纸和庆祝先展现。用 evenIfFinished 让回调在结算后仍触发。
    const r = result;
    this.trackTimeout(() => this.onGameClear?.(r), 1400, true);
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
