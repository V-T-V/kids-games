/* 泊拖拉机 Tractor Park —— 一辆拖拉机要停进指定车位（车位两侧有障碍），
   孩子用前进/后退/左转/右转按钮操控拖拉机驶入车位。
   独特点：网格化离散驾驶（朝向 + 前进/后退），训练空间方向与规划。
   视觉：俯视网格 + 拖拉机（随朝向旋转）+ 车位（高亮）+ 障碍干草垛。
   难度=车位距离/障碍数。通关=停入目标轮数。前缀 trp-。
   巧思：BFS 生成时验证可达并算最短距离，保证有解；按移动步数算星。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByMoves } from "../../core/scoring.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

/** 朝向：0=北(上) 1=东(右) 2=南(下) 3=西(左) */
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const HEADING_ROT = [-90, 0, 90, 180]; // emoji 默认朝右

export class TractorParkGame extends BaseGame {
  constructor() {
    super("tractor-park");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private size = 7;
  /** 0=空, 1=障碍 */
  private grid: number[][] = [];
  private tx = 0;
  private ty = 0;
  private heading = 1;
  private gx = 0;
  private gy = 0;
  private cellPx = 0;
  private moves = 0;
  private optimal = 1;
  private moving = false;
  private tractorEl: HTMLDivElement | null = null;
  private boardEl: HTMLDivElement | null = null;
  private movesEl: HTMLSpanElement | null = null;
  private cleanups: (() => void)[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  private cfg(): { size: number; obstacles: number } {
    if (this.difficulty === "easy") return { size: 6, obstacles: 3 };
    if (this.difficulty === "medium") return { size: 7, obstacles: 5 };
    return { size: 8, obstacles: 7 };
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.moves = 0;
    this.moving = false;

    const cfg = this.cfg();
    this.size = cfg.size;
    this.generate(cfg.obstacles);

    const wrap = document.createElement("div");
    wrap.className = "trp-wrap";
    const task = document.createElement("div");
    task.className = "trp-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 把 🚜 开进高亮<b>车位</b>！已用 <span id="trp-moves">0</span> 步`;
    wrap.appendChild(task);
    this.movesEl = task.querySelector("#trp-moves");

    // 格子像素
    const maxBoard = Math.min(window.innerWidth - 40, 440);
    this.cellPx = Math.floor(maxBoard / this.size);

    this.boardEl = document.createElement("div");
    this.boardEl.className = "trp-board";
    this.boardEl.style.setProperty("--trp-cell", `${this.cellPx}px`);
    this.boardEl.style.width = `${this.size * this.cellPx}px`;
    this.boardEl.style.height = `${this.size * this.cellPx}px`;

    // 单元格背景（草地纹理）
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const cell = document.createElement("div");
        cell.className = "trp-cell";
        cell.style.left = `${x * this.cellPx}px`;
        cell.style.top = `${y * this.cellPx}px`;
        cell.style.width = `${this.cellPx}px`;
        cell.style.height = `${this.cellPx}px`;
        if ((x + y) % 2 === 0) cell.classList.add("trp-cell--alt");
        this.boardEl!.appendChild(cell);
      }
    }
    // 障碍
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.grid[y]![x] === 1) {
          const ob = document.createElement("div");
          ob.className = "trp-obstacle";
          ob.textContent = sample(["🌾", "🚧", "🛢️"]);
          ob.style.left = `${x * this.cellPx}px`;
          ob.style.top = `${y * this.cellPx}px`;
          ob.style.width = `${this.cellPx}px`;
          ob.style.height = `${this.cellPx}px`;
          ob.style.fontSize = `${this.cellPx * 0.6}px`;
          this.boardEl!.appendChild(ob);
        }
      }
    }
    // 车位高亮
    const spot = document.createElement("div");
    spot.className = "trp-spot";
    spot.innerHTML = `<span>🅿️</span>`;
    spot.style.left = `${this.gx * this.cellPx}px`;
    spot.style.top = `${this.gy * this.cellPx}px`;
    spot.style.width = `${this.cellPx}px`;
    spot.style.height = `${this.cellPx}px`;
    spot.style.fontSize = `${this.cellPx * 0.4}px`;
    this.boardEl!.appendChild(spot);

    // 拖拉机
    this.tractorEl = document.createElement("div");
    this.tractorEl.className = "trp-tractor";
    this.tractorEl.textContent = "🚜";
    this.tractorEl.style.width = `${this.cellPx}px`;
    this.tractorEl.style.height = `${this.cellPx}px`;
    this.tractorEl.style.fontSize = `${this.cellPx * 0.7}px`;
    this.boardEl!.appendChild(this.tractorEl);
    this.placeTractor();
    wrap.appendChild(this.boardEl);

    // 控制面板（方向键样式）
    const pad = document.createElement("div");
    pad.className = "trp-pad";
    const fwd = this.btn("⬆️ 前进", () => this.moveForward());
    const back = this.btn("⬇️ 后退", () => this.moveBackward());
    const tL = this.btn("↩️ 左转", () => this.turn(-1));
    const tR = this.btn("↪️ 右转", () => this.turn(1));
    const top = document.createElement("div");
    top.className = "trp-pad-row";
    top.appendChild(fwd);
    const mid = document.createElement("div");
    mid.className = "trp-pad-row";
    mid.appendChild(tL);
    mid.appendChild(back);
    mid.appendChild(tR);
    pad.appendChild(top);
    pad.appendChild(mid);
    wrap.appendChild(pad);
    this.root.appendChild(wrap);
  }

  private btn(label: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "trp-pad-btn";
    b.textContent = label;
    b.addEventListener("click", fn);
    return b;
  }

  private placeTractor(): void {
    if (!this.tractorEl) return;
    this.tractorEl.style.left = `${this.tx * this.cellPx}px`;
    this.tractorEl.style.top = `${this.ty * this.cellPx}px`;
    this.tractorEl.style.transform = `rotate(${HEADING_ROT[this.heading]!}deg)`;
  }

  private bump(): void {
    this.tractorEl?.classList.add("trp-tractor--bump");
    this.trackTimeout(
      () => this.tractorEl?.classList.remove("trp-tractor--bump"),
      350,
    );
  }

  private moveForward(): void {
    if (this.moving) return;
    this.tryStep(this.heading);
  }
  private moveBackward(): void {
    if (this.moving) return;
    this.tryStep((this.heading + 2) % 4);
  }
  private turn(dir: -1 | 1): void {
    if (this.moving) return;
    this.heading = (this.heading + dir + 4) % 4;
    this.moves += 1;
    this.placeTractor();
    sfxPop();
    this.updateMoves();
  }

  /** 尝试朝 dir 方向走一格 */
  private tryStep(dir: number): void {
    const nx = this.tx + DX[dir]!;
    const ny = this.ty + DY[dir]!;
    if (
      nx < 0 ||
      ny < 0 ||
      nx >= this.size ||
      ny >= this.size ||
      this.grid[ny]![nx] === 1
    ) {
      this.bump();
      return;
    }
    this.moving = true;
    this.tx = nx;
    this.ty = ny;
    this.moves += 1;
    sfxPop();
    this.placeTractor();
    this.updateMoves();
    // 等动画结束再解锁（CSS transition .18s）
    this.trackTimeout(() => {
      this.moving = false;
      if (this.tx === this.gx && this.ty === this.gy) {
        this.reachSpot();
      }
    }, 200);
  }

  private updateMoves(): void {
    if (this.movesEl) this.movesEl.textContent = String(this.moves);
  }

  private reachSpot(): void {
    if (this.moving) return;
    sfxPop();
    this.tractorEl?.classList.add("trp-tractor--win");
    const r = this.boardEl?.getBoundingClientRect();
    this.onCorrect(
      r ? r.left + r.width / 2 : window.innerWidth / 2,
      r ? r.top + r.height / 2 : window.innerHeight / 2,
    );
    this.resetWrongStreak();
    this.trackTimeout(() => {
      this.roundsDone += 1;
      if (this.roundsDone >= this.roundTotal) {
        // 星级：按总操作数 vs 最优路径长度
        const three = Math.ceil(this.optimal * 1.8);
        const two = Math.ceil(this.optimal * 3);
        this.finishClear(starsByMoves(this.moves, [three, two]));
      } else {
        this.startRound();
      }
    }, 700);
  }

  /** 生成关卡：放置障碍，BFS 验证 (sx,sy)->(gx,gy) 可达，记录最短距离 */
  private generate(obstacleCount: number): void {
    const n = this.size;
    let attempt = 0;
    while (attempt < 60) {
      attempt += 1;
      // 初始化空网格
      const g: number[][] = [];
      for (let y = 0; y < n; y++) {
        const row: number[] = [];
        for (let x = 0; x < n; x++) row.push(0);
        g.push(row);
      }
      // 起点：左边缘中间格，朝东
      const sx = 0;
      const sy = Math.floor(n / 2);
      // 终点（车位）：右边缘某格
      const ex = n - 1;
      const ey = randInt(Math.max(0, sy - 1), Math.min(n - 1, sy + 1));
      // 障碍：随机放置，避开起点和终点
      let placed = 0;
      let guard = 0;
      while (placed < obstacleCount && guard < 200) {
        guard += 1;
        const ox = randInt(0, n - 1);
        const oy = randInt(0, n - 1);
        if (ox === sx && oy === sy) continue;
        if (ox === ex && oy === ey) continue;
        if (g[oy]![ox] === 1) continue;
        g[oy]![ox] = 1;
        placed += 1;
      }
      // BFS 验证
      const dist = this.bfs(g, n, sx, sy, ex, ey);
      if (dist > 0) {
        this.grid = g;
        this.tx = sx;
        this.ty = sy;
        this.heading = 1; // 朝东
        this.gx = ex;
        this.gy = ey;
        this.optimal = dist;
        return;
      }
    }
    // 兜底：无障碍，直线可达
    const g: number[][] = [];
    for (let y = 0; y < n; y++) {
      const row: number[] = [];
      for (let x = 0; x < n; x++) row.push(0);
      g.push(row);
    }
    this.grid = g;
    this.tx = 0;
    this.ty = Math.floor(n / 2);
    this.heading = 1;
    this.gx = n - 1;
    this.gy = this.ty;
    this.optimal = n - 1;
  }

  /** BFS 返回 (sx,sy)->(ex,ey) 最短步数，不可达返回 -1 */
  private bfs(
    g: number[][],
    n: number,
    sx: number,
    sy: number,
    ex: number,
    ey: number,
  ): number {
    const dist: number[][] = [];
    for (let y = 0; y < n; y++) {
      const row: number[] = [];
      for (let x = 0; x < n; x++) row.push(-1);
      dist.push(row);
    }
    dist[sy]![sx] = 0;
    const q: [number, number][] = [[sx, sy]];
    let head = 0;
    while (head < q.length) {
      const [cx, cy] = q[head]!;
      head += 1;
      if (cx === ex && cy === ey) return dist[cy]![cx]!;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d]!;
        const ny = cy + DY[d]!;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        if (g[ny]![nx] === 1) continue;
        if (dist[ny]![nx] !== -1) continue;
        dist[ny]![nx] = dist[cy]![cx]! + 1;
        q.push([nx, ny]);
      }
    }
    return dist[ey]![ex]!;
  }

  private injectStyle(): void {
    if (document.getElementById("trp-style")) return;
    const st = document.createElement("style");
    st.id = "trp-style";
    st.textContent = TRP_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function TRP_CSS(theme: string): string {
  return `
.trp-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.trp-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.trp-board{position:relative;background:#7ab058;border:4px solid #5a8a3a;border-radius:12px;box-shadow:var(--shadow);overflow:hidden;}
.trp-cell{position:absolute;background:#8ac068;}
.trp-cell--alt{background:#7ab058;}
.trp-obstacle{position:absolute;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3));z-index:2;}
.trp-spot{position:absolute;display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(45deg,rgba(255,215,0,.4),rgba(255,215,0,.4) 8px,rgba(255,215,0,.7) 8px,rgba(255,215,0,.7) 16px);border:3px dashed #d9a300;border-radius:8px;z-index:1;animation:trp-pulse 1.4s ease-in-out infinite;}
.trp-spot span{filter:drop-shadow(0 1px 1px rgba(0,0,0,.3));}
@keyframes trp-pulse{0%,100%{box-shadow:inset 0 0 0 rgba(217,163,0,0)}50%{box-shadow:inset 0 0 16px rgba(217,163,0,.6)}}
.trp-tractor{position:absolute;display:flex;align-items:center;justify-content:center;z-index:5;transition:left .18s ease,top .18s ease,transform .18s ease;filter:drop-shadow(0 3px 4px rgba(0,0,0,.4));will-change:left,top,transform;}
.trp-tractor--bump{animation:trp-shake .35s ease;}
@keyframes trp-shake{0%,100%{transform:rotate(var(--rot,0deg)) translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.trp-tractor--win{animation:trp-bounce .5s ease;}
@keyframes trp-bounce{0%,100%{filter:drop-shadow(0 3px 4px rgba(0,0,0,.4))}50%{filter:drop-shadow(0 0 16px ${theme}) brightness(1.3)}}
.trp-pad{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:4px;}
.trp-pad-row{display:flex;gap:8px;}
.trp-pad-btn{min-width:96px;padding:14px 18px;border:none;border-radius:16px;background:linear-gradient(180deg,#fff,${theme}22);font-size:1.05rem;font-weight:800;color:#333;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.1);transition:transform .08s;touch-action:manipulation;}
.trp-pad-btn:active{transform:translateY(3px);}
@media (max-width:380px){.trp-pad-btn{min-width:72px;padding:12px 10px;font-size:.95rem;}}
`;
}

export function create(): TractorParkGame {
  return new TractorParkGame();
}
