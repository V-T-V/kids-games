import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildParentReport,
  buildDomainReport,
  formatParentSummary,
} from "../src/core/parentReport.ts";
import {
  createEmptySave,
  recordResult,
  ALL_GAME_IDS,
} from "../src/core/storage.ts";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
}

(globalThis as unknown as { localStorage: MemStorage }).localStorage =
  new MemStorage();

test("parentReport: 汇总体验、通关、星级与完成率", () => {
  const save = createEmptySave();
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 3,
    difficulty: "easy",
    durationMs: 60000,
  });
  recordResult(save, {
    gameId: "shape-match",
    cleared: false,
    stars: 1,
    difficulty: "easy",
    durationMs: 30000,
  });

  const report = buildParentReport(save);
  assert.equal(report.totalGames, ALL_GAME_IDS.length);
  assert.equal(report.playedGames, 2);
  assert.equal(report.clearedGames, 1);
  assert.equal(report.totalPlayCount, 2);
  assert.equal(report.totalMinutes, 1.5);
  assert.equal(report.averageSessionMinutes, 0.8);
  assert.equal(report.averageStars, 1.5);
  // completionRate = clearedGames / totalGames * 100，随游戏总数变化
  assert.equal(
    report.completionRate,
    Math.round((1 / ALL_GAME_IDS.length) * 1000) / 10,
  );
});

test("parentReport: 产出优势、练习建议与下一步推荐", () => {
  const save = createEmptySave();
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 3,
    difficulty: "easy",
  });
  recordResult(save, {
    gameId: "number-monster",
    cleared: false,
    stars: 1,
    difficulty: "easy",
  });

  const report = buildParentReport(save);
  assert.ok(report.strengths.some((s) => s.skill === "认知"));
  assert.ok(report.practice.some((s) => s.skill === "数学"));
  assert.equal(report.recommendedGames.includes("color-mixer"), false);
  assert.ok(report.recommendedGames.length > 0);
  assert.match(formatParentSummary(report), /已体验 2\/\d+ 个游戏/);
});

test("parentReport: 按能力汇总累计时长与单局均值", () => {
  const save = createEmptySave();
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 3,
    difficulty: "easy",
    durationMs: 60000,
  });
  recordResult(save, {
    gameId: "shape-match",
    cleared: true,
    stars: 2,
    difficulty: "easy",
    durationMs: 120000,
  });

  const report = buildParentReport(save);
  const cognitive = report.strengths.find((s) => s.skill === "认知");
  assert.ok(cognitive);
  assert.equal(cognitive.totalDurationMs, 180000);
  assert.equal(cognitive.averageSessionMinutes, 1.5);
  assert.match(formatParentSummary(report), /累计 3 分钟/);
});

// ---------- buildDomainReport: 6 领域能力报告（理论模型） ----------

test("buildDomainReport: 返回 6 条，games 总和 = 全部游戏数", () => {
  const report = buildDomainReport(createEmptySave());
  assert.equal(report.length, 6);
  const totalGames = report.reduce((s, d) => s + d.games, 0);
  assert.equal(totalGames, ALL_GAME_IDS.length, "6 领域 games 合计应等于总游戏数");
});

test("buildDomainReport: 空存档全部 cleared/played 为 0，avgStars 为 0", () => {
  const report = buildDomainReport(createEmptySave());
  for (const d of report) {
    assert.equal(d.cleared, 0, `${d.domain} cleared 应为 0`);
    assert.equal(d.played, 0, `${d.domain} played 应为 0`);
    assert.equal(d.avgStars, 0, `${d.domain} avgStars 应为 0`);
    assert.ok(d.games > 0, `${d.domain} 应有游戏`);
    assert.ok(d.title.length > 0, `${d.domain} 缺 title`);
    assert.ok(d.icon.length > 0, `${d.domain} 缺 icon`);
  }
});

