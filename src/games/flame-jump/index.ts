/* 跳火焰 Flame Jump —— 角色在左侧原地站，一排火焰从右滑来，
   点击让角色跳起跨过火焰。碰火结束（自动重开）。
   独特点：单向避障 + 时机点击，比跑酷更聚焦"什么时候跳"。
   视觉：小火苗角色 + 摇曳火焰。难度=火焰速度/间距。通关=跳过目标数。
   RAF 驱动，unmount 必须 cancelAnimationFrame。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Flame {
  x: number;
  el: HTMLDivElement;
  passed: boolean;
}

export class FlameJumpGame extends BaseGame {
  constructor() {
    super("flame-jump");
  }

  private field!: HTMLDivElement;
  private hero!: HTMLDivElement;
  private flames: Flame[] = [];

  private hy = 0; // 角色中心 y（相对 field 顶部）
  private vy = 0;
  private groundY = 0;

  private score = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private speed = 0;
  private scrollX = 0;
  private unbind: (() => void) | null = null;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.score = 0;
    this.over = false;
    this.flames = [];
    this.need =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 9;
    this.speed =
      this.difficulty === "easy"
        ? 160
        : this.difficulty === "medium"
          ? 200
          : 245;

    const wrap = document.createElement("div");
    wrap.className = "fj-wrap";
    const task = document.createElement("div");
    task.className = "fj-task";
    task.innerHTML = `点击让小角色跳过火焰！跳过 <b>${this.need}</b> 团 · <span id="fj-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "fj-field";

    this.hero = document.createElement("div");
    this.hero.className = "fj-hero";
    this.hero.textContent = "🦊";
    this.field.appendChild(this.hero);

    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    this.unbind = bindPointer(this.field, {
      down: () => this.jump(),
    });

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.groundY = r.height - 44; // 地面线
      this.hy = this.groundY;
      this.vy = 0;
      this.last = performance.now();
      this.loop();
    });
  }

  private jump(): void {
    if (this.over) return;
    if (this.hy >= this.groundY - 1) {
      this.vy = -380;
      sfxPop();
    }
  }

  private spawnFlame(): void {
    const r = this.field.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "fj-flame";
    // 火焰宽度随难度略增（更难跳过）
    const width =
      this.difficulty === "easy" ? 34 : this.difficulty === "medium" ? 42 : 50;
    el.style.width = `${width}px`;
    const x = r.width + 20;
    el.style.left = `${x}px`;
    this.field.appendChild(el);
    this.flames.push({ x, el, passed: false });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    const r = this.field.getBoundingClientRect();
    const W = r.width;

    // 物理：重力，落地即停
    this.vy += 1150 * dt;
    this.hy += this.vy * dt;
    if (this.hy > this.groundY) {
      this.hy = this.groundY;
      this.vy = 0;
    }
    this.hero.style.top = `${this.hy - 28}px`;

    // 地面滚动
    this.scrollX = (this.scrollX - this.speed * dt) % 80;
    this.field.style.setProperty("--fj-scroll", `${this.scrollX}px`);

    // 火焰移动
    const heroX = 56;
    const heroSize = 40;
    for (const f of this.flames) {
      f.x -= this.speed * dt;
      f.el.style.left = `${f.x}px`;
      // 计分：火焰完全越过角色
      if (!f.passed && f.x + 40 < heroX) {
        f.passed = true;
        this.score += 1;
        sfxPop();
        const sc = this.root.querySelector("#fj-score");
        if (sc) sc.textContent = `${this.score} / ${this.need}`;
        if (this.score >= this.need) {
          this.win();
          return;
        }
      }
    }
    // 移除离场
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i]!;
      if (f.x < -60) {
        f.el.remove();
        this.flames.splice(i, 1);
      }
    }
    // 生成新火焰：保证最小间距，避免无解（间距 > 跳跃落地所需距离）
    const lastF = this.flames[this.flames.length - 1];
    const minGap =
      this.difficulty === "easy"
        ? 270
        : this.difficulty === "medium"
          ? 230
          : 200;
    // 用 randInt 在最小间距上加随机变化，节奏不死板
    if (!lastF || W - (lastF.x + 40) > minGap + randInt(0, 80)) {
      this.spawnFlame();
    }

    // 碰撞：角色与火焰（火焰高度从地面向上 36px）
    for (const f of this.flames) {
      const fW = parseFloat(f.el.style.width) || 40;
      if (heroX + heroSize / 2 > f.x && heroX - heroSize / 2 < f.x + fW) {
        // 角色底部低于火焰顶部即撞上
        const flameTopY = this.groundY - 30;
        if (this.hy > flameTopY) {
          this.hit();
          return;
        }
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount, [0, 2]));
      } else {
        this.startRound();
      }
    }, 600);
  }

  private hit(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.hero.classList.add("fj-hero--hit");
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      // 短暂提示后重开本关，保证可通关
      this.trackTimeout(() => this.startRound(), 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "被火苗烧到啦，再来一次吧～",
      primary: {
        text: "再跳一次",
        icon: "🦊",
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
    if (document.getElementById("fj-style")) return;
    const st = document.createElement("style");
    st.id = "fj-style";
    st.textContent = FJ_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function FJ_CSS(theme: string): string {
  return `
.fj-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.fj-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.fj-task b{color:${theme};}
.fj-field{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#1a1a2e 0%,#16213e 50%,#3a2e4a 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:pointer;}
.fj-field::before{content:"";position:absolute;left:var(--fj-scroll,0);bottom:0;height:44px;width:calc(100% + 160px);background:repeating-linear-gradient(90deg,#4a3525 0 40px,#5a4535 40px 80px);box-shadow:inset 0 4px 0 rgba(255,255,255,.12);z-index:1;}
.fj-field::after{content:"";position:absolute;left:0;bottom:44px;width:100%;height:6px;background:linear-gradient(180deg,#ff9f43,rgba(255,159,67,0));z-index:1;opacity:.4;}
.fj-hero{position:absolute;left:56px;top:0;transform:translateX(-50%);font-size:2.6rem;line-height:1;z-index:5;filter:drop-shadow(0 4px 6px rgba(255,150,50,.5));will-change:top;animation:fj-idle .36s ease-in-out infinite alternate;}
@keyframes fj-idle{from{transform:translateX(-50%) translateY(0) scaleY(1)}to{transform:translateX(-50%) translateY(-3px) scaleY(1.02)}}
.fj-flame{position:absolute;bottom:44px;height:48px;background:linear-gradient(180deg,#fff200 0%,#ff9f43 35%,#ff6348 70%,#c0392b 100%);border-radius:50% 50% 30% 30%/70% 70% 30% 30%;box-shadow:0 0 16px rgba(255,99,72,.7),inset 0 -4px 8px rgba(0,0,0,.2);z-index:4;will-change:left;animation:fj-flick .18s ease-in-out infinite alternate;}
@keyframes fj-flick{from{transform:scaleY(1) scaleX(1)}to{transform:scaleY(1.12) scaleX(.94)}}
.fj-hero--hit{animation:fj-burn .7s ease forwards;}
@keyframes fj-burn{0%{transform:translateX(-50%) scale(1);opacity:1}40%{transform:translateX(-50%) scale(1.2) rotate(20deg);filter:brightness(1.5) drop-shadow(0 0 10px #ff6348)}100%{transform:translateX(-50%) scale(.3) rotate(60deg);opacity:0}}
@media (max-width:380px){.fj-task{font-size:.95rem;}.fj-hero{font-size:2.2rem;}}
`;
}

export function create(): FlameJumpGame {
  return new FlameJumpGame();
}
