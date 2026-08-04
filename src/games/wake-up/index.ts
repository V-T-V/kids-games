/* 起床 Wake-Up —— 把起床后的步骤按正确先后顺序点出来
   （睁眼→伸懒腰→穿衣→叠被→刷牙洗脸）。作息自理启蒙。
   独特点：聚焦起床流程，难度=步骤数（3/4/5）。
   前缀 wku-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Step {
  emoji: string;
  text: string;
}
interface Routine {
  title: string;
  steps: Step[];
}

const ROUTINES: Routine[] = [
  {
    title: "早上起床啦",
    steps: [
      { emoji: "😁", text: "睁开眼睛醒过来" },
      { emoji: "🤸", text: "伸个懒腰" },
      { emoji: "👕", text: "穿好衣服" },
      { emoji: "🛏️", text: "叠好被子" },
      { emoji: "🪥", text: "刷牙洗脸" },
      { emoji: "🍳", text: "吃早餐" },
    ],
  },
  {
    title: "准备上学",
    steps: [
      { emoji: "🚿", text: "洗脸清醒" },
      { emoji: "🎒", text: "收拾书包" },
      { emoji: "👟", text: "穿好鞋子" },
      { emoji: "👋", text: "和爸爸妈妈说再见" },
    ],
  },
];

export class WakeUpGame extends BaseGame {
  constructor() {
    super("wake-up");
  }
  private roundsDone = 0;
  private roundTotal = 0;
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

  private stepCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.picked = 0;

    const full = sample(ROUTINES);
    const n = Math.min(this.stepCount(), full.steps.length);
    const correctOrder = full.steps.slice(0, n);
    const shown = shuffle(correctOrder);

    const wrap = document.createElement("div");
    wrap.className = "wku-wrap";

    const task = document.createElement("div");
    task.className = "wku-task";
    task.innerHTML = `按<b>先后</b>顺序点出"${full.title}"<br><span class="wku-hint">先做的先点（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const slots = document.createElement("div");
    slots.className = "wku-slots";
    for (let i = 0; i < n; i++) {
      const slot = document.createElement("div");
      slot.className = "wku-slot";
      slot.dataset.idx = String(i);
      slot.innerHTML = `<span class="wku-slot__num">${i + 1}</span>`;
      slots.appendChild(slot);
    }
    wrap.appendChild(slots);

    const pool = document.createElement("div");
    pool.className = "wku-pool";
    shown.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wku-card";
      b.dataset.text = c.text;
      b.innerHTML = `<div class="wku-card__emoji">${c.emoji}</div><div class="wku-card__text">${c.text}</div>`;
      b.addEventListener("click", () => this.choose(c, correctOrder, b, slots));
      pool.appendChild(b);
    });
    wrap.appendChild(pool);
    this.root.appendChild(wrap);
  }

  private choose(
    c: Step,
    correctOrder: Step[],
    btn: HTMLButtonElement,
    slots: HTMLElement,
  ): void {
    if (btn.classList.contains("wku-card--used")) return;
    const expect = correctOrder[this.picked];
    if (expect && expect.text === c.text) {
      btn.classList.add("wku-card--used");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      const slot = slots.querySelector<HTMLElement>(
        `.wku-slot[data-idx="${this.picked}"]`,
      );
      if (slot) {
        slot.classList.add("wku-slot--filled");
        slot.insertAdjacentHTML(
          "beforeend",
          `<div class="wku-slot__emoji">${c.emoji}</div><div class="wku-slot__cap">${c.text}</div>`,
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
      btn.classList.add("wku-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("wku-card--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "⏰",
      variant: "rest",
      body: "想想起床后<b>最先</b>要做什么～",
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
    if (document.getElementById("wku-style")) return;
    const st = document.createElement("style");
    st.id = "wku-style";
    st.textContent = WKU_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function WKU_CSS(theme: string): string {
  return `
.wku-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(500px,100%);}
.wku-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.wku-task b{color:${theme};}
.wku-hint{font-size:.82rem;color:var(--ink-soft);font-weight:600;}
.wku-slots{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding:10px 14px;background:rgba(255,255,255,.6);border-radius:18px;box-shadow:var(--shadow);}
.wku-slot{width:72px;height:86px;border:3px dashed #f0d98a;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;position:relative;background:#fff;}
.wku-slot__num{position:absolute;top:-10px;left:-8px;background:#ffd93d;color:#7a5a00;width:24px;height:24px;border-radius:50%;font-size:.85rem;font-weight:800;display:flex;align-items:center;justify-content:center;}
.wku-slot--filled{border:3px solid #6bcf7f;background:#d4f4dd;animation:wku-fill .35s ease;}
.wku-slot__emoji{font-size:1.9rem;line-height:1;}
.wku-slot__cap{font-size:.68rem;font-weight:700;color:var(--ink);text-align:center;padding:0 2px;}
.wku-pool{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding-top:6px;}
.wku-card{width:86px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:5px;transition:transform .15s;}
.wku-card:active{transform:scale(.93);}
.wku-card__emoji{font-size:2.6rem;line-height:1;}
.wku-card__text{font-size:.8rem;font-weight:700;color:var(--ink);text-align:center;}
.wku-card--used{opacity:.35;pointer-events:none;background:#fff8db;}
.wku-card--wrong{animation:wku-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes wku-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes wku-fill{0%{transform:scale(.5)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
`;
}

export function create(): WakeUpGame {
  return new WakeUpGame();
}
