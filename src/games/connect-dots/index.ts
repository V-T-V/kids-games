/* 连点成画 Connect Dots —— 按数字顺序点击点，连成图案。
   巧思：SVG 路径连线，彩色渐变，连完图案高亮庆祝。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, playNote } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

// 几个简单图案的点坐标（归一化 0-100）
const SHAPES: { name: string; emoji: string; pts: [number, number][] }[] = [
  {
    name: "星星",
    emoji: "⭐",
    pts: [
      [50, 8],
      [61, 38],
      [92, 38],
      [67, 57],
      [77, 88],
      [50, 69],
      [23, 88],
      [33, 57],
      [8, 38],
      [39, 38],
    ],
  },
  {
    name: "小鱼",
    emoji: "🐟",
    pts: [
      [20, 50],
      [35, 30],
      [60, 28],
      [80, 40],
      [80, 60],
      [60, 72],
      [35, 70],
      [20, 50],
      [10, 35],
      [10, 65],
    ],
  },
  {
    name: "小屋",
    emoji: "🏠",
    pts: [
      [50, 10],
      [85, 38],
      [85, 85],
      [15, 85],
      [15, 38],
      [50, 10],
      [40, 85],
      [40, 60],
      [60, 60],
      [60, 85],
    ],
  },
];

const NOTES = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5"];

export class ConnectDotsGame extends BaseGame {
  constructor() {
    super("connect-dots");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private next = 1;
  private svg!: SVGSVGElement;
  private pathLine!: SVGPathElement;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.next = 1;
    const shape = SHAPES[this.roundsDone % SHAPES.length]!;
    const maxDots =
      this.difficulty === "easy" ? 6 : this.difficulty === "medium" ? 8 : 10;
    const pts = shape.pts.slice(0, Math.min(maxDots, shape.pts.length));

    const wrap = document.createElement("div");
    wrap.className = "cd-wrap";
    const task = document.createElement("div");
    task.className = "cd-task";
    task.textContent = `按 1、2、3… 的顺序连起来（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "cd-board";
    const size = 280;
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("viewBox", `0 0 100 100`);
    this.svg.setAttribute("width", String(size));
    this.svg.setAttribute("height", String(size));
    this.svg.classList.add("cd-svg");
    // 连线 path
    this.pathLine = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    this.pathLine.classList.add("cd-line");
    this.svg.appendChild(this.pathLine);
    // 隐藏的完整图案（连完后显示）
    const hidden = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    );
    hidden.classList.add("cd-hidden");
    hidden.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
    this.svg.appendChild(hidden);

    pts.forEach((p, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "cd-dot";
      dot.style.left = `${(p[0] / 100) * size - 16}px`;
      dot.style.top = `${(p[1] / 100) * size - 16}px`;
      dot.textContent = String(i + 1);
      dot.addEventListener("click", () =>
        this.onDot(i + 1, p, pts, shape, dot),
      );
      board.appendChild(dot);
    });
    board.appendChild(this.svg);
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private drawnPts: [number, number][] = [];
  private onDot(
    num: number,
    p: [number, number],
    pts: [number, number][],
    shape: (typeof SHAPES)[number],
    dot: HTMLButtonElement,
  ): void {
    if (num !== this.next) {
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    sfxPop();
    playNote(NOTES[(num - 1) % NOTES.length]!, 0.25);
    dot.classList.add("cd-dot--done");
    this.drawnPts.push(p);
    this.pathLine.setAttribute(
      "d",
      this.drawnPts
        .map((q, i) => `${i === 0 ? "M" : "L"} ${q[0]} ${q[1]}`)
        .join(" "),
    );
    this.resetWrongStreak();
    this.next += 1;
    if (this.next > pts.length) {
      // 连完：显示隐藏图案
      this.svg.classList.add("cd-svg--reveal");
      const r = dot.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.roundsDone += 1;
      void shape;
      this.trackTimeout(() => {
        this.drawnPts = [];
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1400);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "找最小的数字开始哦～",
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
    if (document.getElementById("cd-style")) return;
    const st = document.createElement("style");
    st.id = "cd-style";
    st.textContent = CD_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function CD_CSS(theme: string): string {
  return `
.cd-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(360px,100%);}
.cd-task{font-size:1.1rem;font-weight:800;text-align:center;}
.cd-board{position:relative;width:280px;height:280px;background:#fff;border-radius:20px;box-shadow:var(--shadow);}
.cd-svg{position:absolute;inset:0;}
.cd-line{fill:none;stroke:${theme};stroke-width:3;stroke-linecap:round;stroke-linejoin:round;}
.cd-hidden{fill:none;stroke:#eee;stroke-width:2;opacity:0;}
.cd-svg--reveal .cd-hidden{stroke:${theme};stroke-width:5;opacity:.4;animation:cd-flash .5s ease;}
.cd-dot{position:absolute;width:40px;height:40px;border-radius:50%;background:${theme};color:#fff;font-weight:800;border:none;box-shadow:var(--shadow);z-index:2;}
.cd-dot:active{transform:scale(.9);}
.cd-dot--done{background:#d4f4dd;color:var(--ink);}
@keyframes cd-flash{0%{opacity:0;stroke-width:8}100%{opacity:.4;stroke-width:5}}
`;
}

export function create(): ConnectDotsGame {
  return new ConnectDotsGame();
}
