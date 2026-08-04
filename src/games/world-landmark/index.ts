/* 世界地标 World Landmark —— 看一个著名地标的 emoji，选出它所在的国家。
   独特点：世界地理常识启蒙，地标 + 国旗色卡片。
   巧思：每个地标配一句小知识；难度=选项数；通关=答对目标轮数。前缀 wlm-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Landmark {
  emoji: string;
  name: string;
  country: string;
  flag: string; // 国旗 emoji
  fact: string;
}

const LANDMARKS: Landmark[] = [
  {
    emoji: "🗼",
    name: "埃菲尔铁塔",
    country: "法国",
    flag: "🇫🇷",
    fact: "它在巴黎，是用钢铁造的",
  },
  {
    emoji: "🗽",
    name: "自由女神像",
    country: "美国",
    flag: "🇺🇸",
    fact: "它在纽约港口",
  },
  {
    emoji: "⛩️",
    name: "鸟居",
    country: "日本",
    flag: "🇯🇵",
    fact: "它常常在水边，红红的",
  },
  {
    emoji: "🏯",
    name: "长城",
    country: "中国",
    flag: "🇨🇳",
    fact: "它很长很长，挡坏人",
  },
  {
    emoji: "🗿",
    name: "复活节石像",
    country: "智利",
    flag: "🇨🇱",
    fact: "它们是一排排大石头脸",
  },
  {
    emoji: "🕌",
    name: "泰姬陵",
    country: "印度",
    flag: "🇮🇳",
    fact: "它白白的，像个大宝石",
  },
  {
    emoji: "🏛️",
    name: "帕特农神庙",
    country: "希腊",
    flag: "🇬🇷",
    fact: "它有很多大柱子",
  },
  {
    emoji: "🏰",
    name: "新天鹅堡",
    country: "德国",
    flag: "🇩🇪",
    fact: "它像童话里的城堡",
  },
  {
    emoji: "🎪",
    name: "斗兽场",
    country: "意大利",
    flag: "🇮🇹",
    fact: "它是圆圆的大圆圈",
  },
  {
    emoji: "🦘",
    name: "悉尼歌剧院",
    country: "澳大利亚",
    flag: "🇦🇺",
    fact: "它像张开的大贝壳",
  },
  {
    emoji: "🔺",
    name: "金字塔",
    country: "埃及",
    flag: "🇪🇬",
    fact: "它三角形的，很古老",
  },
];

export class WorldLandmarkGame extends BaseGame {
  constructor() {
    super("world-landmark");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Landmark | null = null;

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

  /** 选项数：easy 3 / medium 4 / hard 5（不超过国家总数） */
  private choiceN(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const answer = sample(LANDMARKS);
    this.target = answer;
    const n = Math.min(this.choiceN(), LANDMARKS.length);
    const distractors = shuffle(
      LANDMARKS.filter((l) => l.country !== answer.country),
    ).slice(0, n - 1);
    const choices = shuffle([answer, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Landmark, choices: Landmark[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "wlm-wrap";

    const task = document.createElement("div");
    task.className = "wlm-task";
    task.innerHTML = `这个地标在<b>哪个国家</b>？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "wlm-stage";
    const emoji = document.createElement("div");
    emoji.className = "wlm-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    const name = document.createElement("div");
    name.className = "wlm-name";
    name.textContent = answer.name;
    stage.appendChild(name);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "wlm-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wlm-opt";
      b.innerHTML = `<span class="wlm-opt__flag">${c.flag}</span><span class="wlm-opt__name">${c.country}</span>`;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(c: Landmark, btn: HTMLButtonElement): void {
    if (this.answered || !this.target) return;
    this.answered = true;
    const ok = c.country === this.target.country;
    if (ok) {
      btn.classList.add("wlm-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      sfxPop();
      // 显示小知识
      this.showFact(this.target);
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1400);
    } else {
      btn.classList.add("wlm-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".wlm-opt--wrong")
          .forEach((el) => el.classList.remove("wlm-opt--wrong"));
      }, 750);
    }
  }

  private showFact(target: Landmark): void {
    const fact = document.createElement("div");
    fact.className = "wlm-fact";
    fact.textContent = `${target.flag} ${target.fact}`;
    this.root.querySelector(".wlm-stage")?.appendChild(fact);
  }

  private injectStyle(): void {
    if (document.getElementById("wlm-style")) return;
    const st = document.createElement("style");
    st.id = "wlm-style";
    st.textContent = WLM_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function WLM_CSS(theme: string): string {
  return `
.wlm-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.wlm-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.wlm-task b{color:${theme};}
.wlm-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.wlm-stage{display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px 32px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 12%,#fff));border-radius:24px;box-shadow:var(--shadow);width:min(360px,100%);}
.wlm-emoji{font-size:5rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.15));}
.wlm-name{font-size:1.4rem;font-weight:900;color:${theme};}
.wlm-fact{margin-top:6px;font-size:.9rem;font-weight:700;color:var(--ink-soft);text-align:center;background:#fff;padding:8px 14px;border-radius:999px;animation:wlm-in .4s ease;}
@keyframes wlm-in{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
.wlm-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.wlm-opts{grid-template-columns:1fr;}}
.wlm-opt{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#f3f0fa);box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.wlm-opt:active{transform:scale(.95);}
.wlm-opt__flag{font-size:1.7rem;line-height:1;}
.wlm-opt__name{font-size:1.05rem;font-weight:800;color:var(--ink);}
.wlm-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:wlm-yes .4s ease;}
@keyframes wlm-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.wlm-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:wlm-no .3s ease;}
@keyframes wlm-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): WorldLandmarkGame {
  return new WorldLandmarkGame();
}
