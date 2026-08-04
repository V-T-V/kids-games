/* 捞星星 Star Catch —— 星星从天上落下，孩子在底部移动网兜（左右按钮或拖拽）接住。
   独特点：持续动作 + 接物反应。漏掉的星星不扣命（只算未接住），接够目标数通关。
   视觉：星空 + 下落 ⭐ + 网兜。用 RAF。难度=星星数/速度。通关=接住目标数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByRate } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { createRafLoop } from "../../core/loop.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Star {
  el: HTMLElement;
  x: number;
  y: number;
  vy: number;
  caught: boolean;
}

export class StarCatchGame extends BaseGame {
  constructor() {
    super("star-catch");
  }
  private stop?: () => void;
  private unbind: (() => void) | null = null;
  private stars: Star[] = [];
  private field!: HTMLElement;
  private net!: HTMLElement;
  private netX = 0;
  private caught = 0;
  private spawned = 0;
  private goal = 0;
  /** 计划要生成多少颗星（含漏掉的，用于算正确率） */
  private totalStars = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private lastSpawn = 0;
  private spawnGap = 900;
  private netWidth = 90;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startRound();
  }
  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
    this.unbind?.();
    this.unbind = null;
  }

  private goalCount(): number {
    return this.difficulty === "easy"
      ? 6
      : this.difficulty === "medium"
        ? 8
        : 10;
  }
  private speed(): number {
    return this.difficulty === "easy"
      ? 70
      : this.difficulty === "medium"
        ? 95
        : 120;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.stars = [];
    this.caught = 0;
    this.spawned = 0;
    this.over = false;
    this.goal = this.goalCount();
    this.totalStars = this.goal + 4; // 允许漏 4 颗
    this.spawnGap =
      this.difficulty === "easy"
        ? 1000
        : this.difficulty === "medium"
          ? 800
          : 650;

    const wrap = document.createElement("div");
    wrap.className = "stc-wrap";

    const bar = document.createElement("div");
    bar.className = "stc-bar";
    bar.innerHTML = `已捞 <b id="stc-caught">0</b> / ${this.goal} ⭐`;
    wrap.appendChild(bar);

    const field = document.createElement("div");
    field.className = "stc-field";
    this.field = field;

    // 网兜
    const net = document.createElement("div");
    net.className = "stc-net";
    net.textContent = "🥅";
    this.net = net;
    field.appendChild(net);
    wrap.appendChild(field);

    // 左右按钮（方便低龄儿童）
    const ctrls = document.createElement("div");
    ctrls.className = "stc-ctrls";
    const left = document.createElement("button");
    left.type = "button";
    left.className = "stc-btn";
    left.textContent = "◀";
    const right = document.createElement("button");
    right.type = "button";
    right.className = "stc-btn";
    right.textContent = "▶";
    ctrls.appendChild(left);
    ctrls.appendChild(right);
    wrap.appendChild(ctrls);

    this.root.appendChild(wrap);

    // 初始化网兜位置
    const r = field.getBoundingClientRect();
    this.netWidth = Math.min(110, Math.max(70, r.width * 0.22));
    this.netX = r.width / 2;
    this.layoutNet();

    // 拖拽网兜
    const moveNet = (p: { x: number }): void => {
      const rr = field.getBoundingClientRect();
      const half = this.netWidth / 2;
      this.netX = Math.max(half, Math.min(rr.width - half, p.x - rr.left));
      this.layoutNet();
    };
    this.unbind = bindPointer(field, {
      move: moveNet,
      down: moveNet,
    });
    // 按钮持续移动
    let rafL = 0;
    let rafR = 0;
    const stepL = (): void => {
      const rr = field.getBoundingClientRect();
      const half = this.netWidth / 2;
      this.netX = Math.max(half, Math.min(rr.width - half, this.netX - 7));
      this.layoutNet();
      rafL = requestAnimationFrame(stepL);
    };
    const stepR = (): void => {
      const rr = field.getBoundingClientRect();
      const half = this.netWidth / 2;
      this.netX = Math.max(half, Math.min(rr.width - half, this.netX + 7));
      this.layoutNet();
      rafR = requestAnimationFrame(stepR);
    };
    left.addEventListener("pointerdown", () => {
      cancelAnimationFrame(rafL);
      stepL();
    });
    left.addEventListener("pointerup", () => cancelAnimationFrame(rafL));
    left.addEventListener("pointercancel", () => cancelAnimationFrame(rafL));
    left.addEventListener("pointerleave", () => cancelAnimationFrame(rafL));
    right.addEventListener("pointerdown", () => {
      cancelAnimationFrame(rafR);
      stepR();
    });
    right.addEventListener("pointerup", () => cancelAnimationFrame(rafR));
    right.addEventListener("pointercancel", () => cancelAnimationFrame(rafR));
    right.addEventListener("pointerleave", () => cancelAnimationFrame(rafR));

    this.lastSpawn = performance.now();
    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  private layoutNet(): void {
    this.net.style.left = `${this.netX}px`;
    this.net.style.width = `${this.netWidth}px`;
  }

  private spawn(): void {
    const r = this.field.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "stc-star";
    el.textContent = "⭐";
    const x = randInt(30, Math.max(40, r.width - 30));
    el.style.left = `${x}px`;
    el.style.top = "-40px";
    this.field.appendChild(el);
    this.stars.push({
      el,
      x,
      y: -30,
      vy: this.speed(),
      caught: false,
    });
    this.spawned += 1;
  }

  private tick(dt: number): void {
    if (this.over) return;
    const now = performance.now();
    if (
      now - this.lastSpawn > this.spawnGap &&
      this.spawned < this.totalStars
    ) {
      this.spawn();
      this.lastSpawn = now;
    }
    const fr = this.field.getBoundingClientRect();
    const netRect = this.net.getBoundingClientRect();
    const netLeft = netRect.left - fr.left;
    const netRight = netRect.right - fr.left;
    const netTop = netRect.top - fr.top;

    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i]!;
      if (s.caught) continue;
      s.y += s.vy * dt;
      s.el.style.top = `${s.y}px`;
      // 命中网兜（星星底部进入网兜顶部宽度区间）
      const sBottom = s.y + 26;
      if (
        sBottom >= netTop &&
        sBottom <= netTop + 36 &&
        s.x >= netLeft &&
        s.x <= netRight
      ) {
        s.caught = true;
        s.el.classList.add("stc-star--got");
        sfxPop();
        this.caught += 1;
        this.resetWrongStreak();
        this.onCorrect(fr.left + s.x, netRect.top);
        const c = this.root.querySelector("#stc-caught");
        if (c) c.textContent = String(this.caught);
        this.trackTimeout(() => s.el.remove(), 300);
        if (this.caught >= this.goal) {
          this.finishRound();
        }
        continue;
      }
      if (s.y > fr.height + 40) {
        s.el.remove();
        this.stars.splice(i, 1);
      }
    }

    // 星星都生成完且场上空了：结算（可能没接够 → 仍通关，按正确率算星）
    if (this.spawned >= this.totalStars && this.stars.length === 0) {
      this.finishRound();
    }
  }

  private finishRound(): void {
    if (this.over) return;
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    // 接住率算星
    const stars = starsByRate(this.caught, this.goal);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(stars);
      } else {
        this.startRound();
      }
    }, 600);
  }

  private injectStyle(): void {
    if (document.getElementById("stc-style")) return;
    const st = document.createElement("style");
    st.id = "stc-style";
    st.textContent = STC_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function STC_CSS(theme: string): string {
  return `
.stc-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;}
.stc-bar{font-size:1.2rem;font-weight:800;background:#fff;padding:8px 22px;border-radius:999px;box-shadow:var(--shadow);}
.stc-field{position:relative;width:100%;height:58vh;min-height:340px;background:radial-gradient(ellipse at 50% 0%,#3a3f7a 0%,#1a1d3a 60%,#0d0f24 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:pointer;}
/* 远处星点 */
.stc-field::before{content:"";position:absolute;inset:0;background-image:radial-gradient(1.5px 1.5px at 20% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 70% 20%,#fff,transparent),radial-gradient(1px 1px at 40% 60%,#fff,transparent),radial-gradient(1.5px 1.5px at 85% 70%,#fff,transparent),radial-gradient(1px 1px at 10% 80%,#fff,transparent),radial-gradient(1.5px 1.5px at 55% 45%,#fff,transparent);opacity:.7;}
.stc-net{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);font-size:2rem;height:44px;display:flex;align-items:center;justify-content:center;line-height:1;z-index:5;filter:drop-shadow(0 0 6px ${theme});transition:width .1s;}
.stc-star{position:absolute;font-size:1.8rem;will-change:top;filter:drop-shadow(0 0 4px #ffd93d);animation:stc-twinkle 1.2s ease-in-out infinite;}
.stc-star--got{animation:stc-got .3s forwards;}
@keyframes stc-twinkle{0%,100%{transform:scale(1) rotate(-8deg);}50%{transform:scale(1.1) rotate(8deg);}}
@keyframes stc-got{0%{transform:scale(1);}100%{transform:scale(0) translateY(-20px);opacity:0;}}
.stc-ctrls{display:flex;gap:24px;}
.stc-btn{width:72px;height:64px;border-radius:18px;border:none;font-size:1.6rem;font-weight:800;color:#fff;background:${theme};box-shadow:var(--shadow);cursor:pointer;touch-action:none;}
.stc-btn:active{transform:scale(.92);}
@media (max-width:380px){.stc-btn{width:60px;height:54px;font-size:1.3rem;}}
`;
}

export function create(): StarCatchGame {
  return new StarCatchGame();
}
