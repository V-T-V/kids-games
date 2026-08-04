/**
 * 童趣游戏屋 —— 应用入口。
 *
 * 职责：
 * - 初始化特效层、路由、家长按钮。
 * - 根据路由在大厅 / 具体游戏之间切换。
 * - 首次交互解锁音频。
 * - 销毁旧游戏实例，避免内存泄漏。
 */
import "./style.css";
import "./lobby.css";

import { initRouter, onRoute, getRoute, navigate } from "./router.ts";
import { initParticles, clearParticles } from "./core/particles.ts";
import { unlockAudio } from "./core/audio.ts";
import { hideMascot } from "./core/mascot.ts";
import { renderLobby } from "./lobby/Lobby.ts";
import { renderLearnCenter } from "./learn/LearnCenter.ts";
import { renderLearnPath } from "./learn/LearnPath.ts";
import { createGameShell, type ShellHandle } from "./games/shell.ts";
import { openParentPanel } from "./ui/ParentPanel.ts";
import { feedbackCount, FEEDBACK_EVENT } from "./core/feedback.ts";
import { retryPending, isSyncReady } from "./core/sync.ts";
import { LEARN_PATHS } from "./learn/paths.ts";
import { Overlay } from "./ui/Overlay.ts";
import {
  loadSave,
  unlockAchievement,
  writeSave,
  ALL_GAME_IDS,
} from "./core/storage.ts";
import { showAchievement } from "./core/toast.ts";
import { registerPwa } from "./core/pwa.ts";
import {
  getAchievementMeta,
  checkMilestoneAchievements,
} from "./core/achievements.ts";
import { findGame } from "./games/registry.ts";
import { pushRecent } from "./core/favorites.ts";
import type { BaseGame } from "./core/engine.ts";
import type { GameResult } from "./types.ts";

/* 各游戏懒加载工厂：用 Vite 的 import.meta.glob 自动收集所有游戏模块，
   新增游戏只需在 registry.ts 注册 + 创建目录，无需改 main.ts。 */
const gameModules = import.meta.glob("./games/*/index.ts") as Record<
  string,
  () => Promise<{ create: () => BaseGame }>
>;
export const GAME_FACTORIES: Record<string, () => Promise<BaseGame>> =
  Object.fromEntries(
    Object.entries(gameModules).map(([path, loader]) => {
      // ./games/color-mixer/index.ts → color-mixer
      const id = path.split("/")[2]!;
      return [id, () => loader().then((m) => m.create())];
    }),
  );

const app = document.getElementById("app")!;
const fxLayer = document.getElementById("fx-layer")!;
const parentBtn = document.getElementById("parent-btn")!;

let currentShell: ShellHandle | null = null;
let currentGame: BaseGame | null = null;
/** 当前游戏的关卡进度（由 onProgress 回调更新，反馈上下文用） */
let currentProgress: { current: number; total: number } = {
  current: 0,
  total: 0,
};

/** 退出当前游戏，清理一切。 */
function teardownGame(): void {
  // 关闭可能残留的结算/反馈 Overlay
  document.querySelectorAll(".overlay").forEach((el) => el.remove());
  if (currentGame) {
    try {
      currentGame.destroy();
    } catch {
      /* ignore */
    }
    currentGame = null;
  }
  if (currentShell) {
    currentShell.destroy();
    currentShell = null;
  }
  clearParticles();
  hideMascot();
}

/** 若游戏从学习路径进入，记录路径 id 供"返回"用（回路径而非大厅）。 */
let learnOrigin: string | null = null;

/** 渲染大厅。 */
function showLobby(): void {
  teardownGame();
  app.classList.remove("app--game");
  renderLobby(app);
}

/** 加载并启动一个游戏。 */
let loadToken = 0;

