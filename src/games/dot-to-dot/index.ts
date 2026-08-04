/* 连点成图 Dot to Dot —— 屏幕上是网格点阵，每个点带数字（1,2,3…）。
   按数字顺序点击，连线逐渐显现，连完看出画的是什么。
   与 connect-dots 不同：本游戏用更简单的"网格点阵 + 数字"，
   点固定排在网格上，按 1→N 顺序连，整条路径本身就是图案轮廓。
   视觉：圆形数字点 + SVG 连线 + 连完高亮。难度 = 点数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, playNote } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

/** 一张图案：名字 + 网格坐标序列（按连接顺序）。坐标用 0-6 的网格位。 */
interface Picture {
  name: string;
  emoji: string;
  cells: [number, number][]; // [col,row]，每个 0..6
}

// 所有图案都在 7x7 网格里画轮廓，按顺序连线即得图案
const PICTURES: Picture[] = [
  // 小房子：屋顶 → 右墙 → 地 → 左墙 → 门
  {
    name: "小房子",
    emoji: "🏠",
    cells: [
      [3, 0],
      [6, 3],
      [6, 6],
      [0, 6],
      [0, 3],
      [3, 0],
      [2, 6],
      [2, 4],
      [4, 4],
      [4, 6],
    ],
  },
  // 五角星
  {
    name: "五角星",
    emoji: "⭐",
    cells: [
      [3, 0],
      [4, 3],
      [6, 3],
      [4, 5],
      [5, 6],
      [3, 4],
      [1, 6],
      [2, 5],
      [0, 3],
      [2, 3],
    ],
  },
  // 小鱼
  {
    name: "小鱼",
    emoji: "🐟",
    cells: [
      [0, 3],
      [2, 1],
      [5, 1],
      [6, 3],
      [5, 5],
      [2, 5],
      [0, 3],
      [6, 1],
      [6, 0],
      [6, 5],
    ],
  },
  // 气球
  {
    name: "气球",
    emoji: "🎈",
    cells: [
      [3, 0],
      [5, 1],
      [5, 4],
      [3, 5],
      [1, 4],
      [1, 1],
      [3, 0],
      [3, 5],
      [3, 6],
    ],
  },
];

const NOTES = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5"];

