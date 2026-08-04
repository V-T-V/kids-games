// 自适应难度单测：升/降/保持/锁定优先/边界。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bumpDown,
  bumpUp,
  resolveDifficulty,
  suggestDifficulty,
} from "../src/core/adaptive.ts";
import type { Difficulty, GameResult } from "../src/types.ts";

function result(
  difficulty: Difficulty,
  cleared: boolean,
  stars: number,
): GameResult {
  return {
    gameId: "memory-flip",
    cleared,
    stars,
    difficulty,
    durationMs: 1000,
  };
}

test("bumpUp / bumpDown 边界", () => {
  assert.equal(bumpUp("easy"), "medium");
  assert.equal(bumpUp("medium"), "hard");
  assert.equal(bumpUp("hard"), "hard"); // 已最高
  assert.equal(bumpDown("hard"), "medium");
  assert.equal(bumpDown("medium"), "easy");
  assert.equal(bumpDown("easy"), "easy"); // 已最低
});

test("不足 2 局时保持当前档", () => {
  assert.equal(suggestDifficulty("easy", []), "easy");
  assert.equal(
    suggestDifficulty("medium", [result("medium", true, 3)]),
    "medium",
  );
});

test("连续 2 局 3 星通关 → 升档", () => {
  const recent = [result("easy", true, 3), result("easy", true, 3)];
  assert.equal(suggestDifficulty("easy", recent), "medium");
});

test("已最高档连续满分 → 保持 hard", () => {
  const recent = [result("hard", true, 3), result("hard", true, 3)];
  assert.equal(suggestDifficulty("hard", recent), "hard");
});

test("连续 2 局未通关 → 降档", () => {
  const recent = [result("hard", false, 0), result("hard", false, 1)];
  assert.equal(suggestDifficulty("hard", recent), "medium");
});

test("连续 2 局 1 星（即便通关）→ 降档", () => {
  const recent = [result("medium", true, 1), result("medium", true, 1)];
  assert.equal(suggestDifficulty("medium", recent), "easy");
});

test("已最低档连续差 → 保持 easy", () => {
  const recent = [result("easy", false, 0), result("easy", false, 0)];
  assert.equal(suggestDifficulty("easy", recent), "easy");
});

test("一好一差 → 保持当前档", () => {
  const recent = [result("medium", true, 3), result("medium", false, 1)];
  assert.equal(suggestDifficulty("medium", recent), "medium");
});

test("只在最近 2 局看（更早的不影响）", () => {
  // 前面 3 局全差，最近 2 局全满分 → 升档
  const recent = [
    result("easy", false, 0),
    result("easy", false, 0),
    result("easy", false, 0),
    result("easy", true, 3),
    result("easy", true, 3),
  ];
  assert.equal(suggestDifficulty("easy", recent), "medium");
});

test("升档要求「在该档」——跨档不触发", () => {
  // 两局满分但一局 easy 一局 medium → 不满足「都在当前档(easy)」
  const recent = [result("easy", true, 3), result("medium", true, 3)];
  assert.equal(suggestDifficulty("easy", recent), "easy");
});

// ---------- resolveDifficulty 优先级 ----------

test("家长锁定优先于自适应", () => {
  const recent = [result("easy", true, 3), result("easy", true, 3)]; // 本应升 medium
  assert.equal(resolveDifficulty("hard", recent, "easy"), "hard");
});

test("无锁定时走自适应", () => {
  const recent = [result("easy", true, 3), result("easy", true, 3)];
  assert.equal(resolveDifficulty(null, recent, "easy"), "medium");
});

test("无锁定无近局 → 用 bestDifficulty 当基线", () => {
  assert.equal(resolveDifficulty(null, [], "medium"), "medium");
  assert.equal(resolveDifficulty(null, [], null), "easy");
});
