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
