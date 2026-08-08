/* 光线迷宫 Light Maze —— 光源在左侧射出光束，目标在右侧。
   网格中可放镜子（/ 或 \），孩子点击格子切换镜子方向，
   让光束经镜子反射后射中目标。独特点：可视化光线传播 + 镜面反射原理。
   巧思：生成时先放好一条"解路径"上的镜子（验证可达），再随机旋转/加干扰，
   保证一定有解。视觉：网格 + 光线轨迹 + 镜子。难度=镜子数。通关=连通轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";
import {
  reflect as reflectDir,
  trace as tracePath,
  type Mirror,
  type Dir,
} from "./engine.ts";

export class LightMazeGame extends BaseGame {
  constructor() {
    super("light-maze");
  }

  private n = 5;
  private grid: Mirror[][] = [];
  /** 可交互（孩子可点击切换）的格子坐标。 */
  private editable: boolean[][] = [];
  private srcRow = 0;
  private goalRow = 0;
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.n =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.generateLevel();
    this.render();
  }

  /** 镜面反射：方向 d 撞到镜 m 后的新方向（委托给 engine.ts）。 */
  private reflect(d: Dir, m: Exclude<Mirror, 0>): Dir {
    return reflectDir(d, m);
  }

  /** 追踪光线路径（委托给 engine.ts）。返回格子序列与是否命中目标。 */
  private trace(): {
    cells: Array<[number, number]>;
    hit: boolean;
    outOfBounds: boolean;
  } {
    return tracePath(this.grid, this.srcRow, this.goalRow, this.n);
  }

  /**
   * 生成保证有解的关卡：
   * 1) 选定 srcRow、goalRow。
   * 2) 构造一条"阶梯折线"路径：光从左向右进入 (srcRow)，
   *    经过若干次垂直转弯抵达 goalRow，再向右射出。
   *    路径上的每个拐点放镜子（\ 或 /），并记录其正确方向。
   * 3) 把这些拐点设为 editable，方向随机初始（可能已是正确，没关系）。
   * 4) 添加少量干扰空格（也可切换）。
   */
  private generateLevel(): void {
    const n = this.n;
    const turns =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    for (let attempt = 0; attempt < 300; attempt++) {
      const grid: Mirror[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => 0 as Mirror),
      );
      const editable: boolean[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => false),
      );
      const srcRow = randInt(0, n - 1);
      const goalRow = randInt(0, n - 1);

      // 构造路径：从 srcRow 出发，水平段→垂直转弯→水平段...→goalRow
      // 每个垂直转弯需要两块镜子（同列不同行）：一块把水平光转成垂直，
      // 一块把垂直光转回水平。挑选若干中间行做阶梯折线。
      const midRows: number[] = [];
      const allRows = Array.from({ length: n }, (_, i) => i).filter(
        (r) => r !== srcRow && r !== goalRow,
      );
      // 需要的中间行数：目标行=源行时至少要 1 个不同行（让光绕开再回）
      const needRows =
        goalRow === srcRow
          ? Math.min(turns, allRows.length)
          : Math.min(Math.max(1, turns - 1), allRows.length);
      // 随机选 needRows 个中间行（去重）
      const pool = [...allRows];
      for (let i = pool.length - 1; i > 0 && midRows.length < needRows; i--) {
        const j = randInt(0, i);
        midRows.push(pool[j]!);
        pool.splice(j, 1);
      }
      // 完整目标行序列：源行 → 中间行们 → 目标行（若相同则补一个不同行再回）
      const pathRows = [srcRow, ...midRows];
      if (goalRow !== srcRow) pathRows.push(goalRow);
      else if (midRows.length > 0) pathRows.push(goalRow);
      // 若无法构造（行数不足），跳过本 attempt
      if (pathRows.length < 2) continue;

      // 在网格里放镜子实现 pathRows 的阶梯折线：
      // 光从 (col=0,srcRow) 向右走，到某列 r1 处放镜子转向到 pathRows[1]，
      // 到达后再放镜子转回水平，再到下一列转下一行……
      // 为简化，每段水平段长度随机，垂直段直接用一面镜子完成转向。
      // 实现策略：用"列"做转弯点。第 i 个转弯在列 turnCol[i]。
      const turnCols: number[] = [];
      let prevCol = 0;
      let okLayout = true;
      for (let i = 1; i < pathRows.length; i++) {
        // 从 prevCol 向右走至少 1 格到 turnCol
        const remaining = pathRows.length - 1 - i;
        const maxCol = n - 1 - remaining;
        const minCol = prevCol + 1;
        if (maxCol < minCol) {
          okLayout = false;
          break;
        }
        const tc = randInt(minCol, maxCol);
        turnCols.push(tc);
        prevCol = tc;
      }
      if (!okLayout) continue;
      // 最后一列留给目标出口（光向右射出）
      // 现在沿路径放镜子：从 (0,srcRow) 向右到 turnCols[0]，转垂直到 pathRows[1]，
      // 向右到 turnCols[1]，转垂直到 pathRows[2]……
      // 关键：每个 turnCols[i] 列需要两面镜子：一面在 pathRows[i]（把水平转垂直），
      // 一面在 pathRows[i+1]（把垂直转水平）—— 但若两镜在同一列不同行，光会在第一面镜转垂直后
      // 在同一列行进，到第二面镜再转水平。这正是我们要的。
      // 决定每个转弯的两面镜子的 / 或 \：
      let curRow = srcRow;
      let curCol = 0;
      for (let i = 0; i < turnCols.length; i++) {
        const tc = turnCols[i]!;
        const nextRow = pathRows[i + 1]!;
        // 第一面镜：在 (tc, curRow)，光向右进，需转向"向下/上"到 nextRow
        const m1: Exclude<Mirror, 0> = nextRow > curRow ? 2 : 1; // \→向下，/→向上
        grid[curRow]![tc] = m1;
        editable[curRow]![tc] = true;
        // 第二面镜：在 (tc, nextRow)，光垂直进（方向取决于上下），需转向右
        const goingDown = nextRow > curRow;
        // 垂直光（下或上）撞 \ 或 / 转向右：
        //  下(1) + \ → 左 ❌； 下(1) + / → 右 ✓
        //  上(3) + \ → 右 ✓；  上(3) + / → 左 ❌
        const m2: Exclude<Mirror, 0> = goingDown ? 1 : 2;
        grid[nextRow]![tc] = m2;
        editable[nextRow]![tc] = true;
        curRow = nextRow;
        curCol = tc;
      }
      // 末段：从最后一个 turnCol 向右射出，到列 n（出口）
      void curCol;

      this.grid = grid;
      this.editable = editable;
      this.srcRow = srcRow;
      this.goalRow = goalRow;

      // 验证此"正解"确实命中目标
      const { hit } = this.trace();
      if (!hit) continue;

      // 添加干扰：随机把一些 editable 镜子初始方向打乱（保证至少仍可通过点击还原）
      // 同时增加若干"可切换空格"作为干扰（点击会变成镜子），但控制数量避免太难
      const distractors =
        this.difficulty === "easy" ? 0 : this.difficulty === "medium" ? 1 : 2;
      let added = 0;
      let tries = 0;
      while (added < distractors && tries < 60) {
        tries++;
        const rx = randInt(1, n - 2);
        const ry = randInt(0, n - 1);
        if (grid[ry]![rx]! !== 0 || editable[ry]![rx]!) continue;
        grid[ry]![rx] = sample([1, 2] as const);
        editable[ry]![rx] = true;
        added++;
      }
      // 把所有 editable 镜子随机重设方向（包含正确解在内的随机初值），保证可点击切换
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (editable[y]![x]! && Math.random() < 0.7) {
            grid[y]![x] = sample([1, 2] as const);
          }
        }
      }
      // 校验：不能一开始就是命中（那样没意思），若是则重新打乱
      let safety = 0;
      while (this.trace().hit && safety++ < 20) {
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            if (editable[y]![x]!) grid[y]![x] = sample([1, 2] as const);
          }
        }
      }
      return;
    }
    // 兜底：最简单的两镜关卡
    this.n = 4;
    const g: Mirror[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const e: boolean[][] = [
      [false, false, false, false],
      [false, false, false, false],
      [false, false, false, false],
      [false, false, false, false],
    ];
    g[1]![1] = 2;
    e[1]![1] = true; // \
    g[2]![1] = 1;
    e[2]![1] = true; // /
    this.grid = g;
    this.editable = e;
    this.srcRow = 1;
    this.goalRow = 2;
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "lm2-wrap";
    const task = document.createElement("div");
    task.className = "lm2-task";
    task.innerHTML = `点格子切换镜子 <b>/</b> 或 <b>\\</b>，把光反射到 🎯！<br><span class="lm2-hint">每次点击切换方向～ ${this.roundsDone + 1} / ${this.roundTotal}</span>`;
    wrap.appendChild(task);

    const { cells, hit } = this.trace();
    const cellSet = new Set(cells.map((c) => `${c[0]},${c[1]}`));

    const board = document.createElement("div");
    board.className = "lm2-board";
    const n = this.n;
    const cell = n <= 4 ? 64 : n === 5 ? 56 : 48;
    board.style.width = `${n * cell}px`;
    board.style.height = `${n * cell}px`;

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const c = document.createElement("div");
        c.className = "lm2-cell";
        c.style.left = `${x * cell}px`;
        c.style.top = `${y * cell}px`;
        c.style.width = `${cell}px`;
        c.style.height = `${cell}px`;
        if (cellSet.has(`${x},${y}`)) c.classList.add("lm2-cell--beam");
        if (this.editable[y]![x]!) {
          c.classList.add("lm2-cell--editable");
          const m = this.grid[y]![x]!;
          const icon = document.createElement("div");
          icon.className = `lm2-mirror lm2-mirror--${m === 1 ? "slash" : "back"}`;
          c.appendChild(icon);
          c.addEventListener("click", () => this.toggle(x, y));
        }
        board.appendChild(c);
      }
    }
    // 光源（左侧）
    const src = document.createElement("div");
    src.className = "lm2-src";
    src.textContent = "💡";
    src.style.top = `${this.srcRow * cell}px`;
    src.style.height = `${cell}px`;
    board.appendChild(src);
    // 目标（右侧）
    const goal = document.createElement("div");
    goal.className = "lm2-goal";
    goal.textContent = hit ? "🎉" : "🎯";
    goal.style.top = `${this.goalRow * cell}px`;
    goal.style.height = `${cell}px`;
    board.appendChild(goal);

    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private toggle(x: number, y: number): void {
    const cur = this.grid[y]![x]!;
    if (cur === 0) return;
    this.grid[y]![x] = (cur === 1 ? 2 : 1) as Mirror;
    sfxPop();
    this.resetWrongStreak();
    const { hit } = this.trace();
    this.render();
    if (hit) {
      const rect = this.root
        .querySelector(".lm2-board")
        ?.getBoundingClientRect();
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
      }, 700);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("lm2-style")) return;
    const st = document.createElement("style");
    st.id = "lm2-style";
    st.textContent = LM2_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function LM2_CSS(theme: string): string {
  return `
.lm2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.lm2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.lm2-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.lm2-hint b,.lm2-task b{color:${theme};}
.lm2-board{position:relative;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;box-shadow:var(--shadow-lg);border:3px solid ${theme};padding:0;}
.lm2-cell{position:absolute;box-sizing:border-box;border:1px solid rgba(255,255,255,.06);}
.lm2-cell--beam{background:radial-gradient(circle,rgba(255,235,59,.55),rgba(255,235,59,.1));box-shadow:inset 0 0 8px rgba(255,235,59,.5);}
.lm2-cell--editable{cursor:pointer;}
.lm2-cell--editable:hover{background:rgba(255,255,255,.08);}
.lm2-mirror{position:absolute;inset:14%;border-radius:6px;background:linear-gradient(135deg,#e0e0e0,#9e9e9e);box-shadow:0 2px 4px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.5);transition:transform .15s ease;}
.lm2-mirror--slash{transform:rotate(45deg);}
.lm2-mirror--back{transform:rotate(-45deg);}
.lm2-src{position:absolute;left:-44px;width:40px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;filter:drop-shadow(0 0 6px ${theme});}
.lm2-goal{position:absolute;right:-44px;width:40px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;animation:lm2-pulse 1s ease-in-out infinite alternate;filter:drop-shadow(0 0 6px #6bcf7f);}
@keyframes lm2-pulse{from{transform:scale(1)}to{transform:scale(1.15)}}
@media (max-width:380px){.lm2-src,.lm2-goal{font-size:1.4rem;}}
`;
}

export function create(): LightMazeGame {
  return new LightMazeGame();
}
