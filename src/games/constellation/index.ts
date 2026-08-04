/* 星座连线 Constellation —— 夜空背景下，按编号顺序点击星点连成星座。
   独特点：深色星空 + 发光星点 + 渐变连线，连完后整组星点持续闪烁。
   巧思：用 SVG 画连线，每连对一颗播放上升音；难度=星点数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop, playNote } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

// 简化星座：点坐标（0-100 归一化）+ 名字 + emoji
const CONSTELLATIONS: {
  name: string;
  emoji: string;
  pts: [number, number][];
}[] = [
  {
    name: "大熊座（北斗七星）",
    emoji: "🐻",
    pts: [
      [12, 70],
      [28, 60],
      [44, 52],
      [56, 40],
      [70, 34],
      [78, 22],
      [90, 30],
    ],
  },
  {
    name: "猎户座",
    emoji: "🏹",
    pts: [
      [20, 18],
      [40, 28],
      [50, 48],
      [60, 48],
      [70, 48],
      [35, 70],
      [70, 78],
    ],
  },
  {
    name: "小熊座",
    emoji: "🐻‍❄️",
    pts: [
      [50, 12],
      [62, 28],
      [70, 46],
      [60, 62],
      [42, 64],
      [30, 50],
      [44, 38],
    ],
  },
  {
    name: "天鹅座",
    emoji: "🦢",
    pts: [
      [50, 10],
      [50, 30],
      [30, 42],
      [50, 50],
      [72, 44],
      [50, 70],
      [50, 88],
    ],
  },
];

const NOTES = ["C5", "D5", "E5", "G5", "A5", "B5", "C6"];

export class ConstellationGame extends BaseGame {
  constructor() {
    super("constellation");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private next = 1;
  private drawnPts: [number, number][] = [];
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

  /** 本轮参与连线的星点数（从星座点集中取前 N 个） */
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
    this.drawnPts = [];

    const con =
      CONSTELLATIONS[this.roundsDone % CONSTELLATIONS.length] ??
      CONSTELLATIONS[0]!;
    const maxPts = this.count();
    const pts = con.pts.slice(0, Math.min(maxPts, con.pts.length));

    const wrap = document.createElement("div");
    wrap.className = "cn-wrap";

    const task = document.createElement("div");
    task.className = "cn-task";
    task.innerHTML = `按 1、2、3… 顺序连星，画出<span class="cn-name">${con.emoji} ${con.name}</span><br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 关</small>`;
    wrap.appendChild(task);

    const sky = document.createElement("div");
    sky.className = "cn-sky";
    const size = 300;
    sky.style.width = `${size}px`;
    sky.style.height = `${size}px`;

    // 散落背景星（纯装饰）
    for (let i = 0; i < 26; i++) {
      const s = document.createElement("div");
      s.className = "cn-bgstar";
      s.style.left = `${Math.random() * 100}%`;
      s.style.top = `${Math.random() * 100}%`;
      s.style.animationDelay = `${Math.random() * 3}s`;
      s.style.fontSize = `${Math.random() * 0.6 + 0.5}rem`;
      sky.appendChild(s);
    }

    // SVG 连线层
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 100 100`);
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.classList.add("cn-svg");
    this.pathLine = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    this.pathLine.classList.add("cn-line");
    svg.appendChild(this.pathLine);
    sky.appendChild(svg);

    // 星点按钮
    pts.forEach((p, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "cn-star";
      dot.style.left = `${(p[0] / 100) * size - 18}px`;
      dot.style.top = `${(p[1] / 100) * size - 18}px`;
      const num = document.createElement("span");
      num.className = "cn-star__num";
      num.textContent = String(i + 1);
      dot.appendChild(num);
      dot.addEventListener("click", () => this.onStar(i + 1, p, pts, dot));
      sky.appendChild(dot);
    });

    wrap.appendChild(sky);
    this.root.appendChild(wrap);
  }

  private onStar(
    num: number,
    p: [number, number],
    pts: [number, number][],
    dot: HTMLButtonElement,
  ): void {
    if (dot.classList.contains("cn-star--done")) return;
    if (num !== this.next) {
      dot.classList.add("cn-star--shake");
      this.trackTimeout(() => dot.classList.remove("cn-star--shake"), 360);
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    sfxPop();
    playNote(NOTES[(num - 1) % NOTES.length] ?? "C5", 0.3);
    dot.classList.add("cn-star--done");
    this.drawnPts.push(p);
    this.pathLine.setAttribute(
      "d",
      this.drawnPts
        .map((q, i) => `${i === 0 ? "M" : "L"} ${q[0]} ${q[1]}`)
        .join(" "),
    );
    const r = dot.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.next += 1;

    if (this.next > pts.length) {
      // 全部连完：整组星点亮起闪耀
      const svg = this.pathLine.parentElement;
      svg?.classList.add("cn-svg--reveal");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1400);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "从数字最小的星星开始连哦～",
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
    if (document.getElementById("cn-style")) return;
    const st = document.createElement("style");
    st.id = "cn-style";
    st.textContent = CN_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function CN_CSS(theme: string): string {
  return `
.cn-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(380px,100%);}
.cn-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.7;color:var(--ink);}
.cn-name{color:${theme};font-weight:900;}
.cn-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.cn-sky{position:relative;background:radial-gradient(ellipse at 50% 40%,#1c2350,#0a0e26 75%);border-radius:24px;box-shadow:var(--shadow-lg),inset 0 0 40px rgba(99,102,241,.25);overflow:hidden;}
.cn-svg{position:absolute;inset:0;}
.cn-line{fill:none;stroke:url(#none);stroke:#fff8c2;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 3px ${theme});opacity:.92;transition:stroke-width .25s ease;}
.cn-svg--reveal .cn-line{stroke:#ffe89a;stroke-width:2.2;animation:cn-flash 1s ease;}
@keyframes cn-flash{0%{stroke-width:4;opacity:.5}100%{stroke-width:2.2;opacity:1}}
.cn-star{position:absolute;width:36px;height:36px;border-radius:50%;border:none;background:radial-gradient(circle at 35% 30%,#fff,#ffe07a 60%,${theme});box-shadow:0 0 12px ${theme},0 0 24px ${theme}aa;z-index:3;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .18s ease;}
.cn-star:hover{transform:scale(1.18);}
.cn-star:active{transform:scale(.92);}
.cn-star__num{font-weight:900;font-size:.85rem;color:#5a3d00;}
.cn-star--done{background:radial-gradient(circle at 35% 30%,#fff,#b9f6ca 55%,#34d058);box-shadow:0 0 18px #6bff8d,0 0 36px #34d05788;animation:cn-twinkle 1.6s ease-in-out infinite;}
.cn-star--done .cn-star__num{color:#0a5c2a;}
.cn-star--shake{animation:cn-shake .36s ease;}
@keyframes cn-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-4px)}}
@keyframes cn-twinkle{0%,100%{filter:brightness(1)}50%{filter:brightness(1.5)}}
.cn-bgstar{position:absolute;color:#fff;opacity:.5;animation:cn-bgtw 3s ease-in-out infinite;pointer-events:none;}
@keyframes cn-bgtw{0%,100%{opacity:.2}50%{opacity:.8}}
`;
}

export function create(): ConstellationGame {
  return new ConstellationGame();
}
