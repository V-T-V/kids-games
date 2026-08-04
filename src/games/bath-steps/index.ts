/* 洗澡 Bath-Steps —— 把洗澡的步骤按正确先后顺序点出来
   （脱衣→淋湿→抹沐浴露→冲洗→擦干→穿衣）。生活自理启蒙。
   独特点：聚焦日常洗澡流程，难度=步骤数（4/5/6）。
   前缀 bts-。 */

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
    title: "好好洗个澡",
    steps: [
      { emoji: "👕", text: "脱衣服" },
      { emoji: "🚿", text: "用水淋湿身体" },
      { emoji: "🧴", text: "抹沐浴露" },
      { emoji: "💦", text: "冲洗干净" },
      { emoji: "🧖", text: "用毛巾擦干" },
      { emoji: "🧥", text: "穿上干净衣服" },
    ],
  },
  {
    title: "洗头发",
    steps: [
      { emoji: "💧", text: "先把头发打湿" },
      { emoji: "🫧", text: "挤洗发水搓出泡泡" },
      { emoji: "💆", text: "轻轻揉头皮" },
      { emoji: "🚿", text: "用清水冲掉泡泡" },
      { emoji: "🧖", text: "用毛巾擦干头发" },
    ],
  },
];

export class BathStepsGame extends BaseGame {
  constructor() {
    super("bath-steps");
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
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 5
        : 6;
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
    wrap.className = "bts-wrap";

    const task = document.createElement("div");
    task.className = "bts-task";
    task.innerHTML = `按<b>先后</b>顺序点出"${full.title}"<br><span class="bts-hint">先做的先点（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const slots = document.createElement("div");
    slots.className = "bts-slots";
    for (let i = 0; i < n; i++) {
      const slot = document.createElement("div");
      slot.className = "bts-slot";
      slot.dataset.idx = String(i);
      slot.innerHTML = `<span class="bts-slot__num">${i + 1}</span>`;
      slots.appendChild(slot);
    }
    wrap.appendChild(slots);

    const pool = document.createElement("div");
    pool.className = "bts-pool";
    shown.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bts-card";
      b.dataset.text = c.text;
      b.innerHTML = `<div class="bts-card__emoji">${c.emoji}</div><div class="bts-card__text">${c.text}</div>`;
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
    if (btn.classList.contains("bts-card--used")) return;
    const expect = correctOrder[this.picked];
    if (expect && expect.text === c.text) {
      btn.classList.add("bts-card--used");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      const slot = slots.querySelector<HTMLElement>(
        `.bts-slot[data-idx="${this.picked}"]`,
      );
      if (slot) {
        slot.classList.add("bts-slot--filled");
        slot.insertAdjacentHTML(
          "beforeend",
          `<div class="bts-slot__emoji">${c.emoji}</div><div class="bts-slot__cap">${c.text}</div>`,
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
      btn.classList.add("bts-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("bts-card--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🛁",
      variant: "rest",
      body: "想想洗澡时<b>最先</b>要做什么～",
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
    if (document.getElementById("bts-style")) return;
    const st = document.createElement("style");
    st.id = "bts-style";
    st.textContent = BTS_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function BTS_CSS(theme: string): string {
  return `
.bts-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(500px,100%);}
.bts-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.bts-task b{color:${theme};}
.bts-hint{font-size:.82rem;color:var(--ink-soft);font-weight:600;}
.bts-slots{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding:10px 14px;background:rgba(255,255,255,.6);border-radius:18px;box-shadow:var(--shadow);}
.bts-slot{width:72px;height:86px;border:3px dashed #b8e6ee;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;position:relative;background:#fff;}
.bts-slot__num{position:absolute;top:-10px;left:-8px;background:#22d3ee;color:#fff;width:24px;height:24px;border-radius:50%;font-size:.85rem;font-weight:800;display:flex;align-items:center;justify-content:center;}
.bts-slot--filled{border:3px solid #6bcf7f;background:#d4f4dd;animation:bts-fill .35s ease;}
.bts-slot__emoji{font-size:1.9rem;line-height:1;}
.bts-slot__cap{font-size:.68rem;font-weight:700;color:var(--ink);text-align:center;padding:0 2px;}
.bts-pool{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding-top:6px;}
.bts-card{width:86px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:5px;transition:transform .15s;}
.bts-card:active{transform:scale(.93);}
.bts-card__emoji{font-size:2.6rem;line-height:1;}
.bts-card__text{font-size:.8rem;font-weight:700;color:var(--ink);text-align:center;}
.bts-card--used{opacity:.35;pointer-events:none;background:#e6f7fa;}
.bts-card--wrong{animation:bts-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes bts-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes bts-fill{0%{transform:scale(.5)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
`;
}

export function create(): BathStepsGame {
  return new BathStepsGame();
}
