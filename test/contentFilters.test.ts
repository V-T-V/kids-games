// contentFilters 单测：此前零测试的大厅内容过滤系统（儿童安全关键路径）。
// 覆盖 filterGames 全部筛选维度（分类/年龄/时长/完成度/搜索）+ categoryOf/parseAgeRange/
// discoveryMeta + 拼音首字母搜索 + 儿童安全防御（空数组/null 进度/非法年龄回退默认区间）。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categoryOf,
  discoveryMeta,
  filterGames,
  parseAgeRange,
} from "../src/lobby/contentFilters.ts";
import type { GameMeta } from "../src/types.ts";

/** 构造一个最小可用 GameMeta（其余字段默认）。 */
function mk(partial: Partial<GameMeta>): GameMeta {
  return {
    id: "color-mixer",
    title: "色彩调配师",
    subtitle: "认识颜色",
    icon: "🎨",
    theme: "--c-pink",
    age: "3-6 岁",
    tag: "艺术·调配",
    ...partial,
  };
}

const GAMES: GameMeta[] = [
  mk({ id: "color-mixer", title: "色彩调配师", subtitle: "认识颜色混合", age: "3-6 岁", tag: "艺术·调配", icon: "🎨" }),
  mk({ id: "number-monster", title: "数字怪兽", subtitle: "数学启蒙", age: "4-6 岁", tag: "数学·数数", icon: "🔢" }),
  mk({ id: "maze-adventure", title: "迷宫探险", subtitle: "逻辑推理", age: "5-6 岁", tag: "逻辑·策略", icon: "🗺️" }),
  mk({ id: "memory-flip", title: "记忆翻翻乐", subtitle: "训练记忆", age: "3-4 岁", tag: "记忆·配对", icon: "🃏" }),
];

// —— categoryOf ——

test("categoryOf: 取 tag 首段作为分类", () => {
  assert.equal(categoryOf("艺术·调配"), "艺术");
  assert.equal(categoryOf("数学·数数"), "数学");
});

test("categoryOf: tag 无分隔符返回整体", () => {
  assert.equal(categoryOf("艺术"), "艺术");
  assert.equal(categoryOf("反应"), "反应");
});

test("categoryOf: 空字符串回退默认「其他」", () => {
  assert.equal(categoryOf(""), "其他");
});

// —— parseAgeRange ——

test("parseAgeRange: 标准文案解析为 [min, max]", () => {
  assert.deepEqual(parseAgeRange("3-6 岁"), [3, 6]);
  assert.deepEqual(parseAgeRange("4-5 岁"), [4, 5]);
});

test("parseAgeRange: 文案前后空格也能解析（.trim）", () => {
  assert.deepEqual(parseAgeRange("  3-6 岁  "), [3, 6]);
});

test("parseAgeRange: 非法/空文案回退默认 [3,6]（儿童安全兜底）", () => {
  assert.deepEqual(parseAgeRange(""), [3, 6]);
  assert.deepEqual(parseAgeRange("乱码"), [3, 6]);
  assert.deepEqual(parseAgeRange("3-6岁"), [3, 6], "无空格也不匹配");
});

test("parseAgeRange: 单一年龄不匹配（要求区间格式）", () => {
  assert.deepEqual(parseAgeRange("3 岁"), [3, 6], "非 a-b 格式回退默认");
});

// —— discoveryMeta ——

test("discoveryMeta: 汇总分类/年龄/估算时长", () => {
  const m = discoveryMeta(mk({ age: "3-6 岁", tag: "艺术·调配" }));
  assert.equal(m.category, "艺术");
  assert.equal(m.ageMin, 3);
  assert.equal(m.ageMax, 6);
  assert.equal(typeof m.estimatedMinutes, "number");
  assert.ok(m.estimatedMinutes > 0, "估算时长应为正数");
});

test("discoveryMeta: 3-5 岁起年龄段估算 4 分钟", () => {
  const m = discoveryMeta(mk({ age: "3-5 岁", tag: "艺术·调配" }));
  assert.equal(m.estimatedMinutes, 4);
});

test("discoveryMeta: 数学类估算 8 分钟", () => {
  const m = discoveryMeta(mk({ age: "4-6 岁", tag: "数学·数数" }));
  assert.equal(m.estimatedMinutes, 8);
});

test("discoveryMeta: 逻辑/策略/编程估算 10 分钟", () => {
  assert.equal(discoveryMeta(mk({ tag: "逻辑·策略" })).estimatedMinutes, 10);
  assert.equal(discoveryMeta(mk({ tag: "科技·编程" })).estimatedMinutes, 10);
});

