/* 数字序列 Number Sequence —— 给一串有规律的数列，从选项中选缺失的数。
   独特点：数列在彩色渐变卡片上排列，问号卡片闪烁脉动；多类规律（等差/等比/斐波那契/平方）。
   视觉：卡片堆叠错落、问号闪烁、答对卡片翻转亮起、答错抖动。
   难度=规律复杂度（easy 等差+1 / medium 等差任意步或斐波那契 / hard 平方或交替）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle, randInt } from "../../lobby/util.ts";
import { starsByAccuracy } from "../../core/scoring.ts";

type Pattern = {
  /** 生成长度 n 的序列，第 blankIdx 位置是要猜的数（已剔除） */
  seq: number[];
  blankIdx: number;
  /** 干扰选项 */
  distractors: number[];
};

const CARD_COLORS = [
  "#ff8fb1",
  "#ffd93d",
  "#6bcf7f",
  "#4d96ff",
  "#a55eea",
  "#ff9f43",
  "#22d3ee",
];

export class NumberSequenceGame extends BaseGame {
  constructor() {
    super("number-sequence");
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
    /* 无定时器/动画需手动清理 */
  }

  private genPattern(): Pattern {
    const diff = this.difficulty;
    if (diff === "easy") {
      // 等差 +1 或 +2，5 项
      const step = randInt(1, 2);
      const start = randInt(1, 4);
      const seq = Array.from({ length: 5 }, (_, i) => start + i * step);
      const blankIdx = randInt(1, 3);
      const answer = seq[blankIdx]!;
      return { seq, blankIdx, distractors: this.makeDistractors(answer, step) };
    }
    if (diff === "medium") {
      const kind = Math.random();
      if (kind < 0.5) {
        // 等差任意步 2-5
        const step = randInt(2, 5);
        const start = randInt(1, 5);
        const seq = Array.from({ length: 5 }, (_, i) => start + i * step);
        const blankIdx = randInt(1, 3);
        const answer = seq[blankIdx]!;
        return {
          seq,
          blankIdx,
          distractors: this.makeDistractors(answer, step),
        };
      }
      // 斐波那契式：a, b, a+b, ...
      const a = randInt(1, 3);
      const b = randInt(2, 4);
      const seq = [a, b, a + b, a + b * 2, a * 2 + b * 3].slice(0, 5);
      // 修正为真正的斐波那契
      seq[2] = seq[0]! + seq[1]!;
      seq[3] = seq[1]! + seq[2]!;
      seq[4] = seq[2]! + seq[3]!;
      const blankIdx = randInt(2, 4);
      const answer = seq[blankIdx]!;
      return {
        seq,
        blankIdx,
        distractors: this.makeDistractors(
          answer,
          Math.max(1, Math.floor(answer / 3)),
        ),
      };
    }
    // hard：平方数列 或 交替
    const kind = Math.random();
    if (kind < 0.5) {
      const seq = [1, 4, 9, 16, 25];
      const blankIdx = randInt(1, 4);
      const answer = seq[blankIdx]!;
      return { seq, blankIdx, distractors: this.makeDistractors(answer, 3) };
    }
    // 交替加减：2,5,3,6,4,7...（奇数位 +1 序列，偶数位 = 前一 +3）
    const start = randInt(1, 3);
    const seq = [start, start + 3, start + 1, start + 4, start + 2, start + 5];
    const blankIdx = randInt(2, 5);
    const answer = seq[blankIdx]!;
    return {
      seq: seq.slice(0, 6),
      blankIdx,
      distractors: this.makeDistractors(answer, 2),
    };
  }

