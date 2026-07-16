/* 小农场算术 Farm Math —— 数动物做加减法。
   巧思：动物分两组可视化，点答案后动物欢呼。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

const ANIMALS = ["🐔", "🐰", "🐑", "🐄", "🦆"] as const;
const OP_EMOJI = { add: "➕", sub: "➖" } as const;

export class FarmMathGame extends BaseGame {
  constructor() {
    super("farm-math");
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
    if (this.difficulty === "easy") return [1, 5];
    if (this.difficulty === "medium") return [2, 8];
    return [3, 10];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    const animal = sample(ANIMALS);
    const [minN, maxN] = this.range();
    const op: "add" | "sub" =
      this.difficulty === "easy" ? "add" : Math.random() < 0.5 ? "add" : "sub";
    let a = randInt(minN, maxN);
    let b = randInt(minN, maxN);
    if (op === "sub" && b > a) [a, b] = [b, a]; // 保证不为负
    const answer = op === "add" ? a + b : a - b;

    // 选项
    const choices = new Set<number>([answer]);
    while (choices.size < 4) {
      const delta = randInt(-3, 3);
      const c = answer + delta;
      if (c >= 0 && c !== answer) choices.add(c);
    }

    const wrap = document.createElement("div");
    wrap.className = "fm-wrap";
    const task = document.createElement("div");
    task.className = "fm-task";
    task.innerHTML = `${animal.repeat(a)} <span class="fm-op">${OP_EMOJI[op]}</span> ${animal.repeat(b)} <span class="fm-eq">= ?</span><br><span class="fm-hint">数一数一共几只 ${animal}</span>`;
    wrap.appendChild(task);

    const opts = document.createElement("div");
    opts.className = "fm-opts";
    shuffle([...choices]).forEach((c) => {
      const b2 = document.createElement("button");
      b2.type = "button";
      b2.className = "fm-choice";
      b2.textContent = String(c);
      b2.addEventListener("click", () => this.choose(c, answer, b2, animal));
      opts.appendChild(b2);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(
    c: number,
    answer: number,
    btn: HTMLButtonElement,
    animal: string,
  ): void {
    if (c === answer) {
      sfxPop();
      btn.classList.add("fm-choice--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      // 庆祝：显示答案数量的小动物
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("fm-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("fm-choice--wrong"), 400);
      if (paused) this.showRest();
    }
    void animal;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "一只一只数，别着急～",
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
    if (document.getElementById("fm-style")) return;
    const st = document.createElement("style");
    st.id = "fm-style";
    st.textContent = FM_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function FM_CSS(theme: string): string {
  return `
.fm-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(460px,100%);}
.fm-task{text-align:center;font-size:1.8rem;line-height:1.6;word-break:break-all;background:#fff;padding:16px 20px;border-radius:18px;box-shadow:var(--shadow);}
.fm-op{font-size:1.2rem;color:${theme};margin:0 8px;}
.fm-eq{font-size:1.4rem;color:var(--ink-soft);}
.fm-hint{font-size:.95rem;color:var(--ink-soft);font-weight:600;}
.fm-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.fm-choice{min-width:72px;height:72px;font-size:1.8rem;font-weight:800;border-radius:18px;background:#fff;box-shadow:var(--shadow);}
.fm-choice:active{transform:scale(.92);}
.fm-choice--done{background:#d4f4dd;animation:fm-pop .4s ease;}
.fm-choice--wrong{animation:fm-shake .4s ease;}
@keyframes fm-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes fm-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): FarmMathGame {
  return new FarmMathGame();
}
