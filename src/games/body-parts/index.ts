/* 身体部位 Body Parts —— 看一个身体部位，选出它的功能（如 眼睛→看）。
   独特点：身体认知 + 功能配对。
   巧思：部位 emoji 大字 + 功能选项；难度=选项数；通关=答对目标轮数。前缀 bdpt-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Part {
  emoji: string;
  name: string;
  function: string;
}

const PARTS: Part[] = [
  { emoji: "👁️", name: "眼睛", function: "看东西" },
  { emoji: "👂", name: "耳朵", function: "听声音" },
  { emoji: "👃", name: "鼻子", function: "闻味道" },
  { emoji: "👄", name: "嘴巴", function: "吃东西" },
  { emoji: "✋", name: "手", function: "拿东西" },
  { emoji: "🦶", name: "脚", function: "走路" },
  { emoji: "🧠", name: "大脑", function: "想问题" },
  { emoji: "🦷", name: "牙齿", function: "咬东西" },
];

export class BodyPartsGame extends BaseGame {
  constructor() {
    super("body-parts");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Part | null = null;
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

    let pool = PARTS.map((_, i) => i).filter((i) => !this.usedIdx.includes(i));
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = PARTS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = PARTS[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), PARTS.length);
    const distractors = shuffle(
      PARTS.filter((p) => p.function !== answer.function),
    ).slice(0, n - 1);
    const choices = shuffle([
      answer.function,
      ...distractors.map((d) => d.function),
    ]);
    this.render(answer, choices);
  }

  private render(answer: Part, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "bdpt-wrap";

    const task = document.createElement("div");
    task.className = "bdpt-task";
    task.innerHTML = `<b>${answer.name}</b>能做什么？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "bdpt-stage";
    const emoji = document.createElement("div");
    emoji.className = "bdpt-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "bdpt-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bdpt-opt";
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
    const ok = c === this.target.function;
    if (ok) {
      btn.classList.add("bdpt-opt--correct");
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
      btn.classList.add("bdpt-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".bdpt-opt--wrong")
          .forEach((el) => el.classList.remove("bdpt-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("bdpt-style")) return;
    const st = document.createElement("style");
    st.id = "bdpt-style";
    st.textContent = BDP_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function BDP_CSS(theme: string): string {
  return `
.bdpt-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.bdpt-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.bdpt-task b{color:${theme};}
.bdpt-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.bdpt-stage{padding:26px 48px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 12%,#fff));border-radius:24px;box-shadow:var(--shadow);}
.bdpt-emoji{font-size:5.5rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.15));}
.bdpt-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.bdpt-opts{grid-template-columns:1fr;}}
.bdpt-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#ffeef5);box-shadow:var(--shadow);cursor:pointer;font-size:1.1rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.bdpt-opt:active{transform:scale(.95);}
.bdpt-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:bdpt-yes .4s ease;}
@keyframes bdpt-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.bdpt-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:bdpt-no .3s ease;}
@keyframes bdpt-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): BodyPartsGame {
  return new BodyPartsGame();
}
