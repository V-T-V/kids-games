/* 对称补全 Symmetry —— 左边有图案，在右边镜像位置补上对称的另一半。
   独特点：镜像对称（区别于 jigsaw 还原图案、connect-dots 连点）。
   巧思：中线为镜面，点右边的镜像格子补全图案。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";
import { countFilled, genHalf, halfOf, isMirror } from "./engine.ts";

export class SymmetryGame extends BaseGame {
  constructor() {
    super("symmetry");
  }
  private n = 4;
  private roundsDone = 0;
  private roundTotal = 0;
  private left: boolean[][] = [];
  private right: boolean[][] = [];
  private need = 0;

  protected mount(): void {
    this.n =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const half = halfOf(this.n);
    // 左半随机填充
    this.left = genHalf(this.n);
    this.right = Array.from({ length: this.n }, () => Array(half).fill(false));
    this.need = countFilled(this.left);

    const wrap = document.createElement("div");
    wrap.className = "sy-wrap";
    const task = document.createElement("div");
    task.className = "sy-task";
    task.textContent = `在右边补上对称的图案～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "sy-board";
    board.style.setProperty("--n", String(this.n));
    // 左半（固定显示）
    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < half; x++) {
        const c = document.createElement("div");
        c.className = "sy-cell";
        if (this.left[y]![x]) c.classList.add("sy-cell--on");
        board.appendChild(c);
      }
      // 中线
      const mid = document.createElement("div");
      mid.className = "sy-mid";
      board.appendChild(mid);
      // 右半（可点击）
      for (let x = 0; x < half; x++) {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "sy-cell sy-cell--right";
        c.dataset.x = String(x);
        c.dataset.y = String(y);
        c.addEventListener("click", () => this.toggle(x, y, c));
        board.appendChild(c);
      }
    }
    wrap.appendChild(board);
    this.root.appendChild(wrap);
    void shuffle;
  }

  private toggle(x: number, y: number, c: HTMLButtonElement): void {
    const cur = this.right[y]![x]!;
    this.right[y]![x] = !cur;
    c.classList.toggle("sy-cell--on");
    sfxPop();
    // 检查是否与左半镜像一致（纯函数判定，已提取至 engine.isMirror）
    if (isMirror(this.left, this.right)) {
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) this.finishClear(3);
        else this.startRound();
      }, 1000);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("sy-style")) return;
    const st = document.createElement("style");
    st.id = "sy-style";
    st.textContent = SY_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function SY_CSS(theme: string): string {
  return `
.sy-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.sy-task{font-size:1.1rem;font-weight:800;text-align:center;}
.sy-board{display:grid;grid-template-columns:repeat(calc(var(--n) + 1),36px);gap:3px;padding:8px;background:rgba(255,255,255,.5);border-radius:14px;box-shadow:var(--shadow);}
.sy-cell{width:36px;height:36px;border-radius:6px;background:#fff;border:none;box-shadow:var(--shadow);}
.sy-cell--on{background:${theme};}
.sy-cell--right:active{transform:scale(.9);}
.sy-mid{width:2px;height:36px;background:var(--ink-soft);opacity:.4;}
`;
}

export function create(): SymmetryGame {
  return new SymmetryGame();
}