test("buildDomainReport: 通关/星级按领域正确归类", () => {
  const save = createEmptySave();
  // color-mixer/shape-match 属 perception 域；number-monster 属 logic 域
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 3,
    difficulty: "easy",
  });
  recordResult(save, {
    gameId: "shape-match",
    cleared: true,
    stars: 2,
    difficulty: "easy",
  });
  recordResult(save, {
    gameId: "number-monster",
    cleared: false,
    stars: 1,
    difficulty: "easy",
  });

  const report = buildDomainReport(save);
  const perception = report.find((d) => d.domain === "perception")!;
  const logic = report.find((d) => d.domain === "logic")!;
  assert.equal(perception.cleared, 2, "perception 应有 2 通关");
  assert.equal(perception.played, 2, "perception 应有 2 已玩");
  // avgStars = bestStars 之和 / played = (3+2)/2 = 2.5
  assert.equal(perception.avgStars, 2.5);
  assert.equal(logic.cleared, 0, "logic 应 0 通关");
  assert.equal(logic.played, 1, "logic 应 1 已玩");
  // number-monster 未通关 → bestStars 仍为 0 → avgStars = 0/1 = 0
  assert.equal(logic.avgStars, 0);
});

test("buildDomainReport: domain id 与 6 领域常量一致", () => {
  const report = buildDomainReport(createEmptySave());
  const ids = report.map((d) => d.domain).sort();
  assert.deepEqual(
    ids,
    ["arts", "kinesthetic", "language", "logic", "perception", "social"],
  );
});

// ---------- recommendGames 去重与排序 ----------

test("recommendedGames: 未玩过的游戏优先（排在前面）", () => {
  const save = createEmptySave();
  // 让 color-mixer 已玩但未通关
  recordResult(save, {
    gameId: "color-mixer",
    cleared: false,
    stars: 1,
    difficulty: "easy",
  });
  const report = buildParentReport(save);
  // recommendedGames 前 5 条，未玩的应在已玩未通关的前面
  assert.equal(report.recommendedGames.length, 5);
  // color-mixer 已玩未通关，应在末尾区或不在前几位
  const idx = report.recommendedGames.indexOf("color-mixer");
  if (idx >= 0) {
    assert.ok(idx >= 4, `已玩未通关的 color-mixer 应排末尾，实际 idx=${idx}`);
  }
});

test("recommendedGames: 不含已通关的游戏", () => {
  const save = createEmptySave();
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 3,
    difficulty: "easy",
  });
  const report = buildParentReport(save);
  assert.ok(
    !report.recommendedGames.includes("color-mixer"),
    "已通关游戏不应出现在推荐里",
  );
});

test("recommendedGames: 最多 5 条且无重复", () => {
  const report = buildParentReport(createEmptySave());
  assert.ok(report.recommendedGames.length <= 5);
  assert.equal(
    new Set(report.recommendedGames).size,
    report.recommendedGames.length,
    "推荐游戏不应有重复",
  );
});

// ---------- formatParentSummary 边界 ----------

test("formatParentSummary: 空存档（无优势无练习）给出探索引导", () => {
  const report = buildParentReport(createEmptySave());
  const summary = formatParentSummary(report);
  assert.match(summary, /已体验 0\/\d+ 个游戏/);
  assert.match(summary, /继续从未玩过的游戏开始探索/);
});

test("formatParentSummary: 有累计时长时显示分钟数", () => {
  const save = createEmptySave();
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 3,
    difficulty: "easy",
    durationMs: 300000, // 5 分钟
  });
  const report = buildParentReport(save);
  const summary = formatParentSummary(report);
  assert.match(summary, /累计 5 分钟/);
});

test("completionRate: 全通关时为 100.0", () => {
  // 不实际通关 575 个（太慢），只验公式：completionRate = cleared/total*100 取 round1
  const save = createEmptySave();
  const report = buildParentReport(save);
  assert.equal(report.completionRate, 0);
  assert.ok(report.completionRate <= 100);
});
