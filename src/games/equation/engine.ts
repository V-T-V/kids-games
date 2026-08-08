/* equation/engine.ts —— 等式填空纯逻辑（与 DOM 解耦）。
   孩子在等式中选运算符使等式成立（逆向思维，非正向计算）。
   提取自 index.ts 的 genEquation/mk，便于直接单元测试题目生成不变量。 */

/** 等式题：文本展示 / 候选运算符（emoji）/ 正确答案（emoji）。 */
export interface Eq {
  text: string;
  ops: string[];
  answer: string;
}

/** 运算符 → emoji 映射。 */
export const OP_SYM: Record<string, string> = {
  "+": "➕",
  "-": "➖",
  "×": "✖️",
};

/** 各难度可选运算符集合。 */
export const OPS_BY_DIFF: Record<string, string[]> = {
  easy: ["+", "-"],
  medium: ["+", "-"],
  hard: ["+", "-", "×"],
};

/** 计算单运算符表达式结果（保证减法非负由调用方处理大小关系）。 */
export function computeResult(a: number, b: number, op: string): number {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  return a * b; // ×
}

/** 生成等式题：随机 a、b（a≠b 避免一题多解），随机选运算符，计算结果。
 *  - 减法：保证大减小（结果非负），文本里大数在前。
 *  - 候选选项：含正确答案 + 至多 2 个干扰（来自同难度的其它运算符）。
 *  randInt/shuffle 由调用方注入（便于测试确定性）。 */
export function genEquation(
  diff: string,
  randInt: (min: number, max: number) => number,
  shuffle: <T>(arr: T[]) => T[],
): Eq {
  // 保证 a !== b，避免 hard 难度下 a===b 时 "+" 和 "×" 结果相同导致一题多解
  // （如 2+2=4 与 2×2=4，孩子选另一个合法运算符会被误判错）
  const a = randInt(1, 6);
  let b = randInt(1, 6);
  while (a === b) b = randInt(1, 6);
  const ops = OPS_BY_DIFF[diff] ?? OPS_BY_DIFF.easy!;
  const op = shuffle(ops)[0]!;
  if (op === "-") {
    const [x, y] = a >= b ? [a, b] : [b, a];
    const result = computeResult(x, y, op);
    return mk(x, y, op, result, ops, shuffle);
  }
  const result = computeResult(a, b, op);
  return mk(a, b, op, result, ops, shuffle);
}

/** 组装等式题（文本/候选/答案）。 */
export function mk(
  a: number,
  b: number,
  op: string,
  result: number,
  ops: string[],
  shuffle: <T>(arr: T[]) => T[],
): Eq {
  const choices = shuffle([
    ...new Set([op, ...ops.filter((o) => o !== op).slice(0, 2)]),
  ]);
  return {
    text: `${a}  ?  ${b}  =  ${result}`,
    ops: choices.map((o) => OP_SYM[o]!),
    answer: OP_SYM[op]!,
  };
}

/** 校验：给定 a、b、op 时等式是否成立（result 是否与 computeResult 一致）。 */
export function isBalanced(
  a: number,
  b: number,
  op: string,
  result: number,
): boolean {
  return computeResult(a, b, op) === result;
}

/** 校验：a===b 时哪些运算符会产生相同结果（用于演示为何要 a≠b）。 */
export function ambiguousOps(a: number, b: number): string[] {
  if (a !== b) return [];
  const results: Record<number, string[]> = {};
  for (const op of ["+", "-", "×"]) {
    const r = computeResult(a, b, op);
    (results[r] ??= []).push(op);
  }
  return Object.values(results)
    .filter((arr) => arr.length > 1)
    .flat();
}
