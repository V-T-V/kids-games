/**
 * 收藏夹 + 最近玩过 —— 大厅快捷入口的数据层。
 *
 * 设计与 feedback.ts 同构：独立 localStorage key、读写包 try-catch
 * （隐私模式/容量满不崩）、变化时派发 window 事件让大厅局部刷新。
 *
 * - 收藏夹：孩子/家长点卡片 ⭐ 收藏，上限 FAVORITES_MAX，超出拒绝并提示。
 * - 最近玩过：进入游戏即记录，环形缓冲 RECENT_MAX，新的置顶、去重。
 *
 * 与存档（SaveData）解耦：走独立 key，避免老存档迁移风险。
 */
import type { GameId } from "../types.ts";

const FAV_KEY = "kids-games-favorites-v1";
const RECENT_KEY = "kids-games-recent-v1";

/** 收藏夹上限（保护孩子不无限收藏，卡片网格也保持可浏览）。 */
export const FAVORITES_MAX = 24;
/** 最近玩过上限（环形缓冲，只保留最近这几个高频入口）。 */
export const RECENT_MAX = 8;

/** 收藏变化事件（main/Lobby 监听以刷新快捷区与卡片角标）。 */
export const FAVORITES_EVENT = "favorites-updated";
/** 最近玩过变化事件。 */
export const RECENT_EVENT = "recent-updated";

/** 在非浏览器环境（如 node 测试）安全派发。 */
function emit(name: string): void {
  if (typeof window !== "undefined" && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent(name));
  }
}

/* ===================== 收藏夹 ===================== */

/** 读取收藏游戏 id 列表（按收藏时间顺序）。 */
export function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** 是否已收藏某游戏。 */
export function isFavorite(gameId: string): boolean {
  return getFavorites().includes(gameId);
}

/**
 * 切换收藏状态。
 * @returns 切换后是否处于收藏态；已达上限时无法收藏，返回 false。
 */
export function toggleFavorite(gameId: string): boolean {
  const list = getFavorites();
  const i = list.indexOf(gameId);
  if (i >= 0) {
    list.splice(i, 1);
    persistFavorites(list);
    return false;
  }
  if (list.length >= FAVORITES_MAX) return false; // 满了：拒绝新增
  list.push(gameId);
  persistFavorites(list);
  return true;
}

/** 直接收藏（幂等，已收藏不报错）。已达上限时返回 false。 */
export function addFavorite(gameId: string): boolean {
  const list = getFavorites();
  if (list.includes(gameId)) return true;
  if (list.length >= FAVORITES_MAX) return false;
  list.push(gameId);
  persistFavorites(list);
  return true;
}

/** 取消收藏（幂等）。 */
export function removeFavorite(gameId: string): void {
  const list = getFavorites().filter((id) => id !== gameId);
  persistFavorites(list);
}

/** 清空收藏（家长面板重置用）。 */
export function clearFavorites(): void {
  persistFavorites([]);
}

function persistFavorites(list: string[]): void {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  emit(FAVORITES_EVENT);
}

/* ===================== 最近玩过 ===================== */

/** 读取最近玩过的游戏 id 列表（最新在前）。 */
export function getRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * 记录一次游戏访问：把该游戏置顶并去重，超出 RECENT_MAX 丢弃最旧的。
 * 进入游戏时调用（main.ts showGame 成功启动处）。
 */
export function pushRecent(gameId: string): void {
  const list = getRecent().filter((id) => id !== gameId);
  list.unshift(gameId);
  persistRecent(list.slice(0, RECENT_MAX));
}

/** 清空最近玩过（家长面板重置用）。 */
export function clearRecent(): void {
  persistRecent([]);
}

function persistRecent(list: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  emit(RECENT_EVENT);
}

/* ===================== 类型安全的访问器（供 UI 用） ===================== */

/** 读取收藏，过滤掉已从注册表移除的游戏（避免幽灵卡片）。 */
export function getValidFavorites(valid: ReadonlySet<string>): GameId[] {
  return getFavorites().filter((id) => valid.has(id)) as GameId[];
}

/** 读取最近玩过，过滤掉已从注册表移除的游戏。 */
export function getValidRecent(valid: ReadonlySet<string>): GameId[] {
  return getRecent().filter((id) => valid.has(id)) as GameId[];
}
