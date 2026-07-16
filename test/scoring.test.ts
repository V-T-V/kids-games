// 算星工具单测：各映射函数的边界与默认阈值。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  minStars,
  starsByAccuracy,
  starsByMoves,
  starsByRate,
  starsByScore,
  starsByTime,
} from "../src/core/scoring.ts";

test("starsByAccuracy 默认阈值：错1→3★，错3→2★，错4→1★", () => {
  assert.equal(starsByAccuracy(0), 3);
  assert.equal(starsByAccuracy(1), 3);
  assert.equal(starsByAccuracy(2), 2);
  assert.equal(starsByAccuracy(3), 2);
  assert.equal(starsByAccuracy(4), 1);
});

test("starsByAccuracy 自定义阈值", () => {
  assert.equal(starsByAccuracy(2, [0, 1]), 1);
  assert.equal(starsByAccuracy(0, [0, 1]), 3);
});

test("starsByRate 按正确率", () => {
  assert.equal(starsByRate(10, 10), 3); // 1.0 ≥ 0.95
  assert.equal(starsByRate(9, 10), 2); // 0.9 在 0.7~0.95 之间 → 2★
  assert.equal(starsByRate(8, 10), 2); // 0.8
  assert.equal(starsByRate(5, 10), 1); // 0.5
});

test("starsByRate total 为 0 返回 3 星", () => {
  assert.equal(starsByRate(0, 0), 3);
});

test("starsByTime 按耗时", () => {
  assert.equal(starsByTime(5000, [10000, 20000]), 3);
  assert.equal(starsByTime(15000, [10000, 20000]), 2);
  assert.equal(starsByTime(25000, [10000, 20000]), 1);
});

test("starsByMoves 按操作数", () => {
  assert.equal(starsByMoves(5, [10, 20]), 3);
  assert.equal(starsByMoves(15, [10, 20]), 2);
  assert.equal(starsByMoves(25, [10, 20]), 1);
});

test("starsByScore 按得分", () => {
  assert.equal(starsByScore(100, [80, 50]), 3);
  assert.equal(starsByScore(60, [80, 50]), 2);
  assert.equal(starsByScore(30, [80, 50]), 1);
});

test("minStars 取最小", () => {
  assert.equal(minStars(3, 2, 3), 2);
  assert.equal(minStars(1, 3), 1);
  assert.equal(minStars(), 3);
});
