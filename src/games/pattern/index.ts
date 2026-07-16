/* 找规律 Pattern —— 找出重复序列的下一个。
   巧思：序列在"小火车"上展示，答对车厢闪烁。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";
import { genSequence, nextOf } from "./pattern.ts";

const POOL = ["🍎", "🍌", "🍇", "🐶", "🐱", "⭐", "🌸", "🚗"] as const;

export class PatternGame extends BaseGame {
  constructor() {
    super("pattern");
  }

  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    const period =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 3;
    const len =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 8;
    const seq = genSequence(len, period, POOL);
    const answer = nextOf(seq, period);

    // 选项：答案 + 3 个干扰
    const distract: string[] = [];
    while (distract.length < 3) {
      const c = sample(POOL);
      if (c !== answer && !distract.includes(c)) distract.push(c);
    }
    const choices = shuffle([answer, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "pt-wrap";
    const task = document.createElement("div");
    task.className = "pt-task";
    task.textContent = `小火车的下一节该装什么？（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 小火车车厢
    const train = document.createElement("div");
    train.className = "pt-train";
    const head = document.createElement("div");
    head.className = "pt-car pt-car--head";
    head.textContent = "🚂";
    train.appendChild(head);
    seq.forEach((s) => {
      const car = document.createElement("div");
      car.className = "pt-car";
      car.textContent = s;
      train.appendChild(car);
    });
    const q = document.createElement("div");
    q.className = "pt-car pt-car--q";
    q.textContent = "？";
    train.appendChild(q);
    wrap.appendChild(train);

    // 选项
    const opts = document.createElement("div");
    opts.className = "pt-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pt-choice";
      b.textContent = c;
      b.addEventListener("click", () => this.choose(c, answer, q, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(
    c: string,
    answer: string,
    q: HTMLElement,
    btn: HTMLButtonElement,
  ): void {
    if (c === answer) {
      q.textContent = answer;
      q.classList.add("pt-car--done");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("pt-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("pt-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "找找哪样东西在重复出现～",
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
    if (document.getElementById("pt-style")) return;
    const st = document.createElement("style");
    st.id = "pt-style";
    st.textContent = PT_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function PT_CSS(theme: string): string {
  return `
.pt-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(560px,100%);}
.pt-task{font-size:1.15rem;font-weight:800;text-align:center;}
.pt-train{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:center;padding:8px;}
.pt-car{width:58px;height:64px;background:#fff;border-radius:10px 10px 4px 4px;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;font-size:1.8rem;position:relative;animation:pt-roll .8s ease;}
.pt-car::after{content:'';position:absolute;bottom:-6px;left:8px;right:8px;height:6px;background:${theme};border-radius:6px;}
.pt-car--head{background:${theme};animation:none;}
.pt-car--q{background:#fff3c4;font-size:2rem;font-weight:800;color:${theme};}
.pt-car--done{background:#d4f4dd;animation:pt-pop .4s ease;}
.pt-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.pt-choice{width:72px;height:72px;font-size:2.2rem;border-radius:18px;background:#fff;box-shadow:var(--shadow);}
.pt-choice:active{transform:scale(.92);}
.pt-choice--wrong{animation:pt-shake .4s ease;}
@keyframes pt-roll{0%{transform:translateX(-20px);opacity:0}100%{transform:translateX(0);opacity:1}}
@keyframes pt-pop{0%{transform:scale(.6)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
@keyframes pt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): PatternGame {
  return new PatternGame();
}
