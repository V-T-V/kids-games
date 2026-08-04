/* 描轮廓 Shape Shadow Trace —— Canvas 上有图形的虚线轮廓
   （圆/星/心/三角），孩子沿着虚线描画一圈。按偏离度评分。
   独特点：闭合图形描摹（区别于描线小路的开放路径），需要画回到起点。
   巧思：参数化路径（极坐标/星形函数）生成均匀采样点；
   玩家描画时累加偏离并推进进度，绕完一圈即完成。难度=图形复杂度。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByRate } from "../../core/scoring.ts";
import { createButton } from "../../ui/Button.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

const W = 340;
const H = 340;
const CX = W / 2;
const CY = H / 2;

/** 生成圆形轮廓采样点。 */
function circlePath(): [number, number][] {
  const pts: [number, number][] = [];
  const r = 110;
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    pts.push([CX + Math.cos(a) * r, CY + Math.sin(a) * r]);
  }
  return pts;
}

/** 三角形轮廓。 */
function trianglePath(): [number, number][] {
  const verts: [number, number][] = [
    [CX, CY - 120],
    [CX + 115, CY + 90],
    [CX - 115, CY + 90],
  ];
  return alongPolygon([...verts, verts[0]!], 120);
}

/** 五角星轮廓（更难）。 */
function starPath(): [number, number][] {
  const verts: [number, number][] = [];
  const R = 125;
  const r = 52;
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    verts.push([CX + Math.cos(a) * rad, CY + Math.sin(a) * rad]);
  }
  return alongPolygon([...verts, verts[0]!], 200);
}

/** 心形轮廓。 */
function heartPath(): [number, number][] {
  const pts: [number, number][] = [];
  const scale = 6.2;
  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    pts.push([CX + x * scale, CY - y * scale]);
  }
  return pts;
}

