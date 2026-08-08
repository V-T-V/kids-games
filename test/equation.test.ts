/* equation 纯逻辑测试——等式填空题目生成不变量（a≠b 防一题多解/运算符选择/减法非负/选项含答案）。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  genEquation,
  mk,
  computeResult,
  isBalanced,
  ambiguousOps,
  OP_SYM,
  OPS_BY_DIFF,
} from "../src/games/equation/engine.ts";

// 循环计数 randInt：每次返回 (1..max) 循环，保证连续调用不恒等（避免 a===b 死循环）
function makeCyclicRandInt(): (min: number, max: number) => number {
  let n = 0;
  return (_min: number, max: number): number => {
    n = (n % max) + 1; // 1..max 循环
    return n;
  };
}
const identityShuffle = <T>(arr: T[]): T[] => arr.slice();

// 让 a≠b 的确定性 randInt：第一次返回 a，第二次返回不同值
function makeDistinctRandInt(aVal: number, bVal: number) {
  let calls = 0;
  return (_min: number, _max: number): number => {
    calls++;
    return calls === 1 ? aVal : bVal;
  };
}

test("OP_SYM: 三运算符 emoji 映射", () => {
  assert.equal(OP_SYM["+"], "➕");
  assert.equal(OP_SYM["-"], "➖");
  assert.equal(OP_SYM["×"], "✖️");
});

test("OPS_BY_DIFF: easy/medium 仅加减，hard 含乘", () => {
  assert.deepEqual(OPS_BY_DIFF.easy, ["+", "-"]);
  assert.deepEqual(OPS_BY_DIFF.medium, ["+", "-"]);
  assert.deepEqual(OPS_BY_DIFF.hard, ["+", "-", "×"]);
});

test("computeResult: 加减乘正确", () => {
  assert.equal(computeResult(3, 2, "+"), 5);
  assert.equal(computeResult(5, 2, "-"), 3);
  assert.equal(computeResult(3, 2, "×"), 6);
});

test("computeResult: 减法可为负（由调用方保证非负）", () => {
  assert.equal(computeResult(2, 5, "-"), -3);
});

test("genEquation: a≠b（防一题多解）", () => {
  // 多次随机生成，每次 a!==b（用循环计数 rng 避免 a===b 死循环）
  const rng = makeCyclicRandInt();
  for (let i = 0; i < 50; i++) {
    const eq = genEquation("hard", rng, identityShuffle);
    // 文本形如 "a  ?  b  =  result"，解析前两个数
    const nums = eq.text.match(/\d+/g)!;
    const a = Number(nums[0]);
    const b = Number(nums[1]);
    assert.notEqual(a, b, `a 不应等于 b：${eq.text}`);
  }
});

test("genEquation: 文本格式正确（含 ? 与 = 与结果）", () => {
  const eq = genEquation("easy", makeDistinctRandInt(3, 2), identityShuffle);
  assert.match(eq.text, /^\d+  \?  \d+  =  -?\d+$/);
});

test("genEquation: 答案 emoji 在候选选项中", () => {
  for (const diff of ["easy", "medium", "hard"]) {
    const eq = genEquation(diff, makeDistinctRandInt(4, 2), identityShuffle);
    assert.ok(eq.ops.includes(eq.answer), `${diff} 答案应在选项中`);
  }
});

test("genEquation: 减法结果非负（大减小）", () => {
  const rng = makeCyclicRandInt();
  for (let i = 0; i < 30; i++) {
    const eq = genEquation("easy", rng, identityShuffle);
    const nums = eq.text.match(/\d+/g)!;
    const result = Number(nums[2]);
    assert.ok(result >= 0, `减法结果应非负：${eq.text}`);
  }
});

test("genEquation: 选项数 2-3（easy 2 / hard 最多 3）", () => {
  const easy = genEquation("easy", makeDistinctRandInt(3, 2), identityShuffle);
  assert.ok(easy.ops.length >= 2 && easy.ops.length <= 3);
  const hard = genEquation("hard", makeDistinctRandInt(3, 2), identityShuffle);
  assert.ok(hard.ops.length >= 2 && hard.ops.length <= 3);
});

test("genEquation: 选项无重复", () => {
  for (const diff of ["easy", "medium", "hard"]) {
    const eq = genEquation(diff, makeDistinctRandInt(4, 1), identityShuffle);
    assert.equal(new Set(eq.ops).size, eq.ops.length);
  }
});

test("genEquation: 答案对应等式确实成立（isBalanced）", () => {
  // 用确定性 rng：a=4 b=1，identity shuffle → ops[0] 是第一个运算符
  for (const diff of ["easy", "hard"]) {
    const eq = genEquation(diff, makeDistinctRandInt(4, 1), identityShuffle);
    const nums = eq.text.match(/\d+/g)!;
    const a = Number(nums[0]);
    const b = Number(nums[1]);
    const result = Number(nums[2]);
    // 反查答案对应的运算符
    const op = Object.keys(OP_SYM).find((k) => OP_SYM[k] === eq.answer)!;
    assert.ok(isBalanced(a, b, op, result), `${diff}: ${eq.text} 用 ${op} 应成立`);
  }
});

test("mk: 文本含 a/b/result", () => {
  const eq = mk(5, 3, "+", 8, ["+", "-"], identityShuffle);
  assert.equal(eq.text, "5  ?  3  =  8");
  assert.equal(eq.answer, "➕");
});

test("mk: 候选含正确答案 + 至多 2 干扰", () => {
  const eq = mk(5, 3, "-", 2, ["+", "-", "×"], identityShuffle);
  assert.ok(eq.ops.includes("➖"));
  assert.ok(eq.ops.length <= 3);
});

test("isBalanced: 加法成立", () => {
  assert.ok(isBalanced(2, 3, "+", 5));
});

test("isBalanced: 不成立", () => {
  assert.ok(!isBalanced(2, 3, "+", 6));
});

test("ambiguousOps: a===b 时 + 与 × 结果相同", () => {
  // 2+2=4 与 2×2=4 → 歧义
  const amb = ambiguousOps(2, 2);
  assert.ok(amb.includes("+"));
  assert.ok(amb.includes("×"));
});

test("ambiguousOps: a!==b 时无歧义", () => {
  assert.deepEqual(ambiguousOps(3, 2), []);
});

test("genEquation: 端到端可解——答案运算符使等式成立", () => {
  const rng = makeCyclicRandInt();
  for (let i = 0; i < 40; i++) {
    const eq = genEquation("hard", rng, identityShuffle);
    const nums = eq.text.match(/\d+/g)!;
    const a = Number(nums[0]);
    const b = Number(nums[1]);
    const result = Number(nums[2]);
    const op = Object.keys(OP_SYM).find((k) => OP_SYM[k] === eq.answer)!;
    assert.equal(computeResult(a, b, op), result);
  }
});

test("genEquation: 未知难度回退 easy 运算符集", () => {
  const eq = genEquation("unknown", makeDistinctRandInt(3, 2), identityShuffle);
  // 仅加减候选
  assert.ok(eq.ops.every((o) => o === "➕" || o === "➖"));
});
