/* 多少比较 More Less —— 比较两组物品的数量，选多/少/一样多。
   独特点：数量比较（区别于 farm-math 的运算、size-sort 的大小）。
   巧思：两组物品可视化，问哪边多/少。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

const ITEMS = ["🍎", "🍌", "🍇", "🌸", "⭐"];

export class MoreLessGame extends BaseGame {
  constructor() {
    super("more-less");
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

  private range(): [number, number] {
    return this.difficulty === "easy"
      ? [1, 5]
      : this.difficulty === "medium"
        ? [2, 8]
        : [3, 10];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    const [minN, maxN] = this.range();
    const a = randInt(minN, maxN);
    let b = randInt(minN, maxN);
    // 偶尔让相等
    if (Math.random() < 0.25) b = a;
    const askMore = Math.random() < 0.5;
    let answer: "L" | "R" | "E";
    if (a > b) answer = askMore ? "L" : "R";
    else if (b > a) answer = askMore ? "R" : "L";
    else answer = "E";
    const itemL = sample(ITEMS);
    const itemR = sample(ITEMS);

    const wrap = document.createElement("div");
    wrap.className = "ml-wrap";
    const task = document.createElement("div");
    task.className = "ml-task";
    task.textContent = askMore ? "哪一边的水果更多？" : "哪一边的水果更少？";
    wrap.appendChild(task);

    const groups = document.createElement("div");
    groups.className = "ml-groups";
    const gL = document.createElement("button");
    gL.type = "button";
    gL.className = "ml-group";
    gL.innerHTML = `<div class="ml-items">${itemL.repeat(a)}</div>`;
    const gR = document.createElement("button");
    gR.type = "button";
    gR.className = "ml-group";
    gR.innerHTML = `<div class="ml-items">${itemR.repeat(b)}</div>`;
    const gE = document.createElement("button");
    gE.type = "button";
    gE.className = "ml-group";
    gE.innerHTML = `<div class="ml-items">⚖️</div>`;
    gL.addEventListener("click", () => this.choose("L", answer, gL));
    gR.addEventListener("click", () => this.choose("R", answer, gR));
    gE.addEventListener("click", () => this.choose("E", answer, gE));
    groups.appendChild(gL);
    groups.appendChild(gR);
    groups.appendChild(gE);
    wrap.appendChild(groups);
    this.root.appendChild(wrap);
    void shuffle;
  }

  private choose(c: string, answer: string, btn: HTMLButtonElement): void {
    if (c === answer) {
      sfxPop();
      btn.classList.add("ml-group--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("ml-group--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ml-group--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "数一数每边有几个～",
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
    if (document.getElementById("ml-style")) return;
    const st = document.createElement("style");
    st.id = "ml-style";
    st.textContent = ML_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function ML_CSS(_theme: string): string {
  return `
.ml-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(480px,100%);}
.ml-task{font-size:1.2rem;font-weight:800;}
.ml-groups{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.ml-group{min-width:120px;min-height:100px;padding:14px;border-radius:18px;background:#fff;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;}
.ml-group:active{transform:scale(.95);}
.ml-items{font-size:1.6rem;line-height:1.4;text-align:center;}
.ml-group--done{background:#d4f4dd;animation:ml-pop .4s ease;}
.ml-group--wrong{animation:ml-shake .4s ease;}
@keyframes ml-pop{0%{transform:scale(.8)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes ml-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): MoreLessGame {
  return new MoreLessGame();
}
