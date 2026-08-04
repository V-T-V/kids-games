/* 亮灯反应 Reaction Light —— 灯随机亮起，孩子要快速点亮它的灯。
   独特点：圆形灯泡亮起时发光 + 呼吸动画，限时（2秒）没点就错过。
   巧思：所有灯都参与反应，亮哪一个就要点哪一个，难度=灯数/反应时限。用 trackTimeout 控制亮灯与超时。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByRate } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

export class ReactionLightGame extends BaseGame {
  constructor() {
    super("reaction-light");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private lights: HTMLButtonElement[] = [];
  private activeIdx = -1;
  private waiting = true; // 等待下一盏灯亮
  private hits = 0; // 本关命中数
  private miss = 0; // 本关错过/点错数
  private label!: HTMLDivElement;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空，定时器由基类清理 */
  }

  private lightCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 6;
  }
  private timeLimit(): number {
    // 毫秒：easy 最宽裕
    return this.difficulty === "easy"
      ? 2400
      : this.difficulty === "medium"
        ? 1800
        : 1300;
  }
  /** 每关需要点亮的目标次数 */
  private targetHits(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.hits = 0;
    this.miss = 0;
    this.activeIdx = -1;
    this.waiting = true;
    const n = this.lightCount();

    const wrap = document.createElement("div");
    wrap.className = "rl-wrap";
    const task = document.createElement("div");
    task.className = "rl-task";
    task.textContent = `灯亮了就快点它！（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    this.label = document.createElement("div");
    this.label.className = "rl-label";
    this.label.textContent = "准备好了…盯紧小灯！";
    wrap.appendChild(this.label);

    const grid = document.createElement("div");
    grid.className = "rl-grid";
    grid.style.setProperty("--cols", String(Math.min(n, 3)));
    this.lights = [];
    for (let i = 0; i < n; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rl-light";
      b.dataset.idx = String(i);
      b.addEventListener("click", () => this.tap(i));
      grid.appendChild(b);
      this.lights.push(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);

    // 稍等后开始第一盏灯
    this.scheduleNext(randInt(600, 1200));
  }

  private scheduleNext(delay: number): void {
    this.waiting = true;
    this.activeIdx = -1;
    this.label.textContent = "盯紧…灯马上就亮！";
    this.trackTimeout(() => this.lightUp(), delay);
  }

  private lightUp(): void {
    if (this.lights.length === 0) return;
    // 随机选一盏不重复上一盏
    let idx = randInt(0, this.lights.length - 1);
    if (this.lights.length > 1) {
      while (idx === this.activeIdx) idx = randInt(0, this.lights.length - 1);
    }
    this.activeIdx = idx;
    this.waiting = false;
    const btn = this.lights[idx]!;
    btn.classList.add("rl-light--on");
    this.label.textContent = "快点点亮的灯！";
    sfxPop();
    // 超时算错过
    this.trackTimeout(() => {
      if (this.activeIdx === idx) {
        // 仍然亮着 = 没点中
        btn.classList.remove("rl-light--on");
        btn.classList.add("rl-light--miss");
        this.trackTimeout(() => btn.classList.remove("rl-light--miss"), 400);
        this.miss += 1;
        const paused = this.onWrong();
        if (paused) {
          this.showRest();
          return;
        }
        this.afterAttempt();
      }
    }, this.timeLimit());
  }

  private tap(idx: number): void {
    if (this.waiting) {
      // 提前点（没灯亮）：算干扰，轻提示不扣命
      const b = this.lights[idx]!;
      b.classList.add("rl-light--shake");
      this.trackTimeout(() => b.classList.remove("rl-light--shake"), 350);
      return;
    }
    if (idx === this.activeIdx) {
      const b = this.lights[idx]!;
      b.classList.remove("rl-light--on");
      b.classList.add("rl-light--hit");
      this.trackTimeout(() => b.classList.remove("rl-light--hit"), 450);
      this.hits += 1;
      const r = b.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.activeIdx = -1;
      this.waiting = true;
      this.afterAttempt();
    } else {
      // 点错灯
      const b = this.lights[idx]!;
      b.classList.add("rl-light--shake");
      this.trackTimeout(() => b.classList.remove("rl-light--shake"), 350);
      this.miss += 1;
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
        return;
      }
    }
  }

  private afterAttempt(): void {
    if (this.hits >= this.targetHits()) {
      // 本关完成
      this.label.textContent = "全部点亮！真棒！";
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          const total = this.hits + this.miss;
          const stars = starsByRate(this.hits, Math.max(1, total), [0.85, 0.6]);
          this.finishClear(stars);
        } else {
          this.startRound();
        }
      }, 800);
    } else {
      this.scheduleNext(randInt(500, 1100));
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "别急，等灯亮了再点哦～",
      primary: {
        text: "继续",
        icon: "🎈",
        onClick: () => {
          ov.destroy();
          // 休息后继续下一盏
          this.scheduleNext(randInt(600, 1000));
        },
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
    if (document.getElementById("rl-style")) return;
    const st = document.createElement("style");
    st.id = "rl-style";
    st.textContent = RL_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function RL_CSS(theme: string): string {
  return `
.rl-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(460px,100%);}
.rl-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.rl-label{font-size:1.05rem;font-weight:700;color:#555;min-height:1.4rem;text-align:center;}
.rl-grid{display:grid;grid-template-columns:repeat(var(--cols,3),1fr);gap:22px;padding:26px;background:linear-gradient(#2a2a35,#3a3a48);border-radius:26px;box-shadow:var(--shadow);}
.rl-light{width:96px;height:96px;border-radius:50%;border:none;background:radial-gradient(circle at 35% 30%,#555,#2a2a2a);box-shadow:inset 0 -6px 10px rgba(0,0,0,.5),inset 0 4px 6px rgba(255,255,255,.08);cursor:pointer;transition:transform .1s;position:relative;}
.rl-light:active{transform:scale(.92);}
.rl-light--on{background:radial-gradient(circle at 35% 30%,#fff6,${theme});box-shadow:0 0 30px 8px ${theme},inset 0 -4px 8px rgba(0,0,0,.25);animation:rl-pulse .6s ease-in-out infinite;}
@keyframes rl-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.rl-light--hit{background:radial-gradient(circle at 35% 30%,#fff6,#6bcf7f);box-shadow:0 0 24px 6px #6bcf7f;animation:rl-hit .45s ease;}
@keyframes rl-hit{0%{transform:scale(1.3)}100%{transform:scale(1)}}
.rl-light--miss{background:radial-gradient(circle at 35% 30%,#fff6,#999);animation:rl-miss .4s ease;}
@keyframes rl-miss{0%{transform:scale(.85)}100%{transform:scale(1)}}
.rl-light--shake{animation:rl-shake .35s ease;}
@keyframes rl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.rl-light{width:74px;height:74px;}.rl-grid{gap:16px;padding:18px;}}
`;
}

export function create(): ReactionLightGame {
  return new ReactionLightGame();
}
