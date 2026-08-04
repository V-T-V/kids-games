/* 树叶辨认 Leaf ID —— 看一片叶子的 emoji，选出它的形状/种类。
   独特点：叶子形态认知。
   巧思：大 emoji 叶 + 文字选项；难度=选项数；通关=答对目标轮数。前缀 lfi2-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Leaf {
  emoji: string;
  kind: string;
}

const LEAVES: Leaf[] = [
  { emoji: "🍁", kind: "枫叶" },
  { emoji: "🍂", kind: "枯叶" },
  { emoji: "🌿", kind: "草药叶" },
  { emoji: "🍀", kind: "三叶草" },
  { emoji: "🌱", kind: "嫩芽" },
  { emoji: "🍃", kind: "绿叶" },
  { emoji: "🎋", kind: "竹叶" },
];

const ALL_KINDS = LEAVES.map((l) => l.kind);

export class LeafIdGame extends BaseGame {
  constructor() {
    super("leaf-id");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Leaf | null = null;
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

    let pool = LEAVES.map((_, i) => i).filter((i) => !this.usedIdx.includes(i));
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = LEAVES.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = LEAVES[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), ALL_KINDS.length);
    const distractors = shuffle(
      ALL_KINDS.filter((c) => c !== answer.kind),
    ).slice(0, n - 1);
    const choices = shuffle([answer.kind, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Leaf, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "lfi2-wrap";

    const task = document.createElement("div");
    task.className = "lfi2-task";
    task.innerHTML = `这是哪种叶子？<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "lfi2-stage";
    const emoji = document.createElement("div");
    emoji.className = "lfi2-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "lfi2-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lfi2-opt";
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
    const ok = c === this.target.kind;
    if (ok) {
      btn.classList.add("lfi2-opt--correct");
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
      btn.classList.add("lfi2-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".lfi2-opt--wrong")
          .forEach((el) => el.classList.remove("lfi2-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("lfi2-style")) return;
    const st = document.createElement("style");
    st.id = "lfi2-style";
    st.textContent = LFI2_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function LFI2_CSS(theme: string): string {
  return `
.lfi2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.lfi2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.lfi2-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.lfi2-stage{padding:30px 56px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 16%,#fff));border-radius:28px;box-shadow:var(--shadow);}
.lfi2-emoji{font-size:6rem;line-height:1;filter:drop-shadow(0 6px 8px rgba(0,0,0,.18));animation:lfi2-sway 3s ease-in-out infinite;}
@keyframes lfi2-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
.lfi2-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.lfi2-opts{grid-template-columns:1fr;}}
.lfi2-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#e6f9ea);box-shadow:var(--shadow);cursor:pointer;font-size:1.15rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.lfi2-opt:active{transform:scale(.95);}
.lfi2-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:lfi2-yes .4s ease;}
@keyframes lfi2-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.lfi2-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:lfi2-no .3s ease;}
@keyframes lfi2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): LeafIdGame {
  return new LeafIdGame();
}
