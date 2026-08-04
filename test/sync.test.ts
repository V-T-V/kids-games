// 反馈同步客户端 sync.ts —— 纯逻辑测试（mock fetch + 内存 localStorage，不依赖真实网络）。
import { test } from "node:test";
import assert from "node:assert/strict";
import type { FeedbackEntry } from "../src/core/feedback.ts";

const SYNC_KEY = "kids-games-sync-v1";

function makeEntry(timestamp: number, gameId = "color-mixer"): FeedbackEntry {
  return {
    gameId,
    gameTitle: "色彩调配师",
    type: "bug",
    description: "点了没反应",
    timestamp,
    difficulty: "easy",
    context: { round: 1, right: 0, wrong: 2, durationMs: 5000 },
  };
}

// —— 内存 localStorage + 可控 fetch mock ——
function makeMemStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

let memStore: Storage;

/** mock navigator.onLine（Node 里 navigator 是只读 getter，须用 defineProperty）。 */
function setOnline(on: boolean): void {
  Object.defineProperty(navigator, "onLine", {
    value: on,
    configurable: true,
    writable: true,
  });
}

function setup(cfg?: {
  enabled?: boolean;
  baseUrl?: string;
  token?: string;
}): void {
  memStore = makeMemStorage();
  (globalThis as { localStorage?: Storage }).localStorage = memStore;
  (globalThis as { window?: Partial<Window> }).window = {
    dispatchEvent: () => true,
  };
  setOnline(true); // 默认在线
  const defaults = {
    enabled: true,
    baseUrl: "http://127.0.0.1:8080/api/v1",
    token: "test-token-abc",
  };
  const merged = { ...defaults, ...cfg };
  memStore.setItem(
    SYNC_KEY,
    JSON.stringify({
      enabled: merged.enabled,
      baseUrl: merged.baseUrl,
      token: merged.token,
    }),
  );
}

function setFetch(
  impl: (url: string, init?: RequestInit) => Promise<Response>,
): void {
  (globalThis as { fetch?: unknown }).fetch = impl;
}

function makeResponse(status: number): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
  } as Response;
}

test("配置: 默认关闭，损坏 JSON 返回默认", async () => {
  memStore = makeMemStorage();
  (globalThis as { localStorage?: Storage }).localStorage = memStore;
  (globalThis as { window?: Partial<Window> }).window = {
    dispatchEvent: () => true,
  };
  const { getSyncConfig, DEFAULT_SYNC_CONFIG, isSyncReady } =
    await import("../src/core/sync.ts");
  assert.deepEqual(getSyncConfig(), DEFAULT_SYNC_CONFIG);
  assert.equal(isSyncReady(), false);
  // 损坏 JSON 不崩
  memStore.setItem(SYNC_KEY, "{broken");
  assert.deepEqual(getSyncConfig(), DEFAULT_SYNC_CONFIG);
});

test("配置: setSyncConfig 读写一致", async () => {
  setup();
  const { getSyncConfig, setSyncConfig, isSyncReady } =
    await import("../src/core/sync.ts");
  assert.equal(isSyncReady(), true);
  setSyncConfig({ enabled: false, baseUrl: "x", token: "y" });
  assert.equal(getSyncConfig().enabled, false);
});

test("pushFeedback: 201 成功", async () => {
  setup();
  setFetch(async () => makeResponse(201));
  const { pushFeedback } = await import("../src/core/sync.ts");
  const r = await pushFeedback(makeEntry(1000));
  assert.equal(r.ok, true);
  assert.equal(r.conflict, false);
});

test("pushFeedback: 409 冲突视为成功（幂等）", async () => {
  setup();
  setFetch(async () => makeResponse(409));
  const { pushFeedback } = await import("../src/core/sync.ts");
  const r = await pushFeedback(makeEntry(1000));
  assert.equal(r.ok, true);
  assert.equal(r.conflict, true);
});

test("pushFeedback: 500 失败", async () => {
  setup();
  setFetch(async () => makeResponse(500));
  const { pushFeedback } = await import("../src/core/sync.ts");
  const r = await pushFeedback(makeEntry(1000));
  assert.equal(r.ok, false);
  assert.equal(r.conflict, false);
  assert.match(r.error ?? "", /http-500/);
});

test("pushFeedback: 网络抛错降级为失败（不抛出）", async () => {
  setup();
  setFetch(async () => {
    throw new Error("ECONNREFUSED");
  });
  const { pushFeedback } = await import("../src/core/sync.ts");
  const r = await pushFeedback(makeEntry(1000));
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /ECONNREFUSED/);
});

test("pushFeedback: 未配置/未启用直接返回失败（不联网）", async () => {
  setup({ enabled: false });
  let called = false;
  setFetch(async () => {
    called = true;
    return makeResponse(201);
  });
  const { pushFeedback } = await import("../src/core/sync.ts");
  const r = await pushFeedback(makeEntry(1000));
  assert.equal(r.ok, false);
  assert.equal(r.error, "sync-not-configured");
  assert.equal(called, false); // 没发请求
});

