/**
 * 全屏覆盖层组件 —— 用于结算页、休息提示、家长面板等模态场景。
 *
 * 儿童友好：大字、大按钮、半透明蒙层点击不关闭（避免误触退出，
 * 必须点明确按钮）。destroy() 完整清理。
 */
import { createButton, type ButtonOptions } from "./Button.ts";

export interface OverlayOptions {
  /** 标题 */
  title: string;
  /** 正文（HTML 字符串或 DOM 节点） */
  body?: string | HTMLElement;
  /** 主按钮 */
  primary?: ButtonOptions;
  /** 次按钮 */
  secondary?: ButtonOptions;
  /** 第三按钮（如"下一个"） */
  tertiary?: ButtonOptions;
  /** 顶部大图标/插画 emoji */
  emoji?: string;
  /** 是否允许点击蒙层关闭（默认 false，防误触） */
  dismissible?: boolean;
  /** 额外 class（结算页/休息页样式区分） */
  variant?: "default" | "clear" | "rest";
}

export class Overlay {
  private readonly el: HTMLDivElement;

  constructor(opts: OverlayOptions) {
    this.el = document.createElement("div");
    this.el.className = `overlay overlay--${opts.variant ?? "default"}`;
    this.el.setAttribute("role", "dialog");
    this.el.setAttribute("aria-modal", "true");

    const card = document.createElement("div");
    card.className = "overlay__card";

    if (opts.emoji) {
      const e = document.createElement("div");
      e.className = "overlay__emoji";
      e.textContent = opts.emoji;
      card.appendChild(e);
    }

    const title = document.createElement("h2");
    title.className = "overlay__title";
    title.textContent = opts.title;
    card.appendChild(title);

    if (opts.body) {
      const bodyEl = document.createElement("div");
      bodyEl.className = "overlay__body";
      if (typeof opts.body === "string") {
        bodyEl.innerHTML = opts.body;
      } else {
        bodyEl.appendChild(opts.body);
      }
      card.appendChild(bodyEl);
    }

    if (opts.primary || opts.secondary || opts.tertiary) {
      const actions = document.createElement("div");
      actions.className = "overlay__actions";
      if (opts.secondary) {
        actions.appendChild(
          createButton({ ...opts.secondary, variant: "secondary" }),
        );
      }
      if (opts.tertiary) {
        actions.appendChild(
          createButton({ ...opts.tertiary, variant: "secondary" }),
        );
      }
      if (opts.primary) {
        actions.appendChild(
          createButton({ ...opts.primary, variant: "primary" }),
        );
      }
      card.appendChild(actions);
    }

    this.el.appendChild(card);

    if (opts.dismissible) {
      this.el.addEventListener("click", (ev) => {
        if (ev.target === this.el) this.destroy();
      });
    }
  }

  /** 挂载到 body，置顶显示。 */
  show(): void {
    document.body.appendChild(this.el);
    requestAnimationFrame(() => this.el.classList.add("overlay--in"));
  }

  destroy(): void {
    this.el.classList.remove("overlay--in");
    const node = this.el;
    window.setTimeout(() => node.remove(), 200);
  }
}
