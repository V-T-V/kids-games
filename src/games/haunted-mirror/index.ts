/* 鬼镜 Haunted Mirror —— 两面"镜子"照出同一个鬼屋场景，但右镜里有几处和左镜不一样
   （鬼的位置变了 / 物品换了）。孩子找出所有不同之处。
   独特点：双场景对比找差异。两个 3x3 网格摆 emoji，右网格替换其中几处为不同图案。
   视觉：两面椭圆镜框 + 镜中场景 + 鬼主题图案。难度=差异数。通关=找对目标轮数。
   解保证：差异位置随机生成且一定存在；点对差异处（左右任一网格都可点）即标记。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const POOL = [
  "👻",
  "🎃",
  "🦇",
  "🕸️",
  "🕷️",
  "💀",
  "🪦",
  "🕯️",
  "🌙",
  "🦉",
  "🧹",
  "🐀",
];
/** 每个图案的"变体"，用于在右网格制造差异。 */
const ALT: Record<string, string> = {
  "👻": "💀",
  "🎃": "🕯️",
  "🦇": "🕷️",
  "🕸️": "🐀",
  "🕷️": "🦉",
  "💀": "👻",
  "🪦": "🏰",
  "🕯️": "🔥",
  "🌙": "⭐",
  "🦉": "🦇",
  "🧹": "🕸️",
  "🐀": "🦴",
};

export class HauntedMirrorGame extends BaseGame {
  constructor() {
    super("haunted-mirror");
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
    const n = this.diffCount();
    const diffIdx = shuffle(base.map((_, i) => i)).slice(0, n);
    const right = base.map((e, i) =>
      diffIdx.includes(i) ? (ALT[e] ?? "❓") : e,
    );
    this.diffsLeft = n;

    const wrap = document.createElement("div");
    wrap.className = "hmt-wrap";
    const task = document.createElement("div");
    task.className = "hmt-task";
    task.innerHTML = `两面镜子照出来不一样，找出 <b>${n}</b> 处不同～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "hmt-board";
    board.appendChild(this.makeGrid(base, diffIdx));
    board.appendChild(this.makeGrid(right, diffIdx));
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private makeGrid(items: string[], diffIdx: number[]): HTMLDivElement {
    const grid = document.createElement("div");
    grid.className = "hmt-grid";
    items.forEach((e, i) => {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "hmt-cell";
      c.textContent = e;
      c.addEventListener("click", () => {
        if (c.classList.contains("hmt-cell--found")) return;
        if (diffIdx.includes(i)) {
          c.classList.add("hmt-cell--found");
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
            }, 900);
          }
        } else {
          c.classList.add("hmt-cell--wrong");
          const paused = this.onWrong();
          this.trackTimeout(() => c.classList.remove("hmt-cell--wrong"), 400);
          if (paused) this.showRest();
        }
      });
      grid.appendChild(c);
    });
    return grid;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "左镜和右镜里一格一格比一比，哪里不一样？",
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
    if (document.getElementById("hmt-style")) return;
    const st = document.createElement("style");
    st.id = "hmt-style";
    st.textContent = HMT_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function HMT_CSS(theme: string): string {
  return `
.hmt-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(540px,100%);}
.hmt-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;}
.hmt-board{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;}
.hmt-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:14px 14px 22px;background:linear-gradient(160deg,rgba(165,94,234,.18),rgba(99,102,241,.12));border:8px solid transparent;border-radius:50%/28%;background-clip:padding-box;box-shadow:0 0 0 3px rgba(255,255,255,.5),inset 0 0 24px rgba(99,102,241,.25),var(--shadow);position:relative;}
.hmt-grid::after{content:"🪞";position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);font-size:1.1rem;opacity:.7;}
.hmt-cell{width:58px;height:58px;font-size:1.8rem;border-radius:12px;background:rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center;border:2px solid transparent;cursor:pointer;transition:transform .12s;}
.hmt-cell:active{transform:scale(.92);}
.hmt-cell--found{outline:3px solid ${theme};outline-offset:1px;background:#e9dcff;animation:hmt-pop .4s ease;}
.hmt-cell--wrong{animation:hmt-shake .4s ease;}
@keyframes hmt-pop{0%{transform:scale(.7)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes hmt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (max-width:380px){.hmt-cell{width:48px;height:48px;font-size:1.5rem;}}
`;
}

export function create(): HauntedMirrorGame {
  return new HauntedMirrorGame();
}
