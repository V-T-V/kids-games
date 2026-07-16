/**
 * 存档系统测试。
 *
 * storage.ts 内部函数在调用时才访问全局 localStorage（非模块加载时），
 * 因此只需在测试前替换 globalThis.localStorage，模块顶层 import 一次即可。
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadSave,
  createEmptySave,
  recordResult,
  unlockAchievement,
  allCleared,
  countCleared,
  updateSettings,
  resetSave,
  ALL_GAME_IDS,
} from "../src/core/storage.ts";

// 内存 localStorage 替身
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage =
    new MemStorage();
});

test("createEmptySave: 包含全部游戏的空进度", () => {
  const save = createEmptySave();
  assert.equal(Object.keys(save.progress).length, ALL_GAME_IDS.length);
  for (const id of Object.keys(save.progress)) {
    const p = save.progress[id as keyof typeof save.progress];
    assert.equal(p.cleared, false);
    assert.equal(p.bestStars, 0);
    assert.equal(p.bestDifficulty, null);
    assert.equal(p.totalDurationMs, 0);
  }
});

test("loadSave: 空存档返回默认结构", () => {
  const save = loadSave();
  assert.equal(save.version, 1);
  assert.equal(save.settings.muted, false);
  assert.equal(save.settings.restShield, true);
});

test("recordResult: 通关后更新进度", () => {
  const save = loadSave();
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 3,
    difficulty: "easy",
    durationMs: 42000,
  });
  const p = save.progress["color-mixer"];
  assert.equal(p.cleared, true);
  assert.equal(p.bestStars, 3);
  assert.equal(p.bestDifficulty, "easy");
  assert.equal(p.playCount, 1);
  assert.equal(p.totalDurationMs, 42000);
});

test("recordResult: 取最高难度与最高星", () => {
  const save = loadSave();
  recordResult(save, {
    gameId: "maze-adventure",
    cleared: true,
    stars: 2,
    difficulty: "easy",
  });
  recordResult(save, {
    gameId: "maze-adventure",
    cleared: true,
    stars: 1,
    difficulty: "hard",
  });
  const p = save.progress["maze-adventure"];
  assert.equal(p.bestDifficulty, "hard");
  assert.equal(p.bestStars, 2);
  assert.equal(p.playCount, 2);
});

test("recordResult: 未通关不计入 bestDifficulty", () => {
  const save = loadSave();
  recordResult(save, {
    gameId: "shape-match",
    cleared: false,
    stars: 0,
    difficulty: "medium",
  });
  const p = save.progress["shape-match"];
  assert.equal(p.cleared, false);
  assert.equal(p.bestDifficulty, null);
  assert.equal(p.bestStars, 0);
  assert.equal(p.playCount, 1);
});

test("unlockAchievement: 去重并返回是否新解锁", () => {
  const save = loadSave();
  assert.equal(unlockAchievement(save, "first-clear"), true);
  assert.equal(unlockAchievement(save, "first-clear"), false);
  assert.equal(save.achievements.length, 1);
});

test("countCleared / allCleared: 统计通关数", () => {
  const save = loadSave();
  // 通关除最后一个外的全部游戏
  const all = ALL_GAME_IDS;
  const partial = all.slice(0, -1);
  for (const id of partial) {
    recordResult(save, {
      gameId: id,
      cleared: true,
      stars: 1,
      difficulty: "easy",
    });
  }
  assert.equal(countCleared(save), partial.length);
  assert.equal(allCleared(save), false);
  // 通关最后一个 → 全清
  recordResult(save, {
    gameId: all[all.length - 1]!,
    cleared: true,
    stars: 1,
    difficulty: "easy",
  });
  assert.equal(countCleared(save), all.length);
  assert.equal(allCleared(save), true);
});

test("updateSettings: 持久化设置", () => {
  const save = loadSave();
  updateSettings(save, { muted: true, lockedDifficulty: "hard" });
  assert.equal(save.settings.muted, true);
  assert.equal(save.settings.lockedDifficulty, "hard");
});

test("resetSave: 清空所有进度但保留设置结构", () => {
  let save = loadSave();
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 3,
    difficulty: "hard",
  });
  save = resetSave();
  assert.equal(save.progress["color-mixer"].cleared, false);
  assert.equal(save.progress["color-mixer"].bestStars, 0);
  assert.equal(save.achievements.length, 0);
});

test("loadSave: 容错——损坏的 JSON 不崩溃", () => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage.setItem(
    "kids-games-save-v1",
    "{not valid json",
  );
  const save = loadSave();
  assert.equal(save.version, 1);
  assert.equal(Object.keys(save.progress).length, ALL_GAME_IDS.length);
});
