/* 弹球躲刺 Bouncy Ball —— 弹力球在重力下自动弹跳，孩子左右移动球避开尖刺。
   独特点：球一直弹（重力+地面反弹），孩子只管左右躲，操作简单又有节奏。
   视觉：彩色弹力球（带高光+落地压扁）+ 红色尖刺。难度=尖刺密度。
   通关=坚持目标秒数。RAF 驱动，unmount 必须 cancelAnimationFrame。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByScore } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Spike {
  x: number;
  el: HTMLDivElement;
}

export class BouncyBallGame extends BaseGame {
  constructor() {
    super("bouncy-ball");
  }

  private field!: HTMLDivElement;
  private ball!: HTMLDivElement;
  private spikes: Spike[] = [];

  private bx = 0; // 球中心 x（相对 field）
  private by = 0; // 球中心 y（相对 field）
  private vy = 0; // 竖直速度 px/s（正向下）
  private targetX = 0; // 目标 x（指针/按键控制）
  private groundY = 0;

  private elapsed = 0;
  private goalSec = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private cleared = false;
  private speed = 0;
  private spawnGapDist = 0;
  private unbind: (() => void) | null = null;
  private keyOn = false;

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
    this.unbindKey();
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.spikes = [];
    this.over = false;
    this.cleared = false;
    this.elapsed = 0;
    this.goalSec =
      this.difficulty === "easy" ? 12 : this.difficulty === "medium" ? 16 : 20;
    // 难度：速度越快越难，生成越密越难
    this.speed =
      this.difficulty === "easy"
        ? 130
        : this.difficulty === "medium"
          ? 165
          : 200;
    this.spawnGapDist =
      this.difficulty === "easy"
        ? 260
        : this.difficulty === "medium"
          ? 210
          : 170;

    const wrap = document.createElement("div");
    wrap.className = "bb2-wrap";
    const task = document.createElement("div");
    task.className = "bb2-task";
    task.innerHTML = `左右移动小球，躲开尖刺！坚持 <b>${this.goalSec}</b> 秒 · <span id="bb2-time">0.0</span> 秒`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "bb2-field";

    this.ball = document.createElement("div");
    this.ball.className = "bb2-ball";
    this.field.appendChild(this.ball);

    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    this.bindKey();
    this.unbind = bindPointer(this.field, {
      down: (p) => {
        this.pointerId = p.id;
        this.aim(p.x);
      },
      move: (p) => {
        if (p.id === this.pointerId) this.aim(p.x);
      },
      up: () => {
        this.pointerId = -1;
      },
    });

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.groundY = r.height - 20; // 地面线（球心落点）
      this.bx = r.width / 2;
      this.by = r.height * 0.3;
      this.targetX = this.bx;
      this.vy = 0;
      this.last = performance.now();
      this.loop();
    });
  }

  private pointerId = -1;
  private aim(clientX: number): void {
    const r = this.field.getBoundingClientRect();
    this.targetX = Math.max(18, Math.min(r.width - 18, clientX - r.left));
  }

  private bindKey(): void {
    if (this.keyOn) return;
    this.keyOn = true;
    window.addEventListener("keydown", this.onKey);
  }
  private unbindKey(): void {
    if (!this.keyOn) return;
    this.keyOn = false;
    window.removeEventListener("keydown", this.onKey);
  }
  private onKey = (e: KeyboardEvent): void => {
    if (this.over) return;
    const r = this.field.getBoundingClientRect();
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      this.targetX = Math.max(18, this.targetX - 34);
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      this.targetX = Math.min(r.width - 18, this.targetX + 34);
      e.preventDefault();
    }
  };

  private spawnSpike(): void {
    const r = this.field.getBoundingClientRect();
    const count =
      this.difficulty === "easy" ? 1 : this.difficulty === "medium" ? 1 : 2;
    const used: number[] = [];
    for (let i = 0; i < count; i++) {
      let x = 0;
      let tries = 0;
      do {
        x = randInt(10, r.width - 46);
        tries += 1;
      } while (tries < 8 && used.some((u) => Math.abs(u - x) < 56));
      used.push(x);
      const el = document.createElement("div");
      el.className = "bb2-spike";
      el.style.left = `${x}px`;
      this.field.appendChild(el);
      this.spikes.push({ x, el });
    }
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    const r = this.field.getBoundingClientRect();
    const W = r.width;

    // 计时
    this.elapsed += dt;
    const tEl = this.root.querySelector("#bb2-time");
    if (tEl) tEl.textContent = this.elapsed.toFixed(1);
    if (this.elapsed >= this.goalSec) {
      this.win();
      return;
    }

    // 物理：重力 + 地面反弹（保持持续弹跳）
    this.vy += 1500 * dt;
    this.by += this.vy * dt;
    if (this.by > this.groundY) {
      this.by = this.groundY;
      this.vy = -760; // 反弹初速度（保证弹起高度足够）
      // 落地压扁动画
      this.ball.classList.remove("bb2-ball--squash");
      void this.ball.offsetWidth; // 重启动画
      this.ball.classList.add("bb2-ball--squash");
    }
    if (this.by < 16) {
      this.by = 16;
      this.vy = Math.abs(this.vy);
    }

    // 水平平滑跟随目标
    this.bx += (this.targetX - this.bx) * Math.min(1, dt * 14);

    this.ball.style.left = `${this.bx}px`;
    this.ball.style.top = `${this.by}px`;

    // 尖刺移动 + 生成
    for (const s of this.spikes) {
      s.x -= this.speed * dt;
      s.el.style.left = `${s.x}px`;
    }
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const s = this.spikes[i]!;
      if (s.x < -50) {
        s.el.remove();
        this.spikes.splice(i, 1);
      }
    }
    const lastS = this.spikes[this.spikes.length - 1];
    if (!lastS || W - (lastS.x + 36) > this.spawnGapDist) {
      this.spawnSpike();
    }

    // 碰撞：球与尖刺（尖刺在地面上方 0-30px，三角形）
    const ballR = 18;
    for (const s of this.spikes) {
      const sw = 36;
      if (this.bx + ballR > s.x && this.bx - ballR < s.x + sw) {
        // 球底部进入尖刺高度区（尖刺从地面向上 30px）
        if (this.by + ballR > this.groundY - 30 + 6) {
          this.hit();
          return;
        }
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    if (this.cleared) return;
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
        this.finishClear(
          starsByScore(this.goalSec, [this.goalSec, this.goalSec]),
        );
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
    this.ball.classList.add("bb2-ball--hit");
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
      body: "小球被扎到啦，再来一次吧～",
      primary: {
        text: "再试一次",
        icon: "⚽",
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
    if (document.getElementById("bb2-style")) return;
    const st = document.createElement("style");
    st.id = "bb2-style";
    st.textContent = BB2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function BB2_CSS(theme: string): string {
  return `
.bb2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.bb2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.bb2-task b{color:${theme};}
.bb2-field{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#b3e5fc 0%,#c8efd9 60%,#9ccc65 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:pointer;}
.bb2-field::before{content:"";position:absolute;left:0;bottom:0;height:20px;width:100%;background:repeating-linear-gradient(90deg,#7cb342 0 30px,#8bc34a 30px 60px);box-shadow:inset 0 3px 0 rgba(255,255,255,.25);z-index:1;}
.bb2-field::after{content:"☁️ ☁️";position:absolute;top:14px;left:0;font-size:1.6rem;letter-spacing:120px;opacity:.6;z-index:1;animation:bb2-cloud 28s linear infinite;}
@keyframes bb2-cloud{from{transform:translateX(0)}to{transform:translateX(-220px)}}
.bb2-ball{position:absolute;left:50%;top:0;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff6,${theme} 65%,color-mix(in srgb,${theme} 70%,#000));box-shadow:inset 0 -4px 6px rgba(0,0,0,.18),0 4px 6px rgba(0,0,0,.18);z-index:5;will-change:left,top;}
.bb2-ball--squash{animation:bb2-squash .18s ease;}
@keyframes bb2-squash{0%{transform:translate(-50%,-50%) scale(1.18,.82)}100%{transform:translate(-50%,-50%) scale(1,1)}}
.bb2-ball--hit{animation:bb2-pop .5s ease forwards;}
@keyframes bb2-pop{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.6);opacity:.6}100%{transform:translate(-50%,-50%) scale(.2);opacity:0}}
.bb2-spike{position:absolute;bottom:20px;width:36px;height:30px;background:linear-gradient(180deg,#ff6348,#b71c1c);clip-path:polygon(50% 0,100% 100%,0 100%);box-shadow:0 2px 3px rgba(0,0,0,.2);z-index:4;will-change:left;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));}
@media (max-width:380px){.bb2-task{font-size:.95rem;}.bb2-ball{width:30px;height:30px;}}
`;
}

export function create(): BouncyBallGame {
  return new BouncyBallGame();
}
