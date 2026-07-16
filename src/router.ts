/**
 * 极简 hash 路由 —— 单页应用，无依赖。
 *
 * 大厅 = 空 hash；游戏 = #/game-id。
 * 路由变化时通知监听器，由 App 层负责渲染对应界面。
 */

type RouteListener = (route: string) => void;

const listeners = new Set<RouteListener>();

function current(): string {
  const h = window.location.hash || "";
  // 形如 #/color-mixer → color-mixer；空 → ''（大厅）
  return h.replace(/^#\/?/, "");
}

export function getRoute(): string {
  return current();
}

export function navigate(route: string): void {
  const target = route ? `#/${route}` : "#/";
  if (window.location.hash !== target) {
    window.location.hash = target;
  } else {
    // 已在同一路由，手动触发
    emit();
  }
}

export function onRoute(fn: RouteListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(): void {
  const r = current();
  listeners.forEach((fn) => fn(r));
}

export function initRouter(): void {
  window.addEventListener("hashchange", emit);
}
