/* 食物链扩展 Food Chain 2 —— 给一条更长的食物链（如 草→虫→鸟→蛇→鹰），按"谁吃谁"的顺序点出来。
   独特点：比 ecosystem 更多链条、更长，强化生态食物链认知。
   巧思：多条预设食物链，难度=链长度；通关=答对目标轮数。前缀 fc2-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Step {
  emoji: string;
  name: string;
}

interface Chain {
  theme: string;
  steps: Step[];
}

const CHAINS: Chain[] = [
  {
    theme: "草地",
    steps: [
      { emoji: "🌿", name: "草" },
      { emoji: "🐛", name: "虫子" },
      { emoji: "🐦", name: "小鸟" },
      { emoji: "🐍", name: "蛇" },
      { emoji: "🦅", name: "老鹰" },
    ],
  },
  {
    theme: "海洋",
    steps: [
      { emoji: "🦠", name: "浮游" },
      { emoji: "🦐", name: "小虾" },
      { emoji: "🐟", name: "小鱼" },
      { emoji: "🐬", name: "海豚" },
      { emoji: "🦈", name: "鲨鱼" },
    ],
  },
  {
    theme: "森林",
    steps: [
      { emoji: "🌲", name: "树叶" },
      { emoji: "🐛", name: "毛虫" },
      { emoji: "🐦", name: "山雀" },
      { emoji: "🦊", name: "狐狸" },
      { emoji: "🐺", name: "狼" },
    ],
  },
  {
    theme: "池塘",
    steps: [
      { emoji: "🌱", name: "水草" },
      { emoji: "🐌", name: "蜗牛" },
      { emoji: "🐸", name: "青蛙" },
      { emoji: "🦢", name: "白鹭" },
    ],
  },
];

export class FoodChain2Game extends BaseGame {
  constructor() {
    super("food-chain-2");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private chain: Chain | null = null;
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

  private maxLen(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.next = 0;

    const base = CHAINS[this.roundsDone % CHAINS.length] ?? CHAINS[0]!;
    const len = Math.min(this.maxLen(), base.steps.length);
    this.chain = { theme: base.theme, steps: base.steps.slice(0, len) };
    this.display = shuffle(this.chain.steps.map((_, i) => i));

    const wrap = document.createElement("div");
    wrap.className = "fc2-wrap";

    const task = document.createElement("div");
    task.className = "fc2-task";
    task.innerHTML = `按 <b>谁吃谁</b> 的顺序点出来：从吃的（草）到被吃的（鹰）<br><small>${this.chain.theme}（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</small>`;
    wrap.appendChild(task);

    const result = document.createElement("div");
    result.className = "fc2-result";
    result.id = "fc2-result";
    for (let i = 0; i < this.chain.steps.length; i++) {
      if (i > 0) {
        const arrow = document.createElement("div");
        arrow.className = "fc2-arrow";
        arrow.textContent = " ➜ ";
        result.appendChild(arrow);
      }
      const slot = document.createElement("div");
      slot.className = "fc2-slot";
      slot.id = `fc2-slot-${i}`;
      result.appendChild(slot);
    }
    wrap.appendChild(result);

    const pool = document.createElement("div");
    pool.className = "fc2-pool";
    this.display.forEach((stepIdx) => {
      const s = this.chain!.steps[stepIdx]!;
      const b = document.createElement("div");
      b.className = "fc2-card";
      b.dataset.idx = String(stepIdx);
      b.innerHTML = `<span class="fc2-card__emoji">${s.emoji}</span><span class="fc2-card__name">${s.name}</span>`;
      b.addEventListener("click", () => this.onCard(stepIdx, b));
      pool.appendChild(b);
    });
    wrap.appendChild(pool);

    this.root.appendChild(wrap);
  }

  private onCard(stepIdx: number, el: HTMLDivElement): void {
    if (el.classList.contains("fc2-card--used") || !this.chain) return;
    if (stepIdx !== this.next) {
      el.classList.add("fc2-card--shake");
      this.trackTimeout(() => el.classList.remove("fc2-card--shake"), 360);
      this.onWrong();
      return;
    }
    sfxPop();
    el.classList.add("fc2-card--used");
    const s = this.chain.steps[stepIdx]!;
    const slot = this.root.querySelector<HTMLElement>(`#fc2-slot-${stepIdx}`);
    if (slot) {
      slot.classList.add("fc2-slot--filled");
      slot.innerHTML = `<span class="fc2-slot__emoji">${s.emoji}</span><span class="fc2-slot__name">${s.name}</span>`;
    }
    const r = el.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.next += 1;
    this.resetWrongStreak();

    if (this.next >= this.chain.steps.length) {
      this.root.querySelector("#fc2-result")?.classList.add("fc2-result--done");
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
    if (document.getElementById("fc2-style")) return;
    const st = document.createElement("style");
    st.id = "fc2-style";
    st.textContent = FC2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function FC2_CSS(theme: string): string {
  return `
.fc2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(680px,100%);}
.fc2-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.7;color:var(--ink);}
.fc2-task b{color:${theme};}
.fc2-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.fc2-result{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;min-height:88px;padding:14px 16px;background:rgba(255,255,255,.7);border-radius:20px;box-shadow:var(--shadow);}
.fc2-slot{width:72px;height:78px;border-radius:16px;border:2.5px dashed rgba(58,46,74,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:rgba(255,255,255,.4);}
.fc2-slot--filled{border:2.5px solid ${theme};background:#fff;animation:fc2-drop .35s ease;}
@keyframes fc2-drop{0%{transform:scale(.6);opacity:.3}100%{transform:scale(1);opacity:1}}
.fc2-slot__emoji{font-size:1.8rem;}
.fc2-slot__name{font-size:.72rem;font-weight:800;color:var(--ink);}
.fc2-arrow{font-size:1.3rem;color:${theme};font-weight:900;opacity:.4;transition:opacity .3s ease;}
.fc2-result--done .fc2-arrow{opacity:1;animation:fc2-flow 1.2s ease-in-out infinite;}
@keyframes fc2-flow{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}
.fc2-result--done .fc2-slot--filled{box-shadow:0 0 14px ${theme}88;}
.fc2-pool{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.fc2-card{width:84px;height:96px;border-radius:18px;background:#fff;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease;position:relative;overflow:hidden;}
.fc2-card::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,159,67,.14),transparent 50%);}
.fc2-card:hover{transform:translateY(-5px) scale(1.04);box-shadow:0 12px 22px rgba(58,46,74,.2);}
.fc2-card:active{transform:scale(.95);}
.fc2-card__emoji{font-size:2.1rem;}
.fc2-card__name{font-size:.8rem;font-weight:800;color:var(--ink);position:relative;}
.fc2-card--used{opacity:.32;transform:scale(.85);pointer-events:none;filter:grayscale(.4);}
.fc2-card--shake{animation:fc2-shake .36s ease;}
@keyframes fc2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-4px)}}
`;
}

export function create(): FoodChain2Game {
  return new FoodChain2Game();
}
