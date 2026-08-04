/* 数花瓣 Petal Count —— 显示一朵花，有若干花瓣，问"有几片花瓣"，
   孩子从 4 个选项里选出正确数量。
   独特点：花的视觉生成（径向花瓣 + 中心）训练点数 + 数量对应。
   视觉：花朵（中心 + 旋转分布的花瓣）。难度=花瓣数(3-12)。
   通关=答对目标轮数。巧思：花瓣围绕中心均匀分布，颜色随难度变化更鲜亮。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt, shuffle, sample } from "../../lobby/util.ts";

const PETAL_COLORS = ["#ff6b9d", "#ffd93d", "#ff9f43", "#a55eea", "#ff6348"];

export class PetalCountGame extends BaseGame {
  constructor() {
    super("petal-count");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private currentAnswer = 0;
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
    if (this.difficulty === "easy") return [3, 6];
    if (this.difficulty === "medium") return [5, 9];
    return [8, 12];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    const [lo, hi] = this.range();
    const count = randInt(lo, hi);
    this.currentAnswer = count;

    /* 生成 4 个选项：正确答案 + 3 个邻近干扰 */
    const opts = new Set<number>([count]);
    let guard = 0;
    while (opts.size < 4 && guard < 50) {
      guard += 1;
      const delta = sample([-2, -1, 1, 2]);
      const v = count + delta;
      if (v >= 1 && v <= 15) opts.add(v);
    }
    let fill = 1;
    while (opts.size < 4) {
      if (!opts.has(fill)) opts.add(fill);
      fill += 1;
    }

    const wrap = document.createElement("div");
    wrap.className = "pc2-wrap";

    const task = document.createElement("div");
    task.className = "pc2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 这朵花有几片花瓣？数一数！`;
    wrap.appendChild(task);

    const flower = document.createElement("div");
    flower.className = "pc2-flower";
    const petalColor = sample(PETAL_COLORS);
    const rotStep = 360 / count;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "pc2-petal";
      p.style.setProperty("--pc2-color", petalColor);
      p.style.transform = `rotate(${i * rotStep}deg)`;
      /* 入场延迟 */
      p.style.animationDelay = `${i * 60}ms`;
      flower.appendChild(p);
    }
    const center = document.createElement("div");
    center.className = "pc2-center";
    center.textContent = "🌼";
    flower.appendChild(center);
    wrap.appendChild(flower);

    const optsEl = document.createElement("div");
    optsEl.className = "pc2-options";
    shuffle([...opts]).forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pc2-option";
      b.textContent = String(v);
      b.addEventListener("click", (e) => this.choose(b, v, e));
      optsEl.appendChild(b);
    });
    wrap.appendChild(optsEl);

    this.root.appendChild(wrap);
  }

  private choose(btn: HTMLButtonElement, value: number, e: MouseEvent): void {
    if (this.locked) return;
    if (value === this.currentAnswer) {
      this.locked = true;
      btn.classList.add("pc2-option--right");
      sfxPop();
      this.onCorrect(e.clientX, e.clientY);
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
      btn.classList.add("pc2-option--wrong");
      this.trackTimeout(() => btn.classList.remove("pc2-option--wrong"), 500);
      this.onWrong();
    }
  }

  private injectStyle(): void {
    if (document.getElementById("pc2-style")) return;
    const st = document.createElement("style");
    st.id = "pc2-style";
    st.textContent = PC2_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function PC2_CSS(theme: string): string {
  return `
.pc2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.pc2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.pc2-flower{position:relative;width:240px;height:240px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(255,255,255,.7),transparent 70%);border-radius:50%;}
.pc2-petal{position:absolute;width:46px;height:70px;left:50%;top:50%;margin-left:-23px;margin-top:-78px;background:linear-gradient(180deg,var(--pc2-color,${theme}),#fff8);border-radius:60% 60% 50% 50%/80% 80% 40% 40%;transform-origin:50% 78px;box-shadow:inset 0 -6px 10px rgba(0,0,0,.12),0 4px 8px rgba(0,0,0,.12);opacity:0;animation:pc2-bloom .4s ease forwards;}
@keyframes pc2-bloom{0%{opacity:0;transform:scale(.3);}100%{opacity:1;}}
.pc2-center{position:relative;font-size:3rem;z-index:5;filter:drop-shadow(0 3px 4px rgba(0,0,0,.25));}
.pc2-options{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:100%;max-width:400px;}
.pc2-option{font-size:1.6rem;font-weight:800;padding:18px 0;border:none;border-radius:16px;background:#fff;color:#333;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s ease,background .2s;}
.pc2-option:active{transform:scale(.94);}
.pc2-option--right{background:linear-gradient(135deg,#6bcf7f,#4ed976);color:#fff;}
.pc2-option--wrong{background:linear-gradient(135deg,#ff6348,#e74c3c);color:#fff;animation:pc2-shake .3s ease;}
@keyframes pc2-shake{25%{transform:translateX(-4px);}75%{transform:translateX(4px);}}
@media (max-width:380px){.pc2-flower{width:200px;height:200px;}.pc2-petal{width:38px;height:58px;margin-left:-19px;margin-top:-58px;transform-origin:50% 58px;}.pc2-options{grid-template-columns:repeat(2,1fr);}}
`;
}

export function create(): PetalCountGame {
  return new PetalCountGame();
}