async function showGame(gameId: string): Promise<void> {
  const myToken = ++loadToken;
  teardownGame();
  app.classList.add("app--game");
  app.innerHTML = "";
  // 加载占位
  const loading = document.createElement("div");
  loading.className = "game__stage";
  loading.innerHTML = '<div style="font-size:1.4rem">加载中… 🎈</div>';
  app.appendChild(loading);

  const factory = GAME_FACTORIES[gameId];
  if (!factory) {
    showLobby();
    return;
  }
  try {
    const game = await factory();
    // 竞态守卫：如果在此期间又触发了新的导航，销毁这个游戏并放弃
    if (myToken !== loadToken) {
      try {
        game.destroy();
      } catch {
        /* ignore */
      }
      return;
    }
    // 再次清理（防止 await 期间有旧实例被赋值）
    teardownGame();
    currentProgress = { current: 0, total: 0 };
    const backTarget = learnOrigin ? "learn/" + learnOrigin : undefined;
    const shell = createGameShell(
      app,
      gameId,
      () => {
        // 反馈上下文提供者：结合游戏实例的 wrong/duration + 跟踪的关卡进度
        const base = currentGame?.getFeedbackContext();
        return {
          round: currentProgress.current + 1,
          right: currentProgress.current,
          wrong: base?.wrong,
          durationMs: base?.durationMs,
        };
      },
      backTarget,
    );
    currentShell = shell;
    currentGame = game;
    // 记录「最近玩过」（大厅快捷区用）。失败（隐私模式）静默忽略。
    pushRecent(gameId);
    // 注入通关结算回调：展示统一结算页 + 处理全局成就
    game.onGameClear = (result) => showClearOverlay(gameId, result);
    // 注入进度回调：连接到 shell 的统一进度条 + 跟踪关卡进度（反馈用）
    game.onProgress = (cur, total) => {
      currentProgress = { current: cur, total };
      shell.setProgress(cur, total);
    };
    // 用 shell.stage 作为游戏根
    shell.stage.id = "game-root";
    game.start(shell.stage);
    // 难度显示同步：游戏内部 mount 后已确定 difficulty
    const diff = (
      game as unknown as { difficulty: import("./types.ts").Difficulty }
    ).difficulty;
    shell.setDifficulty(diff);
  } catch (err) {
    console.error("加载游戏失败", gameId, err);
    app.innerHTML =
      '<div class="game__stage"><div style="font-size:1.3rem">哎呀，出错了 😢<br><br>点右上角返回吧</div></div>';
  }
}

/**
 * 通关结算页：展示星数、解锁成就、提供再玩/回大厅。
 * 统一检测所有累计型成就 + 时间/速度隐藏成就。
 */
