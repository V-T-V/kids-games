/* 迷宫建造 Maze Builder —— 反转迷宫：孩子不是走迷宫，而是建造迷宫！
   网格上有起点（鼠）🏠、终点（奶酪）🧀、若干星星。孩子在空地上放/拆墙，
   让小动物沿唯一能走的路从起点走到终点，并尽量吃到星星。
   点「走一走」后动物按 BFS 最短路行进；到达终点即通关。
   难度=网格大小+需放墙数。easy 4轮 / medium 6轮 / hard 8轮。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Level {
  n: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
  stars: { x: number; y: number }[];
  rocks: { x: number; y: number }[]; // 固定岩石（不可改）
  walls: Set<string>; // 孩子放的墙 "x,y"
  wallsBudget: number; // 可放墙数
}

const DIRS4: ReadonlyArray<[number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

export class MazeBuilderGame extends BaseGame {
  constructor() {
    super("maze-builder");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private level!: Level;
  private locked = false;
  private walked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* 基类清理 */
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    this.walked = false;
    this.level = this.generate();
    this.render();
  }

  /** 生成关卡：随机网格、起终点、固定岩石、星星，预算墙数。 */
  private generate(): Level {
    const n =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 6 : 7;
    const rockCount =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 4 : 6;
    const starCount =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    const wallsBudget =
      this.difficulty === "easy" ? 6 : this.difficulty === "medium" ? 10 : 14;

    for (let attempt = 0; attempt < 300; attempt++) {
      // 起点左上区，终点右下区，保证有距离
      const start = {
        x: randInt(0, 1),
        y: randInt(0, 1),
      };
      const end = {
        x: randInt(n - 2, n - 1),
        y: randInt(n - 2, n - 1),
      };
      if (start.x === end.x && start.y === end.y) continue;

      // 放固定岩石
      const rocks = new Set<string>();
      for (let i = 0; i < rockCount * 4 && rocks.size < rockCount; i++) {
        const rx = randInt(0, n - 1);
        const ry = randInt(0, n - 1);
        const key = `${rx},${ry}`;
        if (rocks.has(key)) continue;
        if (rx === start.x && ry === start.y) continue;
        if (rx === end.x && ry === end.y) continue;
        rocks.add(key);
      }
      // 验证不放墙时仍可达（岩石不应完全堵死）
      if (!this.reachable(n, rocks, new Set(), start, end)) continue;

      // 放星星（可达的格子）
      const occupied = new Set<string>([...rocks]);
      occupied.add(`${start.x},${start.y}`);
      occupied.add(`${end.x},${end.y}`);
      const stars: { x: number; y: number }[] = [];
      for (let i = 0; i < starCount * 6 && stars.length < starCount; i++) {
        const sx = randInt(0, n - 1);
        const sy = randInt(0, n - 1);
        const key = `${sx},${sy}`;
        if (occupied.has(key)) continue;
        occupied.add(key);
        stars.push({ x: sx, y: sy });
      }

      return {
        n,
        start,
        end,
        stars,
        rocks: [...rocks].map((k) => {
          const [x, y] = k.split(",").map(Number);
          return { x: x!, y: y! };
        }),
        walls: new Set(),
        wallsBudget,
      };
    }
    // 兜底
    return {
      n: 5,
      start: { x: 0, y: 0 },
      end: { x: 4, y: 4 },
      stars: [{ x: 2, y: 1 }, { x: 1, y: 3 }],
      rocks: [{ x: 2, y: 2 }],
      walls: new Set(),
      wallsBudget: 6,
    };
  }

  /** BFS：在不考虑「孩子墙」时是否可达（用于生成器）。 */
  private reachable(
    n: number,
    rocks: Set<string>,
    walls: Set<string>,
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): boolean {
    const seen = new Set<string>([`${start.x},${start.y}`]);
    const queue: [number, number][] = [[start.x, start.y]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if (x === end.x && y === end.y) return true;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const key = `${nx},${ny}`;
        if (seen.has(key) || rocks.has(key) || walls.has(key)) continue;
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
    return false;
  }

  /** BFS 找最短路径（用墙作障碍），返回路径坐标数组，无路返回 null。 */
  private shortestPath(
    lv: Level,
  ): { x: number; y: number }[] | null {
    const rocks = new Set(lv.rocks.map((r) => `${r.x},${r.y}`));
    const seen = new Map<string, string | null>([
      [`${lv.start.x},${lv.start.y}`, null],
    ]);
    const queue: [number, number][] = [[lv.start.x, lv.start.y]];
    const n = lv.n;
    let found = false;
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if (x === lv.end.x && y === lv.end.y) {
        found = true;
        break;
      }
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        if (rocks.has(key) || lv.walls.has(key)) continue;
        seen.set(key, `${x},${y}`);
        queue.push([nx, ny]);
      }
    }
    if (!found) return null;
    // 回溯路径
    const path: { x: number; y: number }[] = [];
    let cur: string | null = `${lv.end.x},${lv.end.y}`;
    while (cur != null) {
      const [x, y] = cur.split(",").map(Number);
      path.push({ x: x!, y: y! });
      cur = seen.get(cur) ?? null;
    }
    return path.reverse();
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "mzb-wrap";

    const lv = this.level;
    const task = document.createElement("div");
    task.className = "mzb-task";
    task.innerHTML = `用墙把老鼠 🐭 引到奶酪 🧀，路上吃 ⭐ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const cell =
      lv.n <= 5 ? 62 : lv.n === 6 ? 54 : 48;
    const board = document.createElement("div");
    board.className = "mzb-board";
    board.id = "mzb-board";
    board.style.setProperty("--n", String(lv.n));
    board.style.setProperty("--cell", `${cell}px`);

    const rockSet = new Set(lv.rocks.map((r) => `${r.x},${r.y}`));
    const starSet = new Set(lv.stars.map((s) => `${s.x},${s.y}`));
    for (let y = 0; y < lv.n; y++) {
      for (let x = 0; x < lv.n; x++) {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "mzb-cell";
        c.dataset.x = String(x);
        c.dataset.y = String(y);
        c.style.width = `${cell}px`;
        c.style.height = `${cell}px`;
        const key = `${x},${y}`;
        if (rockSet.has(key)) {
          c.classList.add("mzb-cell--rock");
          c.textContent = "🪨";
          c.disabled = true;
        } else if (x === lv.start.x && y === lv.start.y) {
          c.classList.add("mzb-cell--start");
          c.textContent = "🐭";
        } else if (x === lv.end.x && y === lv.end.y) {
          c.classList.add("mzb-cell--end");
          c.textContent = "🧀";
        } else if (starSet.has(key)) {
          c.classList.add("mzb-cell--star");
          c.textContent = "⭐";
        }
        if (lv.walls.has(key)) {
          c.classList.add("mzb-cell--wall");
          c.textContent = "🧱";
        }
        if (!rockSet.has(key) && !(x === lv.start.x && y === lv.start.y) && !(x === lv.end.x && y === lv.end.y)) {
          c.addEventListener("click", () => this.toggleWall(x, y));
        }
        board.appendChild(c);
      }
    }
    wrap.appendChild(board);

    const info = document.createElement("div");
    info.className = "mzb-info";
    info.id = "mzb-info";
    info.textContent = `还可放 ${lv.wallsBudget - lv.walls.size} 块墙`;
    wrap.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "mzb-actions";
    const go = document.createElement("button");
    go.type = "button";
    go.className = "mzb-go";
    go.textContent = "🐾 走一走";
    go.addEventListener("click", () => this.walk());
    actions.appendChild(go);
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "mzb-reset";
    reset.textContent = "↺ 清空墙";
    reset.addEventListener("click", () => {
      if (this.locked) return;
      lv.walls.clear();
      this.rerenderCells();
      this.updateInfo();
    });
    actions.appendChild(reset);
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
  }

  private toggleWall(x: number, y: number): void {
    if (this.locked) return;
    const lv = this.level;
    const key = `${x},${y}`;
    if (lv.walls.has(key)) {
      lv.walls.delete(key);
    } else {
      if (lv.walls.size >= lv.wallsBudget) {
        sfxPop();
        return;
      }
      lv.walls.add(key);
    }
    sfxPop();
    this.rerenderCells();
    this.updateInfo();
  }

  private updateInfo(): void {
    const lv = this.level;
    const info = this.root.querySelector("#mzb-info");
    if (info) info.textContent = `还可放 ${lv.wallsBudget - lv.walls.size} 块墙`;
  }

  private rerenderCells(): void {
    const lv = this.level;
    const rockSet = new Set(lv.rocks.map((r) => `${r.x},${r.y}`));
    const starSet = new Set(lv.stars.map((s) => `${s.x},${s.y}`));
    const board = this.root.querySelector("#mzb-board");
    if (!board) return;
    for (let y = 0; y < lv.n; y++) {
      for (let x = 0; x < lv.n; x++) {
        const el = board.querySelector(
          `.mzb-cell[data-x="${x}"][data-y="${y}"]`,
        ) as HTMLButtonElement | null;
        if (!el) continue;
        const key = `${x},${y}`;
        // 先清状态再按层级重建
        el.classList.remove("mzb-cell--wall");
        if (rockSet.has(key)) {
          el.textContent = "🪨";
          continue;
        }
        if (x === lv.start.x && y === lv.start.y) {
          el.textContent = "🐭";
          continue;
        }
        if (x === lv.end.x && y === lv.end.y) {
          el.textContent = "🧀";
          continue;
        }
        if (lv.walls.has(key)) {
          el.classList.add("mzb-cell--wall");
          el.textContent = "🧱";
          continue;
        }
        el.textContent = starSet.has(key) ? "⭐" : "";
      }
    }
  }

  /** 验证并播放老鼠行走动画。 */
  private walk(): void {
    if (this.locked || this.walked) return;
    const lv = this.level;
    const path = this.shortestPath(lv);
    if (!path) {
      // 堵死了
      const paused = this.onWrong();
      if (paused) this.showRest();
      const board = this.root.querySelector("#mzb-board");
      board?.classList.add("mzb-board--err");
      this.trackTimeout(
        () => board?.classList.remove("mzb-board--err"),
        400,
      );
      return;
    }
    this.locked = true;
    this.walked = true;
    this.resetWrongStreak();
    const cell =
      lv.n <= 5 ? 62 : lv.n === 6 ? 54 : 48;
    const PAD = 12; // 棋盘内边距
    const board = this.root.querySelector("#mzb-board");
    const mouse = document.createElement("div");
    mouse.className = "mzb-mouse";
    mouse.textContent = "🐭";
    mouse.style.width = `${cell}px`;
    mouse.style.height = `${cell}px`;
    mouse.style.left = `${PAD + lv.start.x * (cell + 4)}px`;
    mouse.style.top = `${PAD + lv.start.y * (cell + 4)}px`;
    board?.appendChild(mouse);
    // 收集到的星星
    const collected = new Set<string>();
    const starSet = new Set(lv.stars.map((s) => `${s.x},${s.y}`));
    let step = 0;
    const animStep = (): void => {
      step += 1;
      if (step >= path.length) {
        this.onWalkDone(collected.size, lv.stars.length);
        return;
      }
      const p = path[step]!;
      mouse.style.left = `${PAD + p.x * (cell + 4)}px`;
      mouse.style.top = `${PAD + p.y * (cell + 4)}px`;
      // 吃星星
      const key = `${p.x},${p.y}`;
      if (starSet.has(key) && !collected.has(key)) {
        collected.add(key);
        sfxPop();
        const starEl = board?.querySelector(
          `.mzb-cell[data-x="${p.x}"][data-y="${p.y}"]`,
        );
        starEl?.classList.add("mzb-cell--eaten");
      }
      this.trackTimeout(animStep, 180);
    };
    this.trackTimeout(animStep, 180);
  }

  private onWalkDone(gotStars: number, totalStars: number): void {
    const board = this.root.querySelector("#mzb-board");
    const rect = board
      ? board.getBoundingClientRect()
      : new DOMRect(window.innerWidth / 2, window.innerHeight / 2);
    this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
    // 提示吃了多少星星（不影响通关，鼓励下次吃全）
    if (gotStars < totalStars) {
      const toast = document.createElement("div");
      toast.className = "mzb-toast";
      toast.textContent = `吃到 ${gotStars}/${totalStars} 颗⭐ 通关！`;
      this.root.querySelector(".mzb-wrap")?.appendChild(toast);
    }
    this.trackTimeout(() => {
      this.roundsDone += 1;
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 1100);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🐭",
      variant: "rest",
      body: "老鼠被墙堵住啦，拆掉几块墙让它能走到奶酪～",
      primary: { text: "继续", icon: "🧀", onClick: () => ov.destroy() },
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
    if (document.getElementById("mzb-style")) return;
    const st = document.createElement("style");
    st.id = "mzb-style";
    st.textContent = MZB_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function MZB_CSS(theme: string): string {
  return `
