/* 宾果 Bingo Card —— 3x3 数字网格，「主持」喊一个数字，孩子点网格上对应
   数字。横/竖/斜三连得宾果。视觉：彩色数字网格 + 高亮已选中 + 喊号展示。
   难度=数字范围（easy 1-9 / medium 1-12 / hard 1-20）。通关=连出目标条数。
   保证：每轮网格必能凑出至少 1 条宾果（喊号顺序就是网格里的数字直到凑成线）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { nextCallIndex, completedLines } from "./lines.ts";

export class BingoCardGame extends BaseGame {
  constructor() {
    super("bingo-card");
  }

  private maxNum = 9;
  private targetLines = 1;
  private madeLines = 0;
  private cells: number[] = []; // 9 个格子的数字
  private marked = new Set<number>(); // 已点亮的格子下标
  private currentCall = 0;
  private locked = false;
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.maxNum =
      this.difficulty === "easy" ? 9 : this.difficulty === "medium" ? 12 : 20;
    this.targetLines =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 6;
    this.madeLines = 0;
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startRound();
  }
  protected unmount(): void {
    /* 无定时器/动画需手动清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.marked.clear();
    this.locked = false;

    // 从 1..maxNum 取 9 个不重复数字填格（保证 maxNum >= 9，否则补足）
    const pool = shuffle(
      Array.from({ length: Math.max(9, this.maxNum) }, (_, i) => i + 1),
    ).slice(0, 9);
    this.cells = pool;

    const wrap = document.createElement("div");
    wrap.className = "bng-wrap";

    const task = document.createElement("div");
    task.className = "bng-task";
    task.innerHTML = `听数字，点格子上对应的数字，连成一条线就宾果！<br><small>已连出 <b id="bng-lines">${this.madeLines}</b> / ${this.targetLines} 条线</small>`;
    wrap.appendChild(task);

    // 喊号窗口
    const call = document.createElement("div");
    call.className = "bng-call";
    call.id = "bng-call";
    call.innerHTML = `<span class="bng-call__label">喊号</span><span class="bng-call__num" id="bng-call-num">—</span>`;
    wrap.appendChild(call);

    const grid = document.createElement("div");
    grid.className = "bng-grid";
    for (let i = 0; i < 9; i++) {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "bng-cell";
      c.dataset.idx = String(i);
      c.textContent = String(this.cells[i]);
      c.addEventListener("click", () => this.onCell(c, i));
      grid.appendChild(c);
    }
    wrap.appendChild(grid);

    this.root.appendChild(wrap);

    this.nextCall();
  }

  /** 喊下一个未被点的网格数字（保证一定可点中，导向宾果）。 */
  private nextCall(): void {
    const idx = nextCallIndex(this.marked);
    this.currentCall = idx >= 0 ? this.cells[idx]! : 0;
    const numEl = this.root.querySelector<HTMLElement>("#bng-call-num");
    if (numEl) {
      numEl.textContent = String(this.currentCall);
      numEl.classList.remove("bng-call__num--pop");
      void numEl.offsetWidth;
      numEl.classList.add("bng-call__num--pop");
    }
  }

  private onCell(cell: HTMLButtonElement, idx: number): void {
    if (this.locked) return;
    if (this.marked.has(idx)) return;
    if (this.cells[idx] !== this.currentCall) {
      // 点错
      const paused = this.onWrong();
      cell.classList.add("bng-cell--shake");
      this.trackTimeout(() => cell.classList.remove("bng-cell--shake"), 350);
      if (paused) this.showRest();
      return;
    }
    this.marked.add(idx);
    cell.classList.add("bng-cell--marked");
    cell.disabled = true;
    sfxPop();
    const r = cell.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();

    // 检查新成线
    const newLines = completedLines(this.marked);
    const linesEl = this.root.querySelector<HTMLElement>("#bng-lines");
    if (newLines.length > this.madeLines) {
      this.madeLines = newLines.length;
      if (linesEl) linesEl.textContent = String(this.madeLines);
      // 高亮成线的格子
      newLines.forEach((ln) => {
        ln.forEach((i) => {
          const node = this.root.querySelector<HTMLElement>(
            `.bng-cell[data-idx="${i}"]`,
          );
          node?.classList.add("bng-cell--bingo");
        });
      });
    }

    // 全部点亮或已达目标 → 结算
    if (this.madeLines >= this.targetLines || this.marked.size >= 9) {
      this.locked = true;
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 600);
      return;
    }
    this.nextCall();
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "歇一歇～",
      emoji: "🔢",
      variant: "rest",
      body: "看上面亮起的<b>喊号</b>，在格子里找到一样的数字点一下～",
      primary: { text: "继续", icon: "🔢", onClick: () => ov.destroy() },
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
    if (document.getElementById("bng-style")) return;
    const st = document.createElement("style");
    st.id = "bng-style";
    st.textContent = BNG_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function BNG_CSS(theme: string): string {
  return `
.bng-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:100%;}
.bng-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.bng-task small{display:block;margin-top:3px;font-weight:700;color:#888;font-size:.82rem;}
.bng-task b{color:${theme};}
.bng-call{display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#fff,#e8f8ff);padding:10px 22px;border-radius:18px;box-shadow:var(--shadow);}
.bng-call__label{font-size:.9rem;font-weight:800;color:#888;}
.bng-call__num{font-size:2.6rem;font-weight:900;color:${theme};min-width:64px;text-align:center;line-height:1;}
.bng-call__num--pop{animation:bng-pop .4s ease;}
.bng-grid{display:grid;grid-template-columns:repeat(3,84px);grid-auto-rows:84px;gap:10px;padding:14px;background:${theme};border-radius:20px;box-shadow:var(--shadow-lg);}
.bng-cell{font-size:1.9rem;font-weight:900;color:#fff;background:linear-gradient(160deg,#ffffff,#f0f0f5);color:#333;border:none;border-radius:14px;box-shadow:inset 0 -4px 0 rgba(0,0,0,.08),var(--shadow);transition:transform .12s,background .25s;cursor:pointer;}
.bng-cell:active{transform:scale(.94);}
.bng-cell--marked{background:linear-gradient(160deg,#ffd93d,#ffb800);color:#3a2e4a;}
.bng-cell--bingo{background:linear-gradient(160deg,#6bcf7f,#3da858);color:#fff;outline:3px solid #fff;outline-offset:-6px;animation:bng-pop .5s ease;}
.bng-cell--shake{animation:bng-shake .35s ease;}
@keyframes bng-pop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes bng-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.bng-grid{grid-template-columns:repeat(3,68px);grid-auto-rows:68px;gap:8px;}.bng-cell{font-size:1.5rem;}.bng-call__num{font-size:2.1rem;}}
`;
}

export function create(): BingoCardGame {
  return new BingoCardGame();
}
