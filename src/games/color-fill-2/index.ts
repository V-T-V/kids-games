/* 区域填色 Color Fill 2 —— 数独变体：每行每列颜色不重复。
   比 color-sudoku 更大：easy 3x3 三色 / medium 4x4 四色 / hard 5x5 五色。
   给定一些预设色块，孩子点空格循环填色，使每行每列颜色都不重复。
   点格子循环变色（色1→色2→…→空）。从完整解挖空保证有唯一解思路。
   easy 4轮 / medium 6轮 / hard 8轮。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 颜色调色板：hex + 中文名。 */
const PALETTE = [
  { hex: "#ff5252", name: "红" },
  { hex: "#ffd93d", name: "黄" },
  { hex: "#4d96ff", name: "蓝" },
  { hex: "#6bcf7f", name: "绿" },
  { hex: "#a55eea", name: "紫" },
];

export class ColorFill2Game extends BaseGame {
  constructor() {
    super("color-fill-2");
  }

  private n = 3;
  private roundsDone = 0;
  private roundTotal = 0;
  private solution: number[] = []; // n*n，正确解（颜色索引 0..n-1）
  private grid: number[] = []; // 当前盘面，-1 表示空
  private fixed: boolean[] = [];

  protected mount(): void {
    this.n =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
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
    this.solution = this.buildSolution(this.n);
    const blanks =
      this.difficulty === "easy"
        ? Math.ceil((this.n * this.n) / 2)
        : this.difficulty === "medium"
          ? Math.ceil((this.n * this.n * 2) / 3)
          : Math.ceil((this.n * this.n * 3) / 4);
    const idxs = shuffle(
      Array.from({ length: this.n * this.n }, (_, i) => i),
    ).slice(0, blanks);
    this.grid = this.solution.slice();
    this.fixed = this.solution.map(() => true);
    for (const i of idxs) {
      this.grid[i] = -1;
      this.fixed[i] = false;
    }
    this.render();
  }

  /** 构造一个 n×n 的拉丁方（每行每列 0..n-1 不重复）作为解。
   *  用随机首行 + 列循环移位，保证合法。 */
  private buildSolution(n: number): number[] {
    const firstRow = shuffle(Array.from({ length: n }, (_, i) => i));
    const sol: number[] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        sol.push(firstRow[(c + r) % n]!);
      }
    }
    return sol;
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "cf2-wrap";

    const task = document.createElement("div");
    task.className = "cf2-task";
    task.innerHTML = `每行每列<b>颜色都不重复</b> <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    // 调色板图例
    const legend = document.createElement("div");
    legend.className = "cf2-legend";
    for (let i = 0; i < this.n; i++) {
      const s = document.createElement("span");
      s.className = "cf2-chip";
      s.style.setProperty("--cf2-c", PALETTE[i]!.hex);
      s.textContent = PALETTE[i]!.name;
      legend.appendChild(s);
    }
    wrap.appendChild(legend);

    const board = document.createElement("div");
    board.className = "cf2-board";
    board.id = "cf2-board";
    board.style.setProperty("--n", String(this.n));
    const cellSize = this.n <= 3 ? 84 : this.n === 4 ? 72 : 62;
    for (let i = 0; i < this.n * this.n; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cf2-cell";
      cell.style.width = `${cellSize}px`;
      cell.style.height = `${cellSize}px`;
      cell.dataset.i = String(i);
      const v = this.grid[i]!;
      if (v >= 0) {
        cell.style.setProperty("--cf2-c", PALETTE[v]!.hex);
        cell.classList.add("cf2-cell--filled");
      } else {
        cell.classList.add("cf2-cell--empty");
      }
      if (this.fixed[i]) cell.classList.add("cf2-cell--fixed");
      if (!this.fixed[i]) {
        cell.addEventListener("click", () => this.cycle(i, cell));
      }
      board.appendChild(cell);
    }
    wrap.appendChild(board);

    const tip = document.createElement("div");
    tip.className = "cf2-tip";
    tip.id = "cf2-tip";
    tip.textContent = "点空格切换颜色：每次换一种，再点变空";
    wrap.appendChild(tip);

    this.root.appendChild(wrap);
  }

  private cycle(i: number, cell: HTMLButtonElement): void {
    const cur = this.grid[i]!;
    const next = cur >= this.n - 1 ? -1 : cur + 1;
    this.grid[i] = next;
    if (next < 0) {
      cell.classList.add("cf2-cell--empty");
      cell.classList.remove("cf2-cell--filled");
      cell.style.removeProperty("--cf2-c");
    } else {
      cell.classList.remove("cf2-cell--empty");
      cell.classList.add("cf2-cell--filled");
      cell.style.setProperty("--cf2-c", PALETTE[next]!.hex);
    }
    cell.classList.remove("cf2-cell--flash");
    void cell.offsetWidth;
    cell.classList.add("cf2-cell--flash");
    sfxPop();
    this.resetWrongStreak();
    this.checkDone();
  }

  private checkDone(): void {
    if (this.grid.some((v) => v < 0)) return;
    const ok = this.isValid();
    if (ok) {
      const board = this.root.querySelector(".cf2-board");
      board
        ?.querySelectorAll(".cf2-cell")
        .forEach((el) => el.classList.add("cf2-cell--win"));
      const rect = board
        ? board.getBoundingClientRect()
        : new DOMRect(window.innerWidth / 2, window.innerHeight / 2);
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 850);
    } else {
      // 标出冲突的行/列
      const paused = this.onWrong();
      this.markConflicts();
      if (paused) this.showRest();
    }
  }

  /** 高亮存在重复的格子（行或列里同色）。 */
  private markConflicts(): void {
    const cells = this.root.querySelectorAll<HTMLElement>(".cf2-cell");
    const bad = new Set<number>();
    const n = this.n;
    for (let r = 0; r < n; r++) {
      const seen = new Map<number, number[]>();
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        const v = this.grid[i]!;
        if (v < 0) continue;
        const arr = seen.get(v) ?? [];
        arr.push(i);
        seen.set(v, arr);
      }
      seen.forEach((arr) => {
        if (arr.length > 1) arr.forEach((i) => bad.add(i));
      });
    }
    for (let c = 0; c < n; c++) {
      const seen = new Map<number, number[]>();
      for (let r = 0; r < n; r++) {
        const i = r * n + c;
        const v = this.grid[i]!;
        if (v < 0) continue;
        const arr = seen.get(v) ?? [];
        arr.push(i);
        seen.set(v, arr);
      }
      seen.forEach((arr) => {
        if (arr.length > 1) arr.forEach((i) => bad.add(i));
      });
    }
    bad.forEach((i) => {
      cells[i]?.classList.add("cf2-cell--err");
    });
    this.trackTimeout(() => {
      this.root
        .querySelectorAll(".cf2-cell--err")
        .forEach((el) => el.classList.remove("cf2-cell--err"));
    }, 600);
  }

  private isValid(): boolean {
    const n = this.n;
    for (let r = 0; r < n; r++) {
      const row = new Set<number>();
      for (let c = 0; c < n; c++) {
        const v = this.grid[r * n + c]!;
        if (v < 0 || row.has(v)) return false;
        row.add(v);
      }
    }
    for (let c = 0; c < n; c++) {
      const col = new Set<number>();
      for (let r = 0; r < n; r++) {
        const v = this.grid[r * n + c]!;
        if (v < 0 || col.has(v)) return false;
        col.add(v);
      }
    }
    return true;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🎨",
      variant: "rest",
      body: "有重复颜色啦～看看哪一行或哪一列用了两次同色，换掉它！",
      primary: { text: "继续", icon: "🎨", onClick: () => ov.destroy() },
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
    if (document.getElementById("cf2-style")) return;
    const st = document.createElement("style");
    st.id = "cf2-style";
    st.textContent = CF2_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function CF2_CSS(theme: string): string {
  return `
