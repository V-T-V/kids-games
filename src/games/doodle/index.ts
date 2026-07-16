/* 涂鸦画板 Doodle —— 自由绘画，选颜色与笔粗，清空与完成。
   巧思：彩虹画笔模式；完成后画作飞舞庆祝。纯 Canvas 实现。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { createButton } from "../../ui/Button.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar } from "../../lobby/util.ts";

const COLORS = [
  "#ff6b9d",
  "#ffd93d",
  "#4d96ff",
  "#6bcf7f",
  "#a55eea",
  "#ff9f43",
  "#3a2e4a",
];

export class DoodleGame extends BaseGame {
  constructor() {
    super("doodle");
  }

  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private drawing = false;
  private color = "#ff6b9d";
  private size = 12;
  private rainbow = false;
  private hue = 0;
  private unbind: (() => void) | null = null;

  protected mount(): void {
    this.injectStyle();
    this.render();
  }
  protected unmount(): void {
    this.unbind?.();
    this.unbind = null;
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "dd-wrap";

    const task = document.createElement("div");
    task.className = "dd-task";
    task.textContent = "想画什么就画什么～";
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "dd-canvas";
    const W = Math.min(440, window.innerWidth - 40);
    this.canvas.width = W;
    this.canvas.height = 320;
    this.c2d = this.canvas.getContext("2d")!;
    this.c2d.lineCap = "round";
    this.c2d.lineJoin = "round";
    this.c2d.fillStyle = "#ffffff";
    this.c2d.fillRect(0, 0, W, 320);
    wrap.appendChild(this.canvas);

    // 颜色选择
    const palette = document.createElement("div");
    palette.className = "dd-palette";
    COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dd-color";
      b.style.background = c;
      b.addEventListener("click", () => {
        this.color = c;
        this.rainbow = false;
        this.markActive(b, palette);
        sfxPop();
      });
      palette.appendChild(b);
    });
    // 彩虹笔
    const rb = document.createElement("button");
    rb.type = "button";
    rb.className = "dd-color dd-color--rainbow";
    rb.textContent = "🌈";
    rb.addEventListener("click", () => {
      this.rainbow = true;
      this.markActive(rb, palette);
      sfxPop();
    });
    palette.appendChild(rb);
    wrap.appendChild(palette);

    // 粗细
    const sizes = document.createElement("div");
    sizes.className = "dd-sizes";
    [6, 12, 22].forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dd-size";
      b.innerHTML = `<span style="width:${s + 4}px;height:${s + 4}px;border-radius:50%;background:var(--ink);display:block;"></span>`;
      b.addEventListener("click", () => {
        this.size = s;
        sfxPop();
      });
      sizes.appendChild(b);
    });
    wrap.appendChild(sizes);

    // 操作
    const actions = document.createElement("div");
    actions.className = "dd-actions";
    actions.appendChild(
      createButton({
        text: "清空",
        icon: "🧽",
        variant: "secondary",
        onClick: () => this.clear(),
      }),
    );
    actions.appendChild(
      createButton({
        text: "画好啦！",
        icon: "🎉",
        variant: "primary",
        onClick: () => this.done(),
      }),
    );
    wrap.appendChild(actions);

    this.root.appendChild(wrap);

    // 绑定绘画
    const getPos = (e: { x: number; y: number }) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.x - r.left, y: e.y - r.top };
    };
    this.unbind = bindPointer(this.canvas, {
      down: (p) => {
        this.drawing = true;
        const pos = getPos(p);
        this.c2d.beginPath();
        this.c2d.moveTo(pos.x, pos.y);
      },
      move: (p) => {
        if (!this.drawing) return;
        const pos = getPos(p);
        if (this.rainbow) {
          this.hue = (this.hue + 4) % 360;
          this.c2d.strokeStyle = `hsl(${this.hue},90%,55%)`;
        } else {
          this.c2d.strokeStyle = this.color;
        }
        this.c2d.lineWidth = this.size;
        this.c2d.lineTo(pos.x, pos.y);
        this.c2d.stroke();
      },
      up: () => {
        this.drawing = false;
      },
    });
  }

  private markActive(btn: HTMLButtonElement, palette: HTMLElement): void {
    palette
      .querySelectorAll(".dd-color")
      .forEach((b) => b.classList.remove("dd-color--active"));
    btn.classList.add("dd-color--active");
  }

  private clear(): void {
    this.c2d.fillStyle = "#ffffff";
    this.c2d.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private done(): void {
    const r = this.canvas.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.finishClear(3);
  }

  private injectStyle(): void {
    if (document.getElementById("dd-style")) return;
    const st = document.createElement("style");
    st.id = "dd-style";
    st.textContent = DD_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function DD_CSS(_theme: string): string {
  return `
.dd-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.dd-task{font-size:1.1rem;font-weight:800;}
.dd-canvas{background:#fff;border-radius:18px;box-shadow:var(--shadow);touch-action:none;cursor:crosshair;}
.dd-palette{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.dd-color{width:42px;height:42px;border-radius:50%;box-shadow:var(--shadow);font-size:1.4rem;display:flex;align-items:center;justify-content:center;}
.dd-color:active{transform:scale(.9);}
.dd-color--active{outline:4px solid var(--ink);outline-offset:2px;}
.dd-color--rainbow{background:conic-gradient(red,orange,yellow,green,blue,indigo,violet,red);}
.dd-sizes{display:flex;gap:14px;align-items:center;justify-content:center;}
.dd-size{width:44px;height:44px;border-radius:50%;background:#fff;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;}
.dd-size:active{transform:scale(.9);}
.dd-actions{display:flex;gap:12px;}
`;
}

export function create(): DoodleGame {
  return new DoodleGame();
}
