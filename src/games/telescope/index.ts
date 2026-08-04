/* 望远镜 Telescope —— 星空背景有许多暗淡的星星，其中几颗特别亮（目标），
   孩子拖动望远镜圆圈，把所有亮星都框进圆圈里。
   独特点：观察 + 精确拖拽定位，望远镜镜片有放大/高亮效果。
   巧思：目标亮星聚集生成（包围圈半径 < 望远镜半径），保证可解；
   望远镜圆圈用 radial-gradient + 边框 + 十字准星。难度=目标星数。
   通关=框住目标轮数。bindPointer 拖拽望远镜。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Star {
  x: number;
  y: number;
  r: number;
  bright: boolean;
  el: HTMLDivElement;
}

export class TelescopeGame extends BaseGame {
  constructor() {
    super("telescope");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private sky!: HTMLDivElement;
  private scope!: HTMLDivElement;
  private stars: Star[] = [];
  /** 望远镜中心（相对 sky） */
  private cx = 0;
  private cy = 0;
  /** 望远镜半径 */
  private readonly scopeR = 78;
  private unbind: (() => void) | null = null;
  private dragging = false;
  private locked = false;
  private backStars: HTMLDivElement[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbind?.();
    this.unbind = null;
  }

  private targetCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.stars = [];
    this.backStars = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "tl2-wrap";

    const task = document.createElement("div");
    task.className = "tl2-task";
    task.innerHTML = `拖动望远镜，把所有<b>最亮的星</b>框进去！<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    this.sky = document.createElement("div");
    this.sky.className = "tl2-sky";

    // 远景装饰星（不参与判定）
    for (let i = 0; i < 60; i++) {
      const s = document.createElement("div");
      s.className = "tl2-bgstar";
      s.style.left = `${Math.random() * 100}%`;
      s.style.top = `${Math.random() * 100}%`;
      const sz = Math.random() * 2 + 1;
      s.style.width = `${sz}px`;
      s.style.height = `${sz}px`;
      s.style.animationDelay = `${Math.random() * 3}s`;
      this.sky.appendChild(s);
      this.backStars.push(s);
    }

    // 望远镜
    this.scope = document.createElement("div");
    this.scope.className = "tl2-scope";
    this.scope.id = "tl2-scope";
    this.sky.appendChild(this.scope);

    wrap.appendChild(this.sky);
    this.root.appendChild(wrap);

    requestAnimationFrame(() => {
      const r = this.sky.getBoundingClientRect();
      // 目标亮星聚集生成：在一个紧凑圆簇内放，确保望远镜能框住
      const n = this.targetCount();
      const clusterCx = randInt(r.width * 0.32, r.width * 0.68);
      const clusterCy = randInt(r.height * 0.32, r.height * 0.66);
      // 簇半径上界：保证所有目标星的包围圆 < scopeR - 10
      const maxCluster = this.scopeR - 18;
      const spread = n <= 2 ? 26 : n === 3 ? 42 : 56;
      const used: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        let x = 0;
        let y = 0;
        let tries = 0;
        do {
          const a = (i / n) * Math.PI * 2 + Math.random();
          const rad = Math.random() * spread;
          x = clusterCx + Math.cos(a) * rad;
          y = clusterCy + Math.sin(a) * rad;
          tries += 1;
        } while (
          tries < 20 &&
          used.some((u) => Math.hypot(u.x - x, u.y - y) < 40)
        );
        used.push({ x, y });
        const el = document.createElement("div");
        el.className = "tl2-star tl2-star--bright";
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.textContent = "⭐";
        this.sky.appendChild(el);
        this.stars.push({ x, y, r: 16, bright: true, el });
      }
      // 干扰星（普通星，不亮）散布，但避开目标簇中心区域
      const otherN =
        this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
      for (let i = 0; i < otherN; i++) {
        const x = randInt(30, r.width - 30);
        const y = randInt(30, r.height - 30);
        const el = document.createElement("div");
        el.className = "tl2-star";
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.textContent = "✨";
        this.sky.appendChild(el);
        this.stars.push({ x, y, r: 14, bright: false, el });
      }
      // 望远镜初始位置：左上
      this.cx = 80;
      this.cy = 80;
      this.placeScope();
      void maxCluster;
    });

    this.unbind = bindPointer(this.sky, {
      down: (p) => {
        this.dragging = true;
        this.moveScope(p);
      },
      move: (p) => {
        if (this.dragging) this.moveScope(p);
      },
      up: () => {
        if (this.dragging && !this.locked) this.checkFrame();
        this.dragging = false;
      },
    });
  }

  private moveScope(p: { x: number; y: number }): void {
    if (this.locked) return;
    const r = this.sky.getBoundingClientRect();
    const x = Math.max(
      this.scopeR,
      Math.min(r.width - this.scopeR, p.x - r.left),
    );
    const y = Math.max(
      this.scopeR,
      Math.min(r.height - this.scopeR, p.y - r.top),
    );
    this.cx = x;
    this.cy = y;
    this.placeScope();
    this.updateHighlight();
  }

  private placeScope(): void {
    this.scope.style.left = `${this.cx}px`;
    this.scope.style.top = `${this.cy}px`;
  }

  /** 实时高亮：目标星进入望远镜则放大。 */
  private updateHighlight(): void {
    for (const s of this.stars) {
      if (!s.bright) continue;
      const inside =
        Math.hypot(s.x - this.cx, s.y - this.cy) <= this.scopeR - 6;
      s.el.classList.toggle("tl2-star--framed", inside);
    }
  }

  private allBrightFramed(): boolean {
    return this.stars
      .filter((s) => s.bright)
      .every(
        (s) => Math.hypot(s.x - this.cx, s.y - this.cy) <= this.scopeR - 6,
      );
  }

  private checkFrame(): void {
    if (this.allBrightFramed()) {
      this.locked = true;
      sfxPop();
      const r = this.scope.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.scope.classList.add("tl2-scope--win");
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      // 没框全：温和反馈，不算硬错（让孩子继续拖）
      this.onWrong();
    }
  }

  private injectStyle(): void {
    if (document.getElementById("tl2-style")) return;
    const st = document.createElement("style");
    st.id = "tl2-style";
    st.textContent = TL2_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function TL2_CSS(theme: string): string {
  return `
