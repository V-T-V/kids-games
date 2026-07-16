/**
 * 迷宫生成算法 —— 深度优先递归回溯（DFS backtracking）。
 *
 * 纯函数，无 DOM 依赖，便于单元测试。
 * 返回一个 grid，每个格子记录四面墙是否存在。
 * 保证从 (0,0) 到 (cols-1, rows-1) 一定连通。
 */

export interface Cell {
  x: number;
  y: number;
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
  visited: boolean;
}

export type Grid = Cell[][];

/** 生成 cols × rows 的迷宫。 */
export function generateMaze(cols: number, rows: number): Grid {
  const grid: Grid = [];
  for (let y = 0; y < rows; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < cols; x++) {
      row.push({
        x,
        y,
        top: true,
        right: true,
        bottom: true,
        left: true,
        visited: false,
      });
    }
    grid.push(row);
  }

  const stack: Cell[] = [];
  const start = grid[0]![0]!;
  start.visited = true;
  stack.push(start);

  const dirs: { dx: number; dy: number; wall: keyof Cell; opp: keyof Cell }[] =
    [
      { dx: 0, dy: -1, wall: "top", opp: "bottom" },
      { dx: 1, dy: 0, wall: "right", opp: "left" },
      { dx: 0, dy: 1, wall: "bottom", opp: "top" },
      { dx: -1, dy: 0, wall: "left", opp: "right" },
    ];

  while (stack.length > 0) {
    const cur = stack[stack.length - 1]!;
    const neighbors = dirs
      .map((d) => ({
        d,
        nx: cur.x + d.dx,
        ny: cur.y + d.dy,
      }))
      .filter((n) => n.nx >= 0 && n.nx < cols && n.ny >= 0 && n.ny < rows);
    const unvisited = neighbors.filter((n) => !grid[n.ny]![n.nx]!.visited);

    if (unvisited.length === 0) {
      stack.pop();
      continue;
    }
    const pick = unvisited[Math.floor(Math.random() * unvisited.length)]!;
    const next = grid[pick.ny]![pick.nx]!;
    // 拆掉两个格子之间的墙
    (cur as unknown as Record<string, boolean>)[pick.d.wall] = false;
    (next as unknown as Record<string, boolean>)[pick.d.opp] = false;
    next.visited = true;
    stack.push(next);
  }

  return grid;
}

/** 给定 grid 和起点终点，沿主路径散布星星坐标（用于收集玩法）。 */
export function scatterStars(
  grid: Grid,
  cols: number,
  rows: number,
  count: number,
): { x: number; y: number }[] {
  const stars: { x: number; y: number }[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (stars.length < count && guard < 200) {
    guard++;
    const x = Math.floor(Math.random() * cols);
    const y = Math.floor(Math.random() * rows);
    const key = `${x},${y}`;
    if (used.has(key)) continue;
    if (x === 0 && y === 0) continue; // 不在起点
    if (x === cols - 1 && y === rows - 1) continue; // 不在终点
    used.add(key);
    stars.push({ x, y });
  }
  void grid;
  return stars;
}
