/* 星图连线 Star Map —— 夜空里有一组编号星点，按 1、2、3… 顺序点击，
   连成一个简单图案（如北斗七星 / 鱼 / 房子）。独特点：深色星空 + 发光星点 +
   SVG 渐变连线，连完整图闪烁命名。
   视觉：深色背景 + 发光星点 + SVG 连线。难度=星点数。通关=连完目标轮数。
   注：CSS 前缀用 smg-（规范建议的 sm- 与 shape-match 冲突，故改名）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, playNote } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface StarShape {
  name: string;
  emoji: string;
  /** 0-100 归一化坐标，按连接顺序排列 */
  pts: [number, number][];
}

const SHAPES: StarShape[] = [
  {
    name: "北斗七星",
    emoji: "🌟",
    pts: [
      [14, 72],
      [30, 60],
      [46, 52],
      [55, 38],
      [70, 32],
      [78, 18],
      [90, 26],
    ],
  },
  {
    name: "小房子",
    emoji: "🏠",
    pts: [
      [50, 12],
      [78, 36],
      [78, 78],
      [22, 78],
      [22, 36],
      [50, 12],
    ],
  },
  {
    name: "小鱼",
    emoji: "🐟",
    pts: [
      [16, 30],
      [40, 20],
      [66, 24],
      [82, 50],
      [66, 76],
      [40, 80],
      [16, 70],
      [16, 30],
    ],
  },
  {
    name: "小船",
    emoji: "⛵",
    pts: [
      [50, 12],
      [50, 60],
      [18, 60],
      [30, 82],
      [70, 82],
      [82, 60],
      [50, 60],
    ],
  },
];

const NOTES = ["C5", "D5", "E5", "G5", "A5", "B5", "C6", "D6"];

const ENCOURAGE = ["连得真准！", "按数字顺序点哦～", "真漂亮！", "快连完了！"];

export class StarMapGame extends BaseGame {
  constructor() {
    super("star-map");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private next = 1;
  private shape: StarShape | null = null;
  /** 当前轮的星点数（按难度从形状里取前 N 个） */
  private starCount = 5;
  /** SVG 折线 path，连接所有已点星点 */
  private pathLine!: SVGPathElement;

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
    this.next = 1;
    this.starCount = this.count();

    /* 选一个形状（其点数 >= 本轮所需） */
    const usable = SHAPES.filter((s) => s.pts.length >= this.starCount);
    const shape = sample(usable);
    this.shape = shape;
    const pts = shape.pts.slice(0, this.starCount);

    const wrap = document.createElement("div");
    wrap.className = "smg-wrap";

    const task = document.createElement("div");
    task.className = "smg-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 按 <b>1、2、3…</b> 的顺序点亮星星！下一个：<span id="smg-next">1</span>`;
    wrap.appendChild(task);

    /* SVG 星空（viewBox 0 0 100 100，preserveAspectRatio 让星点位置稳定） */
    const sky = document.createElement("div");
    sky.className = "smg-sky";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.classList.add("smg-svg");

    /* 连线层（一条折线 path） */
    const path = document.createElementNS(svgNS, "path");
    path.classList.add("smg-line");
    path.setAttribute("d", `M ${pts[0]![0]} ${pts[0]![1]}`);
    svg.appendChild(path);
    this.pathLine = path;

    /* 背景小星星装饰 */
    for (let i = 0; i < 14; i++) {
      const d = document.createElementNS(svgNS, "circle");
      const x = (Math.random() * 100).toFixed(1);
      const y = (Math.random() * 100).toFixed(1);
      d.setAttribute("cx", x);
      d.setAttribute("cy", y);
      d.setAttribute("r", String((Math.random() * 0.4 + 0.2).toFixed(2)));
      d.classList.add("smg-deco");
      svg.appendChild(d);
    }

    /* 星点：用外层 <g> 定位，里面放圆 + 数字 */
    pts.forEach((p, idx) => {
      const num = idx + 1;
      const g = document.createElementNS(svgNS, "g");
      g.classList.add("smg-star");
      g.setAttribute("transform", `translate(${p[0]} ${p[1]})`);
      g.dataset.num = String(num);

      const glow = document.createElementNS(svgNS, "circle");
      glow.setAttribute("r", "4.2");
      glow.classList.add("smg-star-glow");
      g.appendChild(glow);

      const core = document.createElementNS(svgNS, "circle");
      core.setAttribute("r", "2.4");
      core.classList.add("smg-star-core");
      g.appendChild(core);

      const txt = document.createElementNS(svgNS, "text");
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("y", "0.9");
      txt.classList.add("smg-star-num");
      txt.textContent = String(num);
      g.appendChild(txt);

      g.addEventListener("click", () => this.tap(g, num));
      svg.appendChild(g);
    });

    sky.appendChild(svg);
    wrap.appendChild(sky);
    this.root.appendChild(wrap);
  }