test("enqueueFeedback: 在线成功不入队", async () => {
  setup();
  setOnline(true);
  setFetch(async () => makeResponse(201));
  const { enqueueFeedback, getPendingCount } =
    await import("../src/core/sync.ts");
  await new Promise<void>((resolve) => {
    enqueueFeedback(makeEntry(2000));
    setTimeout(resolve, 50);
  });
  assert.equal(getPendingCount(), 0);
});

test("enqueueFeedback: 在线失败则入队", async () => {
  setup();
  setOnline(true);
  setFetch(async () => makeResponse(500));
  const { enqueueFeedback, getPendingCount, getPending } =
    await import("../src/core/sync.ts");
  await new Promise<void>((resolve) => {
    enqueueFeedback(makeEntry(3000));
    setTimeout(resolve, 50);
  });
  assert.equal(getPendingCount(), 1);
  assert.equal(getPending()[0]!.timestamp, 3000);
});

test("enqueueFeedback: 离线直接入队（不发请求）", async () => {
  setup();
  let called = false;
  setFetch(async () => {
    called = true;
    return makeResponse(201);
  });
  setOnline(false);
  const { enqueueFeedback, getPendingCount } =
    await import("../src/core/sync.ts");
  enqueueFeedback(makeEntry(4000));
  assert.equal(getPendingCount(), 1);
  assert.equal(called, false);
});

test("enqueueFeedback: 同一 timestamp 去重入队", async () => {
  setup();
  setOnline(false);
  const { enqueueFeedback, getPendingCount } =
    await import("../src/core/sync.ts");
  enqueueFeedback(makeEntry(5000));
  enqueueFeedback(makeEntry(5000)); // 重复
  assert.equal(getPendingCount(), 1);
});

test("retryPending: 逐条推送，成功的移除", async () => {
  setup();
  const statuses = [201, 201, 500]; // 第 3 条失败
  let i = 0;
  setFetch(async () => makeResponse(statuses[i++] ?? 500));
  setOnline(true);
  const { enqueuePending, retryPending, getPendingCount } =
    await import("../src/core/sync.ts");
  enqueuePending(makeEntry(100));
  enqueuePending(makeEntry(200));
  enqueuePending(makeEntry(300));
  const n = await retryPending();
  assert.equal(n, 2); // 推成功 2 条
  // 第 3 条失败 → retryPending 遇到失败即停，剩 1 条
  assert.equal(getPendingCount(), 1);
});

test("retryPending: 未配置直接返回 0", async () => {
  setup({ enabled: false });
  const { retryPending, enqueuePending } = await import("../src/core/sync.ts");
  enqueuePending(makeEntry(600));
  const n = await retryPending();
  assert.equal(n, 0);
});

test("flushAllPending: 全量逐条推，失败计入 failed（遇错不停）", async () => {
  setup();
  const statuses = [201, 500, 201];
  let i = 0;
  setFetch(async () => makeResponse(statuses[i++] ?? 500));
  const { enqueuePending, flushAllPending, getPendingCount } =
    await import("../src/core/sync.ts");
  enqueuePending(makeEntry(10));
  enqueuePending(makeEntry(20));
  enqueuePending(makeEntry(30));
  const r = await flushAllPending();
  assert.equal(r.success, 2);
  assert.equal(r.failed, 1);
  // 成功的已移除，失败的留队
  assert.equal(getPendingCount(), 1);
});

test("pushFeedback: 请求体用 timestamp 作 id（幂等键）+ 带 Bearer token", async () => {
  setup({ token: "secret-tok" });
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  setFetch(async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return makeResponse(201);
  });
  const { pushFeedback } = await import("../src/core/sync.ts");
  await pushFeedback(makeEntry(7777));
  assert.match(capturedUrl, /\/collections\/kids-games-feedback\/records$/);
  const body = JSON.parse(String(capturedInit?.body)) as {
    id: string;
    data: { timestamp: number };
  };
  assert.equal(body.id, "7777"); // timestamp 作 id
  assert.equal(body.data.timestamp, 7777);
  const headers = capturedInit?.headers as Record<string, string> | undefined;
  assert.equal(headers?.Authorization, "Bearer secret-tok");
  assert.equal(capturedInit?.method, "POST");
});

test("pending 队列: 上限截断 + clearPending", async () => {
  setup();
  const { enqueuePending, getPending, clearPending } =
    await import("../src/core/sync.ts");
  // 填超上限（PENDING_MAX=200）
  for (let i = 0; i < 210; i++) enqueuePending(makeEntry(1000 + i));
  assert.ok(getPending().length <= 200);
  clearPending();
  assert.equal(getPending().length, 0);
});
