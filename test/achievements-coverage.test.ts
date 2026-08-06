// 成就分类映射与自适应难度边界单测（D5）。
// 重点：registry 出现的每个 tag 大类前缀都应在 CATEGORY_ACHIEVEMENT_MAP 中有映射，
// 否则该类游戏通关不会触发任何品类成就（覆盖盲区）。这是发现回归的关键守护。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENTS,
  CATEGORY_ACHIEVEMENT_MAP,
  tagToCategory,
  getAchievementMeta,
  checkMilestoneAchievements,
} from "../src/core/achievements.ts";
import { GAMES } from "../src/games/registry.ts";
import { suggestDifficulty } from "../src/core/adaptive.ts";
import {
  createEmptySave,
  recordResult,
  ALL_GAME_IDS,
} from "../src/core/storage.ts";
import type { Difficulty, GameResult } from "../src/types.ts";

function result(d: Difficulty, cleared: boolean, stars: number): GameResult {
  return { gameId: "memory-flip", cleared, stars, difficulty: d, durationMs: 1 };
}

/** 提供简单 tag 映射（与 achievements.test.ts 同款，认知类兜底）。 */
const tagOf = (id: string): string => "认知·其他";

/** 批量通关若干不同游戏。 */
function clearGames(
  save: ReturnType<typeof createEmptySave>,
  ids: string[],
  opts: { stars?: number; difficulty?: "easy" | "medium" | "hard" } = {},
): void {
  for (const id of ids) {
    recordResult(save, {
      gameId: id as never,
      cleared: true,
      stars: opts.stars ?? 1,
      difficulty: (opts.difficulty ?? "easy") as never,
    });
  }
}

test("tagToCategory: 取「·」前的大类", () => {
  assert.equal(tagToCategory("认知·颜色"), "认知");
  assert.equal(tagToCategory("数学·运算"), "数学");
  assert.equal(tagToCategory("反应·协调"), "反应");
});

test("tagToCategory: 无「·」返回原串", () => {
  assert.equal(tagToCategory("认知"), "认知");
  assert.equal(tagToCategory("生活"), "生活");
});

test("CATEGORY_ACHIEVEMENT_MAP: 每个 value 指向真实存在的品类成就", () => {
  const validIds = new Set(ACHIEVEMENTS.map((a) => a.id));
  for (const [cat, achId] of Object.entries(CATEGORY_ACHIEVEMENT_MAP)) {
    assert.ok(
      validIds.has(achId),
      `大类「${cat}」映射到不存在的成就 ${achId}`,
    );
  }
});

test("【关键】registry 的每个 tag 大类前缀都在 CATEGORY_ACHIEVEMENT_MAP 中有映射", () => {
  const prefixes = new Set(GAMES.map((g) => tagToCategory(g.tag)));
  const mapped = new Set(Object.keys(CATEGORY_ACHIEVEMENT_MAP));
  const unmapped = [...prefixes].filter((p) => !mapped.has(p));
  assert.deepEqual(
    unmapped,
    [],
    `以下 tag 大类没有品类成就映射（覆盖盲区）：${unmapped.join(", ")}`,
  );
});

// 取所有 cat-* 品类成就 id（辅助）
function categoryAchievementIds(): string[] {
  return ACHIEVEMENTS.filter((a) => a.category === "category").map((a) => a.id);
}

test("【关键】每个品类成就至少被一个 registry 大类映射到", () => {
  // 防止 CAT_MAP 删了某映射但成就仍存在，或反之
  const catAchIds = new Set(categoryAchievementIds());
  const mappedValues = new Set(Object.values(CATEGORY_ACHIEVEMENT_MAP));
  const orphan = [...catAchIds].filter((id) => !mappedValues.has(id));
  assert.deepEqual(
    orphan,
    [],
    `以下品类成就没有任何 tag 大类映射到它：${orphan.join(", ")}`,
  );
});

test("品类成就共 8 个（认知/数学/语言/科学/动作/社交/艺术/生活）", () => {
  const cats = ACHIEVEMENTS.filter((a) => a.category === "category");
  assert.equal(cats.length, 8);
});

test("getAchievementMeta: 所有品类成就 category='category'", () => {
  for (const id of categoryAchievementIds()) {
    assert.equal(getAchievementMeta(id).category, "category");
  }
});

// ---------- 自适应难度补充边界 ----------

test("suggestDifficulty: 混合表现（一升一降条件都不满足）保持当前", () => {
  // 一局满分一局未通关 → 既不全 perfect 也不全 poor
  const recent = [result("easy", true, 3), result("easy", false, 0)];
  assert.equal(suggestDifficulty("easy", recent), "easy");
});