  private tap(g: SVGGElement, num: number): void {
    if (g.classList.contains("smg-star--on")) return;
    if (num === this.next) {
      g.classList.add("smg-star--on");
      sfxPop();
      playNote(NOTES[(num - 1) % NOTES.length] ?? "C5", 0.25);
      const r = (g as unknown as HTMLElement).getBoundingClientRect
        ? (g as unknown as HTMLElement).getBoundingClientRect()
        : null;
      if (r) this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      else this.onCorrect();
      this.resetWrongStreak();

      /* 把该星点追加到折线 path */
      const tr = g.getAttribute("transform") ?? "";
      const m = tr.match(/translate\(([\d.]+)\s+([\d.]+)\)/);
      if (m) {
        const x = m[1]!;
        const y = m[2]!;
        const prev = this.pathLine.getAttribute("d") ?? "";
        if (this.next === 1) {
          this.pathLine.setAttribute("d", `M ${x} ${y}`);
        } else {
          this.pathLine.setAttribute("d", `${prev} L ${x} ${y}`);
        }
      }

      this.next += 1;
      const nx = this.root.querySelector("#smg-next");
      if (nx)
        nx.textContent =
          this.next <= this.starCount ? String(this.next) : "完成!";

      if (this.next > this.starCount) {
        /* 整图点亮完毕 */
        this.pathLine.classList.add("smg-line--done");
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1100);
      }
    } else {
      g.classList.add("smg-star--shake");
      this.trackTimeout(() => g.classList.remove("smg-star--shake"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const name = this.shape ? this.shape.name : "";
    const ov = new Overlay({
      title: "休息一下～",
      emoji: this.shape ? this.shape.emoji : "✨",
      variant: "rest",
      body: `要按数字 1、2、3 的顺序点亮星星哦，连出来是「${name}」。${sample(ENCOURAGE)}`,
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
    if (document.getElementById("smg-style")) return;
    const st = document.createElement("style");
    st.id = "smg-style";
    st.textContent = SMG_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function SMG_CSS(theme: string): string {
  return `
.smg-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.smg-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.smg-task #smg-next{display:inline-block;min-width:1.4em;color:${theme};font-weight:900;}
.smg-sky{position:relative;width:min(440px,92vw);aspect-ratio:1/1;background:radial-gradient(120% 120% at 50% 30%,#1b2a55 0%,#0d1530 60%,#070b1c 100%);border-radius:24px;box-shadow:var(--shadow),inset 0 0 40px rgba(120,160,255,.25);overflow:hidden;}
.smg-svg{position:absolute;inset:0;width:100%;height:100%;}
.smg-deco{fill:#fff;opacity:.5;}
.smg-line{fill:none;stroke:url(#none);stroke:${theme};stroke-width:.9;stroke-linecap:round;stroke-linejoin:round;opacity:.35;transition:opacity .4s;}
.smg-line--done{opacity:1;stroke-width:1.4;filter:drop-shadow(0 0 3px #fff);}
.smg-star{cursor:pointer;}
.smg-star-glow{fill:#fff;opacity:.18;transition:opacity .3s;}
.smg-star-core{fill:#fffbe6;transition:all .3s;}
.smg-star-num{font-size:3.2px;font-weight:900;fill:#3a3a6a;font-family:system-ui,sans-serif;pointer-events:none;dominant-baseline:central;text-anchor:middle;}
.smg-star--on .smg-star-glow{opacity:1;}
.smg-star--on .smg-star-core{fill:${theme};}
.smg-star--on .smg-star-num{fill:#fff;}
.smg-star--on{animation:smg-blink 1.6s ease-in-out infinite;}
@keyframes smg-blink{0%,100%{opacity:1;}50%{opacity:.7;}}
.smg-star--shake{animation:smg-shake .45s ease;}
@keyframes smg-shake{0%,100%{transform:translate(0,0)}25%{transform:translate(-.6px,0)}75%{transform:translate(.6px,0)}}
@media (max-width:380px){.smg-task{font-size:1rem;}}
`;
}

export function create(): StarMapGame {
  return new StarMapGame();
}
