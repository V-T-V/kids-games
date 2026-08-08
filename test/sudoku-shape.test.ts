/* sudoku-shape 纯逻辑测试——3×3 形状数独（拉丁方阵）：解生成/校验/挖空/冲突/循环切换。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHAPES,
  generateSolution,
  validate,
  isPartialValid,
  findConflicts,
  digBlanks,
  cycleCell,
} from "../src/games/sudoku-shape/engine.ts";

// 确定性 shuffle（用于挖空测试可复现）
function detShuffle<T>(arr: T[]): T[] {
  return arr.slice().sort((a, b) => (Number(a) > Number(b) ? 1 : -1));
}

test("SHAPES: 恰好 3 种符号", () => {
  assert.equal(SHAPES.length, 3);
  assert.equal(new Set(SHAPES).size, 3);
});

test("generateSolution: 长度 9（3×3）", () => {
  const sol = generateSolution();
  assert.equal(sol.length, 9);
});

test("generateSolution: 每行无重复（拉丁方阵行约束）", () => {
  const sol = generateSolution();
  for (let y = 0; y < 3; y++) {
    const row = [sol[y * 3]!, sol[y * 3 + 1]!, sol[y * 3 + 2]!];
    assert.equal(new Set(row).size, 3, `第 ${y} 行应无重复`);
  }
});

test("generateSolution: 每列无重复（拉丁方阵列约束）", () => {
  const sol = generateSolution();
  for (let x = 0; x < 3; x++) {
    const col = [sol[x]!, sol[3 + x]!, sol[6 + x]!];
    assert.equal(new Set(col).size, 3, `第 ${x} 列应无重复`);
  }
});

test("generateSolution: 行循环移位——每行是上一行左移1", () => {
  // 行 y 的第 x 列 = base[(x+y)%3]，即行间是循环移位关系
  const sol = generateSolution();
  const r0 = [sol[0]!, sol[1]!, sol[2]!];
  const r1 = [sol[3]!, sol[4]!, sol[5]!];
  // 行1 是行0 左移1：r1[0]==r0[1], r1[1]==r0[2], r1[2]==r0[0]
  assert.equal(r1[0], r0[1]);
  assert.equal(r1[1], r0[2]);
  assert.equal(r1[2], r0[0]);
});

test("validate: 合法完整解 → true", () => {
  assert.ok(validate(generateSolution()));
});

test("validate: 含空格 → false", () => {
  const b: (string | null)[] = generateSolution();
  b[0] = null;
  assert.ok(!validate(b));
});

test("validate: 行有重复 → false", () => {
  const b: (string | null)[] = ["🔴", "🔴", "🔷", "🟢", "🔷", "🟢", "🔷", "🟢", "🔴"];
  // 第0行 🔴🔴 重复
  assert.ok(!validate(b));
});

test("validate: 列有重复 → false", () => {
  const b: (string | null)[] = ["🔴", "🔷", "🟢", "🔴", "🟢", "🔷", "🔷", "🟢", "🔴"];
  // 第0列 🔴🔴 重复
  assert.ok(!validate(b));
});

test("isPartialValid: 全空 → true", () => {
  const b: (string | null)[] = [null, null, null, null, null, null, null, null, null];
  assert.ok(isPartialValid(b));
});

test("isPartialValid: 部分填充无冲突 → true", () => {
  const b: (string | null)[] = ["🔴", null, "🔷", null, "🔷", null, "🔷", null, "🔴"];
  assert.ok(isPartialValid(b));
});

test("isPartialValid: 行重复 → false", () => {
  const b: (string | null)[] = ["🔴", "🔴", null, null, null, null, null, null, null];
  assert.ok(!isPartialValid(b));
});

test("isPartialValid: 列重复 → false", () => {
  const b: (string | null)[] = ["🔴", null, null, "🔴", null, null, null, null, null];
  assert.ok(!isPartialValid(b));
});

test("findConflicts: 无冲突 → 空集", () => {
  const b = generateSolution();
  assert.equal(findConflicts(b).size, 0);
});

test("findConflicts: 行重复标出两个冲突格", () => {
  // 仅第0行 🔴🔴 重复，其余留空避免引入额外冲突
  const b: (string | null)[] = ["🔴", "🔴", "🔷", null, null, null, null, null, null];
  const c = findConflicts(b);
  assert.ok(c.has(0));
  assert.ok(c.has(1));
  assert.equal(c.size, 2);
});

test("findConflicts: 列重复标出冲突格", () => {
  const b: (string | null)[] = ["🔴", "🔷", "🟢", "🔴", "🟢", "🔷", "🔷", "🟢", "🔴"];
  const c = findConflicts(b);
  assert.ok(c.has(0));
  assert.ok(c.has(3));
});

test("findConflicts: 空格不参与冲突判定", () => {
  const b: (string | null)[] = ["🔴", null, null, null, null, null, null, null, null];
  assert.equal(findConflicts(b).size, 0);
});

test("digBlanks: 挖空数正确 + 被挖格为 null", () => {
  const sol = generateSolution();
  const { board, blankSet } = digBlanks(sol, 4, detShuffle);
  assert.equal(blankSet.size, 4);
  let nullCount = 0;
  for (const v of board) if (v === null) nullCount++;
  assert.equal(nullCount, 4);
});

test("digBlanks: 未挖格保留原解符号", () => {
  const sol = generateSolution();
  const { board, blankSet } = digBlanks(sol, 4, detShuffle);
  board.forEach((v, i) => {
    if (!blankSet.has(i)) assert.equal(v, sol[i]);
  });
});

test("digBlanks: blanks=0 → 无空格", () => {
  const { board, blankSet } = digBlanks(generateSolution(), 0, detShuffle);
  assert.equal(blankSet.size, 0);
  assert.ok(board.every((v) => v !== null));
});

test("cycleCell: null → 第一个符号", () => {
  assert.equal(cycleCell(null), SHAPES[0]);
});

test("cycleCell: 第 i 个 → 第 (i+1)%3 个（循环）", () => {
  assert.equal(cycleCell(SHAPES[0]), SHAPES[1]);
  assert.equal(cycleCell(SHAPES[1]), SHAPES[2]);
  assert.equal(cycleCell(SHAPES[2]), SHAPES[0]); // 回到首
});

test("cycleCell: 循环3次 null→[0]→[1]→[2]", () => {
  let cur: string | null = null;
  cur = cycleCell(cur); // → [0]
  cur = cycleCell(cur); // → [1]
  cur = cycleCell(cur); // → [2]
  assert.equal(cur, SHAPES[2]);
});

test("端到端：解→挖空→填回→validate 通过", () => {
  const sol = generateSolution();
  const { board } = digBlanks(sol, 5, detShuffle);
  // 用解把空格填回
  const filled = board.map((v, i) => (v === null ? sol[i] : v)) as (string | null)[];
  assert.ok(validate(filled));
});

test("端到端：解→挖空→故意填错→validate 不通过", () => {
  const sol = generateSolution();
  const { board } = digBlanks(sol, 3, detShuffle);
  // 找一个空格，填入与同行已存在符号重复的值
  const filled = board.map((v, i) => (v === null ? sol[i] : v)) as (string | null)[];
  // 把 (0,0) 改成与 (0,1) 相同 → 行重复
  filled[0] = filled[1] ?? null;
  assert.ok(!validate(filled));
});
