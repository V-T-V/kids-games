/* 3D 迷宫 Maze 3D —— 简化的两层立体迷宫。两层 4x4 网格：
   楼梯格子可上下切换楼层，方向按钮（⬆️⬇️⬅️➡️）移动，从"起点 🚪"到"终点 ⭐"。
   独特点：用"层切换"概念引入立体空间思维；按钮控制避免精确点击；
   关卡从模板生成保证有解。前缀 m3d-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxTick } from "../../core/audio.ts";
import { starsByAccuracy, starsByMoves } from "../../core/scoring.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

// 格子类型：空 / 墙 / 起点 / 终点 / 楼梯（上下连通）
type Cell = "." | "#" | "S" | "G" | "L"; // L = 楼梯

interface Level {
  rows: number;
  cols: number;
  grid: Cell[][][]; // [floor][row][col]
  start: { f: number; r: number; c: number };
  goal: { f: number; r: number; c: number };
}

const FLOORS = 2;

/** 生成两层迷宫：用预设的可解模板，随机选楼层/方向，保证可达。
   简单起见：用 4x4 网格，层 0 与层 1 通过两个楼梯格连通，
   每层内部用一条预设通路 + 少量墙增加趣味。 */
function makeLevel(diff: "easy" | "medium" | "hard"): Level {
  const rows = 4;
  const cols = 4;
  // 用预设模板（已验证有解）+ 随机起点/终点/楼层增加变化
  const tmplA: Cell[][] = [
    [".", ".", ".", "."],
    [".", "#", "#", "."],
    [".", ".", ".", "."],
    ["#", ".", "#", "."],
  ];
  const tmplB: Cell[][] = [
    [".", "#", ".", "."],
    [".", ".", ".", "#"],
    ["#", "#", ".", "."],
    [".", ".", ".", "."],
  ];
  // 楼梯位置（两层共享同坐标，形成 3D 连通）
  const stairs =
    diff === "easy"
      ? [
          { r: 0, c: 0 },
          { r: 3, c: 3 },
        ]
      : [
          { r: 0, c: 3 },
          { r: 3, c: 0 },
        ];
  const g0 = tmplA.map((row) => [...row]);
  const g1 = tmplB.map((row) => [...row]);
  for (const s of stairs) {
    g0[s.r]![s.c] = "L";
    g1[s.r]![s.c] = "L";
  }
  // 起点/终点：随机但保证不同层（鼓励使用楼梯）
  const startF = randInt(0, 1);
  const goalF = startF === 0 ? 1 : 0;
  // 起点终点放在非墙、非楼梯、非对角的开放格
  const openCells = (g: Cell[][]) => {
    const out: { r: number; c: number }[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) if (g[r]![c] === ".") out.push({ r, c });
    return out;
  };
  const sStart = openCells(g0);
  const sGoal = openCells(g1);
  const sp = sStart[randInt(0, sStart.length - 1)]!;
  const gp = sGoal[randInt(0, sGoal.length - 1)]!;
  g0[sp.r]![sp.c] = "S";
  g1[gp.r]![gp.c] = "G";
  const grid = [g0, g1];
  return {
    rows,
    cols,
    grid,
    start: { f: startF, r: sp.r, c: sp.c },
    goal: { f: goalF, r: gp.r, c: gp.c },
  };
}

