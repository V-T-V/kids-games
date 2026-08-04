/* 镜像画 Mirror Draw —— 左半区自由画画，右半区实时镜像同步。
   独特点：垂直中线对称，孩子左笔画什么，右边自动出现镜像（培养对称审美）。
   创造性游戏，画完点"完成"即通关（沙盒类）。Canvas 上下文 c2d。 */

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

export class MirrorDrawGame extends BaseGame {
  constructor() {
    super("mirror-draw");
  }

  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private drawing = false;
  private color = "#ff6b9d";
  private size = 12;
  private drawn = false; // 是否画过至少一笔
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
    wrap.className = "md-wrap";

    const task = document.createElement("div");
    task.className = "md-task";
    task.innerHTML = `在 <b>左边</b> 画一画，右边会同步出现镜子里的画面～`;
    wrap.appendChild(task);

    const frame = document.createElement("div");
    frame.className = "md-frame";
    this.canvas = document.createElement("canvas");
    this.canvas.className = "md-canvas";
    const dpr = window.devicePixelRatio || 1;
    const W = Math.min(440, window.innerWidth - 32);
    const H = 320;
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.c2d = this.canvas.getContext("2d")!;
    this.c2d.scale(dpr, dpr);
    this.c2d.lineCap = "round";
    this.c2d.lineJoin = "round";
    this.bg();
    this.drawAxis();
    frame.appendChild(this.canvas);
    wrap.appendChild(frame);

    // 颜色选择
    const palette = document.createElement("div");
    palette.className = "md-palette";
    COLORS.forEach((c, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "md-color";
      if (idx === 0) b.classList.add("md-color--active");
      b.style.background = c;
      b.addEventListener("click", () => {
        this.color = c;
        palette
          .querySelectorAll(".md-color")
          .forEach((x) => x.classList.remove("md-color--active"));
        b.classList.add("md-color--active");
        sfxPop();
      });
      palette.appendChild(b);
    });
    wrap.appendChild(palette);

    // 笔粗
    const sizes = document.createElement("div");
    sizes.className = "md-sizes";
    [6, 12, 20].forEach((s, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "md-size";
      if (idx === 1) b.classList.add("md-size--active");
      b.innerHTML = `<span style="width:${s + 4}px;height:${s + 4}px;border-radius:50%;background:var(--ink);display:block;"></span>`;
      b.addEventListener("click", () => {
        this.size = s;
        sizes
          .querySelectorAll(".md-size")
          .forEach((x) => x.classList.remove("md-size--active"));
        b.classList.add("md-size--active");
        sfxPop();
      });
      sizes.appendChild(b);
    });
    wrap.appendChild(sizes);

    // 操作
    const actions = document.createElement("div");
    actions.className = "md-actions";
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

    // 绘画绑定
    const getPos = (p: { x: number; y: number }) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: p.x - r.left, y: p.y - r.top };
    };
    this.unbind = bindPointer(this.canvas, {
      down: (p) => {
        this.drawing = true;
        this.drawn = true;
        this.lastMirror = null; // 新笔画：重置镜像连续点
        const pos = getPos(p);
        this.c2d.strokeStyle = this.color;
        this.c2d.lineWidth = this.size;
        this.c2d.beginPath();
        this.c2d.moveTo(pos.x, pos.y);
        this.c2d.lineTo(pos.x + 0.1, pos.y + 0.1);
        this.c2d.stroke();
        this.drawMirror(pos.x, pos.y);
      },
      move: (p) => {
        if (!this.drawing) return;
        const pos = getPos(p);
        this.c2d.strokeStyle = this.color;
        this.c2d.lineWidth = this.size;
        this.c2d.lineTo(pos.x, pos.y);
        this.c2d.stroke();
        this.drawMirror(pos.x, pos.y);
      },
      up: () => {
        this.drawing = false;
      },
    });
  }

  /** 镜像绘制：以中线为轴左右对称。 */
  private drawMirror(x: number, y: number): void {
    const mid = this.canvas.width / 2;
    const mx = mid + (mid - x); // 镜像 x
    // 但我们需要连续画，不能再用 path，这里用线条段配合上次镜像点
    // 简单方案：用 fillRect 圆点（每个落点画一个圆 + 镜像圆），连续性由 move 间隔保证
    const prev = this.lastMirror;
    this.c2d.save();
    this.c2d.beginPath();
    if (prev) {
      this.c2d.strokeStyle = this.color;
      this.c2d.lineWidth = this.size;
      this.c2d.moveTo(prev.x, prev.y);
      this.c2d.lineTo(mx, y);
      this.c2d.stroke();
    } else {
      this.c2d.fillStyle = this.color;
      this.c2d.arc(mx, y, this.size / 2, 0, Math.PI * 2);
      this.c2d.fill();
    }
    this.c2d.restore();
    this.lastMirror = { x: mx, y };
  }
  private lastMirror: { x: number; y: number } | null = null;

  private bg(): void {
    const g = this.c2d.createLinearGradient(0, 0, this.canvas.width, 0);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#eaf2ff");
    this.c2d.fillStyle = g;
    this.c2d.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawAxis(): void {
    const mid = this.canvas.width / 2;
    this.c2d.save();
    this.c2d.strokeStyle = "rgba(77,150,255,.5)";
    this.c2d.lineWidth = 2;
    this.c2d.setLineDash([8, 8]);
    this.c2d.beginPath();
    this.c2d.moveTo(mid, 0);
    this.c2d.lineTo(mid, this.canvas.height);
    this.c2d.stroke();
    this.c2d.restore();
  }

  private clear(): void {
    this.lastMirror = null;
    this.drawn = false;
    this.bg();
    this.drawAxis();
  }

  private done(): void {
    // 不强制必须画：即便空画布也算完成（沙盒）
    void this.drawn;
    const r = this.canvas.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.finishClear(3);
  }

  private injectStyle(): void {
    if (document.getElementById("md-style")) return;
    const st = document.createElement("style");
    st.id = "md-style";
    st.textContent = MD_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function MD_CSS(theme: string): string {
  return `
.md-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.md-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.4;}
.md-frame{position:relative;border-radius:20px;overflow:hidden;box-shadow:var(--shadow);}
.md-canvas{display:block;background:#fff;touch-action:none;cursor:crosshair;border-radius:20px;}
.md-palette{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.md-color{width:42px;height:42px;border-radius:50%;box-shadow:var(--shadow);transition:transform .1s;}
.md-color:active{transform:scale(.9);}
.md-color--active{outline:4px solid var(--ink);outline-offset:2px;}
.md-sizes{display:flex;gap:14px;align-items:center;justify-content:center;}
.md-size{width:44px;height:44px;border-radius:50%;background:#fff;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;transition:transform .1s;}
.md-size:active{transform:scale(.9);}
.md-size--active{outline:3px solid ${theme};outline-offset:2px;}
.md-actions{display:flex;gap:12px;}
`;
}

export function create(): MirrorDrawGame {
  return new MirrorDrawGame();
}