test("suggestDifficulty: 升档要求两局都在当前档（跨档不算）", () => {
  // 第一局 medium 满分，第二局 easy 满分，current=easy → 不升（第一局非 easy）
  const recent = [result("medium", true, 3), result("easy", true, 3)];
  assert.equal(suggestDifficulty("easy", recent), "easy");
});

test("suggestDifficulty: 2 星通关不触发升档（需 3 星）也不触发降档（需 1 星/未通关）", () => {
  const recent = [result("easy", true, 2), result("easy", true, 2)];
  assert.equal(suggestDifficulty("easy", recent), "easy");
});

test("suggestDifficulty: 最近 3 局只看最后 2 局（更早的不影响）", () => {
  // 前一局未通关，后两局满分 → 升档
  const recent = [
    result("easy", false, 0),
    result("easy", true, 3),
    result("easy", true, 3),
  ];
  assert.equal(suggestDifficulty("easy", recent), "medium");
});

test("suggestDifficulty: 降档要求 current 非 easy", () => {
  // current=easy 连续两局 1 星 → 已最低，不降
  const recent = [result("easy", true, 1), result("easy", true, 1)];
  assert.equal(suggestDifficulty("easy", recent), "easy");
});

test("suggestDifficulty: 一局通关一局未通关（非全 poor）不降档", () => {
  const recent = [result("medium", true, 3), result("medium", false, 0)];
  assert.equal(suggestDifficulty("medium", recent), "medium");
});

test("suggestDifficulty: 空 recent 数组保持当前", () => {
  for (const d of ["easy", "medium", "hard"] as const) {
    assert.equal(suggestDifficulty(d, []), d);
  }
});

// ---------- 里程碑梯度细化（D7：40→575 之间补 80/200 两档） ----------

test("里程碑成就梯度: 1/5/10/20/40/80/200/all 全部存在", () => {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  for (const id of [
    "first-clear",
    "cleared-5",
    "cleared-10",
    "cleared-20",
    "cleared-40",
    "cleared-80",
    "cleared-200",
    "all-clear",
  ]) {
    assert.ok(ids.has(id as never), `缺里程碑成就 ${id}`);
  }
});

test("里程碑成就梯度: 通关 80 个解锁 cleared-80（40 不够）", () => {
  const save40 = createEmptySave();
  clearGames(save40, ALL_SAMPLE_80().slice(0, 40), { stars: 1 });
  const r40 = checkMilestoneAchievements(save40, tagOf);
  assert.ok(r40.includes("cleared-40"));
  assert.ok(!r40.includes("cleared-80"), "40 个不应解锁 cleared-80");

  const save80 = createEmptySave();
  clearGames(save80, ALL_SAMPLE_80().slice(0, 80), { stars: 1 });
  const r80 = checkMilestoneAchievements(save80, tagOf);
  assert.ok(r80.includes("cleared-80"), "80 个应解锁 cleared-80");
});

test("里程碑成就梯度: 通关 200 个解锁 cleared-200", () => {
  const save = createEmptySave();
  clearGames(save, ALL_SAMPLE_80().slice(0, 200), { stars: 1 });
  const r = checkMilestoneAchievements(save, tagOf);
  assert.ok(r.includes("cleared-200"), "200 个应解锁 cleared-200");
  assert.ok(r.includes("cleared-80"));
});

test("里程碑成就梯度单调：低档解锁时高档可能未解锁（不跳档）", () => {
  const save = createEmptySave();
  clearGames(save, ALL_SAMPLE_80().slice(0, 50), { stars: 1 });
  const r = checkMilestoneAchievements(save, tagOf);
  assert.ok(r.includes("cleared-40"));
  assert.ok(!r.includes("cleared-80"));
  assert.ok(!r.includes("cleared-200"));
});

test("里程碑成就: cleared-80/200 category=milestone 且元数据完整", () => {
  for (const id of ["cleared-80", "cleared-200"]) {
    const m = getAchievementMeta(id);
    assert.equal(m.category, "milestone");
    assert.ok(m.name.length > 0, `${id} 缺 name`);
    assert.ok(m.icon.length > 0, `${id} 缺 icon`);
    assert.ok(m.hint.length > 0, `${id} 缺 hint`);
  }
});

// 取至少 200 个真实 game id（registry 有 575，足够）
function ALL_SAMPLE_80(): string[] {
  return ALL_GAME_IDS.slice(0, 200).map((id) => id as string);
}
