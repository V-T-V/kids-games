/**
 * 数字华容道（15-puzzle）核心算法 —— 纯函数，无 DOM 依赖，便于单元测试。
 *
 * 从 index.ts 提取，确保经典滑块拼图核心逻辑（已解判定/相邻判定/空格邻居/
 * 坐标转换/初始化已解盘）可直接测试，不依赖浏览器与游戏状态机。
 *
 * 棋盘约定：n×n 一维数组 tiles，元素为方块编号 1..n*n-1，0 表示空格。
 * 坐标：x 为列（0..n-1）、y 为行（0..n-1），索引 idx = y*n + x。
 * 已解状态：tiles = [1,2,3,...,n*n-1,0]（前 n*n-1 升序，末位为空格）。
 */
export type Tiles = number[];

/** 生成 n×n 的已解盘：[1,2,...,n*n-1,0]。 */
export function solvedBoard(n: number): Tiles {
  const total = n * n;
  const out: number[] = [];
  for (let i = 0; i < total; i++) out.push((i + 1) % total);
  return out;
}

/** 一维索引 ↔ 二维坐标互转。 */
export function toXY(idx: number, n: number): { x: number; y: number } {
  return { x: idx % n, y: Math.floor(idx / n) };
}
export function toIdx(x: number, y: number, n: number): number {
  return y * n + x;
}

/** 判断盘面是否已解：前 n*n-1 个为 1,2,3...，末位为 0。 */
export function isSolved(tiles: Tiles, n: number): boolean {
  if (tiles.length !== n * n) return false;
  for (let i = 0; i < tiles.length - 1; i++) {
    if (tiles[i] !== i + 1) return false;
  }
  return tiles[tiles.length - 1] === 0;
}

/** 两索引对应的格子是否相邻（曼哈顿距离恰为 1）。 */
export function isAdjacent(idxA: number, idxB: number, n: number): boolean {
  const a = toXY(idxA, n);
  const b = toXY(idxB, n);
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

/** 空格（值为 0 的格子）的所有合法邻居索引（棋盘内、上下左右）。 */
export function neighbors(blank: number, n: number): number[] {
  const { x: bx, y: by } = toXY(blank, n);
  const offsets: ReadonlyArray<readonly [number, number]> = [
    [bx - 1, by],
    [bx + 1, by],
    [bx, by - 1],
    [bx, by + 1],
  ];
  const out: number[] = [];
  for (const [x, y] of offsets) {
    if (x >= 0 && x < n && y >= 0 && y < n) out.push(toIdx(x, y, n));
  }
  return out;
}

/** 交换两索引处的值（返回新数组，不改原）。 */
export function swapAt(tiles: Tiles, i: number, j: number): Tiles {
  const out = [...tiles];
  const t = out[i]!;
  out[i] = out[j]!;
  out[j] = t;
  return out;
}

/** 找到空格（0）所在的一维索引。盘面恰有一个 0。 */
export function findBlank(tiles: Tiles): number {
  return tiles.indexOf(0);
}

/**
 * 执行一步合法移动：把与空格相邻的 idx 处的方块滑入空格。
 * 若 idx 不与空格相邻，则返回原盘（非法移动被忽略）。
 * 返回新数组，不改原。
 */
export function moveTile(tiles: Tiles, idx: number, n: number): Tiles {
  const blank = findBlank(tiles);
  if (!isAdjacent(idx, blank, n)) return tiles;
  return swapAt(tiles, blank, idx);
}

/**
 * 用一步合法随机移动打乱（保证可解性）。
 * 返回 {tiles, blankIdx}：打乱后的盘面与新空格位置。不改原。
 * 注：实际随机性由调用方通过 nextPick(blanks) 注入，便于确定性测试。
 */
export function shuffleStep(
  tiles: Tiles,
  blank: number,
  n: number,
  nextPick: (neighbors: number[]) => number = (arr) =>
    arr[Math.floor(Math.random() * arr.length)]!,
): { tiles: Tiles; blank: number } {
  const ns = neighbors(blank, n);
  const pick = nextPick(ns);
  const next = swapAt(tiles, blank, pick);
  return { tiles: next, blank: pick };
}
