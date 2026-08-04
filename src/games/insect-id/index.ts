/* 昆虫辨认 Insect ID —— 看一只虫子的 emoji，选出它的名字。
   独特点：昆虫认知 + 名字配对。
   巧思：大 emoji 虫 + 文字选项；难度=选项数；通关=答对目标轮数。前缀 ini-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Insect {
  emoji: string;
  name: string;
}

const INSECTS: Insect[] = [
  { emoji: "🦗", name: "蚂蚱" },
  { emoji: "🐜", name: "蚂蚁" },
  { emoji: "🐝", name: "蜜蜂" },
  { emoji: "🦋", name: "蝴蝶" },
  { emoji: "🐞", name: "瓢虫" },
  { emoji: "🪲", name: "甲虫" },
  { emoji: "🕷️", name: "蜘蛛" },
  { emoji: "🦟", name: "蚊子" },
];

const ALL_NAMES = INSECTS.map((i) => i.name);

export class InsectIdGame extends BaseGame {
  constructor() {
    super("insect-id");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Insect | null = null;
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

    let pool = INSECTS.map((_, i) => i).filter(
      (i) => !this.usedIdx.includes(i),
    );
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = INSECTS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = INSECTS[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), ALL_NAMES.length);
    const distractors = shuffle(
      ALL_NAMES.filter((c) => c !== answer.name),
    ).slice(0, n - 1);
    const choices = shuffle([answer.name, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Insect, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "ini-wrap";

    const task = document.createElement("div");
    task.className = "ini-task";
    task.innerHTML = `这个小虫子叫什么？<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "ini-stage";
    const emoji = document.createElement("div");
    emoji.className = "ini-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "ini-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ini-opt";
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
      btn.classList.add("ini-opt--correct");
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
      btn.classList.add("ini-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".ini-opt--wrong")
          .forEach((el) => el.classList.remove("ini-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("ini-style")) return;
    const st = document.createElement("style");
    st.id = "ini-style";
    st.textContent = INI_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function INI_CSS(theme: string): string {
  return `
.ini-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.ini-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.ini-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.ini-stage{padding:30px 56px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 16%,#fff));border-radius:28px;box-shadow:var(--shadow);}
.ini-emoji{font-size:6rem;line-height:1;filter:drop-shadow(0 6px 8px rgba(0,0,0,.18));animation:ini-wiggle 1.8s ease-in-out infinite;}
@keyframes ini-wiggle{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
.ini-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.ini-opts{grid-template-columns:1fr;}}
.ini-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#e6f9ea);box-shadow:var(--shadow);cursor:pointer;font-size:1.15rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.ini-opt:active{transform:scale(.95);}
.ini-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:ini-yes .4s ease;}
@keyframes ini-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.ini-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:ini-no .3s ease;}
@keyframes ini-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): InsectIdGame {
  return new InsectIdGame();
}