export class DotToDotGame extends BaseGame {
  constructor() {
    super("dot-to-dot");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private next = 1;
  private svgLine!: SVGPathElement;
  private drawn: [number, number][] = [];
  private boardSize = 300;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 难度决定每张图保留多少个点（从图案 cells 里取前 N 个，保证有解）。 */
  private dotCount(): number {
    return this.difficulty === "easy"
      ? 6
      : this.difficulty === "medium"
        ? 8
        : 10;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.next = 1;
    this.drawn = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const pic = PICTURES[this.roundsDone % PICTURES.length]!;
    const want = Math.min(this.dotCount(), pic.cells.length);
    const cells = pic.cells.slice(0, want);
    const size = this.boardSize;
    const cell = size / 6; // 7x7 网格，步长 = size/6

    const wrap = document.createElement("div");
    wrap.className = "dtd-wrap";

    const task = document.createElement("div");
    task.className = "dtd-task";
    task.textContent = `按 1、2、3… 的顺序连起来（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "dtd-board";
    board.style.width = `${size}px`;
    board.style.height = `${size}px`;

    // SVG 连线层
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.classList.add("dtd-svg");
    this.svgLine = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    this.svgLine.classList.add("dtd-line");
    svg.appendChild(this.svgLine);
    // 连完之后的"提示轮廓"（淡色完整图案）
    const reveal = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    );
    reveal.classList.add("dtd-reveal");
    reveal.setAttribute(
      "points",
      cells.map((c) => `${c[0] * cell},${c[1] * cell}`).join(" "),
    );
    svg.appendChild(reveal);
    board.appendChild(svg);

    // 数字点
    cells.forEach((c, i) => {
      const num = i + 1;
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "dtd-dot";
      dot.textContent = String(num);
      dot.style.left = `${c[0] * cell}px`;
      dot.style.top = `${c[1] * cell}px`;
      dot.addEventListener("click", () =>
        this.onDot(num, c, cells, cell, pic, dot),
      );
      board.appendChild(dot);
    });

    wrap.appendChild(board);

    // 连完揭示的图案名
    const answer = document.createElement("div");
    answer.className = "dtd-answer";
    answer.id = "dtd-answer";
    answer.innerHTML = `<span class="dtd-answer__emoji">${pic.emoji}</span><span>是 ${pic.name} 呀！</span>`;
    wrap.appendChild(answer);

    this.root.appendChild(wrap);
  }

  private onDot(
    num: number,
    c: [number, number],
    cells: [number, number][],
    cell: number,
    pic: Picture,
    dot: HTMLButtonElement,
  ): void {
    if (num !== this.next) {
      // 点错顺序：温柔提示，不前进
      dot.classList.add("dtd-dot--shake");
      this.trackTimeout(() => dot.classList.remove("dtd-dot--shake"), 400);
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    sfxPop();
    playNote(NOTES[(num - 1) % NOTES.length]!, 0.22);
    dot.classList.add("dtd-dot--done");
    dot.disabled = true;
    this.drawn.push([c[0] * cell, c[1] * cell]);
    this.svgLine.setAttribute(
      "d",
      this.drawn
        .map((q, i) => `${i === 0 ? "M" : "L"} ${q[0]} ${q[1]}`)
        .join(" "),
    );
    this.resetWrongStreak();
    this.next += 1;

    if (this.next > cells.length) {
      // 连完：高亮 + 揭示图案名
      const r = dot.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      const ans = this.root.querySelector("#dd-answer");
      ans?.classList.add("dtd-answer--show");
      this.roundsDone += 1;
      void pic;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "找最小的数字开始，一个一个连哦～",
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
    if (document.getElementById("dtd-style")) return;
    const st = document.createElement("style");
    st.id = "dtd-style";
    st.textContent = DD_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function DD_CSS(theme: string): string {
  return `
.dtd-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(360px,100%);}
.dtd-task{font-size:1.1rem;font-weight:800;text-align:center;}
.dtd-board{position:relative;background:#fff;border-radius:22px;box-shadow:var(--shadow);}
.dtd-svg{position:absolute;inset:0;}
.dtd-line{fill:none;stroke:${theme};stroke-width:4;stroke-linecap:round;stroke-linejoin:round;transition:d .15s ease;}
.dtd-reveal{fill:none;stroke:${theme};stroke-width:2;opacity:0;}
.dtd-dot{position:absolute;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;background:linear-gradient(180deg,#fff,#eef4ff);color:${theme};font-weight:900;font-size:1rem;border:3px solid ${theme};box-shadow:0 3px 6px rgba(0,0,0,.18);z-index:2;cursor:pointer;transition:transform .12s ease,background .2s;}
.dtd-dot:active{transform:scale(.88);}
.dtd-dot--done{background:${theme};color:#fff;border-color:${theme};}
.dtd-dot--shake{animation:dd-shake .4s ease;}
@keyframes dd-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.dtd-answer{display:flex;align-items:center;gap:8px;font-size:1.25rem;font-weight:800;color:var(--ink);opacity:0;transform:scale(.6);transition:opacity .4s ease,transform .4s ease;}
.dtd-answer--show{opacity:1;transform:scale(1);}
.dtd-answer__emoji{font-size:2.4rem;animation:dd-bounce .6s ease;}
@keyframes dd-bounce{0%{transform:scale(.4) rotate(-20deg)}60%{transform:scale(1.3) rotate(10deg)}100%{transform:scale(1) rotate(0)}}
@media (max-width:360px){.dtd-task{font-size:1rem;}}
`;
}

export function create(): DotToDotGame {
  return new DotToDotGame();
}
