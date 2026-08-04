/* 防晒防暑 Sun-Safety —— 判断夏天的做法对不对。
   做法：戴帽子 ✅ / 涂防晒霜 ✅ / 多喝水 ✅ / 找阴凉 ✅ / 中午暴晒 ❌ / 不喝水 ❌。
   独特点：每个情境一个做法，判断"对/不对"。视觉：行为卡 + 对错按钮。
   巧思：选对高亮，选错抖动并提示。前缀 sns-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface Action {
  pic: string;
  text: string;
  good: boolean;
}

const ACTIONS: Action[] = [
  { pic: "🧢👦☀️", text: "出门戴帽子遮太阳", good: true },
  { pic: "🧴👦🌞", text: "出门前涂好防晒霜", good: true },
  { pic: "💧👦🥤", text: "出汗后多喝白开水", good: true },
  { pic: "🌳👦😎", text: "热了找树荫下乘凉", good: true },
  { pic: "🌞👦🤾", text: "中午大太阳底下猛跑", good: false },
  { pic: "🥵👦🚫", text: "渴了也不喝水继续玩", good: false },
  { pic: "🍦👦🍦", text: "热了猛吃好几根冰棒", good: false },
  { pic: "🚗🐶👦", text: "被关在晒热的车里", good: false },
  { pic: "🌂👦☀️", text: "打把伞挡太阳", good: true },
  { pic: "🧊👦🥵", text: "头晕了去找大人休息", good: true },
];

export class SunSafetyGame extends BaseGame {
  constructor() {
    super("sun-safety");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private current: Action | null = null;
  private lastIdx = -1;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 取一个不与上轮重复的随机项，保证多样性。 */
  private nextAction(): Action {
    let it = sample(ACTIONS);
    let guard = 0;
    while (ACTIONS.indexOf(it) === this.lastIdx && guard < 8) {
      it = sample(ACTIONS);
      guard += 1;
    }
    this.lastIdx = ACTIONS.indexOf(it);
    return it;
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const it = this.nextAction();
    this.current = it;

    const wrap = document.createElement("div");
    wrap.className = "sns-wrap";

    const task = document.createElement("div");
    task.className = "sns-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 这样做<b>对</b>还是<b>不对</b>？`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "sns-card";
    card.id = "sns-card";
    card.innerHTML = `<div class="sns-pic">${it.pic}</div><div class="sns-text">${it.text}</div>`;
    wrap.appendChild(card);

    const judge = document.createElement("div");
    judge.className = "sns-judge";
    const good = document.createElement("button");
    good.type = "button";
    good.className = "sns-btn sns-btn--good";
    good.innerHTML = `<span class="sns-btn__icon">✅</span><span>对</span>`;
    good.addEventListener("click", () => this.judge(true, good));
    const bad = document.createElement("button");
    bad.type = "button";
    bad.className = "sns-btn sns-btn--bad";
    bad.innerHTML = `<span class="sns-btn__icon">❌</span><span>不对</span>`;
    bad.addEventListener("click", () => this.judge(false, bad));
    judge.appendChild(good);
    judge.appendChild(bad);
    wrap.appendChild(judge);
    this.root.appendChild(wrap);
  }

  private judge(answer: boolean, btn: HTMLButtonElement): void {
    if (this.locked || !this.current) return;
    const correct = answer === this.current.good;
    if (correct) {
      this.locked = true;
      sfxPop();
      btn.classList.add("sns-btn--done");
      const card = this.root.querySelector("#sns-card");
      card?.classList.add(
        this.current.good ? "sns-card--good" : "sns-card--bad",
      );
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
      }, 1100);
    } else {
      btn.classList.add("sns-btn--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("sns-btn--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "☀️",
      variant: "rest",
      body: "夏天要<b>戴帽、涂防晒、多喝水、找阴凉</b>，不在大太阳下猛跑～",
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
    if (document.getElementById("sns-style")) return;
    const st = document.createElement("style");
    st.id = "sns-style";
    st.textContent = SNS_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function SNS_CSS(theme: string): string {
  return `
.sns-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.sns-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.6;}
.sns-task b{color:${theme};}
.sns-card{background:linear-gradient(180deg,#fff7e6,#ffe3b3);padding:26px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;transition:background .3s;}
.sns-card--good{background:linear-gradient(180deg,#d4f4dd,#b6e9c4);}
.sns-card--bad{background:linear-gradient(180deg,#ffe0e0,#ffcaca);}
.sns-pic{font-size:3.4rem;letter-spacing:4px;}
.sns-text{font-size:1.15rem;font-weight:800;color:#5a3a1a;margin-top:10px;}
.sns-judge{display:flex;gap:18px;justify-content:center;}
.sns-btn{display:flex;flex-direction:column;align-items:center;gap:4px;width:140px;padding:18px 12px;border-radius:22px;border:none;cursor:pointer;font-size:1.1rem;font-weight:900;color:#fff;box-shadow:var(--shadow);transition:transform .12s;}
.sns-btn:active{transform:scale(.95);}
.sns-btn--good{background:linear-gradient(180deg,#6bcf7f,#43a047);}
.sns-btn--bad{background:linear-gradient(180deg,#ff8a80,#e53935);}
.sns-btn__icon{font-size:1.8rem;}
.sns-btn--done{outline:4px solid #ffd93d;}
.sns-btn--wrong{animation:sns-shake .4s ease;}
@keyframes sns-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): SunSafetyGame {
  return new SunSafetyGame();
}
