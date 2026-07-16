/* 拼图小能手 Jigsaw —— 还原打乱的彩色宫格图案。
   玩法：点击两个方块交换位置，还原成正确顺序。
   巧思：每个方块带渐变与编号，拼对时整体高亮；难度=宫格数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

export class JigsawGame extends BaseGame {
  constructor() {
    super("jigsaw");
  }

  private grid = 2;
  private tiles: number[] = []; // 当前每个位置的「正确编号」
  private moves = 0;

  protected mount(): void {
    this.grid =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    const n = this.grid * this.grid;
    const correct = Array.from({ length: n }, (_, i) => i);
    // 打乱直到不是已排序
    let arr = shuffle(correct);
    while (arr.every((v, i) => v === i) && n > 1) arr = shuffle(correct);
    this.tiles = arr;
    this.moves = 0;

    const wrap = document.createElement("div");
    wrap.className = "jg-wrap";
    const task = document.createElement("div");
    task.className = "jg-task";
    task.textContent = `点击两个方块交换，拼出完整图案～`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "jg-board";
    board.style.setProperty("--n", String(this.grid));

    this.tiles.forEach((tileId, pos) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "jg-cell";
      cell.dataset.pos = String(pos);
      this.styleTile(cell, tileId);
      cell.addEventListener("click", () => this.onCell(cell, pos));
      board.appendChild(cell);
    });
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private selectedPos: number | null = null;

  private onCell(cell: HTMLElement, pos: number): void {
    if (this.selectedPos === null) {
      this.selectedPos = pos;
      cell.classList.add("jg-cell--sel");
      sfxPop();
      return;
    }
    if (this.selectedPos === pos) {
      this.selectedPos = null;
      cell.classList.remove("jg-cell--sel");
      return;
    }
    // 交换 selectedPos 与 pos
    const a = this.selectedPos;
    const b = pos;
    [this.tiles[a], this.tiles[b]] = [this.tiles[b]!, this.tiles[a]!];
    this.selectedPos = null;
    this.moves += 1;
    this.rerender();
    sfxPop();
    if (this.tiles.every((v, i) => v === i)) {
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.trackTimeout(
        () =>
          this.finishClear(
            this.moves <= this.grid * 3
              ? 3
              : this.moves <= this.grid * 6
                ? 2
                : 1,
          ),
        900,
      );
    }
  }

  private rerender(): void {
    const cells = this.root.querySelectorAll(".jg-cell");
    this.tiles.forEach((tileId, pos) => {
      const c = cells[pos] as HTMLElement;
      c.classList.remove("jg-cell--sel");
      this.styleTile(c, tileId);
    });
  }

  /** 给方块设置图案：按 tileId 计算它在渐变中的位置（拼对时连成完整渐变）。 */
  private styleTile(cell: HTMLElement, tileId: number): void {
    const n = this.grid;
    const col = tileId % n;
    const row = Math.floor(tileId / n);
    cell.style.background = `hsl(${(tileId / (n * n)) * 280 + 20}, 75%, 60%)`;
    cell.style.backgroundSize = `${n * 100}% ${n * 100}%`;
    cell.style.backgroundPosition = `${(col / (n - 1)) * 100}% ${(row / (n - 1)) * 100}%`;
    cell.textContent = String(tileId + 1);
  }

  private injectStyle(): void {
    if (document.getElementById("jg-style")) return;
    const st = document.createElement("style");
    st.id = "jg-style";
    st.textContent = JG_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function JG_CSS(theme: string): string {
  return `
.jg-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(420px,100%);}
.jg-task{font-size:1.1rem;font-weight:800;text-align:center;}
.jg-board{display:grid;grid-template-columns:repeat(var(--n,2),1fr);gap:6px;padding:8px;background:${theme};border-radius:18px;box-shadow:var(--shadow);}
.jg-cell{
  width:90px;height:90px;border:none;border-radius:10px;font-size:1.4rem;font-weight:800;color:#fff;
  display:flex;align-items:center;justify-content:center;mix-blend-mode:normal;
  filter:brightness(1.05);text-shadow:0 2px 4px rgba(0,0,0,.4);transition:transform .12s;
}
.jg-cell:active{transform:scale(.94);}
.jg-cell--sel{outline:4px solid #fff;outline-offset:-4px;transform:scale(1.05);}
@media (max-width:380px){.jg-cell{width:72px;height:72px;font-size:1.2rem;}}
`;
}

export function create(): JigsawGame {
  return new JigsawGame();
}
