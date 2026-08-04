/* 认颜色名 Color Name —— 显示一个颜色块，从选项选出颜色名（红/黄/蓝/绿…）。
   独特点：纯色彩识别 + 中文颜色名对应，最基础的色彩认知。
   巧思：颜色块带高光更生动；难度=选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Color {
  name: string;
  hex: string;
}

const COLORS: Color[] = [
  { name: "红", hex: "#ff6348" },
  { name: "黄", hex: "#ffd93d" },
  { name: "蓝", hex: "#4d96ff" },
  { name: "绿", hex: "#6bcf7f" },
  { name: "紫", hex: "#a55eea" },
  { name: "橙", hex: "#ff9f43" },
  { name: "粉", hex: "#ff6b9d" },
  { name: "黑", hex: "#3a3a3a" },
];

export class ColorNameGame extends BaseGame {
  constructor() {
    super("color-name");
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
    /* DOM 清空 */
  }

  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const target = sample(COLORS);
    const distractors = shuffle(
      COLORS.filter((c) => c.name !== target.name),
    ).slice(0, this.optCount() - 1);
    const options = shuffle([target, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "cln-wrap";

    const task = document.createElement("div");
    task.className = "cln-task";
    task.textContent = "这是什么颜色？";
    wrap.appendChild(task);

    const block = document.createElement("div");
    block.className = "cln-block";
    block.style.setProperty("--cln-c", target.hex);
    wrap.appendChild(block);

    const grid = document.createElement("div");
    grid.className = "cln-grid";
    for (const opt of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cln-opt";
      b.textContent = opt.name;
      b.addEventListener("click", () => this.choose(opt, target, b, grid));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private choose(
    opt: Color,
    target: Color,
    btn: HTMLButtonElement,
    grid: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (opt.name === target.name) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".cln-opt").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      btn.classList.add("cln-opt--right");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 700);
    } else {
      btn.classList.add("cln-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("cln-opt--wrong"), 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "仔细看看这是什么颜色～",
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
    if (document.getElementById("cln-style")) return;
    const st = document.createElement("style");
    st.id = "cln-style";
    st.textContent = CLN_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function CLN_CSS(theme: string): string {
  return `
.cln-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(440px,100%);}
.cln-task{font-size:1.2rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.cln-block{width:160px;height:160px;border-radius:36px;background:radial-gradient(circle at 35% 30%,#fff6,var(--cln-c,${theme}));box-shadow:var(--shadow);animation:cln-pulse 2s ease-in-out infinite;}
@keyframes cln-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
.cln-grid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
.cln-opt{min-width:88px;min-height:64px;padding:0 22px;border-radius:18px;background:#fff;font-weight:900;font-size:1.5rem;color:${theme};box-shadow:var(--shadow);}
.cln-opt:active{transform:scale(.93);}
.cln-opt--right{background:#d4f4dd;outline:4px solid #34c759;color:#2e8b57;}
.cln-opt--wrong{background:#ffe0e0;outline:4px solid #ff3b30;}
`;
}

export function create(): ColorNameGame {
  return new ColorNameGame();
}
