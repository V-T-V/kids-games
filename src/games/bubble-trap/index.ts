/* 泡泡困虫 Bubble Trap —— 虫子在场地里乱爬，孩子点击放下一个圆形泡泡，
   如果虫子完全在泡泡圈内则算"困住"。
   独特点：动态目标 + 精细瞄准；泡泡放下后虫子会被弹开，多放可围堵。
   视觉：草地 + 爬行的虫子 + 半透明泡泡圈。用 RAF 驱动虫子。
   难度=虫速。通关=困住目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { createRafLoop } from "../../core/loop.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

const BUG_EMOJI = ["🐛", "🐞", "🦗", "🐜"];

interface Bubble {
  x: number;
  y: number;
  r: number;
  el: HTMLDivElement;
}

export class BubbleTrapGame extends BaseGame {
  constructor() {
    super("bubble-trap");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private stop?: () => void;
  private unbind: (() => void) | null = null;
  private field!: HTMLDivElement;
  private bug!: HTMLDivElement;

  private bugX = 0;
  private bugY = 0;
  /** 虫子目标方向（角度，弧度） */
  private bugDir = 0;
  private bugSpeed = 60;
  private bubbles: Bubble[] = [];
  private over = false;
  private bugEmoji = "🐛";

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
    this.bubbles = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    this.bugSpeed =
      this.difficulty === "easy" ? 45 : this.difficulty === "medium" ? 70 : 100;
    this.bugEmoji = BUG_EMOJI[randInt(0, BUG_EMOJI.length - 1)]!;

    const wrap = document.createElement("div");
    wrap.className = "btr-wrap";

    const bar = document.createElement("div");
    bar.className = "btr-bar";
    bar.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · <span id="btr-hint">点草地放泡泡，把虫子圈在里面！</span>`;
    wrap.appendChild(bar);

    this.field = document.createElement("div");
    this.field.className = "btr-field";

    this.bug = document.createElement("div");
    this.bug.className = "btr-bug";
    this.bug.textContent = this.bugEmoji;
    this.field.appendChild(this.bug);

    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    /* 初始化虫子位置在中央 */
    const fw = this.field.clientWidth || 360;
    const fh = this.field.clientHeight || 360;
    this.bugX = fw / 2;
    this.bugY = fh / 2;
    this.bugDir = Math.random() * Math.PI * 2;

    this.unbind = bindPointer(this.field, {
      down: (p) => this.placeBubble(p),
    });

    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  private placeBubble(p: { x: number; y: number }): void {
    if (this.over) return;
    const r = this.field.getBoundingClientRect();
    const x = p.x - r.left;
    const y = p.y - r.top;
    const radius = 52;
    const el = document.createElement("div");
    el.className = "btr-bubble";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${radius * 2}px`;
    el.style.height = `${radius * 2}px`;
    this.field.appendChild(el);
    sfxPop();
    this.bubbles.push({ x, y, r: radius, el });
    /* 泡泡数过多时移除最早的，保持场地清爽 */
    if (this.bubbles.length > 6) {
      const old = this.bubbles.shift();
      old?.el.remove();
    }
    /* 立即检测一次（点击精准命中静止虫子的情况） */
    this.checkTrap();
  }

  private tick = (dt: number): void => {
    if (this.over) return;
    const fw = this.field.clientWidth;
    const fh = this.field.clientHeight;
    /* 虫子移动，遇边界反弹 */
    this.bugX += Math.cos(this.bugDir) * this.bugSpeed * dt;
    this.bugY += Math.sin(this.bugDir) * this.bugSpeed * dt;
    if (this.bugX < 16) {
      this.bugX = 16;
      this.bugDir = Math.PI - this.bugDir;
    } else if (this.bugX > fw - 16) {
      this.bugX = fw - 16;
      this.bugDir = Math.PI - this.bugDir;
    }
    if (this.bugY < 16) {
      this.bugY = 16;
      this.bugDir = -this.bugDir;
    } else if (this.bugY > fh - 16) {
      this.bugY = fh - 16;
      this.bugDir = -this.bugDir;
    }
    /* 偶尔随机改变方向 */
    if (Math.random() < dt * 0.8) {
      this.bugDir += (Math.random() - 0.5) * 1.5;
    }
    /* 远离已有泡泡中心（被泡泡排斥） */
    for (const b of this.bubbles) {
      const dx = this.bugX - b.x;
      const dy = this.bugY - b.y;
      const d = Math.hypot(dx, dy);
      if (d < b.r - 6 && d > 0.01) {
        /* 在泡泡内：推向远离中心方向（增加逃脱难度但不卡死） */
        this.bugDir = Math.atan2(dy, dx);
      }
    }
    this.bug.style.left = `${this.bugX}px`;
    this.bug.style.top = `${this.bugY}px`;
    /* 朝向旋转 */
    this.bug.style.transform = `translate(-50%,-50%) rotate(${this.bugDir}rad)`;

    this.checkTrap();
  };

  /** 检查虫子是否被任意泡泡完全圈住（虫中心在圈内且距边缘有余量） */
  private checkTrap(): void {
    const bugHalf = 14; // 虫子有效半径
    for (const b of this.bubbles) {
      const d = Math.hypot(this.bugX - b.x, this.bugY - b.y);
      if (d + bugHalf <= b.r) {
        this.trap(b);
        return;
      }
    }
  }

  private trap(b: Bubble): void {
    if (this.over) return;
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    b.el.classList.add("btr-bubble--win");
    this.bug.classList.add("btr-bug--trapped");
    const r = b.el.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 1000);
  }

  private injectStyle(): void {
    if (document.getElementById("btr-style")) return;
    const st = document.createElement("style");
    st.id = "btr-style";
    st.textContent = BTR_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function BTR_CSS(theme: string): string {
  return `
.btr-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(560px,100%);}
.btr-bar{font-size:1rem;font-weight:800;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);text-align:center;}
.btr-field{position:relative;width:100%;height:60vh;min-height:340px;background:radial-gradient(circle at 30% 30%,#b6e3a8,#86c97a 70%,#5fa850);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:crosshair;}
.btr-field::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent 0 24px,rgba(255,255,255,.06) 24px 48px);}
.btr-bug{position:absolute;font-size:1.8rem;line-height:1;transform:translate(-50%,-50%);z-index:3;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3));transition:none;}
.btr-bug--trapped{animation:btr-shake .3s ease 3;}
@keyframes btr-shake{25%{transform:translate(-50%,-50%) rotate(.3rad) scale(1.1);}75%{transform:translate(-50%,-50%) rotate(-.3rad) scale(.9);}}
.btr-bubble{position:absolute;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.7),${theme}55 60%,${theme}33);border:2px solid rgba(255,255,255,.7);box-shadow:inset 0 0 16px rgba(255,255,255,.4),0 4px 10px rgba(0,0,0,.15);pointer-events:none;animation:btr-pop .3s cubic-bezier(.5,1.6,.5,1);z-index:2;}
@keyframes btr-pop{0%{transform:translate(-50%,-50%) scale(0);}100%{transform:translate(-50%,-50%) scale(1);}}
.btr-bubble--win{background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.8),rgba(107,207,127,.6) 60%,rgba(107,207,127,.4));border-color:#6bcf7f;animation:btr-pulse .6s ease infinite;}
@keyframes btr-pulse{0%,100%{box-shadow:inset 0 0 16px rgba(255,255,255,.4),0 0 0 0 rgba(107,207,127,.5);}50%{box-shadow:inset 0 0 16px rgba(255,255,255,.4),0 0 0 16px rgba(107,207,127,0);}}
`;
}

export function create(): BubbleTrapGame {
  return new BubbleTrapGame();
}
