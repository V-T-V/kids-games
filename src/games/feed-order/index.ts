/* 喂养顺序 Feed Order —— 按提示的顺序依次点动物。
   独特点：顺序记忆——先展示一串动物顺序，孩子记住后按序点击（区别于普通配对）。
   巧思：每点对动物张嘴吃食，点错从头来；难度=序列长度。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

const ANIMALS = ["🐰", "🐱", "🐶", "🐭", "🐼", "🐷"] as const;

export class FeedOrderGame extends BaseGame {
  constructor() {
    super("feed-order");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private seq: string[] = [];
  private step = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private seqLen(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const len = this.seqLen();
    const pool = shuffle(ANIMALS).slice(0, Math.min(len + 1, ANIMALS.length));
    this.seq = Array.from({ length: len }, () => sample(pool));
    this.step = 0;

    const wrap = document.createElement("div");
    wrap.className = "fo-wrap";
    const task = document.createElement("div");
    task.className = "fo-task";
    task.innerHTML = `记住动物出场的顺序！<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 先展示序列
    const show = document.createElement("div");
    show.className = "fo-show";
    show.id = "fo-show";
    wrap.appendChild(show);

    const animalArea = document.createElement("div");
    animalArea.className = "fo-animals";
    animalArea.id = "fo-animals";
    animalArea.style.opacity = "0.3";
    pool.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fo-animal";
      b.textContent = a;
      b.addEventListener("click", () => this.click(a, b));
      animalArea.appendChild(b);
    });
    wrap.appendChild(animalArea);
    this.root.appendChild(wrap);

    // 逐个展示序列
    this.seq.forEach((a, i) => {
      this.trackTimeout(
        () => {
          show.textContent = a;
          sfxPop();
          if (i === this.seq.length - 1) {
            this.trackTimeout(() => {
              show.textContent = "该你啦！按顺序点～";
              animalArea.style.opacity = "1";
            }, 700);
          }
        },
        i * 800 + 400,
      );
    });
  }

  private click(a: string, btn: HTMLButtonElement): void {
    if (this.step >= this.seq.length) return;
    const expected = this.seq[this.step]!;
    if (a === expected) {
      btn.classList.add("fo-animal--eat");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.step += 1;
      const show = this.root.querySelector("#fo-show")!;
      show.textContent = `✅ ${this.step}/${this.seq.length}`;
      this.trackTimeout(() => btn.classList.remove("fo-animal--eat"), 400);
      if (this.step >= this.seq.length) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1000);
      }
    } else {
      this.step = 0;
      btn.classList.add("fo-animal--shake");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("fo-animal--shake"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "顺序记错了，从头开始～",
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
    if (document.getElementById("fo-style")) return;
    const st = document.createElement("style");
    st.id = "fo-style";
    st.textContent = FO_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function FO_CSS(_theme: string): string {
  return `
.fo-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(440px,100%);}
.fo-task{font-size:1.2rem;font-weight:800;text-align:center;}
.fo-show{font-size:3.5rem;min-height:80px;display:flex;align-items:center;justify-content:center;background:#fff;padding:10px 30px;border-radius:20px;box-shadow:var(--shadow);}
.fo-animals{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;transition:opacity .3s;}
.fo-animal{width:72px;height:72px;font-size:2.6rem;border-radius:18px;background:#fff;box-shadow:var(--shadow);}
.fo-animal:active{transform:scale(.92);}
.fo-animal--eat{animation:fo-eat .4s ease;}
.fo-animal--shake{animation:fo-shake .4s ease;}
@keyframes fo-eat{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}
@keyframes fo-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): FeedOrderGame {
  return new FeedOrderGame();
}
