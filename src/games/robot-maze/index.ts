/* 机器人迷宫 Robot Maze —— 用方向按钮操控机器人在小网格迷宫里走到终点。
   独特点：DFS 递归回溯生成迷宫，天然保证从起点到终点有唯一通路；
   孩子用 ↑ ↓ ← → 按钮一步步走，墙壁会挡住，到达 🎯 即过关。
   视觉：网格 + 墙 + 机器人 + 终点。难度 = 网格大小。通关 = 走到终点目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxTick } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { createButton } from "../../ui/Button.ts";
import { shuffle, getCssVar } from "../../lobby/util.ts";

/**
 * 每个格子记录四面是否有墙（true=有墙，不可通行）。
 * 生成时 DFS 打通邻居，结果是从 (0,0) 到 (n-1,n-1) 必连通的完美迷宫。
 */
interface Cell {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
  visited: boolean;
}

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
/* 方向 0=上 1=右 2=下 3=左；每方向对应该格要检查/打通的墙 */

export class RobotMazeGame extends BaseGame {
  constructor() {
    super("robot-maze");
  }

  private n = 4;
  private cellPx = 60;
  private grid: Cell[][] = [];
  private rx = 0;
  private ry = 0;
  private goalX = 0;
  private goalY = 0;
  private robotEl!: HTMLDivElement;
  private boardEl!: HTMLDivElement;
  private running = false;
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.n =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.goalX = this.n - 1;
    this.goalY = this.n - 1;
    this.rx = 0;
    this.ry = 0;
    this.running = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.buildMaze();

    const wrap = document.createElement("div");
    wrap.className = "rmb-wrap";

