/* 填缺失数 Missing Number —— 一串连续整数缺一个，孩子从选项里选缺失的数。
   独特点：连续数序认知（区别于 number-sequence 的等差/平方规律、skip-count 的跳数）。
   视觉：数字排在彩色小火车车厢上，缺的那节是闪烁的问号车厢。难度=范围 + 序列长度。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

const CAR_COLORS = [
  "#ff8fb1",
  "#ffd93d",
  "#6bcf7f",
  "#4d96ff",
  "#a55eea",
  "#ff9f43",
  "#22d3ee",
];

export class MissingNumberGame extends BaseGame {
  constructor() {
    super("missing-number");
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
    /* DOM 清空 */
  }

  /** 返回序列起点和长度。 */
  private seqSpec(): { start: number; len: number; max: number } {
    if (this.difficulty === "easy") return { start: randInt(1, 3), len: 4, max: 5 };
    if (this.difficulty === "medium") return { start: randInt(1, 8), len: 5, max: 12 };
    return { start: randInt(1, 12), len: 6, max: 20 };
  }

  private makeDistractors(answer: number, n: number): number[] {
    const set = new Set<number>([answer]);
    const out: number[] = [];
    const near =
      this.difficulty === "hard" ? 2 : this.difficulty === "medium" ? 2 : 3;
    const variants = [
      answer + 1,
      answer - 1,
      answer + near,
      answer - near,
      answer + 2,
      answer - 2,
    ];
    for (const v of variants) {
      if (v !== answer && v > 0 && !set.has(v)) {
        set.add(v);
        out.push(v);
      }
      if (out.length >= n) break;
    }
    let guard = 0;
    while (out.length < n && guard < 40) {
      guard += 1;
      const v = answer + randInt(-5, 5);
      if (v > 0 && v !== answer && !set.has(v)) {
        set.add(v);
        out.push(v);
      }
    }
    return shuffle(out);
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    const { start, len, max } = this.seqSpec();
    // 序列起点要保证不越界
    const safeStart = Math.min(start, Math.max(1, max - len + 1));
    const seq = Array.from({ length: len }, (_, i) => safeStart + i);
    const blankIdx = randInt(1, len - 2);
    const answer = seq[blankIdx]!;
    const optionCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const distractors = this.makeDistractors(answer, optionCount - 1);
    const options = shuffle([answer, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "msn-wrap";

    const task = document.createElement("div");
    task.className = "msn-task";
    task.innerHTML = `数字宝宝排队，<b>问号</b>该是几？`;
    wrap.appendChild(task);

    const train = document.createElement("div");
    train.className = "msn-train";
    // 火车头
    const head = document.createElement("div");
    head.className = "msn-head";
    head.textContent = "🚂";
    train.appendChild(head);
    seq.forEach((v, i) => {
      const car = document.createElement("div");
      car.className = "msn-car";
      const color = CAR_COLORS[i % CAR_COLORS.length]!;
      car.style.setProperty("--c", color);
      if (i === blankIdx) {
        car.classList.add("msn-car--blank");
        car.textContent = "?";
      } else {
        car.textContent = String(v);
      }
      train.appendChild(car);
    });
    wrap.appendChild(train);

    const opts = document.createElement("div");
    opts.className = "msn-opts";
    options.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "msn-opt";
      b.textContent = String(o);
      b.addEventListener("click", () => this.choose(o, answer, b, train, blankIdx));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(
    o: number,
    answer: number,
    btn: HTMLButtonElement,
    train: HTMLElement,
    blankIdx: number,
  ): void {
    if (this.locked) return;
    if (o === answer) {
      this.locked = true;
      btn.classList.add("msn-opt--correct");
      sfxPop();
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      // 揭示问号车厢（注意 train 第一个子元素是火车头，车厢从 index 1 开始）
      const blank = train.children[blankIdx + 1];
      if (blank) {
        blank.textContent = String(answer);
        blank.classList.remove("msn-car--blank");
        blank.classList.add("msn-car--reveal");
      }
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("msn-opt--wrong");
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
        return;
      }
      this.trackTimeout(() => {
        btn.classList.remove("msn-opt--wrong");
        btn.disabled = true;
      }, 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "一个一个数过去，看看中间漏了谁～",
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
    if (document.getElementById("msn-style")) return;
    const st = document.createElement("style");
    st.id = "msn-style";
    st.textContent = MSN_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function MSN_CSS(theme: string): string {
  return `
.msn-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;}
.msn-task{font-size:1.2rem;font-weight:800;text-align:center;}
.msn-task b{color:${theme};}
.msn-train{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:6px;max-width:100%;}
.msn-head{font-size:2rem;line-height:1;align-self:center;}
.msn-car{width:54px;height:64px;border-radius:12px 12px 8px 8px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:900;color:#fff;background:linear-gradient(160deg,var(--c,#4d96ff),color-mix(in srgb,var(--c,#4d96ff) 60%,#000));box-shadow:0 5px 0 color-mix(in srgb,var(--c,#4d96ff) 55%,#000),var(--shadow);text-shadow:0 1px 2px rgba(0,0,0,.25);position:relative;}
.msn-car::after{content:'';position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:36px;height:6px;background:#444;border-radius:3px;}
.msn-car--blank{background:linear-gradient(160deg,#fff,#e6e6e6);color:${theme};text-shadow:none;box-shadow:0 5px 0 #c9c4d0,var(--shadow);animation:msn-blink 1.1s ease-in-out infinite;}
.msn-car--reveal{animation:msn-pop .4s ease;}
@keyframes msn-blink{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
@keyframes msn-pop{0%{transform:scale(.7)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
.msn-opts{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;}
.msn-opt{min-width:64px;min-height:60px;font-size:1.6rem;font-weight:900;border-radius:16px;background:#fff;color:#3a2e4a;box-shadow:0 5px 0 #c9c4d0,var(--shadow);border:2px solid #eee;}
.msn-opt:active{transform:translateY(3px);box-shadow:0 2px 0 #c9c4d0,var(--shadow);}
.msn-opt--correct{background:linear-gradient(160deg,#6bcf7f,#3da858);color:#fff;border-color:#3da858;animation:msn-pop .4s ease;}
.msn-opt--wrong{background:#ff6348;color:#fff;border-color:#c4452f;animation:msn-shake .4s ease;}
@keyframes msn-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media(max-width:380px){.msn-car{width:44px;height:54px;font-size:1.2rem;}.msn-head{font-size:1.6rem;}}
`;
}

export function create(): MissingNumberGame {
  return new MissingNumberGame();
}
