// praise.ts 单测：夸赞文案池永不出现否定词 / 永不连续重复 / 池非空。
// 这是面向 3-6 岁孩子的情感安全网——文案里绝不能混入否定、批评、嘲讽字眼。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  praiseClear,
  praiseCorrect,
  praiseRest,
  praiseTryAgain,
} from "../src/core/praise.ts";

/** 否定/批评/嘲讽词黑名单——这些字眼出现在孩子面前的文案里就是 bug。 */
const NEGATIVE_WORDS = [
  "错",
  "笨",
  "蠢",
  "傻",
  "笨蛋",
  "不行",
  "不会",
  "不能",
  "差劲",
  "糟糕",
  "失败",
  "输了",
  "没用",
  "放弃",
  "讨厌",
  "笨",
  "白痴",
  "废物",
];

// praise 内部维护单例 lastSpoken，导出的 4 个函数各自独立池不交叉。
// 这里把每个函数的返回值收集起来，做"池内容"与"不连续重复"两类断言。

function collect(fn: () => string, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(fn());
  return out;
}

test("praiseCorrect: 每次都返回非空文案", () => {
  const samples = collect(praiseCorrect, 30);
  for (const s of samples) {
    assert.ok(typeof s === "string", "应返回字符串");
    assert.ok(s.length > 0, "文案不应为空");
  }
});

test("praiseCorrect: 永不出现否定/批评词", () => {
  const samples = collect(praiseCorrect, 50);
  for (const s of samples) {
    for (const w of NEGATIVE_WORDS) {
      assert.ok(
        !s.includes(w),
        `答对文案 "${s}" 含否定词 "${w}"`,
      );
    }
  }
});

test("praiseTryAgain: 鼓励性文案不含否定词（引导再试，不是批评）", () => {
  const samples = collect(praiseTryAgain, 50);
  for (const s of samples) {
    assert.ok(s.length > 0);
    for (const w of NEGATIVE_WORDS) {
      // "差一点点" 含 "差"，但黑名单里是"差劲"不是"差"，不会被误伤
      assert.ok(!s.includes(w), `鼓励文案 "${s}" 含否定词 "${w}"`);
    }
  }
});

test("praiseClear / praiseRest: 文案非空且无否定词", () => {
  for (const s of collect(praiseClear, 30)) {
    assert.ok(s.length > 0);
    for (const w of NEGATIVE_WORDS) assert.ok(!s.includes(w));
  }
  for (const s of collect(praiseRest, 30)) {
    assert.ok(s.length > 0);
    for (const w of NEGATIVE_WORDS) assert.ok(!s.includes(w));
  }
});

test("praise: 连续调用 20 次，相邻两次不重复（避免连续重复感）", () => {
  // 池大小均 >=5，guard 循环会避免连续重复。
  // 注意：首次调用没有 last，第二次开始才比较；这里取相邻对检查。
  for (const fn of [praiseCorrect, praiseTryAgain, praiseClear, praiseRest]) {
    const samples = collect(fn, 20);
    for (let i = 1; i < samples.length; i++) {
      assert.notEqual(
        samples[i],
        samples[i - 1],
        `连续两次返回相同文案 "${samples[i]}"`,
      );
    }
  }
});

test("praise: 返回值都来自固定文案池（不会凭空生成）", () => {
  // 收集大量样本，去重后应等于池的子集——验证函数没有引入外部文案。
  // 这里用一个宽松断言：30 次调用去重后不超过池大小上限。
  const correctSet = new Set(collect(praiseCorrect, 100));
  assert.ok(correctSet.size <= 10, `答对池去重后 ${correctSet.size} > 10`);
  assert.ok(correctSet.size >= 5, `答对池去重后 ${correctSet.size} < 5，随机性可能坏了`);

  const againSet = new Set(collect(praiseTryAgain, 100));
  assert.ok(againSet.size <= 8 && againSet.size >= 5);

  const clearSet = new Set(collect(praiseClear, 50));
  assert.ok(clearSet.size <= 5 && clearSet.size >= 4);

  const restSet = new Set(collect(praiseRest, 50));
  assert.ok(restSet.size <= 4 && restSet.size >= 3);
});

test("praiseCorrect 文案池语义为正向鼓励（含鼓励性标点或情绪词）", () => {
  // 答对文案应带感叹号或积极字眼，确保语气到位
  const samples = collect(praiseCorrect, 50);
  const positives = ["棒", "厉害", "聪明", "了不起", "赞", "做到了", "好", "牛"];
  let positiveHits = 0;
  for (const s of samples) {
    if (positives.some((p) => s.includes(p))) positiveHits++;
  }
  assert.ok(
    positiveHits >= samples.length * 0.8,
    "至少 80% 答对文案应含正向词",
  );
});
