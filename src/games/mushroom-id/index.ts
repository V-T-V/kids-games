/* 蘑菇辨认 Mushroom ID —— 看一个蘑菇的 emoji/描述，判断它是能吃还是有毒。
   独特点：安全常识 + 蘑菇分类（二选一，强化"野外的蘑菇不要随便吃"）。
   巧思：蘑菇卡片 + 可食/有毒选项；难度=轮数；通关=答对目标轮数。前缀 mhi-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Mushroom {
  emoji: string;
  name: string;
  edible: boolean;
}

const EDIBLE = "可以吃";
const POISON = "有毒";

const MUSHROOMS: Mushroom[] = [
  { emoji: "🍄", name: "香菇", edible: true },
  { emoji: "🍄", name: "金针菇", edible: true },
  { emoji: "🍄", name: "平菇", edible: true },
  { emoji: "🍄", name: "毒蝇伞（红底白点）", edible: false },
  { emoji: "🍄", name: "死亡帽（白白的）", edible: false },
  { emoji: "🍄", name: "野外不认识的蘑菇", edible: false },
];

export class MushroomIdGame extends BaseGame {
  constructor() {
    super("mushroom-id");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Mushroom | null = null;
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

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    let pool = MUSHROOMS.map((_, i) => i).filter(
      (i) => !this.usedIdx.includes(i),
    );
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = MUSHROOMS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = MUSHROOMS[ansIdx]!;
    this.target = answer;

    const correct = answer.edible ? EDIBLE : POISON;
    const choices = shuffle([EDIBLE, POISON]);
    this.render(answer, choices, correct);
  }

  private render(answer: Mushroom, choices: string[], _correct: string): void {
    void _correct;
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "mhi-wrap";

    const task = document.createElement("div");
    task.className = "mhi-task";
    task.innerHTML = `这个蘑菇能吃吗？<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "mhi-stage";
    const emoji = document.createElement("div");
    emoji.className = "mhi-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    const desc = document.createElement("div");
    desc.className = "mhi-desc";
    desc.textContent = answer.name;
    stage.appendChild(desc);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "mhi-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mhi-opt";
      b.textContent = c;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    const tip = document.createElement("div");
    tip.className = "mhi-tip";
    tip.textContent = "小提示：野外的蘑菇再好看也不要随便摘来吃哦～";
    wrap.appendChild(tip);

    this.root.appendChild(wrap);
  }

  private choose(c: string, btn: HTMLButtonElement): void {
    if (this.answered || !this.target) return;
    this.answered = true;
    const ok =
      (this.target.edible && c === EDIBLE) ||
      (!this.target.edible && c === POISON);
    if (ok) {
      btn.classList.add("mhi-opt--correct");
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
      btn.classList.add("mhi-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".mhi-opt--wrong")
          .forEach((el) => el.classList.remove("mhi-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("mhi-style")) return;
    const st = document.createElement("style");
    st.id = "mhi-style";
    st.textContent = MHI_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function MHI_CSS(theme: string): string {
  return `
.mhi-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.mhi-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.mhi-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.mhi-stage{padding:26px 36px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 12%,#fff));border-radius:24px;box-shadow:var(--shadow);display:flex;align-items:center;gap:18px;}
.mhi-emoji{font-size:5rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.18));animation:mhi-bob 2.4s ease-in-out infinite;}
@keyframes mhi-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.mhi-desc{font-size:1.15rem;font-weight:800;color:var(--ink);}
.mhi-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.mhi-opts{grid-template-columns:1fr;}}
.mhi-opt{padding:18px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#fff0ee);box-shadow:var(--shadow);cursor:pointer;font-size:1.25rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:64px;}
.mhi-opt:active{transform:scale(.95);}
.mhi-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:mhi-yes .4s ease;}
@keyframes mhi-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.mhi-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:mhi-no .3s ease;}
@keyframes mhi-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.mhi-tip{font-size:.9rem;color:var(--ink-soft);font-weight:700;text-align:center;max-width:400px;background:rgba(255,255,255,.6);padding:8px 14px;border-radius:12px;}
`;
}

export function create(): MushroomIdGame {
  return new MushroomIdGame();
}
