/* 对称轴判定 SymmetryAxis —— 给一个图形，问它有几条对称轴。
   巧思：SVG 图形 + 虚线对称轴；从选项选数量（0/1/2/3/4/无数）。
   难度 = 图形复杂度。通关 = 答对目标题数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** -1 表示"无数条" */
interface Shape {
  name: string;
  /** 对称轴条数；-1 = 无数 */
  axes: number;
  /** 渲染器：向 SVG 追加图形 + 若干对称轴示意线 */
  draw: (svg: SVGSVGElement) => void;
}

const NS = "http://www.w3.org/2000/svg";

function dashLine(
  svg: SVGSVGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  const ln = document.createElementNS(NS, "line");
  ln.setAttribute("x1", String(x1));
  ln.setAttribute("y1", String(y1));
  ln.setAttribute("x2", String(x2));
  ln.setAttribute("y2", String(y2));
  ln.setAttribute("class", "sa-axis");
  svg.appendChild(ln);
}

function el(tag: string, attrs: Record<string, string>): SVGElement {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]!);
  return e;
}

const SHAPES: Shape[] = [
  {
    name: "圆形",
    axes: -1,
    draw: (svg) => {
      svg.appendChild(
        el("circle", {
          cx: "100",
          cy: "100",
          r: "70",
          class: "sa-shape sa-shape--circle",
        }),
      );
      dashLine(svg, 100, 20, 100, 180);
      dashLine(svg, 20, 100, 180, 100);
    },
  },
  {
    name: "正方形",
    axes: 4,
    draw: (svg) => {
      svg.appendChild(
        el("rect", {
          x: "35",
          y: "35",
          width: "130",
          height: "130",
          class: "sa-shape",
        }),
      );
      dashLine(svg, 100, 35, 100, 165);
      dashLine(svg, 35, 100, 165, 100);
    },
  },
  {
    name: "长方形",
    axes: 2,
    draw: (svg) => {
      svg.appendChild(
        el("rect", {
          x: "25",
          y: "60",
          width: "150",
          height: "80",
          class: "sa-shape",
        }),
      );
      dashLine(svg, 100, 60, 100, 140);
      dashLine(svg, 25, 100, 175, 100);
    },
  },
  {
    name: "等边三角形",
    axes: 3,
    draw: (svg) => {
      svg.appendChild(
        el("polygon", { points: "100,35 35,150 165,150", class: "sa-shape" }),
      );
      dashLine(svg, 100, 35, 100, 150);
    },
  },
  {
    name: "等腰三角形",
    axes: 1,
    draw: (svg) => {
      svg.appendChild(
        el("polygon", { points: "100,35 50,155 150,155", class: "sa-shape" }),
      );
      dashLine(svg, 100, 35, 100, 155);
    },
  },
  {
    name: "平行四边形",
    axes: 0,
    draw: (svg) => {
      svg.appendChild(
        el("polygon", {
          points: "40,150 80,50 170,50 130,150",
          class: "sa-shape",
        }),
      );
    },
  },
  {
    name: "五角星",
    axes: 5,
    draw: (svg) => {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const ang = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? 72 : 30;
        pts.push(
          `${(100 + rad * Math.cos(ang)).toFixed(1)},${(100 + rad * Math.sin(ang)).toFixed(1)}`,
        );
      }
      svg.appendChild(
        el("polygon", {
          points: pts.join(" "),
          class: "sa-shape sa-shape--star",
        }),
      );
      dashLine(svg, 100, 28, 100, 172);
    },
  },
];

const OPT_LABEL: Record<number, string> = {
  [-1]: "无数条",
  0: "0 条",
  1: "1 条",
  2: "2 条",
  3: "3 条",
  4: "4 条",
  5: "5 条",
};

export class SymmetryAxisGame extends BaseGame {
  constructor() {
    super("symmetry-axis");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    // 难度过滤：easy 用 1/2/-1；medium 加 0/3/4；hard 全部
    const pool =
      this.difficulty === "easy"
        ? SHAPES.filter((s) => [1, 2, -1].includes(s.axes))
        : this.difficulty === "medium"
          ? SHAPES.filter((s) => [0, 1, 2, 3, 4, -1].includes(s.axes))
          : SHAPES;
    const shape = sample(pool)!;

    const wrap = document.createElement("div");
    wrap.className = "sa-wrap";

    const task = document.createElement("div");
    task.className = "sa-task";
    task.textContent = `${shape.name} 有几条对称轴？（虚线是其中一些）（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 200 200");
    svg.setAttribute("class", "sa-svg");
    shape.draw(svg);
    wrap.appendChild(svg);

    // 选项
    const opts = document.createElement("div");
    opts.className = "sa-opts";
    const candKeys =
      this.difficulty === "easy" ? [0, 1, 2, -1] : [0, 1, 2, 4, -1];
    const keys = new Set<number>(candKeys);
    keys.add(shape.axes);
    const list = shuffle([...keys]).slice(0, 4);
    if (!list.includes(shape.axes)) list[0] = shape.axes;
    shuffle(list).forEach((k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sa-choice";
      b.textContent = OPT_LABEL[k] ?? `${k} 条`;
      b.addEventListener("click", () => this.choose(k, shape.axes, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(k: number, answer: number, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (k === answer) {
      this.locked = true;
      sfxPop();
      btn.classList.add("sa-choice--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("sa-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("sa-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "沿着虚线对折，两边能完全重合，就是对称轴～",
      primary: { text: "继续", icon: "🎈", onClick: () => ov.destroy() },
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
    if (document.getElementById("sa-style")) return;
    const st = document.createElement("style");
    st.id = "sa-style";
    st.textContent = SA_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function SA_CSS(theme: string): string {
  return `
.sa-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(420px,100%);}
.sa-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.sa-svg{width:min(260px,72vw);height:auto;filter:drop-shadow(0 8px 18px rgba(0,0,0,.12));animation:sa-spin 14s linear infinite;}
@keyframes sa-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.sa-shape{fill:${theme};fill-opacity:.85;stroke:var(--ink);stroke-width:3;stroke-linejoin:round;}
.sa-shape--circle{fill:#9fd0ff;fill-opacity:.8;}
.sa-shape--star{fill:#ffd93d;}
.sa-axis{stroke:#fff;stroke-width:2.5;stroke-dasharray:6 5;opacity:.9;}
.sa-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.sa-choice{min-width:84px;min-height:60px;padding:0 18px;font-size:1.15rem;font-weight:800;border-radius:16px;background:#fff;color:var(--ink);box-shadow:var(--shadow);transition:transform .1s ease;}
.sa-choice:active{transform:scale(.94);}
.sa-choice--done{background:${theme};color:#fff;animation:sa-pop .4s ease;}
.sa-choice--wrong{animation:sa-shake .4s ease;}
@keyframes sa-pop{0%{transform:scale(.7)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes sa-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): SymmetryAxisGame {
  return new SymmetryAxisGame();
}
