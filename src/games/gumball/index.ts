/* 弹珠机 Gumball —— 弹珠从顶部经钉子弹跳落下，底部有彩色槽，
   孩子移动底部接物篮，接住"指定颜色"的弹珠。
   独特点：物理弹跳 + 颜色筛选 + 精确接物，强调眼手协调。
   巧思：钉子网格用确定的小随机偏移；目标色弹珠会批量投放，篮子够宽，
   保证只要移到大致落点就能接住（有解）。难度=弹珠数/颜色数。通关=接对目标数。
   Canvas 渲染，c2d 上下文；RAF 驱动，unmount 必须 cancelAnimationFrame。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  /** 是否为目标色 */
  target: boolean;
  /** 是否已计分/被接或落底 */
  done: boolean;
  r: number;
}

interface Peg {
  x: number;
  y: number;
  r: number;
}

const PALETTE = ["#ff6b9d", "#4d96ff", "#ffd93d", "#6bcf7f", "#a55eea"];

export class GumballGame extends BaseGame {
  constructor() {
    super("gumball");
  }

  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private raf = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private unbind: (() => void) | null = null;

  private W = 0;
  private H = 0;
  private R = 9; // 弹珠半径
  private pegs: Peg[] = [];
  private balls: Ball[] = [];

  /** 当前目标颜色 */
  private targetColor = "";
  /** 目标色总投放数（即满分母） */
  private targetTotal = 0;
  /** 已接住的目标数 */
  private caught = 0;
  /** 已投放目标数 */
  private spawnedTarget = 0;
  /** 已投放非目标数 */
  private spawnedOther = 0;
  /** 最大非目标投放（避免无限干扰） */
  private maxOther = 0;

  /** 篮子中心 x（相对 canvas） */
  private basketX = 0;
  private readonly basketW = 92;
  private basketY = 0; // 运行时设
  /** 下一颗弹珠投放计时（秒） */
  private spawnTimer = 0;