.tl2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.tl2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.tl2-task b{color:${theme};}
.tl2-sky{position:relative;width:100%;height:64vh;min-height:380px;background:radial-gradient(ellipse at 50% 40%,#2a2a5e 0%,#1a1a3e 60%,#0d0d24 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow-lg);touch-action:none;cursor:grab;}
.tl2-sky:active{cursor:grabbing;}
.tl2-bgstar{position:absolute;background:#fff;border-radius:50%;opacity:.6;animation:tl2-twinkle 3s ease-in-out infinite alternate;}
@keyframes tl2-twinkle{from{opacity:.25}to{opacity:.9}}
.tl2-star{position:absolute;transform:translate(-50%,-50%);font-size:1.4rem;z-index:2;pointer-events:none;filter:drop-shadow(0 0 3px rgba(255,255,255,.5));}
.tl2-star--bright{font-size:2rem;filter:drop-shadow(0 0 8px #fff176) drop-shadow(0 0 14px #ffe082);animation:tl2-glow 1.4s ease-in-out infinite alternate;}
@keyframes tl2-glow{from{transform:translate(-50%,-50%) scale(1)}to{transform:translate(-50%,-50%) scale(1.15)}}
.tl2-star--framed{filter:drop-shadow(0 0 12px #fff) drop-shadow(0 0 18px #ffeb3b)!important;transform:translate(-50%,-50%) scale(1.25)!important;}
.tl2-scope{position:absolute;width:${156 /* diameter = 2*scopeR */}px;height:156px;transform:translate(-50%,-50%);border-radius:50%;border:4px solid rgba(255,255,255,.85);background:radial-gradient(circle,rgba(99,102,241,.18) 0%,rgba(99,102,241,.05) 70%,transparent 100%);box-shadow:0 0 0 2px rgba(0,0,0,.3) inset,0 6px 18px rgba(0,0,0,.4);z-index:5;pointer-events:none;will-change:left,top;}
/* 十字准星 */
.tl2-scope::before{content:"";position:absolute;top:50%;left:8%;right:8%;height:2px;background:rgba(255,255,255,.5);transform:translateY(-50%);}
.tl2-scope::after{content:"";position:absolute;left:50%;top:8%;bottom:8%;width:2px;background:rgba(255,255,255,.5);transform:translateX(-50%);}
.tl2-scope--win{border-color:#7cff7c;box-shadow:0 0 0 3px rgba(124,255,124,.6) inset,0 0 30px rgba(124,255,124,.7);animation:tl2-winpop .4s ease;}
@keyframes tl2-winpop{from{transform:translate(-50%,-50%) scale(.85)}to{transform:translate(-50%,-50%) scale(1)}}
`;
}

export function create(): TelescopeGame {
  return new TelescopeGame();
}
