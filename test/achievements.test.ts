/**
 * achievements.ts 测试 —— 里程碑/品类成就检测逻辑
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENTS,
  getAchievementMeta,
  checkMilestoneAchievements,
} from "../src/core/achievements.ts";
import { createEmptySave, recordResult } from "../src/core/storage.ts";
import { LEARN_PATHS } from "../src/learn/paths.ts";

// 提供一个简单的 tag 映射函数
const tagOf = (id: string): string => {
  const tags: Record<string, string> = {
    "color-mixer": "认知·颜色",
    "number-monster": "数学·计数",
    pinyin: "语言·拼音",
    "planet-orbit": "科学·天文",
    snake: "反应·控制",
  };
  return tags[id] ?? "认知·其他";
};

test("ACHIEVEMENTS: 包含足够数量的成就", () => {
  assert.ok(
    ACHIEVEMENTS.length >= 30,
    `成就数应≥30，实际${ACHIEVEMENTS.length}`,
  );
});

test("getAchievementMeta: 已知 id 返回正确元数据", () => {
  const m = getAchievementMeta("first-clear");
  assert.equal(m.id, "first-clear");
  assert.ok(m.name.length > 0);
  assert.ok(m.icon.length > 0);
});

test("getAchievementMeta: 未知 id 返回占位", () => {
  const m = getAchievementMeta("nonexistent");
  assert.equal(m.name, "隐藏成就");
  assert.equal(m.icon, "🎁");
});

test("checkMilestoneAchievements: 1个通关解锁 first-clear", () => {
  const save = createEmptySave();
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 3,
    difficulty: "easy",
  });
  const newAch = checkMilestoneAchievements(save, tagOf);
  assert.ok(newAch.includes("first-clear"));
});

test("checkMilestoneAchievements: 5个通关解锁 cleared-5", () => {
  const save = createEmptySave();
  const ids = [
    "color-mixer",
    "shape-match",
    "number-monster",
    "letter-bee",
    "music-stairs",
  ];
  for (const id of ids) {
    recordResult(save, {
      gameId: id as never,
      cleared: true,
      stars: 2,
      difficulty: "easy",
    });
  }
  const newAch = checkMilestoneAchievements(save, tagOf);
  assert.ok(newAch.includes("cleared-5"));
});

test("checkMilestoneAchievements: 3星达5个解锁 three-star-5", () => {
  const save = createEmptySave();
  const ids = [
    "color-mixer",
    "shape-match",
    "number-monster",
    "letter-bee",
    "music-stairs",
  ];
  for (const id of ids) {
    recordResult(save, {
      gameId: id as never,
      cleared: true,
      stars: 3,
      difficulty: "easy",
    });
  }
  const newAch = checkMilestoneAchievements(save, tagOf);
  assert.ok(newAch.includes("three-star-5"));
});

test("checkMilestoneAchievements: 品类成就（认知≥5）", () => {
  const save = createEmptySave();
  // 5个认知类游戏通关
  for (let i = 0; i < 5; i++) {
    recordResult(save, {
      gameId: "color-mixer" as never,
      cleared: true,
      stars: 1,
      difficulty: "easy",
    });
  }
  // 只通关1次不够，需要5个不同的认知类游戏
  // 改用正确的多游戏
  const save2 = createEmptySave();
  const cogGames = [
    "color-mixer",
    "shape-match",
    "color-reaction",
    "color-sort",
    "color-gradient",
  ];
  for (const id of cogGames) {
    recordResult(save2, {
      gameId: id as never,
      cleared: true,
      stars: 1,
      difficulty: "easy",
    });
  }
  const newAch = checkMilestoneAchievements(save2, tagOf);
  assert.ok(
    newAch.includes("cat-cognition"),
    `应解锁cat-cognition，实际: ${newAch.join(",")}`,
  );
});

test("checkMilestoneAchievements: 重复调用不重复解锁", () => {
  const save = createEmptySave();
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 1,
    difficulty: "easy",
  });
  const first = checkMilestoneAchievements(save, tagOf);
  assert.ok(first.includes("first-clear"));
  const second = checkMilestoneAchievements(save, tagOf);
  assert.ok(!second.includes("first-clear"), "第二次不应重复解锁");
});

test("checkMilestoneAchievements: 100局解锁 centurion", () => {
  const save = createEmptySave();
  for (let i = 0; i < 100; i++) {
    recordResult(save, {
      gameId: "color-mixer",
      cleared: true,
      stars: 1,
      difficulty: "easy",
    });
  }
  const newAch = checkMilestoneAchievements(save, tagOf);
  assert.ok(newAch.includes("centurion"));
});

// —— 学习路径成就 ——
test("checkMilestoneAchievements: 学完启蒙认知路径解锁 path-cognition", () => {
  const save = createEmptySave();
  const path = LEARN_PATHS.find((p) => p.id === "cognition")!;
  for (const gid of path.games) {
    recordResult(save, {
      gameId: gid,
      cleared: true,
      stars: 2,
      difficulty: "easy",
    });
  }
  const newAch = checkMilestoneAchievements(save, tagOf);
  assert.ok(newAch.includes("path-cognition"), "应解锁启蒙认知成就");
  assert.ok(!newAch.includes("path-all"), "未全通关，不应解锁 path-all");
});

test("checkMilestoneAchievements: 差一关不解锁路径成就", () => {
  const save = createEmptySave();
  const path = LEARN_PATHS.find((p) => p.id === "math")!;
  // 只通关 N-1 个
  for (const gid of path.games.slice(0, path.games.length - 1)) {
    recordResult(save, {
      gameId: gid,
      cleared: true,
      stars: 3,
      difficulty: "easy",
    });
  }
  const newAch = checkMilestoneAchievements(save, tagOf);
  assert.ok(!newAch.includes("path-math"), "差一关不应解锁");
});

test("checkMilestoneAchievements: 5 条路径全通关解锁 path-all", () => {
  const save = createEmptySave();
  for (const path of LEARN_PATHS) {
    for (const gid of path.games) {
      recordResult(save, {
        gameId: gid,
        cleared: true,
        stars: 3,
        difficulty: "easy",
      });
    }
  }
  const newAch = checkMilestoneAchievements(save, tagOf);
  assert.ok(newAch.includes("path-cognition"));
  assert.ok(newAch.includes("path-literacy"));
  assert.ok(newAch.includes("path-math"));
  assert.ok(newAch.includes("path-science"));
  assert.ok(newAch.includes("path-review"));
  assert.ok(newAch.includes("path-all"), "5 条全通关应解锁 path-all");
});

test("ACHIEVEMENTS: 包含 6 个学习路径成就", () => {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  for (const id of [
    "path-cognition",
    "path-literacy",
    "path-math",
    "path-science",
    "path-review",
    "path-all",
  ]) {
    assert.ok(ids.includes(id as never), `缺少成就 ${id}`);
  }
});
