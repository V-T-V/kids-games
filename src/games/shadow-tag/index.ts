/* 影子追逃 Shadow Tag —— 屏幕上有一个追逐者和一个逃跑者（影子），
   孩子用手指拖动逃跑者躲避追逐者，坚持到时间到。
   独特点：追逐 AI（向玩家方向移动）+ 实时拖拽，是双实体动作游戏。
   视觉：场地 + 角色 + 影子。用 RAF。难度=追逐速度。
   通关=坚持目标秒数。被抓重开本关。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { createRafLoop } from "../../core/loop.ts";
import { getCssVar } from "../../lobby/util.ts";

export class ShadowTagGame extends BaseGame {
  constructor() {
    super("shadow-tag");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private stop?: () => void;
  private unbind: (() => void) | null = null;
  private field!: HTMLDivElement;
  private runner!: HTMLDivElement;
  private chaser!: HTMLDivElement;
  private shadow!: HTMLDivElement;

  private px = 0;
  private py = 0;
  private cx = 0;
  private cy = 0;
  /** 影子相对玩家的偏移（追逐目标其实是影子） */
  private sx = 0;
  private sy = 0;
  private chaseSpeed = 70;
  /** 拖拽中 */
  private dragging = false;
  /** 当前关已坚持时间（秒） */
  private survived = 0;
  private goalSec = 8;
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
    this.survived = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    this.chaseSpeed =
      this.difficulty === "easy" ? 55 : this.difficulty === "medium" ? 80 : 110;
    this.goalSec =
      this.difficulty === "easy" ? 7 : this.difficulty === "medium" ? 9 : 11;

    const wrap = document.createElement("div");
    wrap.className = "sht-wrap";

    const bar = document.createElement("div");
    bar.className = "sht-bar";
    bar.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · <span id="sht-time">拖小人躲影子，坚持 ${this.goalSec} 秒</span>`;
    wrap.appendChild(bar);

    this.field = document.createElement("div");
    this.field.className = "sht-field";

    this.shadow = document.createElement("div");
    this.shadow.className = "sht-shadow";
    this.shadow.textContent = "👤";
    this.field.appendChild(this.shadow);

    this.runner = document.createElement("div");
    this.runner.className = "sht-runner";
    this.runner.textContent = "🏃";
    this.field.appendChild(this.runner);

    this.chaser = document.createElement("div");
    this.chaser.className = "sht-chaser";
    this.chaser.textContent = "👹";
    this.field.appendChild(this.chaser);

    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    const fw = this.field.clientWidth || 400;
    const fh = this.field.clientHeight || 400;
    /* 玩家在左，追逐者在右 */
    this.px = fw * 0.25;
    this.py = fh * 0.5;
    this.cx = fw * 0.75;
    this.cy = fh * 0.5;
    /* 影子初始在玩家附近，会被追逐者"赶"向玩家 */
    this.sx = this.px + 60;
    this.sy = this.py + 40;

    this.dragging = false;
    this.unbind = bindPointer(this.field, {
      down: (p) => this.onDown(p),
      move: (p) => this.onMove(p),
      up: () => this.onUp(),
    });

    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  private onDown(p: { x: number; y: number }): void {
    const r = this.field.getBoundingClientRect();
    this.px = p.x - r.left;
    this.py = p.y - r.top;
    this.dragging = true;
  }
  private onMove(p: { x: number; y: number }): void {
    if (!this.dragging) return;
    const r = this.field.getBoundingClientRect();
    this.px = Math.max(20, Math.min(r.width - 20, p.x - r.left));
    this.py = Math.max(20, Math.min(r.height - 20, p.y - r.top));
  }
  private onUp(): void {
    this.dragging = false;
  }

  private tick = (dt: number): void => {
    if (this.over) return;
    const fw = this.field.clientWidth;
    const fh = this.field.clientHeight;

    /* 影子始终追逐玩家位置（保持一定距离，让玩家被迫持续移动） */
    const toPlayer = Math.atan2(this.py - this.sy, this.px - this.sx);
    const dist = Math.hypot(this.px - this.sx, this.py - this.sy);
    /* 影子保持离玩家 ~50px 的距离，跟随移动方向 */
    if (dist > 50) {
      this.sx += Math.cos(toPlayer) * this.chaseSpeed * 1.1 * dt;
      this.sy += Math.sin(toPlayer) * this.chaseSpeed * 1.1 * dt;
    }
    /* 影子边界 */
    this.sx = Math.max(20, Math.min(fw - 20, this.sx));
    this.sy = Math.max(20, Math.min(fh - 20, this.sy));

    /* 追逐者向影子靠近（追赶"影子"，碰到影子时玩家若离影子太近就被抓） */
    const toShadow = Math.atan2(this.sy - this.cy, this.sx - this.cx);
    this.cx += Math.cos(toShadow) * this.chaseSpeed * dt;
    this.cy += Math.sin(toShadow) * this.chaseSpeed * dt;
    this.cx = Math.max(20, Math.min(fw - 20, this.cx));
    this.cy = Math.max(20, Math.min(fh - 20, this.cy));

    /* 渲染 */
    this.runner.style.left = `${this.px}px`;
    this.runner.style.top = `${this.py}px`;
    this.shadow.style.left = `${this.sx}px`;
    this.shadow.style.top = `${this.sy}px`;
    this.chaser.style.left = `${this.cx}px`;
    this.chaser.style.top = `${this.cy}px`;

    /* 判定：玩家被自己的影子追上（玩家与影子距离 < 30）即被抓 */
    if (Math.hypot(this.px - this.sx, this.py - this.sy) < 30) {
      this.caught();
      return;
    }

    /* 计时 */
    this.survived += dt;
    const remain = Math.max(0, this.goalSec - this.survived);
    const t = this.root.querySelector("#sht-time");
    if (t) t.textContent = `还剩 ${remain.toFixed(1)} 秒`;
    if (this.survived >= this.goalSec) {
      this.win();
    }
  };

  private caught(): void {
    if (this.over) return;
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    this.runner.classList.add("sht-runner--caught");
    this.onWrong();
    this.trackTimeout(() => this.startRound(), 800);
  }

  private win(): void {
    if (this.over) return;
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    const r = this.runner.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 900);
  }

  private injectStyle(): void {
    if (document.getElementById("sht-style")) return;
    const st = document.createElement("style");
    st.id = "sht-style";
    st.textContent = SHT_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function SHT_CSS(theme: string): string {
  return `
.sht-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(560px,100%);}
.sht-bar{font-size:1rem;font-weight:800;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);text-align:center;}
.sht-field{position:relative;width:100%;height:60vh;min-height:340px;background:radial-gradient(circle at 50% 40%,#4a3a6a,#2a1d3a 70%,#15101f);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:grab;}
.sht-runner{position:absolute;font-size:2.2rem;line-height:1;transform:translate(-50%,-50%);z-index:3;filter:drop-shadow(0 0 8px ${theme});transition:none;}
.sht-runner--caught{animation:sht-flash .2s ease 3;}
@keyframes sht-flash{50%{filter:brightness(2) drop-shadow(0 0 12px #ff6348);}}
.sht-shadow{position:absolute;font-size:2rem;line-height:1;transform:translate(-50%,-50%);opacity:.7;z-index:2;filter:grayscale(1) brightness(.5);transition:none;}
.sht-chaser{position:absolute;font-size:2.2rem;line-height:1;transform:translate(-50%,-50%);z-index:4;filter:drop-shadow(0 0 8px #ff6348);transition:none;}
`;
}

export function create(): ShadowTagGame {
  return new ShadowTagGame();
}
