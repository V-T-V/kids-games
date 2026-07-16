/* 迷你数独 Mini Sudoku —— 在网格中填入图案，使每行每列不重复。
   独特点：行/列不重复约束（区别于配对/记忆/排序类）。
   巧思：点空格循环切换图案；填错高亮冲突；难度=3x3/4x4。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

export class MiniSudokuGame extends BaseGame {
  constructor() {
    super("mini-sudoku");
  }
  private n = 3;
  private syms: string[] = [];
  private solution: string[] = [];
  private board: (string | null)[] = [];
  private cells: HTMLButtonElement[] = [];

  protected mount(): void {
    this.n =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 3 : 4;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    const EMOJI = ["🍎", "🍌", "🍇", "🍓"];
    this.syms = EMOJI.slice(0, this.n);
    // 生成一个合法解：每行是基础排列的循环移位
    const base = this.syms;
    this.solution = [];
    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < this.n; x++) {
        this.solution.push(base[(x + y) % this.n]!);
      }
    }
    // 挖空：easy 留更多提示
    const blanks =
      this.difficulty === "easy"
        ? Math.floor(this.n * this.n * 0.4)
        : Math.floor(this.n * this.n * 0.6);
    const idxList = shuffle(this.solution.map((_, i) => i));
    const blankSet = new Set(idxList.slice(0, blanks));
    this.board = this.solution.map((s, i) => (blankSet.has(i) ? null : s));

    const wrap = document.createElement("div");
    wrap.className = "ms-wrap";
    const task = document.createElement("div");
    task.className = "ms-task";
    task.textContent = "每行每列不能有重复的水果～";
    wrap.appendChild(task);

    const grid = document.createElement("div");
    grid.className = "ms-grid";
    grid.style.setProperty("--n", String(this.n));
    this.cells = [];
    this.board.forEach((v, i) => {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "ms-cell";
      c.dataset.idx = String(i);
      if (v) {
        c.textContent = v;
        c.classList.add("ms-cell--given");
      } else {
        c.textContent = "？";
        c.addEventListener("click", () => this.cycle(i, c));
      }
      grid.appendChild(c);
      this.cells.push(c);
    });
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private cycle(i: number, c: HTMLButtonElement): void {
    const cur = this.board[i] ?? null;
    let next: string;
    if (cur === null) next = this.syms[0]!;
    else {
      const idx = this.syms.indexOf(cur);
      next = idx === this.syms.length - 1 ? "__" : this.syms[idx + 1]!;
    }
    if (next === "__") {
      this.board[i] = null;
      c.textContent = "？";
    } else {
      this.board[i] = next;
      c.textContent = next;
    }
    sfxPop();
    this.validate();
  }

  private validate(): void {
    // 清除冲突标记
    this.cells.forEach((c) => c.classList.remove("ms-cell--conflict"));
    let conflict = false;
    // 检查行/列
    for (let y = 0; y < this.n; y++) {
      const seen: Record<string, number[]> = {};
      for (let x = 0; x < this.n; x++) {
        const i = y * this.n + x;
        const v = this.board[i];
        if (!v) continue;
        (seen[v] ??= []).push(i);
      }
      Object.values(seen).forEach((arr) => {
        if (arr.length > 1) {
          conflict = true;
          arr.forEach((k) => this.cells[k]!.classList.add("ms-cell--conflict"));
        }
      });
    }
    for (let x = 0; x < this.n; x++) {
      const seen: Record<string, number[]> = {};
      for (let y = 0; y < this.n; y++) {
        const i = y * this.n + x;
        const v = this.board[i];
        if (!v) continue;
        (seen[v] ??= []).push(i);
      }
      Object.values(seen).forEach((arr) => {
        if (arr.length > 1) {
          conflict = true;
          arr.forEach((k) => this.cells[k]!.classList.add("ms-cell--conflict"));
        }
      });
    }
    // 全填满且无冲突 = 完成
    const filled = this.board.every((v) => v !== null);
    if (filled && !conflict) {
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => this.finishClear(3), 700);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("ms2-style")) return;
    const st = document.createElement("style");
    st.id = "ms2-style";
    st.textContent = MS2_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function MS2_CSS(theme: string): string {
  return `
.ms-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:100%;}
.ms-task{font-size:1.1rem;font-weight:800;}
.ms-grid{display:grid;grid-template-columns:repeat(var(--n,3),1fr);gap:4px;padding:8px;background:${theme};border-radius:14px;box-shadow:var(--shadow);}
.ms-cell{width:78px;height:78px;font-size:2.2rem;border-radius:10px;border:none;background:#fff;box-shadow:var(--shadow);}
.ms-cell:active{transform:scale(.94);}
.ms-cell--given{color:var(--ink-soft);cursor:default;}
.ms-cell--conflict{background:#ffcdd2;animation:ms2-shake .3s ease;}
@keyframes ms2-shake{0%,100%{transform:translateX(0)}50%{transform:translateX(-4px)}}
`;
}

export function create(): MiniSudokuGame {
  return new MiniSudokuGame();
}
