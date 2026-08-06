// TTS 语音朗读单测：错误路径与降级（localStorage 抛错/缺失、speechSynthesis 缺失）。
// 浏览器原生 API 在 Node 不存在，正是要守护的「永不抛错、优雅降级」契约。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isTTSEnabled,
  setTTSEnabled,
  speak,
  stop,
} from "../src/core/tts.ts";

/** 安装一个可控的 localStorage 到 globalThis，返回清理函数。 */
function mockStorage(store: Record<string, string> = {}): () => void {
  const g = globalThis as Record<string, unknown>;
  const orig = g.localStorage;
  g.localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
  return () => {
    g.localStorage = orig;
  };
}

test("isTTSEnabled: 无 localStorage → 返回 false 不抛错", () => {
  // Node 默认无 localStorage，应走 catch 分支返回 false
  assert.equal(isTTSEnabled(), false);
});

test("isTTSEnabled: localStorage 返回 'true' → true", () => {
  const restore = mockStorage({ "kids-games-tts-v1": "true" });
  try {
    assert.equal(isTTSEnabled(), true);
  } finally {
    restore();
  }
});

test("isTTSEnabled: localStorage 返回其他值 → false", () => {
  const restore = mockStorage({ "kids-games-tts-v1": "false" });
  try {
    assert.equal(isTTSEnabled(), false);
  } finally {
    restore();
  }
  const r2 = mockStorage({ "kids-games-tts-v1": "anything" });
  try {
    assert.equal(isTTSEnabled(), false);
  } finally {
    r2();
  }
});

test("isTTSEnabled: getItem 抛错 → 返回 false 不抛出", () => {
  const g = globalThis as Record<string, unknown>;
  const orig = g.localStorage;
  g.localStorage = {
    getItem: () => {
      throw new Error("denied");
    },
  };
  try {
    assert.equal(isTTSEnabled(), false);
  } finally {
    g.localStorage = orig;
  }
});

test("setTTSEnabled: 写入 localStorage 正确值", () => {
  const store: Record<string, string> = {};
  const restore = mockStorage(store);
  try {
    setTTSEnabled(true);
    assert.equal(store["kids-games-tts-v1"], "true");
    setTTSEnabled(false);
    assert.equal(store["kids-games-tts-v1"], "false");
  } finally {
    restore();
  }
});

test("setTTSEnabled: setItem 抛错 → 不抛出（静默失败）", () => {
  const g = globalThis as Record<string, unknown>;
  const orig = g.localStorage;
  g.localStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  };
  try {
    assert.doesNotThrow(() => setTTSEnabled(true));
  } finally {
    g.localStorage = orig;
  }
});

test("speak: 未启用 → 静默跳过（不抛错）", () => {
  const restore = mockStorage({ "kids-games-tts-v1": "false" });
  try {
    assert.doesNotThrow(() => speak("你好世界"));
  } finally {
    restore();
  }
});

test("speak: 启用但无 speechSynthesis → 静默跳过不抛错", () => {
  const restore = mockStorage({ "kids-games-tts-v1": "true" });
  try {
    // Node 无 speechSynthesis，应直接 return
    assert.doesNotThrow(() => speak("找出紫色的球"));
  } finally {
    restore();
  }
});

test("speak: 空/纯 emoji 文本 → 静默跳过", () => {
  const restore = mockStorage({ "kids-games-tts-v1": "true" });
  try {
    assert.doesNotThrow(() => speak(""));
    assert.doesNotThrow(() => speak("🍎🍊🍇")); // 纯 emoji 清理后为空
    assert.doesNotThrow(() => speak("   "));
  } finally {
    restore();
  }
});

test("stop: 无 speechSynthesis → 不抛错", () => {
  assert.doesNotThrow(() => stop());
});

test("stop: speechSynthesis.cancel 抛错 → 不抛出", () => {
  const g = globalThis as Record<string, unknown>;
  const orig = g.speechSynthesis;
  g.speechSynthesis = {
    cancel: () => {
      throw new Error("fail");
    },
  };
  try {
    assert.doesNotThrow(() => stop());
  } finally {
    g.speechSynthesis = orig;
  }
});

test("setTTSEnabled(false): 关闭时调用 stop 不抛错", () => {
  const store: Record<string, string> = {};
  const restore = mockStorage(store);
  try {
    assert.doesNotThrow(() => setTTSEnabled(false));
  } finally {
    restore();
  }
});
