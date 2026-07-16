/**
 * 大按钮组件 —— 儿童友好：超大触控区、圆角、按压反馈、可选图标。
 * 触控区 >= 64px，符合 3-6 岁精细动作能力。
 */
import { sfxTick } from "../core/audio.ts";

export interface ButtonOptions {
  text: string;
  icon?: string;
  variant?: "primary" | "secondary" | "ghost";
  /** 点击音效，默认开启 */
  silent?: boolean;
  onClick?: () => void;
}

export function createButton(opts: ButtonOptions): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `btn btn--${opts.variant ?? "primary"}`;
  const iconHtml = opts.icon
    ? `<span class="btn__icon">${opts.icon}</span>`
    : "";
  btn.innerHTML = `${iconHtml}<span class="btn__text">${opts.text}</span>`;
  btn.addEventListener("click", () => {
    if (!opts.silent) sfxTick();
    opts.onClick?.();
  });
  return btn;
}
