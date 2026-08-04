/* 认形状名 Shape Name —— 显示一个形状（CSS 画的圆/方/三角），选出形状名。
   独特点：纯几何形状识别 + 中文名对应，最基础的图形认知。
   巧思：形状用纯 CSS 画（圆/方/三角/星），可旋转；难度=选项数。前缀 shn2-
   （shn2- 已被 shadow-puppet 占用，shn- 是 shape-hunt，故用 shn2- 避免冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

type Shape = "circle" | "square" | "triangle" | "star";

const NAMES: Record<Shape, string> = {
  circle: "圆形",
  square: "方形",
  triangle: "三角形",
  star: "星形",
};

const COLORS: Record<Shape, string> = {
  circle: "--c-blue",
  square: "--c-red",
  triangle: "--c-orange",
  star: "--c-yellow",
};

const ALL: Shape[] = ["circle", "square", "triangle", "star"];

export class ShapeNameGame extends BaseGame {
  constructor() {
    super("shape-name");
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

    const target = sample(ALL);
    const distractors = shuffle(ALL.filter((s) => s !== target)).slice(
      0,
      this.optCount() - 1,
    );
    const options = shuffle([target, ...distractors]);
    const color = getCssVar(COLORS[target]);

    const wrap = document.createElement("div");
    wrap.className = "shn2-wrap";

    const task = document.createElement("div");
    task.className = "shn2-task";
    task.textContent = "这是什么形状？";
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "shn2-stage";
    const shape = document.createElement("div");
    shape.className = `shn2-shape shn2-shape--${target}`;
    shape.style.setProperty("--shn2-c", color);
    shape.style.setProperty("--shn2-rot", `${randInt(-15, 15)}deg`);
    stage.appendChild(shape);
    wrap.appendChild(stage);

    const grid = document.createElement("div");
    grid.className = "shn2-grid";
    for (const opt of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "shn2-opt";
      b.textContent = NAMES[opt];
      b.addEventListener("click", () => this.choose(opt, target, b, grid));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private choose(
    opt: Shape,
    target: Shape,
    btn: HTMLButtonElement,
    grid: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (opt === target) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".shn2-opt").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      btn.classList.add("shn2-opt--right");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 700);
    } else {
      btn.classList.add("shn2-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("shn2-opt--wrong"), 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "数一数它有几条边、几个角～",
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
    if (document.getElementById("shn2-style")) return;
    const st = document.createElement("style");
    st.id = "shn2-style";
    st.textContent = SHN2_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function SHN2_CSS(theme: string): string {
  return `
.shn2-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(440px,100%);}
.shn2-task{font-size:1.2rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.shn2-stage{width:180px;height:180px;display:flex;align-items:center;justify-content:center;}
.shn2-shape{transform:rotate(var(--shn2-rot,0deg));animation:shn2-float 2.4s ease-in-out infinite;}
@keyframes shn2-float{0%,100%{transform:rotate(var(--shn2-rot,0deg)) translateY(0)}50%{transform:rotate(var(--shn2-rot,0deg)) translateY(-8px)}}
.shn2-shape--circle{width:130px;height:130px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff6,var(--shn2-c,${theme}));box-shadow:var(--shadow);}
.shn2-shape--square{width:120px;height:120px;border-radius:14px;background:var(--shn2-c,${theme});box-shadow:var(--shadow);}
.shn2-shape--triangle{width:0;height:0;border-left:72px solid transparent;border-right:72px solid transparent;border-bottom:124px solid var(--shn2-c,${theme});filter:drop-shadow(0 6px 10px rgba(0,0,0,.18));}
.shn2-shape--star{width:130px;height:130px;background:var(--shn2-c,${theme});clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);box-shadow:var(--shadow);}
.shn2-grid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
.shn2-opt{min-width:104px;min-height:62px;padding:0 22px;border-radius:18px;background:#fff;font-weight:800;font-size:1.2rem;color:${theme};box-shadow:var(--shadow);}
.shn2-opt:active{transform:scale(.94);}
.shn2-opt--right{background:#d4f4dd;outline:4px solid #34c759;color:#2e8b57;}
.shn2-opt--wrong{background:#ffe0e0;outline:4px solid #ff3b30;}
`;
}

export function create(): ShapeNameGame {
  return new ShapeNameGame();
}
