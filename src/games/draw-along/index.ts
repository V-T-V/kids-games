/* 照着画 Draw Along —— 沿虚线轨迹描画，按偏离度评分。
   独特点：临摹精度评分（区别于 doodle 的自由画）。
   巧思：目标路径用虚线显示，孩子描画时计算与目标距离，越准星越多。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { createButton } from "../../ui/Button.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar } from "../../lobby/util.ts";

// 目标路径：圆 / 三角 / 星（采样点）
const SHAPES: { name: string; pts: [number, number][] }[] = [
  { name: "圆", pts: circlePts(150, 120, 70, 24) },
  { name: "三角", pts: triPts(150, 120, 80) },
  { name: "星", pts: starPts(150, 120, 70, 12) },
];

function circlePts(
  cx: number,
  cy: number,
  r: number,
  n: number,
): [number, number][] {
  const p: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return p;
}
function triPts(cx: number, cy: number, r: number): [number, number][] {
  return [
    [cx, cy - r],
    [cx + r * 0.87, cy + r * 0.5],
    [cx - r * 0.87, cy + r * 0.5],
    [cx, cy - r],
  ];
}
function starPts(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
): [number, number][] {
  const p: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const rr = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return p;
}

export class DrawAlongGame extends BaseGame {
  constructor() {
    super("draw-along");
  }
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private target!: [number, number][];
  private errors = 0;
  private samples = 0;
  private drawing = false;
  private unbind: (() => void) | null = null;

  protected mount(): void {
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.errors = 0;
    this.samples = 0;
    const idx =
      this.difficulty === "easy" ? 0 : this.difficulty === "medium" ? 1 : 2;
    this.target = SHAPES[idx]!.pts;

    const wrap = document.createElement("div");
    wrap.className = "da-wrap";
    const task = document.createElement("div");
    task.className = "da-task";
    task.textContent = `沿着虚线描出 ${SHAPES[idx]!.name}～`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "da-canvas";
    this.canvas.width = 300;
    this.canvas.height = 240;
    this.c2d = this.canvas.getContext("2d")!;
    this.drawTarget();
    wrap.appendChild(this.canvas);

    const actions = document.createElement("div");
    actions.className = "da-actions";
    actions.appendChild(
      createButton({
        text: "重画",
        icon: "🔄",
        variant: "secondary",
        onClick: () => this.startRound(),
      }),
    );
    actions.appendChild(
      createButton({
        text: "画好啦",
        icon: "✨",
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
        this.c2d.beginPath();
        this.c2d.moveTo(pos.x, pos.y);
        this.score(pos);
      },
      move: (p) => {
        if (!this.drawing) return;
        const pos = getPos(p);
        this.c2d.strokeStyle = getCssVar("--c-purple");
        this.c2d.lineWidth = 6;
        this.c2d.lineCap = "round";
        this.c2d.lineTo(pos.x, pos.y);
        this.c2d.stroke();
        this.score(pos);
      },
      up: () => {
        this.drawing = false;
      },
    });
  }

  private drawTarget(): void {
    this.c2d.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.c2d.setLineDash([6, 6]);
    this.c2d.strokeStyle = "#bbb";
    this.c2d.lineWidth = 2;
    this.c2d.beginPath();
    this.target.forEach((p, i) => {
      if (i === 0) this.c2d.moveTo(p[0], p[1]);
      else this.c2d.lineTo(p[0], p[1]);
    });
    this.c2d.stroke();
    this.c2d.setLineDash([]);
  }

  private score(pos: { x: number; y: number }): void {
    // 找最近目标点距离
    let minD = Infinity;
    for (const t of this.target) {
      const d = Math.hypot(t[0] - pos.x, t[1] - pos.y);
      if (d < minD) minD = d;
    }
    this.samples += 1;
    if (minD > 30) this.errors += 1;
  }

  private done(): void {
    if (this.samples < 5) return;
    sfxPop();
    const accuracy = 1 - this.errors / this.samples;
    const stars = accuracy > 0.85 ? 3 : accuracy > 0.6 ? 2 : 1;
    const r = this.canvas.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.finishClear(stars);
  }

  private injectStyle(): void {
    if (document.getElementById("da-style")) return;
    const st = document.createElement("style");
    st.id = "da-style";
    st.textContent = DA_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function DA_CSS(_theme: string): string {
  return `
.da-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(360px,100%);}
.da-task{font-size:1.1rem;font-weight:800;}
.da-canvas{background:#fff;border-radius:18px;box-shadow:var(--shadow);touch-action:none;cursor:crosshair;}
.da-actions{display:flex;gap:12px;}
`;
}

export function create(): DrawAlongGame {
  return new DrawAlongGame();
}
