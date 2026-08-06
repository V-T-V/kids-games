/**
 * 平衡秤候选砝码池构造 —— 纯函数，无 DOM 依赖，便于单元测试。
 *
 * 从 index.ts 提取。给定目标总重，构造一组 1-3 的砝码，
 * 保证子集之和恰等于目标（可解），并附加干扰项。
 */

/** 每个砝码取值范围（含两端）。 */
export const WEIGHT_MIN = 1;
export const WEIGHT_MAX = 3;

/**
 * 把 target 拆成若干 [1,3] 的砝码（贪心取 3，即「最大块优先」）。
 * 保证这些砝码之和恰等于 target。target 为 0 返回空数组。
 *
 * 例：target=7 → [3,3,1]；target=3 → [3]；target=5 → [3,2]。
 */
export function splitTarget(target: number): number[] {
  if (target <= 0) return [];
  const out: number[] = [];
  let rest = target;
  while (rest > 0) {
    const take = Math.min(WEIGHT_MAX, rest);
    out.push(take);
    rest -= take;
  }
  return out;
}

/** 生成单个 [WEIGHT_MIN, WEIGHT_MAX] 的随机砝码。注入 rng 便于测试。 */
export function randomWeight(rng: () => number = Math.random): number {
  return Math.floor(rng() * (WEIGHT_MAX - WEIGHT_MIN + 1)) + WEIGHT_MIN;
}

/**
 * 构造候选砝码池：先放 target 的拆分解（保证可解），再附加 distract 个随机干扰。
 * 小目标（target <= 3）用单块等于 target 的解，简单关友好。
 * 注入 rng 以便测试可复现。
 */
export function buildPool(
  target: number,
  distract: number,
  rng: () => number = Math.random,
): number[] {
  const pool: number[] = [];
  if (target > 0 && target <= WEIGHT_MAX) {
    pool.push(target);
  } else {
    pool.push(...splitTarget(target));
  }
  for (let i = 0; i < distract; i++) {
    pool.push(randomWeight(rng));
  }
  return pool;
}

/** 验证池中是否存在子集之和等于 target（判定可解性，穷举子集和）。 */
export function hasSolution(pool: number[], target: number): boolean {
  // 子集和 DP（池子很小，N<=12）
  const reachable = new Set<number>([0]);
  for (const w of pool) {
    const next = new Set<number>();
    for (const s of reachable) {
      next.add(s);
      next.add(s + w);
    }
    reachable.clear();
    for (const s of next) reachable.add(s);
  }
  return reachable.has(target);
}
