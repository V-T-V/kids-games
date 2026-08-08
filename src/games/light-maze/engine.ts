/* light-maze/engine.ts —— 光线迷宫纯逻辑（与 DOM 解耦）。
   镜子方向：0=空，1=/，2=\ 。
   方向：0=右，1=下，2=左，3=上。
   提取自 index.ts 的 reflect/trace，便于直接单元测试光路传播与镜面反射。 */

/** 镜子方向：0=空，1=/，2=\ 。 */
export type Mirror = 0 | 1 | 2;
/** 方向：0=右，1=下，2=左，3=上。 */
export type Dir = 0 | 1 | 2 | 3;

/** 旋转：右0 下1 左2 上3 → 向量。 */
export const DVEC: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** 镜面反射：方向 d 撞到镜 m 后的新方向。
 *  / : 右↔上, 下↔左  (0↔3, 1↔2)
 *  \ : 右↔下, 上↔左  (0↔1, 3↔2) */
export function reflect(d: Dir, m: Exclude<Mirror, 0>): Dir {
  if (m === 1) {
    // /
    const map: Record<Dir, Dir> = { 0: 3, 3: 0, 1: 2, 2: 1 };
    return map[d];
  }
  const map: Record<Dir, Dir> = { 0: 1, 1: 0, 2: 3, 3: 2 };
  return map[d];
}

export interface TraceResult {
  /** 光路经过的格子序列（按时间顺序，不含起点外的虚拟格）。 */
  cells: Array<[number, number]>;
  /** 是否命中右侧目标（光向右出界到 goalRow）。 */
  hit: boolean;
  /** 是否因越界（非命中目标）终止。 */
  outOfBounds: boolean;
}

/** 追踪光线路径。光从左侧 (col=-1, row=srcRow) 向右进入 n×n 网格。
 *  到达右侧 (col=n) 且方向=右 且 row=goalRow 视为命中目标。
 *  带 guard 防死循环（光路在网格内循环时强制终止）。 */
export function trace(
  grid: Mirror[][],
  srcRow: number,
  goalRow: number,
  n: number,
): TraceResult {
  const cells: Array<[number, number]> = [];
  let x = -1;
  let y = srcRow;
  let d: Dir = 0; // 光从左向右进
  let hit = false;
  let outOfBounds = false;
  let guard = 0;
  while (guard++ < n * n * 4 + 8) {
    const [dx, dy] = DVEC[d]!;
    const nx = x + dx;
    const ny = y + dy;
    // 出界判定
    if (ny < 0 || ny >= n) {
      if (nx === n && ny === goalRow && d === 0) {
        hit = true; // 从右侧命中目标（光向右出界到目标行）
      } else {
        outOfBounds = true;
      }
      break;
    }
    if (nx < 0) {
      outOfBounds = true;
      break;
    }
    if (nx >= n) {
      if (d === 0 && ny === goalRow) hit = true;
      else outOfBounds = true;
      break;
    }
    cells.push([nx, ny]);
    const m = grid[ny]![nx]!;
    if (m !== 0) {
      d = reflect(d, m);
    }
    x = nx;
    y = ny;
  }
  return { cells, hit, outOfBounds };
}

/** 造一个 n×n 的空网格（全 0）。 */
export function emptyGrid(n: number): Mirror[][] {
  return Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0 as Mirror),
  );
}

/** 在网格里放一面镜子（不可变：返回新网格）。 */
export function setMirror(
  grid: Mirror[][],
  x: number,
  y: number,
  m: Mirror,
): Mirror[][] {
  const next = grid.map((r) => r.slice());
  next[y]![x] = m;
  return next;
}
