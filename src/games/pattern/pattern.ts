/**
 * 找规律 —— 序列生成与验证。
 * 纯函数，便于单元测试。
 */

/** 生成一个长度为 len 的重复序列，period 决定循环节长度。 */
export function genSequence(
  len: number,
  period: number,
  pool: readonly string[],
): string[] {
  const cycle: string[] = [];
  const used = shuffleCopy(pool).slice(0, period);
  for (let i = 0; i < period; i++) cycle.push(used[i]!);
  const seq: string[] = [];
  for (let i = 0; i < len; i++) seq.push(cycle[i % period]!);
  return seq;
}

/** 序列的下一个元素（正确答案）。 */
export function nextOf(seq: string[], period: number): string {
  return seq[seq.length % period] ?? seq[0]!;
}

function shuffleCopy<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
