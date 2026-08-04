/* 找相同与不同 Same Different —— 两行物品，一行有一个和另一行相同的，找出来。
   独特点：跨行视觉匹配，找到「两行里那个唯一相同」的物品。
   巧思：第一行有唯一一项也在第二行出现（其余都不重复），难度=物品数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const POOL = [
  "🍎",
  "🍌",
  "🍇",
  "🍓",
  "🍊",
  "🍐",
  "🥕",
  "🌽",
  "🥦",
  "🍅",
  "🐶",
  "🐱",
  "🐰",
  "🐻",
  "🐼",
  "🦊",
  "🐸",
  "🐵",
  "🦁",
  "🐯",
  "🚗",
  "🚕",
  "🚙",
  "🚌",
  "🚑",
  "🚒",
  "✈️",
  "🚲",
  "🚀",
  "⛵",
];

export class SameDifferentGame extends BaseGame {
  constructor() {
    super("same-different");
  }
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 每行物品数。 */
  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    // 保证有解：选一个公共物品，其余两行物品各自唯一且互不相同
    const p = shuffle(POOL);
    const shared = p[0]!;
    // 第一行剩余：n-1 个独立项
    const row1Rest = p.slice(1, n); // 1..n-1
    // 第二行剩余：n-1 个独立项，且和第一行其余不重合
    const row2Rest = p.slice(n, n + (n - 1));
    // 把 shared 随机塞进两行
    const row1 = shuffle([shared, ...row1Rest]);
    const row2 = shuffle([shared, ...row2Rest]);
    let done = false;

    const wrap = document.createElement("div");
    wrap.className = "sdm-wrap";

    const task = document.createElement("div");
    task.className = "sdm-task";
    task.textContent = "上下两行里，哪个物品是两行都有的？点出来～";
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "sdm-board";

    const renderRow = (items: string[]) => {
      const row = document.createElement("div");
      row.className = "sdm-row";
      for (const it of items) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sdm-item";
        b.textContent = it;
        b.addEventListener("click", () => {
          if (done) return;
          const r = b.getBoundingClientRect();
          if (it === shared) {
            done = true;
            this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
            this.resetWrongStreak();
            // 高亮两行所有 shared
            board.querySelectorAll(".sdm-item").forEach((el) => {
              if ((el as HTMLButtonElement).textContent === shared) {
                el.classList.add("sdm-item--right");
              }
              (el as HTMLButtonElement).disabled = true;
            });
            this.roundsDone += 1;
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal)
                this.finishClear(starsByAccuracy(this.wrongCount));
              else this.startRound();
            }, 900);
          } else {
            b.classList.add("sdm-item--wrong");
            const paused = this.onWrong();
            if (paused) this.showRest();
            this.trackTimeout(() => b.classList.remove("sdm-item--wrong"), 500);
          }
        });
        row.appendChild(b);
      }
      return row;
    };

    board.appendChild(renderRow(row1));
    board.appendChild(renderRow(row2));
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "从上到下挨个比一比，找找哪个上下都有～",
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
    if (document.getElementById("sdm-style")) return;
    const st = document.createElement("style");
    st.id = "sdm-style";
    st.textContent = SDM_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SDM_CSS(_theme: string): string {
  return `
.sdm-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.sdm-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.sdm-board{display:flex;flex-direction:column;gap:14px;}
.sdm-row{display:flex;gap:10px;justify-content:center;}
.sdm-item{width:72px;height:72px;border-radius:18px;background:#fff;font-size:2.2rem;box-shadow:var(--shadow);transition:transform .12s ease;}
.sdm-item:active{transform:scale(.9);}
.sdm-item--right{background:#d4f4dd;outline:4px solid #34c759;animation:sdm-pop .3s ease;}
.sdm-item--wrong{outline:4px solid #ff3b30;}
@keyframes sdm-pop{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
`;
}

export function create(): SameDifferentGame {
  return new SameDifferentGame();
}
