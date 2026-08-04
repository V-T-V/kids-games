/* 植物生长排序 Plant Grow —— 给若干植物生长阶段的图（乱序），按生长顺序点出来。
   独特点：生命周期认知 + 顺序逻辑。
   巧思：从种子开始一步步点，点对就长出来；难度=阶段数；通关=答对目标轮数。前缀 pgw-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Stage {
  emoji: string;
  name: string;
}

interface Plant {
  theme: string;
  stages: Stage[];
}

const PLANTS: Plant[] = [
  {
    theme: "番茄",
    stages: [
      { emoji: "🌱", name: "种子" },
      { emoji: "🌿", name: "发芽" },
      { emoji: "☘️", name: "长叶" },
      { emoji: "🌸", name: "开花" },
      { emoji: "🍅", name: "结果" },
    ],
  },
  {
    theme: "苹果树",
    stages: [
      { emoji: "🌰", name: "种子" },
      { emoji: "🌱", name: "发芽" },
      { emoji: "🌿", name: "小苗" },
      { emoji: "🌳", name: "大树" },
      { emoji: "🍎", name: "结果" },
    ],
  },
  {
    theme: "向日葵",
    stages: [
      { emoji: "🌱", name: "种子" },
      { emoji: "🌿", name: "发芽" },
      { emoji: "🪴", name: "长高" },
      { emoji: "🌻", name: "开花" },
    ],
  },
];

export class PlantGrowGame extends BaseGame {
  constructor() {
    super("plant-grow");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private plant: Plant | null = null;
  private next = 0;
  private display: number[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 本轮阶段数上限 */
  private maxLen(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.next = 0;

    const base = PLANTS[this.roundsDone % PLANTS.length] ?? PLANTS[0]!;
    const len = Math.min(this.maxLen(), base.stages.length);
    this.plant = { theme: base.theme, stages: base.stages.slice(0, len) };
    this.display = shuffle(this.plant.stages.map((_, i) => i));

    const wrap = document.createElement("div");
    wrap.className = "pgw-wrap";

    const task = document.createElement("div");
    task.className = "pgw-task";
    task.innerHTML = `按<b>生长顺序</b>点出来：先种种子，最后结果<br><small>${this.plant.theme}（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</small>`;
    wrap.appendChild(task);

    // 结果展示区（生长带）
    const result = document.createElement("div");
    result.className = "pgw-result";
    result.id = "pgw-result";
    for (let i = 0; i < this.plant.stages.length; i++) {
      if (i > 0) {
        const arrow = document.createElement("div");
        arrow.className = "pgw-arrow";
        arrow.textContent = "➜";
        result.appendChild(arrow);
      }
      const slot = document.createElement("div");
      slot.className = "pgw-slot";
      slot.id = `pgw-slot-${i}`;
      result.appendChild(slot);
    }
    wrap.appendChild(result);

    // 待选池
    const pool = document.createElement("div");
    pool.className = "pgw-pool";
    this.display.forEach((stepIdx) => {
      const s = this.plant!.stages[stepIdx]!;
      const b = document.createElement("div");
      b.className = "pgw-card";
      b.dataset.idx = String(stepIdx);
      b.innerHTML = `<span class="pgw-card__emoji">${s.emoji}</span><span class="pgw-card__name">${s.name}</span>`;
      b.addEventListener("click", () => this.onCard(stepIdx, b));
      pool.appendChild(b);
    });
    wrap.appendChild(pool);

    this.root.appendChild(wrap);
  }

  private onCard(stepIdx: number, el: HTMLDivElement): void {
    if (el.classList.contains("pgw-card--used") || !this.plant) return;
    if (stepIdx !== this.next) {
      el.classList.add("pgw-card--shake");
      this.trackTimeout(() => el.classList.remove("pgw-card--shake"), 360);
      this.onWrong();
      return;
    }
    sfxPop();
    el.classList.add("pgw-card--used");
    const s = this.plant.stages[stepIdx]!;
    const slot = this.root.querySelector<HTMLElement>(`#pgw-slot-${stepIdx}`);
    if (slot) {
      slot.classList.add("pgw-slot--filled");
      slot.innerHTML = `<span class="pgw-slot__emoji">${s.emoji}</span><span class="pgw-slot__name">${s.name}</span>`;
    }
    const r = el.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.next += 1;
    this.resetWrongStreak();

    if (this.next >= this.plant.stages.length) {
      this.root.querySelector("#pgw-result")?.classList.add("pgw-result--done");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1200);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("pgw-style")) return;
    const st = document.createElement("style");
    st.id = "pgw-style";
    st.textContent = PGW_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function PGW_CSS(theme: string): string {
  return `
.pgw-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(640px,100%);}
.pgw-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.7;color:var(--ink);}
.pgw-task b{color:${theme};}
.pgw-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.pgw-result{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;min-height:88px;padding:14px 16px;background:rgba(255,255,255,.7);border-radius:20px;box-shadow:var(--shadow);}
.pgw-slot{width:72px;height:78px;border-radius:16px;border:2.5px dashed rgba(58,46,74,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:rgba(255,255,255,.4);}
.pgw-slot--filled{border:2.5px solid ${theme};background:#fff;animation:pgw-drop .35s ease;}
@keyframes pgw-drop{0%{transform:scale(.6) translateY(-12px);opacity:.3}100%{transform:scale(1) translateY(0);opacity:1}}
.pgw-slot__emoji{font-size:1.9rem;}
.pgw-slot__name{font-size:.72rem;font-weight:800;color:var(--ink);}
.pgw-arrow{font-size:1.3rem;color:${theme};font-weight:900;opacity:.4;transition:opacity .3s ease;}
.pgw-result--done .pgw-arrow{opacity:1;animation:pgw-flow 1.2s ease-in-out infinite;}
@keyframes pgw-flow{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}
.pgw-result--done .pgw-slot--filled{box-shadow:0 0 14px ${theme}88;}
.pgw-pool{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.pgw-card{width:84px;height:96px;border-radius:18px;background:#fff;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease;position:relative;overflow:hidden;}
.pgw-card::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(107,207,127,.14),transparent 50%);}
.pgw-card:hover{transform:translateY(-5px) scale(1.04);box-shadow:0 12px 22px rgba(58,46,74,.2);}
.pgw-card:active{transform:scale(.95);}
.pgw-card__emoji{font-size:2.2rem;}
.pgw-card__name{font-size:.8rem;font-weight:800;color:var(--ink);position:relative;}
.pgw-card--used{opacity:.32;transform:scale(.85);pointer-events:none;filter:grayscale(.4);}
.pgw-card--shake{animation:pgw-shake .36s ease;}
@keyframes pgw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-4px)}}
`;
}

export function create(): PlantGrowGame {
  return new PlantGrowGame();
}
