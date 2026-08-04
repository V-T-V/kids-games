/**
 * 吉祥物"点点" —— 一只圆滚滚的彩色小精灵。
 *
 * 在游戏中引导、鼓励、庆祝。提供 speak()（气泡说话）、
 * react()（情绪表情：happy/wink/sad/dance）等高层 API。
 * 所有表情用纯 CSS 动画驱动，无需图片资源。
 */
import {
  praiseClear,
  praiseCorrect,
  praiseRest,
  praiseTryAgain,
} from "./praise.ts";

type Mood = "idle" | "happy" | "wink" | "sad" | "dance" | "cheer";

const el = (): HTMLElement | null => document.getElementById("mascot");
const bubble = (): HTMLElement | null =>
  document.getElementById("mascot-bubble");

let hideTimer: number | null = null;
let bubbleTimer: number | null = null;

/** 显示吉祥物到指定位置（屏幕坐标）。 */
export function showMascot(x?: number, y?: number): void {
  const m = el();
  if (!m) return;
  m.classList.remove("mascot--hidden");
  if (x != null && y != null) {
    m.style.left = `${x}px`;
    m.style.top = `${y}px`;
  }
}

/** 隐藏吉祥物。同时取消任何挂起的显示/气泡定时器，防止跨游戏串场。 */
export function hideMascot(): void {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (bubbleTimer !== null) {
    window.clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }
  bubble()?.classList.remove("mascot__bubble--show");
  el()?.classList.add("mascot--hidden");
  setMood("idle");
}

/** 设置情绪表情。 */
export function setMood(mood: Mood): void {
  const m = el();
  if (!m) return;
  m.classList.remove(
    "mascot--happy",
    "mascot--wink",
    "mascot--sad",
    "mascot--dance",
    "mascot--cheer",
  );
  if (mood !== "idle") m.classList.add(`mascot--${mood}`);
}

/**
 * 让点点说一句话（气泡），自动消失。
 * 同时设置情绪。duration 毫秒后隐藏气泡。
 */
export function speak(
  text: string,
  mood: Mood = "happy",
  duration = 2200,
): void {
  showMascot();
  setMood(mood);
  const b = bubble();
  if (b) {
    b.textContent = text;
    b.classList.add("mascot__bubble--show");
  }
  if (bubbleTimer !== null) window.clearTimeout(bubbleTimer);
  bubbleTimer = window.setTimeout(() => {
    bubble()?.classList.remove("mascot__bubble--show");
  }, duration);
}

/** 临时出现 N 毫秒后自动隐藏。 */
export function appearFor(ms: number): void {
  showMascot();
  if (hideTimer !== null) window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(hideMascot, ms);
}

/* ===== 语义化快捷方法，结合夸赞文案池 ===== */

export function mascotCorrect(): void {
  speak(praiseCorrect(), "happy");
}

export function mascotWrong(): void {
  speak(praiseTryAgain(), "wink");
}

export function mascotClear(): void {
  speak(praiseClear(), "cheer", 4000);
}

export function mascotRest(): void {
  speak(praiseRest(), "sad", 4000);
}
