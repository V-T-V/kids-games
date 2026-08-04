/* 描线小路 Trace Line —— 沿虚线小路从起点描到终点，按偏离度评分。
   独特点：小路是蜿蜒的彩色虚线，孩子描画时实时累加偏离度。
   巧思：路径复杂度（波数）随难度增加；描完显示通过比例。Canvas 上下文用 c2d。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByRate } from "../../core/scoring.ts";
import { createButton } from "../../ui/Button.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar } from "../../lobby/util.ts";

const W = 340;
const H = 320;
const PAD = 36;

/** 生成一条从左到右的蜿蜒小路采样点。waves 越多越曲折。 */
function makePath(waves: number): [number, number][] {
  const pts: [number, number][] = [];
  const steps = 80;
  const amp = (H - PAD * 2) / 2 - 30;
  const mid = H / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = PAD + t * (W - PAD * 2);
    // 平滑的正弦蜿蜒，wave 数控制来回次数
    const y = mid + Math.sin(t * Math.PI * waves) * amp * 0.85;
    pts.push([x, y]);
  }
  return pts;
}

export class TraceLineGame extends BaseGame {
  constructor() {
    super("trace-line");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private path: [number, number][] = [];
  private drawing = false;
  private progress = 0; // 沿路径已描的最远索引
  private errors = 0;
  private samples = 0;
  private unbind: (() => void) | null = null;
  private reached = false; // 是否描到终点

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbind?.();
    this.unbind = null;
  }

  private waves(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbind?.();
    this.unbind = null;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.path = makePath(this.waves());
    this.progress = 0;
    this.errors = 0;
    this.samples = 0;
    this.reached = false;

    const wrap = document.createElement("div");
    wrap.className = "trl-wrap";
    const task = document.createElement("div");
    task.className = "trl-task";
    task.textContent = `沿着虚线小路描一描（第 ${this.roundsDone + 1}/${this.roundTotal} 条）`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "trl-canvas";
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
    actions.className = "trl-actions";
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
        this.c2d.lineWidth = 7;
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
    // 背景草地渐变
    const grad = c2d.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#eafbff");
    grad.addColorStop(1, "#e6ffe9");
    c2d.fillStyle = grad;
    c2d.fillRect(0, 0, W, H);
    // 虚线小路
    c2d.setLineDash([8, 9]);
    c2d.strokeStyle = "#b9a7e8";
    c2d.lineWidth = 14;
    c2d.lineCap = "round";
    c2d.beginPath();
    this.path.forEach((p, i) => {
      if (i === 0) c2d.moveTo(p[0], p[1]);
      else c2d.lineTo(p[0], p[1]);
    });
    c2d.stroke();
    c2d.setLineDash([]);
    // 起点（绿旗）/ 终点（红旗）
    const s = this.path[0]!;
    const e = this.path[this.path.length - 1]!;
    this.drawFlag(s[0], s[1], "🚩");
    this.drawFlag(e[0], e[1], "🏁");
  }

  private drawFlag(x: number, y: number, emoji: string): void {
    this.c2d.font = "26px serif";
    this.c2d.textAlign = "center";
    this.c2d.textBaseline = "middle";
    this.c2d.fillText(emoji, x, y - 22);
  }

  private score(pos: { x: number; y: number }): void {
    // 找路径上最近的点，同时推进 progress
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
    if (minD > 34) this.errors += 1;
    if (nearIdx > this.progress) this.progress = nearIdx;
    if (this.progress >= this.path.length - 4) this.reached = true;
  }

  private checkDone(): void {
    if (!this.reached) return;
    if (this.drawing) return;
    sfxPop();
    const r = this.canvas.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        // 综合偏离率算星
        const acc = this.samples > 0 ? 1 - this.errors / this.samples : 1;
        const stars = starsByRate(Math.round(acc * 100), 100, [0.85, 0.6]);
        this.finishClear(stars);
      } else {
        this.startRound();
      }
    }, 700);
  }

  private injectStyle(): void {
    if (document.getElementById("trl-style")) return;
    const st = document.createElement("style");
    st.id = "trl-style";
    st.textContent = TL_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function TL_CSS(_theme: string): string {
  return `
.trl-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(380px,100%);}
.trl-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.trl-canvas{background:#fff;border-radius:22px;box-shadow:var(--shadow);touch-action:none;cursor:crosshair;max-width:100%;height:auto;}
.trl-actions{display:flex;gap:12px;}
`;
}

export function create(): TraceLineGame {
  return new TraceLineGame();
}