test("discoveryMeta: 反应/协调估算 5 分钟", () => {
  assert.equal(discoveryMeta(mk({ tag: "反应·快" })).estimatedMinutes, 5);
});

test("discoveryMeta: 艺术/创造估算 7 分钟", () => {
  assert.equal(discoveryMeta(mk({ tag: "艺术·创造" })).estimatedMinutes, 7);
});

test("discoveryMeta: 其它分类默认估算 6 分钟", () => {
  assert.equal(discoveryMeta(mk({ tag: "其它·杂项" })).estimatedMinutes, 6);
});

// —— filterGames: 分类 ——

test("filterGames: category=全部 不按分类筛", () => {
  const out = filterGames(GAMES, {}, { category: "全部", completion: "all", age: "all", duration: "all", searchTerm: "" });
  assert.equal(out.length, GAMES.length);
});

test("filterGames: category 按分类精确过滤", () => {
  const out = filterGames(GAMES, {}, { category: "数学", completion: "all", age: "all", duration: "all", searchTerm: "" });
  assert.equal(out.length, 1);
  assert.equal(out[0]!.id, "number-monster");
});

test("filterGames: category 不匹配返回空", () => {
  const out = filterGames(GAMES, {}, { category: "音乐", completion: "all", age: "all", duration: "all", searchTerm: "" });
  assert.equal(out.length, 0);
});

// —— filterGames: 年龄 ——

test("filterGames: age=4 返回年龄区间含 4 的游戏", () => {
  const out = filterGames(GAMES, {}, { category: "全部", completion: "all", age: "4", duration: "all", searchTerm: "" });
  const ids = out.map((g) => g.id).sort();
  // color-mixer(3-6)/number-monster(4-6)/maze-adventure(5-6 不含4)/memory-flip(3-4)
  assert.deepEqual(ids, ["color-mixer", "memory-flip", "number-monster"]);
});

test("filterGames: age=5 返回年龄区间含 5 的游戏（maze 5-6 入选）", () => {
  const out = filterGames(GAMES, {}, { category: "全部", completion: "all", age: "5", duration: "all", searchTerm: "" });
  const ids = out.map((g) => g.id).sort();
  assert.deepEqual(ids, ["color-mixer", "maze-adventure", "number-monster"]);
});

test("filterGames: age=all 不按年龄筛", () => {
  const out = filterGames(GAMES, {}, { category: "全部", completion: "all", age: "all", duration: "all", searchTerm: "" });
  assert.equal(out.length, GAMES.length);
});

// —— filterGames: 完成度 ——

test("filterGames: completion=uncleared 排除已通关", () => {
  const progress = { "color-mixer": { cleared: true }, "number-monster": { cleared: true } };
  const out = filterGames(GAMES, progress, { category: "全部", completion: "uncleared", age: "all", duration: "all", searchTerm: "" });
  const ids = out.map((g) => g.id).sort();
  assert.deepEqual(ids, ["maze-adventure", "memory-flip"]);
});

test("filterGames: completion=cleared 只留已通关", () => {
  const progress = { "color-mixer": { cleared: true } };
  const out = filterGames(GAMES, progress, { category: "全部", completion: "cleared", age: "all", duration: "all", searchTerm: "" });
  assert.deepEqual(out.map((g) => g.id), ["color-mixer"]);
});

test("filterGames: completion=cleared 进度记录缺失视为未通关被排除", () => {
  const out = filterGames(GAMES, {}, { category: "全部", completion: "cleared", age: "all", duration: "all", searchTerm: "" });
  assert.equal(out.length, 0, "无任何通关记录时 cleared 过滤应返回空");
});

test("filterGames: completion=all 不按完成度筛", () => {
  const progress = { "color-mixer": { cleared: true } };
  const out = filterGames(GAMES, progress, { category: "全部", completion: "all", age: "all", duration: "all", searchTerm: "" });
  assert.equal(out.length, GAMES.length);
});

// —— filterGames: 时长 ——

test("filterGames: duration=short 时长<=5 分钟", () => {
  const games = [
    // age "3-5 岁" → startsWith("3-5") → 估算 4 分钟（short）
    mk({ id: "fruit-catch", age: "3-5 岁", tag: "其它·杂项" }),
    // 数学 → 估算 8 分钟（非 short）
    mk({ id: "number-monster", age: "4-6 岁", tag: "数学·数数" }),
  ];
  const out = filterGames(games, {}, { category: "全部", completion: "all", age: "all", duration: "short", searchTerm: "" });
  assert.deepEqual(out.map((g) => g.id), ["fruit-catch"]);
});

