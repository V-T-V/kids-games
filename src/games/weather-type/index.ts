/* 天气类型 Weather Type —— 看一个天气场景 emoji，选出对应的天气名称。
   独特点：天气认知 + 词汇。
   巧思：场景大 emoji + 天气名称选项；难度=选项数；通关=答对目标轮数。前缀 wty-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Weather {
  emoji: string;
  name: string;
}

const WEATHERS: Weather[] = [
  { emoji: "☀️", name: "晴天" },
  { emoji: "🌤️", name: "多云" },
  { emoji: "🌧️", name: "雨天" },
  { emoji: "⛈️", name: "雷雨" },
  { emoji: "❄️", name: "下雪" },
  { emoji: "💨", name: "刮风" },
  { emoji: "🌫️", name: "雾天" },
  { emoji: "🌈", name: "彩虹" },
];

export class WeatherTypeGame extends BaseGame {
  constructor() {
    super("weather-type");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Weather | null = null;
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

    let pool = WEATHERS.map((_, i) => i).filter(
      (i) => !this.usedIdx.includes(i),
    );
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = WEATHERS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = WEATHERS[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), WEATHERS.length);
    const distractors = shuffle(
      WEATHERS.filter((w) => w.name !== answer.name),
    ).slice(0, n - 1);
    const choices = shuffle([answer, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Weather, choices: Weather[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "wty-wrap";

    const task = document.createElement("div");
    task.className = "wty-task";
    task.innerHTML = `这是什么<b>天气</b>？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "wty-stage";
    const emoji = document.createElement("div");
    emoji.className = "wty-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "wty-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wty-opt";
      b.textContent = c.name;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(c: Weather, btn: HTMLButtonElement): void {
    if (this.answered || !this.target) return;
    this.answered = true;
    const ok = c.name === this.target.name;
    if (ok) {
      btn.classList.add("wty-opt--correct");
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
      btn.classList.add("wty-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".wty-opt--wrong")
          .forEach((el) => el.classList.remove("wty-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("wty-style")) return;
    const st = document.createElement("style");
    st.id = "wty-style";
    st.textContent = WTY_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function WTY_CSS(theme: string): string {
  return `
.wty-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.wty-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.wty-task b{color:${theme};}
.wty-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.wty-stage{padding:28px 52px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 14%,#fff));border-radius:24px;box-shadow:var(--shadow);}
.wty-emoji{font-size:5.5rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.15));}
.wty-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.wty-opts{grid-template-columns:1fr;}}
.wty-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#e6fcff);box-shadow:var(--shadow);cursor:pointer;font-size:1.15rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.wty-opt:active{transform:scale(.95);}
.wty-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:wty-yes .4s ease;}
@keyframes wty-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.wty-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:wty-no .3s ease;}
@keyframes wty-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): WeatherTypeGame {
  return new WeatherTypeGame();
}
