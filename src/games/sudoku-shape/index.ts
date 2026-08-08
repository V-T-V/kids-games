/* 形状数独 Sudoku Shape —— 在 3×3 网格里填入 3 种形状，使每一行、每一列都不重复。
   独特点：行/列不重复约束（迷你数独 + 形状）。
   巧思：点空格循环切换形状；填满后自动校验，全对通关；高亮当前空格；
   难度=挖空数 + 轮数。前缀 sds-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";
import {
  SHAPES,
  generateSolution,
  validate as validateBoard,
  findConflicts,
  digBlanks,
  cycleCell,
} from "./engine.ts";

export class SudokuShapeGame extends BaseGame {
  constructor() {
    super("sudoku-shape");
  }

  private roundTotal = 0;
  private roundsDone = 0;
  private solution: string[] = []; // 9 格的正解
  private board: (string | null)[] = [];
  private cells: HTMLButtonElement[] = [];
  private submitted = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空；定时器由基类清理 */
  }

  private startRound(): void {
    this.submitted = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root.innerHTML = "";

    // 生成一个合法解（委托给 engine.ts）：每行是基础排列的循环移位
    this.solution = generateSolution();
    // 挖空：easy 少挖（更简单），hard 多挖
    const blanks =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const { board } = digBlanks(this.solution, blanks, shuffle);
    this.board = board;

    const wrap = document.createElement("div");
    wrap.className = "sds-wrap";
    const task = document.createElement("div");
    task.className = "sds-task";
    task.innerHTML = `把空格填满，让<b>每一行、每一列</b>的形状都<b>不重复</b>～<br><span class="sds-sub">点空格切换形状 · 第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const grid = document.createElement("div");
    grid.className = "sds-grid";
    this.cells = [];
    this.board.forEach((v, i) => {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "sds-cell";
      c.dataset.idx = String(i);
      if (v) {
        c.textContent = v;
        c.classList.add("sds-cell--given");
      } else {
        c.textContent = "？";
        c.addEventListener("click", () => this.cycle(i, c));
      }
      grid.appendChild(c);
      this.cells.push(c);
    });
    wrap.appendChild(grid);

    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "sds-check";
    checkBtn.textContent = "✓ 我填好啦！";
    checkBtn.addEventListener("click", () => this.check(checkBtn));
    wrap.appendChild(checkBtn);

    const legend = document.createElement("div");
    legend.className = "sds-legend";
    legend.textContent = `三种形状：${SHAPES.join("  ")}`;
    wrap.appendChild(legend);

    this.root.appendChild(wrap);
  }

  private cycle(i: number, cell: HTMLButtonElement): void {
    if (this.submitted) return;
    const next = cycleCell(this.board[i]);
    this.board[i] = next;
    cell.textContent = next;
    cell.classList.add("sds-cell--changed");
    this.trackTimeout(() => cell.classList.remove("sds-cell--changed"), 200);
    sfxPop();
  }

  private check(btn: HTMLButtonElement): void {
    if (this.submitted) return;
    // 检查是否填满 + 每行每列不重复
    if (this.board.some((v) => v === null)) {
      btn.classList.add("sds-check--warn");
      btn.textContent = "还有空格没填哦～";
      this.onWrong();
      this.trackTimeout(() => {
        btn.classList.remove("sds-check--warn");
        btn.textContent = "✓ 我填好啦！";
      }, 1100);
      return;
    }
    // 校验规则：每行每列无重复
    const ok = this.validate();
    if (ok) {
      this.submitted = true;
      this.cells.forEach((c) => c.classList.add("sds-cell--correct"));
      this.resetWrongStreak();
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    } else {
      // 高亮冲突的行/列
      this.markConflicts();
      this.onWrong();
      btn.classList.add("sds-check--warn");
      btn.textContent = "有重复啦，再想想～";
      this.trackTimeout(() => {
        btn.classList.remove("sds-check--warn");
        btn.textContent = "✓ 我填好啦！";
        this.cells.forEach((c) => c.classList.remove("sds-cell--conflict"));
      }, 1200);
    }
  }

  /** 校验每行每列是否都不重复（委托给 engine.ts）。 */
  private validate(): boolean {
    return validateBoard(this.board);
  }

  /** 标出有重复的格子（委托给 engine.findConflicts）。 */
  private markConflicts(): void {
    findConflicts(this.board).forEach((i) =>
      this.cells[i]?.classList.add("sds-cell--conflict"),
    );
  }

  private injectStyle(): void {
    if (document.getElementById("sds-style")) return;
    const st = document.createElement("style");
    st.id = "sds-style";
    st.textContent = SDS_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function SDS_CSS(theme: string): string {
  return `
.sds-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(420px,100%);}
.sds-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:400px;}
.sds-task b{color:${theme};}
.sds-sub{display:block;margin-top:4px;font-size:.88rem;font-weight:700;color:var(--ink-soft);}
.sds-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 12%,#fff));border-radius:20px;box-shadow:var(--shadow);}
.sds-cell{width:92px;height:92px;border:none;border-radius:14px;background:#fff;box-shadow:var(--shadow);cursor:pointer;font-size:2.6rem;line-height:1;display:flex;align-items:center;justify-content:center;transition:transform .1s ease,box-shadow .2s ease;}
.sds-cell:active{transform:scale(.94);}
.sds-cell--given{background:#f5f5f5;cursor:default;color:var(--ink-soft);}
.sds-cell--changed{transform:scale(1.1);}
.sds-cell--correct{background:#e8fbe8;box-shadow:0 0 0 3px #6bcf7f;}
.sds-cell--conflict{background:#ffeae6;box-shadow:0 0 0 3px #ff6348;animation:sds-shake .3s ease;}
@keyframes sds-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (max-width:360px){.sds-cell{width:76px;height:76px;font-size:2.1rem;}}
.sds-check{padding:14px 32px;border:none;border-radius:999px;background:linear-gradient(135deg,${theme},#5ad6e8);color:#06343a;font-size:1.1rem;font-weight:900;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s ease,background .2s ease;}
.sds-check:active{transform:scale(.95);}
.sds-check--warn{background:linear-gradient(135deg,#ff6348,#ff9f43);color:#fff;}
.sds-legend{font-size:.9rem;font-weight:700;color:var(--ink-soft);}
`;
}

export function create(): SudokuShapeGame {
  return new SudokuShapeGame();
}
