/**
 * 反馈同步到 generic-admin 后台 —— 把浏览器里的孩子/家长反馈实时推到后台统一管理。
 *
 * 设计：
 * - 配置（baseUrl + token）存独立 localStorage key，默认关闭（opt-in）。
 * - 提交反馈即 fire-and-forget 推送一条；失败/离线则进 pending 队列，
 *   启动 + 联网时重试。本地存储永远是 source-of-truth 兜底。
 * - 所有网络调用包 try-catch，永不抛到 UI；失败只静默入队。
 * - 用 timestamp 作记录 id 推送（幂等）：409=已存在视为成功，重试安全。
 *
 * 与 feedback.ts 的边界：feedback.ts 只管本地存储 + UI；本模块只管网络 + 队列。
 *
 * 对接的后台：generic-admin（见 examples/kids-games-feedback-setup.md）。
 *   POST {baseUrl}/collections/kids-games-feedback/records
 *   Header: Authorization: Bearer <token>
 */
import type { FeedbackEntry } from "./feedback.ts";
import type { SyncConfig } from "../types.ts";

const SYNC_KEY = "kids-games-sync-v1";
const PENDING_KEY = "kids-games-feedback-pending";

/** 后台 collection slug（与 generic-admin 文档约定一致）。 */
export const FEEDBACK_COLLECTION = "kids-games-feedback";

/** pending 队列上限（与 feedback.ts 的 200 条上限对齐，避免无限堆积）。 */
const PENDING_MAX = 200;

/** 同步变化事件（家长面板刷新 pending 数 / 同步状态标用）。 */
export const SYNC_EVENT = "sync-updated";

/** 默认配置：关闭。 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  baseUrl: "",
  token: "",
};

/** 读取同步配置。损坏/缺失返回默认（关闭）。 */
export function getSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return { ...DEFAULT_SYNC_CONFIG };
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    return {
      enabled: Boolean(parsed.enabled),
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      token: typeof parsed.token === "string" ? parsed.token : "",
    };
  } catch {
    return { ...DEFAULT_SYNC_CONFIG };
  }
}

/** 写入同步配置（家长面板配好后调用）。派发 SYNC_EVENT。 */
export function setSyncConfig(cfg: SyncConfig): void {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
  emitSync();
}

/** 同步是否就绪：开启 + baseUrl + token 都非空。 */
export function isSyncReady(): boolean {
  const c = getSyncConfig();
  return c.enabled && c.baseUrl.trim().length > 0 && c.token.trim().length > 0;
}

/** 在非浏览器环境（如 node 测试）安全派发。 */
function emitSync(): void {
  if (typeof window !== "undefined" && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  }
}

/* ===================== pending 队列 ===================== */

/** 读取待重试的反馈队列。 */
export function getPending(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr)
      ? arr.filter(
          (x): x is FeedbackEntry => typeof x === "object" && x !== null,
        )
      : [];
  } catch {
    return [];
  }
}

/** 待重试条数（家长面板角标/按钮显示用）。 */
export function getPendingCount(): number {
  return getPending().length;
}

/** 写回 pending 队列（内部）。 */
function savePending(list: FeedbackEntry[]): void {
  const trimmed = list.slice(-PENDING_MAX);
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
  emitSync();
}

/** 把一条失败反馈加入待重试队列（按 timestamp 去重）。 */
export function enqueuePending(entry: FeedbackEntry): void {
  const list = getPending();
  if (!list.some((e) => e.timestamp === entry.timestamp)) {
    list.push(entry);
    savePending(list);
  }
}

/** 从队列移除已成功推送的一条（按 timestamp）。 */
function removeFromPending(timestamp: number): void {
  const list = getPending().filter((e) => e.timestamp !== timestamp);
  savePending(list);
}

/** 清空 pending（家长面板重置用）。 */
export function clearPending(): void {
  savePending([]);
}

/* ===================== 推送 ===================== */

export interface PushResult {
  /** 是否成功（含 409 冲突视为成功） */
  ok: boolean;
  /** 是否为 409 冲突（已存在，幂等） */
  conflict: boolean;
  /** 失败时的状态码或错误信息 */
  error?: string;
}

/** 把 FeedbackEntry 转成后台记录 body（timestamp 作 id，幂等）。 */
function toRecordBody(entry: FeedbackEntry): {
  id: string;
  data: Record<string, unknown>;
} {
  return {
    id: String(entry.timestamp),
    data: {
      gameId: entry.gameId,
      gameTitle: entry.gameTitle,
      type: entry.type,
      description: entry.description,
      timestamp: entry.timestamp,
      difficulty: entry.difficulty,
      context: entry.context ?? null,
      resolved: entry.resolved ?? false,
      clientStatus: "new",
    },
  };
}

/**
 * 推送单条反馈到后台。
 * - 成功（201）或冲突（409，已存在）→ ok:true
 * - 网络/其他错误 → ok:false（不抛，由调用方决定是否入队）
 */
export async function pushFeedback(entry: FeedbackEntry): Promise<PushResult> {
  const cfg = getSyncConfig();
  if (!cfg.enabled || !cfg.baseUrl || !cfg.token) {
    return { ok: false, conflict: false, error: "sync-not-configured" };
  }
  const body = toRecordBody(entry);
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/collections/${FEEDBACK_COLLECTION}/records`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify(body),
    });
    if (resp.status === 201) return { ok: true, conflict: false };
    if (resp.status === 409) return { ok: true, conflict: true }; // 幂等：已存在
    return { ok: false, conflict: false, error: `http-${resp.status}` };
  } catch (err) {
    return {
      ok: false,
      conflict: false,
      error: err instanceof Error ? err.message : "network-error",
    };
  }
}

/**
 * 提交反馈时的统一入口：sync 就绪且在线则 fire-and-forget 推送，
 * 失败自动入 pending。不阻塞 UI、不抛错。
 */
export function enqueueFeedback(entry: FeedbackEntry): void {
  if (!isSyncReady()) return; // 未配置/未启用：完全不联网
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enqueuePending(entry); // 离线：直接入队
    return;
  }
  void pushFeedback(entry).then((r) => {
    if (!r.ok) enqueuePending(entry); // 失败：入队待重试
  });
}

/**
 * 重试所有 pending 反馈。启动 + 联网时调用。
 * 逐条推送：成功的移除，失败的留队（下次再试）。
 * @returns 本次成功条数
 */
export async function retryPending(): Promise<number> {
  if (!isSyncReady()) return 0;
  const list = getPending();
  if (list.length === 0) return 0;
  let success = 0;
  for (const entry of list) {
    const r = await pushFeedback(entry);
    if (r.ok) {
      removeFromPending(entry.timestamp);
      success += 1;
    } else {
      // 遇到失败就停（很可能后台不可达），剩余留到下次
      break;
    }
  }
  return success;
}

/** 家长面板"立即同步"按钮：等同 retryPending，但即使在线也强制逐条推。 */
export async function flushAllPending(): Promise<{
  success: number;
  failed: number;
}> {
  const list = getPending();
  let success = 0;
  let failed = 0;
  for (const entry of list) {
    const r = await pushFeedback(entry);
    if (r.ok) {
      removeFromPending(entry.timestamp);
      success += 1;
    } else {
      failed += 1;
    }
  }
  return { success, failed };
}
