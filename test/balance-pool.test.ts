// 平衡秤候选砝码池构造单测：splitTarget / buildPool / hasSolution / randomWeight。
// 验证可解性保证（子集和等于 target）+ 干扰项数量 + 拆解贪心策略。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WEIGHT_MIN,
  WEIGHT_MAX,
  splitTarget,
  buildPool,
  hasSolution,
  randomWeight,
} from "../src/games/balance-scale/pool.ts";

test("splitTarget: 空目标", () => {
  assert.deepEqual(splitTarget(0), []);
  assert.deepEqual(splitTarget(-3), []);
});

test("splitTarget: 小目标单块", () => {
  assert.deepEqual(splitTarget(1), [1]);
  assert.deepEqual(splitTarget(2), [2]);
  assert.deepEqual(splitTarget(3), [3]);
});

test("splitTarget: 贪心最大块优先（每块 1-3）", () => {
  assert.deepEqual(splitTarget(4), [3, 1]);
  assert.deepEqual(splitTarget(5), [3, 2]);
  assert.deepEqual(splitTarget(6), [3, 3]);
  assert.deepEqual(splitTarget(7), [3, 3, 1]);
  assert.deepEqual(splitTarget(9), [3, 3, 3]);
});

test("splitTarget: 拆解之和恰等于 target", () => {
  for (const t of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18]) {
    const parts = splitTarget(t);
    assert.equal(parts.reduce((a, b) => a + b, 0), t);
    for (const w of parts) assert.ok(w >= WEIGHT_MIN && w <= WEIGHT_MAX);
  }
});

test("buildPool: 总长 = 拆解块数 + 干扰数", () => {
  // target=7 → 拆 3 块 [3,3,1]，distract=4 → 总 7
  assert.equal(buildPool(7, 4, () => 0).length, 3 + 4);
  // target=3 → 单块，distract=2 → 总 3
  assert.equal(buildPool(3, 2, () => 0).length, 1 + 2);
});

test("buildPool: 小目标（<=3）用单块解", () => {
  const pool = buildPool(2, 0, () => 0);
  assert.deepEqual(pool, [2]);
});

test("buildPool: 大目标用贪心拆解", () => {
  // target=6, 无干扰 → [3,3]
  assert.deepEqual(buildPool(6, 0, () => 0), [3, 3]);
});

test("buildPool: 所有砝码值在 1-3", () => {
  const pool = buildPool(10, 8, () => 0.5);
  for (const w of pool) assert.ok(w >= WEIGHT_MIN && w <= WEIGHT_MAX);
});

test("buildPool: 干扰项在 1-3 范围（注入确定性 rng）", () => {
  // rng()=0.99 → floor(0.99*3)+1 = 3
  const pool = buildPool(3, 3, () => 0.99);
  assert.deepEqual(pool, [3, 3, 3, 3]);
  // rng()=0 → floor(0)+1 = 1
  const pool2 = buildPool(3, 3, () => 0);
  assert.deepEqual(pool2, [3, 1, 1, 1]);
});

test("buildPool: 任意 target 都可解（含干扰）", () => {
  for (const t of [1, 2, 3, 5, 7, 9, 12]) {
    const pool = buildPool(t, 6, () => 0.3);
    assert.ok(hasSolution(pool, t), `target=${t} 应有解`);
  }
});

test("hasSolution: 空池只有 target=0 可解", () => {
  assert.equal(hasSolution([], 0), true);
  assert.equal(hasSolution([], 5), false);
});

test("hasSolution: 简单子集和", () => {
  assert.equal(hasSolution([1, 2, 3], 5), true); // 2+3
  assert.equal(hasSolution([1, 2, 3], 6), true); // 1+2+3
  assert.equal(hasSolution([2, 4, 6], 5), false);
  assert.equal(hasSolution([2, 2, 2], 6), true);
});

test("randomWeight: 返回 1-3", () => {
  for (let i = 0; i < 50; i++) {
    const w = randomWeight(() => i / 50);
    assert.ok(w >= WEIGHT_MIN && w <= WEIGHT_MAX);
  }
});

test("randomWeight: 边界 rng", () => {
  assert.equal(randomWeight(() => 0), 1); // floor(0)+1
  assert.equal(randomWeight(() => 0.99), 3); // floor(2.97)+1
});
