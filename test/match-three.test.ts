/* match-three 核心三消算法测试 —— 纯函数，无 DOM。
   覆盖：isAdjacent / swap 不改原 / findMatches 行列扫描含交叉 / applyGravity 列内稳定下落+顶部补 / hasMove 可走步判定 / clearMatches / hasNoInitialMatch。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ADJ,
  applyGravity,
  clearMatches,
  findMatches,
  hasMove,
  hasNoInitialMatch,
  isAdjacent,
  swap,
  type Grid,
} from "../src/games/match-three/engine.ts";

const g = (rows: (number | null)[][]): Grid => rows.map((r) => [...r]);

test("isAdjacent: 上下左右相邻为 true，对角/远距离为 false", () => {
  assert.equal(isAdjacent(0, 0, 1, 0), true);
  assert.equal(isAdjacent(0, 0, 0, 1), true);
  assert.equal(isAdjacent(1, 0, 0, 0), true);
  assert.equal(isAdjacent(0, 1, 0, 0), true);
  // 对角不算相邻
  assert.equal(isAdjacent(0, 0, 1, 1), false);
  // 远距离
  assert.equal(isAdjacent(0, 0, 2, 0), false);
  assert.equal(isAdjacent(0, 0, 0, 0), false); // 同格不算相邻
});

test("isAdjacent: ADJ 四方向向量恰为曼哈顿 1", () => {
  for (const [dx, dy] of ADJ) {
    assert.equal(Math.abs(dx) + Math.abs(dy), 1);
  }
  // 四方向不重复
  const seen = new Set(ADJ.map(([x, y]) => `${x},${y}`));
  assert.equal(seen.size, 4);
});

test("swap: 返回新网格，不改原；两格互换", () => {
  const a = g([
    [1, 2],
    [3, 4],
  ]);
  const b = swap(a, 0, 0, 1, 1);
  // 原网格不变
  assert.deepEqual(a, [
    [1, 2],
    [3, 4],
  ]);
  // 新网格已互换
  assert.deepEqual(b, [
    [4, 2],
    [3, 1],
  ]);
});

test("swap: 幂等换回（swap 两次还原）", () => {
  const a = g([
    [1, 2],
    [3, 4],
  ]);
  const b = swap(swap(a, 0, 0, 1, 0), 0, 0, 1, 0);
  assert.deepEqual(b, a);
});

test("findMatches: 行内三连同色被标出", () => {
  // 第 1 行三连 2；其余行无三连
  const grid = g([
    [0, 1, 0, 1],
    [2, 2, 2, 3],
    [1, 2, 3, 4],
    [4, 5, 6, 4],
  ]);
  const m = findMatches(grid);
  assert.ok(m.has("0,1"));
  assert.ok(m.has("1,1"));
  assert.ok(m.has("2,1"));
  assert.equal(m.size, 3);
});

test("findMatches: 列内三连同色被标出", () => {
  // 第 0 列三连 1；其余列无三连
  const grid = g([
    [1, 0, 1, 2],
    [1, 2, 2, 3],
    [1, 3, 3, 4],
    [2, 4, 4, 5],
  ]);
  const m = findMatches(grid);
  assert.ok(m.has("0,0"));
  assert.ok(m.has("0,1"));
  assert.ok(m.has("0,2"));
  assert.equal(m.size, 3);
});

test("findMatches: 行列交叉（L/T 形）合并去重", () => {
  // 第 0 列三连 + 第 1 行三连，交叉格 (0,1) 只计一次
  const grid = g([
    [1, 0, 0],
    [1, 1, 1],
    [1, 0, 0],
  ]);
  const m = findMatches(grid);
  assert.ok(m.has("0,0"));
  assert.ok(m.has("0,1"));
  assert.ok(m.has("0,2")); // 列三连
  assert.ok(m.has("0,1"));
  assert.ok(m.has("1,1"));
  assert.ok(m.has("2,1")); // 行三连
  assert.equal(m.size, 5); // 交叉格去重
});

test("findMatches: 四连同色整段标出（≥3 全算）", () => {
  // 4×4 方阵，第 0 行四连
  const grid = g([
    [1, 1, 1, 1],
    [2, 3, 4, 5],
    [6, 7, 8, 2],
    [3, 4, 5, 6],
  ]);
  const m = findMatches(grid);
  for (let x = 0; x < 4; x++) assert.ok(m.has(`${x},0`));
  assert.equal(m.size, 4);
});

test("findMatches: null 视为断点不连成", () => {
  // 3×3 方阵，第 0 行 [1, null, 1] → 不连
  const grid = g([
    [1, null, 1],
    [2, 3, 4],
    [5, 6, 7],
  ]);
  assert.equal(findMatches(grid).size, 0);
});

test("findMatches: 两两相邻但不足三个不计", () => {
  // 3×3 方阵
  const grid = g([
    [1, 1, 2],
    [3, 3, 4],
    [5, 6, 7],
  ]);
  assert.equal(findMatches(grid).size, 0);
});

test("applyGravity: 列内非空沉底，顶部补新宝石（默认 0）", () => {
  // 中间一格 null，下方宝石保持，上方沉底，顶部补 0
  const grid = g([
    [1, null],
    [null, 2],
  ]);
  const out = applyGravity(grid);
  // 第 0 列：原 [1, null] → 底是 1，顶补 0 → [0, 1]
  // 第 1 列：原 [null, 2] → 底是 2，顶补 0 → [0, 2]
  assert.deepEqual(out, [
    [0, 0],
    [1, 2],
  ]);
  // 原网格不变
  assert.deepEqual(grid, [
    [1, null],
    [null, 2],
  ]);
});

test("applyGravity: 列内相对顺序保持稳定（不重排）", () => {
  // 全列非空 → 不变（顶部无需补）
  const grid = g([
    [1, 2],
    [3, 4],
  ]);
  assert.deepEqual(applyGravity(grid), grid);
});

test("applyGravity: 整列清除后全补新宝石", () => {
  const grid = g([
    [null, null],
    [null, null],
  ]);
  const out = applyGravity(grid);
  assert.deepEqual(out, [
    [0, 0],
    [0, 0],
  ]);
});

test("applyGravity: 自定义顶部生成器（非 0）", () => {
  const grid = g([
    [null, null],
    [null, null],
  ]);
  let i = 0;
  const out = applyGravity(grid, 2, () => ++i);
  // 顶部补充按列从底到顶：第0列底=1 顶=2，第1列底=3 顶=4
  assert.deepEqual(out, [
    [2, 4],
    [1, 3],
  ]);
});

test("clearMatches: 匹配格置 null，其余不变，不改原", () => {
  // 3×3 方阵，第 0 行三连
  const grid = g([
    [1, 1, 1],
    [4, 5, 6],
    [7, 8, 9],
  ]);
  const m = findMatches(grid);
  assert.equal(m.size, 3);
  const out = clearMatches(grid, m);
  assert.deepEqual(out, [
    [null, null, null],
    [4, 5, 6],
    [7, 8, 9],
  ]);
  // 原网格不变
  assert.deepEqual(grid, [
    [1, 1, 1],
    [4, 5, 6],
    [7, 8, 9],
  ]);
});

test("hasMove: 存在可消除交换返回 true", () => {
  // 第 0 行 [1,1,2,3]，把 (2,0)=2 与 (2,1)=1 交换？不构成。
  // 直接构造：交换后能成三连。
  // 第 0 行：1 1 _ 2，第 1 行同列 2 → 交换 (2,0)空与... 用非 null 构造：
  const grid = g([
    [1, 1, 2, 3],
    [2, 3, 1, 4],
    [3, 4, 5, 5],
    [4, 5, 6, 5],
  ]);
  // (2,0)=2 与 (2,1)=1 交换 → 第1列变为 [1,1,4,5]? 不行。换思路：构造明确可解盘
  // 第 0 行：1 2 1 → 把 (0,1)=2 与 (1,1)=1 交换 → 第0行变 1 1 1 ✓
  const solvable = g([
    [1, 2, 1],
    [3, 1, 4],
    [5, 6, 7],
  ]);
  assert.equal(hasMove(solvable), true);
});

test("hasMove: 无可消除交换返回 false", () => {
  // 盘面无任何相邻交换能成三连
  const grid = g([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 1],
  ]);
  assert.equal(hasMove(grid), false);
});

test("hasMove: 不改原网格（换回）", () => {
  const grid = g([
    [1, 2, 1],
    [3, 1, 4],
    [5, 6, 7],
  ]);
  const snapshot = grid.map((r) => [...r]);
  hasMove(grid);
  assert.deepEqual(grid, snapshot);
});

test("hasMove: 现有三连盘面返回 true（不破坏三连的相邻交换仍命中）", () => {
  // 3×3 方阵，第 0 行已三连；交换第 2 行相邻不影响第 0 行 → 命中
  const grid = g([
    [1, 1, 1],
    [2, 3, 4],
    [5, 6, 7],
  ]);
  assert.equal(hasMove(grid), true);
});

test("hasNoInitialMatch: 无三连盘面为 true", () => {
  const grid = g([
    [1, 2, 3],
    [4, 5, 6],
  ]);
  assert.equal(hasNoInitialMatch(grid), true);
});

test("hasNoInitialMatch: 有三连盘面为 false", () => {
  // 3×3 方阵，第 0 行三连
  const grid = g([
    [1, 1, 1],
    [4, 5, 6],
    [7, 8, 9],
  ]);
  assert.equal(hasNoInitialMatch(grid), false);
});

test("端到端：消除→清空→重力，连锁结算模拟（n×n 方阵）", () => {
  // 3×3 盘面，第 0 行三连同色
  let grid: Grid = g([
    [1, 1, 1],
    [2, 3, 4],
    [5, 6, 7],
  ]);
  const m = findMatches(grid, 3);
  assert.equal(m.size, 3);
  grid = clearMatches(grid, m); // 第 0 行清空
  assert.deepEqual(grid, [
    [null, null, null],
    [2, 3, 4],
    [5, 6, 7],
  ]);
  grid = applyGravity(grid, 3, () => 5); // 下方宝石上浮，顶部补 5
  assert.deepEqual(grid, [
    [5, 5, 5],
    [2, 3, 4],
    [5, 6, 7],
  ]);
});
