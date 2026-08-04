/* 舒尔特方格 Schulte Grid —— 经典注意力训练：按 1,2,3…顺序点击数字方格。
   独特点：3x3/4x4/5x5 网格，训练视觉搜索 + 注意力集中。计时但不限时间，
   按完成速度 + 错误次数算星。难度=网格大小（easy 3x3，medium 4x4，hard 5x5）。
   巧思：每个格子是一次性点击，点对高亮、点错轻抖，全部按序点完通关。
   注意：CSS 前缀用 slg-（与已有 sliding-puzzle 的 sp- / seek-find 的 sf- 等均不冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { minStars, starsByAccuracy, starsByTime } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 各难度的网格边长：easy 3x3、medium 4x4、hard 5x5。 */
function gridSize(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 3 : diff === "medium" ? 4 : 5;
}

/** 单关用时上限（毫秒），超此降星。按格子数粗估：每格约 1.6~2s 为三星线。 */
function timeLimit(n: number, diff: "easy" | "medium" | "hard"): [number, number] {
  // [3★上限, 2★上限]
  const per = diff === "easy" ? 2000 : diff === "medium" ? 1700 : 1500;
  const total = n * per;
  return [total, total + n * 1500];
}

export class SchulteGridGame extends BaseGame {
  constructor() {
    super("schulte-grid");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private expected = 1; // 下一个该点的数字
  private totalN = 0; // 当前关数字总数
  private cells: HTMLButtonElement[] = [];
  private roundStartedAt = 0;

  protected mount(): void {
    this.roundTotal = this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空，定时器由基类清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const size = gridSize(this.difficulty);
    this.totalN = size * size;
    this.expected = 1;
    this.roundStartedAt = Date.now();

    const wrap = document.createElement("div");
    wrap.className = "slg-wrap";

    const task = document.createElement("div");
    task.className = "slg-task";
    task.innerHTML = `按 <b>1, 2, 3…</b> 的顺序点数字（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const status = document.createElement("div");
    status.className = "slg-status";
    status.id = "slg-status";
    status.textContent = `下一个：${this.expected}`;
    wrap.appendChild(status);

    const grid = document.createElement("div");
    grid.className = "slg-grid";
    grid.style.setProperty("--size", String(size));
    const nums = shuffle(Array.from({ length: this.totalN }, (_, i) => i + 1));
    this.cells = [];
    for (const n of nums) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "slg-cell";
      b.textContent = String(n);
      b.dataset.n = String(n);
      b.addEventListener("click", () => this.tap(n, b));
      grid.appendChild(b);
      this.cells.push(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private tap(n: number, btn: HTMLButtonElement): void {
    if (n === this.expected) {
      btn.classList.add("slg-cell--done");
      btn.disabled = true;
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.expected += 1;
      const status = this.root.querySelector<HTMLElement>("#slg-status");
      if (status) status.textContent = `下一个：${this.expected}`;
      if (this.expected > this.totalN) {
        // 本关完成
        const elapsed = Date.now() - this.roundStartedAt;
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        const [t3, t2] = timeLimit(this.totalN, this.difficulty);
        const stars = minStars(
          starsByAccuracy(this.wrongCount),
          starsByTime(elapsed, [t3, t2]),
        );
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(stars);
          } else {
            this.startRound();
          }
        }, 700);
      }
    } else {
      // 点错（顺序不对）
      btn.classList.add("slg-cell--shake");
      this.trackTimeout(() => btn.classList.remove("slg-cell--shake"), 400);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "慢慢来，先找到数字 1，再找 2、3……不急哦～",
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
    if (document.getElementById("slg-style")) return;
    const st = document.createElement("style");
    st.id = "slg-style";
    st.textContent = SLG_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function SLG_CSS(theme: string): string {
  return `
.slg-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.slg-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.slg-status{font-size:1.25rem;font-weight:900;color:${theme};min-height:1.6rem;text-align:center;}
.slg-grid{display:grid;grid-template-columns:repeat(var(--size,3),1fr);gap:10px;padding:18px;background:linear-gradient(#eef3ff,#fff);border-radius:22px;box-shadow:var(--shadow);border:3px solid ${theme}44;width:min(440px,94%);}
.slg-cell{font-family:inherit;font-size:clamp(1.4rem,6vw,2.2rem);font-weight:900;color:var(--ink);background:#fff;border:none;aspect-ratio:1;min-width:48px;min-height:48px;border-radius:14px;box-shadow:0 3px 0 rgba(0,0,0,.08);cursor:pointer;transition:transform .1s,background .15s;display:flex;align-items:center;justify-content:center;touch-action:manipulation;}
.slg-cell:hover{transform:translateY(-2px);}
.slg-cell:active{transform:scale(.94);}
.slg-cell--done{background:linear-gradient(160deg,#bfe3c1,#6bcf7f);color:#fff;animation:slg-pop .3s ease;}
.slg-cell--shake{animation:slg-shake .4s ease;}
@keyframes slg-pop{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes slg-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.slg-grid{gap:7px;padding:12px;}}
`;
}

export function create(): SchulteGridGame {
  return new SchulteGridGame();
}
