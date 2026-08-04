/* 进阶拼图 Puzzle Jigsaw 3 —— 在 jigsaw 基础上更复杂：3x3 emoji 图案，
   点击两个方块交换位置，还原图案。视觉：彩色方块 + emoji + 序号小角标。
   难度=网格大小（固定 3x3，但按难度给出更接近已解的初始态以调节难度）。
   通关=拼对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample } from "../../lobby/util.ts";
import { starsByMoves } from "../../core/scoring.ts";

// 一组 9 个一组的 emoji 主题（每个主题 9 个不重复 emoji）
const THEMES: string[][] = [
  ["🍎", "🍌", "🍇", "🍓", "🍒", "🍋", "🍑", "🍍", "🥝"],
  ["🐶", "🐱", "🐰", "🐻", "🐼", "🦁", "🐯", "🐨", "🐸"],
  ["🚗", "🚕", "🚙", "🚌", "🚎", "🚓", "🚑", "🚒", "🚚"],
  ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🥏", "🏓"],
];

export class PuzzleJigsaw3Game extends BaseGame {
  constructor() {
    super("puzzle-jigsaw-3");
  }

  private grid = 3;
  private tiles: number[] = []; // 每个位置当前的「正确下标」
  private moves = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private selected: number | null = null;
  private theme: string[] = [];

  protected mount(): void {
    this.grid = 3;
    this.roundTotal =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* 无定时器/动画需手动清理 */
  }

  /** 按难度生成「可解但需要交换」的初始态：
     easy: 做 2 次随机交换；medium: 4 次；hard: 8 次（仍可解，交换可逆）。 */
  private shuffled(): number[] {
    const n = this.grid * this.grid;
    const arr = Array.from({ length: n }, (_, i) => i);
    const swaps =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 4 : 8;
    for (let s = 0; s < swaps; s++) {
      const i = Math.floor(Math.random() * n);
      const j = Math.floor(Math.random() * n);
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    // 若运气不好正好排回原样，强制打乱一次
    if (arr.every((v, i) => v === i)) {
      [arr[0], arr[1]] = [arr[1]!, arr[0]!];
    }
    return arr;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.selected = null;
    this.moves = 0;
    this.tiles = this.shuffled();
    this.theme = sample(THEMES);
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "pj3-wrap";

    const task = document.createElement("div");
    task.className = "pj3-task";
    task.innerHTML = `点两个方块<b>交换</b>，把图案还原！<br><small>第 ${this.roundsDone + 1} / ${this.roundTotal} 关 · 步数 <b id="pj3-moves">0</b></small>`;
    wrap.appendChild(task);

    // 右上角的「目标图」预览（小图）
    const preview = document.createElement("div");
    preview.className = "pj3-preview";
    preview.id = "pj3-preview";
    const pvTitle = document.createElement("div");
    pvTitle.className = "pj3-preview__title";
    pvTitle.textContent = "目标";
    const pvGrid = document.createElement("div");
    pvGrid.className = "pj3-preview__grid";
    for (let i = 0; i < this.grid * this.grid; i++) {
      const c = document.createElement("span");
      c.className = "pj3-preview__cell";
      c.textContent = this.theme[i]!;
      pvGrid.appendChild(c);
    }
    preview.appendChild(pvTitle);
    preview.appendChild(pvGrid);
    wrap.appendChild(preview);

    const board = document.createElement("div");
    board.className = "pj3-board";
    board.style.setProperty("--n", String(this.grid));

    this.tiles.forEach((tileId, pos) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "pj3-cell";
      cell.dataset.pos = String(pos);
      this.styleTile(cell, tileId);
      cell.addEventListener("click", () => this.onCell(cell, pos));
      board.appendChild(cell);
    });
    wrap.appendChild(board);

    this.root.appendChild(wrap);
  }

  private onCell(cell: HTMLElement, pos: number): void {
    if (this.selected === null) {
      this.selected = pos;
      cell.classList.add("pj3-cell--sel");
      sfxPop();
      return;
    }
    if (this.selected === pos) {
      this.selected = null;
      cell.classList.remove("pj3-cell--sel");
      return;
    }
    const a = this.selected;
    const b = pos;
    [this.tiles[a], this.tiles[b]] = [this.tiles[b]!, this.tiles[a]!];
    this.selected = null;
    this.moves += 1;
    this.rerender();
    sfxPop();
    const movesEl = this.root.querySelector<HTMLElement>("#pj3-moves");
    if (movesEl) movesEl.textContent = String(this.moves);

    if (this.tiles.every((v, i) => v === i)) {
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(
            starsByMoves(this.moves, [this.grid * 4, this.grid * 8]),
          );
        } else {
          this.startRound();
        }
      }, 800);
    }
  }

  private rerender(): void {
    const cells = this.root.querySelectorAll<HTMLElement>(".pj3-cell");
    this.tiles.forEach((tileId, pos) => {
      const c = cells[pos]!;
      c.classList.remove("pj3-cell--sel");
      this.styleTile(c, tileId);
    });
  }

  private styleTile(cell: HTMLElement, tileId: number): void {
    // 拼对时整块成完整图：每个方块显示对应 emoji
    cell.innerHTML = `<span class="pj3-emoji">${this.theme[tileId]}</span>`;
    // 是否在正确位置 → 上角小勾
    const pos = Number(cell.dataset.pos);
    cell.classList.toggle("pj3-cell--ok", pos === tileId);
  }

  private injectStyle(): void {
    if (document.getElementById("pj3-style")) return;
    const st = document.createElement("style");
    st.id = "pj3-style";
    st.textContent = PJ3_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function PJ3_CSS(theme: string): string {
  return `
.pj3-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;position:relative;}
.pj3-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.pj3-task b{color:${theme};}
.pj3-task small{display:block;margin-top:3px;font-weight:700;color:#888;font-size:.82rem;}
.pj3-preview{display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(255,255,255,.7);padding:8px 10px;border-radius:14px;box-shadow:var(--shadow);}
.pj3-preview__title{font-size:.8rem;font-weight:800;color:#666;}
.pj3-preview__grid{display:grid;grid-template-columns:repeat(3,22px);grid-auto-rows:22px;gap:2px;}
.pj3-preview__cell{width:22px;height:22px;font-size:.8rem;line-height:22px;text-align:center;}
.pj3-board{display:grid;grid-template-columns:repeat(var(--n,3),1fr);gap:6px;padding:10px;background:${theme};border-radius:18px;box-shadow:var(--shadow-lg);}
.pj3-cell{position:relative;width:84px;height:84px;border:none;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 -3px 0 rgba(0,0,0,.08),var(--shadow);transition:transform .14s,outline .1s;cursor:pointer;}
.pj3-cell:active{transform:scale(.94);}
.pj3-cell--sel{outline:4px solid #ffd93d;outline-offset:-4px;transform:scale(1.05);}
.pj3-cell--ok::after{content:"✓";position:absolute;top:3px;left:5px;font-size:.7rem;font-weight:900;color:#6bcf7f;background:#fff;border-radius:50%;width:14px;height:14px;line-height:14px;text-align:center;}
.pj3-emoji{font-size:2.4rem;line-height:1;}
@media (max-width:380px){.pj3-cell{width:70px;height:70px;}.pj3-emoji{font-size:1.9rem;}}
`;
}

export function create(): PuzzleJigsaw3Game {
  return new PuzzleJigsaw3Game();
}
