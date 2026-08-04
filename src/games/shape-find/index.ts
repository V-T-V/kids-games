/* 找形状 Shape Find —— 上方说"找圆形"，
   下方 3 个 SVG 形状（圆/方/三角/星形），孩子点对应的。
   认知启蒙：识别基本平面图形，建立几何直觉。
   独特点：用 inline SVG 画形状，彩色填充更生动。前缀 shfd-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

type ShapeId = "circle" | "square" | "triangle" | "star";

interface Shape {
  id: ShapeId;
  name: string;
  emoji: string;
  color: string;
  /** 100x100 viewBox 内的 SVG 内容 */
  svg: string;
}

const SHAPES: Shape[] = [
  {
    id: "circle",
    name: "圆形",
    emoji: "⭕",
    color: "#4d96ff",
    svg: `<circle cx="50" cy="50" r="38" />`,
  },
  {
    id: "square",
    name: "方形",
    emoji: "⬛",
    color: "#ff9f43",
    svg: `<rect x="14" y="14" width="72" height="72" rx="8" />`,
  },
  {
    id: "triangle",
    name: "三角形",
    emoji: "🔺",
    color: "#6bcf7f",
    svg: `<path d="M50 12 L88 84 L12 84 Z" />`,
  },
  {
    id: "star",
    name: "星形",
    emoji: "⭐",
    color: "#ffd93d",
    svg: `<path d="M50 8 L61 38 L93 38 L67 58 L77 90 L50 70 L23 90 L33 58 L7 38 L39 38 Z" />`,
  },
];

function shapeSvg(s: Shape): string {
  return `<svg viewBox="0 0 100 100" width="84" height="84" aria-hidden="true"><g fill="${s.color}" stroke="#fff" stroke-width="3" stroke-linejoin="round">${s.svg}</g></svg>`;
}

export class ShapeFindGame extends BaseGame {
  constructor() {
    super("shape-find");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const target = sample(SHAPES);
    const distractors = shuffle(SHAPES.filter((s) => s.id !== target.id)).slice(
      0,
      2,
    );
    const options = shuffle([target, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "shfd-wrap";

    const task = document.createElement("div");
    task.className = "shfd-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 找出 <b>${target.emoji} ${target.name}</b>～`;
    wrap.appendChild(task);

    // 目标形状示例（小型展示，提示颜色与外形）
    const hint = document.createElement("div");
    hint.className = "shfd-hint";
    hint.innerHTML = shapeSvg({ ...target });
    hint.setAttribute("aria-label", `${target.emoji} ${target.name}`);
    wrap.appendChild(hint);

    const stage = document.createElement("div");
    stage.className = "shfd-stage";
    options.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "shfd-shape";
      b.innerHTML = shapeSvg(s);
      b.setAttribute("aria-label", s.name);
      b.addEventListener("click", () => this.choose(s, target, b, stage));
      stage.appendChild(b);
    });
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
  }

  private choose(
    s: Shape,
    target: Shape,
    btn: HTMLButtonElement,
    stage: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (s.id === target.id) {
      this.locked = true;
      sfxPop();
      btn.classList.add("shfd-shape--done");
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      stage.querySelectorAll(".shfd-shape").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 900);
    } else {
      btn.classList.add("shfd-shape--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("shfd-shape--wrong"), 400);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "看一看～",
      emoji: "⭐",
      variant: "rest",
      body: "上面画的形状就是要找的目标。比一比下面三个图形的样子，点出长得一样的那个～",
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
    if (document.getElementById("shfd-style")) return;
    const st = document.createElement("style");
    st.id = "shfd-style";
    st.textContent = SF_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function SF_CSS(theme: string): string {
  return `
.shfd-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.shfd-task{font-size:1.12rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);max-width:100%;}
.shfd-task b{color:${theme};}
.shfd-hint{display:flex;align-items:center;justify-content:center;width:84px;height:84px;background:#fff;border-radius:20px;box-shadow:var(--shadow);animation:shfd-spin 4s ease-in-out infinite;}
@keyframes shfd-spin{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
.shfd-stage{display:flex;gap:20px;justify-content:center;align-items:center;padding:24px 20px;background:linear-gradient(180deg,#fff,#f3f0ff);border-radius:24px;box-shadow:var(--shadow);width:100%;box-sizing:border-box;min-height:160px;}
.shfd-shape{width:108px;height:108px;display:flex;align-items:center;justify-content:center;background:#fff;border:none;border-radius:24px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;padding:0;}
.shfd-shape:active{transform:scale(.93);}
.shfd-shape--done{background:#d4f4dd;outline:5px solid #34c759;outline-offset:3px;animation:shfd-pop .4s ease;}
.shfd-shape--wrong{background:#ffe0e0;outline:5px solid #ff3b30;outline-offset:3px;animation:shfd-shake .4s ease;}
@keyframes shfd-pop{0%{transform:scale(.7)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes shfd-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ShapeFindGame {
  return new ShapeFindGame();
}
