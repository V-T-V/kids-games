/* toast 通知错误路径与降级测试 —— 守护「永不抛错、无 DOM 优雅降级」契约。
   toast.ts 依赖 document/window，在 Node（SSR/测试/构建期）这些都不存在。
   与 tts.ts 同款契约：调用 showAchievement/showToast 在无 DOM 时应静默跳过，
   不抛错、不无限堆积队列。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  showAchievement,
  showToast,
  pendingToastCount,
} from "../src/core/toast.ts";

/** 确保 globalThis 上无 document（Node 默认即无，但显式清理以防其他测试污染）。 */
function ensureNoDom(): void {
  const g = globalThis as Record<string, unknown>;
  delete g.document;
  delete g.window;
}

test("showAchievement: 无 DOM 不抛错（静默降级）", () => {
  ensureNoDom();
  assert.doesNotThrow(() => {
    showAchievement("🏆", "初次通关");
  });
});

test("showToast: 无 DOM 不抛错（静默降级）", () => {
  ensureNoDom();
  assert.doesNotThrow(() => {
    showToast("你好", "✨");
  });
});

test("showAchievement: 无 DOM 时队列被清空（不无限堆积）", () => {
  ensureNoDom();
  showAchievement("🌟", "a");
  showAchievement("🌟", "b");
  showAchievement("🌟", "c");
  // 无 DOM 触发 showNext 会清空队列
  assert.ok(
    pendingToastCount() <= 1,
    `无 DOM 下队列应被清空，实际 ${pendingToastCount()}`,
  );
});

test("pendingToastCount: 无 DOM 多次调用后保持有界", () => {
  ensureNoDom();
  for (let i = 0; i < 20; i++) {
    showAchievement("🏆", `成就 ${i}`);
  }
  assert.ok(
    pendingToastCount() <= 1,
    `无 DOM 下队列应有界，实际 ${pendingToastCount()}`,
  );
});

test("showAchievement: 默认 subtitle 为「成就已解锁」不抛错", () => {
  ensureNoDom();
  assert.doesNotThrow(() => {
    showAchievement("🌱", "初次通关"); // 不传 subtitle 走默认值
  });
});

test("showToast: 默认 icon 为「✨」不抛错", () => {
  ensureNoDom();
  assert.doesNotThrow(() => {
    showToast("提示文本"); // 不传 icon 走默认值
  });
});

test("pendingToastCount: 返回非负整数", () => {
  ensureNoDom();
  const n = pendingToastCount();
  assert.ok(Number.isInteger(n));
  assert.ok(n >= 0);
});
