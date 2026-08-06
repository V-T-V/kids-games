/* 2048 数字合并 —— 4x4 网格，滑动方向合并相同数字。
   独特点：每个数字独立配色（暖→冷渐变）+ 合并缩放弹出动画 + 滑动平滑过渡。
   视觉：圆角方块、柔和阴影、数字越大颜色越炫。
   难度=目标数字（easy 32 / medium 64 / hard 128）。通关=出现目标数字。
   支持键盘方向键 + 屏幕滑动 + 方向按钮。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar } from "../../lobby/util.ts";
import { starsByMoves } from "../../core/scoring.ts";
import {
  type Dir,
  collapse,
  extract,
  apply,
  hasMoves,
  maxValue,
} from "./engine.ts";

const COLORS: Record<number, string> = {
  2: "#eee4da",
  4: "#ede0c8",
  8: "#f2b179",
  16: "#f59563",
  32: "#f67c5f",
  64: "#f65e3b",
  128: "#edcf72",
  256: "#edcc61",
  512: "#edc850",
  1024: "#edc53f",
  2048: "#edc22e",
};

export class Game2048 extends BaseGame {
  constructor() {
    super("2048");
  }

  private board: number[][] = [];
  private target = 32;
  private moves = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private won = false;
  private gridEl!: HTMLDivElement;
  private onKey: ((e: KeyboardEvent) => void) | null = null;
  private touchStart: { x: number; y: number } | null = null;

  protected mount(): void {
    this.target =
      this.difficulty === "easy" ? 32 : this.difficulty === "medium" ? 64 : 128;
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.setup();
  }
  protected unmount(): void {
    this.over = true;
    if (this.onKey) {
      window.removeEventListener("keydown", this.onKey);
      this.onKey = null;
    }
  }

  private setup(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.over = false;
    this.won = false;
    this.moves = 0;
    this.board = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    this.addRandomTile();
    this.addRandomTile();

    const wrap = document.createElement("div");
    wrap.className = "g2-wrap";

    const task = document.createElement("div");
    task.className = "g2-task";
    task.innerHTML = `合并出 <b>${this.target}</b> 就通关！<br><small>方向键 / 滑动 / 按钮控制</small>`;
    wrap.appendChild(task);

    const grid = document.createElement("div");
    grid.className = "g2-grid";
    this.gridEl = grid;
    wrap.appendChild(grid);

    // 方向按钮（儿童友好的备选输入）
    const pad = document.createElement("div");
    pad.className = "g2-pad";
    const mk = (dir: Dir, icon: string, cls: string): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `g2-dir ${cls}`;
      b.textContent = icon;
      b.addEventListener("click", () => this.move(dir));
      return b;
    };
    pad.appendChild(mk("up", "⬆", "g2-dir--up"));
    pad.appendChild(mk("left", "⬅", "g2-dir--left"));
    pad.appendChild(mk("right", "➡", "g2-dir--right"));
    pad.appendChild(mk("down", "⬇", "g2-dir--down"));
    wrap.appendChild(pad);

    this.root.appendChild(wrap);
    this.render();

    // 键盘
    this.onKey = (e: KeyboardEvent): void => {
      const map: Record<string, Dir> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        this.move(d);
      }
    };
    window.addEventListener("keydown", this.onKey);

    // 触屏滑动
    const onStart = (e: TouchEvent): void => {
      const t = e.touches[0];
      if (t) this.touchStart = { x: t.clientX, y: t.clientY };
    };
    const onEnd = (e: TouchEvent): void => {
      if (!this.touchStart) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - this.touchStart.x;
      const dy = t.clientY - this.touchStart.y;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (Math.max(ax, ay) < 24) return;
      if (ax > ay) this.move(dx > 0 ? "right" : "left");
      else this.move(dy > 0 ? "down" : "up");
      this.touchStart = null;
    };
    grid.addEventListener("touchstart", onStart, { passive: true });
    grid.addEventListener("touchend", onEnd, { passive: true });
  }

  private addRandomTile(): void {
    const empty: [number, number][] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (this.board[r]![c] === 0) empty.push([r, c]);
      }
    }
    if (empty.length === 0) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)]!;
    this.board[r]![c] = Math.random() < 0.9 ? 2 : 4;
  }

  private move(dir: Dir): void {
    if (this.over || this.won) return;
    const before = JSON.stringify(this.board);
    let mergedAny = false;
    const lines = this.extract(dir);
    const newLines: number[][] = [];
    for (const line of lines) {
      const res = this.collapse(line);
      if (res.merged) mergedAny = true;
      newLines.push(res.line);
    }
    this.apply(dir, newLines);
    const after = JSON.stringify(this.board);
    if (before !== after) {
      this.moves += 1;
      this.addRandomTile();
      this.render(mergedAny);
      sfxPop();
      // 检查通关
      const maxVal = maxValue(this.board);
      if (maxVal >= this.target && !this.won) {
        this.won = true;
        this.over = true;
        const rect = this.gridEl.getBoundingClientRect();
        this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
        // 星级按难度给合理阈值（与目标数字解绑，基于实际移动次数）
        // easy: ≤40 步 3星, ≤80 步 2星；medium: ≤80/160；hard: ≤150/300
        const limits: Record<string, [number, number]> = {
          easy: [40, 80],
          medium: [80, 160],
          hard: [150, 300],
        };
        const stars = starsByMoves(
          this.moves,
          limits[this.difficulty] ?? [80, 160],
        );
        this.resetWrongStreak();
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(stars);
          } else {
            this.setup();
          }
        }, 600);
        return;
      }
      // 检查无解
      if (!this.hasMoves()) {
        this.over = true;
        this.onWrong();
        this.trackTimeout(() => this.setup(), 1200);
      }
    }
  }

  /** 按方向提取 4 条线（每条线是该方向上要合并的序列）。 */
  private extract(dir: Dir): number[][] {
    return extract(this.board, dir);
  }

  private apply(dir: Dir, lines: number[][]): void {
    this.board = apply(this.board, dir, lines);
  }

  /** 一行向左合并：去零 + 相邻相同合并 + 补零。 */
  private collapse(line: number[]): { line: number[]; merged: boolean } {
    return collapse(line);
  }

  private hasMoves(): boolean {
    return hasMoves(this.board);
  }

  private render(merged = false): void {
    this.gridEl.innerHTML = "";
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const v = this.board[r]![c]!;
        const cell = document.createElement("div");
        cell.className = "g2-cell" + (v === 0 ? " g2-cell--empty" : "");
        if (v !== 0) {
          cell.style.background = COLORS[v] ?? "#3c3a32";
          cell.style.color = v <= 4 ? "#776e65" : "#fff";
          // 字号随数字位数自适应
          cell.style.fontSize =
            v < 100 ? "2.4rem" : v < 1000 ? "2rem" : "1.6rem";
          cell.textContent = String(v);
          if (merged) cell.classList.add("g2-cell--pop");
        }
        this.gridEl.appendChild(cell);
      }
    }
  }

  private injectStyle(): void {
    if (document.getElementById("g2-style")) return;
    const st = document.createElement("style");
    st.id = "g2-style";
    st.textContent = G2_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function G2_CSS(theme: string): string {
  return `
.g2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.g2-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.4;}
.g2-task b{color:${theme};}
.g2-task small{display:block;font-size:.85rem;color:#888;font-weight:600;}
.g2-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:10px;background:linear-gradient(160deg,#bbada0,#9c8a7d);border-radius:16px;width:min(340px,86vw);box-shadow:var(--shadow-lg);touch-action:none;}
.g2-cell{aspect-ratio:1;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;background:#cdc1b4;box-shadow:inset 0 -3px 0 rgba(0,0,0,.08);transition:transform .15s ease;user-select:none;}
.g2-cell--empty{background:rgba(238,228,218,0.35);}
.g2-cell--pop{animation:g2-pop .25s ease;}
@keyframes g2-pop{0%{transform:scale(.4)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
.g2-pad{display:grid;grid-template-columns:repeat(3,64px);grid-template-rows:repeat(2,58px);gap:8px;}
.g2-dir{font-size:1.6rem;font-weight:800;border-radius:14px;background:#fff;color:${theme};box-shadow:0 5px 0 #c9c4d0,var(--shadow);border:2px solid #eee;}
.g2-dir:active{transform:translateY(3px);box-shadow:0 2px 0 #c9c4d0,var(--shadow);}
.g2-dir--up{grid-column:2;grid-row:1;}
.g2-dir--left{grid-column:1;grid-row:2;}
.g2-dir--right{grid-column:3;grid-row:2;}
.g2-dir--down{grid-column:2;grid-row:2;}
`;
}

export function create(): Game2048 {
  return new Game2048();
}
