/**
 * 2048 核心合并算法 —— 纯函数，无 DOM 依赖，便于单元测试。
 *
 * 从 index.ts 提取，确保经典 2048 核心逻辑（合并/方向提取/回填/无解判定）
 * 可直接测试，不依赖浏览器与游戏状态机。
 *
 * 棋盘约定：4×4 二维数组 board[r][c]，0 表示空格。
 * 方向：left/right/up/down。
 */
export type Dir = "up" | "down" | "left" | "right";
export type Board = number[][];

/** 一行向左合并：去零 + 相邻相同合并 + 补零到长度 4。
 *  返回合并后的行与是否发生过合并。 */
export function collapse(
  line: number[],
  len = 4,
): { line: number[]; merged: boolean } {
  const nums = line.filter((v) => v !== 0);
  const out: number[] = [];
  let merged = false;
  let i = 0;
  while (i < nums.length) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      out.push(nums[i]! * 2);
      merged = true;
      i += 2;
    } else {
      out.push(nums[i]!);
      i += 1;
    }
  }
  while (out.length < len) out.push(0);
  return { line: out, merged };
}

/** 按方向提取 4 条线（每条线是该方向上要合并的序列）。
 *  合并方向「朝向」开头：left 取原行、right 取反行、up 取列、down 取反列。 */
export function extract(board: Board, dir: Dir, size = 4): number[][] {
  const lines: number[][] = [];
  if (dir === "left") {
    for (let r = 0; r < size; r++) lines.push([...board[r]!]);
  } else if (dir === "right") {
    for (let r = 0; r < size; r++) lines.push([...board[r]!].reverse());
  } else if (dir === "up") {
    for (let c = 0; c < size; c++) {
      const col: number[] = [];
      for (let r = 0; r < size; r++) col.push(board[r]![c]!);
      lines.push(col);
    }
  } else {
    // down：从底向顶取列
    for (let c = 0; c < size; c++) {
      const col: number[] = [];
      for (let r = size - 1; r >= 0; r--) col.push(board[r]![c]!);
      lines.push(col);
    }
  }
  return lines;
}

/** 把 collapse 后的 lines 按方向回填到棋盘（返回新棋盘，不改原）。 */
export function apply(
  board: Board,
  dir: Dir,
  lines: number[][],
  size = 4,
): Board {
  const out: Board = board.map((row) => [...row]);
  if (dir === "left") {
    for (let r = 0; r < size; r++) out[r] = lines[r]!;
  } else if (dir === "right") {
    for (let r = 0; r < size; r++) out[r] = lines[r]!.reverse();
  } else if (dir === "up") {
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) out[r]![c] = lines[c]![r]!;
    }
  } else {
    // down：列从底向顶回填
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) out[size - 1 - r]![c] = lines[c]![r]!;
    }
  }
  return out;
}

/** 判断棋盘是否还有可走的步（有空格 或 有相邻同值）。 */
export function hasMoves(board: Board, size = 4): boolean {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r]![c] === 0) return true;
      if (c < size - 1 && board[r]![c] === board[r]![c + 1]) return true;
      if (r < size - 1 && board[r]![c] === board[r + 1]![c]) return true;
    }
  }
  return false;
}

/** 取棋盘上的最大值（用于判定是否达到目标）。 */
export function maxValue(board: Board): number {
  return Math.max(0, ...board.flat());
}
