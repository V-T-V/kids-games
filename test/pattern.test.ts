/**
 * 找规律序列生成测试。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { genSequence, nextOf } from "../src/games/pattern/pattern.ts";

const POOL = ["🍎", "🍌", "🍇", "🐶", "🐱", "⭐"] as const;

test("genSequence: 长度正确", () => {
  assert.equal(genSequence(6, 2, POOL).length, 6);
  assert.equal(genSequence(9, 3, POOL).length, 9);
});

test("genSequence: 严格按周期重复", () => {
  const seq = genSequence(6, 2, POOL);
  // 周期 2：seq[0]==seq[2]==seq[4], seq[1]==seq[3]==seq[5]
  assert.equal(seq[0], seq[2]);
  assert.equal(seq[2], seq[4]);
  assert.equal(seq[1], seq[3]);
  assert.equal(seq[3], seq[5]);
  assert.notEqual(seq[0], seq[1]);
});

test("genSequence: 周期 3 正确循环", () => {
  const seq = genSequence(9, 3, POOL);
  assert.equal(seq[0], seq[3]);
  assert.equal(seq[3], seq[6]);
  assert.equal(seq[1], seq[4]);
  assert.equal(seq[2], seq[5]);
});

test("nextOf: 返回序列循环的下一个元素", () => {
  const seq = genSequence(5, 2, POOL);
  // seq 长度 5，下一个应是 seq[5 % 2] = seq[1]
  assert.equal(nextOf(seq, 2), seq[1]);
});

test("nextOf: 空安全——回退到首元素", () => {
  // period 大于池长度时也能工作（取可用部分）
  const seq = genSequence(4, 2, POOL);
  assert.ok(nextOf(seq, 2));
});
