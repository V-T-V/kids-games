/* 数字十字 Number Cross —— 3x3 数字网格，让每行每列都不重复（1/2/3）。
   简化版：给定部分已填，孩子在空格里点选数字补全。
   独特点：低龄友好的"数独前身"，只要求不重复；保证有解（从完整拉丁方挖空）。
   点格子循环 1→2→3→空。前缀 ncr-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxWrong, sfxCorrect } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

type V = 1 | 2 | 3;
// 9 格用 (V | 0) 表示，0 = 空

/** 从基础拉丁方随机生成完整解。 */
function buildSolution(): V[] {
  const base: V[] = [1, 2, 3];
  const off = sample([0, 1, 2]);
  const g: V[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      g.push(base[(c + off + r) % 3]! as V);
    }
  }
  return g;
}

export class NumberCrossGame extends BaseGame {
  constructor() {
    super("number-cross");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private solution: V[] = [];
  private grid: (V | 0)[] = [];
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
    // 挖空数量随难度
    const blanks =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    // 选择挖空位置：保证挖空后仍有唯一解（这里用简单策略：挖空后仍可解，因为拉丁方约束）
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
    wrap.className = "ncr-wrap";

    const task = document.createElement("div");
    task.className = "ncr-task";
    task.innerHTML = `每行每列<b>不能重复</b>（1·2·3） <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "ncr-board";
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "ncr-cell";
      if (this.fixed[i]) cell.classList.add("ncr-cell--fixed");
      const v = this.grid[i]!;
      cell.textContent = v === 0 ? "" : String(v);
      cell.dataset.i = String(i);
      if (!this.fixed[i]) {
        cell.addEventListener("click", () => this.cycle(i, cell));
      }
      board.appendChild(cell);
    }
    wrap.appendChild(board);

    const tip = document.createElement("div");
    tip.className = "ncr-tip";
    tip.textContent = "点空格切换 1 → 2 → 3 → 空";
    wrap.appendChild(tip);

    this.root.appendChild(wrap);
  }

  private cycle(i: number, cell: HTMLButtonElement): void {
    const cur = this.grid[i]!;
    const next: V | 0 = cur === 0 ? 1 : cur === 1 ? 2 : cur === 2 ? 3 : 0;
    this.grid[i] = next;
    cell.textContent = next === 0 ? "" : String(next);
    cell.classList.remove("ncr-cell--flash");
    sfxPop();
    this.checkDone();
  }

  private checkDone(): void {
    // 全填满才算
    if (this.grid.some((v) => v === 0)) return;
    // 校验每行每列不重复
    const ok = this.isValid();
    if (ok) {
      // 高亮全部
      this.root.querySelectorAll(".ncr-cell").forEach((el) => {
        el.classList.add("ncr-cell--win");
      });
      const board = this.root.querySelector(".ncr-board");
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
      this.root.querySelectorAll(".ncr-cell").forEach((el) => {
        el.classList.add("ncr-cell--err");
      });
      this.trackTimeout(() => {
        this.root
          .querySelectorAll(".ncr-cell--err")
          .forEach((el) => el.classList.remove("ncr-cell--err"));
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
    if (document.getElementById("ncr-style")) return;
    const st = document.createElement("style");
    st.id = "ncr-style";
    st.textContent = NCR_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function NCR_CSS(theme: string): string {
  return `
.ncr-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(420px,100%);}
.ncr-task{font-size:1.1rem;font-weight:800;text-align:center;color:var(--ink);}
.ncr-task b{color:${theme};}
.ncr-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.ncr-board{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px;background:linear-gradient(160deg,#fff,#e0f7fa);border-radius:20px;box-shadow:var(--shadow);}
.ncr-cell{width:84px;height:84px;border:none;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:2.6rem;font-weight:900;color:${theme};background:linear-gradient(160deg,#fff,#e8f8fb);box-shadow:inset 0 -3px 5px rgba(0,0,0,.1),0 2px 4px rgba(0,0,0,.08);cursor:pointer;transition:transform .12s ease,background .2s;}
.ncr-cell:active{transform:scale(.92);}
.ncr-cell--fixed{background:linear-gradient(160deg,#f0f4f8,#dde6ec);color:#8a99a8;cursor:default;box-shadow:inset 0 2px 4px rgba(0,0,0,.1);}
.ncr-cell--flash{animation:ncr-flash .3s ease;}
.ncr-cell--err{animation:ncr-no .4s ease;background:#ffeae6;}
.ncr-cell--win{background:#e8fbe8;color:#4a9d57;animation:ncr-yes .5s ease;}
@keyframes ncr-flash{0%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes ncr-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes ncr-yes{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
.ncr-tip{font-size:.9rem;font-weight:700;color:var(--ink-soft);}
@media (max-width:380px){.ncr-cell{width:68px;height:68px;font-size:2.1rem;}}
`;
}

export function create(): NumberCrossGame {
  return new NumberCrossGame();
}
