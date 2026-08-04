/* 建筑工地 Construction —— 看图纸，用彩色方块搭出一模一样的建筑。
   独特点：俯视侧视图搭积木，锻炼空间对应与颜色匹配。
   视觉：网格底板 + 立体方块（带高光阴影），上方是目标图纸。
   玩法：下方有一排彩色方块，点选一个再点网格空位放置，颜色对上即可放下；
         放错了可点已放方块撤回。通关 = 搭对目标轮数。
   解保证：目标建筑本身由若干彩色方块组成，下方提供完全相同的方块集合（含颜色）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 方块颜色（带深浅，用于立体感）。 */
const BLOCKS: { id: number; color: string; dark: string }[] = [
  { id: 0, color: "#ff6b9d", dark: "#d44a7a" },
  { id: 1, color: "#4d96ff", dark: "#3576d4" },
  { id: 2, color: "#6bcf7f", dark: "#4ba85f" },
  { id: 3, color: "#ffd93d", dark: "#d4ab10" },
  { id: 4, color: "#a55eea", dark: "#7e3fc4" },
  { id: 5, color: "#ff9f43", dark: "#d47a1f" },
];

const GRID_COLS = 5;
const GRID_ROWS = 5;
/** 每轮的方块数（即难度）。 */
function blockCount(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 4 : diff === "medium" ? 6 : 8;
}
function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 2 : diff === "medium" ? 3 : 3;
}

/** 生成一个可解的目标建筑：自下而上一列列堆，保证下方有支撑。 */
function generateBlueprint(n: number): number[] {
  // grid[row*COLS+col] = blockId 或 -1（空）。row 0 = 最底层。
  const cells = new Array<number>(GRID_COLS * GRID_ROWS).fill(-1);
  let placed = 0;
  let guard = 0;
  while (placed < n && guard < 200) {
    guard++;
    const col = Math.floor(Math.random() * GRID_COLS);
    // 找该列最顶可放高度（从底往上数第一个空位）
    let row = -1;
    for (let r = 0; r < GRID_ROWS; r++) {
      if (cells[r * GRID_COLS + col] === -1) {
        row = r;
        break;
      }
    }
    if (row < 0) continue;
    cells[row * GRID_COLS + col] = Math.floor(Math.random() * BLOCKS.length);
    placed++;
  }
  // 若因列满未放够，补到其它列（保证数量=n，从而下方提供等量方块有解）
  guard = 0;
  while (placed < n && guard < 500) {
    guard++;
    const col = Math.floor(Math.random() * GRID_COLS);
    let row = -1;
    for (let r = 0; r < GRID_ROWS; r++) {
      if (cells[r * GRID_COLS + col] === -1) {
        row = r;
        break;
      }
    }
    if (row < 0) continue;
    cells[row * GRID_COLS + col] = Math.floor(Math.random() * BLOCKS.length);
    placed++;
  }
  return cells;
}

export class ConstructionGame extends BaseGame {
  constructor() {
    super("construction");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private target: number[] = [];
  private player: number[] = [];
  private trayBlocks: number[] = [];
  private selectedTray = -1;

  protected mount(): void {
    this.roundTotal = roundTotal(this.difficulty);
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空，无定时器/动画残留 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = blockCount(this.difficulty);
    this.target = generateBlueprint(n);
    this.player = new Array<number>(GRID_COLS * GRID_ROWS).fill(-1);
    // 托盘提供与目标完全相同的方块集合（颜色一致），保证有解
    const tray: number[] = [];
    for (const c of this.target) if (c >= 0) tray.push(c);
    this.trayBlocks = shuffle(tray);
    this.selectedTray = -1;

    const wrap = document.createElement("div");
    wrap.className = "cst-wrap";

    const task = document.createElement("div");
    task.className = "cst-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 看图纸，搭出一模一样的楼 🏗️`;
    wrap.appendChild(task);

    // 上：目标图纸
    const bp = document.createElement("div");
    bp.className = "cst-blueprint";
    bp.appendChild(this.renderGrid(this.target, true, "图纸 📐"));
    wrap.appendChild(bp);

    // 下：玩家工地
    const site = document.createElement("div");
    site.className = "cst-site";
    site.appendChild(this.renderPlayerGrid());
    wrap.appendChild(site);

    // 托盘
    const trayEl = document.createElement("div");
    trayEl.className = "cst-tray";
    this.trayBlocks.forEach((bid, i) => {
      const t = document.createElement("button");
      t.type = "button";
      t.className = "cst-trayblock";
      t.dataset.idx = String(i);
      const b = BLOCKS[bid]!;
      t.style.setProperty("--cst-color", b.color);
      t.style.setProperty("--cst-dark", b.dark);
      t.addEventListener("click", () => this.pickTray(i));
      trayEl.appendChild(t);
    });
    wrap.appendChild(trayEl);

    // 撤回 + 重置
    const tools = document.createElement("div");
    tools.className = "cst-tools";
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "cst-btn";
    undo.textContent = "↩️ 拿掉上一个";
    undo.addEventListener("click", () => this.undoLast());
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "cst-btn";
    clear.textContent = "🔄 全部重来";
    clear.addEventListener("click", () => this.resetPlayer());
    tools.appendChild(undo);
    tools.appendChild(clear);
    wrap.appendChild(tools);

    this.root.appendChild(wrap);
  }

  private renderGrid(
    cells: number[],
    fixed: boolean,
    label: string,
  ): HTMLElement {
    const box = document.createElement("div");
    box.className = "cst-gridbox";
    const lab = document.createElement("div");
    lab.className = "cst-gridlabel";
    lab.textContent = label;
    box.appendChild(lab);
    const grid = document.createElement("div");
    grid.className = "cst-grid";
    // 从顶层往底层渲染（row 大的在上方）
    for (let r = GRID_ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "cst-cell";
        const v = cells[r * GRID_COLS + c]!;
        if (v >= 0) {
          const b = BLOCKS[v]!;
          const blk = document.createElement("div");
          blk.className = "cst-block";
          blk.style.setProperty("--cst-color", b.color);
          blk.style.setProperty("--cst-dark", b.dark);
          cell.appendChild(blk);
        } else {
          cell.classList.add("cst-cell--empty");
        }
        grid.appendChild(cell);
      }
    }
    box.appendChild(grid);
    void fixed;
    return box;
  }

