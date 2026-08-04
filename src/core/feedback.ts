/**
 * 游戏问题反馈系统 —— 家长/孩子可在游戏内一键反馈问题。
 *
 * 完整闭环：收集（带游戏上下文）→ 存储（可管理）→ 展示（带筛选/导出）→ 行动（联动难度/reset）。
 *
 * - 每个游戏顶栏右侧有一个 💬 反馈按钮
 * - 点击弹出反馈对话框：预设问题类型 + 可选描述
 * - 反馈存入 localStorage，家长面板可查看汇总、标记已处理、单条删除、导出
 * - 提交后派发 "feedback-updated" 事件，齿轮按钮显示角标提示家长
 * - 轻量、不依赖后端、不打断游戏
 */
import { Overlay } from "../ui/Overlay.ts";
import { toast } from "../ui/toast.ts";
import type { Difficulty } from "../types.ts";
import { enqueueFeedback } from "./sync.ts";

/** 反馈问题类型 */
export type FeedbackType =
  | "bug" // 有 bug / 闪退
  | "too-hard" // 太难了
  | "too-easy" // 太简单
  | "unclear" // 规则不清楚
  | "cannot-clear" // 玩不通 / 卡住了
  | "other"; // 其他

/** 反馈问题类型的统一标签与图标（单一事实来源，ParentPanel 复用）。 */
export const FEEDBACK_TYPES: Record<
  FeedbackType,
  { label: string; short: string; icon: string }
> = {
  bug: { label: "有错误/闪退", short: "错误/闪退", icon: "🐛" },
  "too-hard": { label: "太难了", short: "太难", icon: "😰" },
  "too-easy": { label: "太简单", short: "太简单", icon: "😴" },
  unclear: { label: "规则不清楚", short: "规则不清", icon: "❓" },
  "cannot-clear": { label: "玩不通/卡住了", short: "玩不通", icon: "🚧" },
  other: { label: "其他问题", short: "其他", icon: "💬" },
};

/** 反馈提交时的游戏上下文（帮助定位问题）。 */
export interface FeedbackContext {
  /** 当前第几关（从 1 开始） */
  round?: number;
  /** 本局答对次数 */
  right?: number;
  /** 本局答错次数 */
  wrong?: number;
  /** 本局当前分数（街机类） */
  score?: number;
  /** 本局已玩时长（ms） */
  durationMs?: number;
}

export interface FeedbackEntry {
  /** 游戏id */
  gameId: string;
  /** 游戏标题 */
  gameTitle: string;
  /** 问题类型 */
  type: FeedbackType;
  /** 可选描述 */
  description: string;
  /** 时间戳 */
  timestamp: number;
  /** 游戏难度（枚举值 easy/medium/hard，便于程序读取联动） */
  difficulty: Difficulty | "";
  /** 游戏上下文（提交时的进度/分数，帮助定位问题） */
  context?: FeedbackContext;
  /** 是否已处理（家长标记） */
  resolved?: boolean;
}

const STORAGE_KEY = "kids-games-feedback";
/** 反馈变化时派发的事件名（main.ts 监听以刷新齿轮角标） */
export const FEEDBACK_EVENT = "feedback-updated";

/** 派发反馈更新事件，通知 UI（齿轮角标、家长面板）刷新。在非浏览器环境（如 node 测试）安全跳过。 */
function notifyUpdate(): void {
  if (typeof window !== "undefined" && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT));
  }
}

/** 读取全部反馈 */
export function loadFeedback(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FeedbackEntry[];
  } catch {
    return [];
  }
}

/** 写入全部反馈（内部） */
function saveFeedback(all: FeedbackEntry[]): void {
  const trimmed = all.slice(-200);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
  notifyUpdate();
}

/** 添加一条反馈 */
export function addFeedback(entry: FeedbackEntry): void {
  const all = loadFeedback();
  all.push(entry);
  saveFeedback(all);
  // 同步钩子：sync 就绪时 fire-and-forget 推送到 generic-admin 后台；
  // 未配置/失败则由 sync 内部降级（不入队或入 pending），本地存储已是 source of truth。
  enqueueFeedback(entry);
}

/** 标记某条反馈为已处理/未处理（按 timestamp 定位）。 */
export function resolveFeedback(timestamp: number, resolved: boolean): void {
  const all = loadFeedback();
  const item = all.find((f) => f.timestamp === timestamp);
  if (item) {
    item.resolved = resolved;
    saveFeedback(all);
  }
}

/** 删除单条反馈（按 timestamp 定位）。 */
export function deleteFeedback(timestamp: number): void {
  const all = loadFeedback().filter((f) => f.timestamp !== timestamp);
  saveFeedback(all);
}

/** 清空反馈（家长面板用） */
export function clearFeedback(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notifyUpdate();
}

/** 统计未处理反馈数量（齿轮角标用）。 */
export function feedbackCount(): number {
  return loadFeedback().filter((f) => !f.resolved).length;
}

