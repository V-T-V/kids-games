/* 月球跳跃 Moon Jump —— 宇航员在月球表面，坑洞从右向左滚来，
   点击让宇航员跳过坑。跳早了/晚了掉进坑就结束。独特点：低重力弧线跳跃 + 太空视觉。
   巧思：用 RAF 驱动坑洞滚动 + 抛物线跳跃；落地窗口宽松，孩子容易成功。
   难度 = 坑间距 / 速度。通关 = 跳过目标坑数。unmount 必须 cancelAnimationFrame。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Crater {
  x: number;
  width: number;
  /** 是否已成功跳过 */
  cleared: boolean;
  el: HTMLDivElement;
}

export class MoonJumpGame extends BaseGame {
  constructor() {
    super("moon-jump");
  }

  private field!: HTMLDivElement;
  private astro!: HTMLDivElement;
  private craters: Crater[] = [];
  /** 宇航员竖直偏移（px，0 = 站在地面） */
  private jumpY = 0;
  private jumpVy = 0;
  /** 是否在跳 */
  private jumping = false;
  private score = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private speed = 0;
  private gap = 0;
  private unbind: (() => void) | null = null;
  /** 地面距 field 顶部的 y（px） */
  private groundY = 0;
  /** 宇航员在 field 中的固定 x */
  private astroX = 0;
  /** 月球重力（低） */
  private readonly gravity = 1300;
  /** 跳跃初速 */
  private readonly jumpV0 = -560;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startGame();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unbind?.();
    this.unbind = null;
  }

  private startGame(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.score = 0;
    this.over = false;
    this.craters = [];
    this.jumpY = 0;
    this.jumpVy = 0;
    this.jumping = false;
    this.need =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.speed =
      this.difficulty === "easy"
        ? 130
        : this.difficulty === "medium"
          ? 165
          : 200;
    this.gap =
      this.difficulty === "easy"
        ? 260
        : this.difficulty === "medium"
          ? 220
          : 180;

    const wrap = document.createElement("div");
    wrap.className = "mj-wrap";
    const task = document.createElement("div");
    task.className = "mj-task";
    task.innerHTML = `看到坑就 <b>点一下</b> 跳过去！跳过 <b>${this.need}</b> 个坑 · <span id="mj-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "mj-field";
    const ground = document.createElement("div");
    ground.className = "mj-ground";
    this.field.appendChild(ground);
    this.astro = document.createElement("div");
    this.astro.className = "mj-astro";
    this.astro.id = "mj-astro";
    this.astro.textContent = "👨‍🚀";
    this.field.appendChild(this.astro);
    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    this.unbind = bindPointer(this.field, {
      down: () => this.jump(),
    });

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.groundY = r.height - 54; // 地面线（地表土层之上）
      this.astroX = r.width * 0.32;
      this.setAstro();
      this.last = performance.now();
      this.loop();
    });
  }

  private setAstro(): void {
    this.astro.style.left = `${this.astroX}px`;
    this.astro.style.top = `${this.groundY - 44 - this.jumpY}px`;
  }

  private jump(): void {
    if (this.over || this.jumping) return;
    this.jumping = true;
    this.jumpVy = this.jumpV0;
    sfxPop();
  }

  private spawnCrater(): void {
    const width = randInt(58, this.difficulty === "hard" ? 90 : 78);
    const el = document.createElement("div");
    el.className = "mj-crater";
    el.style.width = `${width}px`;
    this.field.appendChild(el);
    const r = this.field.getBoundingClientRect();
    const craters = this.craters[this.craters.length - 1];
    // 保证坑之间有足够间距，避免连续两坑无法跳
    const startX = craters
      ? Math.max(r.width + 30, craters.x + craters.width + this.gap)
      : r.width + 20;
    this.craters.push({ x: startX, width, cleared: false, el });
    this.layoutCrater(this.craters[this.craters.length - 1]!);
  }

  private layoutCrater(c: Crater): void {
    c.el.style.left = `${c.x}px`;
    c.el.style.top = `${this.groundY}px`;
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 跳跃物理
    if (this.jumping) {
      this.jumpVy += this.gravity * dt;
      this.jumpY += this.jumpVy * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.jumpVy = 0;
        this.jumping = false;
      }
      this.setAstro();
    }

    // 坑滚动
    for (const c of this.craters) {
      c.x -= this.speed * dt;
      c.el.style.left = `${c.x}px`;
    }
    // 生成新坑
    const last = this.craters[this.craters.length - 1];
    const r = this.field.getBoundingClientRect();
    if (!last || r.width - last.x > this.gap) {
      this.spawnCrater();
    }
    // 移除离屏坑
    for (let i = this.craters.length - 1; i >= 0; i--) {
      const c = this.craters[i]!;
      if (c.x + c.width < -20) {
        c.el.remove();
        this.craters.splice(i, 1);
      }
    }

    // 碰撞 / 计分：以宇航员脚下中心点为基准
    const footX = this.astroX + 22;
    const onGround = !this.jumping; // jumpY === 0
    for (const c of this.craters) {
      const inPit = footX > c.x + 6 && footX < c.x + c.width - 6;
      if (inPit && onGround) {
        // 踩进坑：失败
        this.end(c);
        return;
      }
      // 跳过：坑整体已越过宇航员，且这坑还没计分
      if (!c.cleared && c.x + c.width < footX - 4) {
        c.cleared = true;
        // 只有跳起来越过才算成功（走过坑边没跳也算，宽松计分）
        this.score += 1;
        sfxPop();
        const sc = this.root.querySelector("#mj-score");
        if (sc) sc.textContent = `${this.score} / ${this.need}`;
        const cr = c.el.getBoundingClientRect();
        this.onCorrect(cr.left + cr.width / 2, cr.top);
        if (this.score >= this.need) {
          this.win();
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
        this.startGame();
      }
    }, 600);
  }

  private end(c: Crater): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.astro.classList.add("mj-astro--fall");
    c.el.classList.add("mj-crater--hit");
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      // 重开本关，保证可通关
      this.trackTimeout(() => this.startGame(), 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "宇航员掉进坑里啦，看准时机再跳～",
      primary: {
        text: "再跳一次",
        icon: "👨‍🚀",
        onClick: () => {
          ov.destroy();
          this.startGame();
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
    if (document.getElementById("mj-style")) return;
    const st = document.createElement("style");
    st.id = "mj-style";
    st.textContent = MJ_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function MJ_CSS(theme: string): string {
  return `
.mj-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.mj-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.mj-field{position:relative;width:100%;height:62vh;min-height:360px;background:linear-gradient(180deg,#0b0f2a 0%,#1a1f4a 50%,#3a3f6a 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:pointer;}
.mj-field::before{content:"🌙";position:absolute;top:14px;right:24px;font-size:2.4rem;filter:drop-shadow(0 0 12px rgba(255,255,255,.5));z-index:1;}
.mj-field::after{content:"✨ ⭐ ✨ ⭐";position:absolute;top:40px;left:0;font-size:.9rem;letter-spacing:80px;color:#fff;opacity:.7;z-index:1;}
.mj-field .mj-ground{position:absolute;left:0;right:0;bottom:0;height:54px;background:linear-gradient(180deg,#cfd3dc 0%,#9ea3b3 40%,#7c8194 100%);box-shadow:inset 0 4px 0 rgba(255,255,255,.3);z-index:2;}
.mj-astro{position:absolute;left:30%;font-size:2.6rem;line-height:1;z-index:5;filter:drop-shadow(0 4px 6px rgba(0,0,0,.4));will-change:top;transition:transform .08s;}
.mj-astro--fall{animation:mj-fall .7s ease forwards;}
@keyframes mj-fall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(40px) rotate(60deg);opacity:.5}}
.mj-crater{position:absolute;height:40px;background:radial-gradient(ellipse at center top,#0b0f2a 0%,#2a2f5a 70%,transparent 100%);border-radius:0 0 50% 50%/0 0 100% 100%;z-index:3;}
.mj-crater--hit{animation:mj-flash .4s ease;}
@keyframes mj-flash{0%,100%{filter:none}50%{filter:brightness(1.6) drop-shadow(0 0 8px ${theme})}}
@media (max-width:380px){.mj-task{font-size:.95rem;}.mj-astro{font-size:2.2rem;}}
`;
}

export function create(): MoonJumpGame {
  return new MoonJumpGame();
}
