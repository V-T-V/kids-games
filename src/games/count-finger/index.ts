/* 手指数数 Count Finger —— 展示一只手伸出 N 根手指（N=1..5），
   问"伸了几根手指？"，从 3 个数字选项里选。
   数学启蒙：建立 1-5 的计数概念。
   独特点：用 SVG 手掌精确表达伸出手指数（emoji 手势在不同平台渲染不一致，
   计数必须无歧义），伸出的手指高亮、弯曲的淡化。前缀 cfi-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** 五根手指的几何参数（手掌朝向孩子，大拇指在最左）。
 *  x = 手指中心横坐标；width = 手指宽度。 */
interface FingerSpec {
  x: number;
  width: number;
  /** 是否大拇指（更短更偏）。 */
  thumb: boolean;
}

const FINGERS: FingerSpec[] = [
  { x: 30, width: 16, thumb: true }, // 大拇指
  { x: 50, width: 18, thumb: false }, // 食指
  { x: 70, width: 18, thumb: false }, // 中指
  { x: 90, width: 18, thumb: false }, // 无名指
  { x: 108, width: 16, thumb: false }, // 小指
];
/** 自然的 1..5 数数顺序对应的手指下标（0=大拇指…4=小指）。 */
const COUNT_ORDER: Record<number, number[]> = {
  1: [1], // 食指
  2: [1, 2], // 食指+中指
  3: [1, 2, 3], // +无名指
  4: [1, 2, 3, 4], // +小指
  5: [0, 1, 2, 3, 4], // 全部
};

/** 生成一只伸出 count 根手指的 SVG 手掌（viewBox 138x150）。 */
function handSvg(count: number, skin: string): string {
  const extended = new Set(COUNT_ORDER[count] ?? []);
  const palmY = 80;
  const palmH = 56;
  // 手指片段
  const parts: string[] = [];
  for (let i = 0; i < FINGERS.length; i++) {
    const f = FINGERS[i]!;
    const up = extended.has(i);
    if (up) {
      const topY = f.thumb ? 18 : 8;
      const h = palmY - topY + 6;
      parts.push(
        `<rect x="${f.x - f.width / 2}" y="${topY}" width="${f.width}" height="${h}" rx="${f.width / 2}" fill="${skin}" stroke="#c98a5a" stroke-width="2"/>`,
      );
      // 指甲高光
      parts.push(
        `<ellipse cx="${f.x}" cy="${topY + 7}" rx="${f.width / 2 - 3}" ry="3.5" fill="#fff" opacity=".55"/>`,
      );
    } else {
      // 弯曲：手背上一个小圆包，淡化
      parts.push(
        `<ellipse cx="${f.x}" cy="${palmY + 2}" rx="${f.width / 2}" ry="7" fill="${skin}" opacity=".5" stroke="#c98a5a" stroke-width="1.5" stroke-opacity=".4"/>`,
      );
    }
  }
  // 手掌
  const palm = `<rect x="22" y="${palmY}" width="94" height="${palmH}" rx="34" fill="${skin}" stroke="#c98a5a" stroke-width="2"/>`;
  // 手腕
  const wrist = `<rect x="50" y="${palmY + palmH - 6}" width="38" height="20" rx="14" fill="${skin}" stroke="#c98a5a" stroke-width="2"/>`;
  return `<svg viewBox="0 0 138 156" width="150" height="170" aria-hidden="true">${parts.join("")}${palm}${wrist}</svg>`;
}

export class CountFingerGame extends BaseGame {
  constructor() {
    super("count-finger");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private skin = "#ffd9b3";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.skin = getCssVar("--c-orange");
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

    const target = sample([1, 2, 3, 4, 5] as const);
    // 干扰项：1..5 中不等于 target 的 2 个
    const distractors = shuffle(
      [1, 2, 3, 4, 5].filter((n) => n !== target),
    ).slice(0, 2);
    const options = shuffle([target, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "cfi-wrap";

    const task = document.createElement("div");
    task.className = "cfi-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 这只手伸了几根？数一数～`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "cfi-stage";
    stage.innerHTML = handSvg(target, this.skin);
    wrap.appendChild(stage);

    const grid = document.createElement("div");
    grid.className = "cfi-grid";
    for (const n of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cfi-opt";
      b.textContent = String(n);
      b.addEventListener("click", () => this.choose(n, target, b, grid));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private choose(
    n: number,
    target: number,
    btn: HTMLButtonElement,
    grid: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (n === target) {
      this.locked = true;
      sfxPop();
      btn.classList.add("cfi-opt--right");
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".cfi-opt").forEach((el) => {
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
      btn.classList.add("cfi-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("cfi-opt--wrong"), 400);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "数一数～",
      emoji: "✋",
      variant: "rest",
      body: "伸出你自己的小手，跟着图比一比，数数竖起来的手指有几根，再点数字～",
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
    if (document.getElementById("cfi-style")) return;
    const st = document.createElement("style");
    st.id = "cfi-style";
    st.textContent = CFI_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function CFI_CSS(theme: string): string {
  return `
.cfi-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(420px,100%);}
.cfi-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);max-width:100%;}
.cfi-stage{display:flex;align-items:center;justify-content:center;width:100%;box-sizing:border-box;padding:18px;background:linear-gradient(180deg,#eef6ff,#dceaff);border-radius:24px;box-shadow:var(--shadow);min-height:190px;}
.cfi-stage svg{filter:drop-shadow(0 6px 8px rgba(0,0,0,.12));animation:cfi-wave 2.2s ease-in-out infinite;}
@keyframes cfi-wave{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(3deg)}}
.cfi-grid{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}
.cfi-opt{min-width:78px;min-height:78px;border-radius:22px;background:#fff;color:${theme};font-weight:900;font-size:2.2rem;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;border:none;}
.cfi-opt:active{transform:scale(.93);}
.cfi-opt--right{background:#d4f4dd;outline:5px solid #34c759;outline-offset:2px;color:#2e8b57;}
.cfi-opt--wrong{background:#ffe0e0;outline:5px solid #ff3b30;outline-offset:2px;animation:cfi-shake .4s ease;}
@keyframes cfi-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): CountFingerGame {
  return new CountFingerGame();
}
