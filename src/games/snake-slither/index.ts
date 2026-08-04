/* 蛇行 Snake Slither —— 蛇在地面 S 形前进，自动移动，孩子控制左/右转向，
   避开障碍、收集蛋。独特点：连续 RAF 驱动的流畅蛇身（圆节渐变）+ 发光蛋。
   视觉：Canvas 绘制，蛇头有眼睛 + 舌头，蛋脉动发光，障碍是石头。
   难度=障碍数量。通关=收集目标蛋数。碰障碍重开本轮。用 RAF。前缀 ssk-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar } from "../../lobby/util.ts";

type Dir = "up" | "down" | "left" | "right";

interface Pt {
  x: number;
  y: number;
}

export class SnakeSlitherGame extends BaseGame {
  constructor() {
    super("snake-slither");
  }

  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private over = false;
  private cleared = false;

  private grid = 11;
  private cell = 0;
  private W = 0;

  private snake: Pt[] = [];
  private dir: Dir = "right";
  private nextDir: Dir = "right";
  private eggs: Pt[] = [];
  private rocks: Pt[] = [];
  private collected = 0;
  private target = 0;
  private pulse = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private onKey: ((e: KeyboardEvent) => void) | null = null;

  protected mount(): void {
    this.grid =
      this.difficulty === "easy" ? 9 : this.difficulty === "medium" ? 11 : 13;
    this.target =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.injectStyle();
    this.setup();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.onKey) {
      window.removeEventListener("keydown", this.onKey);
      this.onKey = null;
    }
  }

  private rockCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 6
        : 10;
  }

  /** 步进间隔毫秒：越快越难 */
  private stepMs(): number {
    return this.difficulty === "easy"
      ? 260
      : this.difficulty === "medium"
        ? 210
        : 170;
  }

  private setup(): void {
    if (this.onKey) {
      window.removeEventListener("keydown", this.onKey);
      this.onKey = null;
    }
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.over = false;
    this.cleared = false;
    this.collected = 0;
    this.dir = "right";
    this.nextDir = "right";

    const wrap = document.createElement("div");
    wrap.className = "ssk-wrap";

    const task = document.createElement("div");
    task.className = "ssk-task";
    task.innerHTML = `吃到 <span id="ssk-eat">0</span> / ${this.target} 颗蛋 🥚，别撞石头！`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.c2d = this.canvas.getContext("2d")!;
    wrap.appendChild(this.canvas);

    // 方向按钮：只有左转 / 右转（儿童友好，避免 180°）
    const pad = document.createElement("div");
    pad.className = "ssk-pad";
    const mk = (label: string, fn: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ssk-btn";
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    };
    pad.appendChild(mk("↪️ 向右转", () => this.turn(1)));
    pad.appendChild(mk("↩️ 向左转", () => this.turn(-1)));
    wrap.appendChild(pad);

    this.root.appendChild(wrap);

    this.resize();
    this.initSnake();
    this.placeRocks();
    this.spawnEgg();
    this.draw();

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);

    this.onKey = (e: KeyboardEvent): void => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        this.turn(-1);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        this.turn(1);
      }
    };
    window.addEventListener("keydown", this.onKey);
  }

  /** turn: +1 顺时针，-1 逆时针 */
  private turn(d: number): void {
    if (this.over) return;
    const order: Dir[] = ["up", "right", "down", "left"];
    const idx = order.indexOf(this.nextDir);
    const ni = (idx + d + 4) % 4;
    this.nextDir = order[ni]!;
  }

  private resize(): void {
    const size = Math.min(380, window.innerWidth - 32);
    this.W = size;
    this.cell = Math.floor(size / this.grid);
    const px = this.cell * this.grid;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = px * dpr;
    this.canvas.height = px * dpr;
    this.canvas.style.width = `${px}px`;
    this.canvas.style.height = `${px}px`;
    this.c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private initSnake(): void {
    const mid = Math.floor(this.grid / 2);
    this.snake = [
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
      { x: mid - 3, y: mid },
    ];
  }

  /** 占用判断：蛇身或石头 */
  private isOccupied(x: number, y: number, includeTail = true): boolean {
    const body = includeTail ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.x === x && s.y === y)) return true;
    if (this.rocks.some((r) => r.x === x && r.y === y)) return true;
    return false;
  }

  private placeRocks(): void {
    this.rocks = [];
    const want = this.rockCount();
    let tries = 0;
    while (this.rocks.length < want && tries < 500) {
      tries += 1;
      const x = Math.floor(Math.random() * this.grid);
      const y = Math.floor(Math.random() * this.grid);
      if (this.isOccupied(x, y)) continue;
      // 留出蛇头前方通道（避免紧贴蛇头生成）
      const head = this.snake[0]!;
      if (Math.abs(x - head.x) + Math.abs(y - head.y) < 3) continue;
      this.rocks.push({ x, y });
    }
  }

  private spawnEgg(): void {
    this.eggs = [];
    let tries = 0;
    while (tries < 300) {
      tries += 1;
      const x = Math.floor(Math.random() * this.grid);
      const y = Math.floor(Math.random() * this.grid);
      if (this.isOccupied(x, y)) continue;
      this.eggs.push({ x, y });
      return;
    }
    // 兜底：扫网格
    for (let y = 0; y < this.grid; y++) {
      for (let x = 0; x < this.grid; x++) {
        if (!this.isOccupied(x, y)) {
          this.eggs.push({ x, y });
          return;
        }
      }
    }
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    const step = this.stepMs();
    if (now - this.last >= step) {
      this.last = now;
      this.tick();
    }
    if (this.over) return;
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private tick(): void {
    this.dir = this.nextDir;
    const head = this.snake[0]!;
    let nx = head.x;
    let ny = head.y;
    if (this.dir === "up") ny -= 1;
    if (this.dir === "down") ny += 1;
    if (this.dir === "left") nx -= 1;
    if (this.dir === "right") nx += 1;
    // 撞墙
    if (nx < 0 || ny < 0 || nx >= this.grid || ny >= this.grid) {
      this.hitRock();
      return;
    }
    // 撞石头
    if (this.rocks.some((r) => r.x === nx && r.y === ny)) {
      this.hitRock();
      return;
    }
    // 是否吃蛋
    const ate = this.eggs.some((e) => e.x === nx && e.y === ny);
    // 撞自身（尾巴若不吃蛋会移走）
    const body = ate ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.x === nx && s.y === ny)) {
      this.hitRock();
      return;
    }
    this.snake.unshift({ x: nx, y: ny });
    if (ate) {
      this.collected += 1;
      sfxPop();
      const rect = this.canvas.getBoundingClientRect();
      burst(
        rect.left + (nx + 0.5) * this.cell,
        rect.top + (ny + 0.5) * this.cell,
        14,
        ["star", "heart"],
      );
      this.onCorrect(
        rect.left + (nx + 0.5) * this.cell,
        rect.top + (ny + 0.5) * this.cell,
      );
      this.resetWrongStreak();
      this.spawnEgg();
      const eat = this.root.querySelector("#ssk-eat");
      if (eat) eat.textContent = String(this.collected);
      if (this.collected >= this.target) {
        this.win();
        return;
      }
    } else {
      this.snake.pop();
    }
  }

  private hitRock(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.onWrong();
    this.draw(true);
    this.trackTimeout(() => this.setup(), 1100);
  }

  private win(): void {
    if (this.cleared) return;
    this.cleared = true;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.setup();
      }
    }, 600);
  }

  private draw(dead = false): void {
    const ctx = this.c2d;
    const px = this.cell * this.grid;
    // 地面
    ctx.fillStyle = dead ? "rgba(255,99,72,0.18)" : "rgba(107,207,127,0.10)";
    ctx.fillRect(0, 0, px, px);
    // 网格线
    ctx.strokeStyle = "rgba(58,46,74,0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < this.grid; i++) {
      ctx.beginPath();
      ctx.moveTo(i * this.cell, 0);
      ctx.lineTo(i * this.cell, px);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * this.cell);
      ctx.lineTo(px, i * this.cell);
      ctx.stroke();
    }
    // 石头
    for (const r of this.rocks) {
      const cx = (r.x + 0.5) * this.cell;
      const cy = (r.y + 0.5) * this.cell;
      ctx.save();
      ctx.translate(cx, cy);
      const rad = this.cell * 0.42;
      ctx.fillStyle = "#8a8a96";
      ctx.beginPath();
      ctx.ellipse(0, 2, rad, rad * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b0b0bc";
      ctx.beginPath();
      ctx.ellipse(
        -rad * 0.25,
        -rad * 0.25,
        rad * 0.5,
        rad * 0.4,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }
    // 蛋（脉动发光）
    this.pulse += 0.15;
    const pulse = 1 + Math.sin(this.pulse) * 0.1;
    for (const e of this.eggs) {
      const ex = (e.x + 0.5) * this.cell;
      const ey = (e.y + 0.5) * this.cell;
      ctx.save();
      ctx.shadowColor = "#ffd93d";
      ctx.shadowBlur = 16;
      ctx.font = `${Math.floor(this.cell * 0.8 * pulse)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🥚", ex, ey);
      ctx.restore();
    }
    // 蛇身
    const theme = getCssVar("--c-green");
    for (let i = this.snake.length - 1; i >= 0; i--) {
      const seg = this.snake[i]!;
      const isHead = i === 0;
      const t = i / Math.max(1, this.snake.length - 1);
      const grad = ctx.createLinearGradient(
        seg.x * this.cell,
        seg.y * this.cell,
        (seg.x + 1) * this.cell,
        (seg.y + 1) * this.cell,
      );
      const c1 = mix(theme, "#2f8c46", 1 - t * 0.6);
      const c2 = mix("#a8e6b8", theme, 0.3 + t * 0.4);
      grad.addColorStop(0, isHead ? "#2f8c46" : c1);
      grad.addColorStop(1, isHead ? theme : c2);
      ctx.fillStyle = grad;
      roundRect(
        ctx,
        seg.x * this.cell + 1.5,
        seg.y * this.cell + 1.5,
        this.cell - 3,
        this.cell - 3,
        this.cell * 0.4,
      );
      ctx.fill();
      if (isHead) {
        // 眼睛
        ctx.fillStyle = "#fff";
        const ex2 = seg.x * this.cell + this.cell / 2;
        const ey2 = seg.y * this.cell + this.cell / 2;
        const off = this.cell * 0.18;
        let e1x = ex2,
          e1y = ey2,
          e2x = ex2,
          e2y = ey2;
        if (this.dir === "right") {
          e1x = ex2 + off;
          e1y = ey2 - off;
          e2x = ex2 + off;
          e2y = ey2 + off;
        } else if (this.dir === "left") {
          e1x = ex2 - off;
          e1y = ey2 - off;
          e2x = ex2 - off;
          e2y = ey2 + off;
        } else if (this.dir === "up") {
          e1x = ex2 - off;
          e1y = ey2 - off;
          e2x = ex2 + off;
          e2y = ey2 - off;
        } else {
          e1x = ex2 - off;
          e1y = ey2 + off;
          e2x = ex2 + off;
          e2y = ey2 + off;
        }
        ctx.beginPath();
        ctx.arc(e1x, e1y, this.cell * 0.1, 0, Math.PI * 2);
        ctx.arc(e2x, e2y, this.cell * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.arc(e1x, e1y, this.cell * 0.05, 0, Math.PI * 2);
        ctx.arc(e2x, e2y, this.cell * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private injectStyle(): void {
    if (document.getElementById("ssk-style")) return;
    const st = document.createElement("style");
    st.id = "ssk-style";
    st.textContent = SSK_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}
function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function SSK_CSS(theme: string): string {
  return `
.ssk-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.ssk-task{font-size:1.15rem;font-weight:800;}
.ssk-task span{color:${theme};}
.ssk-wrap canvas{border-radius:18px;box-shadow:var(--shadow-lg);background:#f4fbf5;}
.ssk-pad{display:flex;gap:14px;}
.ssk-btn{min-height:60px;padding:0 24px;border-radius:18px;border:2px solid #eee;background:#fff;color:${theme};font-size:1.15rem;font-weight:800;box-shadow:0 5px 0 #c9c4d0,var(--shadow);cursor:pointer;touch-action:manipulation;}
.ssk-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #c9c4d0,var(--shadow);}
`;
}

export function create(): SnakeSlitherGame {
  return new SnakeSlitherGame();
}
