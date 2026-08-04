/* 鸭塘数鸭 Duck Pond —— 池塘里若干鸭子游动，先短暂展示总数，
   再让一部分鸭子"游走藏起来"，孩子要回答"还剩几只"。
   独特点：动态数数 + 工作记忆（先看见、后藏匿、再回忆），区别于静态计数。
   视觉：圆形池塘（水波纹）+ 游动鸭子 emoji。难度=鸭子数量。
   通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

interface DuckEl {
  el: HTMLDivElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hidden: boolean;
}

export class DuckPondGame extends BaseGame {
  constructor() {
    super("duck-pond");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private raf = 0;
  private over = false;

  private pond!: HTMLDivElement;
  private ducks: DuckEl[] = [];
  private answer = 0; // 正确答案：剩余鸭数
  private phase: "show" | "hide" | "ask" = "show";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** 难度=起始鸭子数 */
  private startCount(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 7
        : 9;
  }
  /** 藏起多少只（保证至少留 1 只，且藏起数 >=1） */
  private hideCount(total: number): number {
    const min = 1;
    const max = Math.max(1, total - 1);
    return randInt(min, max);
  }

  private startRound(): void {
    this.over = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root.innerHTML = "";

    const total = this.startCount();
    const willHide = this.hideCount(total);
    this.answer = total - willHide;

    const wrap = document.createElement("div");
    wrap.className = "dp-wrap";

    const task = document.createElement("div");
    task.className = "dp-task";
    task.id = "dp-task";
    task.innerHTML = `数一数池塘里有 <b>${total}</b> 只鸭子🦆，看好它们在哪～`;
    wrap.appendChild(task);

    this.pond = document.createElement("div");
    this.pond.className = "dp-pond";
    this.pond.id = "dp-pond";
    wrap.appendChild(this.pond);

    this.root.appendChild(wrap);

    // 生成鸭子，铺开分布
    this.ducks = [];
    const rect = { w: 340, h: 240 };
    for (let i = 0; i < total; i++) {
      const el = document.createElement("div");
      el.className = "dp-duck";
      el.textContent = "🦆";
      const x = randInt(20, Math.max(40, rect.w - 60));
      const y = randInt(20, Math.max(40, rect.h - 60));
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      this.pond.appendChild(el);
      const ang = Math.random() * Math.PI * 2;
      const sp =
        this.difficulty === "easy"
          ? 0.4
          : this.difficulty === "medium"
            ? 0.6
            : 0.8;
      this.ducks.push({
        el,
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        hidden: false,
      });
    }

    // 选要藏起来的鸭子索引
    const idxs = shuffle(this.ducks.map((_, i) => i)).slice(0, willHide);
    const hideSet = new Set(idxs);

    this.phase = "show";
    this.loop();

    // 展示阶段：让鸭子游一会儿，然后藏起一部分
    const showMs =
      this.difficulty === "easy"
        ? 2600
        : this.difficulty === "medium"
          ? 2200
          : 1800;
    this.trackTimeout(() => {
      // 藏起：让 hideSet 的鸭子"游走"
      hideSet.forEach((i) => {
        const d = this.ducks[i];
        if (!d) return;
        d.hidden = true;
        d.el.classList.add("dp-duck--gone");
      });
      this.phase = "hide";
      const t = this.root.querySelector("#dp-task");
      if (t) t.innerHTML = `几只鸭子游走啦～<br><b>还剩几只鸭子？</b>`;
      this.trackTimeout(() => this.ask(), 900);
    }, showMs);
  }

  /** 展示答题面板 */
  private ask(): void {
    this.phase = "ask";
    const panel = document.createElement("div");
    panel.className = "dp-answers";
    panel.id = "dp-answers";
    // 提供几个数字选项（含正确答案 + 两个干扰）
    const opts = new Set<number>([this.answer]);
    while (opts.size < 3) {
      const delta = randInt(-2, 2);
      const v = this.answer + delta;
      if (v >= 1 && v <= this.startCount() + 2) opts.add(v);
    }
    for (const v of shuffle([...opts])) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dp-num";
      b.textContent = String(v);
      b.addEventListener("click", () => this.pick(v, b));
      panel.appendChild(b);
    }
    const wrap = this.root.querySelector(".dp-wrap");
    if (wrap) wrap.appendChild(panel);
  }

  private pick(v: number, btn: HTMLButtonElement): void {
    if (this.over) return;
    if (v === this.answer) {
      this.over = true;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.resetWrongStreak();
      btn.classList.add("dp-num--ok");
      // 让藏起的鸭子重新现身
      this.ducks.forEach((d) => {
        if (d.hidden) {
          d.hidden = false;
          d.el.classList.remove("dp-duck--gone");
          d.el.classList.add("dp-duck--back");
        }
      });
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      const t = this.root.querySelector("#dp-task");
      if (t) t.innerHTML = `对啦！还剩 <b>${this.answer}</b> 只鸭子～`;
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    } else {
      btn.classList.add("dp-num--bad");
      btn.disabled = true;
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private loop = (): void => {
    if (this.over) return;
    const r = this.pond.getBoundingClientRect();
    const w = r.width || 340;
    const h = r.height || 240;
    for (const d of this.ducks) {
      if (d.hidden) continue;
      d.x += d.vx;
      d.y += d.vy;
      if (d.x < 6) {
        d.x = 6;
        d.vx = Math.abs(d.vx);
      } else if (d.x > w - 44) {
        d.x = w - 44;
        d.vx = -Math.abs(d.vx);
      }
      if (d.y < 6) {
        d.y = 6;
        d.vy = Math.abs(d.vy);
      } else if (d.y > h - 40) {
        d.y = h - 40;
        d.vy = -Math.abs(d.vy);
      }
      d.el.style.left = `${d.x}px`;
      d.el.style.top = `${d.y}px`;
      d.el.style.transform = d.vx < 0 ? "scaleX(-1)" : "scaleX(1)";
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private showRest(): void {
    const paused = true;
    void paused;
    // 用 overlay 提示，结束后再答
    const ov = document.createElement("div");
    ov.className = "dp-rest";
    ov.textContent = "再数一遍剩下的鸭子～";
    this.root.appendChild(ov);
    this.trackTimeout(() => ov.remove(), 1200);
  }

  private injectStyle(): void {
    if (document.getElementById("dp-style")) return;
    const st = document.createElement("style");
    st.id = "dp-style";
    st.textContent = DP_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function DP_CSS(theme: string): string {
  return `
.dp-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.dp-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.6;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);max-width:420px;}
.dp-task b{color:${theme};}
.dp-pond{position:relative;width:min(360px,92vw);height:260px;border-radius:24px;background:radial-gradient(circle at 50% 40%,#81d4fa,#039be3 80%);box-shadow:var(--shadow-lg),inset 0 0 0 4px rgba(255,255,255,.25);overflow:hidden;}
.dp-pond::before,.dp-pond::after{content:"";position:absolute;left:0;right:0;height:60%;border-radius:50%;background:rgba(255,255,255,.08);animation:dp-wave 3.2s ease-in-out infinite;}
.dp-pond::before{top:30%;}
.dp-pond::after{top:50%;animation-delay:.6s;}
@keyframes dp-wave{0%,100%{transform:translateX(-6%)}50%{transform:translateX(6%)}}
.dp-duck{position:absolute;font-size:2rem;will-change:left,top,transform;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));transition:opacity .4s ease,transform .4s ease;}
.dp-duck--gone{opacity:0;transform:translate(40px,-30px) scale(.4) !important;}
.dp-duck--back{animation:dp-back .5s ease;}
@keyframes dp-back{0%{opacity:0;transform:scale(.4)}100%{opacity:1;transform:scale(1)}}
.dp-answers{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.dp-num{min-width:74px;height:74px;border:none;border-radius:20px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 30%,#fff));font-size:2rem;font-weight:900;color:var(--ink);box-shadow:0 5px 0 color-mix(in srgb,${theme} 50%,#ccc),var(--shadow);cursor:pointer;transition:transform .1s ease;}
.dp-num:active{transform:translateY(4px);box-shadow:0 1px 0 color-mix(in srgb,${theme} 50%,#ccc),var(--shadow);}
.dp-num--ok{background:linear-gradient(160deg,#a5d6a7,#66bb6a);color:#fff;}
.dp-num--bad{background:linear-gradient(160deg,#ffab91,#e57373);color:#fff;opacity:.7;}
.dp-rest{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);background:#fff;padding:8px 16px;border-radius:999px;font-weight:800;box-shadow:var(--shadow);}
@media (max-width:380px){.dp-pond{height:230px;}.dp-num{min-width:62px;height:62px;font-size:1.6rem;}}
`;
}

export function create(): DuckPondGame {
  return new DuckPondGame();
}
