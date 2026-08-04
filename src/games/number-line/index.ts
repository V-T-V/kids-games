/* 数轴找数 Number Line —— 画一条数轴（0-10/0-20），箭头指向某刻度，问"箭头指的数字是几"。
   独特点：数轴是数感核心，难度=数轴范围 + 刻度密度（是否标出每个数）+ 选项数。
   视觉：彩色数轴 + 跳动箭头 + 答对刻度高亮。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

export class NumberLineGame extends BaseGame {
  constructor() {
    super("number-line");
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

  private lineRange(): { max: number; labelEvery: number } {
    // easy：0-10，每个数都标；medium：0-20 每 2 标；hard：0-20 只标 0/10/20
    if (this.difficulty === "easy") return { max: 10, labelEvery: 1 };
    if (this.difficulty === "medium") return { max: 20, labelEvery: 2 };
    return { max: 20, labelEvery: 10 };
  }

  private makeDistractors(answer: number, max: number, n: number): number[] {
    const set = new Set<number>([answer]);
    const out: number[] = [];
    const near =
      this.difficulty === "hard"
        ? 1
        : this.difficulty === "medium"
          ? 2
          : 3;
    const variants = [
      answer + 1,
      answer - 1,
      answer + near,
      answer - near,
      answer + near + 1,
      answer - near - 1,
    ];
    for (const v of variants) {
      if (v !== answer && v >= 0 && v <= max && !set.has(v)) {
        set.add(v);
        out.push(v);
      }
      if (out.length >= n) break;
    }
    let guard = 0;
    while (out.length < n && guard < 40) {
      guard += 1;
      const v = randInt(0, max);
      if (!set.has(v)) {
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
    const { max, labelEvery } = this.lineRange();
    // 答案在 1..max 之间（避开 0 太简单）
    const answer = randInt(1, max);
    const optionCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const distractors = this.makeDistractors(answer, max, optionCount - 1);
    const options = shuffle([answer, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "nln-wrap";

    const task = document.createElement("div");
    task.className = "nln-task";
    task.textContent = "箭头指的数字是几？";
    wrap.appendChild(task);

    // 数轴：用 flex 横向均匀分布刻度
    const axis = document.createElement("div");
    axis.className = "nln-axis";
    const ticks = document.createElement("div");
    ticks.className = "nln-ticks";
    for (let i = 0; i <= max; i++) {
      const t = document.createElement("div");
      t.className = "nln-tick";
      t.dataset.v = String(i);
      // 标记需要显示的数字
      const showLabel = i % labelEvery === 0;
      t.innerHTML = `<span class="nln-tickmark"></span>${
        showLabel ? `<span class="nln-ticklabel">${i}</span>` : ""
      }`;
      if (i === answer) t.classList.add("nln-tick--target");
      ticks.appendChild(t);
    }
    axis.appendChild(ticks);

    // 箭头：放在 target tick 上方
    const arrow = document.createElement("div");
    arrow.className = "nln-arrow";
    arrow.textContent = "👇";
    arrow.style.left = `${(answer / max) * 100}%`;
    axis.appendChild(arrow);

    // 数轴线
    const line = document.createElement("div");
    line.className = "nln-line";
    axis.appendChild(line);

    wrap.appendChild(axis);

    const opts = document.createElement("div");
    opts.className = "nln-opts";
    options.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nln-opt";
      b.textContent = String(o);
      b.addEventListener("click", () => this.choose(o, answer, b, ticks));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(
    o: number,
    answer: number,
    btn: HTMLButtonElement,
    ticks: HTMLElement,
  ): void {
    if (this.locked) return;
    if (o === answer) {
      this.locked = true;
      btn.classList.add("nln-opt--correct");
      sfxPop();
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      // 高亮目标刻度并补上标签
      const t = ticks.querySelector(".nln-tick--target");
      if (t) {
        t.classList.add("nln-tick--hit");
        const label = t.querySelector(".nln-ticklabel");
        if (label) label.textContent = String(answer);
      }
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("nln-opt--wrong");
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
        return;
      }
      this.trackTimeout(() => {
        btn.classList.remove("nln-opt--wrong");
        btn.disabled = true;
      }, 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "从 0 开始一格一格数到箭头～",
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
    if (document.getElementById("nln-style")) return;
    const st = document.createElement("style");
    st.id = "nln-style";
    st.textContent = NLN_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function NLN_CSS(theme: string): string {
  return `
.nln-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(480px,100%);}
.nln-task{font-size:1.2rem;font-weight:800;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.nln-axis{position:relative;width:min(440px,92vw);padding:30px 6px 0;}
.nln-line{position:absolute;left:6px;right:6px;top:54px;height:5px;background:linear-gradient(90deg,${theme},color-mix(in srgb,${theme} 60%,#000));border-radius:3px;}
.nln-arrow{position:absolute;top:6px;transform:translateX(-50%);font-size:1.8rem;animation:nln-bounce .8s ease-in-out infinite;}
@keyframes nln-bounce{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(6px)}}
.nln-ticks{position:relative;display:flex;justify-content:space-between;z-index:1;}
.nln-tick{position:relative;display:flex;flex-direction:column;align-items:center;flex:0 0 auto;width:0;}
.nln-tickmark{display:block;width:3px;height:14px;background:#9a8fc0;border-radius:2px;margin-top:34px;}
.nln-tick--target .nln-tickmark{background:${theme};}
.nln-ticklabel{position:absolute;top:52px;font-size:.95rem;font-weight:800;color:#6a5d8a;transform:translateX(-50%);left:0;}
.nln-tick--hit .nln-tickmark{height:20px;width:5px;background:${theme};box-shadow:0 0 0 4px color-mix(in srgb,${theme} 30%,transparent);animation:nln-pop .4s ease;}
.nln-tick--hit .nln-ticklabel{color:${theme};font-size:1.2rem;}
@keyframes nln-pop{0%{transform:scale(1)}50%{transform:scale(1.4)}100%{transform:scale(1)}}
.nln-opts{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;}
.nln-opt{min-width:64px;min-height:60px;font-size:1.6rem;font-weight:900;border-radius:16px;background:#fff;color:#3a2e4a;box-shadow:0 5px 0 #c9c4d0,var(--shadow);border:2px solid #eee;}
.nln-opt:active{transform:translateY(3px);box-shadow:0 2px 0 #c9c4d0,var(--shadow);}
.nln-opt--correct{background:linear-gradient(160deg,#6bcf7f,#3da858);color:#fff;border-color:#3da858;animation:nln-pop2 .4s ease;}
.nln-opt--wrong{background:#ff6348;color:#fff;border-color:#c4452f;animation:nln-shake .4s ease;}
@keyframes nln-pop2{0%{transform:scale(.7)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes nln-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): NumberLineGame {
  return new NumberLineGame();
}
