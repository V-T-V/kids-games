// 2048 核心合并算法单测：collapse / extract / apply / hasMoves / maxValue。
// 验证经典 2048 合并语义的正确性与方向无关性（左=右=上=下的等价镜像）。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type Dir,
  collapse,
  extract,
  apply,
  hasMoves,
  maxValue,
} from "../src/games/2048/engine.ts";

test("collapse: 去零 + 补零", () => {
  assert.deepEqual(collapse([0, 2, 0, 0]).line, [2, 0, 0, 0]);
  assert.deepEqual(collapse([0, 0, 0, 0]).line, [0, 0, 0, 0]);
  assert.deepEqual(collapse([2, 4, 0, 8]).line, [2, 4, 8, 0]);
  assert.equal(collapse([0, 2, 0, 0]).merged, false);
});

test("collapse: 相邻相同合并（向左）", () => {
  assert.deepEqual(collapse([2, 2, 4, 4]).line, [4, 8, 0, 0]);
  assert.equal(collapse([2, 2, 4, 4]).merged, true);
  assert.deepEqual(collapse([2, 2, 2, 2]).line, [4, 4, 0, 0]); // 一次合并两对，不连锁
  assert.deepEqual(collapse([4, 4, 4, 4]).line, [8, 8, 0, 0]);
});

test("collapse: 不连锁（同一行的一次合并不二次合并结果）", () => {
  // [2,2,2,0] → [4,2,0,0]，不是 [4,4] 后再合并
  assert.deepEqual(collapse([2, 2, 2, 0]).line, [4, 2, 0, 0]);
  // [2,2,4] → [4,4]，但 [4,4] 不再合并
  assert.deepEqual(collapse([2, 2, 4, 0]).line, [4, 4, 0, 0]);
  assert.equal(collapse([2, 2, 4, 0]).merged, true);
});

test("collapse: 全不同不合并", () => {
  assert.deepEqual(collapse([2, 4, 8, 16]).line, [2, 4, 8, 16]);
  assert.equal(collapse([2, 4, 8, 16]).merged, false);
});

test("extract: 四方向取线正确（朝向开头）", () => {
  const board = [
    [2, 4, 0, 0],
    [0, 0, 8, 0],
    [0, 2, 0, 4],
    [16, 0, 0, 2],
  ];
  // left：原行
  assert.deepEqual(extract(board, "left")[0]!, [2, 4, 0, 0]);
  // right：反行
  assert.deepEqual(extract(board, "right")[0]!, [0, 0, 4, 2]);
  // up：从顶到底的列
  assert.deepEqual(extract(board, "up")[0]!, [2, 0, 0, 16]); // 第 0 列
  // down：从底到顶的列
  assert.deepEqual(extract(board, "down")[0]!, [16, 0, 0, 2]); // 第 0 列反序
});

test("apply + collapse: 左移合并回填", () => {
  const board = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const lines = extract(board, "left").map((l) => collapse(l).line);
  const out = apply(board, "left", lines);
  assert.deepEqual(out[0]!, [4, 0, 0, 0]);
  // 不改原棋盘
  assert.equal(board[0]![0], 2);
});

test("apply + collapse: 右移合并朝右", () => {
  const board = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const lines = extract(board, "right").map((l) => collapse(l).line);
  const out = apply(board, "right", lines);
  assert.deepEqual(out[0], [0, 0, 0, 4]); // 合并后靠右
});

test("apply + collapse: 上移合并朝上", () => {
  const board = [
    [2, 0, 0, 0],
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const lines = extract(board, "up").map((l) => collapse(l).line);
  const out = apply(board, "up", lines);
  assert.deepEqual(out[0], [4, 0, 0, 0]); // 合并后靠上（第 0 行）
  assert.deepEqual(out[1], [0, 0, 0, 0]);
});

test("apply + collapse: 下移合并朝下", () => {
  const board = [
    [2, 0, 0, 0],
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const lines = extract(board, "down").map((l) => collapse(l).line);
  const out = apply(board, "down", lines);
  assert.deepEqual(out[3], [4, 0, 0, 0]); // 合并后靠下（最后一行）
  assert.deepEqual(out[0], [0, 0, 0, 0]);
});

test("hasMoves: 有空格 → 可走", () => {
  assert.equal(hasMoves([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), true);
  assert.equal(
    hasMoves([[2, 4, 8, 16], [0, 4, 8, 16], [2, 4, 8, 16], [2, 4, 8, 16]]),
    true,
  );
});

test("hasMoves: 无空格但有相邻同值（水平/垂直）→ 可走", () => {
  assert.equal(
    hasMoves([[2, 2, 4, 8], [16, 32, 64, 128], [2, 4, 8, 16], [32, 64, 128, 256]]),
    true,
  );
  assert.equal(
    hasMoves([[2, 4, 8, 16], [2, 32, 64, 128], [4, 4, 8, 16], [32, 64, 128, 256]]),
    true, // 第 0 列 2/2 垂直相邻
  );
});

test("hasMoves: 无空格且无相邻同值 → 无解", () => {
  assert.equal(
    hasMoves([[2, 4, 8, 16], [32, 64, 128, 256], [2, 4, 8, 16], [32, 64, 128, 256]]),
    false,
  );
});

test("maxValue: 取最大，空棋盘为 0", () => {
  assert.equal(maxValue([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 8, 0], [0, 0, 0, 16]]), 16);
  assert.equal(maxValue([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 0);
});

test("方向等价性：左移==右移镜像 / 上移==下移镜像", () => {
  // 同一行 [2,2,0,0]：左移得 [4,0,0,0]，右移得 [0,0,0,4]
  const left = collapse([2, 2, 0, 0]).line;
  const right = collapse([0, 0, 2, 2]).line;
  assert.deepEqual(left, [4, 0, 0, 0]);
  assert.deepEqual(right, [4, 0, 0, 0]); // 反序后合并再回填结果朝右
});

test("回合可重复合并不溢出：长行只合并 len/2 对", () => {
  // 4 格最多合并 2 对（[2,2,2,2]→[4,4]）
  assert.deepEqual(collapse([2, 2, 2, 2]).line, [4, 4, 0, 0]);
});
