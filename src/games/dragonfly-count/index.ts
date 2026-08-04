/* 蜻蜓数 Dragonfly Count —— 池塘上空有几只蜻蜓飞舞，短暂展示后蜻蜓飞走（隐藏），
   再问"刚才有几只蜻蜓"，孩子从数字选项里点答案。视觉：池塘 + 蜻蜓 emoji 飞舞。
   独特点：先观察后作答的计数训练。难度 = 蜻蜓数(3-10) + 展示时长。
   通关 = 答对目标轮数。前缀 dfc-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

export class DragonflyCountGame extends BaseGame {
  constructor() {
    super("dragonfly-count");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answer = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private range(): [number, number] {
    if (this.difficulty === "easy") return [3, 5];
    if (this.difficulty === "medium") return [4, 7];
    return [6, 10];
  }

  /** 观察时长（ms）：数越多给的时间略长，难度高时缩短。 */
  private showMs(count: number): number {
    const base =
      this.difficulty === "easy"
        ? 2200
        : this.difficulty === "medium"
          ? 1900
          : 1600;
    return base + count * 120;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    const [lo, hi] = this.range();
    const count = randInt(lo, hi);
    this.answer = count;

    const wrap = document.createElement("div");
    wrap.className = "dfc-wrap";

    const task = document.createElement("div");
    task.className = "dfc-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · <span id="dfc-prompt">数数有几只小飞虫！</span>`;
    wrap.appendChild(task);

    const pond = document.createElement("div");
    pond.className = "dfc-pond";
    // 水面波纹
    const water = document.createElement("div");
    water.className = "dfc-water";
    pond.appendChild(water);

    // 蜻蜓：随机位置、随机飞行方向、不同 emoji
    const flyEls: HTMLSpanElement[] = [];
    for (let i = 0; i < count; i++) {
      const f = document.createElement("span");
      f.className = "dfc-fly";
      // 池塘常见小飞虫（蜻蜓无专属 emoji，用一组飞虫 emoji 轮换，提高辨识度）
      f.textContent = sample(["🦗", "🦟", "🐝"]);
      f.style.left = `${randInt(8, 88)}%`;
      f.style.top = `${randInt(18, 62)}%`;
      f.style.animationDuration = `${randInt(6, 10) / 5}s`;
      f.style.animationDelay = `${randInt(0, 400)}ms`;
      pond.appendChild(f);
      flyEls.push(f);
    }
    wrap.appendChild(pond);

    // 选项（先隐藏）
    const opts = document.createElement("div");
    opts.className = "dfc-options dfc-options--hidden";
    opts.innerHTML = `<div class="dfc-options-label">刚才有几只小飞虫？</div>`;
    const row = document.createElement("div");
    row.className = "dfc-options-row";
    shuffle(this.genOptions(count)).forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dfc-option";
      b.textContent = String(v);
      b.addEventListener("click", () => this.choose(b, v));
      row.appendChild(b);
    });
    opts.appendChild(row);
    wrap.appendChild(opts);
    this.root.appendChild(wrap);

    // 阶段：展示 → 飞走 → 出选项
    const showMs = this.showMs(count);
    // 1. 飞走（淡出移出）
    this.trackTimeout(() => {
      flyEls.forEach((f, i) => {
        f.style.transitionDelay = `${i * 40}ms`;
        f.classList.add("dfc-fly--gone");
      });
    }, showMs);
    // 2. 显示选项
    this.trackTimeout(() => {
      opts.classList.remove("dfc-options--hidden");
      const prompt = this.root.querySelector("#dfc-prompt");
      if (prompt) prompt.textContent = "刚才飞走了几只小飞虫？选数字～";
    }, showMs + 600);
  }

  /** 生成 4 个选项：正确 + 3 个邻近数（保证在 1..12 内不重复）。 */
  private genOptions(count: number): number[] {
    const set = new Set<number>([count]);
    let guard = 0;
    while (set.size < 4 && guard < 60) {
      guard += 1;
      const delta = sample([-2, -1, 1, 2, 3]);
      const v = count + delta;
      if (v >= 1 && v <= 12) set.add(v);
    }
    let fill = 1;
    while (set.size < 4) {
      if (!set.has(fill)) set.add(fill);
      fill += 1;
    }
    return [...set];
  }

  private choose(btn: HTMLButtonElement, value: number): void {
    if (this.locked) return;
    if (value === this.answer) {
      this.locked = true;
      btn.classList.add("dfc-option--right");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 850);
    } else {
      btn.classList.add("dfc-option--wrong");
      this.trackTimeout(() => btn.classList.remove("dfc-option--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    this.locked = true;
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🐝",
      variant: "rest",
      body: "小飞虫出现时，用手指点着一只一只数：1、2、3……记住数到几～",
      primary: {
        text: "继续",
        icon: "🐝",
        onClick: () => {
          ov.destroy();
          this.locked = false;
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
    if (document.getElementById("dfc-style")) return;
    const st = document.createElement("style");
    st.id = "dfc-style";
    st.textContent = DFC_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function DFC_CSS(theme: string): string {
  return `
.dfc-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.dfc-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.dfc-task b{color:${theme};}
.dfc-pond{position:relative;width:100%;max-width:440px;height:300px;border-radius:20px;overflow:hidden;box-shadow:var(--shadow);background:linear-gradient(180deg,#bae6fd 0%,#7dd3fc 40%,#38bdf8 70%,#0284c7 100%);}
.dfc-water{position:absolute;left:50%;right:0;bottom:0;height:38%;background:linear-gradient(180deg,rgba(14,165,233,.0),#0ea5e9);width:100%;transform:translateX(-50%);}
.dfc-water::before,.dfc-water::after{content:"";position:absolute;inset:0;background:repeating-radial-gradient(circle at 30% 50%,transparent 0 18px,rgba(255,255,255,.18) 18px 22px);animation:dfc-ripple 4s linear infinite;}
.dfc-water::after{animation-duration:6s;animation-direction:reverse;opacity:.5;}
@keyframes dfc-ripple{from{background-position:0 0}to{background-position:40px 0}}
.dfc-pond::after{content:"🪷";position:absolute;right:16px;bottom:14px;font-size:2rem;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));}
.dfc-fly{position:absolute;font-size:2rem;line-height:1;z-index:3;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));transition:transform .5s ease,opacity .5s ease;animation:dfc-hover .6s ease-in-out infinite alternate;}
@keyframes dfc-hover{from{transform:translateY(0) rotate(-6deg)}to{transform:translateY(-8px) rotate(6deg)}}
.dfc-fly--gone{transform:translate(120px,-160px) scale(.4) rotate(30deg);opacity:0;}
.dfc-options{display:flex;flex-direction:column;align-items:center;gap:10px;transition:opacity .3s;}
.dfc-options--hidden{opacity:0;pointer-events:none;height:0;overflow:hidden;}
.dfc-options-label{font-size:1.05rem;font-weight:800;color:#0c4a6e;}
.dfc-options-row{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
.dfc-option{min-width:64px;height:64px;border:none;border-radius:16px;background:linear-gradient(180deg,#fff,${theme}33);font-size:1.8rem;font-weight:900;color:#333;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.1);transition:transform .1s;}
.dfc-option:active{transform:translateY(3px);}
.dfc-option--right{background:linear-gradient(180deg,#bff0c1,#6bcf7f);color:#1d6b2c;animation:dfc-bounce .5s ease;}
.dfc-option--wrong{background:linear-gradient(180deg,#ffd0c4,#ff8a72);animation:dfc-shake .5s ease;}
@keyframes dfc-bounce{0%,100%{transform:scale(1)}40%{transform:scale(1.18)}}
@keyframes dfc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.dfc-pond{height:260px;}.dfc-fly{font-size:1.7rem;}.dfc-option{min-width:54px;height:56px;font-size:1.5rem;}}
`;
}

export function create(): DragonflyCountGame {
  return new DragonflyCountGame();
}
