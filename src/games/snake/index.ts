/* 贪吃蛇 Snake —— 方向按钮控制蛇移动吃食物变长，撞墙/自身则结束。
   独特点：圆角渐变蛇身（每节颜色渐变）+ 发光食物 + 滑动方向按钮（儿童友好）。
   视觉：Canvas 绘制，蛇头有眼睛，食物脉动发光。
   难度=网格大小 + 速度（easy 12格慢 / medium 14格 / hard 16格快）。
   通关=吃到目标数量食物。用 createIntervalLoop 驱动，unmount 调 stop()。
   同时支持键盘方向键（家长体验）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { createIntervalLoop } from "../../core/loop.ts";
import { getCssVar } from "../../lobby/util.ts";

type Dir = "up" | "down" | "left" | "right";
interface Cell {
  x: number;
  y: number;
}

export class SnakeGame extends BaseGame {
  constructor() {
    super("snake");
  }

  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private stop?: () => void;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;

  private grid = 12;
  private cell = 0;
  private W = 0;

  private snake: Cell[] = [];
  private dir: Dir = "right";
  private nextDir: Dir = "right";
  private food: Cell = { x: 0, y: 0 };
  private eaten = 0;
  private target = 0;
  private foodPulse = 0;
  private onKey: ((e: KeyboardEvent) => void) | null = null;

  protected mount(): void {
    this.grid =
      this.difficulty === "easy" ? 12 : this.difficulty === "medium" ? 14 : 16;
    this.target =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 10;
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.setup();
  }
  protected unmount(): void {
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    if (this.onKey) {
      window.removeEventListener("keydown", this.onKey);
      this.onKey = null;
    }
  }

  private setup(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    // 先移除上一轮的 keydown 监听，避免每次死亡重开累积 window 监听器
    if (this.onKey) {
      window.removeEventListener("keydown", this.onKey);
      this.onKey = null;
    }
    this.root.innerHTML = "";
    this.over = false;
    this.eaten = 0;
    this.dir = "right";
    this.nextDir = "right";

    const wrap = document.createElement("div");
    wrap.className = "sn-wrap";

    const task = document.createElement("div");
    task.className = "sn-task";
    task.innerHTML = `吃到 <span id="sn-eat">0</span> / ${this.target} 颗食物 🍎`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.c2d = this.canvas.getContext("2d")!;
    wrap.appendChild(this.canvas);

    // 方向按钮（十字布局）
    const pad = document.createElement("div");
    pad.className = "sn-pad";
    const mkBtn = (dir: Dir, icon: string, cls: string): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `sn-dir ${cls}`;
      b.textContent = icon;
      b.addEventListener("click", () => this.setDir(dir));
      return b;
    };
    pad.appendChild(mkBtn("up", "⬆", "sn-dir--up"));
    pad.appendChild(mkBtn("left", "⬅", "sn-dir--left"));
    pad.appendChild(mkBtn("right", "➡", "sn-dir--right"));
    pad.appendChild(mkBtn("down", "⬇", "sn-dir--down"));
    wrap.appendChild(pad);

    this.root.appendChild(wrap);

    this.resize();
    this.initSnake();
    this.spawnFood();
    this.draw();
    const speed =
      this.difficulty === "easy"
        ? 220
        : this.difficulty === "medium"
          ? 170
          : 130;
    this.stop = createIntervalLoop(speed, () => this.tick());

    // 键盘
    this.onKey = (e: KeyboardEvent): void => {
      const map: Record<string, Dir> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        this.setDir(d);
      }
    };
    window.addEventListener("keydown", this.onKey);
  }

  private resize(): void {
    const size = Math.min(360, window.innerWidth - 32);
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

  private spawnFood(): void {
    let tries = 0;
    while (tries < 200) {
      const fx = Math.floor(Math.random() * this.grid);
      const fy = Math.floor(Math.random() * this.grid);
      if (!this.snake.some((s) => s.x === fx && s.y === fy)) {
        this.food = { x: fx, y: fy };
        return;
      }
      tries++;
    }
    // 兜底：遍历网格找一个非蛇身的空格，避免食物生成在蛇身上导致卡死
    for (let y = 0; y < this.grid; y++) {
      for (let x = 0; x < this.grid; x++) {
        if (!this.snake.some((s) => s.x === x && s.y === y)) {
          this.food = { x, y };
          return;
        }
      }
    }
    // 极端情况：网格全被蛇占满（通关），随便放
    this.food = { x: 0, y: 0 };
  }

  private setDir(d: Dir): void {
    // 不能 180° 反向
    const opp: Record<Dir, Dir> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };
    if (d === opp[this.dir]) return;
    this.nextDir = d;
  }

  private tick(): void {
    if (this.over) return;
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
      this.gameOver();
      return;
    }
    // 撞自己（注意：尾巴这一帧会移走，所以允许移到原尾巴位置）
    const willGrow = nx === this.food.x && ny === this.food.y;
    const body = willGrow ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.x === nx && s.y === ny)) {
      this.gameOver();
      return;
    }
    this.snake.unshift({ x: nx, y: ny });
    if (willGrow) {
      this.eaten += 1;
      sfxPop();
      const rect = this.canvas.getBoundingClientRect();
      burst(
        rect.left + (this.food.x + 0.5) * this.cell,
        rect.top + (this.food.y + 0.5) * this.cell,
        14,
        ["star", "heart"],
      );
      this.onCorrect(
        rect.left + (nx + 0.5) * this.cell,
        rect.top + (ny + 0.5) * this.cell,
      );
      this.resetWrongStreak();
      this.spawnFood();
      const eat = this.root.querySelector("#sn-eat");
      if (eat) eat.textContent = String(this.eaten);
      if (this.eaten >= this.target) {
        this.over = true;
        if (this.stop) {
          this.stop();
          this.stop = undefined;
        }
        // 算星：按死亡前是否还有失误空间——这里通关必 3 星，加难度系数
        const stars = 3;
        this.resetWrongStreak();
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(stars);
          } else {
            this.setup();
          }
        }, 600);
        return;
      }
    } else {
      this.snake.pop();
    }
    this.draw();
  }

  private gameOver(): void {
    this.over = true;
    if (this.stop) {
      this.stop();
      this.stop = undefined;
    }
    this.onWrong();
    // 红色闪烁后重开
    this.draw(true);
    this.trackTimeout(() => this.setup(), 1100);
  }

  private draw(dead = false): void {
    const ctx = this.c2d;
    const px = this.cell * this.grid;
    // 棋盘背景
    ctx.fillStyle = dead ? "rgba(255,99,72,0.15)" : "rgba(107,207,127,0.08)";
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
    // 食物（脉动发光苹果）
    this.foodPulse += 0.15;
    const pulse = 1 + Math.sin(this.foodPulse) * 0.1;
    const fx = (this.food.x + 0.5) * this.cell;
    const fy = (this.food.y + 0.5) * this.cell;
    ctx.save();
    ctx.shadowColor = "#ff6348";
    ctx.shadowBlur = 16;
    ctx.font = `${Math.floor(this.cell * 0.8 * pulse)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🍎", fx, fy);
    ctx.restore();

    // 蛇身（从尾到头，颜色渐变）
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
      // 头部偏深，尾部偏浅
      const c1 = mix(theme, "#2f8c46", 1 - t * 0.6);
      const c2 = mix("#a8e6b8", theme, 0.3 + t * 0.4);
      grad.addColorStop(0, isHead ? "#2f8c46" : c1);
      grad.addColorStop(1, isHead ? theme : c2);
      ctx.fillStyle = grad;
      roundRect(
        ctx,
        seg.x * this.cell + 1,
        seg.y * this.cell + 1,
        this.cell - 2,
        this.cell - 2,
        this.cell * 0.3,
      );
      ctx.fill();
      // 头部画眼睛
      if (isHead) {
        ctx.fillStyle = "#fff";
        const ex = seg.x * this.cell + this.cell / 2;
        const ey = seg.y * this.cell + this.cell / 2;
        const off = this.cell * 0.18;
        let e1x = ex,
          e1y = ey,
          e2x = ex,
          e2y = ey;
        if (this.dir === "right") {
          e1x = ex + off;
          e1y = ey - off;
          e2x = ex + off;
          e2y = ey + off;
        }
        if (this.dir === "left") {
          e1x = ex - off;
          e1y = ey - off;
          e2x = ex - off;
          e2y = ey + off;
        }
        if (this.dir === "up") {
          e1x = ex - off;
          e1y = ey - off;
          e2x = ex + off;
          e2y = ey - off;
        }
        if (this.dir === "down") {
          e1x = ex - off;
          e1y = ey + off;
          e2x = ex + off;
          e2y = ey + off;
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
    if (document.getElementById("sn-style")) return;
    const st = document.createElement("style");
    st.id = "sn-style";
    st.textContent = SN_CSS(getCssVar("--c-green"));
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

function SN_CSS(theme: string): string {
  return `
.sn-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.sn-task{font-size:1.2rem;font-weight:800;}
.sn-task span{color:${theme};}
.sn-wrap canvas{border-radius:18px;box-shadow:var(--shadow-lg);background:#f7fdf8;}
.sn-pad{display:grid;grid-template-columns:repeat(3,72px);grid-template-rows:repeat(2,64px);gap:8px;}
.sn-dir{font-size:1.8rem;font-weight:800;border-radius:16px;background:#fff;color:${theme};box-shadow:0 5px 0 #c9c4d0,var(--shadow);border:2px solid #eee;}
.sn-dir:active{transform:translateY(3px);box-shadow:0 2px 0 #c9c4d0,var(--shadow);}
.sn-dir--up{grid-column:2;grid-row:1;}
.sn-dir--left{grid-column:1;grid-row:2;}
.sn-dir--right{grid-column:3;grid-row:2;}
.sn-dir--down{grid-column:2;grid-row:2;}
`;
}

export function create(): SnakeGame {
  return new SnakeGame();
}