.cf2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.cf2-task{font-size:1.05rem;font-weight:800;text-align:center;color:var(--ink);background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.cf2-task b{color:${theme};}
.cf2-task small{color:var(--ink-soft);font-weight:700;font-size:.82rem;margin-left:6px;}
.cf2-legend{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.cf2-chip{padding:4px 12px;border-radius:999px;background:var(--cf2-c);color:#fff;font-weight:800;font-size:.85rem;box-shadow:var(--shadow);}
.cf2-board{display:grid;grid-template-columns:repeat(var(--n),auto);gap:8px;padding:14px;background:linear-gradient(160deg,#fff,#e0f7fa);border-radius:20px;box-shadow:var(--shadow-lg);}
.cf2-cell{border:none;border-radius:14px;background:var(--cf2-c,#fff);box-shadow:inset 0 -3px 5px rgba(0,0,0,.12),0 2px 4px rgba(0,0,0,.08);cursor:pointer;transition:transform .12s ease;}
.cf2-cell:active{transform:scale(.92);}
.cf2-cell--empty{background:repeating-linear-gradient(45deg,#f4f4f4,#f4f4f4 8px,#e6e6e6 8px,#e6e6e6 16px);}
.cf2-cell--filled{border:2px solid rgba(255,255,255,.6);}
.cf2-cell--fixed{cursor:default;box-shadow:inset 0 2px 4px rgba(0,0,0,.18);}
.cf2-cell--flash{animation:cf2-flash .3s ease;}
.cf2-cell--err{outline:3px solid #ff6348;animation:cf2-no .4s ease;}
.cf2-cell--win{animation:cf2-yes .5s ease;}
@keyframes cf2-flash{0%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes cf2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes cf2-yes{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
.cf2-tip{font-size:.88rem;font-weight:700;color:var(--ink-soft);text-align:center;}
@media (max-width:380px){}
`;
}

export function create(): ColorFill2Game {
  return new ColorFill2Game();
}
