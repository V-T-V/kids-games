/* 动物脚印 Animal Track —— 读脚印的描述，选出是哪种动物留下的。
   独特点：动物认知 + 观察推理（脚印特征）。
   巧思：脚印描述卡片 + 动物选项；难度=选项数；通关=答对目标轮数。前缀 atr-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Track {
  emoji: string;
  desc: string;
  animal: string;
}

const TRACKS: Track[] = [
  { emoji: "🐾", desc: "圆圆的、像梅花，小小的爪印，是谁的？", animal: "小猫" },
  {
    emoji: "🐾",
    desc: "圆圆的爪印比猫大很多，还会咬骨头，是谁？",
    animal: "小狗",
  },
  { emoji: "🦆", desc: "脚趾之间有蹼，踩在水边泥地上，是谁？", animal: "鸭子" },
  { emoji: "🐎", desc: "一个又大又圆的马蹄印，是谁的？", animal: "马" },
  {
    emoji: "🐔",
    desc: "三个脚趾朝前、细细的爪印，像小树枝，是谁？",
    animal: "小鸡",
  },
  {
    emoji: "🐂",
    desc: "一个分成两半的蹄印，牛牛踩出来的，是谁？",
    animal: "牛",
  },
  {
    emoji: "🦅",
    desc: "三个尖尖的爪印，前面还弯弯的，是天上的谁？",
    animal: "老鹰",
  },
  {
    emoji: "🐇",
    desc: "前面四个小牙印、后面两个长长的，一蹦一跳，是谁？",
    animal: "兔子",
  },
];

const ALL_ANIMALS = TRACKS.map((t) => t.animal);

export class AnimalTrackGame extends BaseGame {
  constructor() {
    super("animal-track");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Track | null = null;
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

    let pool = TRACKS.map((_, i) => i).filter((i) => !this.usedIdx.includes(i));
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = TRACKS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = TRACKS[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), ALL_ANIMALS.length);
    const distractors = shuffle(
      ALL_ANIMALS.filter((c) => c !== answer.animal),
    ).slice(0, n - 1);
    const choices = shuffle([answer.animal, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Track, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "atr-wrap";

    const task = document.createElement("div");
    task.className = "atr-task";
    task.innerHTML = `这是谁的脚印？<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "atr-stage";
    const emoji = document.createElement("div");
    emoji.className = "atr-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    const desc = document.createElement("div");
    desc.className = "atr-desc";
    desc.textContent = answer.desc;
    stage.appendChild(desc);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "atr-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "atr-opt";
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
    const ok = c === this.target.animal;
    if (ok) {
      btn.classList.add("atr-opt--correct");
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
      btn.classList.add("atr-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".atr-opt--wrong")
          .forEach((el) => el.classList.remove("atr-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("atr-style")) return;
    const st = document.createElement("style");
    st.id = "atr-style";
    st.textContent = ATR_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function ATR_CSS(theme: string): string {
  return `
.atr-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.atr-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.atr-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.atr-stage{padding:26px 28px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 14%,#fff));border-radius:24px;box-shadow:var(--shadow);display:flex;align-items:center;gap:18px;max-width:440px;}
.atr-emoji{font-size:4rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.18));flex-shrink:0;}
.atr-desc{font-size:1.05rem;font-weight:700;color:var(--ink);line-height:1.6;}
.atr-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.atr-opts{grid-template-columns:1fr;}}
.atr-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#f3ebe4);box-shadow:var(--shadow);cursor:pointer;font-size:1.15rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.atr-opt:active{transform:scale(.95);}
.atr-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:atr-yes .4s ease;}
@keyframes atr-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.atr-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:atr-no .3s ease;}
@keyframes atr-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): AnimalTrackGame {
  return new AnimalTrackGame();
}
