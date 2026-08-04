/* 连连看 Link Match —— 点击两个相同图案，若可经≤2拐弯连通则消除。
   独特点：经典连连看路径规则（最多2个拐弯），用 SVG 画出连接折线。
   巧思：连成的路径高亮闪现后消失；难度=图案种类/网格大小。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";
import { canConnect, type Cell } from "./pathfind.ts";

const ICONS = [
  "🍎",
  "🍌",
  "🍇",
  "🐶",
  "🐱",
  "⭐",
  "🌸",
  "🚗",
  "🦋",
  "🐝",
] as const;

interface Tile {
  x: number;
  y: number;
  el: HTMLButtonElement;
}

export class LinkMatchGame extends BaseGame {
  constructor() {
    super("link-match");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private cols = 0;
  private rows = 0;
  private grid: Cell[][] = [];
  private tiles: Tile[] = [];
  private first: Tile | null = null;
  private remaining = 0;
  private pairs = 0;
  private svgEl!: SVGSVGElement;

  protected mount(): void {
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
    const pairs =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.cols = pairs;
    this.rows = 2;
    this.pairs = pairs;

    // 生成网格：每个图案 2 个，打乱
    const chosen = shuffle([...ICONS]).slice(0, pairs);
    const cells: string[] = shuffle([...chosen, ...chosen]);
    this.grid = [];
    for (let y = 0; y < this.rows; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < this.cols; x++) row.push(cells[y * this.cols + x]!);
      this.grid.push(row);
    }
    this.remaining = pairs * 2;
    this.first = null;

    const wrap = document.createElement("div");
    wrap.className = "lm-wrap";
    const task = document.createElement("div");
    task.className = "lm-task";
    task.innerHTML = `点两个一样的图案把它们连起来～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "lm-board";
    board.style.setProperty("--cols", String(this.cols));
    const cellSize = 64;
    this.svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svgEl.classList.add("lm-svg");
    this.svgEl.setAttribute(
      "viewBox",
      `0 0 ${this.cols * cellSize} ${this.rows * cellSize}`,
    );
    this.svgEl.setAttribute("width", String(this.cols * cellSize));
    this.svgEl.setAttribute("height", String(this.rows * cellSize));

    this.tiles = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "lm-tile";
        btn.textContent = this.grid[y]![x]!;
        btn.style.left = `${x * cellSize}px`;
        btn.style.top = `${y * cellSize}px`;
        const tile: Tile = { x, y, el: btn };
        btn.addEventListener("click", () => this.onTile(tile));
        board.appendChild(btn);
        this.tiles.push(tile);
      }
    }
    board.appendChild(this.svgEl);
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private onTile(t: Tile): void {
    if (this.grid[t.y]![t.x] === "") return;
    if (!this.first) {
      this.first = t;
      t.el.classList.add("lm-tile--sel");
      sfxPop();
      return;
    }
    if (this.first === t) {
      t.el.classList.remove("lm-tile--sel");
      this.first = null;
      return;
    }
    const a = this.first;
    this.first = null;
    a.el.classList.remove("lm-tile--sel");
    const res = canConnect(this.grid, a.x, a.y, t.x, t.y);
    if (res.ok) {
      // 画路径
      this.drawPath(a, t, res.corners);
      this.grid[a.y]![a.x] = "";
      this.grid[t.y]![t.x] = "";
      a.el.classList.add("lm-tile--gone");
      t.el.classList.add("lm-tile--gone");
      const r = t.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.remaining -= 2;
      this.trackTimeout(() => {
        a.el.style.visibility = "hidden";
        t.el.style.visibility = "hidden";
      }, 250);
      if (this.remaining <= 0) {
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 800);
      }
    } else {
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private drawPath(a: Tile, b: Tile, corners: [number, number][]): void {
    const cs = 64;
    const pts: [number, number][] = [[a.x * cs + cs / 2, a.y * cs + cs / 2]];
    for (const [cx, cy] of corners) {
      pts.push([cx * cs + cs / 2, cy * cs + cs / 2]);
      // 外围拐点（cx/cy 为 -1 或 cols/rows）需映射到画布边缘
      const last = pts[pts.length - 1]!;
      if (cx === -1) last[0] = -10;
      if (cx === this.cols) last[0] = this.cols * cs + 10;
      if (cy === -1) last[1] = -10;
      if (cy === this.rows) last[1] = this.rows * cs + 10;
    }
    pts.push([b.x * cs + cs / 2, b.y * cs + cs / 2]);
    const line = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    );
    line.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
    line.classList.add("lm-line");
    this.svgEl.appendChild(line);
    this.trackTimeout(() => line.remove(), 400);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看能不能绕过去连～",
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
    if (document.getElementById("lm-style")) return;
    const st = document.createElement("style");
    st.id = "lm-style";
    st.textContent = LM_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function LM_CSS(theme: string): string {
  return `
.lm-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.lm-task{font-size:1.1rem;font-weight:800;}
.lm-board{position:relative;background:rgba(255,255,255,.5);border-radius:16px;padding:8px;box-shadow:var(--shadow);}
.lm-tile{position:absolute;width:56px;height:56px;margin:4px;font-size:1.8rem;border-radius:12px;background:#fff;box-shadow:var(--shadow);}
.lm-tile:active{transform:scale(.92);}
.lm-tile--sel{outline:4px solid ${theme};outline-offset:1px;}
.lm-tile--gone{animation:lm-pop .25s ease;}
.lm-svg{position:absolute;inset:8px;pointer-events:none;z-index:5;}
.lm-line{fill:none;stroke:${theme};stroke-width:4;stroke-linecap:round;stroke-linejoin:round;animation:lm-flash .4s ease forwards;}
@keyframes lm-pop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(.5);opacity:.3}}
@keyframes lm-flash{0%{opacity:1;stroke-width:6}100%{opacity:0;stroke-width:4}}
`;
}

export function create(): LinkMatchGame {
  return new LinkMatchGame();
}
