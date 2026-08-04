/* 昼夜变化 Day Night Cycle —— 地球自转产生昼夜。
   给一个场景（如「星星出来了」），孩子选对应的时间（早晨/中午/傍晚/夜晚）。
   难度=时间段数量：easy 2 段（白天/黑夜）、medium 3 段（早/中/晚）、hard 4 段（晨/午/昏/夜）。
   巧思：太阳/月亮在天空中的位置随时间段移动（CSS 定位），背景颜色也随之变化；
         地球🌍 在底部缓慢自转，强化「转一圈=一天」的认知。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Phase {
  id: string;
  name: string;
  emoji: string;
  /** 天空背景渐变 */
  sky: string;
  /** 太阳/月亮在天空的位置（left%）与显示哪个 */
  body: { icon: "sun" | "moon"; left: number; top: number };
  /** 代表场景描述 */
  scene: string;
}
const PHASES: Phase[] = [
  {
    id: "morning",
    name: "早晨",
    emoji: "🌅",
    sky: "linear-gradient(180deg,#ffd9a0,#a8e6ff)",
    body: { icon: "sun", left: 18, top: 55 },
    scene: "太阳刚升起来",
  },
  {
    id: "noon",
    name: "中午",
    emoji: "☀️",
    sky: "linear-gradient(180deg,#ffe680,#bfe8ff)",
    body: { icon: "sun", left: 50, top: 14 },
    scene: "太阳在最高处",
  },
  {
    id: "evening",
    name: "傍晚",
    emoji: "🌆",
    sky: "linear-gradient(180deg,#ff9a6b,#ffb3d9)",
    body: { icon: "sun", left: 82, top: 55 },
    scene: "太阳快落山了",
  },
  {
    id: "night",
    name: "夜晚",
    emoji: "🌙",
    sky: "linear-gradient(180deg,#1a1f4a,#3a2a5a)",
    body: { icon: "moon", left: 70, top: 22 },
    scene: "星星出来了",
  },
];

export class DayNightCycleGame extends BaseGame {
  constructor() {
    super("day-night-cycle");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 难度→可选时段集合。 */
  private pickPhases(): Phase[] {
    if (this.difficulty === "easy") {
      // 2 段：白天 vs 黑夜
      return [PHASES[1]!, PHASES[3]!]; // 中午 / 夜晚
    }
    if (this.difficulty === "medium") {
      // 3 段：早 / 中 / 晚
      return [PHASES[0]!, PHASES[1]!, PHASES[2]!];
    }
    return PHASES; // 4 段全
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const pool = this.pickPhases();
    const target = sample(pool);

    const wrap = document.createElement("div");
    wrap.className = "dncyc-wrap";

    const task = document.createElement("div");
    task.className = "dncyc-task";
    task.innerHTML = `看到 <b>「${target.scene}」</b>，是什么时候？<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 关</small>`;
    wrap.appendChild(task);

    // 天空舞台
    const stage = document.createElement("div");
    stage.className = "dncyc-sky";
    stage.style.background = target.sky;
    // 星星（夜晚才显示）
    if (target.body.icon === "moon") {
      for (let i = 0; i < 12; i++) {
        const s = document.createElement("div");
        s.className = "dncyc-star";
        s.textContent = "⭐";
        s.style.left = `${Math.random() * 90}%`;
        s.style.top = `${Math.random() * 40}%`;
        s.style.animationDelay = `${Math.random() * 2}s`;
        stage.appendChild(s);
      }
    }
    // 太阳/月亮
    const body = document.createElement("div");
    body.className = "dncyc-body";
    body.textContent = target.body.icon === "sun" ? "☀️" : "🌙";
    body.style.left = `${target.body.left}%`;
    body.style.top = `${target.body.top}%`;
    stage.appendChild(body);
    // 地球（自转）
    const earth = document.createElement("div");
    earth.className = "dncyc-earth";
    earth.textContent = "🌍";
    stage.appendChild(earth);
    wrap.appendChild(stage);

    // 选项
    const board = document.createElement("div");
    board.className = "dncyc-board";
    shuffle(pool).forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dncyc-choice";
      b.innerHTML = `<span class="dncyc-choice__emoji">${p.emoji}</span><span class="dncyc-choice__name">${p.name}</span>`;
      b.addEventListener("click", () => this.choose(p, target, b));
      board.appendChild(b);
    });
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private choose(p: Phase, target: Phase, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (p.id === target.id) {
      this.answered = true;
      sfxPop();
      btn.classList.add("dncyc-choice--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1200);
    } else {
      btn.classList.add("dncyc-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("dncyc-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌍",
      variant: "rest",
      body: "看看天上是什么，再选时间～",
      primary: { text: "继续", icon: "🎈", onClick: () => ov.destroy() },
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
    if (document.getElementById("dncyc-style")) return;
    const st = document.createElement("style");
    st.id = "dncyc-style";
    st.textContent = DNCYC_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function DNCYC_CSS(theme: string): string {
  return `
.dncyc-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(460px,100%);}
.dncyc-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);}
.dncyc-task b{color:${theme};}
.dncyc-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.dncyc-sky{position:relative;width:100%;height:200px;border-radius:22px;overflow:hidden;box-shadow:var(--shadow-lg);transition:background .6s ease;}
.dncyc-body{position:absolute;font-size:2.6rem;transform:translate(-50%,-50%);filter:drop-shadow(0 0 10px rgba(255,255,255,.6));transition:all .5s ease;}
.dncyc-star{position:absolute;font-size:.9rem;animation:dncyc-twinkle 2s ease-in-out infinite;}
@keyframes dncyc-twinkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
.dncyc-earth{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:2.2rem;animation:dncyc-spin 6s linear infinite;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));}
@keyframes dncyc-spin{to{transform:translateX(-50%) rotate(360deg)}}
.dncyc-board{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.dncyc-choice{min-width:84px;min-height:74px;border-radius:18px;border:none;background:#fff;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;}
.dncyc-choice:active{transform:scale(.94);}
.dncyc-choice__emoji{font-size:1.8rem;}
.dncyc-choice__name{font-size:.95rem;font-weight:800;color:var(--ink);}
.dncyc-choice--done{background:#d4f4dd;animation:dncyc-pop .4s ease;}
.dncyc-choice--wrong{animation:dncyc-shake .4s ease;}
@keyframes dncyc-pop{0%{transform:scale(.6)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes dncyc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): DayNightCycleGame {
  return new DayNightCycleGame();
}
