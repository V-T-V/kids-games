/* 颜色数独 Color Sudoku —— 3x3 用 3 种颜色填，每行每列不重复。
   点格子循环变色（红→黄→蓝→空）。简化版低龄友好。
   独特点：用颜色代替数字，更适合不识字的低龄孩子；从完整解挖空保证有解。
   前缀 clsu-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxWrong, sfxCorrect } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

type C = "r" | "y" | "b";
const COLORS: { id: C; hex: string; name: string }[] = [
  { id: "r", hex: "#ff5252", name: "红" },
  { id: "y", hex: "#ffd93d", name: "黄" },
  { id: "b", hex: "#4d96ff", name: "蓝" },
];

function buildSolution(): C[] {
  const base: C[] = ["r", "y", "b"];
  const off = sample([0, 1, 2]);
  const g: C[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      g.push(base[(c + off + r) % 3]!);
    }
  }
  return g;
}

export class ColorSudokuGame extends BaseGame {
  constructor() {
    super("color-sudoku");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private solution: C[] = [];
  private grid: (C | 0)[] = [];
  private fixed: boolean[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 与定时器由基类清理 */
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.solution = buildSolution();
    const blanks =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const idxs = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, blanks);
    this.grid = this.solution.map((v) => v);
    this.fixed = this.solution.map(() => true);
    for (const i of idxs) {
      this.grid[i] = 0;
      this.fixed[i] = false;
    }
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "clsu-wrap";

    const task = document.createElement("div");
    task.className = "clsu-task";
    task.innerHTML = `每行每列<b>颜色不重复</b> <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const legend = document.createElement("div");
    legend.className = "clsu-legend";
    for (const c of COLORS) {
      const s = document.createElement("span");
      s.className = "clsu-chip";
      s.style.setProperty("--clsu-c", c.hex);
      s.textContent = c.name;
      legend.appendChild(s);
    }
    wrap.appendChild(legend);

    const board = document.createElement("div");
    board.className = "clsu-board";
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "clsu-cell";
      const v = this.grid[i]!;
      if (v !== 0) {
        const meta = COLORS.find((x) => x.id === v)!;
        cell.style.setProperty("--clsu-c", meta.hex);
      } else {
        cell.classList.add("clsu-cell--empty");
      }
      if (this.fixed[i]) cell.classList.add("clsu-cell--fixed");
      if (!this.fixed[i]) {
        cell.addEventListener("click", () => this.cycle(i, cell));
      }
      board.appendChild(cell);
    }
    wrap.appendChild(board);

    const tip = document.createElement("div");
    tip.className = "clsu-tip";
    tip.textContent = "点空格切换颜色：🔴 → 🟡 → 🔵 → 空";
    wrap.appendChild(tip);
    this.root.appendChild(wrap);
  }

  private cycle(i: number, cell: HTMLButtonElement): void {
    const cur = this.grid[i]!;
    const next: C | 0 =
      cur === 0 ? "r" : cur === "r" ? "y" : cur === "y" ? "b" : 0;
    this.grid[i] = next;
    if (next === 0) {
      cell.classList.add("clsu-cell--empty");
      cell.style.removeProperty("--clsu-c");
    } else {
      cell.classList.remove("clsu-cell--empty");
      const meta = COLORS.find((x) => x.id === next)!;
      cell.style.setProperty("--clsu-c", meta.hex);
    }
    cell.classList.remove("clsu-cell--flash");
    void cell.offsetWidth; // 重启动画
    cell.classList.add("clsu-cell--flash");
    sfxPop();
    this.checkDone();
  }

  private checkDone(): void {
    if (this.grid.some((v) => v === 0)) return;
    const ok = this.isValid();
    if (ok) {
      this.root
        .querySelectorAll(".clsu-cell")
        .forEach((el) => el.classList.add("clsu-cell--win"));
      const board = this.root.querySelector(".clsu-board");
      const rect = board
        ? board.getBoundingClientRect()
        : new DOMRect(window.innerWidth / 2, window.innerHeight / 2);
      sfxCorrect();
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
      sfxWrong();
      this.onWrong();
      this.root
        .querySelectorAll(".clsu-cell")
        .forEach((el) => el.classList.add("clsu-cell--err"));
      this.trackTimeout(() => {
        this.root
          .querySelectorAll(".clsu-cell--err")
          .forEach((el) => el.classList.remove("clsu-cell--err"));
      }, 500);
    }
  }

  private isValid(): boolean {
    for (let r = 0; r < 3; r++) {
      const row = new Set([
        this.grid[r * 3],
        this.grid[r * 3 + 1],
        this.grid[r * 3 + 2],
      ]);
      if (row.size !== 3 || row.has(0)) return false;
    }
    for (let c = 0; c < 3; c++) {
      const col = new Set([this.grid[c], this.grid[c + 3], this.grid[c + 6]]);
      if (col.size !== 3 || col.has(0)) return false;
    }
    return true;
  }

  private injectStyle(): void {
    if (document.getElementById("clsu-style")) return;
    const st = document.createElement("style");
    st.id = "clsu-style";
    st.textContent = CLSU_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function CLSU_CSS(theme: string): string {
  return `
.clsu-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(420px,100%);}
.clsu-task{font-size:1.1rem;font-weight:800;text-align:center;color:var(--ink);}
.clsu-task b{color:${theme};}
.clsu-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.clsu-legend{display:flex;gap:8px;}
.clsu-chip{padding:4px 12px;border-radius:999px;background:var(--clsu-c);color:#fff;font-weight:800;font-size:.85rem;box-shadow:var(--shadow);}
.clsu-board{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px;background:linear-gradient(160deg,#fff,#fff0f5);border-radius:20px;box-shadow:var(--shadow);}
.clsu-cell{width:84px;height:84px;border:none;border-radius:14px;background:var(--clsu-c,#fff);box-shadow:inset 0 -3px 5px rgba(0,0,0,.12),0 2px 4px rgba(0,0,0,.08);cursor:pointer;transition:transform .12s ease;}
.clsu-cell:active{transform:scale(.92);}
.clsu-cell--empty{background:repeating-linear-gradient(45deg,#f4f4f4,#f4f4f4 8px,#e6e6e6 8px,#e6e6e6 16px);}
.clsu-cell--fixed{cursor:default;box-shadow:inset 0 2px 4px rgba(0,0,0,.18);}
.clsu-cell--flash{animation:clsu-flash .3s ease;}
.clsu-cell--err{outline:3px solid #ff6348;animation:clsu-no .4s ease;}
.clsu-cell--win{animation:clsu-yes .5s ease;}
@keyframes clsu-flash{0%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes clsu-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes clsu-yes{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
.clsu-tip{font-size:.9rem;font-weight:700;color:var(--ink-soft);}
@media (max-width:380px){.clsu-cell{width:68px;height:68px;}}
`;
}

export function create(): ColorSudokuGame {
  return new ColorSudokuGame();
}
