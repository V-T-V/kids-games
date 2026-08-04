/* 季节配自然 Season Nature —— 给一个季节，选出对应的自然现象。
   独特点：四季 + 自然现象认知。
   巧思：季节大字 + 自然现象选项；难度=选项数；通关=答对目标轮数。前缀 snt-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface NatureItem {
  emoji: string;
  text: string;
  season: string;
}

const SPRING = "春天";
const SUMMER = "夏天";
const AUTUMN = "秋天";
const WINTER = "冬天";

const ITEMS: NatureItem[] = [
  { emoji: "🌱", text: "小草发芽", season: SPRING },
  { emoji: "🌸", text: "花儿开了", season: SPRING },
  { emoji: "☀️", text: "太阳很热", season: SUMMER },
  { emoji: "🍉", text: "吃西瓜", season: SUMMER },
  { emoji: "🍁", text: "树叶变黄", season: AUTUMN },
  { emoji: "🍂", text: "落叶飘飘", season: AUTUMN },
  { emoji: "❄️", text: "下雪啦", season: WINTER },
  { emoji: "⛄", text: "堆雪人", season: WINTER },
];

const SEASONS = [SPRING, SUMMER, AUTUMN, WINTER];
const SEASON_EMOJI: Record<string, string> = {
  [SPRING]: "🌸",
  [SUMMER]: "☀️",
  [AUTUMN]: "🍁",
  [WINTER]: "❄️",
};

export class SeasonNatureGame extends BaseGame {
  constructor() {
    super("season-nature");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private season = SPRING;
  private target: NatureItem | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
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

    const season = sample(SEASONS);
    this.season = season;
    const inSeason = ITEMS.filter((it) => it.season === season);
    const answer = sample(inSeason);
    this.target = answer;

    const n = Math.min(this.choiceN(), ITEMS.length);
    const distractors = shuffle(
      ITEMS.filter((it) => it.season !== season),
    ).slice(0, n - 1);
    const choices = shuffle([answer, ...distractors]);
    this.render(season, choices);
  }

  private render(season: string, choices: NatureItem[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "snt-wrap";

    const task = document.createElement("div");
    task.className = "snt-task";
    task.innerHTML = `<b>${SEASON_EMOJI[season]!} ${season}</b>会发生什么？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const opts = document.createElement("div");
    opts.className = "snt-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "snt-opt";
      b.innerHTML = `<span class="snt-opt__emoji">${c.emoji}</span><span class="snt-opt__text">${c.text}</span>`;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(c: NatureItem, btn: HTMLButtonElement): void {
    if (this.answered || !this.target) return;
    this.answered = true;
    const ok = c.text === this.target.text;
    if (ok) {
      btn.classList.add("snt-opt--correct");
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
      btn.classList.add("snt-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".snt-opt--wrong")
          .forEach((el) => el.classList.remove("snt-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("snt-style")) return;
    const st = document.createElement("style");
    st.id = "snt-style";
    st.textContent = SNT_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SNT_CSS(theme: string): string {
  return `
.snt-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.snt-task{font-size:1.2rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.snt-task b{color:${theme};}
.snt-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.snt-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:440px;}
@media (max-width:380px){.snt-opts{grid-template-columns:1fr;}}
.snt-opt{display:flex;align-items:center;gap:10px;padding:14px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#eafbef);box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:60px;text-align:left;}
.snt-opt:active{transform:scale(.96);}
.snt-opt__emoji{font-size:1.9rem;line-height:1;}
.snt-opt__text{font-size:1.05rem;font-weight:800;color:var(--ink);}
.snt-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:snt-yes .4s ease;}
@keyframes snt-yes{0%{transform:scale(1)}50%{transform:scale(1.06)}100%{transform:scale(1)}}
.snt-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:snt-no .3s ease;}
@keyframes snt-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): SeasonNatureGame {
  return new SeasonNatureGame();
}
