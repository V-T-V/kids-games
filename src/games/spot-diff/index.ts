/* 找不同 Spot Diff —— 两幅相似的图，找出不同的地方。
   独特点：双图对比找差异（区别于 seek-find 的单图找物）。
   巧思：左右两图相同布局，右图几处不同；点对差异处圆圈标记。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

// 用网格摆放 emoji，右图替换其中几处为不同物品
const POOL = ["🌸", "🌳", "🦋", "🐝", "🍄", "🍎", "⭐", "🌈", "🐰", "🐦"];
const ALT: Record<string, string> = {
  "🌸": "🌺",
  "🌳": "🌲",
  "🦋": "🐞",
  "🐝": "🐜",
  "🍄": "🌿",
  "🍎": "🍊",
  "⭐": "🌟",
  "🌈": "☁️",
  "🐰": "🐱",
  "🐦": "🦆",
};

export class SpotDiffGame extends BaseGame {
  constructor() {
    super("spot-diff");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private diffsLeft = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private diffCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const cells = 9;
    const base = shuffle(POOL).slice(0, cells);
    const diffCount = this.diffCount();
    const diffIdx = shuffle(base.map((_, i) => i)).slice(0, diffCount);
    const right = base.map((e, i) =>
      diffIdx.includes(i) ? (ALT[e] ?? "❓") : e,
    );
    this.diffsLeft = diffCount;

    const wrap = document.createElement("div");
    wrap.className = "sd-wrap";
    const task = document.createElement("div");
    task.className = "sd-task";
    task.innerHTML = `找出 <b>${diffCount}</b> 处不同～点左图或右图都可以（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "sd-board";
    // 两张图都可点击：孩子本能会点任一张，两张都接受点击
    board.appendChild(this.makeGrid(base, true, diffIdx, "L"));
    board.appendChild(this.makeGrid(right, true, diffIdx, "R"));
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private makeGrid(
    items: string[],
    interactive: boolean,
    diffIdx: number[] = [],
    _side: string = "",
  ): HTMLDivElement {
    void _side;
    const grid = document.createElement("div");
    grid.className = "sd-grid";
    items.forEach((e, i) => {
      const c = document.createElement(interactive ? "button" : "div");
      c.className = "sd-cell";
      c.textContent = e;
      if (interactive) {
        (c as HTMLButtonElement).type = "button";
        c.addEventListener("click", () => {
          if (c.classList.contains("sd-cell--found")) return;
          if (diffIdx.includes(i)) {
            c.classList.add("sd-cell--found");
            sfxPop();
            const r = c.getBoundingClientRect();
            this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
            this.resetWrongStreak();
            this.diffsLeft -= 1;
            if (this.diffsLeft <= 0) {
              this.roundsDone += 1;
              this.trackTimeout(() => {
                if (this.roundsDone >= this.roundTotal)
                  this.finishClear(starsByAccuracy(this.wrongCount));
                else this.startRound();
              }, 1000);
            }
          } else {
            c.classList.add("sd-cell--wrong");
            const paused = this.onWrong();
            this.trackTimeout(() => c.classList.remove("sd-cell--wrong"), 400);
            if (paused) this.showRest();
          }
        });
      }
      grid.appendChild(c);
    });
    return grid;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "左右比一比哪里不一样～",
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
    if (document.getElementById("sd-style")) return;
    const st = document.createElement("style");
    st.id = "sd-style";
    st.textContent = SD_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function SD_CSS(theme: string): string {
  return `
.sd-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.sd-task{font-size:1.1rem;font-weight:800;}
.sd-board{display:flex;gap:16px;justify-content:center;}
.sd-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:10px;background:rgba(255,255,255,.6);border-radius:14px;box-shadow:var(--shadow);}
.sd-cell{width:60px;height:60px;font-size:1.8rem;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;border:2px solid transparent;}
.sd-cell--found{outline:3px solid ${theme};outline-offset:1px;background:#d4f4dd;animation:sd-pop .4s ease;}
.sd-cell--wrong{animation:sd-shake .4s ease;}
@keyframes sd-pop{0%{transform:scale(.7)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes sd-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
`;
}

export function create(): SpotDiffGame {
  return new SpotDiffGame();
}
