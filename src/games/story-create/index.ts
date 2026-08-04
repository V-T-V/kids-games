/* 故事编创 Story-Create —— 排好图卡顺序后，自由讲出小故事（语言·叙事能力）。
   独特点：排序 + 口语叙事（区别于 story-order 的"纯排序判定"，
           这里排序后强调"讲出来"的叙事环节，孩子按"讲完啦"按钮确认，
           训练叙事逻辑 + 时间顺序理解 + 口语表达，海马体+语言中枢）。
   巧思：排序正确后展示完整故事线和"讲完啦"按钮，鼓励孩子看着图讲。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Card {
  emoji: string;
  text: string;
}
interface Story {
  title: string;
  cards: Card[];
}

const STORIES: Story[] = [
  {
    title: "小种子长大",
    cards: [
      { emoji: "🌱", text: "种子" },
      { emoji: "🌿", text: "发芽" },
      { emoji: "🌸", text: "开花" },
      { emoji: "🍎", text: "结果" },
    ],
  },
  {
    title: "毛毛虫变蝴蝶",
    cards: [
      { emoji: "🥚", text: "虫卵" },
      { emoji: "🐛", text: "毛毛虫" },
      { emoji: "🕸️", text: "结茧" },
      { emoji: "🦋", text: "蝴蝶" },
    ],
  },
  {
    title: "小鸡出壳",
    cards: [
      { emoji: "🥚", text: "鸡蛋" },
      { emoji: "🐤", text: "破壳" },
      { emoji: "🐔", text: "长大" },
    ],
  },
  {
    title: "下雨啦",
    cards: [
      { emoji: "☀️", text: "晴天" },
      { emoji: "☁️", text: "乌云" },
      { emoji: "🌧️", text: "下雨" },
      { emoji: "🌈", text: "彩虹" },
    ],
  },
  {
    title: "白天和黑夜",
    cards: [
      { emoji: "🌅", text: "天亮" },
      { emoji: "🌞", text: "白天" },
      { emoji: "🌆", text: "天黑" },
      { emoji: "🌙", text: "夜晚" },
    ],
  },
  {
    title: "青蛙的生长",
    cards: [
      { emoji: "🥚", text: "蛙卵" },
      { emoji: "🐣", text: "蝌蚪" },
      { emoji: "🐸", text: "青蛙" },
    ],
  },
  {
    title: "做蛋糕",
    cards: [
      { emoji: "🥚", text: "打蛋" },
      { emoji: "🥣", text: "搅拌" },
      { emoji: "🍳", text: "烤制" },
      { emoji: "🎂", text: "蛋糕" },
    ],
  },
  {
    title: "种一棵树",
    cards: [
      { emoji: "🌰", text: "挖坑" },
      { emoji: "🌱", text: "种下" },
      { emoji: "💧", text: "浇水" },
      { emoji: "🌳", text: "长大" },
    ],
  },
];

export class StoryCreateGame extends BaseGame {
  constructor() {
    super("story-create");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private picked = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 卡片数：easy 3，medium 4，hard 4（hard 故事更长更复杂）。 */
  private cardCount(): number {
    return this.difficulty === "easy" ? 3 : 4;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.picked = 0;

    // 按难度挑卡片数足够的故事
    const pool = STORIES.filter((s) => s.cards.length >= this.cardCount());
    const full = sample(pool);
    const n = this.cardCount();
    const correctOrder = full.cards.slice(0, n);
    const shown = shuffle(correctOrder);

    const wrap = document.createElement("div");
    wrap.className = "stcr-wrap";

    const task = document.createElement("div");
    task.className = "stcr-task";
    task.innerHTML = `把图卡排成<b>一个故事</b>：${full.title}<br><span class="stcr-hint">从最早发生的开始点（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    // 故事线槽位
    const slots = document.createElement("div");
    slots.className = "stcr-slots";
    slots.id = "stcr-slots";
    for (let i = 0; i < n; i++) {
      const slot = document.createElement("div");
      slot.className = "stcr-slot";
      slot.dataset.idx = String(i);
      slot.innerHTML = `<span class="stcr-slot__num">${i + 1}</span>`;
      slots.appendChild(slot);
    }
    wrap.appendChild(slots);

    // 卡片库
    const cardPool = document.createElement("div");
    cardPool.className = "stcr-pool";
    shown.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "stcr-card";
      b.dataset.text = c.text;
      b.innerHTML = `<div class="stcr-card__emoji">${c.emoji}</div><div class="stcr-card__text">${c.text}</div>`;
      b.addEventListener("click", () => this.choose(c, correctOrder, b));
      cardPool.appendChild(b);
    });
    wrap.appendChild(cardPool);

    // "讲完啦"按钮区：排序完成后才显示
    const tell = document.createElement("button");
    tell.type = "button";
    tell.className = "stcr-tell";
    tell.id = "stcr-tell";
    tell.textContent = "🎤 讲完啦";
    tell.style.display = "none";
    tell.addEventListener("click", () => this.told());
    wrap.appendChild(tell);

    this.root.appendChild(wrap);
  }

  private choose(c: Card, correctOrder: Card[], btn: HTMLButtonElement): void {
    if (btn.classList.contains("stcr-card--used")) return;
    const expect = correctOrder[this.picked];
    if (expect && expect.text === c.text && expect.emoji === c.emoji) {
      btn.classList.add("stcr-card--used");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      const slot = this.root.querySelector<HTMLElement>(
        `.stcr-slot[data-idx="${this.picked}"]`,
      );
      if (slot) {
        slot.classList.add("stcr-slot--filled");
        slot.insertAdjacentHTML(
          "beforeend",
          `<div class="stcr-slot__emoji">${c.emoji}</div><div class="stcr-slot__cap">${c.text}</div>`,
        );
      }
      this.picked += 1;
      if (this.picked >= correctOrder.length) {
        // 排序完成，展示完整故事线并显示"讲完啦"按钮
        const tell = this.root.querySelector<HTMLElement>("#stcr-tell");
        if (tell) {
          tell.style.display = "";
          tell.textContent = `🎤 讲完啦（先看图把故事讲出来吧）`;
        }
        const task = this.root.querySelector<HTMLElement>(".stcr-task .stcr-hint");
        if (task) task.textContent = "排对啦！看着图，讲讲这个小故事～";
      }
    } else {
      btn.classList.add("stcr-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("stcr-card--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  /** 孩子讲完故事，点确认。 */
  private told(): void {
    sfxPop();
    this.roundsDone += 1;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal)
        this.finishClear(starsByAccuracy(this.wrongCount));
      else this.startRound();
    }, 600);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想哪件事是<b>最先</b>发生的～",
      primary: { text: "继续", icon: "🎈", onClick: () => ov.destroy() },
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
    if (document.getElementById("stcr-style")) return;
    const st = document.createElement("style");
    st.id = "stcr-style";
    st.textContent = STCR_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function STCR_CSS(theme: string): string {
  return `
.stcr-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(500px,100%);}
.stcr-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.stcr-hint{font-size:.82rem;color:var(--ink-soft);font-weight:600;display:block;margin-top:4px;}
.stcr-slots{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding:10px 14px;background:rgba(255,255,255,.6);border-radius:18px;box-shadow:var(--shadow);}
.stcr-slot{width:74px;height:88px;border:3px dashed #c7c7d1;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;position:relative;background:#fff;}
.stcr-slot__num{position:absolute;top:-10px;left:-8px;background:#999;color:#fff;width:24px;height:24px;border-radius:50%;font-size:.85rem;font-weight:800;display:flex;align-items:center;justify-content:center;}
.stcr-slot--filled{border:3px solid #6bcf7f;background:#d4f4dd;animation:stcr-fill .35s ease;}
.stcr-slot__emoji{font-size:2rem;line-height:1;}
.stcr-slot__cap{font-size:.7rem;font-weight:700;color:var(--ink);text-align:center;}
.stcr-pool{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding-top:6px;}
.stcr-card{width:88px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:5px;transition:transform .15s;}
.stcr-card:active{transform:scale(.93);}
.stcr-card__emoji{font-size:2.6rem;line-height:1;}
.stcr-card__text{font-size:.8rem;font-weight:700;color:var(--ink);}
.stcr-card--used{opacity:.35;pointer-events:none;background:#eee;}
.stcr-card--wrong{animation:stcr-shake .4s ease;background:#ff6348;color:#fff;}
.stcr-tell{min-height:52px;padding:0 28px;border-radius:999px;background:linear-gradient(135deg,${theme},#7c5cff);color:#fff;font-weight:900;font-size:1.1rem;box-shadow:var(--shadow);animation:stcr-pulse 1.5s ease-in-out infinite;}
.stcr-tell:active{transform:scale(.95);}
@keyframes stcr-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
@keyframes stcr-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes stcr-fill{0%{transform:scale(.5)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
`;
}

export function create(): StoryCreateGame {
  return new StoryCreateGame();
}
