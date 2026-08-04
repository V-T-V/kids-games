/* 魔法阵 Spell Circle —— 一个发光圆环上排布着若干符文节点，孩子要按 1,2,3… 的顺序
   点击激活它们，全部点亮后圆环整体发光、魔法阵完成。
   独特点：数字顺序 + SVG 连线动画。节点带编号，每次点对就把它与上一个节点连出
   发光线段，连错顺序则抖动提示。全部点亮后整体辉光。
   视觉：SVG 圆环 + 发光符文节点 + 连线。难度=节点数。通关=激活目标轮数。
   解保证：每个节点都有唯一编号，按序点击一定可完成。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

const GLYPHS = ["✦", "✧", "❂", "✺", "✶", "❖", "✷", "◈", "✹", "✪"];

export class SpellCircleGame extends BaseGame {
  constructor() {
    super("spell-circle");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private nodeN = 0;
  private next = 0; // 下一个该点的编号（1-based）

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private nodeCount(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 7
        : 9;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.nodeN = this.nodeCount();
    this.next = 1;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "spl-wrap";
    const task = document.createElement("div");
    task.className = "spl-task";
    task.innerHTML = `按 <b>1, 2, 3…</b> 的顺序点亮符文！（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // SVG 魔法阵
    const size = 340;
    const cx = size / 2;
    const cy = size / 2;
    const R = 132;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("class", "spl-svg");

    // 装饰外环
    const outer = document.createElementNS(svgNS, "circle");
    outer.setAttribute("cx", String(cx));
    outer.setAttribute("cy", String(cy));
    outer.setAttribute("r", String(R + 14));
    outer.setAttribute("class", "spl-ring spl-ring--outer");
    svg.appendChild(outer);
    const inner = document.createElementNS(svgNS, "circle");
    inner.setAttribute("cx", String(cx));
    inner.setAttribute("cy", String(cy));
    inner.setAttribute("r", String(R - 14));
    inner.setAttribute("class", "spl-ring spl-ring--inner");
    svg.appendChild(inner);

    // 中心符文
    const center = document.createElementNS(svgNS, "text");
    center.setAttribute("x", String(cx));
    center.setAttribute("y", String(cy + 12));
    center.setAttribute("text-anchor", "middle");
    center.setAttribute("class", "spl-center");
    center.textContent = "🔮";
    svg.appendChild(center);

    // 连线层（放在节点下方）
    const lineLayer = document.createElementNS(svgNS, "g");
    lineLayer.setAttribute("id", "spl-lines");
    svg.appendChild(lineLayer);

    // 节点
    const firstPt = { x: cx, y: cy - R };
    for (let i = 0; i < this.nodeN; i++) {
      const ang = -Math.PI / 2 + (Math.PI * 2 * i) / this.nodeN;
      const x = cx + Math.cos(ang) * R;
      const y = cy + Math.sin(ang) * R;
      const num = i + 1;
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("class", "spl-node");
      g.setAttribute("transform", `translate(${x} ${y})`);
      g.dataset.num = String(num);

      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("r", "22");
      circle.setAttribute("class", "spl-node-bg");
      g.appendChild(circle);

      const glyph = document.createElementNS(svgNS, "text");
      glyph.setAttribute("text-anchor", "middle");
      glyph.setAttribute("y", "-2");
      glyph.setAttribute("class", "spl-glyph");
      glyph.textContent = GLYPHS[i % GLYPHS.length]!;
      g.appendChild(glyph);

      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("y", "12");
      label.setAttribute("class", "spl-num");
      label.textContent = String(num);
      g.appendChild(label);

      g.addEventListener("click", () => this.activate(num, g, x, y, cx, cy));
      svg.appendChild(g);

      if (i === 0) {
        firstPt.x = x;
        firstPt.y = y;
      }
    }
    void firstPt;

    wrap.appendChild(svg);
    this.root.appendChild(wrap);
  }

  private activate(
    num: number,
    g: SVGGElement,
    x: number,
    y: number,
    cx: number,
    cy: number,
  ): void {
    if (g.classList.contains("spl-node--on")) return;
    if (num !== this.next) {
      // 顺序错：抖动
      g.classList.remove("spl-shake");
      void g.getBoundingClientRect();
      g.classList.add("spl-shake");
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    g.classList.add("spl-node--on");
    sfxPop();
    // 屏幕坐标用于粒子
    const r = g.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();

    // 画连线：中心 → 第一个；之后 上一个 → 当前
    const svgNS = "http://www.w3.org/2000/svg";
    const lineLayer = this.root.querySelector("#spl-lines");
    if (lineLayer) {
      const line = document.createElementNS(svgNS, "line");
      if (this.next === 1) {
        line.setAttribute("x1", String(cx));
        line.setAttribute("y1", String(cy));
      } else {
        // 上一个已激活节点的坐标
        const prev = this.root.querySelector(
          `.spl-node[data-num="${this.next - 1}"]`,
        ) as SVGGElement | null;
        const t = prev?.getAttribute("transform") ?? "";
        const m = t.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
        const px = m ? Number(m[1]) : cx;
        const py = m ? Number(m[2]) : cy;
        line.setAttribute("x1", String(px));
        line.setAttribute("y1", String(py));
      }
      line.setAttribute("x2", String(x));
      line.setAttribute("y2", String(y));
      line.setAttribute("class", "spl-link");
      lineLayer.appendChild(line);
    }

    this.next += 1;
    if (this.next > this.nodeN) {
      // 全部点亮：整体辉光
      const svg = this.root.querySelector(".spl-svg");
      svg?.classList.add("spl-svg--complete");
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "从数字 1 开始，按顺序一个一个点亮哦～",
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
    if (document.getElementById("spl-style")) return;
    const st = document.createElement("style");
    st.id = "spl-style";
    st.textContent = SPL_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function SPL_CSS(theme: string): string {
  return `
.spl-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(380px,100%);}
.spl-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.spl-svg{width:min(340px,90vw);height:min(340px,90vw);background:radial-gradient(circle at 50% 45%,rgba(99,102,241,.18),transparent 70%),rgba(255,255,255,.5);border-radius:50%;box-shadow:0 0 30px rgba(99,102,241,.25),var(--shadow);}
.spl-svg--complete{animation:spl-glow 1s ease;}
.spl-ring{fill:none;stroke:${theme};stroke-width:2;opacity:.55;stroke-dasharray:4 6;}
.spl-ring--outer{stroke-dasharray:2 8;}
.spl-center{font-size:26px;}
.spl-node{cursor:pointer;}
.spl-node-bg{fill:#fff;stroke:${theme};stroke-width:3;transition:fill .2s,r .2s;filter:drop-shadow(0 2px 3px rgba(0,0,0,.2));}
.spl-glyph{font-size:16px;fill:${theme};font-weight:900;}
.spl-num{font-size:9px;fill:${theme};opacity:.7;font-weight:700;}
.spl-node:hover .spl-node-bg{r:25;}
.spl-node--on .spl-node-bg{fill:${theme};stroke:#fff;}
.spl-node--on .spl-glyph{fill:#fff;}
.spl-node--on .spl-num{fill:#fff;opacity:1;}
.spl-shake{animation:spl-shake .4s ease;transform-origin:center;transform-box:fill-box;}
@keyframes spl-shake{0%,100%{transform:translate(0,0)}25%{transform:translate(-3px,0)}75%{transform:translate(3px,0)}}
.spl-link{stroke:${theme};stroke-width:3;stroke-linecap:round;opacity:.9;filter:drop-shadow(0 0 4px ${theme});animation:spl-draw .3s ease;}
@keyframes spl-draw{0%{stroke-dasharray:0 200;opacity:0}100%{stroke-dasharray:200 0;opacity:.9}}
@keyframes spl-glow{0%{filter:none}50%{filter:drop-shadow(0 0 24px ${theme})}100%{filter:none}}
`;
}

export function create(): SpellCircleGame {
  return new SpellCircleGame();
}
