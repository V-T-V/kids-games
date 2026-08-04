/* 摘苹果 Apple Pick —— 苹果树上有若干苹果，限时内点摘尽可能多的苹果。
   独特点：限时收集 + 摘下动画（苹果掉落进篮子），训练手眼协调与速度。
   视觉：苹果树（树冠 + 树干）+ 红苹果 + 篮子计数 + 倒计时。
   难度=苹果数 / 时限。通关=摘到目标数。前缀 ap2-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

export class ApplePickGame extends BaseGame {
  constructor() {
    super("apple-pick");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private picked = 0;
  private target = 0;
  private total = 0;
  private timeLimit = 0;
  private remaining = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private countEl: HTMLSpanElement | null = null;
  private timerEl: HTMLSpanElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private config(): { total: number; target: number; time: number } {
    if (this.difficulty === "easy") return { total: 8, target: 5, time: 18 };
    if (this.difficulty === "medium") return { total: 12, target: 8, time: 16 };
    return { total: 16, target: 11, time: 14 };
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.over = false;
    this.picked = 0;
    const cfg = this.config();
    this.total = cfg.total;
    this.target = cfg.target;
    this.timeLimit = cfg.time;
    this.remaining = cfg.time;

    const wrap = document.createElement("div");
    wrap.className = "ap2-wrap";

    const task = document.createElement("div");
    task.className = "ap2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 摘到 <b>${this.target}</b> 个苹果！⏱️ <span id="ap2-time">${this.remaining}</span>s · 已摘 <span id="ap2-count">0</span>`;
    wrap.appendChild(task);
    this.countEl = task.querySelector("#ap2-count");
    this.timerEl = task.querySelector("#ap2-time");

    const stage = document.createElement("div");
    stage.className = "ap2-stage";
    // 树干
    const trunk = document.createElement("div");
    trunk.className = "ap2-trunk";
    stage.appendChild(trunk);
    // 树冠
    const crown = document.createElement("div");
    crown.className = "ap2-crown";
    // 在树冠上散布苹果
    const positions = this.scatter(this.total);
    for (let i = 0; i < this.total; i++) {
      const a = document.createElement("button");
      a.type = "button";
      a.className = "ap2-apple";
      a.textContent = "🍎";
      const p = positions[i]!;
      a.style.left = `${p[0]}%`;
      a.style.top = `${p[1]}%`;
      a.style.setProperty("--ap2-delay", `${randInt(0, 200)}ms`);
      a.addEventListener("click", () => this.pick(a));
      crown.appendChild(a);
    }
    stage.appendChild(crown);
    // 篮子
    const basket = document.createElement("div");
    basket.className = "ap2-basket";
    basket.textContent = "🧺";
    stage.appendChild(basket);
    wrap.appendChild(stage);
    this.root.appendChild(wrap);

    this.last = performance.now();
    this.loop();
  }

  /** 在树冠区域生成不重叠的位置 */
  private scatter(n: number): [number, number][] {
    const pts: [number, number][] = [];
    let guard = 0;
    while (pts.length < n && guard < 500) {
      guard += 1;
      const x = randInt(8, 88);
      const y = randInt(10, 80);
      const ok = pts.every(
        (p) => Math.abs(p[0] - x) > 14 || Math.abs(p[1] - y) > 14,
      );
      if (ok) pts.push([x, y]);
    }
    // 兜底：网格分布
    while (pts.length < n) {
      const idx = pts.length;
      const cols = Math.ceil(Math.sqrt(n));
      pts.push([
        (idx % cols) * (88 / cols) + 8,
        Math.floor(idx / cols) * (70 / cols) + 10,
      ]);
    }
    return pts;
  }

  private pick(a: HTMLButtonElement): void {
    if (this.over) return;
    if (a.classList.contains("ap2-apple--picked")) return;
    a.classList.add("ap2-apple--picked");
    a.disabled = true;
    sfxPop();
    this.picked += 1;
    this.resetWrongStreak();
    if (this.countEl) this.countEl.textContent = String(this.picked);
    const r = a.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    if (this.picked >= this.target) {
      this.win();
    }
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    this.remaining -= dt;
    if (this.timerEl)
      this.timerEl.textContent = String(Math.max(0, Math.ceil(this.remaining)));
    if (this.remaining <= 0) {
      this.timeUp();
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.trackTimeout(() => {
      this.roundsDone += 1;
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(
          starsByScore(this.picked, [this.target, Math.ceil(this.target / 2)]),
        );
      } else {
        this.startRound();
      }
    }, 600);
  }

  private timeUp(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.picked >= this.target) {
      this.win();
      return;
    }
    // 时间到未达标：算错一轮，休息或重试
    const paused = this.onWrong();
    if (paused) this.showRest(false);
    else this.trackTimeout(() => this.startRound(), 900);
  }

  private showRest(_passed: boolean): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🍎",
      variant: "rest",
      body: "时间到啦！手要快一点，多点几下苹果～",
      primary: {
        text: "再摘一次",
        icon: "🧺",
        onClick: () => {
          ov.destroy();
          this.startRound();
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
    if (document.getElementById("ap2-style")) return;
    const st = document.createElement("style");
    st.id = "ap2-style";
    st.textContent = AP2_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function AP2_CSS(theme: string): string {
  return `
.ap2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.ap2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.ap2-stage{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#87ceeb 0%,#b8e0f5 50%,#a8d98a 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);}
.ap2-trunk{position:absolute;left:50%;bottom:60px;transform:translateX(-50%);width:34px;height:120px;background:linear-gradient(180deg,#8a5a2b,#6b4423);border-radius:6px;box-shadow:var(--shadow);z-index:1;}
.ap2-crown{position:absolute;left:50%;top:8%;transform:translateX(-50%);width:78%;height:62%;background:radial-gradient(ellipse at center,#5fa84a 0%,#3a7a2a 70%,#2a5a1a 100%);border-radius:50%;box-shadow:var(--shadow),inset 0 -10px 20px rgba(0,0,0,.2);z-index:2;}
.ap2-apple{position:absolute;width:46px;height:46px;border:none;background:transparent;font-size:1.8rem;line-height:1;cursor:pointer;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3));transition:transform .1s;padding:0;animation:ap2-sway 2.4s ease-in-out infinite;animation-delay:var(--ap2-delay,0ms);transform:translate(-50%,-50%);}
.ap2-apple:hover{transform:translate(-50%,-50%) scale(1.15);}
.ap2-apple:active{transform:translate(-50%,-50%) scale(.9);}
.ap2-apple--picked{animation:ap2-drop .6s ease-in forwards;pointer-events:none;}
@keyframes ap2-sway{0%,100%{transform:translate(-50%,-50%) rotate(-4deg)}50%{transform:translate(-50%,-50%) rotate(4deg)}}
@keyframes ap2-drop{0%{transform:translate(-50%,-50%) scale(1);opacity:1}60%{opacity:1}100%{transform:translate(-50%,400%) scale(.6) rotate(40deg);opacity:0}}
.ap2-basket{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);font-size:2.6rem;z-index:3;filter:drop-shadow(0 3px 4px rgba(0,0,0,.3));}
@media (max-width:380px){.ap2-apple{width:42px;height:42px;font-size:1.6rem;}.ap2-basket{font-size:2.2rem;}.ap2-trunk{width:28px;height:100px;}}
.ap2-task b{color:${theme};}
`;
}

export function create(): ApplePickGame {
  return new ApplePickGame();
}
