/* 接羽毛 Feather Fall —— 羽毛从天上缓慢飘落（左右摇摆），孩子在底部移动接住器接住。
   独特点：羽毛用正弦摆动模拟飘落（区别于水果的匀加速下落）。
   视觉：天空背景 + 飘动的羽毛 + 接物网兜。用 RAF。
   难度=羽毛数/速度。通关=接住目标数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { createRafLoop } from "../../core/loop.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

const FEATHER_EMOJI = ["🪶", "🍁", "🌸", "🍂"];

interface Feather {
  emoji: string;
  /** 基准 x（中心轴） */
  baseX: number;
  x: number;
  y: number;
  /** 下落速度（像素/秒） */
  vy: number;
  /** 摆动相位 */
  phase: number;
  /** 摆动幅度（像素） */
  swing: number;
  /** 摆动频率 */
  freq: number;
  el: HTMLElement;
}

export class FeatherFallGame extends BaseGame {
  constructor() {
    super("feather-fall");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private stop?: () => void;
  private unbind: (() => void) | null = null;
  private field!: HTMLDivElement;
  private catcher!: HTMLDivElement;

  private feathers: Feather[] = [];
  private score = 0;
  private goal = 6;
  private lastSpawn = 0;
  private spawnGap = 1200;
  private fallSpeed = 50;
  private time = 0;
  private over = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.over = false;
    this.time = 0;
    this.feathers = [];
    this.score = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    /* 难度参数 */
    this.goal =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 9;
    this.fallSpeed =
      this.difficulty === "easy" ? 40 : this.difficulty === "medium" ? 60 : 85;
    this.spawnGap =
      this.difficulty === "easy"
        ? 1300
        : this.difficulty === "medium"
          ? 1000
          : 750;

    const wrap = document.createElement("div");
    wrap.className = "ff2-wrap";

    const bar = document.createElement("div");
    bar.className = "ff2-bar";
    bar.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 接住 <b id="ff2-score">0</b>/${this.goal} 根羽毛`;
    wrap.appendChild(bar);

    this.field = document.createElement("div");
    this.field.className = "ff2-field";
    this.catcher = document.createElement("div");
    this.catcher.className = "ff2-catcher";
    this.catcher.textContent = "🧺";
    this.field.appendChild(this.catcher);
    wrap.appendChild(this.field);

    this.root.appendChild(wrap);

    this.unbind = bindPointer(this.field, {
      move: (p) => this.moveCatcher(p),
      down: (p) => this.moveCatcher(p),
    });

    this.lastSpawn = performance.now();
    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  private moveCatcher(p: { x: number; y: number }): void {
    const r = this.field.getBoundingClientRect();
    const x = Math.max(35, Math.min(r.width - 35, p.x - r.left));
    this.catcher.style.left = `${x}px`;
  }

  private tick = (dt: number): void => {
    if (this.over) return;
    this.time += dt;
    const now = performance.now();
    if (now - this.lastSpawn > this.spawnGap) {
      this.spawn();
      this.lastSpawn = now;
    }

    const r = this.field.getBoundingClientRect();
    const catcherRect = this.catcher.getBoundingClientRect();
    const cx = catcherRect.left + catcherRect.width / 2;
    const cy = catcherRect.top + 14;

    for (let i = this.feathers.length - 1; i >= 0; i--) {
      const f = this.feathers[i]!;
      f.y += f.vy * dt;
      /* 横向正弦摆动 */
      f.x = f.baseX + Math.sin(this.time * f.freq + f.phase) * f.swing;
      f.el.style.top = `${f.y}px`;
      f.el.style.left = `${f.x}px`;
      f.el.style.transform = `translate(-50%,-50%) rotate(${Math.sin(this.time * f.freq + f.phase) * 30}deg)`;

      /* 接住判定 */
      const fx = r.left + f.x;
      const fy = r.top + f.y;
      if (fy > cy - 10 && fy < cy + 30 && Math.abs(fx - cx) < 40) {
        this.catchFeather(f);
        f.el.remove();
        this.feathers.splice(i, 1);
        continue;
      }
      /* 掉到底 */
      if (f.y > r.height) {
        f.el.remove();
        this.feathers.splice(i, 1);
      }
    }
  };

  private spawn(): void {
    const r = this.field.getBoundingClientRect();
    const emoji = FEATHER_EMOJI[randInt(0, FEATHER_EMOJI.length - 1)]!;
    const el = document.createElement("div");
    el.className = "ff2-feather";
    el.textContent = emoji;
    const baseX = randInt(30, r.width - 30);
    el.style.left = `${baseX}px`;
    el.style.top = "-30px";
    this.field.appendChild(el);
    this.feathers.push({
      emoji,
      baseX,
      x: baseX,
      y: -30,
      vy: this.fallSpeed + randInt(-10, 10),
      phase: Math.random() * Math.PI * 2,
      swing: randInt(15, 40),
      freq: 1.5 + Math.random() * 1.5,
      el,
    });
  }

  private catchFeather(f: Feather): void {
    this.score += 1;
    sfxPop();
    const r = this.catcher.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top);
    this.resetWrongStreak();
    const sc = this.root.querySelector("#ff2-score");
    if (sc) sc.textContent = String(this.score);
    if (this.score >= this.goal) {
      this.win();
    }
    void f;
  }

  private win(): void {
    if (this.over) return;
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    this.roundsDone += 1;
    /* 沙盒/接物类按达成数给星：达到目标即 3 星 */
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByScore(this.score, [this.goal, this.goal]));
      } else {
        this.startRound();
      }
    }, 700);
  }

  private injectStyle(): void {
    if (document.getElementById("ff2-style")) return;
    const st = document.createElement("style");
    st.id = "ff2-style";
    st.textContent = FF2_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function FF2_CSS(_theme: string): string {
  return `
.ff2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(440px,100%);}
.ff2-bar{font-size:1.15rem;font-weight:800;background:#fff;padding:8px 24px;border-radius:999px;box-shadow:var(--shadow);}
.ff2-field{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#b3e5fc 0%,#e1f5fe 60%,#fff8e1 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:none;}
.ff2-field::before{content:"☁️";position:absolute;top:20px;left:15%;font-size:2.5rem;opacity:.6;}
.ff2-field::after{content:"☁️";position:absolute;top:40px;right:18%;font-size:1.8rem;opacity:.5;}
.ff2-catcher{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:2.8rem;transition:left .08s linear;z-index:5;filter:drop-shadow(0 3px 4px rgba(0,0,0,.25));}
.ff2-feather{position:absolute;font-size:1.8rem;will-change:top,left;transform:translate(-50%,-50%);}
`;
}

export function create(): FeatherFallGame {
  return new FeatherFallGame();
}
