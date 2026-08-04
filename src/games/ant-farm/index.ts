/* 蚂蚁搬家 Ant Farm —— 在网格上为蚂蚁画一条从家到食物的路线，绕开障碍。
   独特点：路径绘制 + 迷宫寻路。先随机生成一条从起点到终点的可行路径，
   再在路径外随机放置障碍（保证可解），孩子沿任意可行路径画出来即可。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

type Cell = "empty" | "wall" | "start" | "end";

export class AntFarmGame extends BaseGame {
  constructor() {
    super("ant-farm");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private size = 5;
  private grid: Cell[][] = [];
  private path: boolean[][] = []; // 玩家已画的格子
  private startPos: [number, number] = [0, 0];
  private endPos: [number, number] = [0, 0];
  private drawing = false;
  private pathCells: [number, number][] = [];
  private unbinds: (() => void)[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private gridSize(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 5
        : 6;
  }

  /** 生成保证可解的迷宫：
   *  1. 先随机游走出一条从 start 到 end 的路径，标记为可走；
   *  2. 其余空格随机放障碍（不放路径上）；
   *  3. 终点必可达（因为路径本身连通）。 */
  private generate(): void {
    const N = this.gridSize();
    this.size = N;
    for (let attempt = 0; attempt < 200; attempt++) {
      const grid: Cell[][] = Array.from({ length: N }, () =>
        Array.from({ length: N }, () => "empty" as Cell),
      );
      const sr = randInt(0, N - 1);
      const er = randInt(0, N - 1);
      const start: [number, number] = [sr, 0];
      const end: [number, number] = [er, N - 1];
      grid[sr]![0] = "start";
      grid[er]![N - 1] = "end";

      // 随机游走找一条路径（保证连通）
      const path = this.randomWalk(start, end, N);
      if (path.length === 0) continue;

      // 放障碍：在非路径、非起终点的格子里
      const inPath = new Set(path.map(([r, c]) => `${r},${c}`));
      const candidates: [number, number][] = [];
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
          if (!inPath.has(`${r},${c}`) && grid[r]![c] === "empty")
            candidates.push([r, c]);
      shuffle(candidates);
      const wallRatio =
        this.difficulty === "easy"
          ? 0.15
          : this.difficulty === "medium"
            ? 0.25
            : 0.32;
      const wallCount = Math.floor(candidates.length * wallRatio);
      for (let i = 0; i < wallCount && i < candidates.length; i++) {
        const [r, c] = candidates[i]!;
        grid[r]![c] = "wall";
      }
      this.grid = grid;
      this.startPos = start;
      this.endPos = end;
      return;
    }
    // 兜底：完全空旷网格
    const N2 = this.gridSize();
    this.size = N2;
    const grid: Cell[][] = Array.from({ length: N2 }, () =>
      Array.from({ length: N2 }, () => "empty" as Cell),
    );
    grid[0]![0] = "start";
    grid[0]![N2 - 1] = "end";
    this.grid = grid;
    this.startPos = [0, 0];
    this.endPos = [0, N2 - 1];
  }

  /** 简单随机游走：从 start 走到 end，每步朝 end 的方向带随机扰动。 */
  private randomWalk(
    start: [number, number],
    end: [number, number],
    N: number,
  ): [number, number][] {
    const visited = Array.from({ length: N }, () =>
      Array.from({ length: N }, () => false),
    );
    const path: [number, number][] = [[start[0], start[1]]];
    visited[start[0]]![start[1]] = true;
    let cur: [number, number] = [start[0], start[1]];
    let steps = 0;
    const maxSteps = N * N * 4;
    while ((cur[0] !== end[0] || cur[1] !== end[1]) && steps < maxSteps) {
      steps++;
      const dirs: [number, number][] = shuffle([
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]);
      // 优先朝 end 方向
      dirs.sort((a, b) => {
        const da =
          Math.abs(cur[0] + a[0] - end[0]) + Math.abs(cur[1] + a[1] - end[1]);
        const db =
          Math.abs(cur[0] + b[0] - end[0]) + Math.abs(cur[1] + b[1] - end[1]);
        // 70% 朝近，30% 随机
        return Math.random() < 0.7 ? da - db : db - da;
      });
      let moved = false;
      for (const [dr, dc] of dirs) {
        const nr = cur[0] + dr;
        const nc = cur[1] + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        if (visited[nr]![nc]) continue;
        visited[nr]![nc] = true;
        path.push([nr, nc]);
        cur = [nr, nc];
        moved = true;
        break;
      }
      if (!moved) {
        // 回溯
        path.pop();
        if (path.length === 0) return [];
        cur = path[path.length - 1]!;
      }
    }
    if (cur[0] === end[0] && cur[1] === end[1]) return path;
    return [];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.generate();
    this.path = Array.from({ length: this.size }, () =>
      Array.from({ length: this.size }, () => false),
    );
    this.pathCells = [];
    this.render();
  }

  private render(): void {
    const wrap = document.createElement("div");
    wrap.className = "af-wrap";

    const task = document.createElement("div");
    task.className = "af-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 从 <b>🐜家</b> 画一条线到 <b>🍎食物</b>，绕开石头`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "af-board";
    board.id = "af-board";
    board.style.setProperty("--n", String(this.size));

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const cell = document.createElement("div");
        cell.className = "af-cell";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        const t = this.grid[r]![c];
        if (t === "wall") {
          cell.classList.add("af-cell--wall");
          cell.textContent = "🪨";
        } else if (t === "start") {
          cell.classList.add("af-cell--start");
          cell.textContent = "🐜";
        } else if (t === "end") {
          cell.classList.add("af-cell--end");
          cell.textContent = "🍎";
        }
        board.appendChild(cell);
      }
    }
    wrap.appendChild(board);

    const hint = document.createElement("div");
    hint.className = "af-hint";
    hint.textContent = "用手指从蚂蚁家一直划到食物～";
    wrap.appendChild(hint);

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "af-reset";
    reset.textContent = "↺ 清除路线";
    reset.addEventListener("click", () => this.clearPath());
    wrap.appendChild(reset);

    this.root.appendChild(wrap);

    this.bindDraw(board);
  }

  private bindDraw(board: HTMLElement): void {
    const cellFromPoint = (x: number, y: number): HTMLElement | null => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (el && el.classList.contains("af-cell")) return el;
      return null;
    };
    const onDown = (p: { x: number; y: number }) => {
      // 必须从起点开始
      const cell = cellFromPoint(p.x, p.y);
      if (!cell) return;
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      if (r === this.startPos[0] && c === this.startPos[1]) {
        this.drawing = true;
        this.clearPath();
        this.addToPath(r, c);
      }
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!this.drawing) return;
      const cell = cellFromPoint(p.x, p.y);
      if (!cell) return;
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      this.addToPath(r, c);
    };
    const onUp = () => {
      if (!this.drawing) return;
      this.drawing = false;
      this.checkSolved();
    };
    const u = bindPointer(board, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private addToPath(r: number, c: number): void {
    const t = this.grid[r]![c];
    if (t === "wall") {
      // 撞墙：结束绘制并提示
      this.drawing = false;
      this.flashWrong();
      return;
    }
    // 已在路径中：允许回退（撤销到该点）
    const idx = this.pathCells.findIndex(([pr, pc]) => pr === r && pc === c);
    if (idx >= 0) {
      // 截断到该点
      for (let i = idx + 1; i < this.pathCells.length; i++) {
        const [pr, pc] = this.pathCells[i]!;
        this.path[pr]![pc] = false;
        this.markCell(pr, pc, false);
      }
      this.pathCells = this.pathCells.slice(0, idx + 1);
      return;
    }
    // 必须与上一格相邻
    if (this.pathCells.length > 0) {
      const [pr, pc] = this.pathCells[this.pathCells.length - 1]!;
      const dist = Math.abs(pr - r) + Math.abs(pc - c);
      if (dist !== 1) return; // 不相邻，忽略
    }
    if (this.path[r]![c]) return;
    this.path[r]![c] = true;
    this.pathCells.push([r, c]);
    this.markCell(r, c, true);
    sfxPop();
  }

  private markCell(r: number, c: number, on: boolean): void {
    const el = this.root.querySelector(
      `.af-cell[data-r="${r}"][data-c="${c}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    el.classList.toggle("af-cell--path", on);
  }

  private clearPath(): void {
    this.pathCells.forEach(([r, c]) => this.markCell(r, c, false));
    this.path = Array.from({ length: this.size }, () =>
      Array.from({ length: this.size }, () => false),
    );
    this.pathCells = [];
  }

  private flashWrong(): void {
    const board = this.root.querySelector("#af-board") as HTMLElement | null;
    if (board) {
      board.classList.add("af-board--shake");
      this.trackTimeout(() => board.classList.remove("af-board--shake"), 400);
    }
    const paused = this.onWrong();
    if (paused) this.showRest();
    this.trackTimeout(() => this.clearPath(), 300);
  }

  private checkSolved(): void {
    if (this.pathCells.length === 0) return;
    const last = this.pathCells[this.pathCells.length - 1]!;
    if (last[0] === this.endPos[0] && last[1] === this.endPos[1]) {
      // 成功
      this.resetWrongStreak();
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      // 蚂蚁沿路径行进动画
      this.animateAnt();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1200);
    }
  }

  private animateAnt(): void {
    const board = this.root.querySelector("#af-board") as HTMLElement | null;
    if (!board) return;
    const ant = document.createElement("div");
    ant.className = "af-ant";
    ant.textContent = "🐜";
    board.appendChild(ant);
    const firstCell = this.root.querySelector(
      `.af-cell[data-r="${this.startPos[0]}"][data-c="${this.startPos[1]}"]`,
    ) as HTMLElement | null;
    if (firstCell) {
      const rect = firstCell.getBoundingClientRect();
      const boardRect = board.getBoundingClientRect();
      ant.style.left = `${rect.left - boardRect.left + rect.width / 4}px`;
      ant.style.top = `${rect.top - boardRect.top + rect.height / 4}px`;
    }
    this.pathCells.forEach(([r, c], i) => {
      this.trackTimeout(
        () => {
          const cell = this.root.querySelector(
            `.af-cell[data-r="${r}"][data-c="${c}"]`,
          ) as HTMLElement | null;
          if (!cell || !board) return;
          const rect = cell.getBoundingClientRect();
          const boardRect = board.getBoundingClientRect();
          ant.style.left = `${rect.left - boardRect.left + rect.width / 4}px`;
          ant.style.top = `${rect.top - boardRect.top + rect.height / 4}px`;
        },
        (i + 1) * 120,
      );
    });
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "蚂蚁不能踩石头哦，绕开它们走到食物～",
      primary: { text: "继续", icon: "🐜", onClick: () => ov.destroy() },
      secondary: {
        text: "回大厅",
        icon: "🏠",
        onClick: () => {
          ov.destroy();
          navigate("");
        },
      },
    });
    ov.show();
  }

  private injectStyle(): void {
    if (document.getElementById("af-style")) return;
    const st = document.createElement("style");
    st.id = "af-style";
    st.textContent = AF_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function AF_CSS(theme: string): string {
  return `
.af-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.af-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.af-board{position:relative;display:grid;grid-template-columns:repeat(var(--n),72px);grid-template-rows:repeat(var(--n),72px);gap:4px;padding:10px;background:linear-gradient(180deg,#f1e4c8,#e6d3a8);border-radius:18px;box-shadow:var(--shadow);touch-action:none;}
.af-board--shake{animation:af-shake .4s ease;}
@keyframes af-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.af-cell{width:72px;height:72px;border-radius:10px;background:#fff7e8;display:flex;align-items:center;justify-content:center;font-size:2rem;box-shadow:inset 0 -2px 4px rgba(0,0,0,.08);transition:background .15s;}
.af-cell--wall{background:linear-gradient(180deg,#9a9a9a,#6a6a6a);}
.af-cell--start{background:linear-gradient(180deg,#ffe4b5,#ffd089);}
.af-cell--end{background:linear-gradient(180deg,#ffd2c8,#ff9f8a);}
.af-cell--path{background:linear-gradient(180deg,#cdecc0,#a3e08a);box-shadow:inset 0 0 0 3px ${theme};}
.af-hint{font-size:.95rem;font-weight:700;color:var(--ink);opacity:.85;}
.af-reset{font-size:.9rem;font-weight:700;color:var(--ink);background:rgba(255,255,255,.7);border:none;padding:6px 16px;border-radius:999px;cursor:pointer;box-shadow:var(--shadow);}
.af-reset:active{transform:scale(.95);}
.af-ant{position:absolute;font-size:1.8rem;transition:left .15s ease,top .15s ease;pointer-events:none;z-index:10;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3));}
@media (max-width:380px){.af-board{grid-template-columns:repeat(var(--n),56px);grid-template-rows:repeat(var(--n),56px);}.af-cell{width:56px;height:56px;font-size:1.5rem;}}
`;
}

export function create(): AntFarmGame {
  return new AntFarmGame();
}
