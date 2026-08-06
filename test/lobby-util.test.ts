// 大厅/游戏通用工具单测：shuffle / sample / randInt / debounce / getCssVar。
// 这些纯函数此前零测试，覆盖随机性、边界、回退（Node 无 window/getComputedStyle）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { shuffle, sample, randInt, debounce, getCssVar } from "../src/lobby/util.ts";

test("shuffle: 不修改原数组（返回新数组）", () => {
  const orig = [1, 2, 3, 4, 5];
  const copy = [...orig];
  const out = shuffle(orig);
  assert.deepEqual(orig, copy, "原数组不应被修改");
  assert.notEqual(out, orig, "应返回新数组");
});

test("shuffle: 元素集合不变（仅顺序变）", () => {
  const out = shuffle([1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
});

test("shuffle: 长度保持", () => {
  assert.equal(shuffle([1, 2, 3]).length, 3);
  assert.equal(shuffle([]).length, 0);
  assert.equal(shuffle([42]).length, 1);
});

test("shuffle: 空数组返回空数组", () => {
  assert.deepEqual(shuffle([]), []);
});

test("shuffle: 单元素数组不变", () => {
  assert.deepEqual(shuffle([7]), [7]);
});

test("shuffle: 分布合理性（多次洗牌应产生多种顺序）", () => {
  // 3 元素 6 种排列，跑 200 次应至少见到 4 种（极宽松，防 flaky）
  const orders = new Set<string>();
  for (let i = 0; i < 200; i++) {
    orders.add(shuffle([1, 2, 3]).join(","));
  }
  assert.ok(orders.size >= 4, `洗牌应产生多种顺序，实际 ${orders.size}`);
});

test("sample: 返回数组中的元素", () => {
  const arr = [10, 20, 30];
  for (let i = 0; i < 20; i++) {
    assert.ok(arr.includes(sample(arr)));
  }
});

test("randInt: 值在 [min, max] 闭区间", () => {
  for (let i = 0; i < 100; i++) {
    const n = randInt(3, 7);
    assert.ok(n >= 3 && n <= 7, `${n} 不在 [3,7]`);
  }
});

test("randInt: min===max 返回该值", () => {
  assert.equal(randInt(5, 5), 5);
  assert.equal(randInt(0, 0), 0);
});

test("randInt: 覆盖区间两端（跑足够多次必命中 min 和 max）", () => {
  const seen = new Set<number>();
  for (let i = 0; i < 500; i++) seen.add(randInt(1, 3));
  assert.ok(seen.has(1) && seen.has(2) && seen.has(3));
});

test("debounce: 多次快速调用只执行最后一次（注入 window 垫片）", async () => {
  // Node 无 window，注入最小垫片
  const g = globalThis as unknown as { window: unknown };
  g.window = globalThis;
  try {
    let calls = 0;
    const fn = debounce(() => {
      calls += 1;
    }, 10);
    fn();
    fn();
    fn();
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(calls, 1, "防抖后只应执行 1 次");
  } finally {
    delete g.window;
  }
});

test("debounce: 后续调用取消前一个定时器（不堆积）", async () => {
  const g = globalThis as unknown as { window: unknown };
  g.window = globalThis;
  try {
    let calls = 0;
    const fn = debounce(() => {
      calls += 1;
    }, 15);
    fn();
    await new Promise((r) => setTimeout(r, 5));
    fn(); // 取消第一个
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(calls, 1, "只应执行第二次");
  } finally {
    delete g.window;
  }
});

test("getCssVar: Node 无 getComputedStyle → 回退到内置调色板", () => {
  // getCssVar 首次调用缓存；这里测已知 fallback key
  const v = getCssVar("--c-blue");
  assert.equal(v, "#4d96ff", "应回退到内置 fallback");
});

test("getCssVar: 未知 key 回退到默认蓝色", () => {
  const v = getCssVar("--nonexistent-var");
  assert.equal(v, "#4d96ff", "未知 key 应回退默认色");
});

test("getCssVar: 所有内置 fallback key 都返回有效颜色", () => {
  const keys = [
    "--c-pink",
    "--c-yellow",
    "--c-blue",
    "--c-green",
    "--c-purple",
    "--c-orange",
    "--c-teal",
    "--c-red",
    "--c-brown",
    "--c-cyan",
    "--c-indigo",
  ];
  for (const k of keys) {
    const v = getCssVar(k);
    assert.ok(v.startsWith("#"), `${k} 应返回十六进制颜色，实际 ${v}`);
  }
});
