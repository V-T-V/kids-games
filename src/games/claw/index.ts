/* 抓娃娃机 Claw —— 控制机械爪左右移动，按键放下抓玩偶。
   独特点：物理抓取机制——爪子有抓取范围，时机决定成败。
   视觉：玻璃展示柜 + 机械臂伸缩动画 + 摆动的玩偶。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { getCssVar, sample } from "../../lobby/util.ts";
import { starsByScore } from "../../core/scoring.ts";

const DOLLS = ["🧸", "🐰", "🐱", "🐼", "🦊", "🐯", "🐸", "🐵"];

interface Doll {
  emoji: string;
  x: number;
  y: number;
  el: HTMLElement;
  caught: boolean;
}

export class ClawGame extends BaseGame {
  constructor() {
    super("claw");
  }
  private cabinet!: HTMLDivElement;
  private arm!: HTMLDivElement;
  private claw!: HTMLDivElement;
  private armX = 50;
  private armState: "move" | "drop" | "grab" | "lift" = "move";
  private dolls: Doll[] = [];
  private score = 0;
  private target = 0;
  private raf = 0;
  private dir = 1;
  private over = false;

  protected mount(): void {
    this.target =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    cancelAnimationFrame(this.raf);
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.score = 0;
    this.over = false;
    this.armX = 50;
    this.armState = "move";
    this.dir = 1;

    const wrap = document.createElement("div");
    wrap.className = "cl-wrap";
    const task = document.createElement("div");
    task.className = "cl-task";
    task.innerHTML = `抓到 <span id="cl-score">${this.score}</span>/${this.target} 个玩偶！`;
    wrap.appendChild(task);

    this.cabinet = document.createElement("div");
    this.cabinet.className = "cl-cabinet";
    this.arm = document.createElement("div");
    this.arm.className = "cl-arm";
    this.claw = document.createElement("div");
    this.claw.className = "cl-claw cl-claw--open";
    this.claw.innerHTML =
      '<span class="cl-claw__l"></span><span class="cl-claw__r"></span>';
    this.arm.appendChild(this.claw);
    this.cabinet.appendChild(this.arm);

    // 摆放玩偶
    this.dolls = [];
    const count = this.difficulty === "easy" ? 6 : 8;
    const cols = 4;
    for (let i = 0; i < count; i++) {
      const d: Doll = {
        emoji: sample(DOLLS),
        x: (i % cols) * 25 + 12,
        y: Math.floor(i / cols) * 20 + 78,
        el: document.createElement("div"),
        caught: false,
      };
      d.el.className = "cl-doll";
      d.el.textContent = d.emoji;
      d.el.style.left = `${d.x}%`;
      d.el.style.bottom = `${d.y}%`;
      this.cabinet.appendChild(d.el);
      this.dolls.push(d);
    }
    wrap.appendChild(this.cabinet);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cl-btn";
    btn.textContent = "🫳 放下爪子";
    btn.addEventListener("click", () => this.drop());
    wrap.appendChild(btn);
    this.root.appendChild(wrap);

    this.loop();
  }

  private loop = (): void => {
    if (this.over) return;
    if (this.armState === "move") {
      this.armX += this.dir * 0.6;
      if (this.armX > 88) {
        this.armX = 88;
        this.dir = -1;
      }
      if (this.armX < 12) {
        this.armX = 12;
        this.dir = 1;
      }
      this.arm.style.left = `${this.armX}%`;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private async drop(): Promise<void> {
    if (this.armState !== "move") return;
    this.armState = "drop";
    // 爪子下降
    this.claw.style.transition = "top 0.5s ease-in";
    this.claw.style.top = "70%";
    await this.wait(550);
    // 抓取：判定是否对准某个玩偶
    this.claw.classList.remove("cl-claw--open");
    this.claw.classList.add("cl-claw--closed");
    sfxPop();
    const caught = this.tryGrab();
    await this.wait(300);
    // 上升
    this.claw.style.top = "5%";
    if (caught) {
      caught.el.style.transition = "bottom 0.7s ease, left 0.7s ease";
      caught.el.style.bottom = "20%";
      caught.el.style.left = `${this.armX}%`;
    }
    await this.wait(750);
    // 松开
    this.claw.classList.remove("cl-claw--closed");
    this.claw.classList.add("cl-claw--open");
    if (caught) {
      caught.el.classList.add("cl-doll--got");
      this.score += 1;
      burst(window.innerWidth / 2, window.innerHeight / 2, 16);
      this.resetWrongStreak();
      const sc = this.root.querySelector("#cl-score");
      if (sc) sc.textContent = String(this.score);
      const r = caught.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top);
      this.trackTimeout(() => caught.el.remove(), 600);
      if (this.score >= this.target) {
        this.over = true;
        cancelAnimationFrame(this.raf);
        this.trackTimeout(
          () =>
            this.finishClear(
              starsByScore(this.score, [
                this.target,
                Math.ceil(this.target / 2),
              ]),
            ),
          800,
        );
      } else {
        this.armState = "move";
      }
    } else {
      this.armState = "move";
    }
    this.claw.style.transition = "";
  }

  private tryGrab(): Doll | null {
    // 找最近的、在爪子 x 范围内且未被抓的玩偶
    let best: Doll | null = null;
    let bestDist = 12; // 抓取容差（百分比）
    for (const d of this.dolls) {
      if (d.caught) continue;
      const dist = Math.abs(d.x - this.armX);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    if (best) best.caught = true;
    return best;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.trackTimeout(r, ms));
  }

  private injectStyle(): void {
    if (document.getElementById("cl-style")) return;
    const st = document.createElement("style");
    st.id = "cl-style";
    st.textContent = CL_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function CL_CSS(theme: string): string {
  return `
.cl-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(420px,100%);}
.cl-task{font-size:1.2rem;font-weight:800;}
.cl-cabinet{position:relative;width:320px;height:380px;background:linear-gradient(180deg,rgba(77,182,255,.15),rgba(255,255,255,.6));border:6px solid ${theme};border-radius:20px 20px 8px 8px;overflow:hidden;box-shadow:var(--shadow-lg,inset 0 0 20px rgba(255,255,255,.3));}
.cl-arm{position:absolute;top:0;left:50%;width:6px;height:100%;background:#999;transform:translateX(-50%);transition:left .02s linear;z-index:3;}
.cl-claw{position:absolute;top:5%;left:50%;transform:translateX(-50%);width:40px;height:30px;transition:top .3s;z-index:4;}
.cl-claw__l,.cl-claw__r{position:absolute;top:0;width:16px;height:30px;background:${theme};border-radius:0 0 50% 50%;transition:transform .2s;}
.cl-claw__l{left:0;}
.cl-claw__r{right:0;}
.cl-claw--open .cl-claw__l{transform:rotate(-25deg);transform-origin:top center;}
.cl-claw--open .cl-claw__r{transform:rotate(25deg);transform-origin:top center;}
.cl-claw--closed .cl-claw__l{transform:rotate(0);}
.cl-claw--closed .cl-claw__r{transform:rotate(0);}
.cl-doll{position:absolute;font-size:2rem;transform:translateX(-50%);filter:drop-shadow(0 2px 3px rgba(0,0,0,.2));animation:cl-bob 2s ease-in-out infinite;z-index:2;}
.cl-doll--got{animation:cl-got .6s ease forwards;}
.cl-btn{min-height:60px;padding:0 32px;font-size:1.2rem;font-weight:800;border-radius:999px;background:${theme};color:#fff;box-shadow:var(--shadow);}
.cl-btn:active{transform:scale(.95);}
@keyframes cl-bob{0%,100%{transform:translateX(-50%) rotate(-3deg)}50%{transform:translateX(-50%) rotate(3deg)}}
@keyframes cl-got{to{transform:scale(1.5) translateY(-60px);opacity:0}}
`;
}

export function create(): ClawGame {
  return new ClawGame();
}
