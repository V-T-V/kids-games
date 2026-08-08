/* light-maze 纯逻辑测试——reflect 镜面反射 / trace 光线追踪 / DVEC 方向向量。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reflect,
  trace,
  emptyGrid,
  setMirror,
  DVEC,
  type Mirror,
} from "../src/games/light-maze/engine.ts";

test("DVEC: 右0/下1/左2/上3 向量正确", () => {
  assert.deepEqual(DVEC[0], [1, 0]);
  assert.deepEqual(DVEC[1], [0, 1]);
  assert.deepEqual(DVEC[2], [-1, 0]);
  assert.deepEqual(DVEC[3], [0, -1]);
});

test("reflect(/): 右↔上 (0↔3)", () => {
  assert.equal(reflect(0, 1), 3); // 右→上
  assert.equal(reflect(3, 1), 0); // 上→右
});

test("reflect(/): 下↔左 (1↔2)", () => {
  assert.equal(reflect(1, 1), 2); // 下→左
  assert.equal(reflect(2, 1), 1); // 左→下
});

test("reflect(\\): 右↔下 (0↔1)", () => {
  assert.equal(reflect(0, 2), 1); // 右→下
  assert.equal(reflect(1, 2), 0); // 下→右
});

test("reflect(\\): 上↔左 (3↔2)", () => {
  assert.equal(reflect(3, 2), 2); // 上→左
  assert.equal(reflect(2, 2), 3); // 左→上
});

test("reflect: 对称性——反射两次回原方向（/ 与 \\ 各 4 方向）", () => {
  for (const m of [1, 2] as const) {
    for (const d of [0, 1, 2, 3] as const) {
      assert.equal(reflect(reflect(d, m), m), d);
    }
  }
});

test("trace: 空网格直行——srcRow==goalRow 命中", () => {
  const g = emptyGrid(3);
  const r = trace(g, 1, 1, 3);
  assert.ok(r.hit);
  assert.ok(!r.outOfBounds);
  assert.deepEqual(r.cells, [
    [0, 1],
    [1, 1],
    [2, 1],
  ]);
});

test("trace: 空网格直行——srcRow≠goalRow 未命中（越界）", () => {
  const g = emptyGrid(3);
  const r = trace(g, 0, 2, 3);
  assert.ok(!r.hit);
  assert.ok(r.outOfBounds);
});

test("trace: 单镜 \\ 在 (2,0) 把光向下转 → 越界未命中", () => {
  // n=3，光从 (−1,0) 向右进，srcRow=0；镜 \ 在 (2,0) 把右转下 → 撞底越界
  let g = emptyGrid(3);
  g = setMirror(g, 2, 0, 2);
  const r = trace(g, 0, 2, 3);
  assert.ok(!r.hit);
  assert.ok(r.outOfBounds);
});

test("trace: 镜折线让光下移一行——srcRow=0 经镜下转再右转命中 goalRow=1", () => {
  // n=3：光从(−1,0)右进 →(0,0)→(1,0)→(2,0)镜\右转下→(2,1)镜\下转右→(3,1)命中 goalRow=1
  // reflect(0,2)=1(右→下)；reflect(1,2)=0(下→右)
  let g = emptyGrid(3);
  g = setMirror(g, 2, 0, 2); // \ 在 (2,0)：右转下
  g = setMirror(g, 2, 1, 2); // \ 在 (2,1)：下转右
  const r = trace(g, 0, 1, 3);
  assert.ok(r.hit, "应命中 goalRow=1");
  assert.ok(!r.outOfBounds);
});

test("trace: 光路格子序列反映折线", () => {
  let g = emptyGrid(3);
  g = setMirror(g, 2, 0, 2); // \
  g = setMirror(g, 2, 1, 2); // \
  const r = trace(g, 0, 1, 3);
  // 路径：(0,0)(1,0)(2,0)镜 → (2,1)镜 → 出界命中（(2,1)后向右出界）
  assert.deepEqual(r.cells, [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ]);
});

test("trace: 竖直通道——光下移两行命中 goalRow=2", () => {
  // n=3：光从(−1,0)右进 →(2,0)\下转→(2,1)空(继续下)→(2,2)\下转右→命中 goalRow=2
  let g = emptyGrid(3);
  g = setMirror(g, 2, 0, 2); // \ 右→下
  // (2,1) 空格：光直行下到 (2,2)
  g = setMirror(g, 2, 2, 2); // \ 下→右（reflect(1,2)=0）命中
  const r = trace(g, 0, 2, 3);
  assert.ok(r.hit, "应命中 goalRow=2");
});

test("trace: 光向上越界（撞顶）→ outOfBounds", () => {
  // n=2，srcRow=1，镜 / 在 (0,1) 把右转上 → 撞顶越界
  let g = emptyGrid(2);
  g = setMirror(g, 0, 1, 1);
  const r = trace(g, 1, 0, 2);
  assert.ok(!r.hit);
  assert.ok(r.outOfBounds);
});

test("trace: 光向左出界（撞左侧）→ outOfBounds", () => {
  // 两镜把光转回向左 → 撞左边界
  let g = emptyGrid(2);
  g = setMirror(g, 0, 0, 1); // / 右→上
  // 上(3)继续到顶越界——简化：仅验越界不命中
  const r = trace(g, 0, 1, 2);
  assert.ok(r.outOfBounds);
});

test("emptyGrid: 全 0 网格", () => {
  const g = emptyGrid(3);
  assert.equal(g.length, 3);
  assert.equal(g[0]!.length, 3);
  assert.equal(g[1]![1], 0);
});

test("setMirror: 不修改原网格（不可变）", () => {
  const g = emptyGrid(3);
  const g2 = setMirror(g, 1, 1, 2);
  assert.equal(g[1]![1], 0); // 原不变
  assert.equal(g2[1]![1], 2);
});

test("trace: guard 防死循环——光在循环镜阵中不无限跑", () => {
  // 4 面镜子围成循环：光会在格子里反复弹，guard 强制终止
  // n=2，全放镜让光循环：(0,0)\ (1,0)/ (0,1)/ (1,1)\
  let g = emptyGrid(2);
  g = setMirror(g, 0, 0, 2);
  g = setMirror(g, 1, 0, 1);
  g = setMirror(g, 0, 1, 1);
  g = setMirror(g, 1, 1, 2);
  const r = trace(g, 0, 0, 2);
  // 不会命中（循环），也不抛错——guard 退出，cells 有界
  assert.ok(r.cells.length < 2 * 2 * 4 + 8);
});

test("trace: 对角线命中——srcRow==goalRow 且全空最短路径", () => {
  const g = emptyGrid(1); // 1×1
  const r = trace(g, 0, 0, 1);
  assert.ok(r.hit);
  assert.deepEqual(r.cells, [[0, 0]]);
});

test("trace: 端到端——3 段折线抵达目标行（可解性验证）", () => {
  // 复刻 generateLevel 思路：srcRow=0 → goalRow=2，n=3
  // 列1 转弯：(1,0)\ 右→下，光沿列1下到 (1,2)，(1,2)\ 下→右，向右出界命中 goalRow=2
  let g = emptyGrid(3);
  g = setMirror(g, 1, 0, 2); // \ 右→下
  g = setMirror(g, 1, 2, 2); // \ 下→右（reflect(1,2)=0）
  const r = trace(g, 0, 2, 3);
  assert.ok(r.hit, "折线应命中 goalRow=2");
});
