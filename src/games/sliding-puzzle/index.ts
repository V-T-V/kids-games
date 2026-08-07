/* 数字华容道 Sliding Puzzle —— 滑动方块把数字排成顺序（经典 15-puzzle）。
   独特点：滑动机制——只有与空格相邻的块能移动（区别于拼图的"任意交换"）。
   巧思：移动块平滑滑入空位；难度=3x3/4x4。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar } from "../../lobby/util.ts";
import {
  isSolved as isSolvedGrid,
  moveTile,
  shuffleStep as shuffleStepGrid,
  solvedBoard,
} from "./engine.ts";

export class SlidingPuzzleGame extends BaseGame {
  constructor() {
    super("sliding-puzzle");
  }
  private roundTotal = 0;
  private roundsDone = 0;
  private n = 3;
  private tiles: number[] = []; // 0 表示空格
  private moves = 0;

  protected mount(): void {
    this.n =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 3 : 4;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root.innerHTML = "";
    // 初始为已排好，然后用合法移动打乱（保证可解）
    this.tiles = solvedBoard(this.n);
    // 打乱步数按难度分级：easy 少打乱（孩子能解），hard 充分打乱
    const shuffleSteps =
      this.difficulty === "easy" ? 12 : this.difficulty === "medium" ? 40 : 120;
    for (let i = 0; i < shuffleSteps; i++) this.shuffleStep();
    this.moves = 0;
    this.render();
  }

  private shuffleStep(): void {
    const blank = this.tiles.indexOf(0);
    const { tiles, blank: nb } = shuffleStepGrid(this.tiles, blank, this.n);
    this.tiles = tiles;
    void nb;
  }

  private render(): void {
    const wrap = document.createElement("div");
    wrap.className = "sp-wrap";
    const task = document.createElement("div");
    task.className = "sp-task";
    task.innerHTML = `把数字按 1-${this.n * this.n - 1} 排好～<br><span class="sp-hint">只能滑<b>空格旁边</b>的方块</span>`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "sp-board";
    board.style.setProperty("--n", String(this.n));
    const cell = 76;
    board.style.width = `${this.n * cell}px`;
    board.style.height = `${this.n * cell}px`;

    this.tiles.forEach((val, idx) => {
      if (val === 0) return;
      const x = idx % this.n,
        y = Math.floor(idx / this.n);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sp-tile";
      b.textContent = String(val);
      b.style.left = `${x * cell}px`;
      b.style.top = `${y * cell}px`;
      b.addEventListener("click", () => this.tryMove(idx));
      board.appendChild(b);
    });
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private tryMove(idx: number): void {
    const blank = this.tiles.indexOf(0);
    const ax = idx % this.n,
      ay = Math.floor(idx / this.n);
    const bx = blank % this.n,
      by = Math.floor(blank / this.n);
    // 必须相邻
    if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return;
    this.tiles = moveTile(this.tiles, idx, this.n);
    this.moves += 1;
    sfxPop();
    this.resetWrongStreak();
    this.render();
    // 检查完成
    const done = isSolvedGrid(this.tiles, this.n);
    if (done) {
      const stars =
        this.moves <= this.n * this.n * 6
          ? 3
          : this.moves <= this.n * this.n * 12
            ? 2
            : 1;
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) this.finishClear(stars);
        else this.startRound();
      }, 700);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("sp-style")) return;
    const st = document.createElement("style");
    st.id = "sp-style";
    st.textContent = SP_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function SP_CSS(theme: string): string {
  return `
.sp-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:100%;}
.sp-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.sp-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.sp-board{position:relative;background:${theme};border-radius:16px;padding:6px;box-shadow:var(--shadow);}
.sp-tile{position:absolute;width:70px;height:70px;margin:3px;font-size:1.8rem;font-weight:800;color:#fff;background:linear-gradient(160deg,#fff3,color-mix(in srgb,${theme} 80%,#000));border:none;border-radius:12px;box-shadow:var(--shadow);transition:left .12s ease,top .12s ease;}
.sp-tile:active{transform:scale(.95);}
`;
}

export function create(): SlidingPuzzleGame {
  return new SlidingPuzzleGame();
}
