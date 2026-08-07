/**
 * 迷你数独核心逻辑 —— 纯函数，无 DOM 依赖，便于单元测试。
 *
 * 从 index.ts 提取。规则简化版数独（拉丁方阵）：n×n 网格填 n 种符号，
 * 使每行、每列符号均不重复（不设 3×3 宫约束）。
 *
 * 棋盘约定：一维数组 board[i]，i = y*n + x；元素为符号或 null（空格）。
 */
export type Cell = string | null;
export type Board = Cell[];

/**
 * 生成一个合法解：基础符号排列的行循环移位（拉丁方阵）。
 * solution[(y*n + x)] = base[(x + y) % n]。
 * 该构造保证每行每列均为 n 个不同符号。
 */
export function generateSolution(syms: string[], n: number): string[] {
  const sol: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      sol.push(syms[(x + y) % n]!);
    }
  }
  return sol;
}

/** 把 solution 按 blankSet 挖空，返回带 null 的棋盘。 */
export function digBlanks(
  solution: string[],
  blankSet: Set<number>,
): Board {
  return solution.map((s, i) => (blankSet.has(i) ? null : s));
}

/**
 * 找出所有冲突索引（行或列中重复出现的非空符号）。
 * 返回冲突索引集合（同一符号在某行/列出现 ≥2 次，所有这些位置均标记）。
 */
export function findConflicts(board: Board, n: number): Set<number> {
  const conflicts = new Set<number>();
  // 行
  for (let y = 0; y < n; y++) {
    const seen: Record<string, number[]> = {};
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const v = board[i];
      if (!v) continue;
      (seen[v] ??= []).push(i);
    }
    for (const arr of Object.values(seen)) {
      if (arr.length > 1) for (const k of arr) conflicts.add(k);
    }
  }
  // 列
  for (let x = 0; x < n; x++) {
    const seen: Record<string, number[]> = {};
    for (let y = 0; y < n; y++) {
      const i = y * n + x;
      const v = board[i];
      if (!v) continue;
      (seen[v] ??= []).push(i);
    }
    for (const arr of Object.values(seen)) {
      if (arr.length > 1) for (const k of arr) conflicts.add(k);
    }
  }
  return conflicts;
}

/** 是否全填满（无 null）。 */
export function isFilled(board: Board): boolean {
  return board.every((v) => v !== null);
}

/** 是否完成：全填满且无冲突。 */
export function isComplete(board: Board, n: number): boolean {
  if (!isFilled(board)) return false;
  return findConflicts(board, n).size === 0;
}

/** 校验一维数组是否构成合法拉丁方阵（每行每列无重复）。 */
export function isLatinSquare(board: string[], n: number): boolean {
  if (board.length !== n * n) return false;
  return findConflicts(board, n).size === 0;
}
