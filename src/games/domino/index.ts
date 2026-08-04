/* 多米诺 Domino —— 几张骨牌（每张 1-6 点），按点数从小到大排列。
   独特点：实物骨牌视觉（上下两半，点数用圆点呈现），锻炼数数 + 排序。
   巧思：点骨牌可显示数字辅助（不会数点也能玩）；按从小到大点击即归位。
   难度=骨牌数。通关=排对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Tile {
  dots: number;
  el: HTMLElement;
}

export class DominoGame extends BaseGame {
  constructor() {
    super("domino");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private tiles: Tile[] = [];
  /** 当前该点排序后第几个点数 */
  private expectedIdx = 0;
  /** 本关从小到大排列的目标点数序列 */
  private sortedTargets: number[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.expectedIdx = 0;

    // 生成 count 个不重复点数，排序后作为"从小到大"的目标顺序
    const pool = shuffle([1, 2, 3, 4, 5, 6]).slice(0, this.count());
    this.sortedTargets = [...pool].sort((a, b) => a - b);
    // 展示顺序打乱
    const shown = shuffle(pool);

    const wrap = document.createElement("div");
    wrap.className = "dm-wrap";
    const task = document.createElement("div");
    task.className = "dm-task";
    task.innerHTML = `先点圆点最少的 🁫，一个个排好～<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const tip = document.createElement("div");
    tip.className = "dm-tip";
    tip.id = "dm-tip";
    tip.textContent = "可以先点一下骨牌看数字～";
    wrap.appendChild(tip);

    const stage = document.createElement("div");
    stage.className = "dm-stage";
    shown.forEach((dots) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dm-tile";
      b.dataset.dots = String(dots);
      b.innerHTML = this.tileHTML(dots);
      b.addEventListener("click", () => this.click(dots, b));
      stage.appendChild(b);
    });
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
  }

  /** 渲染一张骨牌的点数（用圆点排列）。 */
  private tileHTML(dots: number): string {
    // 用 CSS 网格布局的点：根据数量决定位置
    const positions = DOT_LAYOUT[dots] ?? [];
    const inner = positions
      .map(
        (p) =>
          `<span class="dm-dot" style="grid-column:${p.c};grid-row:${p.r};"></span>`,
      )
      .join("");
    return `<div class="dm-face"><div class="dm-num"></div><div class="dm-dots dm-dots--${dots}">${inner}</div></div>`;
  }

  private click(dots: number, btn: HTMLButtonElement): void {
    if (btn.classList.contains("dm-tile--done")) return;
    const numEl = btn.querySelector(".dm-num")!;
    if (!numEl.textContent) {
      // 第一次点：显示数字（数数辅助）
      numEl.textContent = String(dots);
      sfxPop();
      const tip = this.root.querySelector("#dm-tip");
      if (tip) tip.textContent = "看清楚数字，从小的点起～";
      return;
    }
    // 排序点击：与目标序列的当前位比较
    if (dots === this.sortedTargets[this.expectedIdx]) {
      btn.classList.add("dm-tile--done");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.expectedIdx += 1;
      if (this.expectedIdx >= this.sortedTargets.length) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 900);
      }
    } else {
      this.onWrong();
    }
  }

  private injectStyle(): void {
    if (document.getElementById("dm-style")) return;
    const st = document.createElement("style");
    st.id = "dm-style";
    st.textContent = DM_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

/** 每种点数在 3x3 网格上的圆点位置（列 c，行 r，均 1-3）。 */
const DOT_LAYOUT: Record<number, { c: number; r: number }[]> = {
  1: [{ c: 2, r: 2 }],
  2: [
    { c: 1, r: 1 },
    { c: 3, r: 3 },
  ],
  3: [
    { c: 1, r: 1 },
    { c: 2, r: 2 },
    { c: 3, r: 3 },
  ],
  4: [
    { c: 1, r: 1 },
    { c: 3, r: 1 },
    { c: 1, r: 3 },
    { c: 3, r: 3 },
  ],
  5: [
    { c: 1, r: 1 },
    { c: 3, r: 1 },
    { c: 2, r: 2 },
    { c: 1, r: 3 },
    { c: 3, r: 3 },
  ],
  6: [
    { c: 1, r: 1 },
    { c: 3, r: 1 },
    { c: 1, r: 2 },
    { c: 3, r: 2 },
    { c: 1, r: 3 },
    { c: 3, r: 3 },
  ],
};

function DM_CSS(_theme: string): string {
  return `
.dm-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.dm-task{font-size:1.2rem;font-weight:800;text-align:center;line-height:1.5;}
.dm-tip{font-size:.95rem;color:var(--ink-soft);font-weight:600;min-height:1.4em;}
.dm-stage{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.dm-tile{width:88px;height:128px;background:linear-gradient(180deg,#fff,#f5f0e8);border:3px solid #d7c7b0;border-radius:14px;box-shadow:var(--shadow);padding:6px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;transition:transform .12s;}
.dm-tile:active{transform:scale(.93);}
.dm-face{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;flex:1;width:100%;}
.dm-num{font-size:1.5rem;font-weight:900;color:var(--c-brown);min-height:1.4em;line-height:1;}
.dm-dots{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:2px;width:54px;height:54px;padding:4px;}
.dm-dot{background:#3a2e4a;border-radius:50%;box-shadow:inset 0 1px 2px rgba(0,0,0,.4);}
.dm-tile--done{background:linear-gradient(180deg,#d4f4dd,#b8ecc6);border-color:#7cc98f;opacity:.6;}
@media (max-width:380px){.dm-tile{width:74px;height:112px;}.dm-dots{width:46px;height:46px;}}
`;
}

export function create(): DominoGame {
  return new DominoGame();
}
