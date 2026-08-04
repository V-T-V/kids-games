/* 火山逃生 Volcano Escape —— 火山要喷发了，角色在山洞底部，
   岩浆从下方不断上涨追赶。孩子不停点"向上跑"按钮，让角色往上爬，
   跑到洞顶出口即逃生成功；被岩浆追上则本关重开。
   独特点：连点反应——节奏感强（区别于单次点击）。
   视觉：火山岩壁 + 角色（攀爬）+ 上涨岩浆（带火光）+ 顶部出口。
   难度=岩浆上涨速度。通关=逃出目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

export class VolcanoEscapeGame extends BaseGame {
  constructor() {
    super("volcano-escape");
  }

  private raf = 0;
  private over = false;
  private last = 0;

  /** 角色高度（0=底部，1=顶部出口） */
  private heroY = 0;
  /** 岩浆高度（0=底部） */
  private lavaY = 0;
  /** 岩浆上升速度（每秒占比） */
  private lavaSpeed = 0.06;
  /** 每次点按钮上升量 */
  private stepUp = 0.05;

  private roundsDone = 0;
  private roundTotal = 0;
  private stage!: HTMLDivElement;
  private heroEl!: HTMLDivElement;
  private lavaEl!: HTMLDivElement;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private startRound(): void {
    this.over = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root.innerHTML = "";

    this.heroY = 0;
    this.lavaY = -0.12; // 起始略低于角色，给缓冲
    this.lavaSpeed =
      this.difficulty === "easy"
        ? 0.045
        : this.difficulty === "medium"
          ? 0.06
          : 0.085;
    this.stepUp =
      this.difficulty === "easy"
        ? 0.06
        : this.difficulty === "medium"
          ? 0.052
          : 0.046;

    const wrap = document.createElement("div");
    wrap.className = "ve2-wrap";
    const task = document.createElement("div");
    task.className = "ve2-task";
    task.id = "ve2-task";
    task.innerHTML = `快点 <b>⬆️ 向上跑</b> 爬出火山口！<br><span class="ve2-hint">别让岩浆追上你！第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "ve2-stage";
    stage.id = "ve2-stage";

    // 顶部出口
    const exit = document.createElement("div");
    exit.className = "ve2-exit";
    exit.textContent = "🌤️";
    stage.appendChild(exit);

    // 岩浆
    const lava = document.createElement("div");
    lava.className = "ve2-lava";
    lava.id = "ve2-lava";
    stage.appendChild(lava);
    this.lavaEl = lava;

    // 角色
    const hero = document.createElement("div");
    hero.className = "ve2-hero";
    hero.textContent = "🧗";
    stage.appendChild(hero);
    this.heroEl = hero;

    this.stage = stage;
    wrap.appendChild(stage);

    // 向上跑按钮（大按钮，便于连点）
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ve2-run";
    btn.id = "ve2-run";
    btn.textContent = "⬆️ 向上跑！";
    btn.addEventListener("click", () => this.runUp());
    wrap.appendChild(btn);

    this.root.appendChild(wrap);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private runUp(): void {
    if (this.over) return;
    this.heroY = Math.min(1, this.heroY + this.stepUp);
    sfxPop();
    // 短暂抖动反馈
    this.heroEl.classList.add("ve2-hero--hop");
    this.trackTimeout(() => this.heroEl.classList.remove("ve2-hero--hop"), 120);
    if (this.heroY >= 1) {
      this.win();
    }
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    // 岩浆上涨
    this.lavaY += this.lavaSpeed * dt;
    this.heroEl.style.bottom = `${this.heroY * 100}%`;
    this.lavaEl.style.height = `${Math.max(0, this.lavaY) * 100}%`;
    // 被岩浆追上？
    if (this.lavaY >= this.heroY) {
      this.fail();
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resetWrongStreak();
    const r = this.heroEl.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.trackTimeout(() => {
      this.roundsDone += 1;
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(
          starsByScore(this.roundTotal, [this.roundTotal, this.roundTotal]),
        );
      } else {
        this.startRound();
      }
    }, 700);
  }

  private fail(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.heroEl.classList.add("ve2-hero--burn");
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      // 自动重开本关
      this.trackTimeout(() => this.startRound(), 800);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌋",
      variant: "rest",
      body: "被岩浆追上啦，快点向上跑！",
      primary: {
        text: "再试一次",
        icon: "🧗",
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
    if (document.getElementById("ve2-style")) return;
    const st = document.createElement("style");
    st.id = "ve2-style";
    st.textContent = VE2_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function VE2_CSS(theme: string): string {
  return `
.ve2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.ve2-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);max-width:420px;}
.ve2-task b{color:${theme};}
.ve2-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.ve2-stage{position:relative;width:min(360px,90vw);height:380px;border-radius:24px;background:linear-gradient(180deg,#4a2c2a 0%,#2e1414 60%,#1a0d0d 100%);box-shadow:var(--shadow-lg);overflow:hidden;border:3px solid #6d3a2f;}
.ve2-stage::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 22px,transparent 22px 44px);}
.ve2-exit{position:absolute;top:6px;left:50%;transform:translateX(-50%);font-size:2.4rem;z-index:4;filter:drop-shadow(0 0 10px #fff8);animation:ve2-shine 1.6s ease-in-out infinite alternate;}
@keyframes ve2-shine{from{filter:drop-shadow(0 0 6px #fff8)}to{filter:drop-shadow(0 0 16px #fff)}}
.ve2-lava{position:absolute;bottom:0;left:0;right:0;height:0;background:linear-gradient(180deg,#ffd54f 0%,#ff7043 30%,#e53935 70%,#b71c1c 100%);box-shadow:0 -4px 20px rgba(255,120,40,.8);z-index:2;}
.ve2-lava::before{content:"";position:absolute;top:-8px;left:0;right:0;height:14px;background:repeating-radial-gradient(circle at 10% 50%,#ffd54f 0 8px,transparent 8px 22px);animation:ve2-bubble 1.2s ease-in-out infinite alternate;}
@keyframes ve2-bubble{from{transform:translateY(0)}to{transform:translateY(-3px)}}
.ve2-hero{position:absolute;bottom:0;left:50%;transform:translateX(-50%);font-size:2.2rem;z-index:3;transition:bottom .1s ease;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));}
.ve2-hero--hop{animation:ve2-hop .12s ease;}
@keyframes ve2-hop{0%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-8px)}100%{transform:translateX(-50%) translateY(0)}}
.ve2-hero--burn{animation:ve2-burn .4s ease;filter:drop-shadow(0 0 12px #ff5722);}
@keyframes ve2-burn{0%,100%{transform:translateX(-50%)}25%{transform:translateX(calc(-50% - 5px))}75%{transform:translateX(calc(-50% + 5px))}}
.ve2-run{min-width:220px;min-height:68px;border:none;border-radius:22px;background:linear-gradient(160deg,${theme},color-mix(in srgb,${theme} 60%,#000));color:#fff;font-size:1.6rem;font-weight:900;box-shadow:0 6px 0 color-mix(in srgb,${theme} 50%,#000),var(--shadow);cursor:pointer;transition:transform .08s ease,box-shadow .08s ease;user-select:none;}
.ve2-run:active{transform:translateY(5px);box-shadow:0 1px 0 color-mix(in srgb,${theme} 50%,#000),var(--shadow);}
@media (max-width:380px){.ve2-stage{height:340px;}.ve2-run{min-width:180px;font-size:1.4rem;}}
`;
}

export function create(): VolcanoEscapeGame {
  return new VolcanoEscapeGame();
}
