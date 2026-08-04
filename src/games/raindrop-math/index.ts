/* 雨滴算术 Raindrop Math —— 雨滴从天上落下每个带算式（如 3+2），
   题目"接住等于 5 的"，移动接物器接住正确的雨滴。
   独特点：实时下落 + 心算，融合动作与运算。
   视觉：Canvas 绘制蓝灰雨天背景 + 圆形雨滴（内含算式）+ 桶形接物器。
   巧思：接对加 1 分并粒子迸发；接错或漏掉正确雨滴扣血。
   难度 = 雨滴数/算式范围。通关 = 接对目标数。前缀 rdm-。
   RAF 用 createRafLoop（unmount 自动 cancelAnimationFrame）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { bindPointer } from "../../core/input.ts";
import { createRafLoop } from "../../core/loop.ts";
import { starsByScore } from "../../core/scoring.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

interface Drop {
  x: number;
  y: number;
  vy: number;
  value: number; // 算式结果
  expr: string;
  correct: boolean; // 是否为本关"正确答案"
  alpha: number;
}

export class RaindropMathGame extends BaseGame {
  constructor() {
    super("raindrop-math");
  }

  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private stop?: () => void;
  private unbind: (() => void) | null = null;

  private drops: Drop[] = [];
  private basketX = 0;
  private basketY = 0;
  private bw = 105; // 接物器半宽
  private bh = 32; // 接物器半高

  private target = 0;
  private score = 0;
  private lives = 3;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private lastSpawn = 0;
  private spawnGap = 1100;

  private answer = 0; // 本关要接的"正确答案"

  protected mount(): void {
    this.target =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 10;
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startRound();
  }

  protected unmount(): void {
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    this.unbind?.();
    this.unbind = null;
  }

  /** 算式数值范围。 */
  private range(): { a: [number, number]; op: ("+" | "-")[] } {
    if (this.difficulty === "easy") return { a: [1, 5], op: ["+"] };
    if (this.difficulty === "medium") return { a: [1, 9], op: ["+", "-"] };
    return { a: [2, 12], op: ["+", "-"] };
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.drops = [];
    this.score = 0;
    this.lives = 3;
    this.over = false;
    this.spawnGap =
      this.difficulty === "easy"
        ? 1300
        : this.difficulty === "medium"
          ? 1000
          : 780;

    const wrap = document.createElement("div");
    wrap.className = "rdm-wrap";

    const bar = document.createElement("div");
    bar.className = "rdm-bar";
    bar.innerHTML = `<div id="rdm-score">💧 0 / ${this.target}</div><div id="rdm-lives">❤️❤️❤️</div>`;
    wrap.appendChild(bar);

    const task = document.createElement("div");
    task.className = "rdm-task";
    task.id = "rdm-task";
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "rdm-canvas";
    this.c2d = this.canvas.getContext("2d")!;
    wrap.appendChild(this.canvas);
    this.root.appendChild(wrap);

    this.resize();
    this.pickAnswer();
    this.bindInput();
    this.lastSpawn = performance.now();
    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  /** 重新挑选一个目标答案（题目）。 */
  private pickAnswer(): void {
    const { a } = this.range();
    const [lo, hi] = a;
    this.answer = randInt(lo + 1, hi + 2);
    const t = this.root.querySelector("#rdm-task");
    if (t)
      t.innerHTML = `移动水桶，接住结果等于 <b>${this.answer}</b> 的雨滴！`;
  }

  private resize(): void {
    const maxW = Math.min(440, window.innerWidth - 24);
    this.W = maxW;
    this.H = Math.max(360, Math.min(560, window.innerHeight - 220));
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.c2d.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.basketX = this.W / 2;
    this.basketY = this.H - 30;
  }

  private bindInput(): void {
    this.unbind = bindPointer(this.canvas, {
      move: (p) => this.moveBasket(p),
      down: (p) => this.moveBasket(p),
    });
  }

  private moveBasket(p: { x: number; y: number }): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = p.x - rect.left;
    this.basketX = Math.max(this.bw, Math.min(this.W - this.bw, x));
  }

  private tick = (dt: number): void => {
    if (this.over) {
      this.stop?.();
      this.stop = undefined;
      return;
    }
    const now = performance.now();
    if (now - this.lastSpawn > this.spawnGap) {
      this.spawn();
      this.lastSpawn = now;
    }
    const fallScale = dt * 60; // 归一到 60fps 步长
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]!;
      d.y += d.vy * fallScale;
      // 碰接物器
      if (
        d.y > this.basketY - this.bh &&
        d.y < this.basketY + this.bh &&
        Math.abs(d.x - this.basketX) < this.bw
      ) {
        if (d.correct) this.hit();
        else this.miss();
        this.drops.splice(i, 1);
        continue;
      }
      if (d.y > this.H + 30) {
        // 漏掉
        if (d.correct) this.miss();
        this.drops.splice(i, 1);
      }
    }
    this.draw();
  };

  private spawn(): void {
    const { a, op } = this.range();
    const [lo, hi] = a;
    // 保证有解：当场上没有 correct 雨滴时强制生成一个
    const hasCorrect = this.drops.some((d) => d.correct);
    const makeCorrect = !hasCorrect || Math.random() < 0.5;
    const wantValue = makeCorrect ? this.answer : this.pickWrongValue(lo, hi);
    const { expr, result } = this.makeExpr(wantValue, lo, hi, op);
    const x = randInt(40, this.W - 40);
    this.drops.push({
      x,
      y: -30,
      vy:
        this.difficulty === "easy"
          ? 1.6
          : this.difficulty === "medium"
            ? 2.1
            : 2.7,
      value: result,
      expr,
      correct: result === this.answer,
      alpha: 1,
    });
  }

  /** 选一个不等于答案的数值。 */
  private pickWrongValue(lo: number, hi: number): number {
    const pool: number[] = [];
    for (let v = Math.max(0, lo - 1); v <= hi + 3; v++) {
      if (v !== this.answer) pool.push(v);
    }
    return sample(pool);
  }

  /** 为指定结果 result 构造一个算式 a op b，保证 a,b 在合理范围且成立。 */
  private makeExpr(
    result: number,
    lo: number,
    hi: number,
    ops: ("+" | "-")[],
  ): { expr: string; result: number } {
    const o = sample(ops);
    if (o === "+") {
      // a + b = result，a,b ∈ [lo, hi]
      const aLo = Math.max(lo, result - hi);
      const aHi = Math.min(hi, result - lo);
      const a = aHi >= aLo ? randInt(aLo, aHi) : lo;
      const b = result - a;
      return { expr: `${a}+${b}`, result: a + b };
    }
    // a - b = result → a = result + b
    const bLo = lo;
    const bHi = Math.min(hi, hi - result);
    const b = bHi >= bLo ? randInt(bLo, bHi) : lo;
    const a = result + b;
    return { expr: `${a}-${b}`, result: a - b };
  }

  private hit(): void {
    this.score += 1;
    sfxPop();
    const rect = this.canvas.getBoundingClientRect();
    burst(rect.left + this.basketX, rect.top + this.basketY, 10, [
      "circle",
      "star",
    ]);
    this.resetWrongStreak();
    const sc = this.root.querySelector("#rdm-score");
    if (sc) sc.textContent = `💧 ${this.score} / ${this.target}`;
    if (this.score >= this.target) {
      this.over = true;
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(
            starsByScore(this.score, [
              this.target,
              Math.ceil(this.target * 0.7),
            ]),
          );
        } else {
          this.startRound();
        }
      }, 400);
    } else {
      // 每接 3 个换一道题，保持新鲜
      if (this.score % 3 === 0) this.pickAnswer();
    }
  }

  private miss(): void {
    this.lives -= 1;
    const lv = this.root.querySelector("#rdm-lives");
    if (lv) lv.textContent = "❤️".repeat(Math.max(0, this.lives)) || "💔";
    const paused = this.onWrong();
    if (this.lives <= 0) {
      this.over = true;
      this.trackTimeout(
        () =>
          this.finishClear(
            starsByScore(this.score, [
              this.target,
              Math.ceil(this.target * 0.7),
            ]),
          ),
        400,
      );
    } else if (paused) {
      // 暂停一会：停止生成
      const resumeAt = this.lastSpawn;
      this.lastSpawn = performance.now() + 1200;
      void resumeAt;
    }
  }

  private draw(): void {
    const ctx = this.c2d;
    // 背景：阴雨天空渐变（更丰富）
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, "#3d5a78");
    g.addColorStop(0.5, "#6a8aab");
    g.addColorStop(1, "#b4d0e6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    // 装饰云朵（缓慢飘动）
    const tnow = performance.now() / 60;
    this.drawCloud(ctx, ((tnow * 0.4) % (this.W + 120)) - 60, 40, 1);
    this.drawCloud(ctx, this.W - ((tnow * 0.3) % (this.W + 120)) + 0, 80, 0.7);
    this.drawCloud(ctx, ((tnow * 0.25 + 200) % (this.W + 140)) - 70, 24, 0.85);
    // 远景细雨（加粗 + 加密）
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 48; i++) {
      const x = (i * 37 + ((performance.now() / 20) % 37)) % this.W;
      const y = (i * 53 + ((performance.now() / 8) % this.H)) % this.H;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 14);
    }
    ctx.stroke();

    // 雨滴（放大）
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const d of this.drops) {
      const r = 32;
      ctx.save();
      ctx.globalAlpha = d.alpha;
      // 阴影
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      // 水滴形
      const grad = ctx.createRadialGradient(d.x - 8, d.y - 10, 5, d.x, d.y, r);
      grad.addColorStop(0, "#e4f4ff");
      grad.addColorStop(0.6, "#6fb5e6");
      grad.addColorStop(1, "#2f7ec4");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - r - 8);
      ctx.bezierCurveTo(d.x + r, d.y - r, d.x + r, d.y + r, d.x, d.y + r);
      ctx.bezierCurveTo(d.x - r, d.y + r, d.x - r, d.y - r, d.x, d.y - r - 8);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "#26639e";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 高光
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.ellipse(d.x - 9, d.y - 12, 6, 10, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // 算式
      ctx.fillStyle = "#0c2a45";
      ctx.font = "bold 19px system-ui, sans-serif";
      ctx.fillText(d.expr, d.x, d.y);
      ctx.restore();
    }

    // 接物器（水桶，放大 + 阴影）
    const bx = this.basketX;
    const by = this.basketY;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    const bg = ctx.createLinearGradient(bx - this.bw, by, bx + this.bw, by);
    bg.addColorStop(0, "#d8b478");
    bg.addColorStop(0.5, "#c89a52");
    bg.addColorStop(1, "#a87a3a");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(bx - this.bw, by - this.bh);
    ctx.lineTo(bx + this.bw, by - this.bh);
    ctx.lineTo(bx + this.bw - 14, by + this.bh);
    ctx.lineTo(bx - this.bw + 14, by + this.bh);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#7a5328";
    ctx.lineWidth = 4;
    ctx.stroke();
    // 桶口高光
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - this.bw + 4, by - this.bh + 2);
    ctx.lineTo(bx + this.bw - 4, by - this.bh + 2);
    ctx.stroke();
    // 桶把
    ctx.strokeStyle = "#7a5328";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bx, by - this.bh - 2, this.bw * 0.7, Math.PI, 0);
    ctx.stroke();
    ctx.restore();

    // 底部草地（带渐变）
    const gg = ctx.createLinearGradient(0, this.H - 14, 0, this.H);
    gg.addColorStop(0, "#4a7a3a");
    gg.addColorStop(1, "#2f5226");
    ctx.fillStyle = gg;
    ctx.fillRect(0, this.H - 14, this.W, 14);
  }

  /** 绘制一朵云。 */
  private drawCloud(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = 0.55 * Math.min(1, scale + 0.3);
    ctx.fillStyle = "#ffffff";
    const s = scale;
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 24 * s, y - 10 * s, 28 * s, 0, Math.PI * 2);
    ctx.arc(x + 54 * s, y, 24 * s, 0, Math.PI * 2);
    ctx.arc(x + 28 * s, y + 8 * s, 22 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private injectStyle(): void {
    if (document.getElementById("rdm-style")) return;
    const st = document.createElement("style");
    st.id = "rdm-style";
    st.textContent = RDM_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function RDM_CSS(theme: string): string {
  return `
.rdm-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.rdm-bar{display:flex;gap:28px;font-size:1.3rem;font-weight:900;background:linear-gradient(180deg,#fff,#eef4fb);padding:10px 26px;border-radius:999px;box-shadow:var(--shadow);border:2px solid #cfe0f0;}
.rdm-task{font-size:1.12rem;font-weight:800;text-align:center;background:linear-gradient(180deg,#fff,#eef4fb);padding:10px 20px;border-radius:16px;box-shadow:var(--shadow);border:2px solid #cfe0f0;}
.rdm-task b{color:${theme};font-size:1.35rem;}
.rdm-canvas{border-radius:24px;box-shadow:var(--shadow);touch-action:none;cursor:none;border:3px solid rgba(255,255,255,.5);}
`;
}

export function create(): RaindropMathGame {
  return new RaindropMathGame();
}
