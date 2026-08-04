/* 剪线条 Cut Line —— 画纸上有一条虚线路径，孩子用手指沿虚线拖动"剪刀"
   剪开。独特点：沿路径追踪 + 按偏离度评分。用 Canvas(c2d) 绘制路径与剪刀。
   视觉：纸张纹理 + 虚线路径 + 跟随手指的剪刀 emoji + 已剪开的实线痕迹。
   巧思：路径是一段折线（含 1-2 个转折），剪刀需在路径附近才算"在剪"，
         偏离累计过多则重剪本段；走完全程即通关。前缀 ctl-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

/** 路径关键点（画布坐标）。 */
interface Pt {
  x: number;
  y: number;
}

export class CutLineGame extends BaseGame {
  constructor() {
    super("cut-line");
  }
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private unbind = (): void => {};
  private W = 0;
  private H = 0;
  /** 折线路径。 */
  private path: Pt[] = [];
  /** 已剪过的路径长度参数 t（0..1，对应 path 累计长度）。 */
  private cutT = 0;
  /** 路径总长度（像素）。 */
  private totalLen = 0;
  /** 本段偏离累计（像素）。 */
  private deviate = 0;
  private cutting = false;
  private cursor: Pt | null = null;
  private roundsDone = 0;
  private roundTotal = 0;
  private failed = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbind();
    this.unbind = () => {};
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbind();
    this.cutting = false;
    this.cursor = null;
    this.cutT = 0;
    this.deviate = 0;
    this.failed = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "ctl-wrap";
    const task = document.createElement("div");
    task.className = "ctl-task";
    task.innerHTML = `用手指拖动剪刀，<b>沿虚线</b>剪开纸张～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.c2d = this.canvas.getContext("2d")!;
    this.canvas.className = "ctl-canvas";
    wrap.appendChild(this.canvas);
    this.root.appendChild(wrap);

    this.resize();
    this.genPath();
    this.draw();

    this.unbind = bindPointer(this.canvas, {
      down: (p) => this.onDown(p),
      move: (p) => this.onMove(p),
      up: () => this.onUp(),
    });
  }

  private resize(): void {
    const maxW = Math.min(440, window.innerWidth - 24);
    const maxH = Math.min(360, window.innerHeight - 220);
    this.W = maxW;
    this.H = maxH;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(maxW * dpr);
    this.canvas.height = Math.floor(maxH * dpr);
    this.canvas.style.width = `${maxW}px`;
    this.canvas.style.height = `${maxH}px`;
    this.c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 生成一条横向蜿蜒的折线路径。 */
  private genPath(): void {
    const segments =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const margin = 40;
    const startX = margin;
    const endX = this.W - margin;
    const midY = this.H / 2;
    this.path = [];
    for (let i = 0; i <= segments; i++) {
      const x = startX + ((endX - startX) * i) / segments;
      // y 在中线附近上下波动，但首尾在中线
      const amp =
        i === 0 || i === segments ? 0 : this.H * 0.18 * (i % 2 === 0 ? 1 : -1);
      this.path.push({ x, y: midY + amp });
    }
    // 计算总长
    this.totalLen = 0;
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1]!;
      const b = this.path[i]!;
      this.totalLen += Math.hypot(b.x - a.x, b.y - a.y);
    }
    this.cutT = 0;
  }

  /** 在路径上按累计弧长取点（t: 0..1）。 */
  private pointAt(t: number): Pt {
    const target = t * this.totalLen;
    let acc = 0;
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1]!;
      const b = this.path[i]!;
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (acc + seg >= target) {
        const k = seg === 0 ? 0 : (target - acc) / seg;
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
      acc += seg;
    }
    return { ...this.path[this.path.length - 1]! };
  }

  private toLocal(p: Pt): Pt {
    const r = this.canvas.getBoundingClientRect();
    return { x: p.x - r.left, y: p.y - r.top };
  }

  private onDown(p: Pt): void {
    const local = this.toLocal(p);
    // 必须从路径起点附近起剪
    const start = this.pointAt(0);
    if (Math.hypot(local.x - start.x, local.y - start.y) > 28) return;
    this.cutting = true;
    this.cursor = local;
    sfxPop();
    this.draw();
  }

  private onMove(p: Pt): void {
    if (!this.cutting) return;
    const local = this.toLocal(p);
    this.cursor = local;
    // 当前应剪到的位置
    const cur = this.pointAt(this.cutT);
    const dist = Math.hypot(local.x - cur.x, local.y - cur.y);
    if (dist < 26) {
      // 推进 cutT
      const advance = 0.012;
      this.cutT = Math.min(1, this.cutT + advance);
      sfxPop();
      if (this.cutT >= 1) {
        this.finishCut();
        return;
      }
    } else if (dist > 70) {
      // 偏离过远：累计
      this.deviate += dist * 0.02;
      if (this.deviate > 8) {
        // 偏离过多：重剪本段
        this.failed = true;
        this.cutting = false;
        const paused = this.onWrong();
        if (paused) {
          this.showRest();
        } else {
          this.trackTimeout(() => {
            this.cutT = 0;
            this.deviate = 0;
            this.failed = false;
            this.draw();
          }, 600);
        }
      }
    }
    this.draw();
  }

  private onUp(): void {
    this.cutting = false;
    this.cursor = null;
    this.draw();
  }

  private finishCut(): void {
    this.cutting = false;
    this.cursor = null;
    const r = this.canvas.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.draw();
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount, [1, 4]));
      } else {
        this.startRound();
      }
    }, 800);
  }

  private draw(): void {
    const ctx = this.c2d;
    ctx.clearRect(0, 0, this.W, this.H);
    // 纸张背景
    ctx.fillStyle = "#fffdf5";
    ctx.fillRect(0, 0, this.W, this.H);
    // 纸张纹理（淡线）
    ctx.strokeStyle = "rgba(200,190,150,.25)";
    ctx.lineWidth = 1;
    for (let y = 12; y < this.H; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.W, y);
      ctx.stroke();
    }
    // 已剪开的实线（红色，按 cutT）
    if (this.cutT > 0) {
      ctx.strokeStyle = "#ff5252";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      const p0 = this.pointAt(0);
      ctx.moveTo(p0.x, p0.y);
      const steps = 40;
      for (let i = 1; i <= steps; i++) {
        const t = (this.cutT * i) / steps;
        const p = this.pointAt(t);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    // 未剪部分的虚线（灰色）
    ctx.strokeStyle = "#9e9e9e";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    let started = false;
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (t < this.cutT) continue;
      const p = this.pointAt(t);
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // 起点标记
    const sp = this.pointAt(0);
    ctx.fillStyle = "#4d96ff";
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("起", sp.x, sp.y);
    // 剪刀 emoji 跟随手指
    if (this.cursor) {
      ctx.font = "26px sans-serif";
      ctx.fillText("✂️", this.cursor.x, this.cursor.y);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "✂️",
      variant: "rest",
      body: "剪刀要<b>贴着虚线</b>走，慢慢拖～",
      primary: { text: "继续", icon: "🎈", onClick: () => ov.destroy() },
      secondary: {
        text: "回大厅",
        icon: "🏠",
        onClick: () => {
          ov.destroy();
          navigate("");
        },
      },
    });
    ov.show();
  }

  private injectStyle(): void {
    if (document.getElementById("ctl-style")) return;
    const st = document.createElement("style");
    st.id = "ctl-style";
    st.textContent = CTL_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function CTL_CSS(_theme: string): string {
  return `
.ctl-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.ctl-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.4;}
.ctl-canvas{background:#fffdf5;border-radius:18px;box-shadow:var(--shadow);touch-action:none;cursor:crosshair;}
`;
}

export function create(): CutLineGame {
  return new CutLineGame();
}
