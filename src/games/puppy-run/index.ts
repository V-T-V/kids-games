/* 小狗跑酷 Puppy Run —— 小狗自动向右跑，障碍物（石头/树桩）从右滑来，
   点击让小狗跳过。碰障碍结束。独特点：节奏点击 + 童趣视觉（小狗 emoji 跳跃）。
   巧思：地面左滚给人"奔跑"感，障碍间距随难度变化，速度即难度。
   通关 = 跳过目标障碍数。RAF 驱动，unmount 必须 cancelAnimationFrame。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface Obstacle {
  x: number;
  el: HTMLDivElement;
  passed: boolean;
}

const OBSTACLES = ["🪨", "🪵", "🌵", "🛢️"] as const;

export class PuppyRunGame extends BaseGame {
  constructor() {
    super("puppy-run");
  }

  private field!: HTMLDivElement;
  private puppy!: HTMLDivElement;
  private obstacles: Obstacle[] = [];
  /** 小狗 y（px，相对 field 顶部，地面线为基准上方） */
  private py = 0;
  private vy = 0;
  private score = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private speed = 0;
  private groundY = 0;
  private scrollX = 0;
  private unbind: (() => void) | null = null;

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
    this.obstacles = [];
    this.need =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.speed =
      this.difficulty === "easy"
        ? 170
        : this.difficulty === "medium"
          ? 210
          : 255;

    const wrap = document.createElement("div");
    wrap.className = "pr2-wrap";
    const task = document.createElement("div");
    task.className = "pr2-task";
    task.innerHTML = `点击屏幕让小狗跳！跳过 <b>${this.need}</b> 个障碍 · <span id="pr2-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "pr2-field";
    this.field.id = "pr2-field";

    this.puppy = document.createElement("div");
    this.puppy.className = "pr2-puppy";
    this.puppy.id = "pr2-puppy";
    this.puppy.textContent = "🐶";
    this.field.appendChild(this.puppy);

    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    this.unbind = bindPointer(this.field, {
      down: () => this.jump(),
    });

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.groundY = r.height - 54; // 地面线
      this.py = this.groundY;
      this.vy = 0;
      this.last = performance.now();
      this.loop();
    });
  }

  private jump(): void {
    if (this.over) return;
    if (this.py >= this.groundY - 1) {
      this.vy = -360; // 向上初速度
      sfxPop();
    }
  }

  private spawnObstacle(): void {
    const el = document.createElement("div");
    el.className = "pr2-obstacle";
    el.textContent = sample(OBSTACLES);
    const r = this.field.getBoundingClientRect();
    const x = r.width + 30;
    el.style.left = `${x}px`;
    this.field.appendChild(el);
    this.obstacles.push({ x, el, passed: false });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    const r = this.field.getBoundingClientRect();
    const W = r.width;

    // 物理：重力（落地即停）
    this.vy += 1100 * dt;
    this.py += this.vy * dt;
    if (this.py > this.groundY) {
      this.py = this.groundY;
      this.vy = 0;
    }
    this.puppy.style.top = `${this.py - 36}px`; // 36 = 半个 emoji 高度

    // 地面滚动（给人奔跑感）
    this.scrollX = (this.scrollX - this.speed * dt) % 80;
    this.field.style.setProperty("--pr2-scroll", `${this.scrollX}px`);

    // 障碍移动
    const puppyX = 60;
    const puppySize = 40;
    for (const o of this.obstacles) {
      o.x -= this.speed * dt;
      o.el.style.left = `${o.x}px`;
      // 计分
      if (!o.passed && o.x + 30 < puppyX) {
        o.passed = true;
        this.score += 1;
        sfxPop();
        const sc = this.root.querySelector("#pr2-score");
        if (sc) sc.textContent = `${this.score} / ${this.need}`;
        if (this.score >= this.need) {
          this.win();
          return;
        }
      }
    }
    // 移除离场障碍
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i]!;
      if (o.x < -60) {
        o.el.remove();
        this.obstacles.splice(i, 1);
      }
    }
    // 生成新障碍：保证最小间距，避免无解（间距 > 跳跃落地所需距离）
    const lastO = this.obstacles[this.obstacles.length - 1];
    const minGap = this.difficulty === "hard" ? 210 : 260;
    if (!lastO || W - (lastO.x + 30) > minGap) {
      this.spawnObstacle();
    }

    // 碰撞：小狗与障碍（小狗在地面线时 py==groundY，y 范围 [py-size, py]）
    for (const o of this.obstacles) {
      const oW = 34;
      if (puppyX + puppySize / 2 > o.x && puppyX - puppySize / 2 < o.x + oW) {
        // 小狗底部是否低于障碍顶部（地面线上方 30px）
        const obstacleTopY = this.groundY - 34;
        if (this.py > obstacleTopY) {
          this.end();
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

  private end(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.puppy.classList.add("pr2-puppy--hit");
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      // 短暂提示后重开本关（startGame 会把 over 重置为 false），保证可通关
      this.trackTimeout(() => this.startGame(), 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "小狗撞到啦，再来一次吧～",
      primary: {
        text: "再跑一次",
        icon: "🐶",
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
    if (document.getElementById("pr2-style")) return;
    const st = document.createElement("style");
    st.id = "pr2-style";
    st.textContent = PR2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function PR2_CSS(theme: string): string {
  return `
.pr2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.pr2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.pr2-task b{color:${theme};}
.pr2-field{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#87ceeb 0%,#b3e5fc 55%,#c8e6a0 56%,#9ccc65 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:pointer;}
/* 地面草坪条纹（滚动给人奔跑感） */
.pr2-field::before{content:"";position:absolute;left:var(--pr2-scroll,0);bottom:0;height:54px;width:calc(100% + 160px);background:repeating-linear-gradient(90deg,#7cb342 0 40px,#8bc34a 40px 80px);box-shadow:inset 0 4px 0 rgba(255,255,255,.25);z-index:1;}
.pr2-field::after{content:"☁️ ☁️ ☁️";position:absolute;top:16px;left:0;font-size:1.8rem;letter-spacing:100px;opacity:.7;z-index:1;animation:pr2-cloud 26s linear infinite;}
@keyframes pr2-cloud{from{transform:translateX(0)}to{transform:translateX(-260px)}}
.pr2-puppy{position:absolute;left:60px;top:0;transform:translateX(-50%);font-size:2.6rem;line-height:1;z-index:5;filter:drop-shadow(0 4px 4px rgba(0,0,0,.2));will-change:top;animation:pr2-run .32s ease-in-out infinite alternate;}
@keyframes pr2-run{from{transform:translateX(-50%) translateY(0) rotate(-4deg)}to{transform:translateX(-50%) translateY(-4px) rotate(4deg)}}
.pr2-obstacle{position:absolute;bottom:30px;font-size:2rem;line-height:1;z-index:4;will-change:left;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));}
.pr2-puppy--hit{animation:pr2-fall .7s ease forwards;}
@keyframes pr2-fall{0%{transform:translateX(-50%) rotate(0)}100%{transform:translateX(-50%) rotate(-60deg) translateY(20px);opacity:.5}}
@media (max-width:380px){.pr2-task{font-size:.95rem;}.pr2-puppy{font-size:2.2rem;}}
`;
}

export function create(): PuppyRunGame {
  return new PuppyRunGame();
}
