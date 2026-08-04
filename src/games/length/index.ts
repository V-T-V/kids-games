/* 比长短 Length —— 比较两条线/物品的长短，选最长或最短。
   独特点：长度比较（区别于 size-sort 的整体大小、weight 的轻重）。
   巧思：彩色条状物，问最长/最短，答对条状物"立正"。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

export class LengthGame extends BaseGame {
  constructor() {
    super("length");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  /** 本关是否已答对，防止连点正确项跳关。 */
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

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.answered = false; // 重置本关答题锁
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = this.count();
    const lengths = shuffle([40, 60, 80, 100, 120]).slice(0, n);
    const maxL = Math.max(...lengths);
    const minL = Math.min(...lengths);
    const askLong = Math.random() < 0.5;
    const answer = askLong ? maxL : minL;

    const wrap = document.createElement("div");
    wrap.className = "ln-wrap";
    const task = document.createElement("div");
    task.className = "ln-task";
    task.textContent = askLong ? "点最长的那条～" : "点最短的那条～";
    wrap.appendChild(task);

    const bars = document.createElement("div");
    bars.className = "ln-bars";
    shuffle(lengths).forEach((len) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ln-bar";
      b.style.width = `${len}px`;
      b.style.background = `linear-gradient(90deg, hsl(${randInt(0, 360)},70%,60%), hsl(${randInt(0, 360)},70%,60%))`;
      b.addEventListener("click", () => this.choose(len, answer, b));
      bars.appendChild(b);
    });
    wrap.appendChild(bars);
    this.root.appendChild(wrap);
    void sample;
  }

  private choose(len: number, answer: number, btn: HTMLButtonElement): void {
    if (this.answered) return; // 本关已答对，防连点跳关
    if (len === answer) {
      this.answered = true;
      sfxPop();
      btn.classList.add("ln-bar--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 900);
    } else {
      btn.classList.add("ln-bar--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ln-bar--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "比一比哪条更长/更短～",
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
    if (document.getElementById("ln-style")) return;
    const st = document.createElement("style");
    st.id = "ln-style";
    st.textContent = LN_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function LN_CSS(_theme: string): string {
  return `
.ln-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(440px,100%);}
.ln-task{font-size:1.3rem;font-weight:800;}
.ln-bars{display:flex;flex-direction:column;gap:18px;align-items:flex-start;}
.ln-bar{height:40px;border-radius:20px;border:none;box-shadow:var(--shadow);}
.ln-bar:active{transform:scale(.97);}
.ln-bar--done{outline:4px solid #fff;outline-offset:3px;animation:ln-pop .4s ease;}
.ln-bar--wrong{animation:ln-shake .4s ease;}
@keyframes ln-pop{0%{transform:scaleX(.8)}60%{transform:scaleX(1.1)}100%{transform:scaleX(1)}}
@keyframes ln-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): LengthGame {
  return new LengthGame();
}
