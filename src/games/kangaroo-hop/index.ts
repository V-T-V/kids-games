/* 袋鼠跳远 Kangaroo Hop —— 袋鼠在地面奔跑，前方有障碍（石头/仙人掌/树桩），
   点击让袋鼠跳过。碰障碍结束。
   独特点：节奏点击 + 袋鼠大跳跃弧线（袋鼠天生跳得远，跳跃滞空长）。
   巧思：地面左滚给人"奔跑"感，障碍间距随难度变化，速度即难度。
   通关=跳过目标障碍数。RAF 驱动，unmount 必须 cancelAnimationFrame。 */

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

const OBSTACLES = ["🪨", "🌵", "🪵", "🛢️"] as const;

export class KangarooHopGame extends BaseGame {
  constructor() {
    super("kangaroo-hop");
  }

  private field!: HTMLDivElement;
  private roo!: HTMLDivElement;
  private obstacles: Obstacle[] = [];
  private py = 0;
  private vy = 0;
  private score = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private cleared = false;
  private speed = 0;
  private groundY = 0;
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
    this.cleared = false;
    this.obstacles = [];
    this.need =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.speed =
      this.difficulty === "easy"
        ? 175
        : this.difficulty === "medium"
          ? 220
          : 265;

    const wrap = document.createElement("div");
    wrap.className = "kh-wrap";
    const task = document.createElement("div");
    task.className = "kh-task";
    task.innerHTML = `点击让袋鼠跳！跳过 <b>${this.need}</b> 个障碍 · <span id="kh-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "kh-field";

    this.roo = document.createElement("div");
    this.roo.className = "kh-roo";
    this.roo.textContent = "🦘";
    this.field.appendChild(this.roo);

    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    this.unbind = bindPointer(this.field, { down: () => this.jump() });

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.groundY = r.height - 56;
      this.py = this.groundY;
      this.vy = 0;
      this.last = performance.now();
      this.loop();
    });
  }

  private jump(): void {
    if (this.over || this.cleared) return;
    if (this.py >= this.groundY - 1) {
      this.vy = -400; // 袋鼠跳得高、滞空长
      sfxPop();
    }
  }

  private spawnObstacle(): void {
    const el = document.createElement("div");
    el.className = "kh-obstacle";
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

    // 物理（重力）
    this.vy += 1150 * dt;
    this.py += this.vy * dt;
    if (this.py > this.groundY) {
      this.py = this.groundY;
      this.vy = 0;
    }
    this.roo.style.top = `${this.py - 38}px`;

    // 地面滚动
    this.scrollX = (this.scrollX - this.speed * dt) % 80;
    this.field.style.setProperty("--kh-scroll", `${this.scrollX}px`);

    const rooX = 64;
    const rooSize = 44;
    // 障碍移动 + 计分
    for (const o of this.obstacles) {
      o.x -= this.speed * dt;
      o.el.style.left = `${o.x}px`;
      if (!o.passed && o.x + 30 < rooX) {
        o.passed = true;
        this.score += 1;
        sfxPop();
        const sc = this.root.querySelector("#kh-score");
        if (sc) sc.textContent = `${this.score} / ${this.need}`;
        if (this.score >= this.need) {
          this.win();
          return;
        }
      }
    }
    // 移除离场
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i]!;
      if (o.x < -60) {
        o.el.remove();
        this.obstacles.splice(i, 1);
      }
    }
    // 生成：保证间距 > 跳跃落地周期（可解）
    const lastO = this.obstacles[this.obstacles.length - 1];
    const minGap = this.difficulty === "hard" ? 220 : 270;
    if (!lastO || W - (lastO.x + 30) > minGap) {
      this.spawnObstacle();
    }

    // 碰撞
    for (const o of this.obstacles) {
      const oW = 34;
      if (rooX + rooSize / 2 > o.x && rooX - rooSize / 2 < o.x + oW) {
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
    this.cleared = true;
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

  private end(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.roo.classList.add("kh-roo--hit");
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      this.trackTimeout(() => this.startRound(), 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "袋鼠撞到啦，看准时机再跳～",
      primary: {
        text: "再跳一次",
        icon: "🦘",
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
    if (document.getElementById("kh-style")) return;
    const st = document.createElement("style");
    st.id = "kh-style";
    st.textContent = KH_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function KH_CSS(theme: string): string {
  return `
.kh-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.kh-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.kh-task b{color:${theme};}
.kh-field{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#ffd98a 0%,#ffe9b8 52%,#d9c890 54%,#c2b070 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:pointer;}
.kh-field::before{content:"";position:absolute;left:var(--kh-scroll,0);bottom:0;height:56px;width:calc(100% + 160px);background:repeating-linear-gradient(90deg,#b69a5e 0 40px,#c9b06f 40px 80px);box-shadow:inset 0 4px 0 rgba(255,255,255,.25);z-index:1;}
.kh-field::after{content:"☀️ ☁️ ☁️";position:absolute;top:14px;left:0;font-size:1.6rem;letter-spacing:90px;opacity:.8;z-index:1;animation:kh-cloud 30s linear infinite;}
@keyframes kh-cloud{from{transform:translateX(0)}to{transform:translateX(-240px)}}
.kh-roo{position:absolute;left:64px;top:0;transform:translateX(-50%);font-size:2.8rem;line-height:1;z-index:5;filter:drop-shadow(0 4px 4px rgba(0,0,0,.2));will-change:top;animation:kh-run .3s ease-in-out infinite alternate;}
@keyframes kh-run{from{transform:translateX(-50%) translateY(0)}to{transform:translateX(-50%) translateY(-3px)}}
.kh-obstacle{position:absolute;bottom:30px;font-size:2rem;line-height:1;z-index:4;will-change:left;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));}
.kh-roo--hit{animation:kh-fall .7s ease forwards;}
@keyframes kh-fall{0%{transform:translateX(-50%) rotate(0)}100%{transform:translateX(-50%) rotate(-50deg) translateY(20px);opacity:.5}}
@media (max-width:380px){.kh-task{font-size:.95rem;}.kh-roo{font-size:2.3rem;}}
`;
}

export function create(): KangarooHopGame {
  return new KangarooHopGame();
}
