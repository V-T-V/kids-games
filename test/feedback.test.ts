/**
 * feedback.ts 测试 —— 反馈存储与读取
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadFeedback,
  addFeedback,
  clearFeedback,
  feedbackCount,
  countHardFeedback,
  resolveFeedback,
  deleteFeedback,
  exportFeedback,
  FEEDBACK_TYPES,
  type FeedbackEntry,
} from "../src/core/feedback.ts";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage =
    new MemStorage();
});

const sample: FeedbackEntry = {
  gameId: "color-mixer",
  gameTitle: "色彩调配师",
  type: "bug",
  description: "点了没反应",
  timestamp: Date.now(),
  difficulty: "easy",
};

test("loadFeedback: 空存储返回空数组", () => {
  assert.deepEqual(loadFeedback(), []);
});

test("addFeedback: 添加一条", () => {
  addFeedback(sample);
  const all = loadFeedback();
  assert.equal(all.length, 1);
  assert.equal(all[0]!.gameId, "color-mixer");
  assert.equal(all[0]!.type, "bug");
});

test("feedbackCount: 正确计数", () => {
  assert.equal(feedbackCount(), 0);
  addFeedback(sample);
  assert.equal(feedbackCount(), 1);
  addFeedback({ ...sample, type: "too-hard" });
  assert.equal(feedbackCount(), 2);
});

test("clearFeedback: 清空", () => {
  addFeedback(sample);
  addFeedback(sample);
  assert.equal(feedbackCount(), 2);
  clearFeedback();
  assert.equal(feedbackCount(), 0);
  assert.deepEqual(loadFeedback(), []);
});

test("addFeedback: 200条上限", () => {
  for (let i = 0; i < 250; i++) {
    addFeedback({ ...sample, timestamp: i });
  }
  assert.equal(feedbackCount(), 200);
  // 保留最后200条（timestamp 50..249）
  const all = loadFeedback();
  assert.equal(all[0]!.timestamp, 50);
  assert.equal(all[199]!.timestamp, 249);
});

test("loadFeedback: 损坏JSON不崩溃", () => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage.setItem(
    "kids-games-feedback",
    "not json",
  );
  assert.deepEqual(loadFeedback(), []);
});

// ---------- countHardFeedback: 自适应难度降档信号 ----------

test("countHardFeedback: 只统计未处理的 too-hard/cannot-clear", () => {
  addFeedback({ ...sample, gameId: "g1", type: "too-hard", timestamp: 1 });
  addFeedback({ ...sample, gameId: "g1", type: "cannot-clear", timestamp: 2 });
  addFeedback({ ...sample, gameId: "g1", type: "too-easy", timestamp: 3 });
  addFeedback({ ...sample, gameId: "g1", type: "bug", timestamp: 4 });
  assert.equal(countHardFeedback("g1"), 2);
});

test("countHardFeedback: 已处理的太难反馈不计入", () => {
  addFeedback({ ...sample, gameId: "g2", type: "too-hard", timestamp: 10 });
  addFeedback({ ...sample, gameId: "g2", type: "too-hard", timestamp: 11 });
  resolveFeedback(10, true); // 标记已处理
  assert.equal(countHardFeedback("g2"), 1, "已处理的不应计入");
});

test("countHardFeedback: 按 gameId 隔离（其他游戏的反馈不影响）", () => {
  addFeedback({ ...sample, gameId: "aaa", type: "too-hard", timestamp: 20 });
  addFeedback({ ...sample, gameId: "bbb", type: "too-hard", timestamp: 21 });
  assert.equal(countHardFeedback("aaa"), 1);
  assert.equal(countHardFeedback("bbb"), 1);
  assert.equal(countHardFeedback("zzz"), 0);
});

test("countHardFeedback: 空存储返回 0", () => {
  assert.equal(countHardFeedback("any"), 0);
});

// ---------- resolveFeedback / deleteFeedback ----------

test("resolveFeedback: 切换已处理状态（按 timestamp 定位）", () => {
  addFeedback({ ...sample, timestamp: 100 });
  assert.equal(feedbackCount(), 1); // 未处理
  resolveFeedback(100, true);
  assert.equal(feedbackCount(), 0, "标记已处理后未处理数应归零");
  resolveFeedback(100, false); // 改回未处理
  assert.equal(feedbackCount(), 1);
});

test("resolveFeedback: 不存在的 timestamp 静默忽略（不抛错）", () => {
  addFeedback({ ...sample, timestamp: 200 });
  resolveFeedback(999999, true); // 不存在
  assert.equal(feedbackCount(), 1, "不存在的 timestamp 不影响数据");
});

test("deleteFeedback: 按 timestamp 删除单条", () => {
  addFeedback({ ...sample, timestamp: 300 });
  addFeedback({ ...sample, timestamp: 301 });
  assert.equal(loadFeedback().length, 2);
  deleteFeedback(300);
  const all = loadFeedback();
  assert.equal(all.length, 1);
  assert.equal(all[0]!.timestamp, 301);
});

test("deleteFeedback: 不存在的 timestamp 静默忽略", () => {
  addFeedback({ ...sample, timestamp: 400 });
  deleteFeedback(999);
  assert.equal(loadFeedback().length, 1);
});

// ---------- exportFeedback: 文本导出 ----------

test("exportFeedback: 空反馈返回提示文案", () => {
  assert.equal(exportFeedback(), "暂无反馈记录。");
});

test("exportFeedback: 格式含时间/标题/类型图标/难度/描述", () => {
  addFeedback({
    ...sample,
    gameId: "g-x",
    gameTitle: "测试游戏",
    type: "too-hard",
    description: "太难了",
    timestamp: new Date("2025-01-15T10:30:00").getTime(),
    difficulty: "hard",
    context: { round: 2, right: 3, wrong: 5, score: 10 },
  });
  const out = exportFeedback();
  assert.match(out, /童趣游戏屋 · 问题反馈（共 1 条）/);
  assert.match(out, /测试游戏/);
  assert.match(out, /too-hard|太难/); // FEEDBACK_TYPES.short 或 type
  assert.match(out, /2025-01-15 10:30/);
  assert.match(out, /太难了/);
  assert.match(out, /第2关 对3错5/);
  assert.match(out, /分10/);
});

test("exportFeedback: 已处理反馈标注 [已处理]", () => {
  addFeedback({ ...sample, timestamp: 500 });
  resolveFeedback(500, true);
  const out = exportFeedback();
  assert.match(out, /\[已处理\]/);
});

test("exportFeedback: 多条按存档顺序输出，含总数", () => {
  addFeedback({ ...sample, type: "bug", timestamp: 600 });
  addFeedback({ ...sample, type: "too-easy", timestamp: 601 });
  addFeedback({ ...sample, type: "unclear", timestamp: 602 });
  const out = exportFeedback();
  assert.match(out, /共 3 条/);
});

// ---------- FEEDBACK_TYPES 元数据完整性 ----------

test("FEEDBACK_TYPES: 6 种类型都有 label/short/icon 非空", () => {
  const types = Object.keys(FEEDBACK_TYPES) as Array<keyof typeof FEEDBACK_TYPES>;
  assert.equal(types.length, 6);
  for (const t of types) {
    const info = FEEDBACK_TYPES[t];
    assert.ok(info.label.length > 0, `${t} 缺 label`);
    assert.ok(info.short.length > 0, `${t} 缺 short`);
    assert.ok(info.icon.length > 0, `${t} 缺 icon`);
  }
});
