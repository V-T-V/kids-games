/* 钟楼 Clock Tower —— 两座钟并排，一座显示目标时间、一座显示错误时间，
   孩子点选显示正确时间（目标时间）的那座。
   巧思：CSS 指针式时钟（带 1-12 数字、时针+分针），难度=时间复杂度
   （easy 整点 / medium 半点 / hard 一刻）。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

interface ClockTime {
  hour: number; // 1-12
  min: number; // 0 / 15 / 30 / 45
}

export class ClockTowerGame extends BaseGame {
  constructor() {
    super("clock-tower");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  /** 难度决定分钟复杂度池 */
  private minPool(): number[] {
    if (this.difficulty === "easy") return [0];
    if (this.difficulty === "medium") return [0, 30];
    return [0, 15, 30, 45];
  }

  /** 生成一个不会与 given 相同的时间 */
  private makeDiff(given: ClockTime, used: ClockTime[]): ClockTime {
    const pool = this.minPool();
    for (let tries = 0; tries < 40; tries++) {
      const h = randInt(1, 12);
      const m = pool[randInt(0, pool.length - 1)]!;
      const t: ClockTime = { hour: h, min: m };
      const sameAsGiven = t.hour === given.hour && t.min === given.min;
      const sameAsUsed = used.some((u) => u.hour === t.hour && u.min === t.min);
      if (!sameAsGiven && !sameAsUsed) return t;
    }
    // 兜底：换一个小时
    let h = given.hour + 1;
    if (h > 12) h = 1;
    return { hour: h, min: sample(pool) };
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const pool = this.minPool();
    const target: ClockTime = {
      hour: randInt(1, 12),
      min: sample(pool),
    };
    // 错误时间必须明显不同（小时或分钟不同）
    const wrong: ClockTime = this.makeDiff(target, []);

    // 随机摆放顺序，保证可解（有正确项）
    const pair = shuffle([
      { time: target, correct: true },
      { time: wrong, correct: false },
    ]);

    const wrap = document.createElement("div");
    wrap.className = "ct3-wrap";

    const task = document.createElement("div");
    task.className = "ct3-task";
    const minText = target.min === 0 ? "00" : String(target.min);
    task.innerHTML = `哪座钟显示的是 <b>${target.hour}:${minText}</b>？（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const towers = document.createElement("div");
    towers.className = "ct3-towers";
    pair.forEach((item, idx) => {
      const t = this.buildClock(item.time, item.correct, idx);
      towers.appendChild(t);
    });
    wrap.appendChild(towers);

    this.root.appendChild(wrap);
  }

  /** 构建一座钟楼 DOM */
  private buildClock(
    time: ClockTime,
    correct: boolean,
    idx: number,
  ): HTMLDivElement {
    const tower = document.createElement("div");
    tower.className = "ct3-tower";

    const roof = document.createElement("div");
    roof.className = "ct3-roof";
    roof.textContent = "🔺";
    tower.appendChild(roof);

    const face = document.createElement("div");
    face.className = "ct3-face";
    // 1-12 数字
    for (let i = 1; i <= 12; i++) {
      const n = document.createElement("div");
      n.className = "ct3-num";
      const ang = (i / 12) * 360 - 90;
      const rad = (ang * Math.PI) / 180;
      const R = 74;
      n.style.left = `${90 + Math.cos(rad) * R - 11}px`;
      n.style.top = `${90 + Math.sin(rad) * R - 12}px`;
      n.textContent = String(i);
      face.appendChild(n);
    }
    // 时针角度：每小时 30 度，分钟推动时针
    const hourAng = ((time.hour % 12) + time.min / 60) * 30 - 90;
    const minAng = time.min * 6 - 90;
    const hourHand = document.createElement("div");
    hourHand.className = "ct3-hand ct3-hand--hour";
    hourHand.style.transform = `translate(-50%,-100%) rotate(${hourAng + 90}deg)`;
    face.appendChild(hourHand);
    const minHand = document.createElement("div");
    minHand.className = "ct3-hand ct3-hand--min";
    minHand.style.transform = `translate(-50%,-100%) rotate(${minAng + 90}deg)`;
    face.appendChild(minHand);
    const center = document.createElement("div");
    center.className = "ct3-center";
    face.appendChild(center);
    tower.appendChild(face);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ct3-btn";
    btn.textContent = "这座 ⏰";
    btn.dataset.idx = String(idx);
    btn.addEventListener("click", () => this.choose(correct, btn));
    tower.appendChild(btn);

    return tower;
  }

  private choose(correct: boolean, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (correct) {
      this.locked = true;
      sfxPop();
      btn.classList.add("ct3-btn--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("ct3-btn--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ct3-btn--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看时针指到数字几，分针指到几～",
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
    if (document.getElementById("ct3-style")) return;
    const st = document.createElement("style");
    st.id = "ct3-style";
    st.textContent = CT3_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function CT3_CSS(theme: string): string {
  return `
.ct3-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.ct3-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.ct3-task b{color:${theme};font-size:1.3rem;}
.ct3-towers{display:flex;gap:24px;justify-content:center;flex-wrap:wrap;}
.ct3-tower{display:flex;flex-direction:column;align-items:center;gap:10px;}
.ct3-roof{font-size:2rem;line-height:1;filter:drop-shadow(0 3px 2px rgba(0,0,0,.2));}
.ct3-face{position:relative;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle at 50% 40%,#fff,#f3f3f7);box-shadow:var(--shadow);border:8px solid ${theme};}
.ct3-num{position:absolute;width:22px;height:24px;font-size:1.05rem;font-weight:800;color:var(--ink);text-align:center;line-height:24px;}
.ct3-hand{position:absolute;left:50%;top:50%;transform-origin:bottom center;border-radius:4px;}
.ct3-hand--min{width:4px;height:74px;background:var(--ink);}
.ct3-hand--hour{width:7px;height:52px;background:${theme};}
.ct3-center{position:absolute;left:50%;top:50%;width:14px;height:14px;background:var(--ink);border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 3px #fff;}
.ct3-btn{min-width:110px;min-height:50px;font-size:1.15rem;font-weight:800;border-radius:16px;background:#fff;color:var(--ink);box-shadow:var(--shadow);transition:transform .1s ease;cursor:pointer;border:none;}
.ct3-btn:active{transform:scale(.94);}
.ct3-btn--done{background:${theme};color:#fff;animation:ct3-pop .4s ease;}
.ct3-btn--wrong{animation:ct3-shake .4s ease;}
@keyframes ct3-pop{0%{transform:scale(.7)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes ct3-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:400px){.ct3-face{width:150px;height:150px;border-width:6px;}.ct3-num{font-size:.9rem;}.ct3-towers{gap:14px;}}
`;
}

export function create(): ClockTowerGame {
  return new ClockTowerGame();
}