  private makeDistractors(answer: number, step: number): number[] {
    const set = new Set<number>();
    const variants = [
      answer + step,
      answer - step,
      answer + 1,
      answer - 1,
      answer + step * 2,
      answer + 2,
    ];
    for (const v of variants) {
      if (v !== answer && v > 0) set.add(v);
      if (set.size >= 3) break;
    }
    while (set.size < 3) set.add(answer + randInt(3, 9));
    return shuffle([...set]);
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    const p = this.genPattern();
    const answer = p.seq[p.blankIdx]!;
    const options = shuffle([answer, ...p.distractors]);

    const wrap = document.createElement("div");
    wrap.className = "ns-wrap";

    const task = document.createElement("div");
    task.className = "ns-task";
    task.innerHTML = `找规律，<b>问号</b>处该填什么数字？`;
    wrap.appendChild(task);

    const progress = document.createElement("div");
    progress.className = "ns-progress";
    progress.innerHTML = `答对 <b>${this.roundsDone}</b> / ${this.roundTotal} 题`;
    wrap.appendChild(progress);

    const row = document.createElement("div");
    row.className = "ns-row";
    p.seq.forEach((v, i) => {
      const card = document.createElement("div");
      card.className = "ns-card";
      const color = CARD_COLORS[i % CARD_COLORS.length]!;
      card.style.setProperty("--c", color);
      if (i === p.blankIdx) {
        card.classList.add("ns-card--blank");
        card.textContent = "?";
      } else {
        card.textContent = String(v);
      }
      row.appendChild(card);
    });
    wrap.appendChild(row);

    const opts = document.createElement("div");
    opts.className = "ns-opts";
    options.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ns-opt";
      b.textContent = String(o);
      b.addEventListener("click", () =>
        this.choose(o, answer, b, p.blankIdx, row),
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
    blankIdx: number,
    row: HTMLElement,
  ): void {
    if (this.locked) return;
    this.locked = true;
    if (o === answer) {
      btn.classList.add("ns-opt--correct");
      sfxPop();
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      // 揭示问号
      const cards = row.children;
      const blank = cards[blankIdx];
      if (blank) {
        blank.textContent = String(answer);
        blank.classList.remove("ns-card--blank");
        blank.classList.add("ns-card--reveal");
      }
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("ns-opt--wrong");
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
        return;
      }
      // 允许重选
      this.trackTimeout(() => {
        btn.classList.remove("ns-opt--wrong");
        btn.disabled = true;
        this.locked = false;
      }, 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "数一数卡片上的数字差～",
      primary: {
        text: "继续",
        icon: "🎈",
        onClick: () => {
          ov.destroy();
          this.startRound();
        },
      },
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
    if (document.getElementById("ns-style")) return;
    const st = document.createElement("style");
    st.id = "ns-style";
    st.textContent = NS_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function NS_CSS(theme: string): string {
  return `
.ns-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:100%;}
.ns-task{font-size:1.25rem;font-weight:800;text-align:center;}
.ns-task b{color:${theme};}
.ns-progress{font-size:1.05rem;font-weight:700;}
.ns-progress b{color:${theme};}
.ns-row{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;max-width:100%;}
.ns-card{width:62px;height:80px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.9rem;font-weight:900;color:#fff;background:linear-gradient(160deg,var(--c,#4d96ff),color-mix(in srgb,var(--c,#4d96ff) 60%,#000));box-shadow:0 6px 0 color-mix(in srgb,var(--c,#4d96ff) 55%,#000),var(--shadow);text-shadow:0 2px 3px rgba(0,0,0,.18);position:relative;overflow:hidden;}
.ns-card::after{content:'';position:absolute;top:6px;left:8px;right:30px;height:14px;background:rgba(255,255,255,.35);border-radius:50%;filter:blur(2px);}
.ns-card--blank{background:linear-gradient(160deg,#fff,#e0e0e0);color:${theme};box-shadow:0 6px 0 #c9c4d0,var(--shadow);text-shadow:none;animation:ns-blink 1.1s ease-in-out infinite;}
.ns-card--reveal{animation:ns-flip .5s ease;}
@keyframes ns-blink{0%,100%{transform:scale(1);box-shadow:0 6px 0 #c9c4d0,0 0 0 0 rgba(0,210,211,.5)}50%{transform:scale(1.08);box-shadow:0 6px 0 #c9c4d0,0 0 0 8px rgba(0,210,211,0)}}
@keyframes ns-flip{0%{transform:rotateY(0)}50%{transform:rotateY(90deg) scale(1.1)}100%{transform:rotateY(0)}}
.ns-opts{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;}
.ns-opt{min-width:72px;min-height:64px;font-size:1.7rem;font-weight:900;border-radius:16px;background:#fff;color:#3a2e4a;box-shadow:0 5px 0 #c9c4d0,var(--shadow);border:2px solid #eee;}
.ns-opt:active{transform:translateY(3px);box-shadow:0 2px 0 #c9c4d0,var(--shadow);}
.ns-opt--correct{background:linear-gradient(160deg,#6bcf7f,#3da858);color:#fff;border-color:#3da858;animation:ns-pop .4s ease;}
.ns-opt--wrong{background:#ff6348;color:#fff;border-color:#c4452f;animation:ns-shake .4s ease;}
@keyframes ns-pop{0%{transform:scale(.7)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes ns-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media(max-width:380px){.ns-card{width:52px;height:70px;font-size:1.5rem;}}
`;
}

export function create(): NumberSequenceGame {
  return new NumberSequenceGame();
}

void sample;
