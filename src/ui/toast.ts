/**
 * 轻量 toast —— 短暂浮现的提示条（如"已静音""难度已切换"）。
 * 不打断游戏，3 秒自动消失。同一时刻只显示最新一条。
 */
let toastEl: HTMLDivElement | null = null;
let toastTimer: number | null = null;

export function toast(text: string, duration = 2500): void {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.add("toast--show");
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl?.classList.remove("toast--show");
  }, duration);
}
