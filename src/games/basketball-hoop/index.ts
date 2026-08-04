/* 投篮进框 Basketball Hoop —— 篮筐在屏幕上方左右移动，孩子在底部按住按钮
   蓄力，松开投球，球沿弧线飞出，进框得分。独特点：蓄力条 + 抛物线 +
   移动篮筐，三要素合力调出"刚刚好"的手感。用 RAF 驱动，unmount 必须
   cancelAnimationFrame。难度=篮筐速度。通关=投进目标数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { getCssVar } from "../../lobby/util.ts";

interface FlyingBall {
  x: number;
  y: number;
  vx: number; // px/s
  vy: number;
  r: number;
}

export class BasketballHoopGame extends BaseGame {
  constructor() {
    super("basketball-hoop");
  }

  private field!: HTMLDivElement;
  private hoop!: HTMLDivElement;
  private ball!: HTMLDivElement;
  private powerBar!: HTMLDivElement;
  private powerFill!: HTMLDivElement;

  private target = 0;
  private made = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private cleared = false;

  // 球场尺寸（逻辑像素）
  private W = 0;
  private H = 0;
  // 球
  private bx = 0;
  private by = 0;
  private ballR = 18;
  private flying: FlyingBall | null = null;
  // 篮筐
  private hoopX = 0; // 中心 x
  private hoopY = 0;
  private hoopDir = 1;
  private hoopW = 70; // 筐口宽度
  private hoopSpeed = 0; // px/s
  // 蓄力
  private charging = false;
  private power = 0; // 0..1
  private chargeStart = 0;
  private pointerDown = false;

  private readonly G = 1500; // 重力 px/s^2

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
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.over = false;
    this.cleared = false;
    this.made = 0;
    this.target =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.hoopSpeed =
      this.difficulty === "easy"
        ? 60
        : this.difficulty === "medium"
          ? 110
          : 170;

    const wrap = document.createElement("div");
    wrap.className = "bkh-wrap";

    const task = document.createElement("div");
    task.className = "bkh-task";
    task.innerHTML = `按住蓄力，松开投篮！投进 <span id="bkh-made">0</span> / ${this.target} 个`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "bkh-field";

    // 篮筐
    this.hoop = document.createElement("div");
    this.hoop.className = "bkh-hoop";
    this.hoop.innerHTML = `<div class="bkh-hoop__back"></div><div class="bkh-hoop__rim"></div><div class="bkh-hoop__net"></div>`;
    this.field.appendChild(this.hoop);

    // 球
    this.ball = document.createElement("div");
    this.ball.className = "bkh-ball";
    this.ball.textContent = "🏀";
    this.field.appendChild(this.ball);

    // 蓄力条（底部）
    this.powerBar = document.createElement("div");
    this.powerBar.className = "bkh-power";
    this.powerFill = document.createElement("div");
    this.powerFill.className = "bkh-power__fill";
    this.powerBar.appendChild(this.powerFill);
    this.field.appendChild(this.powerBar);

    this.field.addEventListener("pointerdown", this.onDown);
    this.field.addEventListener("pointermove", this.onMove);
    this.field.addEventListener("pointerup", this.onUp);
    this.field.addEventListener("pointercancel", this.onUp);

    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.W = r.width;
      this.H = r.height;
      this.hoopY = 70;
      this.hoopX = this.W / 2;
      this.resetBall();
      this.last = performance.now();
      this.loop();
    });
  }

  private resetBall(): void {
    this.bx = this.W / 2;
    this.by = this.H - 56;
    this.flying = null;
    this.power = 0;
    this.charging = false;
    this.pointerDown = false;
    this.powerFill.style.height = "0%";
    this.ball.style.left = `${this.bx}px`;
    this.ball.style.top = `${this.by}px`;
    this.ball.style.transform = "translate(-50%,-50%) rotate(0deg)";
  }

  private onDown = (e: PointerEvent): void => {
    if (this.over || this.flying) return;
    this.pointerDown = true;
    this.charging = true;
    this.chargeStart = performance.now();
    void e;
  };

  private onMove = (): void => {
    /* 蓄力按时间，不需要坐标 */
  };

  private onUp = (): void => {
    this.pointerDown = false;
    if (this.charging) {
      this.charging = false;
      this.release();
    }
  };

  /** 松开 → 投球。根据当前蓄力换算初速度。 */
  private release(): void {
    if (this.flying || this.over) return;
    const p = this.power;
    // 垂直速度区间：大到足以到达顶部篮筐高度
    const vyMin = -Math.sqrt(2 * this.G * (this.H - this.by - this.hoopY + 20));
    const vyMax = vyMin * 1.18; // 多蓄力飞更高更久，便于配合移动筐
    const vy = vyMin + (vyMax - vyMin) * p;
    // 水平速度：朝当前篮筐方向，幅度随蓄力
    const dir = this.hoopX > this.bx ? 1 : this.hoopX < this.bx ? -1 : 0;
    const vx = dir * (180 + p * 220);
    this.flying = { x: this.bx, y: this.by, vx, vy, r: this.ballR };
    sfxPop();
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 篮筐左右移动
    this.hoopX += this.hoopDir * this.hoopSpeed * dt;
    const margin = this.hoopW / 2 + 8;
    if (this.hoopX > this.W - margin) {
      this.hoopX = this.W - margin;
      this.hoopDir = -1;
    } else if (this.hoopX < margin) {
      this.hoopX = margin;
      this.hoopDir = 1;
    }
    this.hoop.style.left = `${this.hoopX}px`;
    this.hoop.style.top = `${this.hoopY}px`;

    // 蓄力
    if (this.charging) {
      this.power = Math.min(1, this.power + dt / 0.9); // 约 0.9s 蓄满
      this.powerFill.style.height = `${this.power * 100}%`;
    }

    // 球飞行
    if (this.flying) {
      const b = this.flying;
      b.vy += this.G * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // 边界反弹（左右）
      if (b.x < b.r) {
        b.x = b.r;
        b.vx = Math.abs(b.vx) * 0.6;
      } else if (b.x > this.W - b.r) {
        b.x = this.W - b.r;
        b.vx = -Math.abs(b.vx) * 0.6;
      }
      this.ball.style.left = `${b.x}px`;
      this.ball.style.top = `${b.y}px`;
      this.ball.style.transform = `translate(-50%,-50%) rotate(${b.x * 1.2}deg)`;

      // 进框判定：球从上方下落穿过筐口区域
      const rimY = this.hoopY;
      const halfW = this.hoopW / 2;
      if (
        b.vy > 0 && // 正在下落
        b.y >= rimY &&
        b.y <= rimY + 18 &&
        b.x > this.hoopX - halfW + 6 &&
        b.x < this.hoopX + halfW - 6
      ) {
        this.score();
        return;
      }
      // 落地或飞出顶部太久 → 算未进，重置球
      if (b.y > this.H + 40 || b.y < -120) {
        this.miss();
        return;
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private score(): void {
    this.flying = null;
    this.made += 1;
    this.ball.classList.add("bkh-ball--score");
    const r = this.hoop.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    const madeEl = this.root.querySelector("#bkh-made");
    if (madeEl) madeEl.textContent = String(this.made);
    if (this.made >= this.target) {
      this.cleared = true;
      this.over = true;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(
            starsByScore(this.made, [
              this.target,
              Math.ceil(this.target * 0.6),
            ]),
          );
        } else {
          this.startRound();
        }
      }, 700);
    } else {
      this.trackTimeout(() => {
        this.ball.classList.remove("bkh-ball--score");
        this.resetBall();
        // 重启 RAF 循环（loop 在投篮时 return 了不会重新调度）
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.loop);
      }, 650);
    }
  }

  private miss(): void {
    this.flying = null;
    const paused = this.onWrong();
    this.ball.classList.add("bkh-ball--miss");
    this.trackTimeout(() => {
      this.ball.classList.remove("bkh-ball--miss");
      this.resetBall();
      // 重启 RAF 循环
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
      if (paused) this.showRest();
    }, 600);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "按住屏幕下面的按钮蓄力，松开就投球～看准篮筐再松手！",
      primary: {
        text: "继续",
        icon: "🏀",
        onClick: () => ov.destroy(),
      },
    });
    ov.show();
  }

  private injectStyle(): void {
    if (document.getElementById("bkh-style")) return;
    const st = document.createElement("style");
    st.id = "bkh-style";
    st.textContent = BKH_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function BKH_CSS(theme: string): string {
  return `
.bkh-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.bkh-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.bkh-task span{color:${theme};font-size:1.4rem;}
.bkh-field{position:relative;width:100%;height:62vh;min-height:380px;background:linear-gradient(180deg,#ffe0b2 0%,#ffcc80 35%,#ff9966 100%);border-radius:22px;overflow:hidden;box-shadow:var(--shadow-lg);touch-action:none;cursor:pointer;}
.bkh-field::before{content:"";position:absolute;left:0;bottom:0;width:100%;height:30px;background:linear-gradient(180deg,#b0743a,#8b5a2b);}
.bkh-field::after{content:"🏀 🏀 🏀";position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font-size:.9rem;opacity:.35;letter-spacing:6px;}
.bkh-hoop{position:absolute;transform:translate(-50%,0);width:70px;}
.bkh-hoop__back{position:absolute;left:50%;top:0;transform:translateX(-50%);width:54px;height:30px;background:#fff;border:3px solid #3a2e4a;border-radius:6px;box-shadow:0 2px 4px rgba(0,0,0,.25);}
.bkh-hoop__rim{position:absolute;left:0;top:28px;width:70px;height:8px;background:${theme};border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.3);}
.bkh-hoop__net{position:absolute;left:50%;top:36px;transform:translateX(-50%);width:60px;height:30px;background:repeating-linear-gradient(180deg,rgba(255,255,255,.9) 0 3px,transparent 3px 7px);border-radius:0 0 18px 18px;clip-path:polygon(8% 0,92% 0,80% 100%,20% 100%);}
.bkh-ball{position:absolute;width:36px;height:36px;font-size:2rem;line-height:36px;text-align:center;transform:translate(-50%,-50%);will-change:left,top,transform;filter:drop-shadow(0 3px 4px rgba(0,0,0,.25));}
.bkh-ball--score{animation:bkh-score .6s ease forwards;}
@keyframes bkh-score{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.5);filter:drop-shadow(0 0 8px #6bcf7f)}100%{transform:translate(-50%,-50%) scale(.2);opacity:0}}
.bkh-ball--miss{animation:bkh-miss .5s ease;}
@keyframes bkh-miss{0%,100%{filter:grayscale(.3)}50%{filter:grayscale(.6) brightness(.9)}}
.bkh-power{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:20px;height:90px;background:rgba(255,255,255,.55);border-radius:10px;box-shadow:inset 0 0 0 2px rgba(58,46,74,.3);overflow:hidden;}
.bkh-power__fill{position:absolute;left:0;bottom:0;width:100%;height:0%;background:linear-gradient(0deg,#6bcf7f,#ffd93d,${theme});border-radius:10px;transition:height .04s linear;}
@media (max-width:380px){.bkh-field{height:56vh;min-height:340px;}.bkh-ball{font-size:1.6rem;}}
`;
}

export function create(): BasketballHoopGame {
  return new BasketballHoopGame();
}
