// 宾果连线逻辑单测：LINES 结构 / countLines / completedLines / pickTargetLine / nextCallIndex。
// 验证 3×3 八线连线检测与"导向宾果"喊号策略。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LINES,
  countLines,
  completedLines,
  isOnCompletedLine,
  pickTargetLine,
  nextCallIndex,
} from "../src/games/bingo-card/lines.ts";

const mk = (arr: number[]): Set<number> => new Set(arr);

test("LINES: 恰好 8 条线（3 横 + 3 竖 + 2 斜）", () => {
  assert.equal(LINES.length, 8);
  assert.deepEqual(LINES[0], [0, 1, 2]);
  assert.deepEqual(LINES[6], [0, 4, 8]);
  assert.deepEqual(LINES[7], [2, 4, 6]);
});

test("LINES: 每条线 3 格，索引 0-8，无重复", () => {
  for (const ln of LINES) {
    assert.equal(ln.length, 3);
    assert.equal(new Set(ln).size, 3);
    for (const i of ln) assert.ok(i >= 0 && i <= 8);
  }
});

test("countLines: 空集合无连线", () => {
  assert.equal(countLines(mk([])), 0);
});

test("countLines: 单条横线", () => {
  assert.equal(countLines(mk([0, 1, 2])), 1);
  assert.equal(countLines(mk([3, 4, 5])), 1);
});

test("countLines: 单条竖线", () => {
  assert.equal(countLines(mk([0, 3, 6])), 1);
  assert.equal(countLines(mk([2, 5, 8])), 1);
});

test("countLines: 两条斜线", () => {
  assert.equal(countLines(mk([0, 4, 8])), 1);
  assert.equal(countLines(mk([2, 4, 6])), 1);
});

test("countLines: 全 9 格点亮 = 8 条线全成（含共享格）", () => {
  assert.equal(countLines(mk([0, 1, 2, 3, 4, 5, 6, 7, 8])), 8);
});

test("countLines: 两格不成线（差一个）", () => {
  assert.equal(countLines(mk([0, 1])), 0);
});

test("completedLines: 返回所有已成的线", () => {
  // 点亮 0,1,2,4 → 顶横线成，且 4 为斜线/中竖的一格但未全成
  const lines = completedLines(mk([0, 1, 2, 4]));
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0], [0, 1, 2]);
});

test("completedLines: 双线同时成（共享中心 4）", () => {
  // 中竖 [1,4,7] + 中横 [3,4,5] 共享 4
  const lines = completedLines(mk([1, 3, 4, 5, 7]));
  assert.equal(lines.length, 2);
});

test("isOnCompletedLine: 在已成线上的格子为 true", () => {
  const marked = mk([0, 1, 2]); // 顶横成
  assert.equal(isOnCompletedLine(0, marked), true);
  assert.equal(isOnCompletedLine(1, marked), true);
  assert.equal(isOnCompletedLine(5, marked), false); // 未点亮且不在成线上
});

test("pickTargetLine: 空 → 取第一条（LINES[0]）", () => {
  assert.deepEqual(pickTargetLine(mk([])), [0, 1, 2]);
});

test("pickTargetLine: 优先取点亮最多的未成线", () => {
  // 点亮 0,1 → 顶横线已有 2 格（差 1 即成），应优先它
  assert.deepEqual(pickTargetLine(mk([0, 1])), [0, 1, 2]);
});

test("pickTargetLine: 全成线 → null", () => {
  assert.equal(pickTargetLine(mk([0, 1, 2, 3, 4, 5, 6, 7, 8])), null);
});

test("pickTargetLine: 已成的线被跳过，选次优", () => {
  // 0,1,2 已成顶线；3,4 点亮 → 中横 [3,4,5] 有 2 格优先
  assert.deepEqual(pickTargetLine(mk([0, 1, 2, 3, 4])), [3, 4, 5]);
});

test("nextCallIndex: 空集合 → 0（目标线首格）", () => {
  assert.equal(nextCallIndex(mk([])), 0);
});

test("nextCallIndex: 优先补齐差一格的线", () => {
  // 点亮 0,1 → 应喊 2 补齐顶线
  assert.equal(nextCallIndex(mk([0, 1])), 2);
});

test("nextCallIndex: 全点亮 → -1", () => {
  assert.equal(nextCallIndex(mk([0, 1, 2, 3, 4, 5, 6, 7, 8])), -1);
});

test("nextCallIndex: 兜底取最小未点亮", () => {
  // 点亮 0,4,8（主斜成）→ 目标线为次优，返回其首个未点亮格
  const idx = nextCallIndex(mk([0, 4, 8]));
  assert.ok(idx >= 0 && idx <= 8);
  assert.ok(idx !== 0 && idx !== 4 && idx !== 8);
});

test("可解性：沿 nextCallIndex 序列点亮必在 ≤9 步内宾果", () => {
  // 模拟：从空集合反复按 nextCallIndex 点亮，必定在某步达成至少 1 条线
  const marked = new Set<number>();
  let bingoed = false;
  for (let step = 0; step < 9; step++) {
    const idx = nextCallIndex(marked);
    if (idx < 0) break;
    marked.add(idx);
    if (countLines(marked) > 0) {
      bingoed = true;
      break;
    }
  }
  assert.ok(bingoed, "nextCallIndex 策略应导向宾果");
});