  private renderPlayerGrid(): HTMLElement {
    const box = document.createElement("div");
    box.className = "cst-gridbox cst-gridbox--player";
    const lab = document.createElement("div");
    lab.className = "cst-gridlabel";
    lab.textContent = "你的工地 🧱";
    box.appendChild(lab);
    const grid = document.createElement("div");
    grid.className = "cst-grid";
    for (let r = GRID_ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < GRID_COLS; c++) {
        const idx = r * GRID_COLS + c;
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cst-cell cst-cell--slot";
        cell.dataset.idx = String(idx);
        const v = this.player[idx]!;
        if (v >= 0) {
          const b = BLOCKS[v]!;
          const blk = document.createElement("div");
          blk.className = "cst-block";
          blk.style.setProperty("--cst-color", b.color);
          blk.style.setProperty("--cst-dark", b.dark);
          cell.appendChild(blk);
        }
        cell.addEventListener("click", () => this.onCellClick(idx));
        grid.appendChild(cell);
      }
    }
    box.appendChild(grid);
    return box;
  }

  private refreshPlayerGrid(): void {
    const grid = this.root.querySelector(".cst-gridbox--player .cst-grid");
    if (!grid) return;
    const cells = grid.querySelectorAll<HTMLButtonElement>(".cst-cell--slot");
    cells.forEach((cell) => {
      const idx = Number(cell.dataset.idx);
      const v = this.player[idx]!;
      cell.innerHTML = "";
      if (v >= 0) {
        const b = BLOCKS[v]!;
        const blk = document.createElement("div");
        blk.className = "cst-block";
        blk.style.setProperty("--cst-color", b.color);
        blk.style.setProperty("--cst-dark", b.dark);
        cell.appendChild(blk);
      }
    });
  }

  private refreshTray(): void {
    const trayEl = this.root.querySelector(".cst-tray");
    if (!trayEl) return;
    trayEl
      .querySelectorAll<HTMLButtonElement>(".cst-trayblock")
      .forEach((t) => {
        const i = Number(t.dataset.idx);
        const used = this.trayBlocks[i] === -1;
        t.classList.toggle("cst-trayblock--used", used);
        t.classList.toggle("cst-trayblock--sel", i === this.selectedTray);
      });
  }

  private pickTray(i: number): void {
    if (this.trayBlocks[i] === -1) return;
    this.selectedTray = this.selectedTray === i ? -1 : i;
    sfxPop();
    this.refreshTray();
  }

  private onCellClick(idx: number): void {
    // 若该格已有方块 → 撤回它（拿回托盘）
    if (this.player[idx] !== -1) {
      const bid = this.player[idx]!;
      // 找一个空托盘位放回
      const slot = this.trayBlocks.findIndex((b) => b === -1);
      if (slot >= 0) {
        this.trayBlocks[slot] = bid;
        this.player[idx] = -1;
        sfxPop();
        this.selectedTray = -1;
        this.refreshPlayerGrid();
        this.refreshTray();
      }
      return;
    }
    if (this.selectedTray < 0) return;
    const bid = this.trayBlocks[this.selectedTray]!;
    if (bid < 0) return;
    // 简单重力：该格下方必须有支撑（最底层除外），否则不允许悬空放置
    const row = Math.floor(idx / GRID_COLS);
    if (row > 0 && this.player[idx - GRID_COLS] === -1) {
      // 悬空，温柔提示
      this.flashWrong();
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    this.player[idx] = bid;
    this.trayBlocks[this.selectedTray] = -1;
    this.selectedTray = -1;
    const cell = this.root.querySelector<HTMLButtonElement>(
      `.cst-cell--slot[data-idx="${idx}"]`,
    );
    if (cell) {
      const r = cell.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    }
    this.refreshPlayerGrid();
    this.refreshTray();
    this.checkWin();
  }

  private undoLast(): void {
    for (let i = this.player.length - 1; i >= 0; i--) {
      if (this.player[i] !== -1) {
        const bid = this.player[i]!;
        const slot = this.trayBlocks.findIndex((b) => b === -1);
        if (slot >= 0) {
          this.trayBlocks[slot] = bid;
          this.player[i] = -1;
          sfxPop();
          this.refreshPlayerGrid();
          this.refreshTray();
        }
        return;
      }
    }
  }

  private resetPlayer(): void {
    sfxPop();
    this.player = new Array<number>(GRID_COLS * GRID_ROWS).fill(-1);
    // 重建托盘
    const tray: number[] = [];
    for (const c of this.target) if (c >= 0) tray.push(c);
    this.trayBlocks = shuffle(tray);
    this.selectedTray = -1;
    this.refreshPlayerGrid();
    this.refreshTray();
  }

  private flashWrong(): void {
    const site = this.root.querySelector(".cst-site") as HTMLElement | null;
    if (!site) return;
    site.classList.remove("cst-shake");
    void site.offsetWidth;
    site.classList.add("cst-shake");
  }

  private checkWin(): void {
    // 完全匹配即通关
    const match = this.player.every((v, i) => v === this.target[i]);
    if (!match) return;
    this.roundsDone += 1;
    this.resetWrongStreak();
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 700);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看图纸上的颜色，再挑一个一样的方块吧～",
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
    if (document.getElementById("cst-style")) return;
    const st = document.createElement("style");
    st.id = "cst-style";
    st.textContent = CST_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function CST_CSS(theme: string): string {
  return `
.cst-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.cst-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.cst-blueprint{background:rgba(255,255,255,.55);padding:10px 12px 14px;border-radius:18px;box-shadow:var(--shadow);}
.cst-site{background:linear-gradient(180deg,#e8d8b8,#d8c4a0);padding:10px 12px 14px;border-radius:18px;box-shadow:var(--shadow);border:2px dashed ${theme}88;}
.cst-site.cst-shake{animation:cst-shake .4s ease;}
@keyframes cst-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.cst-gridbox{width:min(220px,90%);}
.cst-gridbox--player{width:min(220px,90%);}
.cst-gridlabel{font-size:.85rem;font-weight:800;color:var(--ink-soft);text-align:center;margin-bottom:6px;}
.cst-grid{display:grid;grid-template-columns:repeat(${GRID_COLS},1fr);gap:3px;background:rgba(0,0,0,.06);padding:4px;border-radius:10px;}
.cst-cell{position:relative;aspect-ratio:1/1;border-radius:5px;background:rgba(255,255,255,.35);display:flex;align-items:flex-end;justify-content:center;padding:0;border:none;}
.cst-cell--empty{background:rgba(255,255,255,.15);}
.cst-cell--slot{cursor:pointer;transition:background .12s;}
.cst-cell--slot:hover{background:rgba(255,255,255,.7);}
.cst-block{width:100%;height:80%;border-radius:5px;background:linear-gradient(160deg,var(--cst-color),var(--cst-dark));box-shadow:inset 0 2px 0 rgba(255,255,255,.45),inset 0 -3px 0 rgba(0,0,0,.22),0 2px 3px rgba(0,0,0,.18);animation:cst-pop .18s ease;}
@keyframes cst-pop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
.cst-tray{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:12px;background:rgba(255,255,255,.6);border-radius:16px;box-shadow:var(--shadow);min-height:54px;}
.cst-trayblock{width:42px;height:42px;border-radius:7px;border:none;background:linear-gradient(160deg,var(--cst-color),var(--cst-dark));box-shadow:inset 0 2px 0 rgba(255,255,255,.45),inset 0 -3px 0 rgba(0,0,0,.22),0 3px 5px rgba(0,0,0,.18);cursor:pointer;transition:transform .12s,box-shadow .12s;}
.cst-trayblock:active{transform:scale(.9);}
.cst-trayblock--sel{transform:translateY(-6px) scale(1.08);box-shadow:inset 0 2px 0 rgba(255,255,255,.45),inset 0 -3px 0 rgba(0,0,0,.22),0 8px 12px rgba(0,0,0,.25),0 0 0 3px #fff,0 0 0 6px ${theme};}
.cst-trayblock--used{opacity:0;pointer-events:none;transform:scale(0);}
.cst-tools{display:flex;gap:10px;}
.cst-btn{font-family:inherit;font-size:.9rem;font-weight:800;color:var(--ink);background:#fff;border:none;padding:8px 14px;border-radius:999px;box-shadow:var(--shadow);cursor:pointer;}
.cst-btn:active{transform:scale(.94);}
@media (max-width:380px){.cst-gridbox,.cst-gridbox--player{width:min(200px,90%);}.cst-trayblock{width:36px;height:36px;}}
`;
}

export function create(): ConstructionGame {
  return new ConstructionGame();
}
