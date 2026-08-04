/* 数积木 Knock Blocks —— 看图数出叠起来的积木数量，从选项中选数字。
   独特点：CSS 3D 等距积木堆叠，孩子要心算"看得见+看不见"的全部方块。
   视觉：等距投影方块堆叠（顶面+左侧+右侧三色面），有立体感。难度=积木数(5-15)。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { shuffle, randInt, getCssVar } from "../../lobby/util.ts";

/**
 * 一种积木堆叠布局：给定 n 个积木，分若干层，每层一个或多个方块。
 * 这里用简单的"金字塔/阶梯"式堆叠：从下往上每层方块数递减，
 * 保证孩子能数清。numCount 控制每层块数（从下到上）。
 */
function layerPlan(total: number): number[] {
  // 从底层开始，每层尽量 1-4 块，累积到 total。
  const plan: number[] = [];
  let acc = 0;
  let layer = randInt(2, 3);
  while (acc < total) {
    const remain = total - acc;
    if (remain <= layer) {
      plan.push(remain);
      break;
    }
    plan.push(layer);
    acc += layer;
    layer = Math.max(1, layer - randInt(0, 1));
  }
  return plan;
}

export class KnockBlocksGame extends BaseGame {
  constructor() {
    super("knock-blocks");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private target = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private countMax(): number {
    return this.difficulty === "easy"
      ? 8
      : this.difficulty === "medium"
        ? 12
        : 15;
  }
  private countMin(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 7
        : 9;
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.target = randInt(this.countMin(), this.countMax());
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "knb-wrap";

    const task = document.createElement("div");
    task.className = "knb-task";
    task.innerHTML = `数一数，一共有 <b>几块</b> 积木？`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "knb-stage";
    const scene = document.createElement("div");
    scene.className = "knb-scene";
    this.buildStack(scene);
    stage.appendChild(scene);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "knb-opts";
    // 生成 4 个选项：正确 + 3 个相近错误
    const choices = new Set<number>([this.target]);
    while (choices.size < 4) {
      const delta = randInt(-3, 3);
      if (delta === 0) continue;
      const v = this.target + delta;
      if (v > 0) choices.add(v);
    }
    for (const v of shuffle([...choices])) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "knb-opt";
      b.textContent = String(v);
      b.addEventListener("click", () => this.choose(b, v));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  /** 构建 3D 等距积木堆叠。 */
  private buildStack(scene: HTMLElement): void {
    const layers = layerPlan(this.target);
    // 从顶层（数组首位=底层）开始放，底层 z 高度最低
    // 我们从底层向上：每层向上偏移
    const CUBE = 46; // 方块边长 px
    const bottoms: number[] = [];
    let totalH = 0;
    // 计算每层底部高度（从底向上累加）
    for (let i = layers.length - 1; i >= 0; i--) {
      bottoms[i] = totalH;
      totalH += 1;
    }
    void bottoms;
    const colors = [
      "#ff9f43",
      "#4d96ff",
      "#6bcf7f",
      "#ff6b9d",
      "#a55eea",
      "#ffd93d",
    ];
    layers.forEach((countInLayer, layerIdx) => {
      // layerIdx 0 = 底层；越大越靠上
      const fromBottom = layers.length - 1 - layerIdx; // 距底层高度
      for (let i = 0; i < countInLayer; i++) {
        const cube = document.createElement("div");
        cube.className = "knb-cube";
        const color = colors[layerIdx % colors.length]!;
        cube.style.setProperty("--knb-top", this.lighten(color));
        cube.style.setProperty("--knb-left", color);
        cube.style.setProperty("--knb-right", this.darken(color));
        // 等距坐标：x 随方块横向排列，y 向上
        const ix = i - (countInLayer - 1) / 2;
        const ix2 = fromBottom * 0.5; // 每上一层向右后偏移半格（等距）
        const px = 150 + ix * (CUBE * 0.86) + ix2 * CUBE;
        const py = 170 - fromBottom * (CUBE * 0.6) - i * 0; // 同层不上下错
        cube.style.left = `${px}px`;
        cube.style.top = `${py}px`;
        cube.style.setProperty(
          "--knb-anim-delay",
          `${layerIdx * 0.06 + i * 0.03}s`,
        );
        const left = document.createElement("i");
        cube.appendChild(left);
        scene.appendChild(cube);
      }
    });
  }

  private lighten(hex: string): string {
    return this.shade(hex, 40);
  }
  private darken(hex: string): string {
    return this.shade(hex, -40);
  }
  private shade(hex: string, amt: number): string {
    const h = hex.replace("#", "");
    const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) + amt));
    const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) + amt));
    const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) + amt));
    return `rgb(${r},${g},${b})`;
  }

  private choose(btn: HTMLButtonElement, v: number): void {
    if (this.locked) return;
    if (v === this.target) {
      this.locked = true;
      btn.classList.add("knb-opt--ok");
      sfxPop();
      this.resetWrongStreak();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 750);
    } else {
      btn.classList.add("knb-opt--bad");
      btn.disabled = true;
      this.onWrong();
    }
  }

  private injectStyle(): void {
    if (document.getElementById("knb-style")) return;
    const st = document.createElement("style");
    st.id = "knb-style";
    st.textContent = KB_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function KB_CSS(theme: string): string {
  return `
.knb-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.knb-task{font-size:1.2rem;font-weight:800;text-align:center;}
.knb-stage{width:100%;background:linear-gradient(180deg,#fff7e6,#ffe0b2);border-radius:22px;box-shadow:var(--shadow);padding:10px;}
.knb-scene{position:relative;width:100%;height:260px;}
.knb-cube{position:absolute;width:46px;height:46px;animation:knb-pop .4s ease backwards;animation-delay:var(--knb-anim-delay,0s);}
.knb-cube::before,.knb-cube::after,.knb-cube > i{content:"";position:absolute;}
/* 顶面（菱形）：用旋转缩放 */
.knb-cube::before{top:0;left:0;width:46px;height:46px;background:var(--knb-top,#fff);transform:rotate(45deg) scale(.7,.7);border-radius:8px;box-shadow:inset 0 -3px 6px rgba(0,0,0,.12);}
.knb-cube::after{top:11px;left:23px;width:23px;height:23px;background:var(--knb-right,#888);transform:skewY(30deg);transform-origin:left top;border-radius:4px;}
.knb-cube i{top:11px;left:0;width:23px;height:23px;background:var(--knb-left,#aaa);transform:skewY(-30deg);transform-origin:right top;border-radius:4px;display:block;}
@keyframes knb-pop{0%{transform:translateY(-20px) scale(.6);opacity:0}100%{transform:none;opacity:1}}
.knb-opts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:100%;max-width:380px;}
.knb-opt{min-height:62px;font-size:1.7rem;font-weight:900;border-radius:18px;background:#fff;color:var(--ink);box-shadow:var(--shadow);transition:transform .1s,background .2s;}
.knb-opt:active{transform:scale(.92);}
.knb-opt--ok{background:${theme};color:#fff;animation:knb-bounce .4s ease;}
.knb-opt--bad{background:#ffd1d1;color:#b71c1c;animation:knb-shake .4s ease;}
@keyframes knb-bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
@keyframes knb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.knb-opts{grid-template-columns:repeat(2,1fr);}.knb-cube{width:38px;height:38px;}.knb-cube::after,.knb-cube i{width:19px;height:19px;}.knb-cube::after{top:9px;left:19px;}.knb-cube i{top:9px;}}
`;
}

export function create(): KnockBlocksGame {
  return new KnockBlocksGame();
}