    const task = document.createElement("div");
    task.className = "rmb-task";
    task.textContent = `用方向键帮 🤖 走到 🎯（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const boardWrap = document.createElement("div");
    boardWrap.className = "rmb-boardwrap";
    this.boardEl = document.createElement("div");
    this.boardEl.className = "rmb-board";
    const size = this.n * this.cellPx + 4; /* +4 padding */
    this.boardEl.style.width = `${size}px`;
    this.boardEl.style.height = `${size}px`;
    /* 墙用 canvas 画在格子层下方 */
    this.drawWalls();
    /* 终点 */
    const goal = document.createElement("div");
    goal.className = "rmb-goal";
    goal.textContent = "🎯";
    goal.style.left = `${4 + this.goalX * this.cellPx}px`;
    goal.style.top = `${4 + this.goalY * this.cellPx}px`;
    this.boardEl.appendChild(goal);
    /* 机器人 */
    this.robotEl = document.createElement("div");
    this.robotEl.className = "rmb-robot";
    this.robotEl.textContent = "🤖";
    this.boardEl.appendChild(this.robotEl);
    this.placeRobot();
    boardWrap.appendChild(this.boardEl);
    wrap.appendChild(boardWrap);

    /* 方向键 */
    const pad = document.createElement("div");
    pad.className = "rmb-pad";
    const up = this.dirBtn("⬆️", 0);
    const left = this.dirBtn("⬅️", 3);
    const right = this.dirBtn("➡️", 1);
    const down = this.dirBtn("⬇️", 2);
    const blank = document.createElement("span");
    blank.className = "rmb-pad-blank";
    pad.appendChild(blank);
    pad.appendChild(up);
    pad.appendChild(left);
    pad.appendChild(down);
    pad.appendChild(right);
    wrap.appendChild(pad);

    const actions = document.createElement("div");
    actions.className = "rmb-actions";
    actions.appendChild(
      createButton({
        text: "重新开始本关",
        icon: "🔄",
        variant: "secondary",
        onClick: () => this.startRound(),
      }),
    );
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
  }

  private dirBtn(text: string, dir: number): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rmb-dir";
    b.textContent = text;
    b.addEventListener("click", () => this.move(dir));
    return b;
  }

  /* ===== 迷宫生成（DFS 递归回溯） ===== */
  private buildMaze(): void {
    const n = this.n;
    this.grid = [];
    for (let y = 0; y < n; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < n; x++) {
        row.push({
          top: true,
          right: true,
          bottom: true,
          left: true,
          visited: false,
        });
      }
      this.grid.push(row);
    }
    /* 迭代式 DFS，避免深栈 */
    const stack: Array<[number, number]> = [[0, 0]];
    this.grid[0]![0]!.visited = true;
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const [cx, cy] = top;
      /* 收集未访问邻居 + 方向 */
      const dirs = shuffle([0, 1, 2, 3]);
      let moved = false;
      for (const d of dirs) {
        const nx = cx + DX[d]!;
        const ny = cy + DY[d]!;
        if (nx < 0 || nx >= n || ny < 0 || ny >= n) continue;
        const nb = this.grid[ny]![nx]!;
        if (nb.visited) continue;
        /* 打通墙 */
        if (d === 0) {
          this.grid[cy]![cx]!.top = false;
          nb.bottom = false;
        } else if (d === 1) {
          this.grid[cy]![cx]!.right = false;
          nb.left = false;
        } else if (d === 2) {
          this.grid[cy]![cx]!.bottom = false;
          nb.top = false;
        } else {
          this.grid[cy]![cx]!.left = false;
          nb.right = false;
        }
        nb.visited = true;
        stack.push([nx, ny]);
        moved = true;
        break;
      }
      if (!moved) stack.pop();
    }
  }

  private drawWalls(): void {
    /* 用 SVG 线条画墙，比 canvas 更易随容器缩放 */
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "rmb-walls");
    svg.setAttribute(
      "viewBox",
      `0 0 ${this.n * this.cellPx} ${this.n * this.cellPx}`,
    );
    svg.setAttribute("preserveAspectRatio", "none");
    const px = this.cellPx;
    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < this.n; x++) {
        const c = this.grid[y]![x]!;
        const x0 = x * px;
        const y0 = y * px;
        if (c.top) this.line(svg, x0, y0, x0 + px, y0);
        if (c.left) this.line(svg, x0, y0, x0, y0 + px);
        /* 最右/最下边缘只画一次 */
        if (x === this.n - 1 && c.right)
          this.line(svg, x0 + px, y0, x0 + px, y0 + px);
        if (y === this.n - 1 && c.bottom)
          this.line(svg, x0, y0 + px, x0 + px, y0 + px);
      }
    }
    this.boardEl.appendChild(svg);
  }

  private line(
    svg: SVGSVGElement,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", String(x1));
    l.setAttribute("y1", String(y1));
    l.setAttribute("x2", String(x2));
    l.setAttribute("y2", String(y2));
    svg.appendChild(l);
  }

  private placeRobot(): void {
    const off = 4;
    this.robotEl.style.left = `${off + this.rx * this.cellPx}px`;
    this.robotEl.style.top = `${off + this.ry * this.cellPx}px`;
  }

  private move(dir: number): void {
    if (this.running) return;
    const c = this.grid[this.ry]![this.rx]!;
    /* 检查该方向是否有墙 */
    if (dir === 0 && c.top) return;
    if (dir === 1 && c.right) return;
    if (dir === 2 && c.bottom) return;
    if (dir === 3 && c.left) return;
    const nx = this.rx + DX[dir]!;
    const ny = this.ry + DY[dir]!;
    if (nx < 0 || nx >= this.n || ny < 0 || ny >= this.n) return;
    this.rx = nx;
    this.ry = ny;
    sfxTick();
    this.robotEl.classList.remove("rmb-robot--hop");
    /* 触发重新动画 */
    void this.robotEl.offsetWidth;
    this.robotEl.classList.add("rmb-robot--hop");
    this.placeRobot();
    if (this.rx === this.goalX && this.ry === this.goalY) {
      this.arrive();
    }
  }

  private arrive(): void {
    this.running = true;
    sfxPop();
    const r = this.boardEl.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      this.running = false;
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 900);
  }

  private injectStyle(): void {
    if (document.getElementById("rmb-style")) return;
    const st = document.createElement("style");
    st.id = "rmb-style";
    st.textContent = RMB_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function RMB_CSS(theme: string): string {
  return `
.rmb-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.rmb-task{font-size:1.05rem;font-weight:800;text-align:center;}
.rmb-boardwrap{background:rgba(255,255,255,.55);border-radius:16px;padding:6px;box-shadow:var(--shadow);}
.rmb-board{position:relative;}
.rmb-walls{position:absolute;left:4px;top:4px;width:calc(100% - 8px);height:calc(100% - 8px);pointer-events:none;z-index:2;}
.rmb-walls line{stroke:${theme};stroke-width:4;stroke-linecap:round;}
.rmb-goal{position:absolute;display:flex;align-items:center;justify-content:center;width:60px;height:60px;font-size:1.9rem;z-index:1;animation:rmb-pulse 1.2s ease-in-out infinite alternate;}
@keyframes rmb-pulse{from{transform:scale(1)}to{transform:scale(1.12)}}
.rmb-robot{position:absolute;display:flex;align-items:center;justify-content:center;width:60px;height:60px;font-size:2rem;z-index:3;transition:left .14s ease,top .14s ease;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));}
.rmb-robot--hop{animation:rmb-hop .18s ease;}
@keyframes rmb-hop{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
.rmb-pad{display:grid;grid-template-columns:repeat(3,64px);grid-template-rows:repeat(2,56px);gap:8px;justify-content:center;}
.rmb-pad-blank{visibility:hidden;}
.rmb-dir{font-size:1.5rem;font-weight:800;border:none;border-radius:14px;background:linear-gradient(180deg,#fff,#ececff);box-shadow:var(--shadow);color:${theme};cursor:pointer;user-select:none;touch-action:manipulation;}
.rmb-dir:active{transform:scale(.92);}
.rmb-actions{display:flex;gap:10px;}
@media (max-width:380px){.rmb-pad{grid-template-columns:repeat(3,54px);grid-template-rows:repeat(2,48px);}}
`;
}

export function create(): RobotMazeGame {
  return new RobotMazeGame();
}
