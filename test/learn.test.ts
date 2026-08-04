// 学习路径定义的完整性与完成度计算 + 理论模型测试。
import { test } from "node:test";
import assert from "node:assert/strict";
import { GAME_IDS, GAMES } from "../src/games/registry.ts";
import {
  LEARN_PATHS,
  findPath,
  pathClearedCount,
  isPathComplete,
  learnOverallProgress,
} from "../src/learn/paths.ts";
import {
  DOMAINS,
  deriveSkillProfile,
  getSkillProfile,
  domainProgress,
  allDomainProgress,
  cognitiveTierProgress,
  bloomDistribution,
  recommendNextGame,
  type CognitiveTier,
} from "../src/learn/model.ts";
import type { SaveData } from "../src/types.ts";

test("学习路径: 有 5 条路径，id 唯一", () => {
  assert.equal(LEARN_PATHS.length, 5);
  const ids = LEARN_PATHS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "路径 id 应唯一");
});

test("学习路径: 按 stage 升序", () => {
  for (let i = 1; i < LEARN_PATHS.length; i++) {
    assert.ok(
      LEARN_PATHS[i]!.stage > LEARN_PATHS[i - 1]!.stage,
      `第 ${i} 条路径 stage 应大于前一条`,
    );
  }
});

test("学习路径: 每条路径游戏数在合理范围（6-14）", () => {
  for (const path of LEARN_PATHS) {
    assert.ok(
      path.games.length >= 6 && path.games.length <= 14,
      `${path.id} 游戏数 ${path.games.length} 不在 6-14 范围`,
    );
  }
});

test("学习路径: 所有游戏 id 都在 registry 里（无幽灵 id）", () => {
  const regSet = new Set(GAME_IDS as readonly string[]);
  for (const path of LEARN_PATHS) {
    for (const gid of path.games) {
      assert.ok(
        regSet.has(gid as never),
        `路径 ${path.id} 的游戏 ${gid} 不在 registry`,
      );
    }
  }
});

test("学习路径: 路径内游戏 id 无重复", () => {
  for (const path of LEARN_PATHS) {
    const set = new Set(path.games as readonly string[]);
    assert.equal(
      set.size,
      path.games.length,
      `路径 ${path.id} 内有重复游戏 id`,
    );
  }
});

test("findPath: 按 id 查得到，未知 id 返回 undefined", () => {
  assert.equal(findPath("math")?.title, "数学思维");
  assert.equal(findPath("nope"), undefined);
});

/** 构造一份 mock save：指定哪些游戏 cleared。 */
function mockSave(clearedIds: Set<string>): SaveData {
  const progress = {} as SaveData["progress"];
  for (const id of GAME_IDS) {
    progress[id] = {
      bestDifficulty: null,
      bestStars: 0,
      playCount: 0,
      totalDurationMs: 0,
      cleared: clearedIds.has(id as string),
      lastResult: null,
      recentResults: [],
    };
  }
  return {
    version: 1,
    progress,
    achievements: [],
    settings: { muted: false, lockedDifficulty: null, restShield: true },
  };
}

test("pathClearedCount: 只统计路径内已通关游戏", () => {
  const math = findPath("math")!;
  const cleared = new Set<string>([
    math.games[0] as string,
    math.games[1] as string,
  ]);
  assert.equal(pathClearedCount(math, mockSave(cleared)), 2);
  assert.equal(pathClearedCount(math, mockSave(new Set())), 0);
});

test("isPathComplete: 全通关才为 true", () => {
  const cognition = findPath("cognition")!;
  // 全通关
  const allCleared = new Set(cognition.games as readonly string[]);
  assert.equal(isPathComplete(cognition, mockSave(allCleared)), true);
  // 差一个
  const almost = new Set(cognition.games.slice(1) as readonly string[]);
  assert.equal(isPathComplete(cognition, mockSave(almost)), false);
});

