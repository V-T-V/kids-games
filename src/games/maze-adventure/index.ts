/* 走迷宫 Maze Adventure —— 控制小车穿过迷宫到达终点，收集星星。
   巧思：程序生成迷宫 + 星星收集 + 3 星通关（按收集数）。
   交互：方向按钮（触屏）+ 键盘箭头（桌面）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { getCssVar } from "../../lobby/util.ts";
import { generateMaze, scatterStars, type Grid } from "./maze.ts";

export class MazeAdventureGame extends BaseGame {
  constructor() {
    super("maze-adventure");
  }

  private grid!: Grid;
  private cols = 5;
  private rows = 5;
  private cellSize = 56;
  private px = 0;
  private py = 0;
  private stars: { x: number; y: number }[] = [];
  private collected = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private carEl!: HTMLDivElement;
  private boardEl!: HTMLDivElement;
  private roundsDone = 0;
  private roundTotal = 0;

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const size = this.sizeForDifficulty();
    this.cols = size;
    this.rows = size;
    this.cellSize = size <= 6 ? 56 : size <= 8 ? 44 : 36;
    this.grid = generateMaze(this.cols, this.rows);
    this.stars = scatterStars(
      this.grid,
      this.cols,
      this.rows,
      this.starsForDifficulty(),
    );
    this.collected = 0;
    this.px = 0;
    this.py = 0;
    this.render();
  }

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();

    this.keyHandler = (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        this.tryMove(dir[0], dir[1]);
      }
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  protected unmount(): void {
    if (this.keyHandler) window.removeEventListener("keydown", this.keyHandler);
    this.keyHandler = null;
  }

  private sizeForDifficulty(): number {
    if (this.difficulty === "easy") return 5;
    if (this.difficulty === "medium") return 7;
    return 9;
  }

  private starsForDifficulty(): number {
    if (this.difficulty === "easy") return 3;
    if (this.difficulty === "medium") return 5;
    return 8;
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "mz-wrap";

    const task = document.createElement("div");
    task.className = "mz-task";
    task.innerHTML = `开小车到 🏁 收集 ⭐（${this.collected}/${this.stars.length}）`;
    wrap.appendChild(task);

    this.boardEl = document.createElement("div");
    this.boardEl.className = "mz-board";
    this.boardEl.style.setProperty("--cell", `${this.cellSize}px`);
    this.boardEl.style.width = `${this.cols * this.cellSize}px`;
    this.boardEl.style.height = `${this.rows * this.cellSize}px`;

    // 绘制墙壁（用 SVG overlay）
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute(
      "viewBox",
      `0 0 ${this.cols * this.cellSize} ${this.rows * this.cellSize}`,
    );
    svg.setAttribute("width", String(this.cols * this.cellSize));
    svg.setAttribute("height", String(this.rows * this.cellSize));
    svg.classList.add("mz-walls");
    const s = this.cellSize;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const c = this.grid[y]![x]!;
        if (c.top) svg.appendChild(this.wall(x * s, y * s, (x + 1) * s, y * s));
        if (c.left)
          svg.appendChild(this.wall(x * s, y * s, x * s, (y + 1) * s));
        // 只在边缘画 right/bottom，避免重复
        if (x === this.cols - 1 && c.right)
          svg.appendChild(
            this.wall((x + 1) * s, y * s, (x + 1) * s, (y + 1) * s),
          );
        if (y === this.rows - 1 && c.bottom)
          svg.appendChild(
            this.wall(x * s, (y + 1) * s, (x + 1) * s, (y + 1) * s),
          );
      }
    }
    this.boardEl.appendChild(svg);

    // 星星
    this.stars.forEach((st, i) => {
      const el = document.createElement("div");
      el.className = "mz-star";
      el.textContent = "⭐";
      el.style.left = `${st.x * s + s / 2 - 14}px`;
      el.style.top = `${st.y * s + s / 2 - 14}px`;
      el.dataset.idx = String(i);
      this.boardEl.appendChild(el);
    });

    // 终点旗
    const goal = document.createElement("div");
    goal.className = "mz-goal";
    goal.textContent = "🏁";
    goal.style.left = `${(this.cols - 1) * s + s / 2 - 16}px`;
    goal.style.top = `${(this.rows - 1) * s + s / 2 - 16}px`;
    this.boardEl.appendChild(goal);

    // 小车
    this.carEl = document.createElement("div");
    this.carEl.className = "mz-car";
    this.carEl.textContent = "🚗";
    this.updateCarPos();
    this.boardEl.appendChild(this.carEl);

    wrap.appendChild(this.boardEl);

    // 方向键（触屏友好）
    const pad = document.createElement("div");
    pad.className = "mz-pad";
    pad.innerHTML = `
      <div></div><button class="mz-pad__btn" data-dir="up">⬆️</button><div></div>
      <button class="mz-pad__btn" data-dir="left">⬅️</button><div></div><button class="mz-pad__btn" data-dir="right">➡️</button>
      <div></div><button class="mz-pad__btn" data-dir="down">⬇️</button><div></div>`;
    pad.querySelectorAll(".mz-pad__btn").forEach((b) => {
      b.addEventListener("click", () => {
        const dir = (b as HTMLElement).dataset.dir!;
        const m: Record<string, [number, number]> = {
          up: [0, -1],
          down: [0, 1],
          left: [-1, 0],
          right: [1, 0],
        };
        this.tryMove(...m[dir]!);
      });
    });
    wrap.appendChild(pad);

    this.root.appendChild(wrap);
  }

  private wall(x1: number, y1: number, x2: number, y2: number): SVGLineElement {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", String(x1));
    l.setAttribute("y1", String(y1));
    l.setAttribute("x2", String(x2));
    l.setAttribute("y2", String(y2));
    return l;
  }

  private updateCarPos(): void {
    if (!this.carEl) return;
    const s = this.cellSize;
    this.carEl.style.left = `${this.px * s + s / 2 - 18}px`;
    this.carEl.style.top = `${this.py * s + s / 2 - 18}px`;
  }

  private tryMove(dx: number, dy: number): void {
    const cell = this.grid[this.py]![this.px]!;
    // 检查目标方向是否有墙
    if (dx === 1 && cell.right) return;
    if (dx === -1 && cell.left) return;
    if (dy === 1 && cell.bottom) return;
    if (dy === -1 && cell.top) return;
    const nx = this.px + dx;
    const ny = this.py + dy;
    if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) return;
    this.px = nx;
    this.py = ny;
    this.updateCarPos();
    sfxPop();

    // 检查星星收集
    const starIdx = this.stars.findIndex((s2) => s2.x === nx && s2.y === ny);
    if (starIdx >= 0) {
      this.stars.splice(starIdx, 1);
      this.collected += 1;
      const starEl = this.boardEl.querySelector(
        `.mz-star[data-idx="${starIdx}"]`,
      );
      starEl?.remove();
      const r = this.carEl.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 10);
      // 星星成就
      const total = this.collected; // 本局累计；成就按全局可扩展
      if (total >= 8) this.unlock("star-collector");
      this.updateTask();
    }

    // 到达终点
    if (nx === this.cols - 1 && ny === this.rows - 1) {
      // 星数：按本局收集比例评定（全收=3星）
      const expectedTotal = this.collected + this.stars.length;
      const finalStars =
        expectedTotal === 0
          ? 3
          : Math.max(1, Math.round((this.collected / expectedTotal) * 3));
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(finalStars);
        } else {
          this.startRound();
        }
      }, 400);
    }
  }

  private updateTask(): void {
    const t = this.root.querySelector(".mz-task");
    if (t)
      t.innerHTML = `开小车到 🏁 收集 ⭐（${this.collected}/${this.collected + this.stars.length}）`;
  }

  private injectStyle(): void {
    if (document.getElementById("mz-style")) return;
    const st = document.createElement("style");
    st.id = "mz-style";
    st.textContent = MZ_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function MZ_CSS(theme: string): string {
  return `
.mz-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.mz-task{font-size:1.1rem;font-weight:800;}
.mz-board{position:relative;background:rgba(255,255,255,.6);border-radius:16px;box-shadow:var(--shadow);}
.mz-walls line{stroke:${theme};stroke-width:5;stroke-linecap:round;}
.mz-car{position:absolute;width:36px;height:36px;font-size:1.8rem;transition:left .12s ease,top .12s ease;z-index:3;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25));}
.mz-star{position:absolute;width:28px;height:28px;font-size:1.4rem;z-index:2;animation:mz-twinkle 1.5s ease-in-out infinite;}
.mz-goal{position:absolute;width:32px;height:32px;font-size:1.6rem;z-index:2;animation:mz-bob 1s ease-in-out infinite;}
@keyframes mz-twinkle{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:.7}}
@keyframes mz-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.mz-pad{display:grid;grid-template-columns:repeat(3,64px);grid-template-rows:repeat(3,64px);gap:8px;}
.mz-pad__btn{font-size:1.8rem;border-radius:16px;background:#fff;box-shadow:var(--shadow);}
.mz-pad__btn:active{transform:scale(.92);}
@media (max-width:380px){.mz-pad{grid-template-columns:repeat(3,54px);grid-template-rows:repeat(3,54px);}}
`;
}

export function create(): MazeAdventureGame {
  return new MazeAdventureGame();
}
