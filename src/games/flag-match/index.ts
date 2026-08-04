/* 国旗配大洲 Flag Match —— 看一面国旗，选出它在哪个大洲。
   独特点：世界地理 + 大洲认知。
   巧思：用国旗 emoji + 七大洲选项，难度=选项数；通关=答对目标轮数。前缀 flm-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Flag {
  emoji: string;
  country: string;
  continent: string;
}

const ASIA = "亚洲";
const EUROPE = "欧洲";
const AFRICA = "非洲";
const AMERICAS = "美洲";
const OCEANIA = "大洋洲";

const FLAGS: Flag[] = [
  { emoji: "🇨🇳", country: "中国", continent: ASIA },
  { emoji: "🇯🇵", country: "日本", continent: ASIA },
  { emoji: "🇮🇳", country: "印度", continent: ASIA },
  { emoji: "🇰🇷", country: "韩国", continent: ASIA },
  { emoji: "🇫🇷", country: "法国", continent: EUROPE },
  { emoji: "🇬🇧", country: "英国", continent: EUROPE },
  { emoji: "🇩🇪", country: "德国", continent: EUROPE },
  { emoji: "🇮🇹", country: "意大利", continent: EUROPE },
  { emoji: "🇪🇬", country: "埃及", continent: AFRICA },
  { emoji: "🇰🇪", country: "肯尼亚", continent: AFRICA },
  { emoji: "🇿🇦", country: "南非", continent: AFRICA },
  { emoji: "🇺🇸", country: "美国", continent: AMERICAS },
  { emoji: "🇨🇦", country: "加拿大", continent: AMERICAS },
  { emoji: "🇧🇷", country: "巴西", continent: AMERICAS },
  { emoji: "🇲🇽", country: "墨西哥", continent: AMERICAS },
  { emoji: "🇦🇺", country: "澳大利亚", continent: OCEANIA },
];

const ALL_CONTINENTS = [ASIA, EUROPE, AFRICA, AMERICAS, OCEANIA];

export class FlagMatchGame extends BaseGame {
  constructor() {
    super("flag-match");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Flag | null = null;

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
    const answer = sample(FLAGS);
    this.target = answer;
    const n = Math.min(this.choiceN(), ALL_CONTINENTS.length);
    const distractors = shuffle(
      ALL_CONTINENTS.filter((c) => c !== answer.continent),
    ).slice(0, n - 1);
    const choices = shuffle([answer.continent, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Flag, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "flm-wrap";

    const task = document.createElement("div");
    task.className = "flm-task";
    task.innerHTML = `这面国旗在<b>哪个大洲</b>？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "flm-stage";
    const flag = document.createElement("div");
    flag.className = "flm-flag";
    flag.textContent = answer.emoji;
    stage.appendChild(flag);
    const name = document.createElement("div");
    name.className = "flm-name";
    name.textContent = answer.country;
    stage.appendChild(name);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "flm-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "flm-opt";
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
      btn.classList.add("flm-opt--correct");
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
      btn.classList.add("flm-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".flm-opt--wrong")
          .forEach((el) => el.classList.remove("flm-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("flm-style")) return;
    const st = document.createElement("style");
    st.id = "flm-style";
    st.textContent = FLM_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function FLM_CSS(theme: string): string {
  return `
.flm-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.flm-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.flm-task b{color:${theme};}
.flm-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.flm-stage{display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px 36px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 12%,#fff));border-radius:24px;box-shadow:var(--shadow);}
.flm-flag{font-size:5.5rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.18));}
.flm-name{font-size:1.4rem;font-weight:900;color:${theme};}
.flm-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.flm-opts{grid-template-columns:1fr;}}
.flm-opt{padding:16px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#eef4ff);box-shadow:var(--shadow);cursor:pointer;font-size:1.15rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.flm-opt:active{transform:scale(.95);}
.flm-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:flm-yes .4s ease;}
@keyframes flm-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.flm-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:flm-no .3s ease;}
@keyframes flm-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): FlagMatchGame {
  return new FlagMatchGame();
}
