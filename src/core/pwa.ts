/**
 * PWA 安装与离线缓存注册。
 *
 * 失败静默：PWA 是增强能力，不能影响儿童游戏主流程。
 */
export function registerPwa(): void {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* ignore */
    });
  });
}
