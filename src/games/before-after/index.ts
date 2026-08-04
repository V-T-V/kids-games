/* 前后顺序 Before After —— 3 张事件图卡乱序，按先后顺序点击排列。
   独特点：事件因果/时间排序（如种子→发芽→开花），训练时序逻辑。
   巧思：卡片乱序展示，孩子按正确顺序依次点击；难度=卡片数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Card {
  emoji: string;
  text: string;
}

interface Story {
  steps: Card[]; // 已是正确顺序
}

const STORIES: Story[] = [
  {
    steps: [
      { emoji: "🌱", text: "种子" },
      { emoji: "🌿", text: "发芽" },
      { emoji: "🌸", text: "开花" },
    ],
  },
  {
    steps: [
      { emoji: "🥚", text: "鸡蛋" },
      { emoji: "🐤", text: "破壳" },
      { emoji: "🐔", text: "小鸡" },
    ],
  },
  {
    steps: [
      { emoji: "☁️", text: "乌云" },
      { emoji: "🌧️", text: "下雨" },
      { emoji: "🌻", text: "开花" },
    ],
  },
  {
    steps: [
      { emoji: "🌙", text: "睡觉" },
      { emoji: "🌅", text: "天亮" },
      { emoji: "🚌", text: "上学" },
    ],
  },
  {
    steps: [
      { emoji: "🧱", text: "搭积木" },
      { emoji: "🏰", text: "城堡" },
      { emoji: "💥", text: "倒了" },
    ],
  },
  // 4 步（hard 用）
  {
    steps: [
      { emoji: "🌱", text: "种子" },
      { emoji: "🌿", text: "发芽" },
      { emoji: "🌸", text: "开花" },
      { emoji: "🍎", text: "结果" },
    ],
  },
  {
    steps: [
      { emoji: "🥚", text: "鸡蛋" },
      { emoji: "🐛", text: "毛毛虫" },
      { emoji: "🕸️", text: "结茧" },
      { emoji: "🦋", text: "蝴蝶" },
    ],
  },
];

export class BeforeAfterGame extends BaseGame {
  constructor() {
    super("before-after");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private nextStep = 0;
  private story!: Story;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.nextStep = 0;

    // 按难度筛合适步数的题：保证 >= 3
    const candidates = STORIES.filter((s) => s.steps.length >= 3);
    this.story = sample(candidates);

    const wrap = document.createElement("div");
    wrap.className = "baf-wrap";

    const task = document.createElement("div");
    task.className = "baf-task";
    task.textContent = `按先后顺序，从最早开始点（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const grid = document.createElement("div");
    grid.className = "baf-grid";

    // 乱序展示
    const shuffled = shuffle(this.story.steps);
    for (const card of shuffled) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "baf-card";
      b.innerHTML = `<div class="baf-card-emoji">${card.emoji}</div><div class="baf-card-text">${card.text}</div>`;
      b.addEventListener("click", () => this.clickCard(card, b));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);

    // 已点击序号槽
    const slots = document.createElement("div");
    slots.className = "baf-slots";
    slots.id = "baf-slots";
    for (let i = 0; i < this.story.steps.length; i++) {
      const s = document.createElement("div");
      s.className = "baf-slot";
      s.textContent = String(i + 1);
      slots.appendChild(s);
    }
    wrap.appendChild(slots);

    this.root.appendChild(wrap);
  }

  private clickCard(card: Card, btn: HTMLButtonElement): void {
    const expected = this.story.steps[this.nextStep]!;
    if (card.text === expected.text) {
      btn.classList.add("baf-card--done");
      btn.disabled = true;
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 填进对应槽
      const slots = this.root.querySelectorAll(".baf-slot");
      const slot = slots[this.nextStep] as HTMLElement | undefined;
      if (slot) {
        slot.classList.add("baf-slot--filled");
        slot.textContent = card.emoji;
      }
      this.nextStep += 1;
      if (this.nextStep >= this.story.steps.length) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 900);
      }
    } else {
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想哪件事是先发生的～",
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
    if (document.getElementById("baf-style")) return;
    const st = document.createElement("style");
    st.id = "baf-style";
    st.textContent = BAF_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function BAF_CSS(theme: string): string {
  return `
.baf-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.baf-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.baf-grid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
.baf-card{width:108px;height:124px;border-radius:20px;background:#fff;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;transition:transform .12s ease;}
.baf-card:active{transform:scale(.94);}
.baf-card-emoji{font-size:3rem;}
.baf-card-text{font-size:1rem;font-weight:800;color:${theme};}
.baf-card--done{background:#d4f4dd;outline:4px solid #34c759;opacity:.65;}
.baf-slots{display:flex;gap:10px;}
.baf-slot{width:50px;height:50px;border-radius:14px;border:3px dashed #c9b6e4;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:900;color:#aaa;}
.baf-slot--filled{border:3px solid #34c759;background:#eafbf0;color:#2e8b57;}
`;
}

export function create(): BeforeAfterGame {
  return new BeforeAfterGame();
}
