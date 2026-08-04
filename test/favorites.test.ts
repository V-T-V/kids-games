// 收藏夹 + 最近玩过数据层。与 feedback.ts 同构：独立 localStorage key、容错。
// 用 node --test 自带的 mock 方式隔离 localStorage（注入一个内存版到 globalThis）。
import { test } from "node:test";
import assert from "node:assert/strict";

// —— 内存 localStorage（node:test 无浏览器环境）——
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

// 每个 test 前重置一个干净的 localStorage，避免互相污染。
// favorites.ts 读写的是裸 localStorage，故挂到 globalThis。
let memStore: Storage;
function setup(): void {
  memStore = makeMemStorage();
  (globalThis as { localStorage?: Storage }).localStorage = memStore;
  (globalThis as { window?: Partial<Window> }).window = {
    dispatchEvent: () => true,
  };
}

const FAV_KEY = "kids-games-favorites-v1";
const RECENT_KEY = "kids-games-recent-v1";

test("收藏: 初始为空", async () => {
  setup();
  const { getFavorites } = await import("../src/core/favorites.ts");
  assert.deepEqual(getFavorites(), []);
});

test("收藏: toggle 切换并去重", async () => {
  setup();
  const { toggleFavorite, getFavorites, isFavorite } =
    await import("../src/core/favorites.ts");
  assert.equal(toggleFavorite("color-mixer"), true);
  assert.equal(isFavorite("color-mixer"), true);
  assert.equal(toggleFavorite("shape-match"), true);
  assert.deepEqual(getFavorites(), ["color-mixer", "shape-match"]);
  // 再次 toggle 同一个 → 取消收藏
  assert.equal(toggleFavorite("color-mixer"), false);
  assert.deepEqual(getFavorites(), ["shape-match"]);
});

test("收藏: 上限 FAVORITES_MAX 截断，超出拒绝新增", async () => {
  setup();
  const { toggleFavorite, getFavorites, FAVORITES_MAX } =
    await import("../src/core/favorites.ts");
  for (let i = 0; i < FAVORITES_MAX; i++) {
    assert.equal(toggleFavorite(`g-${i}`), true, `第 ${i} 个应能收藏`);
  }
  assert.equal(getFavorites().length, FAVORITES_MAX);
  // 再 toggle 一个新的 → 拒绝，返回 false，列表不变
  assert.equal(toggleFavorite("overflow"), false);
  assert.equal(getFavorites().length, FAVORITES_MAX);
  assert.ok(!getFavorites().includes("overflow"));
});

test("收藏: add/remove 幂等", async () => {
  setup();
  const { addFavorite, removeFavorite, getFavorites } =
    await import("../src/core/favorites.ts");
  addFavorite("a");
  addFavorite("a"); // 幂等
  assert.deepEqual(getFavorites(), ["a"]);
  removeFavorite("a");
  removeFavorite("a"); // 幂等
  assert.deepEqual(getFavorites(), []);
});

test("收藏: clear 清空", async () => {
  setup();
  const { addFavorite, clearFavorites, getFavorites } =
    await import("../src/core/favorites.ts");
  addFavorite("a");
  addFavorite("b");
  clearFavorites();
  assert.deepEqual(getFavorites(), []);
});

test("最近玩过: pushRecent 置顶并去重", async () => {
  setup();
  const { pushRecent, getRecent } = await import("../src/core/favorites.ts");
  pushRecent("a");
  pushRecent("b");
  pushRecent("c");
  assert.deepEqual(getRecent(), ["c", "b", "a"]);
  // 再次 push b → 置顶，去重
  pushRecent("b");
  assert.deepEqual(getRecent(), ["b", "c", "a"]);
});

test("最近玩过: 环形缓冲上限 RECENT_MAX", async () => {
  setup();
  const { pushRecent, getRecent, RECENT_MAX } =
    await import("../src/core/favorites.ts");
  for (let i = 0; i < RECENT_MAX + 5; i++) pushRecent(`g-${i}`);
  assert.equal(getRecent().length, RECENT_MAX);
  // 最新的在最前
  assert.equal(getRecent()[0], `g-${RECENT_MAX + 4}`);
  // 最旧的（g-0）应已被丢弃
  assert.ok(!getRecent().includes("g-0"));
});

test("最近玩过: clear 清空", async () => {
  setup();
  const { pushRecent, clearRecent, getRecent } =
    await import("../src/core/favorites.ts");
  pushRecent("a");
  clearRecent();
  assert.deepEqual(getRecent(), []);
});

test("容错: 损坏的 JSON 不崩溃，返回空", async () => {
  setup();
  memStore.setItem(FAV_KEY, "{not json");
  memStore.setItem(RECENT_KEY, "[1,2,");
  const { getFavorites, getRecent } = await import("../src/core/favorites.ts");
  assert.deepEqual(getFavorites(), []);
  assert.deepEqual(getRecent(), []);
});

test("容错: 容量满（setItem 抛错）不崩溃、不污染内存", async () => {
  setup();
  // 把 setItem 改成总是抛错，模拟隐私模式/配额满
  memStore.setItem = () => {
    throw new Error("QuotaExceeded");
  };
  const { toggleFavorite, pushRecent, getFavorites, getRecent } =
    await import("../src/core/favorites.ts");
  // 这些调用不应抛
  assert.doesNotThrow(() => toggleFavorite("a"));
  assert.doesNotThrow(() => pushRecent("a"));
  // 读取仍可用（getItem 没被破坏）
  assert.deepEqual(getFavorites(), []);
  assert.deepEqual(getRecent(), []);
});

test("getValid* 过滤掉未注册的幽灵 id", async () => {
  setup();
  const { addFavorite, pushRecent, getValidFavorites, getValidRecent } =
    await import("../src/core/favorites.ts");
  addFavorite("color-mixer");
  addFavorite("ghost-game");
  pushRecent("shape-match");
  pushRecent("another-ghost");
  const valid = new Set(["color-mixer", "shape-match"]);
  assert.deepEqual(getValidFavorites(valid), ["color-mixer"]);
  assert.deepEqual(getValidRecent(valid), ["shape-match"]);
});
