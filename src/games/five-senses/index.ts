/* 五官认识 Five Senses —— 看一个感官场景（如闻花香），选出用到的五官（鼻子）。
   独特点：五官 + 感官功能认知。
   巧思：场景大 emoji + 五官选项；难度=选项数；通关=答对目标轮数。前缀 fvs-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Sense {
  emoji: string; // 场景 emoji
  scene: string; // 场景描述
  organ: string; // 对应的五官
}

const SENSES: Sense[] = [
  { emoji: "🌸", scene: "闻花香", organ: "鼻子" },
  { emoji: "📺", scene: "看电视", organ: "眼睛" },
  { emoji: "🎵", scene: "听音乐", organ: "耳朵" },
  { emoji: "🍦", scene: "尝冰淇淋", organ: "舌头" },
  { emoji: "🧸", scene: "摸玩具", organ: "手" },
  { emoji: "🍋", scene: "尝柠檬", organ: "舌头" },
  { emoji: "🐦", scene: "听鸟叫", organ: "耳朵" },
  { emoji: "📖", scene: "看绘本", organ: "眼睛" },
];

const ALL_ORGANS = ["眼睛", "耳朵", "鼻子", "舌头", "手"];

export class FiveSensesGame extends BaseGame {
  constructor() {
    super("five-senses");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Sense | null = null;
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

    let pool = SENSES.map((_, i) => i).filter((i) => !this.usedIdx.includes(i));
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = SENSES.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = SENSES[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), ALL_ORGANS.length);
    const distractors = shuffle(
      ALL_ORGANS.filter((o) => o !== answer.organ),
    ).slice(0, n - 1);
    const choices = shuffle([answer.organ, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Sense, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "fvs-wrap";

    const task = document.createElement("div");
    task.className = "fvs-task";
    task.innerHTML = `${answer.emoji} <b>${answer.scene}</b>，用到哪个五官？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const opts = document.createElement("div");
    opts.className = "fvs-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fvs-opt";
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
    const ok = c === this.target.organ;
    if (ok) {
      btn.classList.add("fvs-opt--correct");
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
      btn.classList.add("fvs-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".fvs-opt--wrong")
          .forEach((el) => el.classList.remove("fvs-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("fvs-style")) return;
    const st = document.createElement("style");
    st.id = "fvs-style";
    st.textContent = FVS_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function FVS_CSS(theme: string): string {
  return `
.fvs-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.fvs-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;background:#fff;padding:12px 22px;border-radius:999px;box-shadow:var(--shadow);}
.fvs-task b{color:${theme};}
.fvs-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.fvs-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.fvs-opts{grid-template-columns:1fr;}}
.fvs-opt{padding:18px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#eef0ff);box-shadow:var(--shadow);cursor:pointer;font-size:1.2rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:62px;}
.fvs-opt:active{transform:scale(.95);}
.fvs-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:fvs-yes .4s ease;}
@keyframes fvs-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.fvs-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:fvs-no .3s ease;}
@keyframes fvs-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): FiveSensesGame {
  return new FiveSensesGame();
}
