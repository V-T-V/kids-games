/* 用药安全 Medicine-Safety —— 给出用药情境，孩子选<b>正确的</b>做法。
   情境：药不能当糖吃 / 要大人给 / 按时按量 / 不喝别人的药水。
   独特点：安全判断 + 多选项。视觉：情境卡 + 选项按钮。
   巧思：每题一个直白情境；选对高亮，选错抖动并提示。前缀 mds-。 */

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
    emoji: "🍬💊",
    scene: "桌上有个漂亮糖豆样的药丸，看起来好好吃。",
    choices: [
      { text: "不能吃，可能是药", correct: true },
      { text: "当糖豆吃掉", correct: false },
      { text: "拿给弟弟尝尝", correct: false },
    ],
  },
  {
    emoji: "🤒🥄",
    scene: "生病了，药放在高处够不着。",
    choices: [
      { text: "请大人帮忙拿药", correct: true },
      { text: "爬椅子自己够", correct: false },
      { text: "多喝几口好得快", correct: false },
    ],
  },
  {
    emoji: "⏰💧",
    scene: "医生说每次只能喝一小勺，一天三次。",
    choices: [
      { text: "按医生说的喝", correct: true },
      { text: "一次喝一大瓶", correct: false },
      { text: "想喝就喝", correct: false },
    ],
  },
  {
    emoji: "🧃❓",
    scene: "小朋友说：我的药水甜甜的，你也喝一口？",
    choices: [
      { text: "不喝别人的药", correct: true },
      { text: "喝一口尝尝", correct: false },
      { text: "和他换着喝", correct: false },
    ],
  },
  {
    emoji: "📦👀",
    scene: "柜子里有个不认识的瓶子。",
    choices: [
      { text: "不乱动，问大人", correct: true },
      { text: "拧开闻一闻", correct: false },
      { text: "倒出来玩", correct: false },
    ],
  },
  {
    emoji: "🍪💊",
    scene: "药和饼干长得很像，混在一起了。",
    choices: [
      { text: "让大人分清楚", correct: true },
      { text: "都吃掉算了", correct: false },
      { text: "挑好看的吃", correct: false },
    ],
  },
];

export class MedicineSafetyGame extends BaseGame {
  constructor() {
    super("medicine-safety");
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
    wrap.className = "mds-wrap";
    const task = document.createElement("div");
    task.className = "mds-task";
    task.innerHTML = `这样做<b>对</b>吗？选<b>对的</b>做法～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "mds-card";
    card.innerHTML = `<div class="mds-card__emoji">${scenario.emoji}</div><div class="mds-card__scene">${scenario.scene}</div>`;
    wrap.appendChild(card);

    const opts = document.createElement("div");
    opts.className = "mds-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mds-choice";
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
      btn.classList.add("mds-choice--right");
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
      btn.classList.add("mds-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("mds-choice--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "💊",
      variant: "rest",
      body: "药不是糖！要<b>大人</b>给、<b>按时按量</b>，不能乱吃别人的药～",
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
    if (document.getElementById("mds-style")) return;
    const st = document.createElement("style");
    st.id = "mds-style";
    st.textContent = MDS_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function MDS_CSS(theme: string): string {
  return `
.mds-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.mds-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.4;}
.mds-task b{color:${theme};}
.mds-card{display:flex;gap:14px;align-items:center;background:#fff;padding:16px 18px;border-radius:20px;box-shadow:var(--shadow);width:100%;border-left:6px solid ${theme};}
.mds-card__emoji{font-size:2.6rem;line-height:1;flex:none;}
.mds-card__scene{font-size:1rem;font-weight:700;color:var(--ink);line-height:1.5;}
.mds-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:380px;}
.mds-choice{padding:14px 18px;font-size:1rem;font-weight:700;border-radius:14px;border:3px solid #e0e0e8;background:#fff;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;color:var(--ink);}
.mds-choice:active{transform:scale(.97);}
.mds-choice--right{border-color:#6bcf7f;background:#d4f4dd;animation:mds-pop .4s ease;}
.mds-choice--wrong{border-color:#ff6348;background:#ffe0e0;animation:mds-shake .4s ease;}
@keyframes mds-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes mds-pop{0%{transform:scale(.9)}60%{transform:scale(1.05)}100%{transform:scale(1)}}
`;
}

export function create(): MedicineSafetyGame {
  return new MedicineSafetyGame();
}
