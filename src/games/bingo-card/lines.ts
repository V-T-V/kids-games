/**
 * 宾果连线逻辑 —— 纯函数，无 DOM 依赖，便于单元测试。
 *
 * 从 index.ts 提取。3×3 网格的 8 条获胜线（3 横 + 3 竖 + 2 斜），
 * 以及连线计数与"导向宾果"的喊号策略。
 */

/** 3×3 网格的 8 条获胜线（格子下标 0..8，按行优先）。 */
export const LINES: readonly number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** 统计给定已点亮格集合下，已完整连成的线数。 */
export function countLines(marked: ReadonlySet<number>): number {
  return LINES.filter((ln) => ln.every((i) => marked.has(i))).length;
}

/** 列出当前已完整连成的所有线（下标数组）。 */
export function completedLines(marked: ReadonlySet<number>): number[][] {
  return LINES.filter((ln) => ln.every((i) => marked.has(i)));
}

/** 判断某个格子是否在任意一条已连成的线上。 */
export function isOnCompletedLine(
  idx: number,
  marked: ReadonlySet<number>,
): boolean {
  return completedLines(marked).some((ln) => ln.includes(idx));
}

/**
 * 选择下一步要"导向"的目标线：在尚未连成的线里，取当前已点亮格子最多的一条。
 * 用于让喊号优先补齐差一格就成的线（最短路径导向宾果）。
 * 平局时取 LINES 中靠前的（确定性，便于测试）。
 * 返回 null 表示所有线都已连成。
 */
export function pickTargetLine(
  marked: ReadonlySet<number>,
): number[] | null {
  let best: number[] | null = null;
  let bestCnt = -1;
  for (const ln of LINES) {
    if (ln.every((i) => marked.has(i))) continue; // 已连成，跳过
    const cnt = ln.filter((i) => marked.has(i)).length;
    if (cnt > bestCnt) {
      bestCnt = cnt;
      best = ln;
    }
  }
  return best;
}

/**
 * 选下一个该"喊"的格子下标：目标线上第一个未点亮的格子；
 * 若目标线已满（兜底），返回任意未点亮的格子；全点亮返回 -1。
 * 确定性（不依赖随机），便于测试。
 */
export function nextCallIndex(marked: ReadonlySet<number>): number {
  const target = pickTargetLine(marked);
  if (target) {
    const c = target.find((i) => !marked.has(i));
    if (c !== undefined) return c;
  }
  // 兜底：最小下标的未点亮格子
  for (let i = 0; i < 9; i++) {
    if (!marked.has(i)) return i;
  }
  return -1;
}
