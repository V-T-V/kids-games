import { test } from "node:test";
import assert from "node:assert/strict";
import { GAMES } from "../src/games/registry.ts";
import {
  categoryOf,
  discoveryMeta,
  filterGames,
  parseAgeRange,
  type LobbyFilters,
} from "../src/lobby/contentFilters.ts";
import type { GameMeta } from "../src/types.ts";

const baseProgress = Object.fromEntries(
  GAMES.map((game) => [game.id, { cleared: false }]),
) as Record<string, { cleared: boolean }>;

function filters(overrides: Partial<LobbyFilters> = {}): LobbyFilters {
  return {
    category: "全部",
    completion: "all",
    age: "all",
    duration: "all",
    searchTerm: "",
    ...overrides,
  };
}

test("lobby filters: 解析年龄段并容错", () => {
  assert.deepEqual(parseAgeRange("3-6 岁"), [3, 6]);
  assert.deepEqual(parseAgeRange("bad"), [3, 6]);
});

test("lobby filters: 年龄筛选只返回覆盖该年龄的游戏", () => {
  const shown = filterGames(GAMES, baseProgress, filters({ age: "3" }));

  assert.ok(shown.length > 0);
  assert.ok(
    shown.every((game) => {
      const meta = discoveryMeta(game);
      return meta.ageMin <= 3 && meta.ageMax >= 3;
    }),
  );
  assert.ok(shown.every((game) => !game.age.startsWith("5-")));
});

test("lobby filters: 时长筛选按运营估算区间生效", () => {
  const shortGames = filterGames(
    GAMES,
    baseProgress,
    filters({ duration: "short" }),
  );
  const longGames = filterGames(
    GAMES,
    baseProgress,
    filters({ duration: "long" }),
  );

  assert.ok(shortGames.length > 0);
  assert.ok(longGames.length > 0);
  assert.ok(
    shortGames.every((game) => discoveryMeta(game).estimatedMinutes <= 5),
  );
  assert.ok(
    longGames.every((game) => discoveryMeta(game).estimatedMinutes > 8),
  );
});

test("lobby filters: 能力域、状态和搜索条件可以组合", () => {
  const progress = {
    ...baseProgress,
    [GAMES[0]!.id]: { cleared: true },
  };

  assert.deepEqual(
    filterGames(
      GAMES,
      progress,
      filters({ category: "认知", completion: "cleared", searchTerm: "3-6" }),
    ).map((game) => game.id),
    [GAMES[0]!.id],
  );
});

// ---------- categoryOf / parseAgeRange 单元 ----------

test("categoryOf: 取 tag 顶层分类（· 前部分）", () => {
  assert.equal(categoryOf("认知·颜色"), "认知");
  assert.equal(categoryOf("数学·运算"), "数学");
  assert.equal(categoryOf("无分隔符"), "无分隔符");
  // 空串 split 得 [""]，[0] 是空串而非 undefined，所以返回空串（不触发 ?? 回退）
  assert.equal(categoryOf(""), "");
});

test("parseAgeRange: 标准格式 / 空格变体 / 非法回退默认", () => {
  assert.deepEqual(parseAgeRange("3-6 岁"), [3, 6]);
  // 正则要求 " 岁" 前必须有空格，无空格不匹配 → 回退默认 [3,6]
  assert.deepEqual(parseAgeRange("4-5岁"), [3, 6]);
  assert.deepEqual(parseAgeRange("  3-4 岁  "), [3, 4]); // trim 后匹配
  assert.deepEqual(parseAgeRange("乱七八糟"), [3, 6]);
  assert.deepEqual(parseAgeRange(""), [3, 6]);
});

// ---------- discoveryMeta 时长估算 ----------

function game(over: Partial<GameMeta>): GameMeta {
  return {
    id: "synthetic" as never,
    title: "合成游戏",
    subtitle: "",
    icon: "🎮",
    theme: "--c-blue",
    age: "3-6 岁",
    tag: "认知·其他",
    ...over,
  } as GameMeta;
}

test("estimateMinutes: 3-5 岁游戏估 4 分钟（最短）", () => {
  const meta = discoveryMeta(game({ age: "3-5 岁", tag: "认知·其他" }));
  assert.equal(meta.estimatedMinutes, 4);
});

test("estimateMinutes: 语言/数学/科学类估 8 分钟", () => {
  for (const tag of ["语言·字母", "数学·运算", "科学·自然"]) {
    const meta = discoveryMeta(game({ age: "4-6 岁", tag }));
    assert.equal(meta.estimatedMinutes, 8, `${tag} 应估 8 分钟`);
  }
});

test("estimateMinutes: 逻辑/策略/编程类估 10 分钟（最长）", () => {
  for (const tag of ["逻辑·推理", "策略·棋盘", "逻辑·编程"]) {
    const meta = discoveryMeta(game({ age: "4-6 岁", tag }));
    assert.equal(meta.estimatedMinutes, 10, `${tag} 应估 10 分钟`);
  }
});

