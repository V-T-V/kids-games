/* 迷你数独（mini-sudoku）核心逻辑测试 —— 纯函数，无 DOM。
   覆盖：generateSolution 拉丁方阵性质 / digBlanks / findConflicts 行列重复 /
   isFilled / isComplete / isLatinSquare。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  digBlanks,
  findConflicts,
  generateSolution,
  isComplete,
  isFilled,
  isLatinSquare,
} from "../src/games/mini-sudoku/engine.ts";

const FRUIT = ["🍎", "🍌", "🍇", "🍓"];

test("generateSolution: 长度 = n*n", () => {
  assert.equal(generateSolution(FRUIT, 3).length, 9);
  assert.equal(generateSolution(FRUIT, 4).length, 16);
});

test("generateSolution: 生成的解是合法拉丁方阵", () => {
  for (const n of [2, 3, 4]) {
    const sol = generateSolution(FRUIT, n);
    assert.ok(isLatinSquare(sol, n), `n=${n} 解非拉丁方阵`);
  }
});

test("generateSolution: 每行 n 个不同符号", () => {
  const sol = generateSolution(FRUIT, 3);
  for (let y = 0; y < 3; y++) {
    const row = sol.slice(y * 3, y * 3 + 3);
    assert.equal(new Set(row).size, 3, `第 ${y} 行有重复`);
  }
});

test("generateSolution: 每列 n 个不同符号", () => {
  const sol = generateSolution(FRUIT, 3);
  for (let x = 0; x < 3; x++) {
    const col = [sol[x]!, sol[x + 3]!, sol[x + 6]!];
    assert.equal(new Set(col).size, 3, `第 ${x} 列有重复`);
  }
});

test("generateSolution: 行循环移位性质（每行是上一行左移一位）", () => {
  const sol = generateSolution(FRUIT, 4);
  // 第 y 行 = base[(x+y)%n]，相邻行恰为循环左移 1
  for (let y = 0; y < 3; y++) {
    const r0 = sol.slice(y * 4, y * 4 + 4);
    const r1 = sol.slice((y + 1) * 4, (y + 1) * 4 + 4);
    assert.equal(r1[0], r0[1]); // 左移后首元素 = 原第二元素
  }
});

test("digBlanks: 按索引集合挖空，其余保留", () => {
  const sol = generateSolution(FRUIT, 3);
  const blanks = new Set([0, 4, 8]);
  const board = digBlanks(sol, blanks);
  assert.equal(board[0], null);
  assert.equal(board[4], null);
  assert.equal(board[8], null);
  assert.equal(board[1], sol[1]);
  assert.equal(board[2], sol[2]);
});

test("digBlanks: 空集合不挖（全保留）", () => {
  const sol = generateSolution(FRUIT, 3);
  const board = digBlanks(sol, new Set());
  assert.deepEqual(board, sol);
});

test("findConflicts: 行内重复返回所有冲突索引", () => {
  // 2×2 盘面 [A,A,B,B]：第 0 行 A 重复(0,1)，第 1 行 B 重复(2,3)
  // 列：第0列 [A,B] 无重复、第1列 [A,B] 无重复 → 仅 4 个行冲突
  const board = ["A", "A", "B", "B"];
  const c = findConflicts(board, 2);
  assert.ok(c.has(0) && c.has(1) && c.has(2) && c.has(3));
  assert.equal(c.size, 4);
});

test("findConflicts: 仅列冲突（行无重复）", () => {
  // 2×2 盘面 [A,B,A,B]：行均无重复；第0列 A 重复(0,2)、第1列 B 重复(1,3)
  const board = ["A", "B", "A", "B"];
  const c = findConflicts(board, 2);
  assert.ok(c.has(0) && c.has(2) && c.has(1) && c.has(3));
  assert.equal(c.size, 4);
});

test("findConflicts: 列内重复返回所有冲突索引", () => {
  // 3×3：第 0 列 [A,B,A] → 索引 0,6 冲突
  const board = ["A", "B", "C", "B", "C", "A", "A", "A", "B"];
  const c = findConflicts(board, 3);
  assert.ok(c.has(0));
  assert.ok(c.has(6));
});

test("findConflicts: 无冲突返回空集", () => {
  const sol = generateSolution(FRUIT, 3);
  assert.equal(findConflicts(sol, 3).size, 0);
});

test("findConflicts: null 空格不参与冲突判定", () => {
  // 从合法解挖空 → 含 null，剩余非空仍无重复
  const sol = generateSolution(FRUIT, 3);
  const board = digBlanks(sol, new Set([0, 4, 8]));
  assert.equal(findConflicts(board, 3).size, 0);
});

test("findConflicts: 两个 null 同符号填同值仍只判非空冲突", () => {
  // 2×2：[A, null, null, A] → 仅非空 A 在第0列(0)和第1列(3)，列内各一个无重复
  const board: (string | null)[] = ["A", null, null, "A"];
  assert.equal(findConflicts(board, 2).size, 0);
});

test("findConflicts: 行列交叉重复全部标出", () => {
  // A 在第 0 行重复(0,1) 且第 0 列重复(0,3)
  const board = ["A", "A", "B", "A", "C", "D", "E", "F", "G"];
  const c = findConflicts(board, 3);
  assert.ok(c.has(0) && c.has(1) && c.has(3));
});

test("isFilled: 全非 null 为 true", () => {
  assert.equal(isFilled(["A", "B", "C"]), true);
  assert.equal(isFilled(["A", null, "C"]), false);
});

test("isComplete: 全填满且无冲突为 true", () => {
  const sol = generateSolution(FRUIT, 3);
  assert.equal(isComplete(sol, 3), true);
});

test("isComplete: 含 null 为 false", () => {
  const board: (string | null)[] = [
    null,
    "B",
    "C",
    "B",
    "C",
    "A",
    "C",
    "A",
    "B",
  ];
  assert.equal(isComplete(board, 3), false);
});

test("isComplete: 有冲突为 false", () => {
  const board = ["A", "A", "B", "B", "C", "A", "C", "B", "C"];
  assert.equal(isComplete(board, 3), false);
});

test("isLatinSquare: 合法方阵为 true", () => {
  assert.equal(isLatinSquare(generateSolution(FRUIT, 4), 4), true);
});

test("isLatinSquare: 长度不符为 false", () => {
  assert.equal(isLatinSquare(["A", "B"], 3), false);
});

test("端到端：生成解 → 挖空 → 棋盘未填满 → 填回 → 完成", () => {
  const sol = generateSolution(FRUIT, 3);
  const blanks = new Set([0, 4, 8]);
  let board = digBlanks(sol, blanks);
  assert.equal(isComplete(board, 3), false); // 未填满
  // 填回正确答案
  board = [...sol];
  assert.equal(isComplete(board, 3), true);
});

test("端到端：填错答案触发冲突，findConflicts 命中", () => {
  const sol = generateSolution(FRUIT, 3);
  const blanks = new Set([0]);
  let board = digBlanks(sol, blanks);
  // 故意填入与同行重复的符号（第 0 行原 [A,B,C]，空位 0 应填 A，故意填 B）
  board = [...board];
  board[0] = sol[1]!; // 填 B → 第 0 行 B 重复
  const c = findConflicts(board, 3);
  assert.ok(c.has(0) && c.has(1));
  assert.equal(isComplete(board, 3), false);
});
