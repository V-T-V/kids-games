/* 岩石辨认 Rock ID —— 读一段岩石的描述，选出它是哪种岩石。
   独特点：地质常识 + 类型辨认（描述题，非 emoji）。
   巧思：描述卡片 + 类型选项；难度=选项数；通关=答对目标轮数。前缀 rki2-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Rock {
  emoji: string;
  desc: string;
  type: string;
}

const IGNEOUS = "岩浆岩";
const SEDIMENT = "沉积岩";
const METAMORPH = "变质岩";

const ROCKS: Rock[] = [
  {
    emoji: "🌋",
    desc: "火山喷出来的岩浆冷却后变硬，叫什么岩？",
    type: IGNEOUS,
  },
  {
    emoji: "🪨",
    desc: "花岗岩是岩浆冷却形成的，它属于哪一类？",
    type: IGNEOUS,
  },
  { emoji: "🏖️", desc: "沙子一层一层堆起来压实，变成什么岩？", type: SEDIMENT },
  {
    emoji: "🦴",
    desc: "贝壳和泥沙一层层堆起来变硬，叫什么岩？",
    type: SEDIMENT,
  },
  {
    emoji: "💎",
    desc: "石头在很热很挤的地方变了样子，叫什么岩？",
    type: METAMORPH,
  },
  {
    emoji: "⛰️",
    desc: "大理石是被高温高压烤过的，它是哪一类？",
    type: METAMORPH,
  },
];

const ALL_TYPES = [IGNEOUS, SEDIMENT, METAMORPH];

export class RockIdGame extends BaseGame {
  constructor() {
    super("rock-id");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Rock | null = null;
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
    return this.difficulty === "easy" ? 4: this.difficulty === "medium"
        ? 5
        : 6;
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    let pool = ROCKS.map((_, i) => i).filter((i) => !this.usedIdx.includes(i));
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = ROCKS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = ROCKS[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), ALL_TYPES.length);
    const distractors = shuffle(
      ALL_TYPES.filter((c) => c !== answer.type),
    ).slice(0, n - 1);
    const choices = shuffle([answer.type, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Rock, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "rki2-wrap";

    const task = document.createElement("div");
    task.className = "rki2-task";
    task.innerHTML = `这是哪一种岩石？<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "rki2-stage";
    const emoji = document.createElement("div");
    emoji.className = "rki2-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    const desc = document.createElement("div");
    desc.className = "rki2-desc";
    desc.textContent = answer.desc;
    stage.appendChild(desc);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "rki2-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rki2-opt";
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
    const ok = c === this.target.type;
    if (ok) {
      btn.classList.add("rki2-opt--correct");
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
      btn.classList.add("rki2-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".rki2-opt--wrong")
          .forEach((el) => el.classList.remove("rki2-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("rki2-style")) return;
    const st = document.createElement("style");
    st.id = "rki2-style";
    st.textContent = RKI2_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function RKI2_CSS(theme: string): string {
  return `
.rki2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.rki2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.rki2-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.rki2-stage{padding:26px 28px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 14%,#fff));border-radius:24px;box-shadow:var(--shadow);display:flex;align-items:center;gap:18px;max-width:440px;}
.rki2-emoji{font-size:4rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.18));flex-shrink:0;}
.rki2-desc{font-size:1.05rem;font-weight:700;color:var(--ink);line-height:1.6;}
.rki2-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.rki2-opts{grid-template-columns:1fr;}}
.rki2-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#f3ebe4);box-shadow:var(--shadow);cursor:pointer;font-size:1.15rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.rki2-opt:active{transform:scale(.95);}
.rki2-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:rki2-yes .4s ease;}
@keyframes rki2-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.rki2-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:rki2-no .3s ease;}
@keyframes rki2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): RockIdGame {
  return new RockIdGame();
}
