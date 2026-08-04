/* 树的种类 Tree Type —— 读一段树的描述，选出它是哪种树。
   独特点：树木认知 + 类型辨认。
   巧思：描述卡片 + 类型选项；难度=选项数；通关=答对目标轮数。前缀 tri2-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Tree {
  emoji: string;
  desc: string;
  type: string;
}

const PINE = "松树";
const WILLOW = "柳树";
const OAK = "橡树";
const MAPLE = "枫树";

const TREES: Tree[] = [
  {
    emoji: "🌲",
    desc: "一年四季都是绿的，叶子像针一样尖尖的，是？",
    type: PINE,
  },
  { emoji: "🌲", desc: "冬天也不掉叶子、结松果的树，叫什么？", type: PINE },
  {
    emoji: "🌿",
    desc: "枝条长长的、软软的，垂到水面像辫子，是？",
    type: WILLOW,
  },
  { emoji: "🌳", desc: "叶子秋天变红，像手掌一样有五个尖，是？", type: MAPLE },
  {
    emoji: "🌳",
    desc: "树干粗粗的、结出圆溜溜的橡子给松鼠吃，是？",
    type: OAK,
  },
  { emoji: "🍁", desc: "秋天叶子红红的、可以做成书签的树，是？", type: MAPLE },
];

const ALL_TYPES = [PINE, WILLOW, OAK, MAPLE];

export class TreeTypeGame extends BaseGame {
  constructor() {
    super("tree-type");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Tree | null = null;
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
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 4;
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    let pool = TREES.map((_, i) => i).filter((i) => !this.usedIdx.includes(i));
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = TREES.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = TREES[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), ALL_TYPES.length);
    const distractors = shuffle(
      ALL_TYPES.filter((c) => c !== answer.type),
    ).slice(0, n - 1);
    const choices = shuffle([answer.type, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Tree, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "tri2-wrap";

    const task = document.createElement("div");
    task.className = "tri2-task";
    task.innerHTML = `这是哪一种树？<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "tri2-stage";
    const emoji = document.createElement("div");
    emoji.className = "tri2-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    const desc = document.createElement("div");
    desc.className = "tri2-desc";
    desc.textContent = answer.desc;
    stage.appendChild(desc);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "tri2-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tri2-opt";
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
      btn.classList.add("tri2-opt--correct");
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
      btn.classList.add("tri2-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".tri2-opt--wrong")
          .forEach((el) => el.classList.remove("tri2-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("tri2-style")) return;
    const st = document.createElement("style");
    st.id = "tri2-style";
    st.textContent = TRI2_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function TRI2_CSS(theme: string): string {
  return `
.tri2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.tri2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.tri2-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.tri2-stage{padding:26px 28px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 14%,#fff));border-radius:24px;box-shadow:var(--shadow);display:flex;align-items:center;gap:18px;max-width:440px;}
.tri2-emoji{font-size:4rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.18));flex-shrink:0;animation:tri2-sway 3s ease-in-out infinite;}
@keyframes tri2-sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
.tri2-desc{font-size:1.05rem;font-weight:700;color:var(--ink);line-height:1.6;}
.tri2-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.tri2-opts{grid-template-columns:1fr;}}
.tri2-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#e6f9ea);box-shadow:var(--shadow);cursor:pointer;font-size:1.15rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.tri2-opt:active{transform:scale(.95);}
.tri2-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:tri2-yes .4s ease;}
@keyframes tri2-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.tri2-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:tri2-no .3s ease;}
@keyframes tri2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): TreeTypeGame {
  return new TreeTypeGame();
}
