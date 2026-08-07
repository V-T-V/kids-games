/* 三消游戏 Match Three —— 经典宝石三消。
   6x6 网格，6 种宝石。点一个再点相邻的交换；若能凑成 3+ 同色连线则消除得分，
   上方宝石下落、顶部补新宝石，可能触发连锁。达到目标分数通关。
   操作：点选宝石 → 点相邻宝石交换（或直接拖拽相邻宝石）。
   难度=目标分数+网格大小。easy 4轮 / medium 6轮 / hard 8轮。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";
import {
  applyGravity as applyGravityGrid,
  clearMatches as clearMatchesGrid,
  findMatches as findMatchesGrid,
  hasMove as hasMoveGrid,
  isAdjacent as isAdjacentGrid,
  swap as swapGrid,
} from "./engine.ts";

/** 宝石：用 emoji 渲染，颜色 id 0..5。 */
const GEM_EMOJI = ["💎", "🔵", "🟢", "🟡", "🔴", "🟣"];
const GEM_COUNT = 6;

/** 单元格结构：null = 空格（消除后下落前）。 */
type Gem = number | null;

export class MatchThreeGame extends BaseGame {
  constructor() {
    super("match-three");
  }

  private n = 6;
  private grid: Gem[][] = [];
  private roundsDone = 0;
  private roundTotal = 0;
  private score = 0;
  private target = 0;
  private selected: { x: number; y: number } | null = null;
  private locked = true;

  protected mount(): void {
    this.n =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 6 : 7;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* 基类清理定时器 */
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.score = 0;
    this.target =
      this.difficulty === "easy"
        ? 60
        : this.difficulty === "medium"
          ? 100
          : 150;
    this.selected = null;
    this.fillGrid();
    this.locked = false;
    this.render();
  }

