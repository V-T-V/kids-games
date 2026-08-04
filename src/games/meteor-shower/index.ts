/* 流星雨 Meteor Shower —— 流星拖着发光尾巴从天上划过，孩子在底部移动星盘接住。
   独特点：实时 RAF + Canvas 拖尾粒子，是连续动作反应游戏。
   巧思：流星有重力加速度和发光拖尾，接住迸发星屑；难度=流星数+速度。
   通关=累计接住目标数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { bindPointer } from "../../core/input.ts";
import { createRafLoop } from "../../core/loop.ts";
import { starsByScore } from "../../core/scoring.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

const METEOR_COLORS = [
  "#ffd93d",
  "#ff9f43",
  "#ff6b9d",
  "#a55eea",
  "#4d96ff",
  "#22d3ee",
];

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  trail: { x: number; y: number }[];
  radius: number;
}

export class MeteorShowerGame extends BaseGame {
  constructor() {
    super("meteor-shower");
  }

  private canvas!: HTMLCanvasElement;
  private ctx2d!: CanvasRenderingContext2D;
  private unbind: (() => void) | null = null;
  private stop?: () => void;

  private meteors: Meteor[] = [];
  private catcherX = 0;
  private fieldW = 0;
  private fieldH = 0;
  private target = 0;
  private caught = 0;
  private missed = 0;
  private lastSpawn = 0;
  private spawnGap = 900;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startGame();
  }

  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
    this.unbind?.();
    this.unbind = null;
  }

  private startGame(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.caught = 0;
    this.missed = 0;
    this.over = false;
    this.meteors = [];

    const targetByDiff =
      this.difficulty === "easy" ? 8 : this.difficulty === "medium" ? 10 : 12;
    this.target = targetByDiff;
    this.spawnGap =
      this.difficulty === "easy"
        ? 1100
        : this.difficulty === "medium"
          ? 850
          : 650;

    const wrap = document.createElement("div");
    wrap.className = "mts-wrap";

    const bar = document.createElement("div");
    bar.className = "mts-bar";
    bar.innerHTML = `<div id="mts-caught">⭐ 0 / ${this.target}</div><div id="mts-miss">💧 0</div>`;
    wrap.appendChild(bar);

    const task = document.createElement("div");
    task.className = "mts-task";
    task.textContent = "移动星盘，接住落下的流星～";
    wrap.appendChild(task);

    const field = document.createElement("div");
    field.className = "mts-field";
    this.canvas = document.createElement("canvas");
    this.canvas.className = "mts-canvas";
    field.appendChild(this.canvas);
    wrap.appendChild(field);
    this.root.appendChild(wrap);

    // 初始化画布尺寸
    this.resize();
    this.catcherX = this.fieldW / 2;
    this.unbind = bindPointer(field, {
      move: (p) => this.moveCatcher(p),
      down: (p) => this.moveCatcher(p),
    });

    this.lastSpawn = performance.now();
    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  private resize(): void {
    const field = this.canvas.parentElement!;
    const r = field.getBoundingClientRect();
    this.fieldW = Math.max(200, r.width);
    this.fieldH = Math.max(260, r.height);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(this.fieldW * dpr);
    this.canvas.height = Math.floor(this.fieldH * dpr);
    this.canvas.style.width = `${this.fieldW}px`;
    this.canvas.style.height = `${this.fieldH}px`;
    this.ctx2d = this.canvas.getContext("2d")!;
    this.ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private moveCatcher(p: { x: number; y: number }): void {
    const r = this.canvas.getBoundingClientRect();
    const x = p.x - r.left;
    this.catcherX = Math.max(40, Math.min(this.fieldW - 40, x));
  }

  private spawn(): void {
    const radius = randInt(9, 14);
    const x = randInt(radius + 10, this.fieldW - radius - 10);
    const speed =
      this.difficulty === "easy"
        ? 90
        : this.difficulty === "medium"
          ? 130
          : 175;
    const drift = randInt(-25, 25);
    this.meteors.push({
      x,
      y: -20,
      vx: drift,
      vy: speed,
      color: sample(METEOR_COLORS),
      trail: [],
      radius,
    });
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

    const ctx = this.ctx2d;
    ctx.clearRect(0, 0, this.fieldW, this.fieldH);

    // 背景：夜空渐变 + 闪烁星点
    this.drawSky(ctx);

    const catcherY = this.fieldH - 28;
    const catcherHalf = 42;

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]!;
      m.vy += 18 * dt; // 轻微加速
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 12) m.trail.shift();

      // 画拖尾
      this.drawMeteor(ctx, m);

      // 接住检测
      if (
        m.y > catcherY - 18 &&
        m.y < catcherY + 18 &&
        Math.abs(m.x - this.catcherX) < catcherHalf
      ) {
        this.catchOne(m);
        this.meteors.splice(i, 1);
        continue;
      }
      // 漏掉
      if (m.y > this.fieldH + 30) {
        this.missOne();
        this.meteors.splice(i, 1);
      }
    }

    // 画接物器
    this.drawCatcher(ctx, this.catcherX, catcherY);
  };

  private drawSky(ctx: CanvasRenderingContext2D): void {
    // 简易星点（用固定伪随机种子位置避免抖动）
    ctx.fillStyle = "rgba(255,255,255,.55)";
    for (let i = 0; i < 30; i++) {
      const sx = (i * 97.13) % this.fieldW;
      const sy = (i * 53.7) % (this.fieldH * 0.6);
      const tw = 0.5 + 0.5 * Math.sin(performance.now() / 600 + i);
      ctx.globalAlpha = 0.3 + tw * 0.5;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  private drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor): void {
    // 拖尾
    for (let i = 0; i < m.trail.length; i++) {
      const t = m.trail[i]!;
      const alpha = (i + 1) / m.trail.length;
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, m.radius * alpha * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 头部光球（径向渐变）
    const grad = ctx.createRadialGradient(m.x, m.y, 1, m.x, m.y, m.radius + 6);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.4, m.color);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius + 6, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCatcher(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
  ): void {
    // 星盘：碗 + 发光边
    ctx.save();
    const grad = ctx.createLinearGradient(x - 44, y, x + 44, y);
    grad.addColorStop(0, "#a55eea");
    grad.addColorStop(0.5, "#ffffff");
    grad.addColorStop(1, "#4d96ff");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - 44, y - 8);
    ctx.quadraticCurveTo(x, y + 22, x + 44, y - 8);
    ctx.lineTo(x + 44, y - 14);
    ctx.lineTo(x - 44, y - 14);
    ctx.closePath();
    ctx.fill();
    // 顶部高光
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.fillRect(x - 44, y - 16, 88, 4);
    ctx.restore();
  }

  private catchOne(m: Meteor): void {
    this.caught += 1;
    sfxPop();
    this.resetWrongStreak();
    const rect = this.canvas.getBoundingClientRect();
    burst(rect.left + m.x, rect.top + m.y, 10);
    this.updateBar();
    if (this.caught >= this.target) {
      this.end();
    }
  }

  private missOne(): void {
    this.missed += 1;
    this.updateBar();
    // 漏掉不直接扣命，靠最终按接住数算星
  }

  private updateBar(): void {
    const c = this.root.querySelector("#mts-caught");
    if (c) c.textContent = `⭐ ${this.caught} / ${this.target}`;
    const m = this.root.querySelector("#mts-miss");
    if (m) m.textContent = `💧 ${this.missed}`;
  }

  private end(): void {
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    const stars = starsByScore(this.caught, [
      this.target,
      Math.ceil(this.target * 0.7),
    ]);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(stars);
      } else {
        this.startGame();
      }
    }, 600);
  }

  private injectStyle(): void {
    if (document.getElementById("mts-style")) return;
    const st = document.createElement("style");
    st.id = "mts-style";
    st.textContent = MTS_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function MTS_CSS(theme: string): string {
  void theme;
  return `
.mts-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;width:min(480px,100%);}
.mts-bar{display:flex;gap:24px;font-size:1.25rem;font-weight:800;background:#fff;padding:8px 24px;border-radius:999px;box-shadow:var(--shadow);}
.mts-task{font-size:1rem;font-weight:700;color:var(--ink-soft);}
.mts-field{position:relative;width:100%;height:62vh;min-height:360px;background:linear-gradient(180deg,#1a1a3e 0%,#2d1b4e 60%,#4a2c5a 100%);border-radius:22px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:none;}
.mts-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
@media (max-width:380px){.mts-field{height:55vh;min-height:300px;}.mts-bar{font-size:1.05rem;padding:6px 16px;gap:14px;}}
`;
}

export function create(): MeteorShowerGame {
  return new MeteorShowerGame();
}
