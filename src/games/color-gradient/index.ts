/* 颜色渐变排序 Color Gradient —— 给同色系但深浅不同的色块，按从浅到深点击排序。
   独特点：色块带渐变高光，视觉上像一排彩色宝石。
   巧思：通过 HSL 色相相同、亮度递增生成「从浅到深」序列；难度=色块数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle, randInt } from "../../lobby/util.ts";

// 几组同色系（hue, baseSaturation），按色相归类的「家族」
const HUE_FAMILY: { name: string; hue: number; sat: number }[] = [
  { name: "红色", hue: 0, sat: 85 },
  { name: "橙色", hue: 28, sat: 90 },
  { name: "黄色", hue: 48, sat: 90 },
  { name: "绿色", hue: 140, sat: 65 },
  { name: "青色", hue: 190, sat: 75 },
  { name: "蓝色", hue: 220, sat: 80 },
  { name: "紫色", hue: 275, sat: 70 },
  { name: "粉色", hue: 330, sat: 80 },
];

export class ColorGradientGame extends BaseGame {
  constructor() {
    super("color-gradient");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private picked: number[] = [];
  private nextLight = 0;
  private lights: number[] = [];
  /** 展示顺序：order[displayPos] = 该位置色块的「浅→深」序号 */
  private order: number[] = [];
  private curHue = 0;
  private curSat = 80;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private count(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 6
        : 7;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.picked = [];
    this.nextLight = 0;

    const n = this.count();
    const family =
      HUE_FAMILY[randInt(0, HUE_FAMILY.length - 1)] ?? HUE_FAMILY[0]!;
    this.curHue = family.hue;
    this.curSat = family.sat;

    // n 个递增的「深度」序号 0..n-1；亮度 = 由序号换算
    this.lights = [];
    const step = 64 / (n - 1);
    for (let i = 0; i < n; i++) {
      this.lights.push(Math.round(82 - i * step)); // 82% 最浅 → ~18% 最深
    }
    this.order = shuffle(this.lights.map((_, i) => i));

    const wrap = document.createElement("div");
    wrap.className = "cg-wrap";

    const task = document.createElement("div");
    task.className = "cg-task";
    task.innerHTML = `把<span class="cg-family" style="background:hsl(${family.hue},${family.sat}%,55%)">${family.name}</span>从浅到深点一遍<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 关</small>`;
    wrap.appendChild(task);

    const progWrap = document.createElement("div");
    progWrap.className = "cg-progwrap";
    const prog = document.createElement("div");
    prog.className = "cg-prog";
    prog.id = "cg-prog";
    progWrap.appendChild(prog);
    wrap.appendChild(progWrap);

    const grid = document.createElement("div");
    grid.className = "cg-grid";
    this.order.forEach((lightIdx, _displayPos) => {
      const b = document.createElement("div");
      b.className = "cg-block";
      const L = this.lights[lightIdx]!;
      const colTop = `hsl(${family.hue},${family.sat}%,${Math.min(96, L + 14)}%)`;
      const colMid = `hsl(${family.hue},${family.sat}%,${L}%)`;
      const colBot = `hsl(${family.hue},${Math.max(40, family.sat - 10)}%,${Math.max(8, L - 16)}%)`;
      b.style.background = `linear-gradient(150deg, ${colTop}, ${colMid} 55%, ${colBot})`;
      b.dataset.light = String(lightIdx);
      b.addEventListener("click", () => this.onPick(lightIdx, b));
      grid.appendChild(b);
    });
    wrap.appendChild(grid);

    const stripe = document.createElement("div");
    stripe.className = "cg-stripe";
    stripe.id = "cg-stripe";
    wrap.appendChild(stripe);

    this.root.appendChild(wrap);
  }

  private onPick(lightIdx: number, el: HTMLDivElement): void {
    if (el.classList.contains("cg-block--done")) return;
    if (lightIdx !== this.nextLight) {
      const paused = this.onWrong();
      el.classList.add("cg-block--shake");
      this.trackTimeout(() => el.classList.remove("cg-block--shake"), 360);
      void paused;
      return;
    }
    sfxPop();
    el.classList.add("cg-block--done");
    const r = el.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.picked.push(lightIdx);
    this.nextLight += 1;

    const prog = this.root.querySelector<HTMLElement>("#cg-prog");
    if (prog)
      prog.style.width = `${(this.picked.length / this.lights.length) * 100}%`;
    const stripe = this.root.querySelector<HTMLElement>("#cg-stripe");
    if (stripe) {
      const dot = document.createElement("span");
      dot.className = "cg-stripe-dot";
      const L = this.lights[lightIdx]!;
      dot.style.background = `hsl(${this.curHue},${this.curSat}%,${L}%)`;
      stripe.appendChild(dot);
    }
    this.resetWrongStreak();

    if (this.nextLight >= this.lights.length) {
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("cg-style")) return;
    const st = document.createElement("style");
    st.id = "cg-style";
    st.textContent = CG_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function CG_CSS(theme: string): string {
  return `
.cg-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(640px,100%);}
.cg-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.7;color:var(--ink);}
.cg-family{display:inline-block;padding:2px 12px;border-radius:999px;color:#fff;font-size:.95em;margin:0 4px;box-shadow:var(--shadow);}
.cg-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.cg-progwrap{width:min(420px,80%);height:10px;border-radius:999px;background:rgba(58,46,74,.12);overflow:hidden;}
.cg-prog{height:100%;width:0;background:linear-gradient(90deg,${theme},#ffb3d1);border-radius:999px;transition:width .3s ease;}
.cg-grid{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:22px;background:rgba(255,255,255,.7);border-radius:24px;box-shadow:var(--shadow);}
.cg-block{width:74px;height:110px;border-radius:18px 18px 22px 22px;cursor:pointer;position:relative;box-shadow:0 6px 14px rgba(0,0,0,.18),inset 0 -4px 8px rgba(0,0,0,.18);transition:transform .18s ease,box-shadow .18s ease;overflow:hidden;}
.cg-block::before{content:"";position:absolute;inset:6px 6px auto 6px;height:30%;border-radius:12px;background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0));}
.cg-block::after{content:"";position:absolute;left:14px;top:10px;width:14px;height:8px;border-radius:50%;background:rgba(255,255,255,.7);filter:blur(1px);}
.cg-block:hover{transform:translateY(-4px) scale(1.04);box-shadow:0 12px 22px rgba(0,0,0,.25),inset 0 -4px 8px rgba(0,0,0,.18);}
.cg-block:active{transform:translateY(0) scale(.97);}
.cg-block--done{outline:3px solid ${theme};outline-offset:3px;transform:translateY(-6px) scale(1.06);box-shadow:0 14px 26px rgba(0,0,0,.28),inset 0 -4px 8px rgba(0,0,0,.18);}
.cg-block--shake{animation:cg-shake .36s ease;}
@keyframes cg-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
.cg-stripe{display:flex;gap:8px;align-items:center;height:34px;min-height:34px;flex-wrap:wrap;justify-content:center;max-width:80%;}
.cg-stripe-dot{width:28px;height:28px;border-radius:50%;box-shadow:0 3px 8px rgba(0,0,0,.2),inset 0 -3px 5px rgba(0,0,0,.2);animation:cg-pop .35s ease;}
@keyframes cg-pop{0%{transform:scale(0)}70%{transform:scale(1.25)}100%{transform:scale(1)}}
`;
}

export function create(): ColorGradientGame {
  return new ColorGradientGame();
}
