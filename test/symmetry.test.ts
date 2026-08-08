// symmetry 引擎单测：对称补全的纯逻辑判定（此前内联于 index.ts 无测试）。
// 覆盖 halfOf/isMirror/mirrorOf/countFilled/genHalf + 镜像翻转对称性 + 防御（形状不符/空）。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countFilled,
  genHalf,
  halfOf,
  isMirror,
  mirrorOf,
} from "../src/games/symmetry/engine.ts";

// —— halfOf ——

test("halfOf: n=4→2, n=6→3, n=8→4（Math.ceil(n/2)）", () => {
  assert.equal(halfOf(4), 2);
  assert.equal(halfOf(6), 3);
  assert.equal(halfOf(8), 4);
});

test("halfOf: 奇数 n 向上取整（n=5→3, n=7→4）", () => {
  assert.equal(halfOf(5), 3);
  assert.equal(halfOf(7), 4);
});

test("halfOf: n=1→1, n=2→1（边界）", () => {
  assert.equal(halfOf(1), 1);
  assert.equal(halfOf(2), 1);
});

// —— isMirror: 基础镜像 ——

test("isMirror: 全空左半 + 全空右半 = 镜像（恒等）", () => {
  const left = [
    [false, false],
    [false, false],
  ];
  const right = [
    [false, false],
    [false, false],
  ];
  assert.equal(isMirror(left, right), true);
});

test("isMirror: 单格镜像（1×1 左半）right[0]=left[0]", () => {
  // half=1，镜像 right[x]=left[half-1-x]=left[0]
  assert.equal(isMirror([[true]], [[true]]), true);
  assert.equal(isMirror([[true]], [[false]]), false);
});

test("isMirror: 2 列左半，右半列序翻转", () => {
  // left[y]=[a,b]，镜像 right[y] 应为 [b,a]
  const left = [
    [true, false],
    [false, true],
  ];
  const mirror = [
    [false, true],
    [true, false],
  ];
  assert.equal(isMirror(left, mirror), true);
});

test("isMirror: 非镜像（仅翻转一处错误）返回 false", () => {
  const left = [
    [true, false],
    [false, true],
  ];
  const wrong = [
    [true, true], // 第一行应是 [false,true]，这里错了
    [true, false],
  ];
  assert.equal(isMirror(left, wrong), false);
});

test("isMirror: 全 true 左半 + 全 true 右半 = 镜像（对称图案）", () => {
  const left = [
    [true, true],
    [true, true],
  ];
  assert.equal(isMirror(left, left), true, "回文/对称图案左右一致");
});

// —— isMirror: 防御 ——

test("isMirror: 行数不符返回 false（防御）", () => {
  const left = [[true, false]];
  const right = [
    [false, true],
    [true, false],
  ];
  assert.equal(isMirror(left, right), false);
});

test("isMirror: 空数组返回 false（防御）", () => {
  assert.equal(isMirror([], []), false);
});

test("isMirror: 行长度不齐返回 false（防御）", () => {
  const left = [
    [true, false],
    [true], // 这行只有 1 列，形状不齐
  ];
  const right = [
    [false, true],
    [true, false],
  ];
  assert.equal(isMirror(left, right), false);
});

test("isMirror: 左右半宽不符返回 false（防御）", () => {
  const left = [[true, false]]; // half=2
  const right = [[true]]; // half=1
  assert.equal(isMirror(left, right), false);
});

// —— mirrorOf ——

test("mirrorOf: 生成左半的镜像（列序翻转）", () => {
  const left = [
    [true, false],
    [false, true],
  ];
  assert.deepEqual(mirrorOf(left), [
    [false, true],
    [true, false],
  ]);
});

test("mirrorOf: 镜像的镜像 = 原图（翻转两次回原）", () => {
  const left = [
    [true, false, true],
    [false, true, false],
  ];
  assert.deepEqual(mirrorOf(mirrorOf(left)), left);
});

test("mirrorOf: isMirror(left, mirrorOf(left)) 恒为 true（自洽）", () => {
  const left = [
    [true, false],
    [false, false],
    [true, true],
  ];
  assert.equal(isMirror(left, mirrorOf(left)), true);
});

test("mirrorOf: 空左半返回空数组（不抛错）", () => {
  assert.deepEqual(mirrorOf([]), []);
});

// —— countFilled ——

test("countFilled: 统计 true 格子数", () => {
  assert.equal(countFilled([[true, false], [true, true]]), 3);
  assert.equal(countFilled([[false, false]]), 0);
  assert.equal(countFilled([[true, true], [true, true]]), 4);
});

test("countFilled: 空数组返回 0", () => {
  assert.equal(countFilled([]), 0);
});

// —— genHalf ——

test("genHalf: 生成 n 行 half 列的布尔矩阵", () => {
  const half = genHalf(4, () => 0.5); // 固定 rand
  assert.equal(half.length, 4, "应有 4 行");
  half.forEach((row) => {
    assert.equal(row.length, 2, "每行应有 half=2 列");
    row.forEach((v) => {
      assert.equal(typeof v, "boolean", "每格应为布尔值");
    });
  });
});

test("genHalf: rand<0.5 → true，rand>=0.5 → false（rand()<0.5 判定）", () => {
  // genHalf 用 rand() < 0.5 决定填充：rand 返回小值→true，大值→false
  const allTrue = genHalf(4, () => 0.3);
  assert.equal(allTrue.flat().every((v) => v === true), true);
  const allFalse = genHalf(6, () => 0.9);
  assert.equal(allFalse.flat().every((v) => v === false), true);
});

test("genHalf: 奇数 n 也正确（half 向上取整）", () => {
  const half = genHalf(5, () => 0.5);
  assert.equal(half.length, 5, "5 行");
  assert.equal(half[0]!.length, 3, "half=ceil(5/2)=3 列");
});

// —— 端到端：genHalf → mirrorOf → isMirror 自洽 ——

test("端到端: genHalf 生成左半，mirrorOf 得镜像，isMirror 判定 true", () => {
  // 闭包计数器产生确定性序列（每次调用返回下一个值）
  let counter = 0;
  const left = genHalf(6, () => ((counter += 1) % 3) / 3);
  const right = mirrorOf(left);
  assert.equal(isMirror(left, right), true, "镜像应通过 isMirror 判定");
});

test("端到端: 随机翻转一格破坏镜像，isMirror 判定 false", () => {
  const left = [
    [true, false],
    [false, true],
  ];
  const right = mirrorOf(left);
  // 翻转 right[0][0]
  right[0]![0] = !right[0]![0]!;
  assert.equal(isMirror(left, right), false, "翻转一格后应不再是镜像");
});
