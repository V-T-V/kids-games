/* 形状搜寻 Shape Hunt —— 在一图里找出所有指定形状（三角/圆/方），点对全部。
   独特点：视觉搜索 + 形状识别，区分目标形状和干扰形状。
   巧思：前缀 shn-（区别于 shape-match 的 sm-），形状散布带旋转；难度=目标数。
   形状用 SVG 渲染，可点。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

type ShapeKind = "triangle" | "circle" | "square";

const SHAPE_LABEL: Record<ShapeKind, string> = {
  triangle: "三角形",
  circle: "圆形",
  square: "方形",
};
const SHAPE_EMOJI: Record<ShapeKind, string> = {
  triangle: "🔺",
  circle: "🔵",
  square: "🟥",
};
const ALL_KINDS: ShapeKind[] = ["triangle", "circle", "square"];

interface PlacedShape {
  kind: ShapeKind;
  x: number; // 百分比
  y: number;
  rot: number;
  el: SVGElement;
}

export class ShapeHuntGame extends BaseGame {
  constructor() {
    super("shape-hunt");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private targetCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 5
        : 7;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const target = sample(ALL_KINDS);
    const n = this.targetCount();
    const others = ALL_KINDS.filter((k) => k !== target);
    // 保证有解：目标形状 n 个 + 干扰形状若干
    const distractorCount = n + randInt(2, 4);
    const shapes: { kind: ShapeKind }[] = [];
    for (let i = 0; i < n; i++) shapes.push({ kind: target });
    for (let i = 0; i < distractorCount; i++) {
      shapes.push({ kind: sample(others) });
    }
    const placed = shuffle(shapes);
    this.remaining = n;

    const wrap = document.createElement("div");
    wrap.className = "shn-wrap";

    const task = document.createElement("div");
    task.className = "shn-task";
    task.innerHTML = `找出所有的 <b>${SHAPE_EMOJI[target]}${SHAPE_LABEL[target]}</b>！还剩 <span id="shn-left">${this.remaining}</span> 个`;
    wrap.appendChild(task);

    // SVG 画板
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.classList.add("shn-board");

    // 散布形状（网格扰动避免重叠）
    const positions = this.scatterPositions(placed.length);
    const placedShapes: PlacedShape[] = [];
    placed.forEach((s, idx) => {
      const pos = positions[idx]!;
      const el = this.makeShape(svgNS, s.kind);
      el.setAttribute("x", String(pos.x));
      el.setAttribute("y", String(pos.y));
      el.setAttribute(
        "transform",
        `translate(${pos.x} ${pos.y}) rotate(${randInt(0, 359)})`,
      );
      el.classList.add("shn-shape");
      if (s.kind === target) {
        el.classList.add("shn-shape--target");
        el.addEventListener("click", (e) => this.hitTarget(el, e, task));
      } else {
        el.addEventListener("click", () => this.hitWrong());
      }
      svg.appendChild(el);
      placedShapes.push({ ...s, ...pos, rot: 0, el });
    });
    wrap.appendChild(svg);
    void placedShapes;
    this.root.appendChild(wrap);
  }

  /** 在 6x5 网格里散布位置（百分比坐标，每个单元中心），打散避免重叠。 */
  private scatterPositions(count: number): { x: number; y: number }[] {
    const cells: { x: number; y: number }[] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) {
        cells.push({
          x: 9 + c * 16 + randInt(-3, 3),
          y: 12 + r * 18 + randInt(-3, 3),
        });
      }
    }
    return shuffle(cells).slice(0, count);
  }

  private makeShape(ns: string, kind: ShapeKind): SVGElement {
    const g = document.createElementNS(ns, "g") as SVGElement;
    let path: SVGElement;
    if (kind === "circle") {
      path = document.createElementNS(ns, "circle") as SVGElement;
      path.setAttribute("r", "5");
    } else if (kind === "square") {
      path = document.createElementNS(ns, "rect") as SVGElement;
      path.setAttribute("x", "-5");
      path.setAttribute("y", "-5");
      path.setAttribute("width", "10");
      path.setAttribute("height", "10");
    } else {
      path = document.createElementNS(ns, "polygon") as SVGElement;
      path.setAttribute("points", "0,-6 5.2,4 -5.2,4");
    }
    const color =
      kind === "triangle"
        ? getCssVar("--c-orange")
        : kind === "circle"
          ? getCssVar("--c-blue")
          : getCssVar("--c-red");
    path.setAttribute("fill", color);
    path.setAttribute("stroke", "#fff");
    path.setAttribute("stroke-width", "0.8");
    g.appendChild(path);
    return g;
  }

  private hitTarget(el: SVGElement, e: Event, task: HTMLElement): void {
    el.classList.add("shn-shape--found");
    (el as unknown as SVGGraphicsElement).style.pointerEvents = "none";
    sfxPop();
    this.resetWrongStreak();
    this.remaining -= 1;
    const left = this.root.querySelector("#shn-left");
    if (left) left.textContent = String(this.remaining);
    const me = e as MouseEvent;
    this.onCorrect(me.clientX, me.clientY);
    if (this.remaining <= 0) {
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 800);
    }
    void task;
  }

  private hitWrong(): void {
    const paused = this.onWrong();
    if (paused) this.showRest();
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看清楚形状的样子再点哦～",
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
    if (document.getElementById("shn-style")) return;
    const st = document.createElement("style");
    st.id = "shn-style";
    st.textContent = SHN_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SHN_CSS(theme: string): string {
  return `
.shn-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(440px,100%);}
.shn-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.shn-board{width:min(380px,92vw);height:min(380px,60vh);background:linear-gradient(135deg,#fffef0,#f0fff4);border-radius:22px;box-shadow:var(--shadow);}
.shn-shape{cursor:pointer;}
.shn-shape:hover path{stroke-width:2;}
.shn-shape--found{opacity:.22;pointer-events:none;}
.shn-shape--found path{stroke:${theme};stroke-width:1.4;}
`;
}

export function create(): ShapeHuntGame {
  return new ShapeHuntGame();
}
