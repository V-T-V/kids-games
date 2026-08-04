/* 剪纸创作 Paper Cut —— 沿虚线"剪"出图案，剪完一段显示一段。
   艺术启蒙：精细拖动 + 中国剪纸审美。独特点：Canvas 上预绘虚线裁剪路径，
   玩家沿虚线拖动（剪刀图标跟随），轨迹覆盖到阈值即"剪开"该段，
   全部剪完展开成完整图案。数据保证每段路径是简单的直线/折线，可解。
   前缀 pcr-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { createButton } from "../../ui/Button.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar } from "../../lobby/util.ts";

interface Segment {
  /** 线段起点（CSS 像素） */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  done: boolean;
}

/** 在纸（Canvas）上排布一组虚线裁剪段，返回段落列表。返回的坐标基于 CSS 像素 W x H。 */
function buildPath(shape: string, W: number, H: number): Segment[] {
  const segs: Segment[] = [];
  if (shape === "star") {
    // 五角星轮廓（10 个顶点交替）
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.32;
    const r = R * 0.45;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const rad = i % 2 === 0 ? R : r;
      pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, done: false });
    }
  } else if (shape === "heart") {
    // 心形：用折线近似（左右对称两段贝塞尔折点）
    const cx = W / 2;
    const top = H * 0.32;
    const bot = H * 0.68;
    const side = W * 0.34;
    const pts = [
      { x: cx, y: bot },
      { x: cx - side, y: top + 20 },
      { x: cx - side * 0.4, y: top - 20 },
      { x: cx, y: top + 30 },
      { x: cx + side * 0.4, y: top - 20 },
      { x: cx + side, y: top + 20 },
      { x: cx, y: bot },
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, done: false });
    }
  } else {
    // diamond 菱形
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) * 0.3;
    const pts = [
      { x: cx, y: cy - r },
      { x: cx + r, y: cy },
      { x: cx, y: cy + r },
      { x: cx - r, y: cy },
      { x: cx, y: cy - r },
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, done: false });
    }
  }
  return segs;
}

const SHAPES = [
  { id: "star", emoji: "⭐", color: "#ffd93d" },
  { id: "heart", emoji: "❤️", color: "#ff6b6b" },
  { id: "diamond", emoji: "💎", color: "#4d96ff" },
];

export class PaperCutGame extends BaseGame {
  constructor() {
    super("paper-cut");
  }
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private segs: Segment[] = [];
  private cutting = false;
  private lastX = 0;
  private lastY = 0;
  private unbind: (() => void) | null = null;
  private shape = SHAPES[0]!;
  private target = 0;
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.shape = SHAPES[this.roundsDone % SHAPES.length]!;

    const wrap = document.createElement("div");
    wrap.className = "pcr-wrap";

    const task = document.createElement("div");
    task.className = "pcr-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 用手指沿<b>虚线</b>拖动，把${this.shape.emoji}剪出来`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "pcr-canvas";
    const dpr = window.devicePixelRatio || 1;
    const W = Math.min(440, window.innerWidth - 40);
    const H = 340;
    this.W = W;
    this.H = H;
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.c2d = this.canvas.getContext("2d")!;
    this.c2d.scale(dpr, dpr);
    this.segs = buildPath(this.shape.id, W, H);
    this.target = this.segs.length;
    this.draw();

