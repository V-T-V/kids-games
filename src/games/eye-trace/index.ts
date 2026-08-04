/* 视觉追踪 Eye Trace —— 多条彩色弯曲交叉的线从左边起点连到右边终点，
   孩子用眼睛追踪一条线，找出它连到右边的哪个终点。
   训练视觉追踪 + 持续注意力。视觉：SVG 绘制弯曲交叉的线，每条不同颜色。
   难度=线条数量 + 交叉复杂度。easy 3 条，medium 4 条，hard 5 条。
   巧思：SVG viewBox 固定 0..600 x 0..400；起点在左侧纵向分布、终点在右侧纵向分布，
   用三次贝塞尔生成蜿蜒路径并互相交叉；起点用彩色圆点标记，目标起点高亮加星。
   答案=被选中起点的线对应的右侧终点序号。前缀 etr-（eye trace）。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { shuffle } from "../../lobby/util.ts";

const W = 600;
const H = 400;
const X_START = 30;
const X_END = 570;

/** 高饱和、易区分的线色。 */
const LINE_COLORS = [
  "#ff5252",
  "#4d96ff",
  "#6bcf7f",
  "#ffb43d",
  "#a55eea",
  "#22d3ee",
];

/** 每条线的几何数据。 */
interface Trace {
  color: string;
  d: string; // SVG path d
  yStart: number;
  yEnd: number;
}

/** 难度 → 线条数。 */
function lineCount(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 3 : diff === "medium" ? 4 : 5;
}

/**
 * 生成 n 条互不共享端点、互相交叉的蜿蜒线。
 * 策略：起点 y 与终点 y 用一个随机错排（保证多数线两端 y 不同，产生交叉），
 * 每条线用两个控制点产生 S 形蜿蜒，控制点 x 落在中间区域、y 随机大幅偏移以增加交叉。
 */
function generateTraces(n: number): Trace[] {
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    // 端点 y 均匀分布在 [50, H-50]，留出边距
    ys.push(50 + (i + 0.5) * ((H - 100) / n));
  }
  const startOrder = shuffle(ys);
  // 终点用错排：整体偏移若干位，确保大多数线斜跨
  const shift = 1 + Math.floor(Math.random() * (n - 1));
  const endOrder: number[] = [];
  for (let i = 0; i < n; i++) endOrder.push(ys[(i + shift) % n]!);

  const traces: Trace[] = [];
  for (let i = 0; i < n; i++) {
    const y0 = startOrder[i]!;
    const y1 = endOrder[i]!;
    // 两个控制点，y 大幅偏离以制造交叉
    const midX1 = W * (0.3 + Math.random() * 0.1);
    const midX2 = W * (0.6 + Math.random() * 0.1);
    const span = H * 0.6;
    const c1y = H / 2 + (Math.random() - 0.5) * span;
    const c2y = H / 2 + (Math.random() - 0.5) * span;
    const d = `M ${X_START} ${y0} C ${midX1} ${c1y}, ${midX2} ${c2y}, ${X_END} ${y1}`;
    traces.push({ color: LINE_COLORS[i % LINE_COLORS.length]!, d, yStart: y0, yEnd: y1 });
  }
  return traces;
}

