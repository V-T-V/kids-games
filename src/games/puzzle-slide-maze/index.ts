/* 滑块迷宫 Puzzle Slide Maze —— 3x3/4x4 网格里有 1 个空格，
   孩子只能滑动空格旁的方块，把红色目标方块从起点推到终点（旗帜）。
   独特点：华容道式"只能滑进空格"的移动规则；红色方块是主角。
   巧思：从已解状态出发做合法滑动打乱，保证一定有解；
   方块平滑滑入空位；难度=网格大小。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByMoves } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar } from "../../lobby/util.ts";

export class PuzzleSlideMazeGame extends BaseGame {
  constructor() {
    super("puzzle-slide-maze");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private n = 3;
  /** 格子内容；0=空格，-1=红色目标方块，其余为普通方块(1)。 */
  private grid: number[] = [];
  /** 红色方块当前所在格子的索引。 */
  private redIdx = 0;
  /** 目标格子的索引。 */
  private goalIdx = 0;
  private moves = 0;
  /** 本局累计移动上限（用于算星），根据打乱步数动态算。 */
  private moveBudget = 0;

  protected mount(): void {
    this.n =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 3 : 4;
    this.roundTotal =
      this.difficulty === "easy" ? 1 : this.difficulty === "medium" ? 2 : 2;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.buildSolvable();
    this.moves = 0;
    this.render();
  }

  /** 构造一个保证有解的局面：从目标态出发，只做合法滑动来打乱。 */
  private buildSolvable(): void {
    const total = this.n * this.n;
    // 目标态：红色方块在左上(0)，空格在右下。
    this.redIdx = 0;
    this.goalIdx = 0;
    this.grid = Array.from({ length: total }, () => 1);
    this.grid[0] = -1;
    this.grid[total - 1] = 0;
    // 打乱步数：easy 少打乱（孩子很快能解），hard 充分打乱
    const steps =
      this.difficulty === "easy" ? 10 : this.difficulty === "medium" ? 30 : 80;
    let lastBlank = -1;
    for (let i = 0; i < steps; i++) {
      const blank = this.grid.indexOf(0);
      const neigh = this.neighbors(blank).filter((x) => x !== lastBlank);
      const pick = neigh[Math.floor(Math.random() * neigh.length)]!;
      // 把红色方块的目标记录为初始位置(左上)，玩家要把它滑回左上。
      [this.grid[blank], this.grid[pick]] = [
        this.grid[pick]!,
        this.grid[blank]!,
      ];
      lastBlank = blank; // 避免立即来回滑动
    }
    // 红色方块现在被滑到了某个位置，更新 redIdx
    this.redIdx = this.grid.indexOf(-1);
    // 目标永远是左上角(0)，玩家要把红色方块滑回 0。
    this.goalIdx = 0;
    // 算星预算：允许 moves 大致是打乱步数的若干倍
    this.moveBudget = steps * 3;
  }

  private neighbors(idx: number): number[] {
    const x = idx % this.n;
    const y = Math.floor(idx / this.n);
    const out: number[] = [];
    const offs: [number, number][] = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of offs) {
      if (nx >= 0 && nx < this.n && ny >= 0 && ny < this.n)
        out.push(ny * this.n + nx);
    }
    return out;
  }

  private render(): void {
    const wrap = document.createElement("div");
    wrap.className = "psm-wrap";

    const task = document.createElement("div");
    task.className = "psm-task";
    task.innerHTML = `把<span class="psm-red">红色方块</span>滑到 <b>🏁旗帜</b> 那里<br><span class="psm-hint">只能滑动<b>空格旁边</b>的方块（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "psm-board";
    board.style.setProperty("--n", String(this.n));
    const cell = this.n === 3 ? 84 : 66;
    board.style.setProperty("--cell", `${cell}px`);

    this.grid.forEach((val, idx) => {
      const cellEl = document.createElement("div");
      cellEl.className = "psm-cell";
      if (val === 0) {
        cellEl.classList.add("psm-cell--empty");
      } else {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "psm-tile";
        if (val === -1) {
          btn.classList.add("psm-tile--red");
          btn.textContent = "🚗";
          btn.setAttribute("aria-label", "红色方块");
        }
        btn.addEventListener("click", () => this.trySlide(idx));
        cellEl.appendChild(btn);
      }
      // 目标格子的旗帜标记
      if (idx === this.goalIdx) {
        const flag = document.createElement("div");
        flag.className = "psm-goal";
        flag.textContent = "🏁";
        cellEl.appendChild(flag);
      }
      board.appendChild(cellEl);
    });
    wrap.appendChild(board);

    const actions = document.createElement("div");
    actions.className = "psm-actions";
    actions.appendChild(
      createButton({
        text: "重新打乱",
        icon: "🔄",
        variant: "secondary",
        onClick: () => this.startRound(),
      }),
    );
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
  }

  private trySlide(idx: number): void {
    const blank = this.grid.indexOf(0);
    if (!this.neighbors(idx).includes(blank)) {
      // 不相邻：温柔提示
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    [this.grid[idx], this.grid[blank]] = [this.grid[blank]!, this.grid[idx]!];
    if (this.grid[blank] === -1) this.redIdx = blank;
    else if (this.grid[idx] === -1) this.redIdx = idx;
    this.moves += 1;
    sfxPop();
    this.resetWrongStreak();
    this.render();
    // 红色方块滑到目标 → 本关完成
    if (this.grid[this.goalIdx] === -1) {
      const r = this.root.querySelector(".psm-board");
      const rect = r instanceof HTMLElement ? r.getBoundingClientRect() : null;
      this.onCorrect(
        rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
        rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
      );
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          // 按总移动次数算星
          const stars = starsByMoves(this.moves, [
            this.moveBudget,
            this.moveBudget * 2,
          ]);
          this.finishClear(stars);
        } else {
          this.startRound();
        }
      }, 700);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想一想：空格在哪里？它能帮红色方块往哪走～",
      primary: { text: "继续", icon: "🎈", onClick: () => ov.destroy() },
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
    if (document.getElementById("psm-style")) return;
    const st = document.createElement("style");
    st.id = "psm-style";
    st.textContent = PSM_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function PSM_CSS(theme: string): string {
  return `
.psm-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:100%;}
.psm-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;background:#fff;padding:10px 20px;border-radius:18px;box-shadow:var(--shadow);}
.psm-red{color:#ff5a5a;font-weight:900;}
.psm-hint{display:block;font-size:.85rem;color:var(--ink-soft);font-weight:600;margin-top:2px;}
.psm-board{
  display:grid;grid-template-columns:repeat(var(--n),var(--cell));grid-auto-rows:var(--cell);gap:6px;
  padding:10px;background:${theme};border-radius:18px;box-shadow:var(--shadow);
}
.psm-cell{position:relative;width:var(--cell);height:var(--cell);display:flex;align-items:center;justify-content:center;}
.psm-cell--empty{background:rgba(0,0,0,.18);border-radius:12px;}
.psm-tile{
  width:100%;height:100%;border:none;border-radius:12px;font-size:2rem;
  background:linear-gradient(160deg,#fff6,color-mix(in srgb,${theme} 75%,#000));
  color:#fff;box-shadow:var(--shadow);transition:transform .1s ease;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
}
.psm-tile:active{transform:scale(.94);}
.psm-tile--red{background:linear-gradient(160deg,#ff8a8a,#e23744);box-shadow:0 6px 14px rgba(226,55,68,.5),inset 0 2px 0 rgba(255,255,255,.4);}
.psm-goal{position:absolute;font-size:1.4rem;top:-4px;right:-2px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));pointer-events:none;}
.psm-actions{display:flex;gap:12px;}
@media (max-width:380px){.psm-board{--cell:62px;}}
`;
}

export function create(): PuzzleSlideMazeGame {
  return new PuzzleSlideMazeGame();
}
