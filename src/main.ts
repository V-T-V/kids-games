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
import { createGameShell, type ShellHandle } from "./games/shell.ts";
import { openParentPanel } from "./ui/ParentPanel.ts";
import { Overlay } from "./ui/Overlay.ts";
import { loadSave, unlockAchievement, writeSave } from "./core/storage.ts";
import { showAchievement } from "./core/toast.ts";
import { registerPwa } from "./core/pwa.ts";
import {
  getAchievementMeta,
  checkMilestoneAchievements,
} from "./core/achievements.ts";
import { findGame } from "./games/registry.ts";
import type { BaseGame } from "./core/engine.ts";
import type { GameResult } from "./types.ts";

/* 各游戏懒加载工厂（避免首屏加载全部游戏代码） */
const GAME_FACTORIES: Record<string, () => Promise<BaseGame>> = {
  "color-mixer": () =>
    import("./games/color-mixer/index.ts").then((m) => m.create()),
  "shape-match": () =>
    import("./games/shape-match/index.ts").then((m) => m.create()),
  "number-monster": () =>
    import("./games/number-monster/index.ts").then((m) => m.create()),
  "letter-bee": () =>
    import("./games/letter-bee/index.ts").then((m) => m.create()),
  "memory-flip": () =>
    import("./games/memory-flip/index.ts").then((m) => m.create()),
  "music-stairs": () =>
    import("./games/music-stairs/index.ts").then((m) => m.create()),
  "maze-adventure": () =>
    import("./games/maze-adventure/index.ts").then((m) => m.create()),
  "seek-find": () =>
    import("./games/seek-find/index.ts").then((m) => m.create()),
  "size-sort": () =>
    import("./games/size-sort/index.ts").then((m) => m.create()),
  jigsaw: () => import("./games/jigsaw/index.ts").then((m) => m.create()),
  pattern: () => import("./games/pattern/index.ts").then((m) => m.create()),
  "whack-mole": () =>
    import("./games/whack-mole/index.ts").then((m) => m.create()),
  doodle: () => import("./games/doodle/index.ts").then((m) => m.create()),
  weather: () => import("./games/weather/index.ts").then((m) => m.create()),
  clock: () => import("./games/clock/index.ts").then((m) => m.create()),
  "animal-sound": () =>
    import("./games/animal-sound/index.ts").then((m) => m.create()),
  "color-sort": () =>
    import("./games/color-sort/index.ts").then((m) => m.create()),
  "connect-dots": () =>
    import("./games/connect-dots/index.ts").then((m) => m.create()),
  "shadow-match": () =>
    import("./games/shadow-match/index.ts").then((m) => m.create()),
  tangram: () => import("./games/tangram/index.ts").then((m) => m.create()),
  "farm-math": () =>
    import("./games/farm-math/index.ts").then((m) => m.create()),
  balance: () => import("./games/balance/index.ts").then((m) => m.create()),
  "robot-code": () =>
    import("./games/robot-code/index.ts").then((m) => m.create()),
  "dress-up": () => import("./games/dress-up/index.ts").then((m) => m.create()),
  "fruit-catch": () =>
    import("./games/fruit-catch/index.ts").then((m) => m.create()),
  "link-match": () =>
    import("./games/link-match/index.ts").then((m) => m.create()),
  "feed-order": () =>
    import("./games/feed-order/index.ts").then((m) => m.create()),
  pinyin: () => import("./games/pinyin/index.ts").then((m) => m.create()),
  antonym: () => import("./games/antonym/index.ts").then((m) => m.create()),
  "sliding-puzzle": () =>
    import("./games/sliding-puzzle/index.ts").then((m) => m.create()),
  "color-reaction": () =>
    import("./games/color-reaction/index.ts").then((m) => m.create()),
  equation: () => import("./games/equation/index.ts").then((m) => m.create()),
  "spot-diff": () =>
    import("./games/spot-diff/index.ts").then((m) => m.create()),
  "tidy-up": () => import("./games/tidy-up/index.ts").then((m) => m.create()),
  "mini-sudoku": () =>
    import("./games/mini-sudoku/index.ts").then((m) => m.create()),
  "pipe-connect": () =>
    import("./games/pipe-connect/index.ts").then((m) => m.create()),
  "weight-sort": () =>
    import("./games/weight-sort/index.ts").then((m) => m.create()),
  "catch-star": () =>
    import("./games/catch-star/index.ts").then((m) => m.create()),
  "draw-along": () =>
    import("./games/draw-along/index.ts").then((m) => m.create()),
  emotion: () => import("./games/emotion/index.ts").then((m) => m.create()),
  direction: () => import("./games/direction/index.ts").then((m) => m.create()),
  length: () => import("./games/length/index.ts").then((m) => m.create()),
  "more-less": () =>
    import("./games/more-less/index.ts").then((m) => m.create()),
  symmetry: () => import("./games/symmetry/index.ts").then((m) => m.create()),
  rhythm: () => import("./games/rhythm/index.ts").then((m) => m.create()),
  fishing: () => import("./games/fishing/index.ts").then((m) => m.create()),
  "block-tower": () =>
    import("./games/block-tower/index.ts").then((m) => m.create()),
  "word-chain": () =>
    import("./games/word-chain/index.ts").then((m) => m.create()),
  "reverse-memory": () =>
    import("./games/reverse-memory/index.ts").then((m) => m.create()),
  claw: () => import("./games/claw/index.ts").then((m) => m.create()),
  "bubble-shoot": () =>
    import("./games/bubble-shoot/index.ts").then((m) => m.create()),
  wheel: () => import("./games/wheel/index.ts").then((m) => m.create()),
  pinball: () => import("./games/pinball/index.ts").then((m) => m.create()),
  "guess-card": () =>
    import("./games/guess-card/index.ts").then((m) => m.create()),
  snake: () => import("./games/snake/index.ts").then((m) => m.create()),
  "2048": () => import("./games/2048/index.ts").then((m) => m.create()),
  "number-sequence": () =>
    import("./games/number-sequence/index.ts").then((m) => m.create()),
  "pinyin-puzzle": () =>
    import("./games/pinyin-puzzle/index.ts").then((m) => m.create()),
  radical: () => import("./games/radical/index.ts").then((m) => m.create()),
  idiom: () => import("./games/idiom/index.ts").then((m) => m.create()),
  "measure-word": () =>
    import("./games/measure-word/index.ts").then((m) => m.create()),
  "stroke-order": () =>
    import("./games/stroke-order/index.ts").then((m) => m.create()),
  homophone: () => import("./games/homophone/index.ts").then((m) => m.create()),
  "similar-char": () =>
    import("./games/similar-char/index.ts").then((m) => m.create()),
  "word-classify": () =>
    import("./games/word-classify/index.ts").then((m) => m.create()),
  fraction: () => import("./games/fraction/index.ts").then((m) => m.create()),
  "time-timeline": () =>
    import("./games/time-timeline/index.ts").then((m) => m.create()),
  thermometer: () =>
    import("./games/thermometer/index.ts").then((m) => m.create()),
  calendar: () => import("./games/calendar/index.ts").then((m) => m.create()),
  money: () => import("./games/money/index.ts").then((m) => m.create()),
  ruler: () => import("./games/ruler/index.ts").then((m) => m.create()),
  "symmetry-axis": () =>
    import("./games/symmetry-axis/index.ts").then((m) => m.create()),
  "3d-shape": () => import("./games/3d-shape/index.ts").then((m) => m.create()),
  "color-gradient": () =>
    import("./games/color-gradient/index.ts").then((m) => m.create()),
  spectrum: () => import("./games/spectrum/index.ts").then((m) => m.create()),
  constellation: () =>
    import("./games/constellation/index.ts").then((m) => m.create()),
  "planet-orbit": () =>
    import("./games/planet-orbit/index.ts").then((m) => m.create()),
  ecosystem: () => import("./games/ecosystem/index.ts").then((m) => m.create()),
  "weather-forecast": () =>
    import("./games/weather-forecast/index.ts").then((m) => m.create()),
  "magnet-maze": () =>
    import("./games/magnet-maze/index.ts").then((m) => m.create()),
  circuit: () => import("./games/circuit/index.ts").then((m) => m.create()),
};

const app = document.getElementById("app")!;
const fxLayer = document.getElementById("fx-layer")!;
const parentBtn = document.getElementById("parent-btn")!;

let currentShell: ShellHandle | null = null;
let currentGame: BaseGame | null = null;

/** 退出当前游戏，清理一切。 */
function teardownGame(): void {
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

/** 渲染大厅。 */
function showLobby(): void {
  teardownGame();
  app.classList.remove("app--game");
  renderLobby(app);
}

/** 加载并启动一个游戏。 */
async function showGame(gameId: string): Promise<void> {
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
    const shell = createGameShell(app, gameId);
    currentShell = shell;
    currentGame = game;
    // 注入通关结算回调：展示统一结算页 + 处理全局成就
    game.onGameClear = (result) => showClearOverlay(gameId, result);
    // 注入进度回调：连接到 shell 的统一进度条
    game.onProgress = (cur, total) => shell.setProgress(cur, total);
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
  });
  overlay.show();
}

function handleRoute(route: string): void {
  if (!route) {
    showLobby();
  } else {
    void showGame(route);
  }
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

  // 路由
  onRoute(handleRoute);
  handleRoute(getRoute());
}

init();
