/* 奇偶分类 Odd Even —— 屏幕显示一个数字，孩子判断是"单数"还是"双数"。
   独特点：用配对小球的视觉辅助说明"双数能两两配对、单数剩一个"，
   让抽象的奇偶概念具象化。难度=数字范围 + 是否显示配对辅助。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

export class OddEvenGame extends BaseGame {
  constructor() {
    super("odd-even");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private numRange(): [number, number] {
    if (this.difficulty === "easy") return [1, 10];
    if (this.difficulty === "medium") return [1, 15];
    return [1, 20];
  }

  /** easy/medium 显示配对小球辅助，hard 不显示（纯心算）。 */
  private showPairs(): boolean {
    return this.difficulty !== "hard";
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    const [minN, maxN] = this.numRange();
    const num = randInt(minN, maxN);
    const isOdd = num % 2 === 1;

    const wrap = document.createElement("div");
    wrap.className = "ode-wrap";

    const task = document.createElement("div");
    task.className = "ode-task";
    task.innerHTML = `<span class="ode-num">${num}</span> 是单数还是双数？`;
    wrap.appendChild(task);

    if (this.showPairs()) {
      const pairs = document.createElement("div");
      pairs.className = "ode-pairs";
      pairs.setAttribute("aria-label", `${num} 个小球`);
      // 两两一行配对，剩一个单独
      const pairCount = Math.floor(num / 2);
      const leftover = num % 2;
      for (let i = 0; i < pairCount; i++) {
        const row = document.createElement("div");
        row.className = "ode-pair";
        row.innerHTML = `<span>🔵</span><span>🔵</span>`;
        pairs.appendChild(row);
      }
      if (leftover === 1) {
        const single = document.createElement("div");
        single.className = "ode-pair ode-pair--single";
        single.innerHTML = `<span>🔴</span>`;
        pairs.appendChild(single);
      }
      wrap.appendChild(pairs);
    } else {
      // hard：放一个提示占位，保持布局节奏
      const hint = document.createElement("div");
      hint.className = "ode-hint";
      hint.textContent = "在心里两个两个数～";
      wrap.appendChild(hint);
    }

    const actions = document.createElement("div");
    actions.className = "ode-actions";
    const oddBtn = document.createElement("button");
    oddBtn.type = "button";
    oddBtn.className = "ode-btn ode-btn--odd";
    oddBtn.innerHTML = `<span class="ode-btn__emoji">☝️</span><span>单数</span>`;
    const evenBtn = document.createElement("button");
    evenBtn.type = "button";
    evenBtn.className = "ode-btn ode-btn--even";
    evenBtn.innerHTML = `<span class="ode-btn__emoji">✌️</span><span>双数</span>`;
    oddBtn.addEventListener("click", () => this.choose(true, isOdd, oddBtn, evenBtn));
    evenBtn.addEventListener("click", () => this.choose(false, isOdd, oddBtn, evenBtn));
    actions.appendChild(oddBtn);
    actions.appendChild(evenBtn);
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
  }

  private choose(
    pickedOdd: boolean,
    isOdd: boolean,
    oddBtn: HTMLButtonElement,
    evenBtn: HTMLButtonElement,
  ): void {
    if (this.locked) return;
    const correct = pickedOdd === isOdd;
    const btn = pickedOdd ? oddBtn : evenBtn;
    if (correct) {
      this.locked = true;
      btn.classList.add("ode-btn--correct");
      sfxPop();
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("ode-btn--wrong");
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
        return;
      }
      this.trackTimeout(() => {
        btn.classList.remove("ode-btn--wrong");
      }, 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "两个两个数，剩下一个就是单数～",
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
    if (document.getElementById("ode-style")) return;
    const st = document.createElement("style");
    st.id = "ode-style";
    st.textContent = ODE_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function ODE_CSS(theme: string): string {
  return `
.ode-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(440px,100%);}
.ode-task{font-size:1.25rem;font-weight:800;text-align:center;}
.ode-num{display:inline-block;color:${theme};font-size:1.7em;font-weight:900;animation:ode-pop .4s ease;}
@keyframes ode-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
.ode-pairs{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;min-height:40px;font-size:1.4rem;line-height:1;}
.ode-pair{display:flex;gap:4px;background:#f4f8ff;padding:6px 8px;border-radius:10px;box-shadow:var(--shadow);}
.ode-pair--single{background:#fff0f0;animation:ode-wiggle .8s ease-in-out infinite;}
@keyframes ode-wiggle{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
.ode-hint{font-size:1rem;color:#8a7da8;font-weight:700;}
.ode-actions{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;}
.ode-btn{min-width:120px;min-height:88px;font-size:1.4rem;font-weight:900;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#fff;box-shadow:0 6px 0 rgba(0,0,0,.18),var(--shadow);}
.ode-btn__emoji{font-size:2rem;}
.ode-btn--odd{background:linear-gradient(160deg,#ff9f43,#e67e22);}
.ode-btn--even{background:linear-gradient(160deg,#4d96ff,#2d6fcf);}
.ode-btn:active{transform:translateY(3px);box-shadow:0 3px 0 rgba(0,0,0,.18),var(--shadow);}
.ode-btn--correct{background:linear-gradient(160deg,#6bcf7f,#3da858);animation:ode-bounce .4s ease;}
.ode-btn--wrong{background:linear-gradient(160deg,#ff6348,#c4452f);animation:ode-shake .4s ease;}
@keyframes ode-bounce{0%{transform:scale(.8)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes ode-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media(max-width:380px){.ode-btn{min-width:100px;min-height:76px;font-size:1.2rem;}.ode-btn__emoji{font-size:1.6rem;}}
`;
}

export function create(): OddEvenGame {
  return new OddEvenGame();
}