test("learnOverallProgress: 汇总去重后的通关游戏数", () => {
  const math = findPath("math")!;
  const lit = findPath("literacy")!;
  const cleared = new Set<string>([
    ...(math.games.slice(0, 3) as string[]),
    ...(lit.games.slice(0, 2) as string[]),
  ]);
  const save = mockSave(cleared);
  const r = learnOverallProgress(save);
  // 去重后的通关数（跨路径重复游戏只算一次）
  assert.equal(r.cleared, cleared.size);
  // 去重后的总游戏数
  const allDistinct = new Set<string>();
  for (const p of LEARN_PATHS)
    for (const g of p.games) allDistinct.add(g as string);
  assert.equal(r.total, allDistinct.size);
});

// ============ 理论模型测试 ============

test("理论模型: DOMAINS 有 6 个领域", () => {
  assert.equal(DOMAINS.length, 6);
  const ids = DOMAINS.map((d) => d.id);
  assert.equal(new Set(ids).size, 6, "领域 id 唯一");
});

test("理论模型: 全部 575 游戏都能派生 SkillProfile", () => {
  for (const g of GAMES) {
    const p = deriveSkillProfile(g.tag);
    assert.ok(p.domain, `${g.id} 缺 domain`);
    assert.ok(p.cognitiveTier, `${g.id} 缺 cognitiveTier`);
    assert.ok(p.bloomLevel, `${g.id} 缺 bloomLevel`);
  }
});

test("理论模型: tag→domain 映射覆盖所有 top-level tag", () => {
  const topTags = new Set(GAMES.map((g) => g.tag.split("·")[0]!));
  for (const tag of topTags) {
    const p = deriveSkillProfile(tag + "·测试");
    assert.ok(
      [
        "perception",
        "language",
        "logic",
        "kinesthetic",
        "arts",
        "social",
      ].includes(p.domain),
      `tag "${tag}" 的 domain "${p.domain}" 不在 6 领域内`,
    );
  }
});

test("理论模型: 运算类 tag → apply，创作类 → create", () => {
  assert.equal(deriveSkillProfile("数学·运算").bloomLevel, "apply");
  assert.equal(deriveSkillProfile("艺术·涂色").bloomLevel, "create");
  assert.equal(deriveSkillProfile("认知·颜色").bloomLevel, "remember");
  assert.equal(deriveSkillProfile("认知·分类").bloomLevel, "understand");
});

test("理论模型: getSkillProfile 有缓存（同 id 返回同对象）", () => {
  const a = getSkillProfile("color-mixer");
  const b = getSkillProfile("color-mixer");
  assert.equal(a, b, "缓存应返回同一对象");
});

test("理论模型: domainProgress 统计正确", () => {
  const save = mockSave(new Set());
  for (const d of DOMAINS) {
    const r = domainProgress(d.id, save);
    assert.ok(r.total > 0, `领域 ${d.id} 应有游戏`);
    assert.equal(r.cleared, 0, "空存档应 0 通关");
  }
});

test("理论模型: allDomainProgress 返回 6 条", () => {
  const r = allDomainProgress(mockSave(new Set()));
  assert.equal(r.length, 6);
});

test("理论模型: cognitiveTierProgress 3 层都有游戏", () => {
  const save = mockSave(new Set());
  const tiers: CognitiveTier[] = [
    "perceptual",
    "representational",
    "operational",
  ];
  for (const t of tiers) {
    const r = cognitiveTierProgress(t, save);
    assert.ok(r.total > 0, `层次 ${t} 应有游戏`);
  }
});

test("理论模型: bloomDistribution 4 级合计 = 575", () => {
  const dist = bloomDistribution(mockSave(new Set()));
  const total =
    dist.remember.total +
    dist.understand.total +
    dist.apply.total +
    dist.create.total;
  assert.equal(total, GAME_IDS.length, "4 级 bloom 合计应等于总游戏数");
});

test("理论模型: recommendNextGame 空存档返回一个未通关游戏", () => {
  const save = mockSave(new Set());
  const rec = recommendNextGame(save);
  assert.ok(rec, "应返回推荐游戏");
  assert.ok(GAME_IDS.includes(rec as never), "推荐游戏应在 registry 内");
});