  protected mount(): void {
    this.targetTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.maxOther =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 5 : 7;
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.setup();
  }

  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unbind?.();
    this.unbind = null;
  }

  private colorCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private setup(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.over = false;
    this.caught = 0;
    this.spawnedTarget = 0;
    this.spawnedOther = 0;
    this.balls = [];
    this.spawnTimer = 0.4;

    const colors = shuffle(PALETTE.slice(0, this.colorCount()));
    this.targetColor = colors[0]!;

    const wrap = document.createElement("div");
    wrap.className = "gb2-wrap";

    const task = document.createElement("div");
    task.className = "gb2-task";
    task.innerHTML = `移动篮子，<b>只接</b> `;
    const swatch = document.createElement("span");
    swatch.className = "gb2-swatch";
    swatch.style.setProperty("--gb2-c", this.targetColor);
    task.appendChild(swatch);
    task.appendChild(document.createTextNode(` 颜色的弹珠！ · `));
    const score = document.createElement("span");
    score.id = "gb2-score";
    score.textContent = `0 / ${this.targetTotal}`;
    task.appendChild(score);
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.c2d = this.canvas.getContext("2d")!;
    wrap.appendChild(this.canvas);
    this.root.appendChild(wrap);

    this.resize();
    // 钉子布局：均匀网格，轻微行错位，避免弹珠直冲
    this.pegs = [];
    const rows = 5;
    const cols = 7;
    const topPad = 70;
    const botPad = 90; // 留给篮子区域
    const usableH = this.H - topPad - botPad;
    for (let r = 0; r < rows; r++) {
      const yOff = topPad + (usableH * (r + 0.5)) / rows;
      const odd = r % 2 === 1;
      for (let c = 0; c < cols; c++) {
        if (odd && (c === 0 || c === cols - 1)) continue; // 边缘省一颗
        const x = ((c + (odd ? 0.5 : 0)) / (cols - 1)) * (this.W - 40) + 20;
        this.pegs.push({ x, y: yOff, r: 4 });
      }
    }
    this.basketY = this.H - 42;
    this.basketX = this.W / 2;

    this.unbind = bindPointer(this.canvas, {
      down: (p) => this.moveBasket(p),
      move: (p) => this.moveBasket(p),
    });

    this.last = performance.now();
    this.loop();
  }

  private resize(): void {
    const maxW = Math.min(420, window.innerWidth - 32);
    this.W = maxW;
    this.H = Math.max(440, Math.min(560, Math.floor(maxW * 1.32)));
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private moveBasket(p: { x: number }): void {
    if (this.over) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = p.x - rect.left;
    this.basketX = Math.max(
      this.basketW / 2,
      Math.min(this.W - this.basketW / 2, x),
    );
  }

  private last = 0;
  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    // 投放弹珠：目标色弹珠 + 干扰色，间隔 0.55s
    if (this.spawnTimer <= 0 && this.spawnedTarget < this.targetTotal) {
      // 优先投放目标色，按节奏混入干扰
      const wantOther =
        this.spawnedOther < this.maxOther && Math.random() < 0.45;
      const isTarget = !wantOther;
      let color: string;
      if (isTarget) {
        color = this.targetColor;
        this.spawnedTarget += 1;
      } else {
        // 选一个非目标色
        const others = PALETTE.filter((c) => c !== this.targetColor);
        color = sample(others);
        this.spawnedOther += 1;
      }
      // 投放 x：目标色统一从中央通道（保证可接），干扰色随机分散
      const dropX = isTarget
        ? this.W / 2 + (Math.random() - 0.5) * 30
        : 40 + Math.random() * (this.W - 80);
      this.balls.push({
        x: dropX,
        y: 18,
        vx: (Math.random() - 0.5) * 10,
        vy: 20,
        color,
        target: isTarget,
        done: false,
        r: this.R,
      });
      this.spawnTimer = 0.55;
    }
    this.spawnTimer -= dt;

    // 物理更新
    const gravity = 620;
    for (const b of this.balls) {
      if (b.done) continue;
      b.vy += gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // 左右墙反弹
      if (b.x < b.r) {
        b.x = b.r;
        b.vx = Math.abs(b.vx) * 0.7;
      }
      if (b.x > this.W - b.r) {
        b.x = this.W - b.r;
        b.vx = -Math.abs(b.vx) * 0.7;
      }
      // 钉子碰撞（简单弹性）
      for (const peg of this.pegs) {
        const dx = b.x - peg.x;
        const dy = b.y - peg.y;
        const dist2 = dx * dx + dy * dy;
        const minD = b.r + peg.r;
        if (dist2 < minD * minD) {
          const dist = Math.sqrt(dist2) || 0.01;
          const nx = dx / dist;
          const ny = dy / dist;
          // 推出
          b.x = peg.x + nx * minD;
          b.y = peg.y + ny * minD;
          // 反射速度
          const dot = b.vx * nx + b.vy * ny;
          b.vx = (b.vx - 2 * dot * nx) * 0.55;
          b.vy = (b.vy - 2 * dot * ny) * 0.55;
          // 轻微横向扰动（钉子效果）
          b.vx += (Math.random() - 0.5) * 24;
        }
      }
      // 检测接住：进入篮口高度区间且 x 在篮子范围内
      const basketTop = this.basketY - 6;
      if (
        b.y + b.r >= basketTop &&
        b.y - b.r <= this.basketY + 10 &&
        Math.abs(b.x - this.basketX) < this.basketW / 2
      ) {
        b.done = true;
        if (b.target) {
          this.caught += 1;
          sfxPop();
          const rect = this.canvas.getBoundingClientRect();
          burst(rect.left + b.x, rect.top + basketTop, 12, ["star", "circle"]);
          this.resetWrongStreak();
          this.updateScore();
          if (this.caught >= this.targetTotal) {
            this.win();
            return;
          }
        } else {
          // 接了非目标：温柔提示（不算硬性错误，但累加 wrongCount 影响星级）
          this.onWrong();
        }
      }
      // 落到底部消失
      if (b.y - b.r > this.H) {
        b.done = true;
        // 漏接目标色 = 轻微反馈（不重开，继续投放）
        if (b.target) {
          this.onWrong();
        }
      }
    }
    // 清理已完成弹珠
    this.balls = this.balls.filter((b) => !b.done);
  }

  private updateScore(): void {
    const el = this.root.querySelector("#gb2-score");
    if (el) el.textContent = `${this.caught} / ${this.targetTotal}`;
  }

  private win(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(
          this.wrongCount === 0 ? 3 : this.wrongCount <= 3 ? 2 : 1,
        );
      } else {
        this.setup();
      }
    }, 600);
  }

  private draw(): void {
    const ctx = this.c2d;
    ctx.clearRect(0, 0, this.W, this.H);
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, "rgba(255,217,61,0.10)");
    g.addColorStop(1, "rgba(255,255,255,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    // 钉子
    ctx.fillStyle = "#8a7fa3";
    for (const peg of this.pegs) {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
      ctx.fill();
      // 高光
      ctx.fillStyle = "rgba(255,255,255,.6)";
      ctx.beginPath();
      ctx.arc(peg.x - 1, peg.y - 1, peg.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8a7fa3";
    }

    // 弹珠
    for (const b of this.balls) {
      this.drawBall(b.x, b.y, b.color, b.target);
    }

    // 篮子
    const bx = this.basketX;
    const by = this.basketY;
    const bw = this.basketW;
    ctx.save();
    // 篮体
    ctx.fillStyle = "#b08968";
    ctx.strokeStyle = "#7a5a3e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx - bw / 2, by);
    ctx.lineTo(bx - bw / 2 + 6, by + 26);
    ctx.lineTo(bx + bw / 2 - 6, by + 26);
    ctx.lineTo(bx + bw / 2, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 篮口（目标色高亮，提示接什么色）
    ctx.strokeStyle = this.targetColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bx - bw / 2, by);
    ctx.lineTo(bx + bw / 2, by);
    ctx.stroke();
    // 编织纹
    ctx.strokeStyle = "rgba(122,90,62,.5)";
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) {
      const yy = by + i * 6;
      ctx.beginPath();
      ctx.moveTo(bx - bw / 2 + 4, yy);
      ctx.lineTo(bx + bw / 2 - 4, yy);
      ctx.stroke();
    }
    ctx.restore();

    // 目标色提示条（顶部）
    ctx.fillStyle = this.targetColor;
    ctx.fillRect(0, 0, 8, this.H);
  }

  private drawBall(x: number, y: number, color: string, target: boolean): void {
    const ctx = this.c2d;
    const r = this.R;
    ctx.save();
    const grad = ctx.createRadialGradient(
      x - r * 0.3,
      y - r * 0.3,
      r * 0.1,
      x,
      y,
      r,
    );
    grad.addColorStop(0, this.lighten(color, 0.5));
    grad.addColorStop(0.7, color);
    grad.addColorStop(1, this.darken(color, 0.25));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = "rgba(255,255,255,.6)";
    ctx.beginPath();
    ctx.ellipse(
      x - r * 0.3,
      y - r * 0.35,
      r * 0.28,
      r * 0.18,
      -0.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // 目标色描边（便于辨认）
    if (target) {
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 1, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private lighten(hex: string, amt: number): string {
    const { r, g, b } = this.parse(hex);
    return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(g + (255 - g) * amt)},${Math.round(b + (255 - b) * amt)})`;
  }
  private darken(hex: string, amt: number): string {
    const { r, g, b } = this.parse(hex);
    return `rgb(${Math.round(r * (1 - amt))},${Math.round(g * (1 - amt))},${Math.round(b * (1 - amt))})`;
  }
  private parse(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace("#", "");
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  private injectStyle(): void {
    if (document.getElementById("gb2-style")) return;
    const st = document.createElement("style");
    st.id = "gb2-style";
    st.textContent = GB2_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function GB2_CSS(_theme: string): string {
  return `
.gb2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;}
.gb2-task{font-size:1.1rem;font-weight:800;text-align:center;display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.gb2-task b{color:#3a2e4a;}
.gb2-swatch{display:inline-block;width:22px;height:22px;border-radius:50%;background:var(--gb2-c,#ff6b9d);box-shadow:inset 0 -2px 3px rgba(0,0,0,.25),0 2px 4px rgba(0,0,0,.25);border:2px solid #fff;}
.gb2-wrap canvas{border-radius:20px;background:rgba(255,255,255,.5);box-shadow:var(--shadow-lg);touch-action:none;cursor:crosshair;}
#gb2-score{color:var(--c-orange);font-weight:900;}
@media (max-width:380px){.gb2-task{font-size:.95rem;}}
`;
}

export function create(): GumballGame {
  return new GumballGame();
}
