/**
 * 游戏外壳 —— 所有游戏共享的顶栏（返回 + 标题 + 难度 + 进度条）。
 * 返回一个 stage 容器供游戏渲染内容。
 *
 * 进度条是统一的「关卡进度」指示器：游戏通过 setProgress(current, total)
 * 更新，孩子能直观看到"还差几关"。不调用的游戏（如沙盒类）进度条隐藏。
 */
import { navigate } from "../router.ts";
import { findGame } from "./registry.ts";
import { sfxTick } from "../core/audio.ts";
import { speak, isTTSEnabled } from "../core/tts.ts";
import { openFeedbackDialog, type FeedbackContext } from "../core/feedback.ts";
import type { Difficulty } from "../types.ts";

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};
const DIFF_STYLE: Record<Difficulty, string> = {
  easy: "lobby__status-tab--easy",
  medium: "lobby__status-tab--medium",
  hard: "lobby__status-tab--hard",
};

export interface ShellHandle {
  /** 游戏内容挂载点 */
  stage: HTMLElement;
  /** 更新顶栏难度显示 */
  setDifficulty: (d: Difficulty) => void;
  /** 更新关卡进度条（current/total）；不调用则进度条隐藏 */
  setProgress: (current: number, total: number) => void;
  /** 销毁外壳 */
  destroy: () => void;
}

/**
 * 创建游戏外壳。
 * @param feedbackContextProvider 可选：由 main.ts 注入，返回当前游戏上下文（第几关/答错次数等），
 *   让反馈带上调试信息。不传则反馈无上下文。
 */
export function createGameShell(
  root: HTMLElement,
  gameId: string,
  feedbackContextProvider?: () => FeedbackContext | undefined,
  backTarget?: string,
): ShellHandle {
  const meta = findGame(gameId);
  root.innerHTML = "";
  /** 当前游戏难度枚举（setDifficulty 时更新，反馈用） */
  let currentDifficulty: Difficulty = "easy";

  const wrap = document.createElement("div");
  wrap.className = "game";

  const topbar = document.createElement("div");
  topbar.className = "game__topbar";

  const back = document.createElement("button");
  back.type = "button";
  back.className = "game__back";
  back.innerHTML = backTarget
    ? '<span aria-hidden="true">📚</span> 路径'
    : '<span aria-hidden="true">🏠</span> 返回';
  back.setAttribute("aria-label", backTarget ? "返回学习路径" : "返回大厅");
  back.addEventListener("click", () => {
    sfxTick();
    navigate(backTarget ?? "");
  });

  const title = document.createElement("div");
  title.className = "game__title";
  title.innerHTML = `${meta?.icon ?? "🎮"} ${meta?.title ?? ""}`;

  const diff = document.createElement("div");
  diff.className = "game__diff";

  // 反馈按钮
  const feedbackBtn = document.createElement("button");
  feedbackBtn.type = "button";
  feedbackBtn.className = "game__feedback";
  feedbackBtn.innerHTML = "💬";
  feedbackBtn.title = "反馈问题";
  feedbackBtn.setAttribute("aria-label", "反馈问题");
  feedbackBtn.addEventListener("click", () => {
    const ctx = feedbackContextProvider?.();
    openFeedbackDialog(gameId, meta?.title ?? gameId, currentDifficulty, ctx);
  });

  topbar.appendChild(back);
  topbar.appendChild(title);

  // 朗读按钮（仅 TTS 启用时显示）：朗读游戏任务文案
  if (isTTSEnabled()) {
    const speakBtn = document.createElement("button");
    speakBtn.type = "button";
    speakBtn.className = "game__speak";
    speakBtn.innerHTML = "🔊";
    speakBtn.title = "朗读任务";
    speakBtn.setAttribute("aria-label", "朗读任务");
    speakBtn.addEventListener("click", () => {
      const stage = document.querySelector(".game__stage");
      const taskText = stage?.textContent?.trim() ?? "";
      speak(taskText);
    });
    topbar.appendChild(speakBtn);
  }

  topbar.appendChild(feedbackBtn);
  topbar.appendChild(diff);

  // 统一进度条（默认隐藏，游戏调用 setProgress 后显示）
  const progressWrap = document.createElement("div");
  progressWrap.className = "game__progress-wrap";
  progressWrap.style.display = "none";
  progressWrap.innerHTML = `
    <div class="game__progress-track">
      <div class="game__progress-bar-fill" style="width:0%"></div>
    </div>
    <span class="game__progress-text"></span>`;
  wrap.appendChild(topbar);
  wrap.appendChild(progressWrap);

  const stage = document.createElement("div");
  stage.className = "game__stage";
  wrap.appendChild(stage);
  root.appendChild(wrap);

  const fill = progressWrap.querySelector(
    ".game__progress-bar-fill",
  ) as HTMLElement;
  const text = progressWrap.querySelector(
    ".game__progress-text",
  ) as HTMLElement;

  return {
    stage,
    setDifficulty: (d) => {
      currentDifficulty = d;
      diff.textContent = DIFF_LABEL[d];
      diff.className = `game__diff ${DIFF_STYLE[d]}`;
    },
    setProgress: (current, total) => {
      progressWrap.style.display = total > 1 ? "flex" : "none";
      const pct = Math.min(100, (current / total) * 100);
      fill.style.width = `${pct}%`;
      text.textContent = `${current}/${total}`;
    },
    destroy: () => {
      wrap.remove();
    },
  };
}
