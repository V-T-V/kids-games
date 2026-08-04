/* 冰滑迷宫2 Frost Slide —— ice-slide 的简化版：更小网格（4x4），更短，
   直线滑行，点一个方向后角色一直滑到撞墙才停，到达终点即可。
   独特点：更友好的入门版（4x4），适合更小年龄。
   视觉：冰雪网格 + 角色（企鹅）。难度=网格大小（4~5）。
   通关=到达目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

function parseKey(k: string): [number, number] {
  const [a, b] = k.split(",");
  return [Number(a), Number(b)];
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export class FrostSlideGame extends BaseGame {
  constructor() {
    super("frost-slide");
  }

  private n = 4;
  private walls: boolean[][] = [];
  private startPos: [number, number] = [0, 0];
  private goal: [number, number] = [0, 0];
  private cur: [number, number] = [0, 0];

  private roundsDone = 0;
  private roundTotal = 0;
  private over = false;

  protected mount(): void {
    this.n = this.difficulty === "hard" ? 5 : 4;
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
  }

  private startRound(): void {
    this.over = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.generate();
    this.cur = [this.startPos[0], this.startPos[1]];
    this.render();
  }

  /** 生成保证有解：BFS 求可达停靠点，目标从中选取。 */
  private generate(): void {
    const n = this.n;
    for (let attempt = 0; attempt < 200; attempt++) {
      const density =
        this.difficulty === "easy"
          ? 0.06
          : this.difficulty === "medium"
            ? 0.12
            : 0.18;
      const walls: boolean[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => Math.random() < density),
      );
      let sx = 0,
        sy = 0,
        ok = false;
      for (let t = 0; t < 40; t++) {
        sx = randInt(0, n - 1);
        sy = randInt(0, n - 1);
        if (!walls[sy]![sx]!) {
          ok = true;
          break;
        }
      }
      if (!ok) continue;
      const start: [number, number] = [sx, sy];
      const reachable = this.bfsReach(start, walls, n);
      if (reachable.size < 3) continue;
      const startKey = `${start[0]},${start[1]}`;
      const candidates = [...reachable].filter((k) => k !== startKey);
      if (candidates.length === 0) continue;
      const ranked = candidates
        .map((k) => {
          const [x, y] = parseKey(k);
          return { k, d: Math.abs(x - start[0]) + Math.abs(y - start[1]) };
        })
        .sort((a, b) => b.d - a.d);
      const pick =
        ranked[
          Math.floor(
            Math.random() * Math.max(1, Math.ceil(ranked.length * 0.5)),
          )
        ]!;
      const [gx, gy] = parseKey(pick.k);
      this.walls = walls;
      this.startPos = start;
      this.goal = [gx, gy];
      return;
    }
    this.walls = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => false),
    );
    this.startPos = [0, 0];
    this.goal = [n - 1, n - 1];
  }

  private bfsReach(
    start: [number, number],
    walls: boolean[][],
    n: number,
  ): Set<string> {
    const seen = new Set<string>();
    const queue: [number, number][] = [[start[0], start[1]]];
    seen.add(`${start[0]},${start[1]}`);
    while (queue.length) {
      const [x, y] = queue.shift()!;
      for (const [dx, dy] of DIRS) {
        const stop = this.slideStop(x, y, dx, dy, walls, n);
        const key = `${stop[0]},${stop[1]}`;
        if (!seen.has(key)) {
          seen.add(key);
          queue.push(stop);
        }
      }
    }
    return seen;
  }

  private slideStop(
    x: number,
    y: number,
    dx: number,
    dy: number,
    walls: boolean[][],
    n: number,
  ): [number, number] {
    let cx = x,
      cy = y;
    while (true) {
      const nx = cx + dx,
        ny = cy + dy;
      if (nx < 0 || nx >= n || ny < 0 || ny >= n) break;
      if (walls[ny]![nx]!) break;
      cx = nx;
      cy = ny;
    }
    return [cx, cy];
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "fs2-wrap";
    const task = document.createElement("div");
    task.className = "fs2-task";
    task.innerHTML = `点方向让小企鹅<b>滑到</b>终点🐟！<br><span class="fs2-hint">冰面会<b>一直滑到撞墙</b>才停～ 第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const cell = this.n <= 4 ? 70 : 60;
    const board = document.createElement("div");
    board.className = "fs2-board";
    board.style.width = `${this.n * cell}px`;
    board.style.height = `${this.n * cell}px`;

    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < this.n; x++) {
        const c = document.createElement("div");
        c.className = "fs2-cell";
        c.style.left = `${x * cell}px`;
        c.style.top = `${y * cell}px`;
        c.style.width = `${cell}px`;
        c.style.height = `${cell}px`;
        if (this.walls[y]![x]!) c.classList.add("fs2-cell--wall");
        if (x === this.goal[0] && y === this.goal[1]) {
          const g = document.createElement("div");
          g.className = "fs2-goal";
          g.textContent = "🐟";
          c.appendChild(g);
        }
        board.appendChild(c);
      }
    }
    const hero = document.createElement("div");
    hero.className = "fs2-hero";
    hero.id = "fs2-hero";
    hero.textContent = "🐧";
    hero.style.width = `${cell}px`;
    hero.style.height = `${cell}px`;
    hero.style.left = `${this.cur[0] * cell}px`;
    hero.style.top = `${this.cur[1] * cell}px`;
    board.appendChild(hero);

    wrap.appendChild(board);

    const pad = document.createElement("div");
    pad.className = "fs2-pad";
    pad.innerHTML = `
      <button type="button" class="fs2-key" data-d="0" aria-label="向上">⬆️</button>
      <div class="fs2-pad-row">
        <button type="button" class="fs2-key" data-d="3" aria-label="向左">⬅️</button>
        <button type="button" class="fs2-key fs2-key--mid" disabled>❄️</button>
        <button type="button" class="fs2-key" data-d="1" aria-label="向右">➡️</button>
      </div>
      <button type="button" class="fs2-key" data-d="2" aria-label="向下">⬇️</button>`;
    wrap.appendChild(pad);

    pad.querySelectorAll<HTMLButtonElement>(".fs2-key[data-d]").forEach((b) => {
      b.addEventListener("click", () => this.move(Number(b.dataset.d)));
    });

    this.root.appendChild(wrap);
  }

  private move(dir: number): void {
    if (this.over) return;
    const [dx, dy] = DIRS[dir]!;
    const stop = this.slideStop(
      this.cur[0],
      this.cur[1],
      dx,
      dy,
      this.walls,
      this.n,
    );
    if (stop[0] === this.cur[0] && stop[1] === this.cur[1]) {
      sfxPop();
      return;
    }
    sfxPop();
    this.resetWrongStreak();
    this.cur = stop;
    const hero = this.root.querySelector("#fs2-hero") as HTMLDivElement | null;
    const cell = this.n <= 4 ? 70 : 60;
    if (hero) {
      hero.style.transition = "left .22s ease, top .22s ease";
      hero.style.left = `${stop[0] * cell}px`;
      hero.style.top = `${stop[1] * cell}px`;
    }
    if (stop[0] === this.goal[0] && stop[1] === this.goal[1]) {
      this.over = true;
      const rect = hero?.getBoundingClientRect();
      this.onCorrect(
        rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
        rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
      );
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 600);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("fs2-style")) return;
    const st = document.createElement("style");
    st.id = "fs2-style";
    st.textContent = FS2_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function FS2_CSS(theme: string): string {
  return `
.fs2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;}
.fs2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.fs2-task b{color:${theme};}
.fs2-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.fs2-board{position:relative;background:linear-gradient(135deg,#e3f2fd,#b3e5fc);border-radius:18px;box-shadow:var(--shadow-lg);border:3px solid ${theme};}
.fs2-cell{position:absolute;box-sizing:border-box;border:1px dashed rgba(2,119,189,.25);}
.fs2-cell--wall{background:linear-gradient(135deg,#5d4037,#3e2723);border:1px solid #2e1a17;border-radius:6px;box-shadow:inset 0 2px 0 rgba(255,255,255,.15);}
.fs2-goal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2rem;animation:fs2-bob 1s ease-in-out infinite alternate;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));}
@keyframes fs2-bob{from{transform:translateY(0) scale(1)}to{transform:translateY(-4px) scale(1.08)}}
.fs2-hero{position:absolute;display:flex;align-items:center;justify-content:center;font-size:2.2rem;line-height:1;z-index:5;filter:drop-shadow(0 3px 4px rgba(0,0,0,.25));will-change:left,top;}
.fs2-pad{display:flex;flex-direction:column;align-items:center;gap:6px;}
.fs2-pad-row{display:flex;gap:6px;align-items:center;}
.fs2-key{width:62px;height:62px;font-size:1.6rem;border:none;border-radius:14px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 30%,#fff));box-shadow:var(--shadow);cursor:pointer;transition:transform .1s ease;display:flex;align-items:center;justify-content:center;}
.fs2-key:active{transform:scale(.92);}
.fs2-key:disabled{cursor:default;opacity:.6;}
.fs2-key--mid{font-size:1.4rem;}
@media (max-width:380px){.fs2-key{width:54px;height:54px;font-size:1.4rem;}}
`;
}

export function create(): FrostSlideGame {
  return new FrostSlideGame();
}
