/* 弹珠台 Pinball —— 弹珠从顶部释放，撞钉子随机弹跳，落进底部不同分值槽。
   独特点：纯 Canvas 物理模拟（重力 + 钉子弹性碰撞 + 分值槽）。
   视觉：发光钉子、带轨迹的弹珠、彩色分值槽、落槽迸发粒子。
   难度=钉子密度（easy 稀疏 / hard 密集）。通关=累计达到目标分。
   点击释放弹珠，可同时存在多颗。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";
import { starsByScore } from "../../core/scoring.ts";

interface Peg {
  x: number;
  y: number;
  r: number;
  hit: number;
}
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  trail: { x: number; y: number }[];
  dead: boolean;
}

interface Slot {
  x: number;
  w: number;
  score: number;
  color: string;
}

export class PinballGame extends BaseGame {
  constructor() {
    super("pinball");
  }

  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private raf = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;

  private W = 0;
  private H = 0;
  private pegs: Peg[] = [];
  private balls: Ball[] = [];
  private slots: Slot[] = [];

  private score = 0;
  private target = 0;
  private ballsLeft = 0;

  protected mount(): void {
    this.target =
      this.difficulty === "easy" ? 30 : this.difficulty === "medium" ? 45 : 60;
    this.ballsLeft =
      this.difficulty === "easy" ? 8 : this.difficulty === "medium" ? 7 : 6;
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.setup();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
  }

  private setup(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.over = false;
    this.score = 0;
    this.balls = [];

    const wrap = document.createElement("div");
    wrap.className = "pb-wrap";

    const bar = document.createElement("div");
    bar.className = "pb-bar";
    bar.innerHTML = `<div id="pb-score">⭐ <b>0</b> / ${this.target}</div><div id="pb-balls">🎱 ×${this.ballsLeft}</div>`;
    wrap.appendChild(bar);

    this.canvas = document.createElement("canvas");
    this.c2d = this.canvas.getContext("2d")!;
    wrap.appendChild(this.canvas);

    const dropBtn = document.createElement("button");
    dropBtn.type = "button";
    dropBtn.className = "pb-btn";
    dropBtn.textContent = "🎱 释放弹珠";
    dropBtn.id = "pb-drop";
    dropBtn.addEventListener("click", () => this.dropBall());
    wrap.appendChild(dropBtn);

    this.root.appendChild(wrap);
    this.resize();
    this.layoutPegs();
    this.loop();
  }

  private resize(): void {
    const w = Math.min(340, window.innerWidth - 32);
    this.W = w;
    this.H = Math.min(520, window.innerHeight - 220);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private layoutPegs(): void {
    this.pegs = [];
    const density =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    const rows = density + 2;
    const topPad = 70;
    const botPad = 90; // 给槽留空间
    const usableH = this.H - topPad - botPad;
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 === 0 ? 0 : 1;
      const cols = density + offset;
      const y = topPad + (usableH / (rows - 1)) * r;
      for (let c = 0; c < cols; c++) {
        // 交错布局：奇偶行错开
        const xx = (this.W / cols) * c + this.W / cols / 2;
        this.pegs.push({ x: xx, y, r: 6, hit: 0 });
      }
    }
    // 底部分值槽
    const slotCount = 6;
    const colors = [
      "#ff6b9d",
      "#ffd93d",
      "#6bcf7f",
      "#4d96ff",
      "#a55eea",
      "#ff9f43",
    ];
    const scores = [10, 5, 2, 2, 5, 10];
    this.slots = [];
    const sw = this.W / slotCount;
    for (let i = 0; i < slotCount; i++) {
      this.slots.push({
        x: i * sw,
        w: sw,
        score: scores[i]!,
        color: colors[i % colors.length]!,
      });
    }
  }

  private dropBall(): void {
    if (this.ballsLeft <= 0 || this.over) return;
    this.ballsLeft -= 1;
    const label = this.root.querySelector("#pb-balls");
    if (label) label.textContent = `🎱 ×${this.ballsLeft}`;
    // 从顶部随机 x 释放（带轻微水平初速）
    const startX = this.W / 2 + (Math.random() - 0.5) * (this.W * 0.3);
    this.balls.push({
      x: startX,
      y: 20,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1,
      r: 8,
      trail: [],
      dead: false,
    });
    sfxPop();
    if (this.ballsLeft <= 0) {
      const btn = this.root.querySelector<HTMLButtonElement>("#pb-drop");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "等弹珠落完…";
      }
    }
  }

  private loop = (): void => {
    if (this.over) return;
    this.update();
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(): void {
    const g = 0.18;
    for (const ball of this.balls) {
      if (ball.dead) continue;
      ball.vy += g;
      ball.vx *= 0.998;
      ball.x += ball.vx;
      ball.y += ball.vy;
      // 轨迹
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 8) ball.trail.shift();
      // 左右墙
      if (ball.x < ball.r) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx) * 0.8;
      }
      if (ball.x > this.W - ball.r) {
        ball.x = this.W - ball.r;
        ball.vx = -Math.abs(ball.vx) * 0.8;
      }
      // 钉子碰撞
      for (const peg of this.pegs) {
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const dist = Math.hypot(dx, dy);
        const minD = ball.r + peg.r;
        if (dist < minD && dist > 0.0001) {
          // 推开 + 反弹
          const nx = dx / dist;
          const ny = dy / dist;
          ball.x = peg.x + nx * minD;
          ball.y = peg.y + ny * minD;
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx = (ball.vx - 2 * dot * nx) * 0.7;
          ball.vy = (ball.vy - 2 * dot * ny) * 0.7;
          // 增加随机性（儿童游戏更 unpredictable 有趣）
          ball.vx += (Math.random() - 0.5) * 0.8;
          peg.hit = 1;
        }
      }
      // 衰减钉子高亮
      for (const peg of this.pegs) {
        if (peg.hit > 0) peg.hit = Math.max(0, peg.hit - 0.05);
      }
      // 落槽
      const slotTop = this.H - 60;
      if (ball.y > slotTop + 8) {
        // 确定落在哪个槽
        const idx = Math.min(
          this.slots.length - 1,
          Math.max(0, Math.floor(ball.x / (this.W / this.slots.length))),
        );
        const slot = this.slots[idx]!;
        this.score += slot.score;
        ball.dead = true;
        const rect = this.canvas.getBoundingClientRect();
        burst(rect.left + ball.x, rect.top + ball.y, 14, ["star", "circle"]);
        const sl = this.root.querySelector("#pb-score");
        if (sl) sl.innerHTML = `⭐ <b>${this.score}</b> / ${this.target}`;
        // 颜色对答对反馈（高分槽给正反馈）
        if (slot.score >= 5) {
          this.onCorrect(rect.left + ball.x, rect.top + ball.y);
          this.resetWrongStreak();
        } else {
          sfxPop();
        }
      }
    }
    this.balls = this.balls.filter((b) => !b.dead);
    // 全部落完且没球了 → 结算
    if (this.ballsLeft <= 0 && this.balls.length === 0 && !this.over) {
      this.over = true;
      cancelAnimationFrame(this.raf);
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
          this.setup();
        }
      }, 600);
    }
  }

  private draw(): void {
    const ctx = this.c2d;
    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, "rgba(165,94,234,0.12)");
    bg.addColorStop(1, "rgba(255,255,255,0.55)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.W, this.H);

    // 钉子
    for (const peg of this.pegs) {
      ctx.save();
      const glow = peg.hit;
      ctx.shadowColor = getCssVar("--c-purple");
      ctx.shadowBlur = glow > 0 ? 14 : 4;
      const grad = ctx.createRadialGradient(
        peg.x - 2,
        peg.y - 2,
        1,
        peg.x,
        peg.y,
        peg.r,
      );
      grad.addColorStop(0, "#fff");
      grad.addColorStop(1, glow > 0 ? "#ffd93d" : "#c9b8e8");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 弹珠轨迹 + 本体
    for (const ball of this.balls) {
      ctx.save();
      // 轨迹
      for (let i = 0; i < ball.trail.length; i++) {
        const t = ball.trail[i]!;
        ctx.globalAlpha = (i / ball.trail.length) * 0.4;
        ctx.fillStyle = getCssVar("--c-cyan");
        ctx.beginPath();
        ctx.arc(
          t.x,
          t.y,
          ball.r * (i / ball.trail.length) * 0.8,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowColor = "#4d96ff";
      ctx.shadowBlur = 10;
      const grad = ctx.createRadialGradient(
        ball.x - 3,
        ball.y - 3,
        1,
        ball.x,
        ball.y,
        ball.r,
      );
      grad.addColorStop(0, "#fff");
      grad.addColorStop(0.5, "#4d96ff");
      grad.addColorStop(1, "#2f6dd6");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 分值槽
    const slotTop = this.H - 60;
    for (const slot of this.slots) {
      ctx.fillStyle = slot.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(slot.x + 2, slotTop, slot.w - 4, 60);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${slot.score}`, slot.x + slot.w / 2, slotTop + 30);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("pb-style")) return;
    const st = document.createElement("style");
    st.id = "pb-style";
    st.textContent = PB_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function PB_CSS(theme: string): string {
  return `
.pb-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;}
.pb-bar{display:flex;gap:28px;font-size:1.2rem;font-weight:800;background:#fff;padding:8px 24px;border-radius:999px;box-shadow:var(--shadow);}
.pb-bar b{color:${theme};}
.pb-wrap canvas{border-radius:20px;background:rgba(255,255,255,.5);box-shadow:var(--shadow-lg);touch-action:none;}
.pb-btn{min-height:60px;padding:0 40px;font-size:1.2rem;font-weight:800;border-radius:999px;background:${theme};color:#fff;box-shadow:0 6px 0 #6b2eb8,var(--shadow);}
.pb-btn:active{transform:translateY(3px);box-shadow:0 3px 0 #6b2eb8,var(--shadow);}
.pb-btn:disabled{opacity:.55;}
`;
}

export function create(): PinballGame {
  return new PinballGame();
}

void randInt;
