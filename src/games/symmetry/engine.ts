/**
 * 对称补全 纯逻辑引擎 —— 把对称判定从 index.ts 提取为可单测的纯函数。
 *
 * 规则：n×n 网格，中线（列）为镜面。左半 left[y][x]（x=0..half-1）是给定图案，
 * 右半 right[y][x]（x=0..half-1）是孩子填的镜像。镜像关系：
 *   right[y][x] 应等于 left[y][half-1-x]（沿中线翻转列序）。
 *
 * half = Math.ceil(n/2)，中线本身不参与图案（仅作视觉分隔）。
 */

/** 半宽（左/右半的列数）。n=4→2，n=6→3，n=8→4。 */
export function halfOf(n: number): number {
  return Math.ceil(n / 2);
}

/**
 * 判断右半是否为左半的镜像（沿中线翻转列序）。
 * 两侧长度需一致且每行长度一致（half），否则视为不匹配返回 false（防御）。
 * @param left 给定的左半图案（half 列 × n 行）
 * @param right 孩子填的右半图案（half 列 × n 行）
 */
export function isMirror(
  left: boolean[][],
  right: boolean[][],
): boolean {
  if (left.length === 0 || left.length !== right.length) return false;
  const half = left[0]!.length;
  if (half === 0) return false;
  for (let y = 0; y < left.length; y++) {
    const lr = left[y]!;
    const rr = right[y]!;
    if (lr.length !== half || rr.length !== half) return false;
    for (let x = 0; x < half; x++) {
      // 镜像：右半第 x 列应等于左半第 half-1-x 列
      if (rr[x] !== lr[half - 1 - x]) return false;
    }
  }
  return true;
}

/**
 * 生成左半的镜像（正确答案右半）。
 * 纯函数：用于测试时构造期望值，也用于「显示提示」等场景。
 */
export function mirrorOf(left: boolean[][]): boolean[][] {
  const half = left[0]?.length ?? 0;
  return left.map((row) =>
    row
      .slice()
      // 列序翻转：right[x] = left[half-1-x]
      .map((_, x) => row[half - 1 - x]!),
  );
}

/**
 * 统计左半中点亮的格子数（孩子需要补的格子数 = need）。
 */
export function countFilled(left: boolean[][]): number {
  return left.flat().filter(Boolean).length;
}

/**
 * 用确定性 RNG 生成左半图案（便于单测，避免 Math.random 不可复现）。
 * @param n 网格边长
 * @param rand 返回 [0,1) 的函数（默认 Math.random）
 */
export function genHalf(
  n: number,
  rand: () => number = Math.random,
): boolean[][] {
  const half = halfOf(n);
  const left: boolean[][] = [];
  for (let y = 0; y < n; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < half; x++) row.push(rand() < 0.5);
    left.push(row);
  }
  return left;
}
