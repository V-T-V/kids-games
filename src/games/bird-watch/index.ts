/* 观鸟识鸟 Bird Watch —— 看一只鸟的图片（emoji），选出它叫什么名字。
   独特点：鸟类认知 + 名字配对。
   巧思：大 emoji 鸟 + 文字选项；难度=选项数；通关=答对目标轮数。前缀 bwt-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Bird {
  emoji: string;
  name: string;
}

const BIRDS: Bird[] = [
  { emoji: "🦅", name: "老鹰" },
  { emoji: "🕊️", name: "鸽子" },
  { emoji: "🦉", name: "猫头鹰" },
  { emoji: "🦜", name: "鹦鹉" },
  { emoji: "🐧", name: "企鹅" },
  { emoji: "🦩", name: "火烈鸟" },
  { emoji: "🦆", name: "鸭子" },
  { emoji: "🐔", name: "小鸡" },
  { emoji: "🦢", name: "天鹅" },
  { emoji: "🦚", name: "孔雀" },
];

const ALL_NAMES = BIRDS.map((b) => b.name);

export class BirdWatchGame extends BaseGame {
  constructor() {
    super("bird-watch");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Bird | null = null;
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

    let pool = BIRDS.map((_, i) => i).filter((i) => !this.usedIdx.includes(i));
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = BIRDS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = BIRDS[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), ALL_NAMES.length);
    const distractors = shuffle(
      ALL_NAMES.filter((c) => c !== answer.name),
    ).slice(0, n - 1);
    const choices = shuffle([answer.name, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Bird, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "bwt-wrap";

    const task = document.createElement("div");
    task.className = "bwt-task";
    task.innerHTML = `这只鸟叫什么名字？<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "bwt-stage";
    const emoji = document.createElement("div");
    emoji.className = "bwt-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "bwt-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bwt-opt";
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
      btn.classList.add("bwt-opt--correct");
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
      btn.classList.add("bwt-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".bwt-opt--wrong")
          .forEach((el) => el.classList.remove("bwt-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("bwt-style")) return;
    const st = document.createElement("style");
    st.id = "bwt-style";
    st.textContent = BWT_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function BWT_CSS(theme: string): string {
  return `
.bwt-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.bwt-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.bwt-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.bwt-stage{padding:28px 56px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 14%,#fff));border-radius:28px;box-shadow:var(--shadow);position:relative;overflow:hidden;}
.bwt-stage::before{content:"☁️";position:absolute;top:10px;left:14px;font-size:1.6rem;opacity:.6;animation:bwt-fly 6s ease-in-out infinite;}
.bwt-stage::after{content:"☁️";position:absolute;bottom:10px;right:18px;font-size:1.3rem;opacity:.5;animation:bwt-fly 8s ease-in-out infinite reverse;}
@keyframes bwt-fly{0%,100%{transform:translateX(0)}50%{transform:translateX(14px)}}
.bwt-emoji{font-size:6rem;line-height:1;filter:drop-shadow(0 6px 8px rgba(0,0,0,.18));animation:bwt-flap 2.2s ease-in-out infinite;}
@keyframes bwt-flap{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-8px) rotate(2deg)}}
.bwt-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.bwt-opts{grid-template-columns:1fr;}}
.bwt-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#e6fbfc);box-shadow:var(--shadow);cursor:pointer;font-size:1.15rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.bwt-opt:active{transform:scale(.95);}
.bwt-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:bwt-yes .4s ease;}
@keyframes bwt-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.bwt-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:bwt-no .3s ease;}
@keyframes bwt-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): BirdWatchGame {
  return new BirdWatchGame();
}
