/* 跳数 Skip Count —— 给出跳数序列（2/5/10/3 的倍数），缺一个，孩子从选项里选。
   独特点：跳数是乘法与数感的基础，难度=跳数间隔 + 数值范围 + 选项数。
   视觉：每格一颗荷叶，数字青蛙踩着跳；问号荷叶闪烁。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

interface SkipSpec {
  step: number;
  start: number;
  count: number;
}

export class SkipCountGame extends BaseGame {
  constructor() {
    super("skip-count");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private makeSpec(): SkipSpec {
    if (this.difficulty === "easy") {
      // 2 的跳数，最大到 20
      const start = randInt(2, 2);
      return { step: 2, start, count: 5 };
    }
    if (this.difficulty === "medium") {
      // 5 的跳数到 50
      return { step: 5, start: randInt(5, 5), count: 5 };
    }
    // hard：10 的跳数到 100 或 3 的跳数
    const kind = Math.random() < 0.5 ? 10 : 3;
    if (kind === 10) return { step: 10, start: randInt(10, 10), count: 5 };
    return { step: 3, start: randInt(3, 3), count: 5 };
  }

  private makeDistractors(answer: number, step: number): number[] {
    const set = new Set<number>();
    const variants = [
      answer + step,
      answer - step,
      answer + 1,
      answer - 1,
      answer + step * 2,
    ];
    for (const v of variants) {
      if (v !== answer && v > 0) set.add(v);
      if (set.size >= 4) break;
    }
    while (set.size < 4) set.add(answer + randInt(4, 12));
    return shuffle([...set]);
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    const spec = this.makeSpec();
    const seq = Array.from(
      { length: spec.count },
      (_, i) => spec.start + i * spec.step,
    );
    const blankIdx = randInt(1, spec.count - 2);
    const answer = seq[blankIdx]!;
    const distractors = this.makeDistractors(answer, spec.step);
    const optionCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const options = shuffle([answer, ...distractors]).slice(0, optionCount);

    const wrap = document.createElement("div");
    wrap.className = "skc-wrap";

    const task = document.createElement("div");
    task.className = "skc-task";
    task.innerHTML = `数一数，<b>问号</b>处是几？（一次跳 <b>${spec.step}</b> 个）`;
    wrap.appendChild(task);

    const lilies = document.createElement("div");
    lilies.className = "skc-lilies";
    seq.forEach((v, i) => {
      const li = document.createElement("div");
      li.className = "skc-lily";
      if (i === blankIdx) {
        li.classList.add("skc-lily--blank");
        li.textContent = "?";
      } else {
        li.textContent = String(v);
      }
      lilies.appendChild(li);
    });
    wrap.appendChild(lilies);

    const opts = document.createElement("div");
    opts.className = "skc-opts";
    options.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "skc-opt";
      b.textContent = String(o);
      b.addEventListener("click", () =>
        this.choose(o, answer, b, lilies, blankIdx),
      );
      opts.appendChild(b);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(
    o: number,
    answer: number,
    btn: HTMLButtonElement,
    lilies: HTMLElement,
    blankIdx: number,
  ): void {
    if (this.locked) return;
    if (o === answer) {
      this.locked = true;
      btn.classList.add("skc-opt--correct");
      sfxPop();
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      const blank = lilies.children[blankIdx];
      if (blank) {
        blank.textContent = String(answer);
        blank.classList.remove("skc-lily--blank");
        blank.classList.add("skc-lily--reveal");
      }
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("skc-opt--wrong");
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
        return;
      }
      this.trackTimeout(() => {
        btn.classList.remove("skc-opt--wrong");
        btn.disabled = true;
      }, 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "一次跳几个，慢慢数～",
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
    if (document.getElementById("skc-style")) return;
    const st = document.createElement("style");
    st.id = "skc-style";
    st.textContent = SKC_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SKC_CSS(theme: string): string {
  return `
.skc-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;}
.skc-task{font-size:1.2rem;font-weight:800;text-align:center;}
.skc-task b{color:${theme};}
.skc-lilies{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:100%;}
.skc-lily{width:58px;height:58px;border-radius:50% 50% 48% 48%;background:linear-gradient(160deg,#6bcf7f,#3da858);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:900;box-shadow:0 5px 0 #2e8a44,var(--shadow);text-shadow:0 1px 2px rgba(0,0,0,.25);position:relative;}
.skc-lily::after{content:'';position:absolute;top:5px;left:8px;right:22px;height:10px;background:rgba(255,255,255,.4);border-radius:50%;filter:blur(1px);}
.skc-lily--blank{background:linear-gradient(160deg,#fff,#e6e6e6);color:${theme};box-shadow:0 5px 0 #c9c4d0,var(--shadow);text-shadow:none;animation:skc-blink 1.1s ease-in-out infinite;}
.skc-lily--reveal{animation:skc-pop .4s ease;}
@keyframes skc-blink{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
@keyframes skc-pop{0%{transform:scale(.7)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
.skc-opts{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;}
.skc-opt{min-width:64px;min-height:60px;font-size:1.6rem;font-weight:900;border-radius:16px;background:#fff;color:#3a2e4a;box-shadow:0 5px 0 #c9c4d0,var(--shadow);border:2px solid #eee;}
.skc-opt:active{transform:translateY(3px);box-shadow:0 2px 0 #c9c4d0,var(--shadow);}
.skc-opt--correct{background:linear-gradient(160deg,#6bcf7f,#3da858);color:#fff;border-color:#3da858;animation:skc-pop .4s ease;}
.skc-opt--wrong{background:#ff6348;color:#fff;border-color:#c4452f;animation:skc-shake .4s ease;}
@keyframes skc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media(max-width:380px){.skc-lily{width:48px;height:48px;font-size:1.05rem;}}
`;
}

export function create(): SkipCountGame {
  return new SkipCountGame();
}