.mzb-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;}
.mzb-task{font-size:1.05rem;font-weight:800;text-align:center;color:var(--ink);background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.mzb-task small{color:var(--ink-soft);font-weight:700;font-size:.82rem;margin-left:6px;}
.mzb-board{position:relative;display:grid;grid-template-columns:repeat(var(--n),var(--cell));grid-auto-rows:var(--cell);gap:4px;padding:12px;background:linear-gradient(160deg,#e8f5e9,#c8e6c9);border-radius:18px;box-shadow:var(--shadow-lg);}
.mzb-board--err{animation:mzb-no .4s ease;}
@keyframes mzb-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.mzb-cell{display:flex;align-items:center;justify-content:center;font-size:calc(var(--cell) * .56);line-height:1;border:2px dashed rgba(0,0,0,.1);border-radius:10px;background:rgba(255,255,255,.55);cursor:pointer;transition:transform .1s ease,background .1s ease;}
.mzb-cell:active{transform:scale(.92);}
.mzb-cell--rock{background:#b0a89e;border-style:solid;border-color:#8d847a;cursor:default;}
.mzb-cell--wall{background:linear-gradient(160deg,#ef9a9a,#e57373);border-style:solid;border-color:#d84a4a;}
.mzb-cell--start{background:linear-gradient(160deg,#c5e1a5,#aed581);border-style:solid;border-color:#7cb342;}
.mzb-cell--end{background:linear-gradient(160deg,#ffe0b2,#ffb74d);border-style:solid;border-color:#fb8c00;}
.mzb-cell--star{background:radial-gradient(circle,#fff9c4,#fff176);}
.mzb-cell--eaten{opacity:.25;}
.mzb-info{font-size:.95rem;font-weight:800;color:var(--ink);}
.mzb-actions{display:flex;gap:10px;}
.mzb-go{font-size:1rem;font-weight:800;color:#fff;background:linear-gradient(160deg,${theme},color-mix(in srgb,${theme} 60%,#000));border:none;padding:10px 22px;border-radius:999px;cursor:pointer;box-shadow:var(--shadow);}
.mzb-go:active{transform:scale(.95);}
.mzb-reset{font-size:.9rem;font-weight:700;color:var(--ink);background:rgba(255,255,255,.7);border:none;padding:8px 18px;border-radius:999px;cursor:pointer;box-shadow:var(--shadow);}
.mzb-reset:active{transform:scale(.95);}
.mzb-mouse{position:absolute;display:flex;align-items:center;justify-content:center;font-size:calc(var(--cell) * .56);z-index:8;transition:left .18s ease,top .18s ease;filter:drop-shadow(0 3px 3px rgba(0,0,0,.3));}
.mzb-toast{font-size:.95rem;font-weight:800;color:${theme};background:#fff;padding:8px 16px;border-radius:999px;box-shadow:var(--shadow);animation:mzb-toast .3s ease;}
@keyframes mzb-toast{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
@media (max-width:380px){}
`;
}

export function create(): MazeBuilderGame {
  return new MazeBuilderGame();
}
