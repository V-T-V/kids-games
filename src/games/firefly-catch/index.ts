/* 萤火虫 Firefly Catch —— 黑夜里几只萤火虫在草丛中飞，会随机地"亮一下又灭"。
   孩子要在它亮着的那一小会儿点中它，抓住它。视觉：暗夜渐变背景 + 闪光萤火虫。
   独特点：反应 + 时机把握。难度 = 萤火虫数 / 亮灯时长。
   通关 = 抓住目标数。前缀 ffc-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Fly {
  x: number;
  y: number;
  /** 漫游目标点 */
  tx: number;
  ty: number;
  on: boolean;
  caught: boolean;
  /** 下次状态切换时间（ms, performance.now） */
  next: number;
  el: HTMLButtonElement;
}

export class FireflyCatchGame extends BaseGame {
  constructor() {
    super("firefly-catch");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private flies: Fly[] = [];
  private caught = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private W = 0;
  private H = 0;
  private stage!: HTMLDivElement;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private params(): {
    flies: number;
    litMs: number;
    offMs: number;
    need: number;
  } {
    if (this.difficulty === "easy")
      return { flies: 4, litMs: 1400, offMs: 700, need: 4 };
    if (this.difficulty === "medium")
      return { flies: 5, litMs: 1100, offMs: 800, need: 5 };
    return { flies: 6, litMs: 850, offMs: 900, need: 6 };
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.over = false;
    const p = this.params();
    this.need = p.need;
    this.caught = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "ffc-wrap";
    const task = document.createElement("div");
    task.className = "ffc-task";
    task.innerHTML = `萤火虫<b>亮起来</b>的时候点它！第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · <span id="ffc-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.stage = document.createElement("div");
    this.stage.className = "ffc-stage";

    // 草丛
    const grass = document.createElement("div");
    grass.className = "ffc-grass";
    this.stage.appendChild(grass);

    wrap.appendChild(this.stage);
    this.root.appendChild(wrap);

    requestAnimationFrame(() => {
      const r = this.stage.getBoundingClientRect();
      this.W = r.width;
      this.H = r.height - 40; // 留出草丛
      this.flies = [];
      const now = performance.now();
      for (let i = 0; i < p.flies; i++) {
        const x = randInt(40, Math.max(50, this.W - 40));
        const y = randInt(30, Math.max(40, this.H - 30));
        const el = document.createElement("button");
        el.type = "button";
        el.className = "ffc-fly";
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.setAttribute("aria-label", "萤火虫");
        const fly: Fly = {
          x,
          y,
          tx: x,
          ty: y,
          on: false,
          caught: false,
          next: now + randInt(200, 1200),
          el,
        };
        el.addEventListener("click", () => this.tap(fly));
        this.stage.appendChild(el);
        this.flies.push(fly);
      }
      this.last = performance.now();
      this.loop();
    });
  }

  private tap(f: Fly): void {
    if (this.over || f.caught) return;
    if (f.on) {
      f.caught = true;
      f.el.classList.add("ffc-fly--caught");
      sfxPop();
      const r = f.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.caught += 1;
      const sc = this.root.querySelector("#ffc-score");
      if (sc) sc.textContent = `${this.caught} / ${this.need}`;
      this.trackTimeout(() => f.el.remove(), 400);
      if (this.caught >= this.need) {
        this.win();
      }
    } else {
      // 灭的时候点：算错（轻提示）
      f.el.classList.add("ffc-fly--miss");
      this.trackTimeout(() => f.el.classList.remove("ffc-fly--miss"), 350);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private win(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.trackTimeout(() => {
      this.roundsDone += 1;
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(
          starsByScore(this.need, [this.need, Math.ceil(this.need / 2)]),
        );
      } else {
        this.startRound();
      }
    }, 600);
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    const p = this.params();
    for (const f of this.flies) {
      if (f.caught) continue;
      // 状态切换
      if (now >= f.next) {
        f.on = !f.on;
        f.next = now + (f.on ? p.litMs : p.offMs) + randInt(-150, 200);
        f.el.classList.toggle("ffc-fly--on", f.on);
        // 灭的时候随机换一个漫游目标
        if (!f.on) {
          f.tx = randInt(30, Math.max(40, this.W - 30));
          f.ty = randInt(30, Math.max(40, this.H - 30));
        }
      }
      // 漫游（缓动靠近目标点）
      f.x += (f.tx - f.x) * Math.min(1, dt * 0.8);
      f.y += (f.ty - f.y) * Math.min(1, dt * 0.8);
      f.el.style.left = `${f.x}px`;
      f.el.style.top = `${f.y}px`;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private showRest(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "✨",
      variant: "rest",
      body: "要等萤火虫亮起来（发光）的时候再点哦！灭的时候抓不到～",
      primary: {
        text: "继续",
        icon: "✨",
        onClick: () => {
          ov.destroy();
          this.over = false;
          this.last = performance.now();
          this.loop();
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
    if (document.getElementById("ffc-style")) return;
    const st = document.createElement("style");
    st.id = "ffc-style";
    st.textContent = FFC_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function FFC_CSS(theme: string): string {
  return `
.ffc-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.ffc-task{font-size:1.05rem;font-weight:800;text-align:center;background:#1f2937;color:#fef9c3;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ffc-task b,.ffc-task span{color:${theme};}
.ffc-stage{position:relative;width:100%;height:56vh;min-height:340px;background:radial-gradient(ellipse at 50% 30%,#1e293b 0%,#0f172a 60%,#020617 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);}
.ffc-stage::before{content:"⭐ ⭐ ✦ ⭐ ✦";position:absolute;inset:0;color:rgba(255,255,255,.35);font-size:.8rem;letter-spacing:30px;padding:14px;white-space:pre;}
.ffc-grass{position:absolute;left:0;right:0;bottom:0;height:40px;background:linear-gradient(180deg,transparent,#14532d 40%,#052e16);clip-path:polygon(0 100%,4% 50%,8% 100%,14% 40%,20% 100%,26% 55%,33% 100%,40% 35%,48% 100%,55% 50%,63% 100%,70% 45%,78% 100%,85% 55%,92% 100%,100% 40%,100% 100%);}
.ffc-fly{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border:none;background:transparent;cursor:pointer;border-radius:50%;font-size:1.6rem;line-height:44px;text-align:center;opacity:.35;color:#475569;transition:opacity .2s,transform .2s,filter .2s;will-change:left,top,transform;}
.ffc-fly::before{content:"";position:absolute;inset:-6px;border-radius:50%;background:radial-gradient(circle,rgba(254,240,138,.0) 0%,transparent 70%);transition:background .2s;}
.ffc-fly--on{opacity:1;color:#fef08a;text-shadow:0 0 12px ${theme},0 0 22px ${theme};transform:scale(1.08);}
.ffc-fly--on::before{background:radial-gradient(circle,rgba(254,240,138,.55) 0%,transparent 70%);}
.ffc-fly--caught{animation:ffc-burst .4s ease forwards;}
@keyframes ffc-burst{0%{transform:scale(1.3);opacity:1}100%{transform:scale(2.4);opacity:0}}
.ffc-fly--miss{animation:ffc-shake .35s ease;}
@keyframes ffc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@media (max-width:380px){.ffc-fly{width:38px;height:38px;margin:-19px 0 0 -19px;font-size:1.4rem;line-height:38px;}}
`;
}

export function create(): FireflyCatchGame {
  return new FireflyCatchGame();
}