  /** 生成初始无三连的网格。 */
  private fillGrid(): void {
    do {
      this.grid = [];
      for (let y = 0; y < this.n; y++) {
        const row: Gem[] = [];
        for (let x = 0; x < this.n; x++) {
          let g: number;
          do {
            g = randInt(0, GEM_COUNT - 1);
            // 避免初始就成三连
          } while (
            (x >= 2 && row[x - 1] === g && row[x - 2] === g) ||
            (y >= 2 &&
              this.grid[y - 1]![x] === g &&
              this.grid[y - 2]![x] === g)
          );
          row.push(g);
        }
        this.grid.push(row);
      }
    } while (!this.hasMove());
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "mt-wrap";

    const task = document.createElement("div");
    task.className = "mt-task";
    task.innerHTML = `交换相邻宝石凑 <b>3 个同色</b> 连成一线！<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stat = document.createElement("div");
    stat.className = "mt-stat";
    stat.id = "mt-stat";
    stat.innerHTML = `得分 <b class="mt-score">0</b> / 目标 <b class="mt-target">${this.target}</b>`;
    wrap.appendChild(stat);

    const cell =
      this.n <= 5 ? 58 : this.n === 6 ? 50 : 44;
    const board = document.createElement("div");
    board.className = "mt-board";
    board.id = "mt-board";
    board.style.setProperty("--n", String(this.n));
    board.style.setProperty("--cell", `${cell}px`);
    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < this.n; x++) {
        this.createCell(board, x, y, cell);
      }
    }
    wrap.appendChild(board);

    const hint = document.createElement("div");
    hint.className = "mt-hint";
    hint.textContent = "点两个相邻宝石交换；换完没有同色会自动换回。";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
  }

  private createCell(
    board: HTMLElement,
    x: number,
    y: number,
    cell: number,
  ): void {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "mt-cell";
    el.dataset.x = String(x);
    el.dataset.y = String(y);
    el.style.width = `${cell}px`;
    el.style.height = `${cell}px`;
    const g = this.grid[y]![x]!;
    el.textContent = g == null ? "" : GEM_EMOJI[g]!;
    el.addEventListener("click", () => this.onTap(x, y));
    board.appendChild(el);
  }

  private onTap(x: number, y: number): void {
    if (this.locked) return;
    if (this.selected == null) {
      this.selected = { x, y };
      this.markSelected();
      sfxPop();
      return;
    }
    const s = this.selected;
    if (s.x === x && s.y === y) {
      // 取消选择
      this.selected = null;
      this.markSelected();
      return;
    }
    if (!this.isAdjacent(s.x, s.y, x, y)) {
      // 改选
      this.selected = { x, y };
      this.markSelected();
      sfxPop();
      return;
    }
    this.selected = null;
    this.markSelected();
    void this.trySwap(s.x, s.y, x, y);
  }

  private isAdjacent(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): boolean {
    return isAdjacentGrid(x1, y1, x2, y2);
  }

  private markSelected(): void {
    this.root
      .querySelectorAll(".mt-cell--sel")
      .forEach((el) => el.classList.remove("mt-cell--sel"));
    if (this.selected) {
      const el = this.root.querySelector(
        `.mt-cell[data-x="${this.selected.x}"][data-y="${this.selected.y}"]`,
      );
      el?.classList.add("mt-cell--sel");
    }
  }

  /** 尝试交换；若产生消除则结算，否则换回。 */
  private async trySwap(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): Promise<void> {
    this.locked = true;
    this.swap(x1, y1, x2, y2);
    this.redraw();
    await this.delay(180);
    const matches = this.findMatches();
    if (matches.size === 0) {
      // 无效交换：换回并提示
      this.swap(x1, y1, x2, y2);
      this.redraw();
      sfxPop();
      const paused = this.onWrong();
      if (paused) this.showRest();
      await this.delay(160);
      this.locked = false;
      // 若整盘无解则重洗
      if (!this.hasMove()) {
        this.fillGrid();
        this.redraw();
      }
      return;
    }
    // 有效消除：连锁结算
    this.resetWrongStreak();
    let chain = 0;
    while (true) {
      const m = this.findMatches();
      if (m.size === 0) break;
      chain += 1;
      this.score += m.size * (10 + (chain - 1) * 5);
      this.highlightMatches(m);
      await this.delay(220);
      this.clearMatches(m);
      this.redraw();
      await this.delay(120);
      this.applyGravity();
      this.redraw();
      await this.delay(160);
    }
    if (chain > 0) {
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
    }
    this.updateStat();
    // 判定本关是否达标
    if (this.score >= this.target) {
      this.locked = true;
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 700);
      return;
    }
    // 无可走步则重洗
    if (!this.hasMove()) {
      this.fillGrid();
      this.redraw();
    }
    this.locked = false;
  }

  private updateStat(): void {
    const stat = this.root.querySelector("#mt-stat");
    if (stat) {
      stat.innerHTML = `得分 <b class="mt-score">${this.score}</b> / 目标 <b class="mt-target">${this.target}</b>`;
    }
  }

  private swap(x1: number, y1: number, x2: number, y2: number): void {
    this.grid = swapGrid(this.grid, x1, y1, x2, y2);
  }

  /** 找出所有属于三连（行或列）的格子坐标集合（"x,y"）。 */
  private findMatches(): Set<string> {
    return findMatchesGrid(this.grid, this.n) as Set<string>;
  }

  private highlightMatches(m: Set<string>): void {
    for (const key of m) {
      const [x, y] = key.split(",").map(Number);
      const el = this.root.querySelector(
        `.mt-cell[data-x="${x}"][data-y="${y}"]`,
      );
      el?.classList.add("mt-cell--boom");
    }
  }

  private clearMatches(m: Set<string>): void {
    this.grid = clearMatchesGrid(this.grid, m as Set<`${number},${number}`>);
  }

  /** 重力下落 + 顶部补充。 */
  private applyGravity(): void {
    this.grid = applyGravityGrid(this.grid, this.n, () =>
      randInt(0, GEM_COUNT - 1),
    );
  }

  private redraw(): void {
    const board = this.root.querySelector("#mt-board");
    if (!board) return;
    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < this.n; x++) {
        const el = board.querySelector(
          `.mt-cell[data-x="${x}"][data-y="${y}"]`,
        ) as HTMLButtonElement | null;
        if (!el) continue;
        const g = this.grid[y]![x];
        el.textContent = g == null ? "" : GEM_EMOJI[g]!;
      }
    }
    // 清掉上一轮 boom 标记
    board
      .querySelectorAll(".mt-cell--boom")
      .forEach((el) => el.classList.remove("mt-cell--boom"));
  }

  /** 是否存在至少一个能产生消除的相邻交换。 */
  private hasMove(): boolean {
    return hasMoveGrid(this.grid, this.n);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.trackTimeout(() => resolve(), ms);
    });
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "💎",
      variant: "rest",
      body: "找找哪两个宝石交换能让同色连成三个～",
      primary: { text: "继续", icon: "✨", onClick: () => ov.destroy() },
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
    if (document.getElementById("mt-style")) return;
    const st = document.createElement("style");
    st.id = "mt-style";
    st.textContent = MT_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function MT_CSS(theme: string): string {
  return `
.mt-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;}
.mt-task{font-size:1.05rem;font-weight:800;text-align:center;color:var(--ink);background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.mt-task b{color:${theme};}
.mt-task small{color:var(--ink-soft);font-weight:700;font-size:.82rem;margin-left:6px;}
.mt-stat{font-size:1rem;font-weight:800;color:var(--ink);}
.mt-score{color:${theme};font-size:1.2rem;}
.mt-target{color:var(--ink-soft);}
.mt-board{display:grid;grid-template-columns:repeat(var(--n),var(--cell));grid-auto-rows:var(--cell);gap:4px;padding:12px;background:linear-gradient(160deg,#2d1b4e,#1a1030);border-radius:18px;box-shadow:var(--shadow-lg);}
.mt-cell{display:flex;align-items:center;justify-content:center;font-size:calc(var(--cell) * .58);line-height:1;border:none;border-radius:12px;background:rgba(255,255,255,.06);cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;touch-action:none;}
.mt-cell:active{transform:scale(.92);}
.mt-cell--sel{box-shadow:0 0 0 3px #fff,0 0 14px ${theme};transform:scale(1.06);}
.mt-cell--boom{animation:mt-boom .22s ease forwards;}
@keyframes mt-boom{0%{transform:scale(1)}40%{transform:scale(1.35);filter:brightness(1.6)}100%{transform:scale(0);opacity:0}}
.mt-hint{font-size:.85rem;font-weight:700;color:var(--ink-soft);text-align:center;}
@media (max-width:380px){}
`;
}

export function create(): MatchThreeGame {
  return new MatchThreeGame();
}