test("filterGames: duration=long 时长>8 分钟", () => {
  const games = [
    mk({ id: "maze-adventure", age: "5-6 岁", tag: "逻辑·策略" }), // 逻辑 → 10 分钟（long）
    mk({ id: "number-monster", age: "4-6 岁", tag: "数学·数数" }), // 数学 → 8 分钟（非 long）
  ];
  const out = filterGames(games, {}, { category: "全部", completion: "all", age: "all", duration: "long", searchTerm: "" });
  assert.deepEqual(out.map((g) => g.id), ["maze-adventure"]);
});

// —— filterGames: 搜索 ——

test("filterGames: searchTerm 标题包含命中", () => {
  const out = filterGames(GAMES, {}, { category: "全部", completion: "all", age: "all", duration: "all", searchTerm: "怪兽" });
  assert.deepEqual(out.map((g) => g.id), ["number-monster"]);
});

test("filterGames: searchTerm 拼音首字母命中（se 匹配色彩）", () => {
  const out = filterGames(GAMES, {}, { category: "全部", completion: "all", age: "all", duration: "all", searchTerm: "se" });
  assert.deepEqual(out.map((g) => g.id), ["color-mixer"], "se 应匹配「色彩调配师」");
});

test("filterGames: searchTerm 拼音音节命中（shu 匹配「数」字）", () => {
  // pinyinIndex 把「数」映射为 shu，subtitle「数学启蒙」含「数」→ 含 shu
  const out = filterGames(GAMES, {}, { category: "全部", completion: "all", age: "all", duration: "all", searchTerm: "shu" });
  assert.ok(out.some((g) => g.id === "number-monster"), "shu 应通过 subtitle「数学启蒙」的「数」命中数字怪兽");
});

test("filterGames: searchTerm icon emoji 精确匹配", () => {
  const out = filterGames(GAMES, {}, { category: "全部", completion: "all", age: "all", duration: "all", searchTerm: "🗺️" });
  assert.deepEqual(out.map((g) => g.id), ["maze-adventure"]);
});

test("filterGames: searchTerm 前后空格被 trim", () => {
  const out = filterGames(GAMES, {}, { category: "全部", completion: "all", age: "all", duration: "all", searchTerm: "  怪兽  " });
  assert.deepEqual(out.map((g) => g.id), ["number-monster"]);
});

test("filterGames: searchTerm 大小写不敏感（SE 等价 se）", () => {
  const out = filterGames(GAMES, {}, { category: "全部", completion: "all", age: "all", duration: "all", searchTerm: "SE" });
  assert.deepEqual(out.map((g) => g.id), ["color-mixer"]);
});

test("filterGames: searchTerm 无匹配返回空", () => {
  const out = filterGames(GAMES, {}, { category: "全部", completion: "all", age: "all", duration: "all", searchTerm: "不存在的词zzz" });
  assert.equal(out.length, 0);
});

test("filterGames: searchTerm 命中年龄文案（4-6 岁含「4」）", () => {
  const out = filterGames(GAMES, {}, { category: "全部", completion: "all", age: "all", duration: "all", searchTerm: "4-6" });
  assert.ok(out.some((g) => g.id === "number-monster"), "应通过 age 文案匹配到 4-6 岁游戏");
});

// —— filterGames: 儿童安全防御 ——

test("filterGames: 空游戏数组返回空（不抛错）", () => {
  const out = filterGames([], {}, { category: "全部", completion: "all", age: "all", duration: "all", searchTerm: "" });
  assert.deepEqual(out, []);
});

test("filterGames: progress 为 null 视为全部未通关（不抛错）", () => {
  const out = filterGames(GAMES, null as unknown as Record<string, { cleared: boolean }>, { category: "全部", completion: "cleared", age: "all", duration: "all", searchTerm: "" });
  assert.equal(out.length, 0, "null progress + cleared 应返回空而非抛错");
});

test("filterGames: 多筛选维度叠加（数学 + 年龄4）", () => {
  const out = filterGames(GAMES, {}, { category: "数学", completion: "all", age: "4", duration: "all", searchTerm: "" });
  assert.deepEqual(out.map((g) => g.id), ["number-monster"]);
});

test("filterGames: 多维度叠加互斥返回空（数学 + 年龄3 但数学是4-6）", () => {
  const out = filterGames(GAMES, {}, { category: "数学", completion: "all", age: "3", duration: "all", searchTerm: "" });
  assert.equal(out.length, 0, "number-monster 是 4-6 岁，年龄 3 筛不掉应返回空");
});

test("filterGames: 不修改原数组（纯函数不可变）", () => {
  const snapshot = GAMES.map((g) => ({ ...g }));
  filterGames(GAMES, {}, { category: "数学", completion: "all", age: "all", duration: "all", searchTerm: "" });
  assert.deepEqual(GAMES, snapshot, "原数组不应被修改");
});