function showClearOverlay(gameId: string, result: GameResult): void {
  const save = loadSave();
  // 统一检测所有累计型成就（通关数/品类/满星/困难等）
  const newAch = checkMilestoneAchievements(
    save,
    (id) => findGame(id)?.tag ?? "",
  );

  // 隐藏成就：时间类
  const hour = new Date().getHours();
  if (hour >= 21 || hour < 6) {
    if (unlockAchievement(save, "night-owl")) newAch.push("night-owl");
  }
  if (hour >= 5 && hour < 7) {
    if (unlockAchievement(save, "early-bird")) newAch.push("early-bird");
  }
  // 隐藏成就：速度（30 秒内通关）
  if (result.durationMs != null && result.durationMs <= 30000) {
    if (unlockAchievement(save, "speed-run")) newAch.push("speed-run");
  }
  // 注：no-mistake（零失误）与 comeback（逆风翻盘）由 engine.finishClear
  // 根据本局 wrongCount 自动触发，此处无需重复检测。
  writeSave(save);

  // 新解锁的成就弹 toast 通知
  for (const id of newAch) {
    const am = getAchievementMeta(id);
    showAchievement(am.icon, am.name, "成就已解锁");
  }

  const meta = findGame(gameId);
  const starText = "⭐".repeat(result.stars) + "✩".repeat(3 - result.stars);
  const body = document.createElement("div");
  body.style.cssText = "text-align:center;";
  body.innerHTML = `<div style="font-size:2.6rem;letter-spacing:6px;">${starText}</div>
    <div style="margin-top:8px;color:var(--ink-soft);">你完成了「${meta?.title ?? ""}」！</div>`;
  if (newAch.includes("all-clear")) {
    body.innerHTML += `<div style="margin-top:14px;font-size:1.2rem;color:var(--c-orange);font-weight:800;">🎉 隐藏成就：全勤小达人！🏆</div>`;
  } else if (newAch.length > 0) {
    body.innerHTML += `<div style="margin-top:14px;font-size:1.1rem;color:var(--c-green);font-weight:800;">🎉 解锁了 ${newAch.length} 个新成就！</div>`;
  }

  // 找"下一个游戏"：若当前游戏在某条学习路径里，返回路径中下一关；
  // 否则返回一个随机的未玩过游戏（鼓励探索）。
  function findNextGame(): string | null {
    // 1. 学习路径里的下一关
    for (const path of LEARN_PATHS) {
      const idx = path.games.indexOf(gameId as never);
      if (idx >= 0 && idx < path.games.length - 1) {
        return path.games[idx + 1] as string;
      }
    }
    // 2. 随机未玩过游戏
    const unplayed = ALL_GAME_IDS.filter(
      (id) => !save.progress[id]?.cleared && id !== gameId,
    );
    if (unplayed.length > 0) {
      return unplayed[Math.floor(Math.random() * unplayed.length)] ?? null;
    }
    return null;
  }
  const nextGame = findNextGame();

  const overlay = new Overlay({
    title: "太棒啦！",
    emoji: meta?.icon ?? "🎉",
    variant: "clear",
    body,
    primary: {
      text: "再玩一次",
      icon: "🔄",
      onClick: () => {
        overlay.destroy();
        navigate(gameId);
      },
    },
    secondary: {
      text: "回大厅",
      icon: "🏠",
      onClick: () => {
        overlay.destroy();
        navigate("");
      },
    },
    // 若有下一个游戏，加"下一个"按钮
    ...(nextGame
      ? {
          tertiary: {
            text: findGame(nextGame) ? "下一个 →" : "试个新的 →",
            icon: findGame(nextGame)?.icon ?? "🎯",
            onClick: () => {
              overlay.destroy();
              navigate(nextGame);
            },
          },
        }
      : {}),
  });
  overlay.show();
}

function handleRoute(route: string): void {
  if (!route) {
    learnOrigin = null;
    showLobby();
  } else if (route === "learn") {
    learnOrigin = null;
    showLearnCenter();
  } else if (route.startsWith("learn/")) {
    learnOrigin = route.slice("learn/".length);
    showLearnPath(learnOrigin);
  } else {
    void showGame(route);
  }
}

/** 渲染学习中心（路由 learn）。 */
function showLearnCenter(): void {
  teardownGame();
  app.classList.remove("app--game");
  renderLearnCenter(app);
}

/** 渲染某条学习路径详情（路由 learn/某个 id）。 */
function showLearnPath(pathId: string): void {
  teardownGame();
  app.classList.remove("app--game");
  renderLearnPath(app, pathId);
}

function init(): void {
  registerPwa();
  initParticles(fxLayer);
  initRouter();

  // 首次任意交互解锁音频（浏览器策略）
  const unlock = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  // 家长按钮
  parentBtn.addEventListener("click", () => openParentPanel());

  // 反馈角标：监听 feedback-updated 事件，刷新齿轮按钮上的未处理反馈数
  const updateFeedbackBadge = (): void => {
    const count = feedbackCount();
    parentBtn.setAttribute("data-feedback-count", String(count));
  };
  updateFeedbackBadge();
  window.addEventListener(FEEDBACK_EVENT, updateFeedbackBadge);

  // 反馈同步：启动时补推上次没成功的 pending；联网时也触发一次。
  // retryPending 内部会自检 sync 是否就绪，未配置则直接返回 0，零开销。
  if (isSyncReady()) {
    void retryPending();
  }
  window.addEventListener("online", () => void retryPending());

  // 路由
  onRoute(handleRoute);
  handleRoute(getRoute());
}

init();
