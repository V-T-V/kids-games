/* 冰面滑行 Ice Slide —— 角色在冰面上，点一个方向后一直滑到撞墙才停。
   要把角色滑到目标点。独特点：滑到底才停（区别于一步步走），需要预判。
   巧思：用 BFS 可达性生成关卡，保证目标一定滑得到。
   视觉：冰蓝网格 + 墙块 + 企鹅角色。难度=网格大小。通关=到达目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

/** 把 "x,y" 键解析为坐标。 */
function parseKey(k: string): [number, number] {
  const [a, b] = k.split(",");
  return [Number(a), Number(b)];
}

/** 方向：上右下左。 */
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export class IceSlideGame extends BaseGame {
  constructor() {
    super("ice-slide");
  }

  private n = 5;
  private walls: boolean[][] = [];
  private startPos: [number, number] = [0, 0];
  private goal: [number, number] = [0, 0];
  private cur: [number, number] = [0, 0];
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.n =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 6 : 7;
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空，无 RAF */
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.generateLevel();
    this.cur = [this.startPos[0], this.startPos[1]];
    this.render();
  }

  /** 生成保证有解的关卡：BFS 求出所有可达停靠点，目标从中选取。 */
  private generateLevel(): void {
    const n = this.n;
    for (let attempt = 0; attempt < 200; attempt++) {
      // 随机墙密度（留出足够滑行空间）
      const density =
        this.difficulty === "easy"
          ? 0.1
          : this.difficulty === "medium"
            ? 0.16
            : 0.22;
      const walls: boolean[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => Math.random() < density),
      );
      // 随机起点（非墙）
      let sx = 0,
        sy = 0;
      let ok = false;
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
      // BFS 计算所有可达停靠点
      const reachable = this.bfsReach(start, walls, n);
      if (reachable.size < 3) continue; // 太少不好玩
      // 目标：选一个距离起点较远的可达点（更有挑战），但避开起点本身
      const startKey = `${start[0]},${start[1]}`;
      const candidates = [...reachable].filter((k) => k !== startKey);
      if (candidates.length === 0) continue;
      // 优先选曼哈顿距离较大的（孩子需要思考）
      const ranked = candidates
        .map((k) => {
          const [x, y] = parseKey(k);
          const d = Math.abs(x - start[0]) + Math.abs(y - start[1]);
          return { k, d };
        })
        .sort((a, b) => b.d - a.d);
      // 从前 40% 里随机挑（避免每次都是最远的）
      const pick =
        ranked[
          Math.floor(
            Math.random() * Math.max(1, Math.ceil(ranked.length * 0.4)),
          )
        ]!;
      const [gx, gy] = parseKey(pick.k);
      this.walls = walls;
      this.startPos = start;
      this.goal = [gx, gy];
      return;
    }
    // 兜底：极简无墙关卡（保证总能出题）
    this.walls = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => false),
    );
    this.startPos = [0, 0];
    this.goal = [n - 1, n - 1];
  }

  /** BFS：从起点出发，所有"滑到底停"的停靠格集合。 */
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

  /** 从 (x,y) 沿 (dx,dy) 滑到撞墙/边界返回停靠格。 */
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
    wrap.className = "is2-wrap";
    const task = document.createElement("div");
    task.className = "is2-task";
    task.innerHTML = `点方向键让小企鹅滑过去！<br><span class="is2-hint">冰面会<b>一直滑到撞墙</b>才停哦～ ${this.roundsDone + 1} / ${this.roundTotal}</span>`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "is2-board";
    const cell = this.n <= 5 ? 60 : this.n === 6 ? 52 : 46;
    board.style.setProperty("--n", String(this.n));
    board.style.setProperty("--cell", `${cell}px`);
    board.style.width = `${this.n * cell}px`;
    board.style.height = `${this.n * cell}px`;

    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < this.n; x++) {
        const c = document.createElement("div");
        c.className = "is2-cell";
        c.style.left = `${x * cell}px`;
        c.style.top = `${y * cell}px`;
        c.style.width = `${cell}px`;
        c.style.height = `${cell}px`;
        if (this.walls[y]![x]!) c.classList.add("is2-cell--wall");
        if (x === this.goal[0] && y === this.goal[1]) {
          const g = document.createElement("div");
          g.className = "is2-goal";
          g.textContent = "🐟";
          c.appendChild(g);
        }
        board.appendChild(c);
      }
    }
    const hero = document.createElement("div");
    hero.className = "is2-hero";
    hero.textContent = "🐧";
    hero.style.width = `${cell}px`;
    hero.style.height = `${cell}px`;
    hero.style.left = `${this.cur[0] * cell}px`;
    hero.style.top = `${this.cur[1] * cell}px`;
    board.appendChild(hero);

    wrap.appendChild(board);

    // 方向键
    const pad = document.createElement("div");
    pad.className = "is2-pad";
    pad.innerHTML = `
      <button type="button" class="is2-key" data-d="0" aria-label="向上">⬆️</button>
      <div class="is2-pad-row">
        <button type="button" class="is2-key" data-d="3" aria-label="向左">⬅️</button>
        <button type="button" class="is2-key is2-key--mid" disabled>🧊</button>
        <button type="button" class="is2-key" data-d="1" aria-label="向右">➡️</button>
      </div>
      <button type="button" class="is2-key" data-d="2" aria-label="向下">⬇️</button>`;
    wrap.appendChild(pad);

    pad.querySelectorAll<HTMLButtonElement>(".is2-key[data-d]").forEach((b) => {
      b.addEventListener("click", () => {
        const d = Number(b.dataset.d);
        this.move(d);
      });
    });

    this.root.appendChild(wrap);
  }

  private move(dir: number): void {
    const [dx, dy] = DIRS[dir]!;
    const stop = this.slideStop(
      this.cur[0],
      this.cur[1],
      dx,
      dy,
      this.walls,
      this.n,
    );
    // 没动（原地）不算
    if (stop[0] === this.cur[0] && stop[1] === this.cur[1]) {
      sfxPop();
      return;
    }
    sfxPop();
    this.resetWrongStreak();
    this.cur = stop;
    // 动画移动
    const hero = this.root.querySelector(".is2-hero") as HTMLDivElement | null;
    if (hero) {
      const cell = this.n <= 5 ? 60 : this.n === 6 ? 52 : 46;
      hero.style.transition = "left .22s ease, top .22s ease";
      hero.style.left = `${stop[0] * cell}px`;
      hero.style.top = `${stop[1] * cell}px`;
    }
    if (stop[0] === this.goal[0] && stop[1] === this.goal[1]) {
      // 到达目标
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
    if (document.getElementById("is2-style")) return;
    const st = document.createElement("style");
    st.id = "is2-style";
    st.textContent = IS2_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function IS2_CSS(theme: string): string {
  return `
.is2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.is2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.is2-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.is2-hint b{color:${theme};}
.is2-board{position:relative;background:linear-gradient(135deg,#e0f7fa,#b2ebf2);border-radius:16px;box-shadow:var(--shadow-lg);border:3px solid ${theme};}
.is2-cell{position:absolute;box-sizing:border-box;border:1px dashed rgba(0,150,170,.25);}
.is2-cell--wall{background:linear-gradient(135deg,#5d4037,#3e2723);border:1px solid #2e1a17;border-radius:4px;box-shadow:inset 0 2px 0 rgba(255,255,255,.15),inset 0 -2px 0 rgba(0,0,0,.3);}
.is2-goal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.8rem;animation:is2-bob 1s ease-in-out infinite alternate;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));}
@keyframes is2-bob{from{transform:translateY(0) scale(1)}to{transform:translateY(-4px) scale(1.08)}}
.is2-hero{position:absolute;display:flex;align-items:center;justify-content:center;font-size:1.9rem;line-height:1;z-index:5;filter:drop-shadow(0 3px 4px rgba(0,0,0,.25));will-change:left,top;}
.is2-pad{display:flex;flex-direction:column;align-items:center;gap:6px;}
.is2-pad-row{display:flex;gap:6px;align-items:center;}
.is2-key{width:58px;height:58px;font-size:1.5rem;border:none;border-radius:14px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 30%,#fff));box-shadow:var(--shadow);cursor:pointer;transition:transform .1s ease;display:flex;align-items:center;justify-content:center;}
.is2-key:active{transform:scale(.92);}
.is2-key:disabled{cursor:default;opacity:.6;}
.is2-key--mid{font-size:1.3rem;}
@media (max-width:380px){.is2-key{width:50px;height:50px;font-size:1.3rem;}}
`;
}

export function create(): IceSlideGame {
  return new IceSlideGame();
}
