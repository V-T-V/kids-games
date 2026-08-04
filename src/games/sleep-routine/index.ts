/* 睡前 Sleep-Routine —— 把睡前的步骤按正确先后顺序点出来
   （刷牙→换睡衣→讲故事→关灯→睡觉）。作息自理启蒙。
   独特点：聚焦睡前流程，难度=步骤数（3/4/5）。
   前缀 slr2-。 */

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
    title: "睡前准备",
    steps: [
      { emoji: "🪥", text: "刷牙" },
      { emoji: "🚽", text: "上厕所" },
      { emoji: "🩴", text: "换上睡衣" },
      { emoji: "📖", text: "听妈妈讲故事" },
      { emoji: "💡", text: "关灯" },
      { emoji: "😴", text: "盖好被子睡觉" },
    ],
  },
  {
    title: "收拾好睡觉",
    steps: [
      { emoji: "🧸", text: "把玩具收好" },
      { emoji: "🪥", text: "刷牙洗脸" },
      { emoji: "👕", text: "叠好明天要穿的衣服" },
      { emoji: "📚", text: "看完绘本" },
      { emoji: "🌙", text: "乖乖睡觉" },
    ],
  },
];

export class SleepRoutineGame extends BaseGame {
  constructor() {
    super("sleep-routine");
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
    wrap.className = "slr2-wrap";

    const task = document.createElement("div");
    task.className = "slr2-task";
    task.innerHTML = `按<b>先后</b>顺序点出"${full.title}"<br><span class="slr2-hint">先做的先点（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const slots = document.createElement("div");
    slots.className = "slr2-slots";
    for (let i = 0; i < n; i++) {
      const slot = document.createElement("div");
      slot.className = "slr2-slot";
      slot.dataset.idx = String(i);
      slot.innerHTML = `<span class="slr2-slot__num">${i + 1}</span>`;
      slots.appendChild(slot);
    }
    wrap.appendChild(slots);

    const pool = document.createElement("div");
    pool.className = "slr2-pool";
    shown.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "slr2-card";
      b.dataset.text = c.text;
      b.innerHTML = `<div class="slr2-card__emoji">${c.emoji}</div><div class="slr2-card__text">${c.text}</div>`;
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
    if (btn.classList.contains("slr2-card--used")) return;
    const expect = correctOrder[this.picked];
    if (expect && expect.text === c.text) {
      btn.classList.add("slr2-card--used");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      const slot = slots.querySelector<HTMLElement>(
        `.slr2-slot[data-idx="${this.picked}"]`,
      );
      if (slot) {
        slot.classList.add("slr2-slot--filled");
        slot.insertAdjacentHTML(
          "beforeend",
          `<div class="slr2-slot__emoji">${c.emoji}</div><div class="slr2-slot__cap">${c.text}</div>`,
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
      btn.classList.add("slr2-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("slr2-card--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想睡觉前<b>最先</b>要做什么～",
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
    if (document.getElementById("slr2-style")) return;
    const st = document.createElement("style");
    st.id = "slr2-style";
    st.textContent = SLR2_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function SLR2_CSS(theme: string): string {
  return `
.slr2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(500px,100%);}
.slr2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.slr2-task b{color:${theme};}
.slr2-hint{font-size:.82rem;color:var(--ink-soft);font-weight:600;}
.slr2-slots{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding:10px 14px;background:rgba(255,255,255,.6);border-radius:18px;box-shadow:var(--shadow);}
.slr2-slot{width:72px;height:86px;border:3px dashed #c5c8f5;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;position:relative;background:#fff;}
.slr2-slot__num{position:absolute;top:-10px;left:-8px;background:#6366f1;color:#fff;width:24px;height:24px;border-radius:50%;font-size:.85rem;font-weight:800;display:flex;align-items:center;justify-content:center;}
.slr2-slot--filled{border:3px solid #6bcf7f;background:#d4f4dd;animation:slr2-fill .35s ease;}
.slr2-slot__emoji{font-size:1.9rem;line-height:1;}
.slr2-slot__cap{font-size:.68rem;font-weight:700;color:var(--ink);text-align:center;padding:0 2px;}
.slr2-pool{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding-top:6px;}
.slr2-card{width:86px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:5px;transition:transform .15s;}
.slr2-card:active{transform:scale(.93);}
.slr2-card__emoji{font-size:2.6rem;line-height:1;}
.slr2-card__text{font-size:.8rem;font-weight:700;color:var(--ink);text-align:center;}
.slr2-card--used{opacity:.35;pointer-events:none;background:#eef0ff;}
.slr2-card--wrong{animation:slr2-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes slr2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes slr2-fill{0%{transform:scale(.5)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
`;
}

export function create(): SleepRoutineGame {
  return new SleepRoutineGame();
}
