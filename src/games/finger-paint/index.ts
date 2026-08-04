/* 手指画 Finger Paint —— 在画布上用手指涂抹作画，沙盒玩法。
   艺术启蒙：自由涂鸦 + 色彩探索。独特点：彩虹手指画模式 + 大圆头画笔
   模拟手指涂抹质感（大半径 + 半透明叠加），白底画布可清空重画。
   沙盒类直接 finishClear(3)。前缀 fpt-。 */

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
];

export class FingerPaintGame extends BaseGame {
  constructor() {
    super("finger-paint");
  }

  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private drawing = false;
  private color = "#ff6b9d";
  private rainbow = false;
  private hue = 0;
  private lastX = 0;
  private lastY = 0;
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
    wrap.className = "fpt-wrap";

    const task = document.createElement("div");
    task.className = "fpt-task";
    task.textContent = "选个颜色，用手指在画布上涂鸦吧～";
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "fpt-canvas";
    const dpr = window.devicePixelRatio || 1;
    const W = Math.min(440, window.innerWidth - 40);
    const H = 340;
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.c2d = this.canvas.getContext("2d")!;
    this.c2d.scale(dpr, dpr);
    this.c2d.fillStyle = "#ffffff";
    this.c2d.fillRect(0, 0, W, H);
    this.c2d.lineCap = "round";
    this.c2d.lineJoin = "round";
    wrap.appendChild(this.canvas);

    // 颜色
    const palette = document.createElement("div");
    palette.className = "fpt-palette";
    COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fpt-color";
      b.style.background = c;
      b.addEventListener("click", () => {
        this.color = c;
        this.rainbow = false;
        this.markActive(b, palette);
        sfxPop();
      });
      palette.appendChild(b);
    });
    // 彩虹
    const rb = document.createElement("button");
    rb.type = "button";
    rb.className = "fpt-color fpt-color--rainbow";
    rb.textContent = "🌈";
    rb.addEventListener("click", () => {
      this.rainbow = true;
      this.markActive(rb, palette);
      sfxPop();
    });
    palette.appendChild(rb);
    wrap.appendChild(palette);

    // 操作
    const actions = document.createElement("div");
    actions.className = "fpt-actions";
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

    const getPos = (e: { x: number; y: number }) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.x - r.left, y: e.y - r.top };
    };
    this.unbind = bindPointer(this.canvas, {
      down: (p) => {
        this.drawing = true;
        const pos = getPos(p);
        this.lastX = pos.x;
        this.lastY = pos.y;
        // 按下立即画一个圆点（单击也能涂色）
        this.dab(pos.x, pos.y, pos.x, pos.y);
      },
      move: (p) => {
        if (!this.drawing) return;
        const pos = getPos(p);
        this.dab(this.lastX, this.lastY, pos.x, pos.y);
        this.lastX = pos.x;
        this.lastY = pos.y;
      },
      up: () => {
        this.drawing = false;
      },
    });
  }

  /** 在两点间涂一条粗厚半透明的圆头条带，模拟手指涂抹。 */
  private dab(x1: number, y1: number, x2: number, y2: number): void {
    const radius = 22;
    if (this.rainbow) {
      this.hue = (this.hue + 6) % 360;
      this.c2d.strokeStyle = `hsla(${this.hue},90%,55%,0.75)`;
    } else {
      // 转 hex -> rgba，加 0.7 alpha 让叠加出混色效果
      this.c2d.strokeStyle = this.color;
      this.c2d.globalAlpha = 0.7;
    }
    this.c2d.lineWidth = radius;
    this.c2d.beginPath();
    this.c2d.moveTo(x1, y1);
    this.c2d.lineTo(x2, y2);
    this.c2d.stroke();
    // 末端再画个圆保证圆头
    this.c2d.beginPath();
    this.c2d.arc(x2, y2, radius / 2, 0, Math.PI * 2);
    this.c2d.fillStyle = this.c2d.strokeStyle as string;
    this.c2d.fill();
    this.c2d.globalAlpha = 1;
  }

  private markActive(btn: HTMLButtonElement, palette: HTMLElement): void {
    palette
      .querySelectorAll(".fpt-color")
      .forEach((b) => b.classList.remove("fpt-color--active"));
    btn.classList.add("fpt-color--active");
  }

  private clear(): void {
    const W = parseInt(this.canvas.style.width, 10);
    const H = parseInt(this.canvas.style.height, 10);
    this.c2d.globalAlpha = 1;
    this.c2d.fillStyle = "#ffffff";
    this.c2d.fillRect(0, 0, W, H);
    sfxPop();
  }

  private done(): void {
    const r = this.canvas.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.finishClear(3);
  }

  private injectStyle(): void {
    if (document.getElementById("fpt-style")) return;
    const st = document.createElement("style");
    st.id = "fpt-style";
    st.textContent = FPT_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function FPT_CSS(_theme: string): string {
  return `
.fpt-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.fpt-task{font-size:1.1rem;font-weight:800;}
.fpt-canvas{background:#fff;border-radius:20px;box-shadow:var(--shadow);touch-action:none;cursor:crosshair;}
.fpt-palette{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.fpt-color{width:46px;height:46px;border-radius:50%;box-shadow:var(--shadow);font-size:1.4rem;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .12s;}
.fpt-color:active{transform:scale(.9);}
.fpt-color--active{outline:4px solid var(--ink);outline-offset:2px;}
.fpt-color--rainbow{background:conic-gradient(red,orange,yellow,green,blue,indigo,violet,red);}
.fpt-actions{display:flex;gap:12px;}
`;
}

export function create(): FingerPaintGame {
  return new FingerPaintGame();
}
