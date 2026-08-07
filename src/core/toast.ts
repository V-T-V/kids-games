/**
 * 成就解锁 Toast 通知 —— 右上角短暂弹出的"解锁提示"。
 *
 * 之前解锁成就完全无任何视觉反馈（只在家长面板的成就墙里能看到）。
 * 本模块用一个轻量的全局 DOM 队列：解锁时弹一条 toast，3 秒后自动消失。
 * 多条成就同时解锁会依次排队显示。
 */

const TOAST_DURATION = 3200; // 毫秒

interface ToastEntry {
  icon: string;
  title: string;
  subtitle: string;
}

const queue: ToastEntry[] = [];
let activeTimer: number | null = null;
let container: HTMLElement | null = null;

/** 懒加载 toast 容器（首次使用时创建）。无 DOM 环境返回 null（永不抛错）。 */
function ensureContainer(): HTMLElement | null {
  try {
    if (typeof document === "undefined") return null;
    if (container && document.body.contains(container)) return container;
    const el = document.createElement("div");
    el.id = "toast-layer";
    el.style.cssText =
      "position:fixed;top:16px;right:16px;z-index:9999;pointer-events:none;display:flex;flex-direction:column;gap:8px;";
    document.body.appendChild(el);
    container = el;
    return el;
  } catch {
    // 无 DOM（SSR/Node 测试环境）或 body 不可用：静默降级，不阻塞调用方
    return null;
  }
}

/** 弹出一条成就解锁提示。无 DOM 环境静默跳过（永不抛错）。 */
export function showAchievement(
  icon: string,
  title: string,
  subtitle = "成就已解锁",
): void {
  queue.push({ icon, title, subtitle });
  if (activeTimer === null) showNext();
}

/** 直接弹出一条普通提示（非成就，复用样式）。无 DOM 环境静默跳过（永不抛错）。 */
export function showToast(text: string, icon = "✨"): void {
  queue.push({ icon, title: text, subtitle: "" });
  if (activeTimer === null) showNext();
}

/** 当前队列长度（用于测试与诊断；不影响展示）。 */
export function pendingToastCount(): number {
  return queue.length;
}

function showNext(): void {
  const c = ensureContainer();
  if (!c) {
    // 无 DOM：清空队列避免无限堆积，标记空闲
    queue.length = 0;
    activeTimer = null;
    return;
  }
  const entry = queue.shift();
  if (!entry) {
    activeTimer = null;
    return;
  }
  const toast = document.createElement("div");
  toast.style.cssText = [
    "display:flex;align-items:center;gap:10px;",
    "min-width:200px;max-width:300px;",
    "padding:10px 14px;border-radius:12px;",
    "background:linear-gradient(135deg,#fff3,#2c3e50);",
    "background-color:#2c3e50;color:#fff;",
    "box-shadow:0 8px 24px rgba(0,0,0,0.25);",
    "font-family:system-ui,sans-serif;",
    "opacity:0;transform:translateX(20px);",
    "transition:opacity .3s ease, transform .3s ease;",
  ].join("");
  const iconEl = document.createElement("span");
  iconEl.textContent = entry.icon;
  iconEl.style.fontSize = "24px";
  const textWrap = document.createElement("div");
  textWrap.style.display = "flex";
  textWrap.style.flexDirection = "column";
  const t1 = document.createElement("span");
  t1.textContent = entry.title;
  t1.style.fontWeight = "700";
  t1.style.fontSize = "14px";
  const t2 = document.createElement("span");
  t2.textContent = entry.subtitle;
  t2.style.fontSize = "11px";
  t2.style.opacity = "0.8";
  textWrap.append(t1);
  if (entry.subtitle) textWrap.append(t2);
  toast.append(iconEl, textWrap);
  c.appendChild(toast);
  // 触发入场动画
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(0)";
  });

  activeTimer = window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    window.setTimeout(() => {
      toast.remove();
      showNext(); // 队列里的下一条
    }, 300);
  }, TOAST_DURATION);
}