/** 沿多边形顶点均匀插值采样。 */
function alongPolygon(
  verts: [number, number][],
  steps: number,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < verts.length - 1; i++) {
    const a = verts[i]!;
    const b = verts[i + 1]!;
    const seg = Math.max(2, Math.round(steps / (verts.length - 1)));
    for (let j = 0; j < seg; j++) {
      const t = j / seg;
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  pts.push(verts[verts.length - 1]!);
  return pts;
}

interface Shape {
  name: string;
  emoji: string;
  path: () => [number, number][];
}

const SHAPES: Record<string, Shape[]> = {
  easy: [
    { name: "圆形", emoji: "⭕", path: circlePath },
    { name: "三角形", emoji: "🔺", path: trianglePath },
  ],
  medium: [
    { name: "圆形", emoji: "⭕", path: circlePath },
    { name: "心形", emoji: "💖", path: heartPath },
    { name: "三角形", emoji: "🔺", path: trianglePath },
  ],
  hard: [
    { name: "五角星", emoji: "⭐", path: starPath },
    { name: "心形", emoji: "💖", path: heartPath },
  ],
};

export class ShapeShadowTraceGame extends BaseGame {
  constructor() {
    super("shape-shadow-trace");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private path: [number, number][] = [];
  private shape: Shape | null = null;
  private drawing = false;
  private progress = 0;
  private errors = 0;
  private samples = 0;
  private reached = false;
  private unbind: (() => void) | null = null;
  private roundDone = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbind?.();
    this.unbind = null;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const pool = SHAPES[this.difficulty] ?? SHAPES.easy!;
    this.shape = sample(pool);
    this.path = this.shape.path();
    this.progress = 0;
    this.errors = 0;
    this.samples = 0;
    this.reached = false;
    this.roundDone = false;

    const wrap = document.createElement("div");
    wrap.className = "sst-wrap";
    const task = document.createElement("div");
    task.className = "sst-task";
    task.innerHTML = `${this.shape.emoji} 沿虚线描出 <b>${this.shape.name}</b> 的轮廓（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "sst-canvas";
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.c2d = this.canvas.getContext("2d")!;
    this.c2d.scale(dpr, dpr);
    this.redraw();
    wrap.appendChild(this.canvas);

    const actions = document.createElement("div");
    actions.className = "sst-actions";
    actions.appendChild(
      createButton({
        text: "重描",
        icon: "🔄",
        variant: "secondary",
        onClick: () => this.startRound(),
      }),
    );
    wrap.appendChild(actions);
    this.root.appendChild(wrap);

    const getPos = (e: { x: number; y: number }) => {
      const r = this.canvas.getBoundingClientRect();
      // 处理 canvas 缩放（max-width）
      const sx = W / r.width;
      const sy = H / r.height;
      return { x: (e.x - r.left) * sx, y: (e.y - r.top) * sy };
    };
    this.unbind = bindPointer(this.canvas, {
      down: (p) => {
        if (this.roundDone) return;
        this.drawing = true;
        const pos = getPos(p);
        this.c2d.beginPath();
        this.c2d.moveTo(pos.x, pos.y);
        this.score(pos);
      },
      move: (p) => {
        if (!this.drawing || this.roundDone) return;
        const pos = getPos(p);
        this.c2d.strokeStyle = getCssVar("--c-orange");
        this.c2d.lineWidth = 8;
        this.c2d.lineCap = "round";
        this.c2d.lineJoin = "round";
        this.c2d.lineTo(pos.x, pos.y);
        this.c2d.stroke();
        this.score(pos);
      },
      up: () => {
        this.drawing = false;
        this.checkDone();
      },
    });
  }

  private redraw(): void {
    const c2d = this.c2d;
    c2d.clearRect(0, 0, W, H);
    // 背景
    const grad = c2d.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#fff7fb");
    grad.addColorStop(1, "#fff3e6");
    c2d.fillStyle = grad;
    c2d.fillRect(0, 0, W, H);
    // 浅色填充提示形状
    c2d.fillStyle = "rgba(255,159,67,.10)";
    c2d.beginPath();
    this.path.forEach((p, i) => {
      if (i === 0) c2d.moveTo(p[0], p[1]);
      else c2d.lineTo(p[0], p[1]);
    });
    c2d.closePath();
    c2d.fill();
    // 虚线轮廓
    c2d.setLineDash([9, 9]);
    c2d.strokeStyle = "#ffb368";
    c2d.lineWidth = 4;
    c2d.lineCap = "round";
    c2d.beginPath();
    this.path.forEach((p, i) => {
      if (i === 0) c2d.moveTo(p[0], p[1]);
      else c2d.lineTo(p[0], p[1]);
    });
    c2d.closePath();
    c2d.stroke();
    c2d.setLineDash([]);
    // 起点标记
    const s = this.path[0]!;
    c2d.fillStyle = "#ff9f43";
    c2d.beginPath();
    c2d.arc(s[0], s[1], 7, 0, Math.PI * 2);
    c2d.fill();
  }

  private score(pos: { x: number; y: number }): void {
    let minD = Infinity;
    let nearIdx = this.progress;
    for (let i = this.progress; i < this.path.length; i++) {
      const t = this.path[i]!;
      const d = Math.hypot(t[0] - pos.x, t[1] - pos.y);
      if (d < minD) {
        minD = d;
        nearIdx = i;
      }
    }
    this.samples += 1;
    if (minD > 30) this.errors += 1;
    if (nearIdx > this.progress) this.progress = nearIdx;
    // 绕完一圈（接近总点数的 95%）
    if (this.progress >= this.path.length - Math.floor(this.path.length * 0.06))
      this.reached = true;
  }

  private checkDone(): void {
    if (this.roundDone) return;
    if (!this.reached) return;
    this.roundDone = true;
    sfxPop();
    const r = this.canvas.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        const acc = this.samples > 0 ? 1 - this.errors / this.samples : 1;
        const stars = starsByRate(Math.round(acc * 100), 100, [0.8, 0.55]);
        this.finishClear(stars);
      } else {
        this.startRound();
      }
    }, 750);
  }

  private injectStyle(): void {
    if (document.getElementById("sst-style")) return;
    const st = document.createElement("style");
    st.id = "sst-style";
    st.textContent = SST_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function SST_CSS(_theme: string): string {
  return `
.sst-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(380px,100%);}
.sst-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.sst-canvas{background:#fff;border-radius:22px;box-shadow:var(--shadow);touch-action:none;cursor:crosshair;max-width:100%;height:auto;}
.sst-actions{display:flex;gap:12px;}
`;
}

export function create(): ShapeShadowTraceGame {
  return new ShapeShadowTraceGame();
}
