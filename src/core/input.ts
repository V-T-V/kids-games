/**
 * 输入抽象 —— 把 mouse / touch / pen 统一为指针语义。
 *
 * 游戏只需订阅 onPointerDown/Move/Up，无需各自处理事件类型。
 * 自动阻止默认行为（防止触屏滚动/选中干扰拖拽）。
 */
import type { PointerHandler } from "../types.ts";

/**
 * 给一个元素绑定统一指针事件。
 * 优先使用 PointerEvent（现代浏览器统一接口），否则回退到 mouse+touch。
 * 返回解绑函数。
 */
export function bindPointer(
  el: HTMLElement,
  handlers: {
    down?: PointerHandler;
    move?: PointerHandler;
    up?: PointerHandler;
  },
): () => void {
  // 现代浏览器：统一 PointerEvent
  // 用一个不收窄 window 类型的判断方式
  const hasPointerEvents = typeof PointerEvent !== "undefined";
  if (hasPointerEvents) {
    const onDown = (e: PointerEvent) => {
      handlers.down?.({ x: e.clientX, y: e.clientY, id: e.pointerId });
    };
    const onMove = (e: PointerEvent) => {
      handlers.move?.({ x: e.clientX, y: e.clientY, id: e.pointerId });
    };
    const onUp = (e: PointerEvent) => {
      handlers.up?.({ x: e.clientX, y: e.clientY, id: e.pointerId });
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }

  // 回退：鼠标 + 触摸分立事件
  const onMouseDown = (e: MouseEvent) => {
    handlers.down?.({ x: e.clientX, y: e.clientY, id: 1 });
  };
  const onMouseMove = (e: MouseEvent) => {
    handlers.move?.({ x: e.clientX, y: e.clientY, id: 1 });
  };
  const onMouseUp = (e: MouseEvent) => {
    handlers.up?.({ x: e.clientX, y: e.clientY, id: 1 });
  };
  let nextId = 2;
  const activeTouches = new Map<number, number>();
  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      const id = nextId++;
      activeTouches.set(t.identifier, id);
      handlers.down?.({ x: t.clientX, y: t.clientY, id });
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      const id = activeTouches.get(t.identifier);
      if (id != null) handlers.move?.({ x: t.clientX, y: t.clientY, id });
    }
  };
  const onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      const id = activeTouches.get(t.identifier);
      if (id != null) {
        handlers.up?.({ x: t.clientX, y: t.clientY, id });
        activeTouches.delete(t.identifier);
      }
    }
  };
  el.addEventListener("mousedown", onMouseDown);
  el.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  el.addEventListener("touchstart", onTouchStart, { passive: false });
  el.addEventListener("touchmove", onTouchMove, { passive: false });
  el.addEventListener("touchend", onTouchEnd, { passive: false });
  el.addEventListener("touchcancel", onTouchEnd, { passive: false });
  return () => {
    el.removeEventListener("mousedown", onMouseDown);
    el.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    el.removeEventListener("touchstart", onTouchStart);
    el.removeEventListener("touchmove", onTouchMove);
    el.removeEventListener("touchend", onTouchEnd);
    el.removeEventListener("touchcancel", onTouchEnd);
  };
}
