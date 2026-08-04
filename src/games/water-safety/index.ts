/* 水边安全 Water-Safety —— 给出水边情境，孩子选<b>正确的</b>做法。
   情境：不独自游泳 / 不推人下水 / 穿救生衣 / 不在深水区玩。
   独特点：安全判断 + 多选项。视觉：情境卡 + 选项按钮。
   巧思：选对高亮，选错抖动并提示。前缀 wts-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Choice {
  text: string;
  correct: boolean;
}
interface Scenario {
  emoji: string;
  scene: string;
  choices: Choice[];
}

const SCENARIOS: Scenario[] = [
  {
    emoji: "🏊👦",
    scene: "天气热，想下水游泳凉快。",
    choices: [
      { text: "和大人一起去", correct: true },
      { text: "自己偷偷去游", correct: false },
      { text: "叫上小伙伴就行", correct: false },
    ],
  },
  {
    emoji: "🌊😂",
    scene: "小伙伴站在河边，想吓他一下。",
    choices: [
      { text: "不能推人下水", correct: true },
      { text: "推他一下玩", correct: false },
      { text: "从后面撞他", correct: false },
    ],
  },
  {
    emoji: "🚤🦺",
    scene: "要坐小船去湖里玩。",
    choices: [
      { text: "穿好救生衣", correct: true },
      { text: "不穿也行", correct: false },
      { text: "只穿一只袖", correct: false },
    ],
  },
  {
    emoji: "⚠️🌊",
    scene: "河边写着「水深危险」。",
    choices: [
      { text: "不去那边玩", correct: true },
      { text: "越深越好玩", correct: false },
      { text: "下去试试深浅", correct: false },
    ],
  },
  {
    emoji: "🛟🤽",
    scene: "在游泳池的深水区。",
    choices: [
      { text: "在浅水区玩", correct: true },
      { text: "去深水区探险", correct: false },
      { text: "潜水到池底", correct: false },
    ],
  },
  {
    emoji: "🏖️🧸",
    scene: "海边的浪一阵阵涌来。",
    choices: [
      { text: "在大人身边玩", correct: true },
      { text: "往浪里冲", correct: false },
      { text: "背对着浪玩", correct: false },
    ],
  },
];

export class WaterSafetyGame extends BaseGame {
  constructor() {
    super("water-safety");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private order: Scenario[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.order = shuffle(SCENARIOS);
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const scenario = this.order[this.roundsDone % this.order.length]!;
    const choices = shuffle(scenario.choices);

    const wrap = document.createElement("div");
    wrap.className = "wts-wrap";
    const task = document.createElement("div");
    task.className = "wts-task";
    task.innerHTML = `水边这样做<b>对</b>吗？选<b>对的</b>做法～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "wts-card";
    card.innerHTML = `<div class="wts-card__emoji">${scenario.emoji}</div><div class="wts-card__scene">${scenario.scene}</div>`;
    wrap.appendChild(card);

    const opts = document.createElement("div");
    opts.className = "wts-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wts-choice";
      b.textContent = c.text;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(c: Choice, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (c.correct) {
      this.answered = true;
      btn.classList.add("wts-choice--right");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("wts-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("wts-choice--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🦺",
      variant: "rest",
      body: "玩水要<b>大人陪着</b>、<b>穿救生衣</b>，<b>不推人</b>、不去深水区～",
      primary: { text: "继续", icon: "🛡️", onClick: () => ov.destroy() },
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
    if (document.getElementById("wts-style")) return;
    const st = document.createElement("style");
    st.id = "wts-style";
    st.textContent = WTS_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function WTS_CSS(theme: string): string {
  return `
.wts-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.wts-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.4;}
.wts-task b{color:${theme};}
.wts-card{display:flex;gap:14px;align-items:center;background:#fff;padding:16px 18px;border-radius:20px;box-shadow:var(--shadow);width:100%;border-left:6px solid ${theme};}
.wts-card__emoji{font-size:2.6rem;line-height:1;flex:none;}
.wts-card__scene{font-size:1rem;font-weight:700;color:var(--ink);line-height:1.5;}
.wts-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:380px;}
.wts-choice{padding:14px 18px;font-size:1rem;font-weight:700;border-radius:14px;border:3px solid #e0e0e8;background:#fff;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;color:var(--ink);}
.wts-choice:active{transform:scale(.97);}
.wts-choice--right{border-color:#6bcf7f;background:#d4f4dd;animation:wts-pop .4s ease;}
.wts-choice--wrong{border-color:#ff6348;background:#ffe0e0;animation:wts-shake .4s ease;}
@keyframes wts-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes wts-pop{0%{transform:scale(.9)}60%{transform:scale(1.05)}100%{transform:scale(1)}}
`;
}

export function create(): WaterSafetyGame {
  return new WaterSafetyGame();
}
