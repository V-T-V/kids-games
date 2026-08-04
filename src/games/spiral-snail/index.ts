/* 蜗牛螺旋 Spiral Snail —— 一条从外到内的螺旋路径上有若干节点（标了 1、2、3……），
   孩子要按数字顺序从外圈点到中心，把蜗牛一路引到中心。视觉：SVG 螺旋路径 + 节点 + 蜗牛。
   独特点：顺序 + 路径感知。难度 = 节点数。通关 = 走到中心目标轮数。前缀 sps-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

const NS = "http://www.w3.org/2000/svg";

/** 阿基米德螺旋点：r = a + b*θ，θ 递增。返回 n 个从外到内的点。 */
function spiralPoints(
  cx: number,
  cy: number,
  n: number,
  maxR: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  // 从外圈 θ 大 → 中心 θ 小
  const turns = 1.6; // 圈数
  const startTheta = turns * Math.PI * 2;
  const b = maxR / startTheta; // 每弧度半径增量
  for (let i = 0; i < n; i++) {
    const t = startTheta * (1 - i / (n - 1 || 1)); // 从大到小
    const r = b * t;
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  return pts;
}

/** 根据点列生成一条平滑的 SVG path（用折线即可，节点是离散的）。 */
function spiralPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  let d = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i]!.x.toFixed(1)} ${pts[i]!.y.toFixed(1)}`;
  }
  return d;
}

export class SpiralSnailGame extends BaseGame {
  constructor() {
    super("spiral-snail");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private nextIdx = 0;
  private locked = false;
  private nodeEls: SVGElement[] = [];
  private nodePts: { x: number; y: number }[] = [];
  private snail!: SVGElement;

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
    if (this.difficulty === "easy") return 5;
    if (this.difficulty === "medium") return 7;
    return 9;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    const n = this.count();
    this.nextIdx = 0;
    this.nodeEls = [];

    const wrap = document.createElement("div");
    wrap.className = "sps-wrap";

    const task = document.createElement("div");
    task.className = "sps-task";
    task.innerHTML = `按 <b>1、2、3…</b> 的顺序点圆点，把蜗牛带到中心！第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关`;
    wrap.appendChild(task);

    const size = 320;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size / 2 - 28;
    const pts = spiralPoints(cx, cy, n, maxR);
    this.nodePts = pts;

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("class", "sps-svg");

    // 背景圆盘
    const disc = document.createElementNS(NS, "circle");
    disc.setAttribute("cx", String(cx));
    disc.setAttribute("cy", String(cy));
    disc.setAttribute("r", String(maxR + 18));
    disc.setAttribute("class", "sps-disc");
    svg.appendChild(disc);

    // 螺旋路径线（装饰）
    // 多采样更平滑
    const dense = spiralPoints(cx, cy, n * 6, maxR);
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", spiralPath(dense));
    path.setAttribute("class", "sps-line");
    svg.appendChild(path);

    // 中心目标（花朵）
    const goal = document.createElementNS(NS, "text");
    goal.setAttribute("x", String(cx));
    goal.setAttribute("y", String(cy + 8));
    goal.setAttribute("text-anchor", "middle");
    goal.setAttribute("font-size", "26");
    goal.textContent = "🌸";
    svg.appendChild(goal);

    // 节点
    pts.forEach((p, idx) => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "sps-node");
      g.setAttribute("transform", `translate(${p.x} ${p.y})`);
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("r", "17");
      c.setAttribute("class", "sps-node-circle");
      g.appendChild(c);
      const t = document.createElementNS(NS, "text");
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dy", "6");
      t.setAttribute("class", "sps-node-label");
      t.textContent = String(idx + 1);
      g.appendChild(t);
      g.addEventListener("click", () => this.tap(idx, g));
      svg.appendChild(g);
      this.nodeEls.push(g);
    });

    // 蜗牛（起始在外圈第一个节点旁）
    this.snail = document.createElementNS(NS, "text");
    this.snail.setAttribute("text-anchor", "middle");
    this.snail.setAttribute("dy", "8");
    this.snail.setAttribute("font-size", "26");
    this.snail.setAttribute("class", "sps-snail");
    this.snail.textContent = "🐌";
    this.moveSnail(pts[0]!);
    svg.appendChild(this.snail);

    wrap.appendChild(svg);
    this.root.appendChild(wrap);
  }

  private moveSnail(p: { x: number; y: number }): void {
    this.snail.setAttribute("x", String(p.x));
    this.snail.setAttribute("y", String(p.y - 22));
  }

  private tap(idx: number, g: SVGElement): void {
    if (this.locked) return;
    if (idx === this.nextIdx) {
      this.locked = true;
      g.classList.add("sps-node--done");
      sfxPop();
      const p = this.nodePts[idx]!;
      const r = g.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.moveSnail(p);
      this.nextIdx += 1;
      this.trackTimeout(() => {
        this.locked = false;
        if (this.nextIdx >= this.nodePts.length) {
          // 到达中心
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 700);
        }
      }, 300);
    } else {
      g.classList.add("sps-node--shake");
      this.trackTimeout(() => g.classList.remove("sps-node--shake"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    this.locked = true;
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🐌",
      variant: "rest",
      body: "要按圆点上的数字 1、2、3…… 顺序点，从最外面慢慢走到中间～",
      primary: {
        text: "继续",
        icon: "🐌",
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
    if (document.getElementById("sps-style")) return;
    const st = document.createElement("style");
    st.id = "sps-style";
    st.textContent = SPS_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function SPS_CSS(theme: string): string {
  return `
.sps-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.sps-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.sps-task b{color:${theme};}
.sps-svg{display:block;width:min(340px,86vw);height:min(340px,86vw);background:radial-gradient(circle at 50% 45%,#ede9fe,#ddd6fe 70%,#c4b5fd);border-radius:50%;box-shadow:var(--shadow);touch-action:manipulation;}
.sps-disc{fill:rgba(255,255,255,.25);}
.sps-line{fill:none;stroke:${theme};stroke-width:6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:2 10;opacity:.55;}
.sps-node{cursor:pointer;}
.sps-node-circle{fill:#fff;stroke:${theme};stroke-width:4;transition:all .2s ease;filter:drop-shadow(0 2px 2px rgba(0,0,0,.15));}
.sps-node:hover .sps-node-circle{r:19;}
.sps-node-label{font-size:16px;font-weight:900;fill:#4c1d95;pointer-events:none;user-select:none;}
.sps-node--done .sps-node-circle{fill:${theme};stroke:#7c3aed;}
.sps-node--done .sps-node-label{fill:#fff;}
.sps-node--shake{animation:sps-shake .45s ease;}
@keyframes sps-shake{0%,100%{transform:translate(0,0)}25%{transform:translate(-4px,0)}75%{transform:translate(4px,0)}}
.sps-snail{filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));transition:x .3s ease,y .3s ease;}
@media (max-width:380px){.sps-node-circle{r:15;}.sps-node-label{font-size:14px;}}
`;
}

export function create(): SpiralSnailGame {
  return new SpiralSnailGame();
}
