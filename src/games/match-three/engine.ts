/**
 * 三消核心算法 —— 纯函数，无 DOM 依赖，便于单元测试。
 *
 * 从 index.ts 提取，确保经典三消核心逻辑（三连扫描/重力下落/可走步判定/相邻判定）
 * 可直接测试，不依赖浏览器与游戏状态机。
 *
 * 网格约定：n×n 二维数组 grid[y][x]，元素为宝石 id（0..GEM_COUNT-1）或 null（空格，
 * 消除后、重力下落前的过渡态）。坐标 x 为列、y 为行。
 */
export type Gem = number | null;
export type Grid = Gem[][];
export type Coord = `${number},${number}`;

/** 四邻方向向量（右/下/左/上）。 */
export const ADJ: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** 两格是否相邻（曼哈顿距离恰为 1，即上下左右相邻）。 */
export function isAdjacent(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1;
}

/** 交换两格（返回新网格，不改原）。 */
export function swap(
  grid: Grid,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Grid {
  const out = grid.map((row) => [...row]);
  const t = out[y1]![x1]!;
  out[y1]![x1] = out[y2]![x2]!;
  out[y2]![x2] = t;
  return out;
}

/**
 * 找出所有属于三连（行或列，≥3 连续同色）的格子坐标集合。
 * null 视为「断点」，不参与连成。
 * 返回 Set<"x,y">，便于 O(1) 查重与逐格清除。
 */
export function findMatches(grid: Grid, n = grid.length): Set<Coord> {
  const m = new Set<Coord>();
  // 行扫描
  for (let y = 0; y < n; y++) {
    let run = 1;
    for (let x = 1; x <= n; x++) {
      const cur = x < n ? grid[y]![x] : null;
      const prev = grid[y]![x - 1]!;
      if (cur != null && cur === prev) {
        run += 1;
      } else {
        if (run >= 3) {
          for (let k = x - run; k < x; k++) m.add(`${k},${y}`);
        }
        run = 1;
      }
    }
  }
  // 列扫描
  for (let x = 0; x < n; x++) {
    let run = 1;
    for (let y = 1; y <= n; y++) {
      const cur = y < n ? grid[y]![x] : null;
      const prev = grid[y - 1]![x]!;
      if (cur != null && cur === prev) {
        run += 1;
      } else {
        if (run >= 3) {
          for (let k = y - run; k < y; k++) m.add(`${x},${k}`);
        }
        run = 1;
      }
    }
  }
  return m;
}

/**
 * 重力下落：每列非空宝石沉到底，顶部空位用新宝石填充。
 * fill(topGen)：顶部补充的宝石 id 由调用方传入的生成器决定（默认填充 0）。
 * 返回新网格，不改原。列内相对顺序保持不变（稳定下落）。
 */
export function applyGravity(
  grid: Grid,
  n = grid.length,
  topGen: () => number = () => 0,
): Grid {
  const out: Grid = grid.map((row) => [...row]);
  for (let x = 0; x < n; x++) {
    // 自底向上收集本列非空宝石
    const col: number[] = [];
    for (let y = n - 1; y >= 0; y--) {
      const g = out[y]![x]!;
      if (g != null) col.push(g);
    }
    // 顶部补足新宝石（直到填满 n 个）
    while (col.length < n) col.push(topGen());
    // 写回（col 从底到顶）
    for (let y = n - 1, i = 0; y >= 0; y--, i++) {
      out[y]![x] = col[i]!;
    }
  }
  return out;
}

/**
 * 是否存在至少一个能立即产生消除的相邻交换。
 * 逐一尝试所有相邻对：交换→查匹配→换回。任一命中即返回 true。
 * 不改原网格（内部换回）。
 */
export function hasMove(grid: Grid, n = grid.length): boolean {
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      for (const [dx, dy] of ADJ) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const swapped = swap(grid, x, y, nx, ny);
        if (findMatches(swapped, n).size > 0) return true;
      }
    }
  }
  return false;
}

/**
 * 清除匹配集合中的格子（置 null）。返回新网格，不改原。
 * 用于消除后、重力下落前的过渡态。
 */
export function clearMatches(grid: Grid, matches: Set<Coord>): Grid {
  const out: Grid = grid.map((row) => [...row]);
  for (const key of matches) {
    const [x, y] = key.split(",").map(Number);
    if (x == null || y == null) continue;
    if (out[y] != null && out[y]![x] != null) out[y]![x] = null;
  }
  return out;
}

/**
 * 校验初始网格「无现成三连」约束：
 * 不存在任意 3 个连续同色（行或列）。用于生成合法初盘的不变量校验。
 */
export function hasNoInitialMatch(grid: Grid, n = grid.length): boolean {
  return findMatches(grid, n).size === 0;
}
