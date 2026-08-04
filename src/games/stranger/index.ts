/* 防陌生人 Stranger —— 给出场景（陌生人给糖果/要带走/问路），
   孩子从选项选<b>正确的</b>做法（拒绝/跑开/找大人帮忙）。
   独特点：安全情境判断 + 多选项。视觉：场景卡 + 选项按钮。
   巧思：每个场景配一句直白情境；正确做法高亮，错误抖动并提示。
   难度=轮数。通关=完成目标轮数。前缀 stg-。 */

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
    emoji: "🍬",
    scene: "陌生阿姨说：小朋友，阿姨给你糖吃，跟我走好吗？",
    choices: [
      { text: "不要，快跑开", correct: true },
      { text: "接过糖吃", correct: false },
      { text: "跟她走", correct: false },
    ],
  },
  {
    emoji: "🚗",
    scene: "陌生叔叔说：上车吧，叔叔带你去找妈妈。",
    choices: [
      { text: "不上车，去找老师", correct: true },
      { text: "上他的车", correct: false },
      { text: "告诉他家在哪", correct: false },
    ],
  },
  {
    emoji: "🐶",
    scene: "陌生人说：帮叔叔找找我的小狗好不好？",
    choices: [
      { text: "不帮，去找大人", correct: true },
      { text: "跟他一起去", correct: false },
      { text: "带他去家里", correct: false },
    ],
  },
  {
    emoji: "📱",
    scene: "陌生人问：小朋友，你家住在哪里呀？",
    choices: [
      { text: "不说，走开", correct: true },
      { text: "告诉他地址", correct: false },
      { text: "带他回家", correct: false },
    ],
  },
  {
    emoji: "🎁",
    scene: "陌生人说：送你一个玩具，跟我去拿好不好？",
    choices: [
      { text: "不要，去找家长", correct: true },
      { text: "跟他去拿", correct: false },
      { text: "收下玩具", correct: false },
    ],
  },
];

export class StrangerGame extends BaseGame {
  constructor() {
    super("stranger");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

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
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const scenario = SCENARIOS[this.roundsDone % SCENARIOS.length]!;
    const choices = shuffle(scenario.choices);

    const wrap = document.createElement("div");
    wrap.className = "stg-wrap";
    const task = document.createElement("div");
    task.className = "stg-task";
    task.innerHTML = `遇到这种情况该怎么办？<b>选对的</b>做法～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "stg-card";
    card.innerHTML = `<div class="stg-card__emoji">${scenario.emoji}</div><div class="stg-card__scene">${scenario.scene}</div>`;
    wrap.appendChild(card);

    const opts = document.createElement("div");
    opts.className = "stg-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "stg-choice";
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
      btn.classList.add("stg-choice--right");
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
      btn.classList.add("stg-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("stg-choice--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🛡️",
      variant: "rest",
      body: "陌生人给东西或叫你跟他走，都<b>不要</b>！要拒绝并去找认识的大人～",
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
    if (document.getElementById("stg-style")) return;
    const st = document.createElement("style");
    st.id = "stg-style";
    st.textContent = STG_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function STG_CSS(theme: string): string {
  return `
.stg-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.stg-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.4;}
.stg-card{display:flex;gap:14px;align-items:center;background:#fff;padding:16px 18px;border-radius:20px;box-shadow:var(--shadow);width:100%;border-left:6px solid ${theme};}
.stg-card__emoji{font-size:3rem;line-height:1;flex:none;}
.stg-card__scene{font-size:1rem;font-weight:700;color:var(--ink);line-height:1.5;}
.stg-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:380px;}
.stg-choice{padding:14px 18px;font-size:1rem;font-weight:700;border-radius:14px;border:3px solid #e0e0e8;background:#fff;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;color:var(--ink);}
.stg-choice:active{transform:scale(.97);}
.stg-choice--right{border-color:#6bcf7f;background:#d4f4dd;animation:stg-pop .4s ease;}
.stg-choice--wrong{border-color:#ff6348;background:#ffe0e0;animation:stg-shake .4s ease;}
@keyframes stg-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes stg-pop{0%{transform:scale(.9)}60%{transform:scale(1.05)}100%{transform:scale(1)}}
`;
}

export function create(): StrangerGame {
  return new StrangerGame();
}
