/* 小花园 Garden Bloom —— 几颗种子，每点一次浇水进入下一阶段：种子→发芽→花苞→开花。
   独特点：渐进式生长（因果 + 收集），全部开花即通关，每朵花颜色随机缤纷。
   视觉：CSS 种子到花的 emoji 渐变 + 浇水动画 + 绽放特效。难度=种子数。通关=全开花。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sample, getCssVar } from "../../lobby/util.ts";

/** 四个生长阶段对应的 emoji 与文案。 */
const STAGES = [
  { emoji: "🌰", label: "种子" },
  { emoji: "🌱", label: "发芽" },
  { emoji: "🥀", label: "花苞" },
  { emoji: "🌷", label: "开花" },
] as const;

/** 开花后随机换一朵更艳的花。 */
const BLOOMS = ["🌷", "🌹", "🌻", "🌼", "🌸"] as const;

export class GardenBloomGame extends BaseGame {
  constructor() {
    super("garden-bloom");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private stages: number[] = []; // 每颗种子当前阶段 0-3
  private cells: HTMLButtonElement[] = [];
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private seedCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 5
        : 7;
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = this.seedCount();
    this.stages = new Array(n).fill(0);
    this.cells = [];

    const wrap = document.createElement("div");
    wrap.className = "gb-wrap";

    const task = document.createElement("div");
    task.className = "gb-task";
    task.innerHTML = `点种子 <b>浇水</b>，让它们全部开花！（第 ${this.roundsDone + 1}/${this.roundTotal} 关）<br><span id="gb-progress" class="gb-progress">已开花 0 / ${n}</span>`;
    wrap.appendChild(task);

    const garden = document.createElement("div");
    garden.className = "gb-garden";
    for (let i = 0; i < n; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "gb-cell";
      cell.innerHTML = `<span class="gb-emoji">🌰</span><span class="gb-label">种子</span>`;
      cell.addEventListener("click", () => this.water(i, cell));
      garden.appendChild(cell);
      this.cells.push(cell);
    }
    wrap.appendChild(garden);
    this.root.appendChild(wrap);
  }

  private water(i: number, cell: HTMLButtonElement): void {
    if (this.locked) return;
    const cur = this.stages[i]!;
    if (cur >= 3) return; // 已开花，不再进阶
    const next = cur + 1;
    this.stages[i] = next;
    sfxPop();
    this.resetWrongStreak();
    cell.classList.add("gb-cell--pour");
    this.trackTimeout(() => cell.classList.remove("gb-cell--pour"), 500);

    const emoji = next === 3 ? sample(BLOOMS) : STAGES[next]!.emoji;
    const label = STAGES[next]!.label;
    const emojiEl = cell.querySelector(".gb-emoji");
    const labelEl = cell.querySelector(".gb-label");
    if (emojiEl) {
      emojiEl.textContent = emoji;
      emojiEl.classList.add("gb-emoji--pop");
      this.trackTimeout(() => emojiEl.classList.remove("gb-emoji--pop"), 450);
    }
    if (labelEl) labelEl.textContent = label;
    if (next === 3) {
      cell.classList.add("gb-cell--bloom");
      const r = cell.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    }

    // 更新进度
    const bloomed = this.stages.filter((s) => s >= 3).length;
    const prog = this.root.querySelector("#gb-progress");
    if (prog) prog.textContent = `已开花 ${bloomed} / ${this.stages.length}`;

    // 全开花
    if (bloomed >= this.stages.length) {
      this.locked = true;
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
    if (document.getElementById("gb-style")) return;
    const st = document.createElement("style");
    st.id = "gb-style";
    st.textContent = GB_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function GB_CSS(theme: string): string {
  return `
.gb-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.gb-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.gb-progress{display:inline-block;margin-top:6px;padding:3px 14px;border-radius:999px;background:#fff;color:${theme};box-shadow:var(--shadow);font-size:.95rem;}
.gb-garden{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;width:100%;max-width:400px;padding:20px;background:linear-gradient(180deg,#dcedc8,#aed581);border-radius:24px;box-shadow:var(--shadow);}
.gb-cell{display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 6px;background:radial-gradient(circle at 50% 80%,#8d6e63,#5d4037);border-radius:16px;box-shadow:inset 0 -4px 6px rgba(0,0,0,.2),var(--shadow);cursor:pointer;transition:transform .12s;position:relative;overflow:hidden;}
.gb-cell:active{transform:scale(.94);}
.gb-emoji{font-size:2.6rem;line-height:1;transition:transform .4s cubic-bezier(.4,1.6,.5,1);filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));}
.gb-emoji--pop{animation:gb-grow .45s ease;}
.gb-label{font-size:.8rem;font-weight:800;color:#fff8e1;background:rgba(0,0,0,.25);padding:1px 8px;border-radius:999px;}
.gb-cell--bloom{box-shadow:0 0 0 3px ${theme},var(--shadow);}
.gb-cell--pour::before{content:"💧💧💧";position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-size:1rem;animation:gb-pour .5s ease forwards;pointer-events:none;}
@keyframes gb-pour{0%{top:-24px;opacity:0}30%{opacity:1}100%{top:60%;opacity:0}}
@keyframes gb-grow{0%{transform:scale(.5) rotate(-10deg)}50%{transform:scale(1.3) rotate(5deg)}100%{transform:scale(1) rotate(0)}}
@media (max-width:380px){.gb-garden{grid-template-columns:repeat(2,1fr);}.gb-emoji{font-size:2.2rem;}}
`;
}

export function create(): GardenBloomGame {
  return new GardenBloomGame();
}
