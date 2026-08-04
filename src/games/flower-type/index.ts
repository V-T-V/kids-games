/* 花的种类 Flower Type —— 看一朵花的 emoji，选出它的名字。
   独特点：花卉认知 + 名字配对。
   巧思：大 emoji 花 + 文字选项；难度=选项数；通关=答对目标轮数。前缀 flt2-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Flower {
  emoji: string;
  name: string;
}

const FLOWERS: Flower[] = [
  { emoji: "🌻", name: "向日葵" },
  { emoji: "🌹", name: "玫瑰花" },
  { emoji: "🌷", name: "郁金香" },
  { emoji: "🌸", name: "樱花" },
  { emoji: "🌺", name: "芙蓉花" },
  { emoji: "🌼", name: "雏菊" },
  { emoji: "💐", name: "花束" },
  { emoji: "🪷", name: "荷花" },
];

const ALL_NAMES = FLOWERS.map((f) => f.name);

export class FlowerTypeGame extends BaseGame {
  constructor() {
    super("flower-type");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Flower | null = null;
  private usedIdx: number[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.usedIdx = [];
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private choiceN(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    let pool = FLOWERS.map((_, i) => i).filter(
      (i) => !this.usedIdx.includes(i),
    );
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = FLOWERS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = FLOWERS[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), ALL_NAMES.length);
    const distractors = shuffle(
      ALL_NAMES.filter((c) => c !== answer.name),
    ).slice(0, n - 1);
    const choices = shuffle([answer.name, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Flower, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "flt2-wrap";

    const task = document.createElement("div");
    task.className = "flt2-task";
    task.innerHTML = `这是什么花？<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "flt2-stage";
    const emoji = document.createElement("div");
    emoji.className = "flt2-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "flt2-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "flt2-opt";
      b.textContent = c;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(c: string, btn: HTMLButtonElement): void {
    if (this.answered || !this.target) return;
    this.answered = true;
    const ok = c === this.target.name;
    if (ok) {
      btn.classList.add("flt2-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      sfxPop();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("flt2-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".flt2-opt--wrong")
          .forEach((el) => el.classList.remove("flt2-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("flt2-style")) return;
    const st = document.createElement("style");
    st.id = "flt2-style";
    st.textContent = FLT2_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function FLT2_CSS(theme: string): string {
  return `
.flt2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.flt2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.flt2-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.flt2-stage{padding:30px 56px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 16%,#fff));border-radius:28px;box-shadow:var(--shadow);}
.flt2-emoji{font-size:6rem;line-height:1;filter:drop-shadow(0 6px 8px rgba(0,0,0,.18));animation:flt2-bloom 3s ease-in-out infinite;}
@keyframes flt2-bloom{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.flt2-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.flt2-opts{grid-template-columns:1fr;}}
.flt2-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#ffeaf2);box-shadow:var(--shadow);cursor:pointer;font-size:1.15rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.flt2-opt:active{transform:scale(.95);}
.flt2-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:flt2-yes .4s ease;}
@keyframes flt2-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.flt2-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:flt2-no .3s ease;}
@keyframes flt2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): FlowerTypeGame {
  return new FlowerTypeGame();
}