export class EyeTraceGame extends BaseGame {
  constructor() {
    super("eye-trace");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal = this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空，定时器由基类清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.answered = false;
    const n = lineCount(this.difficulty);
    const traces = generateTraces(n);
    // 随机选一条作为"要追踪的目标"
    const targetIdx = Math.floor(Math.random() * n);
    const target = traces[targetIdx]!;

    const wrap = document.createElement("div");
    wrap.className = "etr-wrap";

    const task = document.createElement("div");
    task.className = "etr-task";
    task.innerHTML = `用眼睛跟着 <span class="etr-swatch" style="background:${target.color}"></span> 这条线走，找它连到右边哪个点（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "etr-svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    // 先画所有线（细一点，避免互相遮挡过甚）
    for (const t of traces) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", t.d);
      path.setAttribute("stroke", t.color);
      path.setAttribute("stroke-width", "6");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      svg.appendChild(path);
    }

    // 画所有左侧起点圆点（目标起点带星标记）
    traces.forEach((t, i) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", String(X_START));
      c.setAttribute("cy", String(t.yStart));
      c.setAttribute("r", "13");
      c.setAttribute("fill", t.color);
      c.setAttribute("stroke", "#fff");
      c.setAttribute("stroke-width", "3");
      svg.appendChild(c);
      if (i === targetIdx) {
        const star = document.createElementNS("http://www.w3.org/2000/svg", "text");
        star.setAttribute("x", String(X_START));
        star.setAttribute("y", String(t.yStart + 6));
        star.setAttribute("text-anchor", "middle");
        star.setAttribute("font-size", "16");
        star.setAttribute("fill", "#fff");
        star.textContent = "★";
        svg.appendChild(star);
      }
    });

    // 画右侧终点（可点击）
    const endPositions = traces.map((t) => t.yEnd);
    traces.forEach((t, i) => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "etr-end");
      g.setAttribute("transform", `translate(${X_END}, ${t.yEnd})`);
      g.dataset.idx = String(i);
      const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("cx", "0");
      ring.setAttribute("cy", "0");
      ring.setAttribute("r", "20");
      ring.setAttribute("fill", "#fff");
      ring.setAttribute("stroke", "#bbb");
      ring.setAttribute("stroke-width", "3");
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", "0");
      label.setAttribute("y", "7");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "20");
      label.setAttribute("font-weight", "900");
      label.setAttribute("fill", "#555");
      // 终点编号：按 y 从上到下排序后给序号，便于孩子点选
      label.textContent = String(sortRank(endPositions, t.yEnd));
      g.appendChild(ring);
      g.appendChild(label);
      g.addEventListener("click", () => this.choose(i === targetIdx, g));
      svg.appendChild(g);
    });

    wrap.appendChild(svg);

    const hint = document.createElement("div");
    hint.className = "etr-hint";
    hint.textContent = "小提示：盯紧带 ★ 的起点，慢慢往右看～";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
  }

  private choose(isTarget: boolean, g: SVGGElement): void {
    if (this.answered) return;
    if (isTarget) {
      this.answered = true;
      g.classList.add("etr-end--right");
      const r = (g as unknown as HTMLElement).getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
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
      g.classList.add("etr-end--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => g.classList.remove("etr-end--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "用眼睛慢慢跟着线走，别被别的颜色带跑啦～",
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
    if (document.getElementById("etr-style")) return;
    const st = document.createElement("style");
    st.id = "etr-style";
    st.textContent = ETR_CSS();
    document.head.appendChild(st);
  }
}

/** 给一组 y 坐标按从小到大排名（1 起），相同值取相同排名。用于右侧终点编号。 */
function sortRank(values: number[], v: number): number {
  let rank = 1;
  for (const x of values) {
    if (x < v) rank += 1;
  }
  return rank;
}

function ETR_CSS(): string {
  return `
.etr-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(640px,100%);}
.etr-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);display:flex;align-items:center;gap:6px;}
.etr-swatch{display:inline-block;width:20px;height:20px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.1);vertical-align:middle;}
.etr-svg{width:100%;height:auto;max-height:60vh;background:linear-gradient(180deg,#fafcff,#eef3ff);border-radius:24px;box-shadow:var(--shadow);border:3px solid #4d96ff33;}
.etr-end{cursor:pointer;transition:transform .12s;transform-box:fill-box;transform-origin:center;}
.etr-end:hover{transform:scale(1.12);}
.etr-end--right circle{fill:#6bcf7f!important;stroke:#4ba85f!important;animation:etr-pop .3s ease;}
.etr-end--right text{fill:#fff!important;}
.etr-end--wrong circle{fill:#ff6348!important;stroke:#d94a30!important;animation:etr-shake .4s ease;}
.etr-end--wrong text{fill:#fff!important;}
.etr-hint{font-size:.95rem;color:#888;font-weight:600;}
@keyframes etr-pop{0%{transform:scale(1)}50%{transform:scale(1.3)}100%{transform:scale(1)}}
@keyframes etr-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.etr-task{font-size:.95rem;}}
`;
}

export function create(): EyeTraceGame {
  return new EyeTraceGame();
}
