/* 美食配国家 Food World —— 看一道美食 emoji，选出它来自哪个国家。
   独特点：世界饮食文化启蒙。
   巧思：美食大 emoji + 国旗选项；难度=选项数；通关=答对目标轮数。前缀 fdw-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Food {
  emoji: string;
  name: string;
  country: string;
  flag: string;
}

const FOODS: Food[] = [
  { emoji: "🍣", name: "寿司", country: "日本", flag: "🇯🇵" },
  { emoji: "🍕", name: "披萨", country: "意大利", flag: "🇮🇹" },
  { emoji: "🍔", name: "汉堡", country: "美国", flag: "🇺🇸" },
  { emoji: "🥐", name: "牛角包", country: "法国", flag: "🇫🇷" },
  { emoji: "🌮", name: "墨西哥卷", country: "墨西哥", flag: "🇲🇽" },
  { emoji: "🥟", name: "饺子", country: "中国", flag: "🇨🇳" },
  { emoji: "🍜", name: "拉面", country: "日本", flag: "🇯🇵" },
  { emoji: "🍗", name: "炸鸡", country: "韩国", flag: "🇰🇷" },
  { emoji: "🍪", name: "饼干", country: "英国", flag: "🇬🇧" },
  { emoji: "🌯", name: "卷饼", country: "墨西哥", flag: "🇲🇽" },
];

export class FoodWorldGame extends BaseGame {
  constructor() {
    super("food-world");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Food | null = null;
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

    let pool = FOODS.map((_, i) => i).filter((i) => !this.usedIdx.includes(i));
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = FOODS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = FOODS[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), FOODS.length);
    // 干扰项国家需与答案国家不同
    const distractors = shuffle(
      FOODS.filter((f) => f.country !== answer.country),
    ).slice(0, n - 1);
    const choices = shuffle([answer, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Food, choices: Food[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "fdw-wrap";

    const task = document.createElement("div");
    task.className = "fdw-task";
    task.innerHTML = `这个美食来自<b>哪个国家</b>？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "fdw-stage";
    const emoji = document.createElement("div");
    emoji.className = "fdw-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    const name = document.createElement("div");
    name.className = "fdw-name";
    name.textContent = answer.name;
    stage.appendChild(name);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "fdw-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fdw-opt";
      b.innerHTML = `<span class="fdw-opt__flag">${c.flag}</span><span class="fdw-opt__name">${c.country}</span>`;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(c: Food, btn: HTMLButtonElement): void {
    if (this.answered || !this.target) return;
    this.answered = true;
    const ok = c.country === this.target.country;
    if (ok) {
      btn.classList.add("fdw-opt--correct");
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
      btn.classList.add("fdw-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".fdw-opt--wrong")
          .forEach((el) => el.classList.remove("fdw-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("fdw-style")) return;
    const st = document.createElement("style");
    st.id = "fdw-style";
    st.textContent = FDW_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function FDW_CSS(theme: string): string {
  return `
.fdw-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.fdw-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.fdw-task b{color:${theme};}
.fdw-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.fdw-stage{display:flex;flex-direction:column;align-items:center;gap:6px;padding:24px 40px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 12%,#fff));border-radius:24px;box-shadow:var(--shadow);}
.fdw-emoji{font-size:5rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.15));}
.fdw-name{font-size:1.4rem;font-weight:900;color:${theme};}
.fdw-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.fdw-opts{grid-template-columns:1fr;}}
.fdw-opt{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#ffeeea);box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.fdw-opt:active{transform:scale(.95);}
.fdw-opt__flag{font-size:1.7rem;line-height:1;}
.fdw-opt__name{font-size:1.05rem;font-weight:800;color:var(--ink);}
.fdw-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:fdw-yes .4s ease;}
@keyframes fdw-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.fdw-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:fdw-no .3s ease;}
@keyframes fdw-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): FoodWorldGame {
  return new FoodWorldGame();
}
