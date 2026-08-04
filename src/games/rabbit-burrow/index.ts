/* 兔洞迷宫 Rabbit Burrow —— 地下网格迷宫，兔子从入口走到出口。
   独特点：地下土洞质感，兔子在泥土隧道里穿行，递归回溯生成保证有解。
   视觉：棕褐色泥土 + 草地入口 + 兔子 emoji + 胡萝卜出口标记。
   难度=网格大小（5/7/9）。通关=走到出口目标轮数。前缀 rbw-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar } from "../../lobby/util.ts";

interface Cell {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  visited: boolean;
}

export class RabbitBurrowGame extends BaseGame {
  constructor() {
    super("rabbit-burrow");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private size = 5;
  private grid: Cell[][] = [];
  private px = 0;
  private py = 0;
  private ex = 0;
  private ey = 0;
  private cellPx = 0;
  private boardEl: HTMLDivElement | null = null;
  private playerEl: HTMLDivElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
  }

  private sizeForDifficulty(): number {
    if (this.difficulty === "easy") return 5;
    if (this.difficulty === "medium") return 7;
    return 9;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.size = this.sizeForDifficulty();
    this.generateMaze();
    // 入口左上，出口右下
    this.px = 0;
    this.py = 0;
    this.ex = this.size - 1;
    this.ey = this.size - 1;

    const wrap = document.createElement("div");
    wrap.className = "rbw-wrap";
    const task = document.createElement("div");
    task.className = "rbw-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 帮 🐰 找到 🥕！`;
    wrap.appendChild(task);

    // 计算格子像素（适配屏幕宽度）
    const maxBoard = Math.min(window.innerWidth - 40, 420);
    this.cellPx = Math.floor(maxBoard / this.size);

    this.boardEl = document.createElement("div");
    this.boardEl.className = "rbw-board";
    this.boardEl.style.setProperty("--rbw-cell", `${this.cellPx}px`);
    this.boardEl.style.width = `${this.size * this.cellPx}px`;
    this.boardEl.style.height = `${this.size * this.cellPx}px`;

    // 绘制墙（SVG）—— 土墙
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute(
      "viewBox",
      `0 0 ${this.size * this.cellPx} ${this.size * this.cellPx}`,
    );
    svg.setAttribute("width", String(this.size * this.cellPx));
    svg.setAttribute("height", String(this.size * this.cellPx));
    svg.classList.add("rbw-walls");
    const s = this.cellPx;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const c = this.grid[y]![x]!;
        if (c.top) svg.appendChild(this.wall(x * s, y * s, (x + 1) * s, y * s));
        if (c.left)
          svg.appendChild(this.wall(x * s, y * s, x * s, (y + 1) * s));
        if (x === this.size - 1 && c.right)
          svg.appendChild(
            this.wall((x + 1) * s, y * s, (x + 1) * s, (y + 1) * s),
          );
        if (y === this.size - 1 && c.bottom)
          svg.appendChild(
            this.wall(x * s, (y + 1) * s, (x + 1) * s, (y + 1) * s),
          );
      }
    }
    this.boardEl.appendChild(svg);

    // 出口胡萝卜（右下格）
    const exit = document.createElement("div");
    exit.className = "rbw-exit";
    exit.textContent = "🥕";
    exit.style.width = `${s}px`;
    exit.style.height = `${s}px`;
    exit.style.left = `${this.ex * s}px`;
    exit.style.top = `${this.ey * s}px`;
    this.boardEl.appendChild(exit);

    // 兔子
    this.playerEl = document.createElement("div");
    this.playerEl.className = "rbw-player";
    this.playerEl.textContent = "🐰";
    this.playerEl.style.width = `${s}px`;
    this.playerEl.style.height = `${s}px`;
    this.boardEl.appendChild(this.playerEl);
    this.placePlayer();

    wrap.appendChild(this.boardEl);

    // 屏幕方向按钮
    const pad = document.createElement("div");
    pad.className = "rbw-pad";
    const mk = (label: string, dx: number, dy: number) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rbw-pad-btn";
      b.textContent = label;
      b.addEventListener("click", () => this.tryMove(dx, dy));
      return b;
    };
    const up = mk("⬆️", 0, -1);
    const left = mk("⬅️", -1, 0);
    const right = mk("➡️", 1, 0);
    const down = mk("⬇️", 0, 1);
    pad.appendChild(up);
    const mid = document.createElement("div");
    mid.className = "rbw-pad-mid";
    mid.appendChild(left);
    mid.appendChild(right);
    pad.appendChild(mid);
    pad.appendChild(down);
    wrap.appendChild(pad);
    this.root.appendChild(wrap);

    // 键盘控制
    this.keyHandler = (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        this.tryMove(dir[0], dir[1]);
      }
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  private wall(x1: number, y1: number, x2: number, y2: number): SVGLineElement {
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", String(x1));
    ln.setAttribute("y1", String(y1));
    ln.setAttribute("x2", String(x2));
    ln.setAttribute("y2", String(y2));
    return ln;
  }

  private placePlayer(): void {
    if (!this.playerEl) return;
    const s = this.cellPx;
    this.playerEl.style.left = `${this.px * s}px`;
    this.playerEl.style.top = `${this.py * s}px`;
  }

  private tryMove(dx: number, dy: number): void {
    const cell = this.grid[this.py]![this.px]!;
    if (dx === 1 && cell.right) return;
    if (dx === -1 && cell.left) return;
    if (dy === 1 && cell.bottom) return;
    if (dy === -1 && cell.top) return;
    const nx = this.px + dx;
    const ny = this.py + dy;
    if (nx < 0 || ny < 0 || nx >= this.size || ny >= this.size) return;
    this.px = nx;
    this.py = ny;
    sfxPop();
    this.placePlayer();
    if (this.px === this.ex && this.py === this.ey) {
      this.reachExit();
    }
  }

  private reachExit(): void {
    const r = this.boardEl?.getBoundingClientRect();
    this.onCorrect(
      r ? r.left + r.width / 2 : window.innerWidth / 2,
      r ? r.top + r.height / 2 : window.innerHeight / 2,
    );
    this.resetWrongStreak();
    this.trackTimeout(() => {
      this.roundsDone += 1;
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 600);
  }

  /** 递归回溯生成迷宫，保证从 (0,0) 到 (size-1,size-1) 有通路 */
  private generateMaze(): void {
    const n = this.size;
    this.grid = [];
    for (let y = 0; y < n; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < n; x++) {
        row.push({
          top: true,
          bottom: true,
          left: true,
          right: true,
          visited: false,
        });
      }
      this.grid.push(row);
    }
    const stack: [number, number][] = [[0, 0]];
    this.grid[0]![0]!.visited = true;
    while (stack.length > 0) {
      const [cx, cy] = stack[stack.length - 1]!;
      const neighbors: [number, number, string, string][] = [];
      if (cy > 0 && !this.grid[cy - 1]![cx]!.visited)
        neighbors.push([cx, cy - 1, "top", "bottom"]);
      if (cy < n - 1 && !this.grid[cy + 1]![cx]!.visited)
        neighbors.push([cx, cy + 1, "bottom", "top"]);
      if (cx > 0 && !this.grid[cy]![cx - 1]!.visited)
        neighbors.push([cx - 1, cy, "left", "right"]);
      if (cx < n - 1 && !this.grid[cy]![cx + 1]!.visited)
        neighbors.push([cx + 1, cy, "right", "left"]);
      if (neighbors.length === 0) {
        stack.pop();
        continue;
      }
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)]!;
      const [nx, ny, wallCur, wallNei] = pick;
      const cur = this.grid[cy]![cx]!;
      const nei = this.grid[ny]![nx]!;
      cur[wallCur as "top" | "bottom" | "left" | "right"] = false;
      nei[wallNei as "top" | "bottom" | "left" | "right"] = false;
      nei.visited = true;
      stack.push([nx, ny]);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("rbw-style")) return;
    const st = document.createElement("style");
    st.id = "rbw-style";
    st.textContent = RBW_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function RBW_CSS(theme: string): string {
  return `
.rbw-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.rbw-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.rbw-board{position:relative;background:radial-gradient(circle at 30% 20%,#7a5538,#5a3d22);border:6px solid #3a2510;border-radius:18px;box-shadow:var(--shadow-lg),inset 0 0 30px rgba(0,0,0,.4);overflow:hidden;}
.rbw-walls{position:absolute;left:0;top:0;pointer-events:none;z-index:2;}
.rbw-walls line{stroke:#3a2510;stroke-width:7;stroke-linecap:round;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4));}
.rbw-exit{position:absolute;display:flex;align-items:center;justify-content:center;font-size:calc(var(--rbw-cell) * .55);z-index:1;animation:rbw-bob 1.4s ease-in-out infinite;filter:drop-shadow(0 0 6px rgba(255,200,80,.6));}
.rbw-player{position:absolute;display:flex;align-items:center;justify-content:center;font-size:calc(var(--rbw-cell) * .6);z-index:3;transition:left .12s ease,top .12s ease;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));}
.rbw-pad{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:4px;}
.rbw-pad-mid{display:flex;gap:6px;}
.rbw-pad-btn{width:64px;height:64px;border:none;border-radius:16px;background:linear-gradient(180deg,#fff,${theme}33);font-size:1.6rem;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.1);transition:transform .08s;touch-action:manipulation;}
.rbw-pad-btn:active{transform:translateY(3px);}
@keyframes rbw-bob{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
@media (max-width:380px){.rbw-pad-btn{width:54px;height:54px;font-size:1.3rem;}}
`;
}

export function create(): RabbitBurrowGame {
  return new RabbitBurrowGame();
}
