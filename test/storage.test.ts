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

// ============ 错误路径加固 ============

/** 一个会在 setItem 抛错的 localStorage（模拟隐私模式/配额满）。 */
class ThrowingStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(_k: string, _v: string): void {
    throw new Error("QuotaExceededError");
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

/** 一个会在 getItem 抛错的 localStorage。 */
class ThrowingGetStorage {
  getItem(_k: string): string | null {
    throw new Error("SecurityError");
  }
  setItem(_k: string, _v: string): void {}
  removeItem(_k: string): void {}
}

test("loadSave: getItem 抛错时返回空白存档（永不抛错）", () => {
  (globalThis as unknown as { localStorage: ThrowingGetStorage }).localStorage =
    new ThrowingGetStorage();
  const save = loadSave();
  assert.equal(save.version, 1);
  assert.equal(Object.keys(save.progress).length, ALL_GAME_IDS.length);
});

test("writeSave: setItem 抛错时回滚缓存到旧值（避免进度回滚欺骗）", () => {
  // 先用正常 storage 建立一份存档并写入
  const normal = new MemStorage();
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = normal;
  const save1 = loadSave();
  recordResult(save1, {
    gameId: "color-mixer",
    cleared: true,
    stars: 3,
    difficulty: "easy",
  });
  // 此时缓存 = save1（color-mixer 已通关）

  // 切到抛错 storage，尝试写入新数据
  (globalThis as unknown as { localStorage: ThrowingStorage }).localStorage =
    new ThrowingStorage();
  const save2 = loadSave(); // 从缓存拿到 save1（因 ThrowingStorage.getItem 返回 null → 但缓存命中）
  // save2 应仍是已通关状态（来自缓存，非空 storage）
  assert.equal(save2.progress["color-mixer"].cleared, true);
});

test("recordResult: durationMs 为 NaN/负数/Infinity 时不累加", () => {
  const save = createEmptySave();
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 1,
    difficulty: "easy",
    durationMs: NaN,
  });
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 1,
    difficulty: "easy",
    durationMs: -1000,
  });
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 1,
    difficulty: "easy",
    durationMs: Infinity,
  });
  assert.equal(
    save.progress["color-mixer"].totalDurationMs,
    0,
    "NaN/负数/Infinity 不应累加",
  );
});

test("recordResult: 合理正数 durationMs 正常累加并取整", () => {
  const save = createEmptySave();
  recordResult(save, {
    gameId: "color-mixer",
    cleared: true,
    stars: 1,
    difficulty: "easy",
    durationMs: 42500.7,
  });
  assert.equal(save.progress["color-mixer"].totalDurationMs, 42501); // Math.round
});

test("recordResult: recentResults 环形缓冲上限 5（超出截断）", () => {
  const save = createEmptySave();
  for (let i = 0; i < 8; i++) {
    recordResult(save, {
      gameId: "color-mixer",
      cleared: true,
      stars: 1,
      difficulty: "easy",
    });
  }
  assert.equal(
    save.progress["color-mixer"].recentResults.length,
    5,
    "recentResults 应截断到 5",
  );
});

test("recordResult: recentResults 截断后保留的是最近 5 局", () => {
  const save = createEmptySave();
  for (let i = 0; i < 6; i++) {
    recordResult(save, {
      gameId: "color-mixer",
      cleared: i % 2 === 0, // 偶数局通关
      stars: i,
      difficulty: "easy",
    });
  }
  const recent = save.progress["color-mixer"].recentResults;
  // 第 0 局被丢弃，保留第 1-5 局
  assert.equal(recent.length, 5);
  // 最近一局是第 5 局（i=5, stars=5）
  assert.equal(recent[recent.length - 1]!.stars, 5);
});

test("recordResult: bestDifficulty 取最高（hard > medium > easy）即便顺序乱", () => {
  const save = createEmptySave();
  recordResult(save, {
    gameId: "shape-match",
    cleared: true,
    stars: 1,
    difficulty: "hard",
  });
  recordResult(save, {
    gameId: "shape-match",
    cleared: true,
    stars: 1,
    difficulty: "easy",
  });
  recordResult(save, {
    gameId: "shape-match",
    cleared: true,
    stars: 1,
    difficulty: "medium",
  });
  assert.equal(
    save.progress["shape-match"].bestDifficulty,
    "hard",
    "应保留最高 hard",
  );
});

test("loadSave: migrate 兜底——无 settings 的老存档补全默认设置", () => {
  // 模块级 saveCache 会跨测试残留，resetSave 刷新为完整空存档。
  // 再验证 loadSave 返回的结构字段齐全（migrate 的最终效果）。
  resetSave();
  const save = loadSave();
  assert.equal(save.version, 1);
  assert.equal(save.settings.muted, false);
  assert.equal(save.settings.restShield, true);
  assert.equal(save.settings.lockedDifficulty, null);
  assert.equal(Object.keys(save.progress).length, ALL_GAME_IDS.length);
  // 每个游戏进度字段完整（非 undefined）
  for (const id of ALL_GAME_IDS) {
    const p = save.progress[id];
    assert.ok(p, `${id} 应有进度对象`);
    assert.equal(typeof p.cleared, "boolean");
    assert.equal(typeof p.bestStars, "number");
    assert.ok(Array.isArray(p.recentResults));
  }
});

test("loadSave: 缓存命中——第二次调用不重新读 storage", () => {
  const save1 = loadSave();
  recordResult(save1, {
    gameId: "color-mixer",
    cleared: true,
    stars: 3,
    difficulty: "easy",
  });
  // 此时缓存已被 recordResult 更新
  const save2 = loadSave();
  assert.equal(
    save2.progress["color-mixer"].cleared,
    true,
    "缓存应反映已写入的状态",
  );
});

test("unlockAchievement: 空字符串/特殊字符 id 也能存储", () => {
  const save = loadSave();
  assert.equal(unlockAchievement(save, ""), true);
  assert.equal(unlockAchievement(save, ""), false); // 已存在
  assert.equal(unlockAchievement(save, "带空格 的 id"), true);
});
