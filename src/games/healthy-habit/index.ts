/* 健康习惯 Healthy Habit —— 看一个行为图片，判断是好习惯（✅）还是坏习惯（❌）。
   独特点：生活常识 + 好坏判断。
   巧思：两个大按钮（好/坏），点击判断；难度=题数；通关=答对目标轮数。前缀 hlh-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface Habit {
  emoji: string;
  text: string;
  good: boolean;
}

const HABITS: Habit[] = [
  { emoji: "🦷", text: "每天刷牙", good: true },
  { emoji: "💧", text: "饭前洗手", good: true },
  { emoji: "🥗", text: "吃蔬菜", good: true },
  { emoji: "🏃", text: "出去运动", good: true },
  { emoji: "😴", text: "早早睡觉", good: true },
  { emoji: "💧", text: "多喝水", good: true },
  { emoji: "📚", text: "看书学习", good: true },
  { emoji: "🍭", text: "吃很多糖", good: false },
  { emoji: "📱", text: "看很久手机", good: false },
  { emoji: "🍔", text: "只吃零食", good: false },
  { emoji: "🛏️", text: "很晚才睡", good: false },
  { emoji: "🍫", text: "睡前吃糖", good: false },
];

export class HealthyHabitGame extends BaseGame {
  constructor() {
    super("healthy-habit");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Habit | null = null;
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

    // 平衡好/坏习惯
    let pool = HABITS.map((_, i) => i).filter((i) => !this.usedIdx.includes(i));
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = HABITS.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = HABITS[ansIdx]!;
    this.target = answer;
    this.render(answer);
  }

  private render(answer: Habit): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "hlh-wrap";

    const task = document.createElement("div");
    task.className = "hlh-task";
    task.innerHTML = `这是<b>好习惯</b>还是<b>坏习惯</b>？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "hlh-stage";
    const emoji = document.createElement("div");
    emoji.className = "hlh-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    const text = document.createElement("div");
    text.className = "hlh-text";
    text.textContent = answer.text;
    stage.appendChild(text);
    wrap.appendChild(stage);

    // 反馈条
    const fb = document.createElement("div");
    fb.className = "hlh-feedback";
    fb.id = "hlh-fb";
    wrap.appendChild(fb);

    const opts = document.createElement("div");
    opts.className = "hlh-opts";
    const goodBtn = document.createElement("button");
    goodBtn.type = "button";
    goodBtn.className = "hlh-opt hlh-opt--good";
    goodBtn.innerHTML = `<span class="hlh-opt__icon">✅</span><span class="hlh-opt__label">好习惯</span>`;
    goodBtn.addEventListener("click", () => this.choose(true, goodBtn));
    const badBtn = document.createElement("button");
    badBtn.type = "button";
    badBtn.className = "hlh-opt hlh-opt--bad";
    badBtn.innerHTML = `<span class="hlh-opt__icon">❌</span><span class="hlh-opt__label">坏习惯</span>`;
    badBtn.addEventListener("click", () => this.choose(false, badBtn));
    opts.appendChild(goodBtn);
    opts.appendChild(badBtn);
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(saidGood: boolean, btn: HTMLButtonElement): void {
    if (this.answered || !this.target) return;
    this.answered = true;
    const ok = saidGood === this.target.good;
    const fb = this.root.querySelector<HTMLElement>("#hlh-fb");
    if (ok) {
      btn.classList.add("hlh-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      sfxPop();
      if (fb) {
        fb.textContent = this.target.good
          ? "对！这是好习惯，要坚持哦～"
          : "对！这是坏习惯，要少做哦～";
        fb.classList.add("hlh-feedback--ok");
      }
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    } else {
      btn.classList.add("hlh-opt--wrong");
      if (fb) {
        fb.textContent = "再想想～";
        fb.classList.add("hlh-feedback--no");
      }
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".hlh-opt--wrong")
          .forEach((el) => el.classList.remove("hlh-opt--wrong"));
        if (fb) {
          fb.textContent = "";
          fb.classList.remove("hlh-feedback--no");
        }
      }, 850);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("hlh-style")) return;
    const st = document.createElement("style");
    st.id = "hlh-style";
    st.textContent = HLH_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function HLH_CSS(theme: string): string {
  return `
.hlh-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.hlh-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.hlh-task b{color:${theme};}
.hlh-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.hlh-stage{display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px 40px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 10%,#fff));border-radius:24px;box-shadow:var(--shadow);min-width:220px;}
.hlh-emoji{font-size:5rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.15));}
.hlh-text{font-size:1.4rem;font-weight:900;color:${theme};}
.hlh-feedback{min-height:28px;font-size:1rem;font-weight:800;text-align:center;transition:all .2s ease;}
.hlh-feedback--ok{color:#2e9e51;}
.hlh-feedback--no{color:#ff6348;}
.hlh-opts{display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%;max-width:420px;}
.hlh-opt{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:18px 12px;border:3px solid transparent;border-radius:20px;background:linear-gradient(160deg,#fff,#f5fff7);box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:90px;}
.hlh-opt:active{transform:scale(.95);}
.hlh-opt--bad{background:linear-gradient(160deg,#fff,#fff5f3);}
.hlh-opt__icon{font-size:2.2rem;line-height:1;}
.hlh-opt__label{font-size:1.2rem;font-weight:900;color:var(--ink);}
.hlh-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:hlh-yes .4s ease;}
@keyframes hlh-yes{0%{transform:scale(1)}50%{transform:scale(1.06)}100%{transform:scale(1)}}
.hlh-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:hlh-no .3s ease;}
@keyframes hlh-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): HealthyHabitGame {
  return new HealthyHabitGame();
}
