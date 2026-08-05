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
import { createEmptySave, recordResult, ALL_GAME_IDS } from "../src/core/storage.ts";
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

/** 从注册表取前 40+ 个真实 game id（保证 recordResult 不会命中不存在的 id）。 */
const ALL_SAMPLE: string[] = ALL_GAME_IDS.slice(0, 40).map((id) => id as string);

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

// ---------- 累计型成就深层覆盖（之前未测的分支） ----------

/** 批量通关若干不同游戏，每个 3 星。 */
function clearGames(
  save: ReturnType<typeof createEmptySave>,
  ids: string[],
  opts: { stars?: number; difficulty?: "easy" | "medium" | "hard" } = {},
): void {
  for (const id of ids) {
    recordResult(save, {
      gameId: id as never,
      cleared: true,
      stars: opts.stars ?? 3,
      difficulty: (opts.difficulty ?? "hard") as never,
    });
  }
}

test("hard-master: 困难通关 10 个不同游戏解锁", () => {
  const save = createEmptySave();
  // 前 9 个不够
  clearGames(save, ALL_SAMPLE.slice(0, 9), { difficulty: "hard" });
  let r = checkMilestoneAchievements(save, tagOf);
  assert.ok(r.includes("hard-clearer"), "1 个困难就解锁 hard-clearer");
  assert.ok(!r.includes("hard-master"), "9 个不够 hard-master");
  // 第 10 个
  clearGames(save, ALL_SAMPLE.slice(9, 10), { difficulty: "hard" });
  r = checkMilestoneAchievements(save, tagOf);
  assert.ok(r.includes("hard-master"), "10 个困难通关应解锁 hard-master");
});

test("collector: 累计 50 颗星解锁（17 个 3 星游戏 = 51 星）", () => {
  const save = createEmptySave();
  clearGames(save, ALL_SAMPLE.slice(0, 17), { stars: 3 });
  const r = checkMilestoneAchievements(save, tagOf);
  assert.ok(r.includes("collector"), "≥50 星应解锁 collector");
});

test("collector: 不足 50 星不解锁", () => {
  const save = createEmptySave();
  clearGames(save, ALL_SAMPLE.slice(0, 16), { stars: 3 }); // 48 星
  const r = checkMilestoneAchievements(save, tagOf);
  assert.ok(!r.includes("collector"), "48 星不应解锁 collector");
});

test("persistent: 同一游戏通关 5 次解锁", () => {
  const save = createEmptySave();
  for (let i = 0; i < 5; i++) {
    recordResult(save, {
      gameId: "color-mixer",
      cleared: true,
      stars: 1,
      difficulty: "easy",
    });
  }
  const r = checkMilestoneAchievements(save, tagOf);
  assert.ok(r.includes("persistent"), "同一游戏 5 次应解锁 persistent");
});

test("persistent: 4 次不解锁", () => {
  const save = createEmptySave();
  for (let i = 0; i < 4; i++) {
    recordResult(save, {
      gameId: "color-mixer",
      cleared: true,
      stars: 1,
      difficulty: "easy",
    });
  }
  const r = checkMilestoneAchievements(save, tagOf);
  assert.ok(!r.includes("persistent"), "4 次不应解锁 persistent");
});

test("explorer: 打开 20 个不同游戏解锁（playCount>0 即算打开）", () => {
  const save = createEmptySave();
  // 只玩不通关也算"打开"
  for (const id of ALL_SAMPLE.slice(0, 20)) {
    recordResult(save, {
      gameId: id as never,
      cleared: false,
      stars: 0,
      difficulty: "easy",
    });
  }
  const r = checkMilestoneAchievements(save, tagOf);
  assert.ok(r.includes("explorer"), "20 个打开应解锁 explorer");
});

test("three-star-15: 15 个游戏拿 3 星解锁", () => {
  const save = createEmptySave();
  clearGames(save, ALL_SAMPLE.slice(0, 15), { stars: 3 });
  const r = checkMilestoneAchievements(save, tagOf);
  assert.ok(r.includes("three-star-15"), "15 个 3 星应解锁 three-star-15");
  assert.ok(r.includes("three-star-5"));
});

test("jack-of-all: 通关覆盖 4 个不同类别解锁", () => {
  const save = createEmptySave();
  // color-mixer=认知, number-monster=数学, pinyin=语言, planet-orbit=科学 → 4 类
  clearGames(save, ["color-mixer", "number-monster", "pinyin", "planet-orbit"], {
    stars: 1,
    difficulty: "easy",
  });
  const r = checkMilestoneAchievements(save, tagOf);
  assert.ok(r.includes("jack-of-all"), "4 类通关应解锁 jack-of-all");
});

test("jack-of-all: 仅 3 类不解锁", () => {
  const save = createEmptySave();
  clearGames(save, ["color-mixer", "number-monster", "pinyin"], {
    stars: 1,
    difficulty: "easy",
  });
  const r = checkMilestoneAchievements(save, tagOf);
  assert.ok(!r.includes("jack-of-all"), "3 类不应解锁 jack-of-all");
});

test("里程碑梯度: 通关 10/20/40 分别解锁对应成就", () => {
  const save10 = createEmptySave();
  clearGames(save10, ALL_SAMPLE.slice(0, 10), { stars: 1 });
  assert.ok(checkMilestoneAchievements(save10, tagOf).includes("cleared-10"));

  const save20 = createEmptySave();
  clearGames(save20, ALL_SAMPLE.slice(0, 20), { stars: 1 });
  assert.ok(checkMilestoneAchievements(save20, tagOf).includes("cleared-20"));

  const save40 = createEmptySave();
  clearGames(save40, ALL_SAMPLE.slice(0, 40), { stars: 1 });
  const r40 = checkMilestoneAchievements(save40, tagOf);
  assert.ok(r40.includes("cleared-40"));
});

// ---------- 成就元数据完整性 ----------

test("ACHIEVEMENTS: 所有成就 id 唯一", () => {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, "成就 id 应唯一");
});

test("ACHIEVEMENTS: 所有成就 name/icon/hint/category 非空", () => {
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.id.length > 0, "缺 id");
    assert.ok(a.name.length > 0, `${a.id} 缺 name`);
    assert.ok(a.icon.length > 0, `${a.id} 缺 icon`);
    assert.ok(a.hint.length > 0, `${a.id} 缺 hint`);
    assert.ok(
      ["milestone", "category", "skill", "hidden"].includes(a.category),
      `${a.id} category 非法: ${a.category}`,
    );
  }
});

test("ACHIEVEMENTS: category 枚举合法 + 隐藏成就标记 hidden", () => {
  for (const a of ACHIEVEMENTS) {
    if (a.category === "hidden") {
      assert.ok(a.hidden === true, `${a.id} 应标 hidden:true`);
    }
  }
});
