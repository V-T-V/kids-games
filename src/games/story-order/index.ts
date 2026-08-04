/* 故事排序 Story-Order —— 把 4 张故事图卡按时间先后顺序点出来。
   独特点：时间因果序列（区别于找相同/分类，这里要懂"先…再…"）。
   巧思：每个故事都是孩子熟悉的自然/生活过程（种子→花、毛虫→蝶），
         按对一张亮一张并出现序号；难度=卡片数（3/4/5）。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

/** 一张故事卡：emoji + 短描述。 */
interface Card {
  emoji: string;
  text: string;
}
/** 一个故事：按时间先后顺序排列的卡片。 */
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
      { emoji: "🐜", text: "结茧" },
      { emoji: "🦋", text: "蝴蝶" },
    ],
  },
  {
    title: "下雨了",
    cards: [
      { emoji: "☀️", text: "晴天" },
      { emoji: "☁️", text: "乌云" },
      { emoji: "🌧️", text: "下雨" },
      { emoji: "🌈", text: "彩虹" },
    ],
  },
  {
    title: "早晨起床",
    cards: [
      { emoji: "🛏️", text: "起床" },
      { emoji: "🪥", text: "刷牙" },
      { emoji: "🥣", text: "吃早饭" },
      { emoji: "🎒", text: "上学" },
    ],
  },
  {
    title: "小蝌蚪找妈妈",
    cards: [
      { emoji: "🐸", text: "青蛙妈妈" },
      { emoji: "🥚", text: "蝌蚪卵" },
      { emoji: "🐣", text: "小蝌蚪" },
      { emoji: "🐸", text: "小青蛙" },
    ],
  },
];

export class StoryOrderGame extends BaseGame {
  constructor() {
    super("story-order");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  /** 当前故事已点对的张数（用于判完成）。 */
  private picked = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 难度=卡片数。easy=3，medium=4，hard=5。 */
  private cardCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.picked = 0;

    // 选故事，按难度截取前 N 张
    const full = sample(STORIES);
    const n = Math.min(this.cardCount(), full.cards.length);
    const correctOrder = full.cards.slice(0, n);
    // 用 emoji+text 组合作为唯一键，避免重复 emoji
    const shown = shuffle(correctOrder);

    const wrap = document.createElement("div");
    wrap.className = "sto-wrap";

    const task = document.createElement("div");
    task.className = "sto-task";
    task.innerHTML = `按时间<b>先后</b>顺序点图：${full.title}<br><span class="sto-hint">先发生的先点（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    // 排序槽：显示已点对的卡片（带序号）
    const slots = document.createElement("div");
    slots.className = "sto-slots";
    for (let i = 0; i < n; i++) {
      const slot = document.createElement("div");
      slot.className = "sto-slot";
      slot.dataset.idx = String(i);
      slot.innerHTML = `<span class="sto-slot__num">${i + 1}</span>`;
      slots.appendChild(slot);
    }
    wrap.appendChild(slots);

    // 卡片库：乱序排列的卡片
    const pool = document.createElement("div");
    pool.className = "sto-pool";
    shown.forEach((c, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sto-card";
      b.dataset.idx = String(idx);
      b.dataset.text = c.text;
      b.innerHTML = `<div class="sto-card__emoji">${c.emoji}</div><div class="sto-card__text">${c.text}</div>`;
      b.addEventListener("click", () => this.choose(c, correctOrder, b, slots));
      pool.appendChild(b);
    });
    wrap.appendChild(pool);
    this.root.appendChild(wrap);
  }

  private choose(
    c: Card,
    correctOrder: Card[],
    btn: HTMLButtonElement,
    slots: HTMLElement,
  ): void {
    if (btn.classList.contains("sto-card--used")) return;
    const expect = correctOrder[this.picked];
    if (expect && expect.text === c.text && expect.emoji === c.emoji) {
      // 答对一张
      btn.classList.add("sto-card--used");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 在对应槽位填充
      const slot = slots.querySelector<HTMLElement>(
        `.sto-slot[data-idx="${this.picked}"]`,
      );
      if (slot) {
        slot.classList.add("sto-slot--filled");
        slot.insertAdjacentHTML(
          "beforeend",
          `<div class="sto-slot__emoji">${c.emoji}</div><div class="sto-slot__cap">${c.text}</div>`,
        );
      }
      this.picked += 1;
      if (this.picked >= correctOrder.length) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1200);
      }
    } else {
      // 答错一张：抖动，但不前进
      btn.classList.add("sto-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("sto-card--wrong"), 450);
      if (paused) this.showRest();
    }
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
    if (document.getElementById("sto-style")) return;
    const st = document.createElement("style");
    st.id = "sto-style";
    st.textContent = STO_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function STO_CSS(theme: string): string {
  void theme;
  return `
.sto-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(500px,100%);}
.sto-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.sto-hint{font-size:.82rem;color:var(--ink-soft);font-weight:600;}
.sto-slots{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding:10px 14px;background:rgba(255,255,255,.6);border-radius:18px;box-shadow:var(--shadow);}
.sto-slot{width:70px;height:84px;border:3px dashed #c7c7d1;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;position:relative;background:#fff;}
.sto-slot__num{position:absolute;top:-10px;left:-8px;background:#999;color:#fff;width:24px;height:24px;border-radius:50%;font-size:.85rem;font-weight:800;display:flex;align-items:center;justify-content:center;}
.sto-slot--filled{border:3px solid #6bcf7f;background:#d4f4dd;animation:sto-fill .35s ease;}
.sto-slot__emoji{font-size:1.9rem;line-height:1;}
.sto-slot__cap{font-size:.7rem;font-weight:700;color:var(--ink);}
.sto-pool{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding-top:6px;}
.sto-card{width:84px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:5px;transition:transform .15s;}
.sto-card:active{transform:scale(.93);}
.sto-card__emoji{font-size:2.6rem;line-height:1;}
.sto-card__text{font-size:.8rem;font-weight:700;color:var(--ink);}
.sto-card--used{opacity:.35;pointer-events:none;background:#eee;}
.sto-card--wrong{animation:sto-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes sto-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes sto-fill{0%{transform:scale(.5)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
`;
}

export function create(): StoryOrderGame {
  return new StoryOrderGame();
}
