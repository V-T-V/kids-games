/* 体操评分排序 Gymnastics Score —— 几个体操选手的表演图，各带一个表现分数，
   孩子按分数从高到低依次点击选手排序。独特点：每个选手有体操动作 emoji，
   分数醒目显示；按对顺序点亮，排错温柔提示。难度=选手数（3/4/5）。
   通关=排对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Gymnast {
  score: number; // 表现分（排序键）
  emoji: string;
}

const POOL: Gymnast[] = [
  { score: 9, emoji: "🤸" },
  { score: 8, emoji: "💃" },
  { score: 7, emoji: "🤹" },
  { score: 6, emoji: "🙆" },
  { score: 10, emoji: "🤾" },
];

export class GymnasticsScoreGame extends BaseGame {
  constructor() {
    super("gymnastics-score");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private count = 0;
  private lineup: Gymnast[] = []; // 正确顺序（高→低）
  private nextIdx = 0;
  private placed = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.count =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由基类清空；定时器由基类清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.nextIdx = 0;
    this.placed = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 从池中选 count 个不同分数，按高到低排（保证有解、分数不重复）
    const picked = shuffle(POOL).slice(0, this.count);
    this.lineup = [...picked].sort((a, b) => b.score - a.score);
    // 展示顺序打乱（保证不直接就是答案）
    const display = shuffle(picked);

    const wrap = document.createElement("div");
    wrap.className = "gsc-wrap";

    const task = document.createElement("div");
    task.className = "gsc-task";
    task.innerHTML = `先点分数最高的选手 🤸，一个个排好～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 排序结果栏（从高到低的槽位）
    const podium = document.createElement("div");
    podium.className = "gsc-podium";
    this.lineup.forEach((g, i) => {
      const slot = document.createElement("div");
      slot.className = "gsc-slot";
      slot.dataset.idx = String(i);
      const lbl = document.createElement("span");
      lbl.className = "gsc-slot__rank";
      lbl.textContent = `第${i + 1}`;
      const star = document.createElement("span");
      star.className = "gsc-slot__score";
      star.dataset.score = String(g.score);
      star.textContent = `${g.score} 分`;
      slot.appendChild(lbl);
      slot.appendChild(star);
      podium.appendChild(slot);
    });
    wrap.appendChild(podium);

    // 选手卡片（待点）
    const stage = document.createElement("div");
    stage.className = "gsc-stage";
    display.forEach((g) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gsc-card";
      btn.dataset.score = String(g.score);
      btn.innerHTML = `<span class="gsc-card__emoji">${g.emoji}</span><span class="gsc-card__score">${g.score} 分</span>`;
      btn.addEventListener("click", () => this.tap(g, btn, podium));
      stage.appendChild(btn);
    });
    wrap.appendChild(stage);

    this.root.appendChild(wrap);
  }

  private tap(g: Gymnast, btn: HTMLButtonElement, podium: HTMLElement): void {
    if (btn.disabled) return;
    const expected = this.lineup[this.nextIdx];
    if (!expected) return;
    if (g.score === expected.score) {
      btn.disabled = true;
      btn.classList.add("gsc-card--used");
      // 点亮对应槽位
      const slots = podium.querySelectorAll(".gsc-slot");
      const slot = slots[this.nextIdx];
      if (slot) {
        slot.classList.add("gsc-slot--on");
        const emojiWrap = document.createElement("span");
        emojiWrap.className = "gsc-slot__emoji";
        emojiWrap.textContent = g.emoji;
        slot.appendChild(emojiWrap);
      }
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.nextIdx += 1;
      this.placed += 1;
      if (this.placed >= this.count) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 950);
      }
    } else {
      btn.classList.add("gsc-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("gsc-card--wrong"), 420);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "比一比谁的分数大，先点分数最大的选手～",
      primary: {
        text: "继续",
        icon: "🤸",
        onClick: () => ov.destroy(),
      },
      secondary: {
        text: "回大厅",
        icon: "🏠",
        onClick: () => {
          ov.destroy();
          navigate("");
        },
      },
    });
    ov.show();
  }

  private injectStyle(): void {
    if (document.getElementById("gsc-style")) return;
    const st = document.createElement("style");
    st.id = "gsc-style";
    st.textContent = GSC_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function GSC_CSS(theme: string): string {
  return `
.gsc-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.gsc-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.gsc-task b{color:${theme};}
.gsc-podium{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
.gsc-slot{position:relative;width:88px;height:78px;border-radius:14px;background:rgba(255,255,255,.5);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;box-shadow:var(--shadow);opacity:.55;transition:all .3s cubic-bezier(.34,1.56,.64,1);}
.gsc-slot--on{opacity:1;background:linear-gradient(180deg,#fff,#f0e6ff);transform:translateY(-4px);box-shadow:0 8px 14px rgba(0,0,0,.18);}
.gsc-slot__rank{font-size:.8rem;font-weight:800;color:var(--ink-soft);}
.gsc-slot__score{font-size:1.1rem;font-weight:900;color:${theme};}
.gsc-slot__emoji{position:absolute;top:-26px;font-size:1.8rem;animation:gsc-pop .4s ease;}
@keyframes gsc-pop{0%{transform:scale(.3);opacity:0}100%{transform:scale(1);opacity:1}}
.gsc-stage{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:8px;min-height:120px;align-items:flex-end;}
.gsc-card{width:96px;height:118px;border:none;border-radius:18px;cursor:pointer;background:linear-gradient(180deg,#fff,#fce9ff);box-shadow:0 4px 0 #e3c8f0,var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;transition:transform .1s ease;}
.gsc-card:active{transform:translateY(3px);box-shadow:0 1px 0 #e3c8f0,var(--shadow);}
.gsc-card__emoji{font-size:2.6rem;}
.gsc-card__score{font-size:1.1rem;font-weight:900;color:var(--ink);background:${theme};color:#fff;padding:2px 10px;border-radius:999px;}
.gsc-card--used{opacity:.3;cursor:default;transform:scale(.85);}
.gsc-card--wrong{animation:gsc-shake .4s ease;}
@keyframes gsc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
@media (max-width:380px){.gsc-card{width:78px;height:100px;}.gsc-card__emoji{font-size:2.1rem;}.gsc-slot{width:72px;height:66px;}}
`;
}

export function create(): GymnasticsScoreGame {
  return new GymnasticsScoreGame();
}
