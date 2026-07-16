/* 磁铁迷宫 Magnet Maze —— 用方向按钮推动小球穿越迷宫到达终点，
   途中要避开磁铁（N 极会吸引小球，太近会被吸住/拖慢）。
   独特点：网格迷宫 + 发光磁铁 + 实时物理（RAF 模拟引力 + 阻尼）。
   巧思：小球移动受磁铁反平方引力影响轨迹，玩家需规划绕行；难度=磁铁数/迷宫大小。
   通关=到达终点。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByTime } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar } from "../../lobby/util.ts";

// 迷宫格：0 通路，1 墙
type Maze = number[][];

// 几个固定迷宫布局（行 × 列），便于精心设计磁铁位置
const MAZES: Maze[] = [
  // 7×7
  [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 1, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
  // 8×8（中等）
  [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 1, 1, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1],
    [0, 1, 0, 1, 1, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 1, 1, 1, 0],
  ],
];

interface Magnet {
  gx: number;
  gy: number;
  strength: number;
}

export class MagnetMazeGame extends BaseGame {
  constructor() {
    super("magnet-maze");
  }
  private raf = 0;
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private maze: Maze = MAZES[0]!;
  private cell = 48;
  private cols = 0;
  private rows = 0;
  private magnets: Magnet[] = [];
  // 小球状态（连续坐标，单位=像素）
  private ball = { x: 0, y: 0, vx: 0, vy: 0 };
  private goal = { gx: 0, gy: 0 };
  private stuck = false; // 被磁铁吸住
  private startedMs = 0;
  private done = false;
  /** 当前按下的方向键集合 */
  private dir = { up: false, down: false, left: false, right: false };
  private unbindKey: (() => void) | null = null;

  protected mount(): void {
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    cancelAnimationFrame(this.raf);
    if (this.unbindKey) this.unbindKey();
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.done = false;
    this.stuck = false;

    const lvl =
      this.difficulty === "easy" ? 0 : this.difficulty === "medium" ? 0 : 1;
    this.maze = MAZES[lvl]!.map((r) => [...r]);
    this.rows = this.maze.length;
    this.cols = this.maze[0]!.length;

    // 自适应单元格大小（画布最大 420）
    const maxSide = 420;
    this.cell = Math.floor(maxSide / Math.max(this.cols, this.rows));

    // 起点：左上角通路
    this.ball.x = this.cell * 0.5;
    this.ball.y = this.cell * 0.5;
    this.ball.vx = 0;
    this.ball.vy = 0;

    // 终点：右下角通路
    this.goal = { gx: this.cols - 1, gy: this.rows - 1 };
    this.maze[this.goal.gy]![this.goal.gx] = 0;

    // 磁铁：在中间通路随机放置
    const magCount =
      this.difficulty === "easy" ? 1 : this.difficulty === "medium" ? 2 : 3;
    this.magnets = [];
    const placed = new Set<string>();
    let guard = 0;
    while (this.magnets.length < magCount && guard < 200) {
      guard++;
      const gx = 1 + Math.floor(Math.random() * (this.cols - 2));
      const gy = 1 + Math.floor(Math.random() * (this.rows - 2));
      const key = `${gx},${gy}`;
      if (placed.has(key)) continue;
      if (this.maze[gy]![gx] === 1) continue;
      if (gx <= 1 && gy <= 1) continue; // 不挡起点
      if (gx >= this.cols - 2 && gy >= this.rows - 2) continue; // 不挡终点
      placed.add(key);
      this.magnets.push({ gx, gy, strength: 1400 });
    }

    this.startedMs = Date.now();

    const wrap = document.createElement("div");
    wrap.className = "mm-wrap";

    const task = document.createElement("div");
    task.className = "mm-task";
    task.innerHTML = `用方向键推小球到 <b>🏁 终点</b>，小心被 <b>🧲 磁铁</b> 吸住！`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "mm-stage";

    this.canvas = document.createElement("canvas");
    const side = this.cell * this.cols;
    const sideY = this.cell * this.rows;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = side * dpr;
    this.canvas.height = sideY * dpr;
    this.canvas.style.width = `${side}px`;
    this.canvas.style.height = `${sideY}px`;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    this.c2d = ctx;
    stage.appendChild(this.canvas);
    wrap.appendChild(stage);

    // 方向按钮（D-pad）
    const pad = document.createElement("div");
    pad.className = "mm-pad";
    const mk = (
      label: string,
      dir: "up" | "down" | "left" | "right",
      cls: string,
    ): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `mm-btn mm-btn--${cls}`;
      b.textContent = label;
      const press = (on: boolean) => {
        this.dir[dir] = on;
        if (on) this.stuck = false; // 主动按键时摆脱吸附
      };
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        press(true);
      });
      b.addEventListener("pointerup", () => press(false));
      b.addEventListener("pointerleave", () => press(false));
      b.addEventListener("pointercancel", () => press(false));
      return b;
    };
    const up = mk("▲", "up", "up");
    const left = mk("◀", "left", "left");
    const right = mk("▶", "right", "right");
    const down = mk("▼", "down", "down");
    // 布局：上 / 左 右 / 下
    pad.append(up);
    const mid = document.createElement("div");
    mid.className = "mm-pad__mid";
    mid.append(left, right);
    pad.append(mid);
    pad.append(down);
    wrap.appendChild(pad);

    this.root.appendChild(wrap);

    // 键盘支持
    this.unbindKey = (() => {
      const kd = (e: KeyboardEvent): void => {
        const k = e.key;
        if (k === "ArrowUp" || k === "w") this.dir.up = true;
        else if (k === "ArrowDown" || k === "s") this.dir.down = true;
        else if (k === "ArrowLeft" || k === "a") this.dir.left = true;
        else if (k === "ArrowRight" || k === "d") this.dir.right = true;
        else return;
        this.stuck = false;
        e.preventDefault();
      };
      const ku = (e: KeyboardEvent): void => {
        const k = e.key;
        if (k === "ArrowUp" || k === "w") this.dir.up = false;
        else if (k === "ArrowDown" || k === "s") this.dir.down = false;
        else if (k === "ArrowLeft" || k === "a") this.dir.left = false;
        else if (k === "ArrowRight" || k === "d") this.dir.right = false;
      };
      window.addEventListener("keydown", kd);
      window.addEventListener("keyup", ku);
      return () => {
        window.removeEventListener("keydown", kd);
        window.removeEventListener("keyup", ku);
      };
    })();

    this.loop();
  }

  private loop = (): void => {
    if (this.done) return;
    this.step();
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private step(): void {
    const dt = 1 / 60;
    const thrust = 520; // 推力加速度 px/s²
    // 推力
    let ax = 0;
    let ay = 0;
    if (this.dir.left) ax -= thrust;
    if (this.dir.right) ax += thrust;
    if (this.dir.up) ay -= thrust;
    if (this.dir.down) ay += thrust;

    // 磁铁引力（反平方）
    for (const m of this.magnets) {
      const mx = (m.gx + 0.5) * this.cell;
      const my = (m.gy + 0.5) * this.cell;
      const dx = mx - this.ball.x;
      const dy = my - this.ball.y;
      const dist2 = dx * dx + dy * dy;
      const dist = Math.sqrt(dist2) || 0.001;
      const force = m.strength / Math.max(dist2, 200);
      ax += (dx / dist) * force;
      ay += (dy / dist) * force;
    }

    this.ball.vx += ax * dt;
    this.ball.vy += ay * dt;
    // 阻尼（摩擦）
    const damp = 0.94;
    this.ball.vx *= damp;
    this.ball.vy *= damp;
    // 限速
    const maxV = this.cell * 0.45;
    const sp = Math.hypot(this.ball.vx, this.ball.vy);
    if (sp > maxV) {
      this.ball.vx = (this.ball.vx / sp) * maxV;
      this.ball.vy = (this.ball.vy / sp) * maxV;
    }

    // 位置更新 + 墙体碰撞（按轴分离，圆 vs 格子）
    const r = this.cell * 0.28;
    const nx = this.ball.x + this.ball.vx * dt;
    if (!this.collide(nx, this.ball.y, r)) {
      this.ball.x = nx;
    } else {
      this.ball.vx = 0;
    }
    const ny = this.ball.y + this.ball.vy * dt;
    if (!this.collide(this.ball.x, ny, r)) {
      this.ball.y = ny;
    } else {
      this.ball.vy = 0;
    }

    // 被磁铁吸住判定：靠近且几乎不动 → stuck
    let nearMag = false;
    for (const m of this.magnets) {
      const mx = (m.gx + 0.5) * this.cell;
      const my = (m.gy + 0.5) * this.cell;
      if (Math.hypot(mx - this.ball.x, my - this.ball.y) < this.cell * 0.7) {
        nearMag = true;
        break;
      }
    }
    const moving = Math.hypot(this.ball.vx, this.ball.vy) > 6;
    if (nearMag && !moving && !this.anyDir()) this.stuck = true;

    // 到达终点？
    const gx = this.ball.x / this.cell;
    const gy = this.ball.y / this.cell;
    if (gx >= this.cols - 0.7 && gy >= this.rows - 0.7) {
      this.win();
    }
  }

  private anyDir(): boolean {
    return this.dir.up || this.dir.down || this.dir.left || this.dir.right;
  }

  /** 圆与墙体格子的碰撞检测（检查圆覆盖的格子） */
  private collide(cx: number, cy: number, r: number): boolean {
    const minGx = Math.floor((cx - r) / this.cell);
    const maxGx = Math.floor((cx + r) / this.cell);
    const minGy = Math.floor((cy - r) / this.cell);
    const maxGy = Math.floor((cy + r) / this.cell);
    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        if (gy < 0 || gy >= this.rows || gx < 0 || gx >= this.cols) return true;
        if (this.maze[gy]![gx] === 1) {
          // 圆与方块 AABB 最近点
          const rx = gx * this.cell;
          const ry = gy * this.cell;
          const nx = Math.max(rx, Math.min(cx, rx + this.cell));
          const ny = Math.max(ry, Math.min(cy, ry + this.cell));
          if ((cx - nx) ** 2 + (cy - ny) ** 2 < r * r) return true;
        }
      }
    }
    return false;
  }

  private win(): void {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this.raf);
    sfxPop();
    // onCorrect→burst 需要视口坐标，ball.x/y 是画布内坐标，需换算
    const rc = this.canvas.getBoundingClientRect();
    this.onCorrect(rc.left + this.ball.x, rc.top + this.ball.y);
    this.trackTimeout(() => {
      const dur = Date.now() - this.startedMs;
      // 按用时算星：易 25s/40s，中 35s/55s，难 45s/70s
      const base =
        this.difficulty === "easy"
          ? [25000, 40000]
          : this.difficulty === "medium"
            ? [35000, 55000]
            : [45000, 70000];
      this.finishClear(starsByTime(dur, base as [number, number]));
    }, 500);
  }

  private draw(): void {
    const c = this.c2d;
    const side = this.cell * this.cols;
    const sideY = this.cell * this.rows;
    // 背景
    const bg = c.createLinearGradient(0, 0, 0, sideY);
    bg.addColorStop(0, "#1b2350");
    bg.addColorStop(1, "#0b1026");
    c.fillStyle = bg;
    c.fillRect(0, 0, side, sideY);

    // 网格线
    c.strokeStyle = "rgba(120,140,255,.08)";
    c.lineWidth = 1;
    for (let i = 0; i <= this.cols; i++) {
      c.beginPath();
      c.moveTo(i * this.cell + 0.5, 0);
      c.lineTo(i * this.cell + 0.5, sideY);
      c.stroke();
    }
    for (let j = 0; j <= this.rows; j++) {
      c.beginPath();
      c.moveTo(0, j * this.cell + 0.5);
      c.lineTo(side, j * this.cell + 0.5);
      c.stroke();
    }

    // 墙
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        if (this.maze[gy]![gx] === 1) {
          const g = c.createLinearGradient(
            gx * this.cell,
            gy * this.cell,
            gx * this.cell,
            (gy + 1) * this.cell,
          );
          g.addColorStop(0, "#5b6bd6");
          g.addColorStop(1, "#3a44a0");
          c.fillStyle = g;
          this.roundRect(
            c,
            gx * this.cell + 2,
            gy * this.cell + 2,
            this.cell - 4,
            this.cell - 4,
            6,
          );
          c.fill();
        }
      }
    }

    // 终点
    const gx = (this.goal.gx + 0.5) * this.cell;
    const gy = (this.goal.gy + 0.5) * this.cell;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
    c.fillStyle = `rgba(107,207,127,${0.25 + pulse * 0.3})`;
    c.beginPath();
    c.arc(gx, gy, this.cell * 0.45, 0, Math.PI * 2);
    c.fill();
    c.font = `${Math.floor(this.cell * 0.6)}px serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("🏁", gx, gy);

    // 磁铁 + 引力场
    for (const m of this.magnets) {
      const mx = (m.gx + 0.5) * this.cell;
      const my = (m.gy + 0.5) * this.cell;
      // 引力场（同心圆光晕）
      const field = c.createRadialGradient(mx, my, 2, mx, my, this.cell * 1.6);
      field.addColorStop(0, "rgba(255,99,72,.35)");
      field.addColorStop(0.5, "rgba(255,99,72,.12)");
      field.addColorStop(1, "rgba(255,99,72,0)");
      c.fillStyle = field;
      c.beginPath();
      c.arc(mx, my, this.cell * 1.6, 0, Math.PI * 2);
      c.fill();
      // 磁铁本体
      c.font = `${Math.floor(this.cell * 0.62)}px serif`;
      c.fillText("🧲", mx, my);
    }

    // 小球（被吸住时变红 + 抖动）
    const r = this.cell * 0.28;
    let bx = this.ball.x;
    let by = this.ball.y;
    if (this.stuck) {
      bx += (Math.random() - 0.5) * 2;
      by += (Math.random() - 0.5) * 2;
    }
    // 拖尾光晕
    const halo = c.createRadialGradient(bx, by, 1, bx, by, r * 2.4);
    halo.addColorStop(
      0,
      this.stuck ? "rgba(255,80,80,.5)" : "rgba(255,220,90,.5)",
    );
    halo.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = halo;
    c.beginPath();
    c.arc(bx, by, r * 2.4, 0, Math.PI * 2);
    c.fill();
    // 本体
    const ball = c.createRadialGradient(
      bx - r * 0.3,
      by - r * 0.3,
      r * 0.1,
      bx,
      by,
      r,
    );
    if (this.stuck) {
      ball.addColorStop(0, "#ffd0d0");
      ball.addColorStop(1, "#ff5252");
    } else {
      ball.addColorStop(0, "#fff6c0");
      ball.addColorStop(1, "#ffb300");
    }
    c.fillStyle = ball;
    c.beginPath();
    c.arc(bx, by, r, 0, Math.PI * 2);
    c.fill();

    // stuck 提示文字
    if (this.stuck) {
      c.fillStyle = "#fff";
      c.font = `700 ${Math.floor(this.cell * 0.32)}px sans-serif`;
      c.fillText("被吸住啦！按方向键挣脱", side / 2, sideY - this.cell * 0.4);
    }
  }

  private roundRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  private injectStyle(): void {
    if (document.getElementById("mm-style")) return;
    const st = document.createElement("style");
    st.id = "mm-style";
    st.textContent = MM_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function MM_CSS(theme: string): string {
  return `
.mm-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.mm-task{font-size:1rem;font-weight:800;text-align:center;line-height:1.7;color:var(--ink);}
.mm-task b{color:${theme};}
.mm-stage{padding:8px;background:#0b1026;border-radius:20px;box-shadow:var(--shadow-lg);}
.mm-stage canvas{display:block;border-radius:14px;}
.mm-pad{display:flex;flex-direction:column;align-items:center;gap:8px;user-select:none;}
.mm-pad__mid{display:flex;gap:54px;}
.mm-btn{width:62px;height:62px;border-radius:18px;border:none;background:linear-gradient(180deg,#fff,#f0e6ff);color:${theme};font-size:1.5rem;font-weight:900;box-shadow:0 5px 0 #d9c7f5,var(--shadow);cursor:pointer;touch-action:none;}
.mm-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #d9c7f5,var(--shadow);}
`;
}

export function create(): MagnetMazeGame {
  return new MagnetMazeGame();
}
