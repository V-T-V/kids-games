/* 水果长在哪 Fruit Tree —— 看一个水果的 emoji，选出它长在哪里。
   独特点：水果认知 + 生长环境配对。
   巧思：大 emoji 水果 + 文字选项；难度=选项数；通关=答对目标轮数。前缀 fti2-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Fruit {
  emoji: string;
  name: string;
  where: string;
}

const TREE = "长在树上";
const GROUND = "长在地上";
const VINE = "长在藤上";

const FRUITS: Fruit[] = [
  { emoji: "🍎", name: "苹果", where: TREE },
  { emoji: "🍌", name: "香蕉", where: TREE },
  { emoji: "🍐", name: "梨", where: TREE },
  { emoji: "🍊", name: "橘子", where: TREE },
  { emoji: "🍓", name: "草莓", where: GROUND },
  { emoji: "🍉", name: "西瓜", where: GROUND },
  { emoji: "🍇", name: "葡萄", where: VINE },
  { emoji: "🥝", name: "猕猴桃", where: VINE },
];

const ALL_WHERE = [TREE, GROUND, VINE];

export class FruitTreeGame extends BaseGame {
  constructor() {
    super("fruit-tree");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Fruit | null = null;
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

    let pool = FRUITS.map((_, i) => i).filter((i) => !this.usedIdx.includes(i));
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = FRUITS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = FRUITS[ansIdx]!;
    this.target = answer;

    const distractors = shuffle(
      ALL_WHERE.filter((c) => c !== answer.where),
    ).slice(0, 2);
    const choices = shuffle([answer.where, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Fruit, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "fti2-wrap";

    const task = document.createElement("div");
    task.className = "fti2-task";
    task.innerHTML = `<b>${answer.name}</b> 长在哪里？<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "fti2-stage";
    const emoji = document.createElement("div");
    emoji.className = "fti2-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "fti2-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fti2-opt";
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
    const ok = c === this.target.where;
    if (ok) {
      btn.classList.add("fti2-opt--correct");
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
      btn.classList.add("fti2-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".fti2-opt--wrong")
          .forEach((el) => el.classList.remove("fti2-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("fti2-style")) return;
    const st = document.createElement("style");
    st.id = "fti2-style";
    st.textContent = FTI2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function FTI2_CSS(theme: string): string {
  return `
.fti2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.fti2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.fti2-task b{color:${theme};}
.fti2-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.fti2-stage{padding:30px 56px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 14%,#fff));border-radius:28px;box-shadow:var(--shadow);}
.fti2-emoji{font-size:6rem;line-height:1;filter:drop-shadow(0 6px 8px rgba(0,0,0,.18));animation:fti2-bounce 2.4s ease-in-out infinite;}
@keyframes fti2-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.fti2-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.fti2-opts{grid-template-columns:1fr;}}
.fti2-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#fff2e6);box-shadow:var(--shadow);cursor:pointer;font-size:1.15rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.fti2-opt:active{transform:scale(.95);}
.fti2-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:fti2-yes .4s ease;}
@keyframes fti2-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.fti2-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:fti2-no .3s ease;}
@keyframes fti2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): FruitTreeGame {
  return new FruitTreeGame();
}
