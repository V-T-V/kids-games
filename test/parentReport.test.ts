import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildParentReport,
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
