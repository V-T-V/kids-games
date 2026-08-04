/* 泳道编号 Swim Lane —— 游泳池里几条编号泳道，题目喊"跳到 4 号泳道"，
   孩子点对应编号的泳道。独特点：把"认数字"包进泳池场景，每条泳道有
   浮标小人游动，点对了小人欢呼。难度=泳道数（4/5/6）。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

export class SwimLaneGame extends BaseGame {
  constructor() {
    super("swim-lane");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private laneCount = 0;
  private target = 0; // 本轮目标泳道编号（1..laneCount）

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.laneCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由基类清空；定时器由基类清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    // 随机目标，保证和上一轮不同更有趣
    let t = randInt(1, this.laneCount);
    if (this.laneCount > 1 && t === this.target) {
      t = (t % this.laneCount) + 1;
    }
    this.target = t;

    const wrap = document.createElement("div");
    wrap.className = "swl-wrap";

    const task = document.createElement("div");
    task.className = "swl-task";
    task.innerHTML = `跳到 <b>${this.target}</b> 号泳道！（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const pool = document.createElement("div");
    pool.className = "swl-pool";
    for (let i = 1; i <= this.laneCount; i++) {
      const lane = document.createElement("button");
      lane.type = "button";
      lane.className = "swl-lane";
      lane.style.setProperty("--idx", String(i % 2));
      const num = document.createElement("span");
      num.className = "swl-lane__num";
      num.textContent = String(i);
      lane.appendChild(num);
      const swimmer = document.createElement("span");
      swimmer.className = "swl-lane__swim";
      swimmer.style.animationDelay = `${(i % 3) * 0.4}s`;
      swimmer.textContent = "🏊";
      lane.appendChild(swimmer);
      lane.addEventListener("click", () => this.tap(i, lane));
      pool.appendChild(lane);
    }
    wrap.appendChild(pool);
    this.root.appendChild(wrap);
  }

  private tap(i: number, lane: HTMLButtonElement): void {
    if (lane.disabled) return;
    if (i === this.target) {
      lane.classList.add("swl-lane--on");
      lane.disabled = true;
      sfxPop();
      const r = lane.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 850);
    } else {
      lane.classList.add("swl-lane--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => lane.classList.remove("swl-lane--wrong"), 420);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `找一找上面写着 <b>${this.target}</b> 的那条泳道～`,
      primary: {
        text: "继续",
        icon: "🏊",
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
    if (document.getElementById("swl-style")) return;
    const st = document.createElement("style");
    st.id = "swl-style";
    st.textContent = SWL_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function SWL_CSS(theme: string): string {
  return `
.swl-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.swl-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.swl-task b{color:${theme};font-size:1.4rem;}
.swl-pool{display:flex;flex-direction:column;gap:8px;width:100%;padding:16px;border-radius:22px;background:linear-gradient(180deg,#7ec8ff,#4aa8e8);box-shadow:var(--shadow-lg);position:relative;overflow:hidden;}
.swl-pool::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 18px,rgba(255,255,255,.12) 18px 22px);pointer-events:none;}
.swl-lane{position:relative;display:flex;align-items:center;justify-content:space-between;padding:0 18px;height:62px;border:none;border-radius:12px;background:linear-gradient(90deg,rgba(255,255,255,.18),rgba(255,255,255,.06));box-shadow:inset 0 0 0 2px rgba(255,255,255,.4);cursor:pointer;transition:transform .1s ease,background .2s;}
.swl-lane:nth-child(even){background:linear-gradient(90deg,rgba(255,255,255,.08),rgba(255,255,255,.02));}
.swl-lane:active{transform:scale(.985);}
.swl-lane__num{font-size:1.8rem;font-weight:900;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.35);width:46px;height:46px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.25);border-radius:50%;box-shadow:inset 0 0 0 3px rgba(255,255,255,.6);}
.swl-lane__swim{font-size:1.7rem;animation:swl-swim 1.6s ease-in-out infinite;}
@keyframes swl-swim{0%,100%{transform:translateX(-6px)}50%{transform:translateX(6px)}}
.swl-lane--on{background:linear-gradient(90deg,#fff,#e7ffe9)!important;box-shadow:0 0 0 4px #6bcf7f,0 8px 18px rgba(0,0,0,.2);}
.swl-lane--on .swl-lane__num{color:#2e8b57;background:#fff;}
.swl-lane--on .swl-lane__swim{animation:swl-cheer .5s ease infinite;}
@keyframes swl-cheer{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-8px) rotate(6deg)}}
.swl-lane--wrong{animation:swl-shake .4s ease;background:rgba(255,99,72,.45)!important;}
@keyframes swl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
@media (max-width:380px){.swl-lane{height:54px;}.swl-lane__num{font-size:1.5rem;width:40px;height:40px;}.swl-lane__swim{font-size:1.4rem;}}
`;
}

export function create(): SwimLaneGame {
  return new SwimLaneGame();
}
