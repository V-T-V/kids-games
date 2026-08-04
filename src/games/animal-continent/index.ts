/* 动物住哪个洲 Animal Continent —— 看一种动物，选出它主要居住的大洲。
   独特点：动物 + 栖息地认知。
   巧思：动物大 emoji + 大洲选项；难度=选项数；通关=答对目标轮数。前缀 anc-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Animal {
  emoji: string;
  name: string;
  continent: string;
}

const ASIA = "亚洲";
const AFRICA = "非洲";
const AMERICAS = "美洲";
const OCEANIA = "大洋洲";
const ARCTIC = "北极";
const ANTARCTICA = "南极";

const ANIMALS: Animal[] = [
  { emoji: "🦁", name: "狮子", continent: AFRICA },
  { emoji: "🐘", name: "大象", continent: AFRICA },
  { emoji: "🦒", name: "长颈鹿", continent: AFRICA },
  { emoji: "🦓", name: "斑马", continent: AFRICA },
  { emoji: "🐼", name: "熊猫", continent: ASIA },
  { emoji: "🐯", name: "老虎", continent: ASIA },
  { emoji: "🐒", name: "猴子", continent: ASIA },
  { emoji: "🦘", name: "袋鼠", continent: OCEANIA },
  { emoji: "🐨", name: "考拉", continent: OCEANIA },
  { emoji: "🦅", name: "白头鹰", continent: AMERICAS },
  { emoji: "🐧", name: "企鹅", continent: ANTARCTICA },
  { emoji: "🐻‍❄️", name: "北极熊", continent: ARCTIC },
];

const ALL_CONTINENTS = [ASIA, AFRICA, AMERICAS, OCEANIA, ARCTIC, ANTARCTICA];

export class AnimalContinentGame extends BaseGame {
  constructor() {
    super("animal-continent");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Animal | null = null;
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

    let pool = ANIMALS.map((_, i) => i).filter(
      (i) => !this.usedIdx.includes(i),
    );
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = ANIMALS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = ANIMALS[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), ALL_CONTINENTS.length);
    const distractors = shuffle(
      ALL_CONTINENTS.filter((c) => c !== answer.continent),
    ).slice(0, n - 1);
    const choices = shuffle([answer.continent, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Animal, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "anc-wrap";

    const task = document.createElement("div");
    task.className = "anc-task";
    task.innerHTML = `${answer.emoji} <b>${answer.name}</b> 主要住在<b>哪个洲</b>？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "anc-stage";
    const emoji = document.createElement("div");
    emoji.className = "anc-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "anc-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "anc-opt";
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
    const ok = c === this.target.continent;
    if (ok) {
      btn.classList.add("anc-opt--correct");
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
      btn.classList.add("anc-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".anc-opt--wrong")
          .forEach((el) => el.classList.remove("anc-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("anc-style")) return;
    const st = document.createElement("style");
    st.id = "anc-style";
    st.textContent = ANC_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function ANC_CSS(theme: string): string {
  return `
.anc-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.anc-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.anc-task b{color:${theme};}
.anc-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.anc-stage{padding:24px 48px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 12%,#fff));border-radius:24px;box-shadow:var(--shadow);}
.anc-emoji{font-size:5.5rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.15));}
.anc-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.anc-opts{grid-template-columns:1fr;}}
.anc-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#e6fbfc);box-shadow:var(--shadow);cursor:pointer;font-size:1.1rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.anc-opt:active{transform:scale(.95);}
.anc-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:anc-yes .4s ease;}
@keyframes anc-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.anc-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:anc-no .3s ease;}
@keyframes anc-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): AnimalContinentGame {
  return new AnimalContinentGame();
}