/**
 * 统计某游戏的"太难/玩不通"反馈条数（自适应难度降档信号用）。
 * 只统计未处理的（已处理视为已解决，不再影响难度）。
 */
export function countHardFeedback(gameId: string): number {
  return loadFeedback().filter(
    (f) =>
      f.gameId === gameId &&
      !f.resolved &&
      (f.type === "too-hard" || f.type === "cannot-clear"),
  ).length;
}

/** 导出全部反馈为可复制的纯文本（家长留存/转交开发者用）。 */
export function exportFeedback(): string {
  const all = loadFeedback();
  if (all.length === 0) return "暂无反馈记录。";
  const lines = all.map((f) => {
    const t = FEEDBACK_TYPES[f.type];
    const d = new Date(f.timestamp);
    const timeStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const ctx = f.context
      ? ` [第${f.context.round ?? "?"}关 对${f.context.right ?? 0}错${f.context.wrong ?? 0}${f.context.score != null ? ` 分${f.context.score}` : ""}]`
      : "";
    const desc = f.description ? ` "${f.description}"` : "";
    return `- ${timeStr} ${f.gameTitle}(${f.difficulty || "?"}) ${t.icon}${t.short}${ctx}${desc}${f.resolved ? " [已处理]" : ""}`;
  });
  return `童趣游戏屋 · 问题反馈（共 ${all.length} 条）\n${lines.join("\n")}`;
}

/** 打开反馈对话框 */
export function openFeedbackDialog(
  gameId: string,
  gameTitle: string,
  difficulty: Difficulty | "",
  context?: FeedbackContext,
): void {
  let selectedType: FeedbackType | null = null;

  const body = document.createElement("div");
  body.className = "fb-body";

  // 问题类型选择
  const typeGrid = document.createElement("div");
  typeGrid.className = "fb-type-grid";
  (Object.keys(FEEDBACK_TYPES) as FeedbackType[]).forEach((t) => {
    const info = FEEDBACK_TYPES[t];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fb-type-btn";
    btn.innerHTML = `<span class="fb-type-icon">${info.icon}</span><span class="fb-type-label">${info.label}</span>`;
    btn.addEventListener("click", () => {
      selectedType = t;
      typeGrid
        .querySelectorAll(".fb-type-btn")
        .forEach((b) => b.classList.remove("fb-type-btn--active"));
      btn.classList.add("fb-type-btn--active");
    });
    typeGrid.appendChild(btn);
  });
  body.appendChild(typeGrid);

  // 描述输入
  const descLabel = document.createElement("div");
  descLabel.className = "fb-desc-label";
  descLabel.textContent = "补充说明（可选）：";
  body.appendChild(descLabel);

  const textarea = document.createElement("textarea");
  textarea.className = "fb-textarea";
  textarea.rows = 3;
  textarea.maxLength = 200;
  textarea.placeholder = "比如：点了按钮没反应…";
  body.appendChild(textarea);

  // 注入 CSS（一次）
  injectFeedbackStyle();

  const overlay = new Overlay({
    title: "反馈问题",
    emoji: "💬",
    body,
    primary: {
      text: "提交反馈",
      icon: "✅",
      onClick: () => {
        if (!selectedType) {
          toast("请先选一个问题类型");
          return;
        }
        addFeedback({
          gameId,
          gameTitle,
          type: selectedType,
          description: textarea.value.trim(),
          timestamp: Date.now(),
          difficulty,
          context,
        });
        toast("已提交，谢谢你的反馈！ 💝");
        overlay.destroy();
      },
    },
    secondary: {
      text: "取消",
      onClick: () => overlay.destroy(),
    },
  });
  overlay.show();
}

let styleInjected = false;
function injectFeedbackStyle(): void {
  if (styleInjected) return;
  styleInjected = true;
  const st = document.createElement("style");
  st.id = "fb-style";
  st.textContent = `
.fb-body { text-align: left; }
.fb-type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.fb-type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 6px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,.1);
  border: 3px solid transparent;
  transition: border-color .15s, transform .1s;
  min-height: 76px;
}
.fb-type-btn:active { transform: scale(.94); }
.fb-type-btn--active {
  border-color: var(--c-blue);
  background: #e8f0ff;
}
.fb-type-icon { font-size: 1.8rem; }
.fb-type-label { font-size: .8rem; font-weight: 700; color: var(--ink); }
.fb-desc-label {
  font-weight: 700;
  font-size: .95rem;
  margin-bottom: 6px;
  color: var(--ink-soft);
}
.fb-textarea {
  width: 100%;
  border: 2px solid #ddd;
  border-radius: 14px;
  padding: 12px;
  font-size: 1rem;
  font-family: var(--font);
  resize: none;
  outline: none;
  transition: border-color .15s;
}
.fb-textarea:focus { border-color: var(--c-blue); }
`;
  document.head.appendChild(st);
}
