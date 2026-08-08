/* sudoku-shape/engine.ts —— 3×3 形状数独纯逻辑（与 DOM 解耦）。
   规则：在 3×3 网格里填入 3 种符号，使每一行、每一列的符号都不重复（拉丁方阵）。
   提取自 index.ts 的解生成/校验/挖空，便于直接单元测试。 */

/** 3 种符号（默认形状）。 */
export const SHAPES = ["🔴", "🔷", "🟢"] as const;

/** 3×3 棋盘（9 格，按行优先展开，索引 = y*3 + x）。null 表示空格。 */
export type Board = (string | null)[];

/** 生成一个合法解：每行是基础排列的循环移位（保证每行每列都不重复）。
 *  可传入自定义符号集（默认 SHAPES）。返回 9 格的解。 */
export function generateSolution(shapes: readonly string[] = SHAPES): string[] {
  const base = shapes;
  const sol: string[] = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      sol.push(base[(x + y) % 3]!);
    }
  }
  return sol;
}

/** 校验每行每列是否都不重复（含空格则视为不合法——空格不算重复但需先填满）。
 *  仅当 9 格全填满且每行每列无重复时返回 true。 */
export function validate(board: Board, shapes: readonly string[] = SHAPES): boolean {
  if (board.some((v) => v === null)) return false;
  const n = shapes.length; // 3
  // 每行
  for (let y = 0; y < n; y++) {
    const row = Array.from({ length: n }, (_, x) => board[y * n + x]);
    if (new Set(row).size !== n) return false;
  }
  // 每列
  for (let x = 0; x < n; x++) {
    const col = Array.from({ length: n }, (_, y) => board[y * n + x]);
    if (new Set(col).size !== n) return false;
  }
  return true;
}

/** 校验当前已填部分是否仍合法（允许空格）：仅检查已填符号在同行同列不重复。
 *  用于「填入即校验」的实时反馈。 */
export function isPartialValid(board: Board): boolean {
  const n = 3;
  // 每行：非空符号无重复
  for (let y = 0; y < n; y++) {
    const seen = new Set<string>();
    for (let x = 0; x < n; x++) {
      const v = board[y * n + x];
      if (!v) continue;
      if (seen.has(v)) return false;
      seen.add(v);
    }
  }
  // 每列
  for (let x = 0; x < n; x++) {
    const seen = new Set<string>();
    for (let y = 0; y < n; y++) {
      const v = board[y * n + x];
      if (!v) continue;
      if (seen.has(v)) return false;
      seen.add(v);
    }
  }
  return true;
}

/** 找出冲突格索引集合：行或列里出现 >1 次的符号所在格。空格跳过。 */
export function findConflicts(board: Board): Set<number> {
  const conflict = new Set<number>();
  const n = 3;
  // 行
  for (let y = 0; y < n; y++) {
    const seen: Record<string, number[]> = {};
    for (let x = 0; x < n; x++) {
      const idx = y * n + x;
      const v = board[idx];
      if (!v) continue;
      (seen[v] ??= []).push(idx);
    }
    Object.values(seen).forEach((arr) => {
      if (arr.length > 1) arr.forEach((i) => conflict.add(i));
    });
  }
  // 列
  for (let x = 0; x < n; x++) {
    const seen: Record<string, number[]> = {};
    for (let y = 0; y < n; y++) {
      const idx = y * n + x;
      const v = board[idx];
      if (!v) continue;
      (seen[v] ??= []).push(idx);
    }
    Object.values(seen).forEach((arr) => {
      if (arr.length > 1) arr.forEach((i) => conflict.add(i));
    });
  }
  return conflict;
}

/** 根据解挖空：随机选 blanks 个位置置 null，其余保留。
 *  返回 { board, blankSet }。blankSet 为被挖空的索引集合。 */
export function digBlanks(
  solution: string[],
  blanks: number,
  shuffle: <T>(arr: T[]) => T[],
): { board: Board; blankSet: Set<number> } {
  const idxList = shuffle(solution.map((_, i) => i));
  const blankSet = new Set(idxList.slice(0, blanks));
  const board: Board = solution.map((s, i) => (blankSet.has(i) ? null : s));
  return { board, blankSet };
}

/** 循环切换：当前位置（含 null/undefined）切换到下一个符号。
 *  null → shapes[0]，shapes[i] → shapes[(i+1) % n]。返回新符号。 */
export function cycleCell(
  current: string | null | undefined,
  shapes: readonly string[] = SHAPES,
): string {
  const idx = current ? shapes.indexOf(current) : -1;
  return shapes[(idx + 1) % shapes.length]!;
}
