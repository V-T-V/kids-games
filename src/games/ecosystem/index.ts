/* 食物链 Ecosystem —— 给若干生物，按「谁吃谁」排出食物链顺序（生产者→顶级消费者）。
   独特点：生物 emoji + 箭头连接，排对一条链后整体亮起动画。
   巧思：内置多条预设食物链，难度=链长度；打乱后让幼儿点回正确顺序。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Chain {
  theme: string;
  steps: { name: string; emoji: string }[];
}

// 预设食物链（从生产者到顶级消费者）
const CHAINS: Chain[] = [
  {
    theme: "草地",
    steps: [
      { name: "草", emoji: "🌿" },
      { name: "蚱蜢", emoji: "🦗" },
      { name: "青蛙", emoji: "🐸" },
      { name: "蛇", emoji: "🐍" },
    ],
  },
  {
    theme: "森林",
    steps: [
      { name: "果实", emoji: "🍎" },
      { name: "松鼠", emoji: "🐿️" },
      { name: "狐狸", emoji: "🦊" },
    ],
  },
  {
    theme: "海洋",
    steps: [
      { name: "浮游", emoji: "🦠" },
      { name: "小鱼", emoji: "🐟" },
      { name: "大鱼", emoji: "🐠" },
      { name: "鲨鱼", emoji: "🦈" },
    ],
  },
  {
    theme: "池塘",
    steps: [
      { name: "水草", emoji: "🌱" },
      { name: "蜗牛", emoji: "🐌" },
      { name: "鸭子", emoji: "🦆" },
    ],
  },
  {
    theme: "草原",
    steps: [
      { name: "草", emoji: "🌾" },
      { name: "斑马", emoji: "🦓" },
      { name: "狮子", emoji: "🦁" },
    ],
  },
];

export class EcosystemGame extends BaseGame {
  constructor() {
    super("ecosystem");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private chain: Chain | null = null;
  private next = 0;
  /** 展示顺序：display[i] = 该位置生物在 chain.steps 里的下标 */
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

  /** 本轮链长上限 */
  private maxLen(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.next = 0;

    // 选一条链，截取到 maxLen
    const base = CHAINS[this.roundsDone % CHAINS.length] ?? CHAINS[0]!;
    const len = Math.min(this.maxLen(), base.steps.length);
    this.chain = {
      theme: base.theme,
      steps: base.steps.slice(0, len),
    };
    this.display = shuffle(this.chain.steps.map((_, i) => i));

    const wrap = document.createElement("div");
    wrap.className = "ec-wrap";

    const task = document.createElement("div");
    task.className = "ec-task";
    task.innerHTML = `按 <b>谁吃谁</b> 的顺序点生物，排出食物链<br><small>主题：${this.chain.theme}（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</small>`;
    wrap.appendChild(task);

    // 已排好的链展示区
    const result = document.createElement("div");
    result.className = "ec-result";
    result.id = "ec-result";
    for (let i = 0; i < this.chain.steps.length; i++) {
      if (i > 0) {
        const arrow = document.createElement("div");
        arrow.className = "ec-arrow";
        arrow.id = `ec-arrow-${i}`;
        arrow.textContent = "➜";
        result.appendChild(arrow);
      }
      const slot = document.createElement("div");
      slot.className = "ec-slot";
      slot.id = `ec-slot-${i}`;
      result.appendChild(slot);
    }
    wrap.appendChild(result);

    // 待选生物池
    const pool = document.createElement("div");
    pool.className = "ec-pool";
    this.display.forEach((stepIdx) => {
      const org = this.chain!.steps[stepIdx]!;
      const b = document.createElement("div");
      b.className = "ec-card";
      b.dataset.idx = String(stepIdx);
      const emoji = document.createElement("span");
      emoji.className = "ec-card__emoji";
      emoji.textContent = org.emoji;
      b.appendChild(emoji);
      const name = document.createElement("span");
      name.className = "ec-card__name";
      name.textContent = org.name;
      b.appendChild(name);
      b.addEventListener("click", () => this.onCard(stepIdx, b));
      pool.appendChild(b);
    });
    wrap.appendChild(pool);

    this.root.appendChild(wrap);
  }

  private onCard(stepIdx: number, el: HTMLDivElement): void {
    if (el.classList.contains("ec-card--used")) return;
    if (stepIdx !== this.next) {
      el.classList.add("ec-card--shake");
      this.trackTimeout(() => el.classList.remove("ec-card--shake"), 360);
      this.onWrong();
      return;
    }
    sfxPop();
    el.classList.add("ec-card--used");
    const org = this.chain!.steps[stepIdx]!;
    const slot = this.root.querySelector<HTMLElement>(`#ec-slot-${stepIdx}`);
    if (slot) {
      slot.classList.add("ec-slot--filled");
      slot.innerHTML = `<span class="ec-slot__emoji">${org.emoji}</span><span class="ec-slot__name">${org.name}</span>`;
    }
    const r = el.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.next += 1;
    this.resetWrongStreak();

    if (this.next >= this.chain!.steps.length) {
      // 整链亮起
      const result = this.root.querySelector("#ec-result");
      result?.classList.add("ec-result--done");
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
    if (document.getElementById("ec-style")) return;
    const st = document.createElement("style");
    st.id = "ec-style";
    st.textContent = EC_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function EC_CSS(theme: string): string {
  return `
.ec-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(640px,100%);}
.ec-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.7;color:var(--ink);}
.ec-task b{color:${theme};}
.ec-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.ec-result{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;min-height:88px;padding:14px 16px;background:rgba(255,255,255,.7);border-radius:20px;box-shadow:var(--shadow);}
.ec-slot{width:72px;height:78px;border-radius:16px;border:2.5px dashed rgba(58,46,74,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:rgba(255,255,255,.4);}
.ec-slot--filled{border:2.5px solid ${theme};background:#fff;animation:ec-drop .35s ease;}
@keyframes ec-drop{0%{transform:scale(.6);opacity:.3}100%{transform:scale(1);opacity:1}}
.ec-slot__emoji{font-size:1.8rem;}
.ec-slot__name{font-size:.72rem;font-weight:800;color:var(--ink);}
.ec-arrow{font-size:1.3rem;color:${theme};font-weight:900;opacity:.4;transition:opacity .3s ease,transform .3s ease;}
.ec-result--done .ec-arrow{opacity:1;animation:ec-flow 1.2s ease-in-out infinite;}
@keyframes ec-flow{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}
.ec-result--done .ec-slot--filled{box-shadow:0 0 14px ${theme}88;}
.ec-pool{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.ec-card{width:84px;height:96px;border-radius:18px;background:#fff;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease;position:relative;overflow:hidden;}
.ec-card::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(107,207,127,.14),transparent 50%);}
.ec-card:hover{transform:translateY(-5px) scale(1.04);box-shadow:0 12px 22px rgba(58,46,74,.2);}
.ec-card:active{transform:scale(.95);}
.ec-card__emoji{font-size:2.1rem;}
.ec-card__name{font-size:.8rem;font-weight:800;color:var(--ink);position:relative;}
.ec-card--used{opacity:.32;transform:scale(.85);pointer-events:none;filter:grayscale(.4);}
.ec-card--shake{animation:ec-shake .36s ease;}
@keyframes ec-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-4px)}}
`;
}

export function create(): EcosystemGame {
  return new EcosystemGame();
}