test("estimateMinutes: 反应/协调类估 5 分钟", () => {
  const meta = discoveryMeta(game({ age: "3-6 岁", tag: "反应·协调" }));
  assert.equal(meta.estimatedMinutes, 5);
});

test("estimateMinutes: 艺术/创造类估 7 分钟", () => {
  const meta = discoveryMeta(game({ age: "3-6 岁", tag: "艺术·绘画" }));
  assert.equal(meta.estimatedMinutes, 7);
});

// ---------- 时长筛选边界 ----------

test("filterGames 时长: short ≤5, medium 6-8, long >8 互斥", () => {
  const f = (d: never) => filters({ duration: d });
  const shortIds = filterGames(GAMES, baseProgress, f("short" as never)).map((g) => g.id);
  const medIds = filterGames(GAMES, baseProgress, f("medium" as never)).map((g) => g.id);
  const longIds = filterGames(GAMES, baseProgress, f("long" as never)).map((g) => g.id);
  const all = new Set<string>([...shortIds, ...medIds, ...longIds]);
  // 三段互不重叠
  for (const id of shortIds) {
    assert.ok(!medIds.includes(id), `${id} 不应同时 short 和 medium`);
    assert.ok(!longIds.includes(id), `${id} 不应同时 short 和 long`);
  }
  for (const id of medIds) assert.ok(!longIds.includes(id));
  // 三段并集 = 全部游戏
  assert.equal(all.size, GAMES.length, "三段时长并集应覆盖全部游戏");
});

// ---------- 搜索：拼音首字母 / emoji / 副标题 ----------

test("filterGames 搜索: 拼音首字母 'se' 匹配含'色'的游戏", () => {
  const shown = filterGames(
    GAMES,
    baseProgress,
    filters({ searchTerm: "se" }),
  );
  // '色' 的拼音是 se，标题含色的游戏应被匹配
  assert.ok(shown.length > 0);
  assert.ok(
    shown.every((g) => g.title.includes("色") || g.subtitle.includes("色")),
    "搜 se 应只返回含'色'的游戏",
  );
});

test("filterGames 搜索: 纯文本匹配标题", () => {
  const shown = filterGames(
    GAMES,
    baseProgress,
    filters({ searchTerm: "数字" }),
  );
  assert.ok(shown.length > 0);
  assert.ok(shown.every((g) => g.title.includes("数字") || g.subtitle.includes("数字")));
});

test("filterGames 搜索: 大小写不敏感（英文 term）", () => {
  // 用一个数字分钟数搜（age 字段或分钟），验证 toLowerCase 生效
  const upper = filterGames(GAMES, baseProgress, filters({ searchTerm: "6 分钟" }));
  const lower = filterGames(GAMES, baseProgress, filters({ searchTerm: "6 分钟" }));
  assert.deepEqual(upper.map((g) => g.id), lower.map((g) => g.id));
});

test("filterGames 搜索: 空搜索词返回全部（不过滤）", () => {
  const shown = filterGames(GAMES, baseProgress, filters({ searchTerm: "   " }));
  assert.equal(shown.length, GAMES.length, "空白搜索词应返回全部");
});

test("filterGames 搜索: 无匹配词返回空数组", () => {
  const shown = filterGames(
    GAMES,
    baseProgress,
    filters({ searchTerm: "zzzzzNoSuchGame999" }),
  );
  assert.equal(shown.length, 0);
});

// ---------- completion 状态筛选 ----------

test("filterGames: uncleared 排除已通关", () => {
  const clearedId = GAMES[5]!.id;
  const progress = { ...baseProgress, [clearedId]: { cleared: true } };
  const shown = filterGames(GAMES, progress, filters({ completion: "uncleared" }));
  assert.ok(!shown.some((g) => g.id === clearedId), "已通关不应出现在 uncleared");
  assert.ok(shown.length < GAMES.length);
});

test("filterGames: cleared 只含已通关", () => {
  const clearedId = GAMES[10]!.id;
  const progress = { ...baseProgress, [clearedId]: { cleared: true } };
  const shown = filterGames(GAMES, progress, filters({ completion: "cleared" }));
  assert.deepEqual(shown.map((g) => g.id), [clearedId]);
});

test("filterGames: 无进度记录的游戏视为未通关（可被 uncleared 命中）", () => {
  const sparseProgress: Record<string, { cleared: boolean }> = {};
  const shown = filterGames(GAMES, sparseProgress, filters({ completion: "uncleared" }));
  assert.equal(shown.length, GAMES.length, "无记录应全部视为未通关");
  const cleared = filterGames(GAMES, sparseProgress, filters({ completion: "cleared" }));
  assert.equal(cleared.length, 0);
});
