/**
 * 大厅/游戏通用小工具。
 */
import { GAMES } from "../games/registry.ts";

const COLOR_FALLBACK: Record<string, string> = {
  "--c-pink": "#ff6b9d",
  "--c-yellow": "#ffd93d",
  "--c-blue": "#4d96ff",
  "--c-green": "#6bcf7f",
  "--c-purple": "#a55eea",
  "--c-orange": "#ff9f43",
  "--c-teal": "#00d2d3",
  "--c-red": "#ff6348",
  "--c-brown": "#b08968",
  "--c-cyan": "#22d3ee",
  "--c-indigo": "#6366f1",
};

/** 读取 CSS 变量的计算值，失败时回退到内置调色板。
 *  首次调用时缓存全部 CSS 变量到内存，后续直接查 Map，
 *  避免 368 张卡片每次渲染都触发 getComputedStyle reflow。 */
let cssVarCache: Record<string, string> | null = null;

function ensureCssVarCache(): void {
  if (cssVarCache) return;
  cssVarCache = {};
  try {
    const styles = getComputedStyle(document.documentElement);
    // 从 fallback 表的 key 列表读取（已知有限集合）
    for (const key of Object.keys(COLOR_FALLBACK)) {
      const v = styles.getPropertyValue(key).trim();
      cssVarCache[key] = v || COLOR_FALLBACK[key]!;
    }
  } catch {
    cssVarCache = { ...COLOR_FALLBACK };
  }
}

export function getCssVar(name: string): string {
  ensureCssVarCache();
  return cssVarCache![name] ?? COLOR_FALLBACK[name] ?? "#4d96ff";
}

/** 防抖。 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t !== undefined) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

/** 打乱数组（Fisher-Yates），不修改原数组。 */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 取 [min,max] 闭区间随机整数。 */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 从数组随机取一个元素。 */
export function sample<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** 根据 id 取主题色（直接复用 registry 元信息）。 */
export function themeColor(gameId: string): string {
  const g = GAMES.find((x) => x.id === gameId);
  return g ? getCssVar(g.theme) : "#4d96ff";
}