/** BFS 验证从 start 到 goal 可达（含跨楼层）。 */
function reachable(level: Level): boolean {
  const { grid, rows, cols, start, goal } = level;
  const seen = new Set<string>();
  const q: { f: number; r: number; c: number }[] = [start];
  seen.add(`${start.f},${start.r},${start.c}`);
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  while (q.length) {
    const cur = q.shift()!;
    if (cur.f === goal.f && cur.r === goal.r && cur.c === goal.c) return true;
    const cell = grid[cur.f]![cur.r]![cur.c]!;
    // 同层四方向
    for (const [dr, dc] of dirs) {
      const ddr = dr!;
      const ddc = dc!;
      const nr = cur.r + ddr;
      const nc = cur.c + ddc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const t = grid[cur.f]![nr]![nc]!;
      if (t === "#") continue;
      const key = `${cur.f},${nr},${nc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      q.push({ f: cur.f, r: nr, c: nc });
    }
    // 楼梯：跨层
    if (cell === "L" || cell === "S" || cell === "G") {
      // 楼梯位置才能跨层
    }
    if (cell === "L") {
      const nf = cur.f === 0 ? 1 : 0;
      const t = grid[nf]![cur.r]![cur.c]!;
      if (t !== "#") {
        const key = `${nf},${cur.r},${cur.c}`;
        if (!seen.has(key)) {
          seen.add(key);
          q.push({ f: nf, r: cur.r, c: cur.c });
        }
      }
    }
  }
  return false;
}

export class Maze3DGame extends BaseGame {
  constructor() {
    super("maze-3d");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private level!: Level;
  private pos = { f: 0, r: 0, c: 0 };
  private moves = 0;
  private solved = false;
  private cleanupBtns: (() => void)[] = [];

  protected override mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected override unmount(): void {
    this.cleanupBtns.forEach((fn) => fn());
    this.cleanupBtns = [];
  }

  private startRound(): void {
    this.solved = false;
    this.moves = 0;
    this.cleanupBtns = [];
    this.reportProgress(this.roundsDone, this.roundTotal);
    // 生成保证可达的关卡
    let lvl: Level;
    let tries = 0;
    do {
      lvl = makeLevel(this.difficulty);
      tries++;
    } while (!reachable(lvl) && tries < 40);
    this.level = lvl;
    this.pos = { ...lvl.start };
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "m3d-wrap";

    const task = document.createElement("div");
    task.className = "m3d-task";
    task.innerHTML = `从 🚪 走到 ⭐<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const floorLabel = document.createElement("div");
    floorLabel.className = "m3d-floor";
    floorLabel.innerHTML = `当前层：<b>${this.pos.f === 0 ? "1️⃣ 一层" : "2️⃣ 二层"}</b>`;
    wrap.appendChild(floorLabel);

    // 两层并排显示，高亮当前层
    const floors = document.createElement("div");
    floors.className = "m3d-floors";
    for (let f = 0; f < FLOORS; f++) {
      const fb = document.createElement("div");
      fb.className =
        "m3d-floorgrid" + (f === this.pos.f ? " m3d-floorgrid--active" : "");
      const label = document.createElement("div");
      label.className = "m3d-floorgrid__label";
      label.textContent = f === 0 ? "一层" : "二层";
      fb.appendChild(label);
      const grid = document.createElement("div");
      grid.className = "m3d-grid";
      for (let r = 0; r < this.level.rows; r++) {
        for (let c = 0; c < this.level.cols; c++) {
          const cell = this.level.grid[f]![r]![c]!;
          const d = document.createElement("div");
          d.className = "m3d-cell";
          if (cell === "#") d.classList.add("m3d-cell--wall");
          else if (cell === "L") {
            d.classList.add("m3d-cell--stair");
            d.textContent = "🪜";
          } else if (cell === "S") {
            d.textContent = "🚪";
          } else if (cell === "G") {
            d.textContent = "⭐";
          }
          if (this.pos.f === f && this.pos.r === r && this.pos.c === c) {
            d.classList.add("m3d-cell--here");
            d.textContent = "🐰";
          }
          grid.appendChild(d);
        }
      }
      fb.appendChild(grid);
      floors.appendChild(fb);
    }
    wrap.appendChild(floors);

    const controls = document.createElement("div");
    controls.className = "m3d-controls";
    const mkBtn = (label: string, fn: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "m3d-btn";
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    };
    const up = mkBtn("⬆️", () => this.move(-1, 0));
    const down = mkBtn("⬇️", () => this.move(1, 0));
    const left = mkBtn("⬅️", () => this.move(0, -1));
    const right = mkBtn("➡️", () => this.move(0, 1));
    const toggle = mkBtn("🪜 换层", () => this.toggleFloor());
    // 布局：上 / 左 右 / 下 / 换层
    const row1 = document.createElement("div");
    row1.className = "m3d-row";
    row1.appendChild(up);
    const row2 = document.createElement("div");
    row2.className = "m3d-row";
    row2.appendChild(left);
    row2.appendChild(right);
    const row3 = document.createElement("div");
    row3.className = "m3d-row";
    row3.appendChild(down);
    const row4 = document.createElement("div");
    row4.className = "m3d-row";
    row4.appendChild(toggle);
    controls.appendChild(row1);
    controls.appendChild(row2);
    controls.appendChild(row3);
    controls.appendChild(row4);
    wrap.appendChild(controls);

    const tip = document.createElement("div");
    tip.className = "m3d-tip";
    tip.innerHTML = `走到 <b>🪜</b> 再点"换层"可上下楼`;
    wrap.appendChild(tip);

    this.root.appendChild(wrap);
  }

  private move(dr: number, dc: number): void {
    if (this.solved) return;
    const nr = this.pos.r + dr;
    const nc = this.pos.c + dc;
    if (nr < 0 || nr >= this.level.rows || nc < 0 || nc >= this.level.cols)
      return;
    const t = this.level.grid[this.pos.f]![nr]![nc]!;
    if (t === "#") {
      sfxTick();
      return;
    }
    this.pos = { f: this.pos.f, r: nr, c: nc };
    this.moves++;
    sfxPop();
    this.afterMove();
  }

  private toggleFloor(): void {
    if (this.solved) return;
    const cur = this.level.grid[this.pos.f]![this.pos.r]![this.pos.c]!;
    if (cur !== "L") {
      sfxTick();
      return;
    }
    const nf = this.pos.f === 0 ? 1 : 0;
    this.pos = { f: nf, r: this.pos.r, c: this.pos.c };
    this.moves++;
    sfxPop();
    this.afterMove();
  }

  private afterMove(): void {
    const goal = this.level.goal;
    if (
      this.pos.f === goal.f &&
      this.pos.r === goal.r &&
      this.pos.c === goal.c
    ) {
      this.solved = true;
      const rect = this.root.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + 100);
      this.trackTimeout(() => {
        this.roundsDone++;
        // 星级：用错误次数为主，移动次数作次维度
        const moveStar = starsByMoves(this.moves, [12, 20]);
        const accStar = starsByAccuracy(this.wrongCount);
        const stars = Math.min(moveStar, accStar);
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(stars);
        } else {
          this.startRound();
        }
      }, 800);
      return;
    }
    this.render();
  }

  private injectStyle(): void {
    if (document.getElementById("m3d-style")) return;
    const st = document.createElement("style");
    st.id = "m3d-style";
    st.textContent = M3D_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function M3D_CSS(theme: string): string {
  return `
.m3d-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;width:min(560px,100%);}
.m3d-task{font-size:1.05rem;font-weight:800;color:var(--ink);background:#fff;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
.m3d-task small{color:var(--ink-soft);font-weight:700;font-size:.8rem;margin-left:6px;}
.m3d-floor{font-size:.95rem;font-weight:800;color:${theme};}
.m3d-floor b{font-size:1.1rem;}
.m3d-floors{display:flex;gap:16px;justify-content:center;}
.m3d-floorgrid{padding:8px;border-radius:14px;background:rgba(255,255,255,.4);opacity:.5;transition:opacity .2s,transform .2s;}
.m3d-floorgrid--active{opacity:1;background:rgba(255,255,255,.85);box-shadow:var(--shadow);transform:scale(1.03);}
.m3d-floorgrid__label{font-size:.8rem;font-weight:800;color:var(--ink-soft);text-align:center;margin-bottom:4px;}
.m3d-grid{display:grid;grid-template-columns:repeat(4,56px);gap:4px;}
.m3d-cell{width:56px;height:56px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;background:linear-gradient(160deg,#fff,#e0f7fa);box-shadow:inset 0 -2px 3px rgba(0,0,0,.1);}
.m3d-cell--wall{background:repeating-linear-gradient(45deg,#5a6b7a,#5a6b7a 6px,#4a5b6a 6px,#4a5b6a 12px);}
.m3d-cell--stair{background:linear-gradient(160deg,#fff3b0,#ffd93d);}
.m3d-cell--here{background:radial-gradient(circle,#fff,#ffd6e0);animation:m3d-bounce .5s ease infinite alternate;}
@keyframes m3d-bounce{from{transform:scale(1)}to{transform:scale(1.12)}}
.m3d-controls{display:flex;flex-direction:column;gap:6px;align-items:center;margin-top:6px;}
.m3d-row{display:flex;gap:8px;justify-content:center;}
.m3d-btn{width:64px;height:54px;border:none;border-radius:14px;background:linear-gradient(180deg,#fff,#d8f3f7);color:${theme};font-size:1.4rem;font-weight:800;box-shadow:var(--shadow);cursor:pointer;transition:transform .08s;}
.m3d-btn:active{transform:scale(.9);}
.m3d-tip{font-size:.85rem;font-weight:700;color:var(--ink-soft);text-align:center;}
@media (max-width:380px){.m3d-grid{grid-template-columns:repeat(4,44px);}.m3d-cell{width:44px;height:44px;font-size:1.3rem;}.m3d-btn{width:54px;height:46px;}}
`;
}

export function create(): Maze3DGame {
  return new Maze3DGame();
}