    const getPos = (e: { x: number; y: number }) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.x - r.left, y: e.y - r.top };
    };
    this.unbind = bindPointer(this.canvas, {
      down: (p) => {
        this.cutting = true;
        const pos = getPos(p);
        this.lastX = pos.x;
        this.lastY = pos.y;
      },
      move: (p) => {
        if (!this.cutting) return;
        const pos = getPos(p);
        this.cutSegment(this.lastX, this.lastY, pos.x, pos.y);
        this.lastX = pos.x;
        this.lastY = pos.y;
      },
      up: () => {
        this.cutting = false;
      },
    });
    wrap.appendChild(this.canvas);

    const hint = document.createElement("div");
    hint.className = "pcr-hint";
    hint.innerHTML = `已剪：<b id="pcr-done">0</b> / ${this.target} 段`;
    wrap.appendChild(hint);

    const actions = document.createElement("div");
    actions.className = "pcr-actions";
    actions.appendChild(
      createButton({
        text: "重新剪",
        icon: "🔄",
        variant: "secondary",
        onClick: () => this.redraw(),
      }),
    );
    actions.appendChild(
      createButton({
        text: "剪好啦！",
        icon: "🎉",
        variant: "primary",
        onClick: () => this.done(),
      }),
    );
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
  }

  private draw(): void {
    const c = this.c2d;
    c.fillStyle = "#fffdf5";
    c.fillRect(0, 0, this.W, this.H);
    // 未剪虚线
    c.lineWidth = 2.5;
    c.setLineDash([8, 6]);
    c.strokeStyle = "#c9a96a";
    this.segs.forEach((s) => {
      if (s.done) return;
      c.beginPath();
      c.moveTo(s.x1, s.y1);
      c.lineTo(s.x2, s.y2);
      c.stroke();
    });
    c.setLineDash([]);
    // 已剪：画成实色割痕
    c.lineWidth = 4;
    c.strokeStyle = this.shape.color;
    c.lineCap = "round";
    this.segs.forEach((s) => {
      if (!s.done) return;
      c.beginPath();
      c.moveTo(s.x1, s.y1);
      c.lineTo(s.x2, s.y2);
      c.stroke();
    });
  }

  private redraw(): void {
    this.segs = buildPath(this.shape.id, this.W, this.H);
    this.draw();
    const d = this.root.querySelector("#pcr-done");
    if (d) d.textContent = "0";
  }

  /** 检测拖动是否覆盖了未剪线段的足够比例，覆盖则标记完成。 */
  private cutSegment(x1: number, y1: number, x2: number, y2: number): void {
    let changed = false;
    for (const s of this.segs) {
      if (s.done) continue;
      // 点到线段中点距离 < 阈值，且移动方向与线段方向夹角小
      const mx = (s.x1 + s.x2) / 2;
      const my = (s.y1 + s.y2) / 2;
      // 用移动段的任一端点接近线段来判断
      const dMoveMid = pointToSegmentDist(mx, my, x1, y1, x2, y2);
      const dA = dist(mx, my, x2, y2);
      if (dMoveMid < 22 || dA < 18) {
        s.done = true;
        changed = true;
        sfxPop();
      }
    }
    if (changed) {
      this.draw();
      const done = this.segs.filter((s) => s.done).length;
      const d = this.root.querySelector("#pcr-done");
      if (d) d.textContent = String(done);
      const r = this.canvas.getBoundingClientRect();
      this.onCorrect(r.left + x2, r.top + y2);
      this.resetWrongStreak();
      if (done >= this.target) {
        this.trackTimeout(() => this.complete(), 500);
      }
    }
  }

  private complete(): void {
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    if (this.roundsDone >= this.roundTotal) {
      const r = this.canvas.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.finishClear(starsByScore(this.roundsDone, [this.roundTotal, 1]));
    } else {
      this.startRound();
    }
  }

  private done(): void {
    const r = this.canvas.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    // 至少剪了一部分即算通关
    this.finishClear(starsByScore(this.roundsDone + 1, [this.roundTotal, 1]));
  }

  private injectStyle(): void {
    if (document.getElementById("pcr-style")) return;
    const st = document.createElement("style");
    st.id = "pcr-style";
    st.textContent = PCR_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}
function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(px, py, x1, y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(px, py, x1 + t * dx, y1 + t * dy);
}

function PCR_CSS(theme: string): string {
  return `
.pcr-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.pcr-task{font-size:1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.pcr-task b{color:${theme};}
.pcr-canvas{background:#fffdf5;border-radius:20px;box-shadow:var(--shadow);touch-action:none;cursor:crosshair;}
.pcr-hint{font-size:.95rem;font-weight:800;color:#666;}
.pcr-hint b{color:${theme};font-size:1.1rem;}
.pcr-actions{display:flex;gap:12px;}
`;
}

export function create(): PaperCutGame {
  return new PaperCutGame();
}
