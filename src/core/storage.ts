/**
 * 存档系统 —— 基于 localStorage 的儿童友好持久化。
 *
 * 设计要点：
 * - 任何读写失败都不抛错（隐私模式/容量满），游戏永远能玩。
 * - 存档自动迁移：版本号变化时回填缺失字段，避免老存档崩溃。
 * - 夸赞与进度都不含个人信息，安全无虞。
 */
import type {
  GameId,
  GameProgress,
  GameResult,
  ParentSettings,
  SaveData,
} from "../types.ts";
import { refreshAudioCache } from "./audio.ts";
import { GAME_IDS } from "../games/registry.ts";

const STORAGE_KEY = "kids-games-save-v1";
const CURRENT_VERSION = 1;

/** 全部游戏的 id 列表（用于初始化空进度），从注册表派生，避免内容规模漂移。 */
export const ALL_GAME_IDS: readonly GameId[] = GAME_IDS;

function emptyProgress(): GameProgress {
  return {
    bestDifficulty: null,
    bestStars: 0,
    playCount: 0,
    totalDurationMs: 0,
    cleared: false,
    lastResult: null,
  };
}

function defaultSettings(): ParentSettings {
  return {
    muted: false,
    lockedDifficulty: null,
    restShield: true,
  };
}

/** 生成一份空白存档。 */
export function createEmptySave(): SaveData {
  const progress = {} as Record<GameId, GameProgress>;
  for (const id of ALL_GAME_IDS) {
    progress[id] = emptyProgress();
  }
  return {
    version: CURRENT_VERSION,
    progress,
    achievements: [],
    settings: defaultSettings(),
  };
}

/** 读取存档；失败/不存在时返回空白存档，永不抛错。 */
export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptySave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return migrate(parsed);
  } catch {
    return createEmptySave();
  }
}

/** 写入存档；失败时静默忽略。 */
export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // 通知音频层刷新缓存的静音状态
    refreshAudioCache();
  } catch {
    /* 隐私模式或容量满：忽略，游戏照常进行 */
  }
}

/** 清空存档（家长面板"重置进度"使用）。 */
export function resetSave(): SaveData {
  const fresh = createEmptySave();
  writeSave(fresh);
  return fresh;
}

/**
 * 迁移补全：把任意部分存档修补成完整结构，
 * 即便老版本字段缺失也不会崩溃。
 */
function migrate(parsed: Partial<SaveData>): SaveData {
  const base = createEmptySave();
  const settings: ParentSettings = {
    ...base.settings,
    ...(parsed.settings ?? {}),
  };
  const progress: Record<GameId, GameProgress> = { ...base.progress };
  // 老存档字段可能缺失/结构不一致，用宽松类型读取
  const src: Record<string, Partial<GameProgress>> = (parsed.progress as
    | Record<string, Partial<GameProgress>>
    | undefined) ?? {};
  for (const id of ALL_GAME_IDS) {
    progress[id] = { ...emptyProgress(), ...(src[id] ?? {}) };
  }
  return {
    version: CURRENT_VERSION,
    progress,
    achievements: parsed.achievements ?? [],
    settings,
  };
}

/**
 * 记录一局结算。原地更新传入存档并持久化。
 * - 取最高难度（easy<medium<hard）与最高星。
 * - 首次通关即标记 cleared。
 */
const DIFF_RANK: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

export function recordResult(save: SaveData, result: GameResult): SaveData {
  const p = save.progress[result.gameId];
  p.playCount += 1;
  if (
    typeof result.durationMs === "number" &&
    Number.isFinite(result.durationMs) &&
    result.durationMs > 0
  ) {
    p.totalDurationMs += Math.round(result.durationMs);
  }
  if (result.cleared) {
    p.cleared = true;
    p.bestStars = Math.max(p.bestStars, result.stars);
    const curRank = p.bestDifficulty ? (DIFF_RANK[p.bestDifficulty] ?? 0) : 0;
    const newRank = DIFF_RANK[result.difficulty] ?? 0;
    if (newRank > curRank) p.bestDifficulty = result.difficulty;
  }
  p.lastResult = result;
  writeSave(save);
  return save;
}

/** 解锁成就（去重）。返回是否为新解锁。 */
export function unlockAchievement(
  save: SaveData,
  achievementId: string,
): boolean {
  if (save.achievements.includes(achievementId)) return false;
  save.achievements.push(achievementId);
  writeSave(save);
  return true;
}

/** 统计已通关游戏数。 */
export function countCleared(save: SaveData): number {
  return ALL_GAME_IDS.filter((id) => save.progress[id].cleared).length;
}

/** 是否全部 8 个游戏都通关（用于解锁隐藏彩蛋）。 */
export function allCleared(save: SaveData): boolean {
  return countCleared(save) === ALL_GAME_IDS.length;
}

/** 更新家长设置并持久化。 */
export function updateSettings(
  save: SaveData,
  patch: Partial<ParentSettings>,
): SaveData {
  save.settings = { ...save.settings, ...patch };
  writeSave(save);
  return save;
}
