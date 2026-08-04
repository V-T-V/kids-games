/* 云的类型 Cloud Type —— 读一段云的描述，选出它是哪种云。
   独特点：气象常识 + 云类辨认。
   巧思：描述卡片 + 类型选项；难度=选项数；通关=答对目标轮数。前缀 cli2-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Cloud {
  emoji: string;
  desc: string;
  type: string;
}

const CUMULUS = "积云";
const STRATUS = "层云";
const CIRRUS = "卷云";
const NIMBUS = "雨云";

const CLOUDS: Cloud[] = [
  {
    emoji: "☁️",
    desc: "一团一团像棉花糖，白白胖胖飘在低空，叫什么云？",
    type: CUMULUS,
  },
  {
    emoji: "🌫️",
    desc: "一大片灰蒙蒙盖住整片天，像一层毯子，叫什么云？",
    type: STRATUS,
  },
  {
    emoji: "🌨️",
    desc: "很高很高，像一丝一丝的羽毛，又轻又薄，叫什么云？",
    type: CIRRUS,
  },
  { emoji: "🌧️", desc: "黑黑的，会下大雨，叫什么云？", type: NIMBUS },
  {
    emoji: "☁️",
    desc: "夏天晴天常见的、像花椰菜一样的白云是？",
    type: CUMULUS,
  },
  {
    emoji: "🌫️",
    desc: "贴着地面、灰灰一层、像大雾一样的云是？",
    type: STRATUS,
  },
];

const ALL_TYPES = [CUMULUS, STRATUS, CIRRUS, NIMBUS];

export class CloudTypeGame extends BaseGame {
  constructor() {
    super("cloud-type");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Cloud | null = null;
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

    let pool = CLOUDS.map((_, i) => i).filter((i) => !this.usedIdx.includes(i));
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = CLOUDS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = CLOUDS[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), ALL_TYPES.length);
    const distractors = shuffle(
      ALL_TYPES.filter((c) => c !== answer.type),
    ).slice(0, n - 1);
    const choices = shuffle([answer.type, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Cloud, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "cli2-wrap";

    const task = document.createElement("div");
    task.className = "cli2-task";
    task.innerHTML = `这是哪一种云？<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "cli2-stage";
    const emoji = document.createElement("div");
    emoji.className = "cli2-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    const desc = document.createElement("div");
    desc.className = "cli2-desc";
    desc.textContent = answer.desc;
    stage.appendChild(desc);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "cli2-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cli2-opt";
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
      btn.classList.add("cli2-opt--correct");
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
      btn.classList.add("cli2-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".cli2-opt--wrong")
          .forEach((el) => el.classList.remove("cli2-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("cli2-style")) return;
    const st = document.createElement("style");
    st.id = "cli2-style";
    st.textContent = CLI2_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function CLI2_CSS(theme: string): string {
  return `
.cli2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.cli2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.cli2-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.cli2-stage{padding:26px 28px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 14%,#fff));border-radius:24px;box-shadow:var(--shadow);display:flex;align-items:center;gap:18px;max-width:440px;}
.cli2-emoji{font-size:4rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.18));flex-shrink:0;animation:cli2-float 4s ease-in-out infinite;}
@keyframes cli2-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.cli2-desc{font-size:1.05rem;font-weight:700;color:var(--ink);line-height:1.6;}
.cli2-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.cli2-opts{grid-template-columns:1fr;}}
.cli2-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#e6f0fc);box-shadow:var(--shadow);cursor:pointer;font-size:1.15rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.cli2-opt:active{transform:scale(.95);}
.cli2-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:cli2-yes .4s ease;}
@keyframes cli2-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.cli2-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:cli2-no .3s ease;}
@keyframes cli2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): CloudTypeGame {
  return new CloudTypeGame();
}
