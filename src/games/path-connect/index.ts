/* 路径连通 Path Connect —— Flow Free 风格连线。
   网格上有若干彩色端点对（红-红、蓝-蓝…），孩子用手指拖动从一端画线连到同色另一端。
   所有连线不能交叉、不能压到别的端点。全部连好即通关。
   操作：从端点按下拖动画线，松开自动判定；连到同色另一端则成功固定该线。
   难度=端点对数+网格大小。easy 4轮 / medium 6轮 / hard 8轮。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

/** 配对端点 + 颜色。 */
interface Pair {
  id: number;
  color: string;
  emoji: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
}

const DIRS4: ReadonlyArray<[number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

const COLORS = [
  { hex: "#ff5252", emoji: "🔴" },
  { hex: "#4d96ff", emoji: "🔵" },
  { hex: "#6bcf7f", emoji: "🟢" },
  { hex: "#ffd93d", emoji: "🟡" },
  { hex: "#a55eea", emoji: "🟣" },
  { hex: "#ff9f43", emoji: "🟠" },
];

interface Puzzle {
  n: number;
  pairs: Pair[];
}

export class PathConnectGame extends BaseGame {
  constructor() {
    super("path-connect");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private n = 5;
  private pairs: Pair[] = [];
  /** 盘面：每个格子归哪一对（-1 空，-2 端点占位用 pair id 区分由 ownerMap）。 */
  private owner: number[][] = [];
  /** 已固定的路径：pair id → 路径坐标数组。 */
  private fixedPaths: Map<number, { x: number; y: number }[]> = new Map();
  private dragging: { pairId: number; path: { x: number; y: number }[] } | null =
    null;
  private unbindBoard: (() => void) | null = null;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbindBoard?.();
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    const pz = this.generate();
    this.n = pz.n;
    this.pairs = pz.pairs;
    this.fixedPaths = new Map();
    this.dragging = null;
    this.owner = Array.from({ length: this.n }, () =>
      Array.from({ length: this.n }, () => -1),
    );
    // 端点占位
    for (const p of this.pairs) {
      this.owner[p.a.y]![p.a.x] = p.id;
      this.owner[p.b.y]![p.b.x] = p.id;
    }
    this.render();
  }

  /** 生成保证可解的谜题：依次为每对放置一条不自交、不相交的随机路径。 */
  private generate(): Puzzle {
    const pairCount =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    const n =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 6 : 7;

    for (let attempt = 0; attempt < 600; attempt++) {
      const grid = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => -1),
      );
      const pairs: Pair[] = [];
      let ok = true;
      for (let pid = 0; pid < pairCount && ok; pid++) {
        // 选两个空格作为端点（保证有距离）
        const empties: [number, number][] = [];
        for (let y = 0; y < n; y++)
          for (let x = 0; x < n; x++)
            if (grid[y]![x] === -1) empties.push([x, y]);
        const remain = empties.length;
        // 留够余量给后续对
        if (remain < pairCount - pid + 1) {
          ok = false;
          break;
        }
        // 随机起点
        const [ax, ay] = empties[randInt(0, empties.length - 1)]!;
        // 用随机游走找一条路径到另一空格作为终点
        const path = this.randomWalk(grid, n, ax, ay, remain);
        if (!path || path.length < 3) {
          ok = false;
          break;
        }
        const end = path[path.length - 1]!;
        // 占用路径
        for (const pt of path) {
          grid[pt.y]![pt.x] = pid;
        }
        const col = COLORS[pid]!;
        pairs.push({
          id: pid,
          color: col.hex,
          emoji: col.emoji,
          a: { x: ax, y: ay },
          b: { x: end.x, y: end.y },
        });
      }
      if (!ok) continue;
      return { n, pairs };
    }
    // 兜底：极小关卡
    return {
      n: 5,
      pairs: [
        {
          id: 0,
          color: COLORS[0]!.hex,
          emoji: COLORS[0]!.emoji,
          a: { x: 0, y: 0 },
          b: { x: 4, y: 4 },
        },
      ],
    };
  }

  /** 从 (sx,sy) 出发随机游走，返回一条不重复占用格子的路径（含起点）。
   *  remain = 当前剩余空格数，用于把目标长度缩放到留有余量。 */
  private randomWalk(
    grid: number[][],
    n: number,
    sx: number,
    sy: number,
    remain: number,
  ): { x: number; y: number }[] | null {
    const visited = new Set<string>();
    const path: { x: number; y: number }[] = [{ x: sx, y: sy }];
    visited.add(`${sx},${sy}`);
    const minLen = 3;
    // 目标长度：剩余空间的一部分，夹在 [3,8]
    const desired = Math.min(Math.max(3, Math.floor(remain * 0.45)), 8);
    let cur = { x: sx, y: sy };
    let guard = 0;
    while (guard++ < 300) {
      const opts = shuffle(DIRS4.slice());
      let moved = false;
      for (const [dx, dy] of opts) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (grid[ny]![nx] !== -1) continue;
        // 移动
        path.push({ x: nx, y: ny });
        visited.add(key);
        cur = { x: nx, y: ny };
        moved = true;
        break;
      }
      if (!moved) break; // 走到死胡同
      // 路径达到期望长度后有概率停下作为终点
      if (path.length >= desired && Math.random() < 0.5) break;
      if (path.length >= desired + 3) break;
    }
    if (path.length < minLen) return null;
    return path;
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "ptc-wrap";

    const task = document.createElement("div");
    task.className = "ptc-task";
    task.innerHTML = `把<b>同色圆点</b>连起来，线不能交叉 <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const cell =
      this.n <= 5 ? 60 : this.n === 6 ? 52 : 46;
    const board = document.createElement("div");
    board.className = "ptc-board";
    board.id = "ptc-board";
    board.style.setProperty("--n", String(this.n));
    board.style.setProperty("--cell", `${cell}px`);
    board.style.width = `${this.n * (cell + 4) + 12}px`;
    board.style.height = `${this.n * (cell + 4) + 12}px`;

    // 背景格子
    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < this.n; x++) {
        const c = document.createElement("div");
        c.className = "ptc-cell";
        c.dataset.x = String(x);
        c.dataset.y = String(y);
        c.style.left = `${6 + x * (cell + 4)}px`;
        c.style.top = `${6 + y * (cell + 4)}px`;
        c.style.width = `${cell}px`;
        c.style.height = `${cell}px`;
        board.appendChild(c);
      }
    }
    // 端点
    for (const p of this.pairs) {
      for (const e of [p.a, p.b]) {
        const dot = document.createElement("div");
        dot.className = "ptc-dot";
        dot.textContent = p.emoji;
        dot.dataset.pair = String(p.id);
        dot.style.left = `${6 + e.x * (cell + 4)}px`;
        dot.style.top = `${6 + e.y * (cell + 4)}px`;
        dot.style.width = `${cell}px`;
        dot.style.height = `${cell}px`;
        dot.style.color = p.color;
        board.appendChild(dot);
      }
    }
    wrap.appendChild(board);

    const tip = document.createElement("div");
    tip.className = "ptc-tip";
    tip.id = "ptc-tip";
    this.updateTip(tip);
    wrap.appendChild(tip);

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "ptc-reset";
    reset.textContent = "↺ 清除连线";
    reset.addEventListener("click", () => {
      if (this.locked) return;
      this.fixedPaths.clear();
      this.owner = Array.from({ length: this.n }, () =>
        Array.from({ length: this.n }, () => -1),
      );
      for (const p of this.pairs) {
        this.owner[p.a.y]![p.a.x] = p.id;
        this.owner[p.b.y]![p.b.x] = p.id;
      }
      this.redrawLines();
      sfxPop();
    });
    wrap.appendChild(reset);

    this.root.appendChild(wrap);

    this.bindBoard(board, cell);
  }

  private updateTip(tip?: HTMLElement): void {
    const el = tip ?? this.root.querySelector("#ptc-tip");
    if (!el) return;
    const connected = this.fixedPaths.size;
    el.textContent = `已连通 ${connected} / ${this.pairs.length} 对`;
  }

  /** 绑定棋盘拖拽画线。 */
  private bindBoard(board: HTMLElement, cell: number): void {
    this.unbindBoard?.();
    const GAP = 4;
    const PAD = 6;
    const toCell = (cx: number, cy: number): { x: number; y: number } | null => {
      const r = board.getBoundingClientRect();
      const rx = cx - r.left - PAD;
      const ry = cy - r.top - PAD;
      const x = Math.floor(rx / (cell + GAP));
      const y = Math.floor(ry / (cell + GAP));
      if (x < 0 || y < 0 || x >= this.n || y >= this.n) return null;
      // 落点需在格子范围
      const fx = rx - x * (cell + GAP);
      const fy = ry - y * (cell + GAP);
      if (fx < 0 || fy < 0 || fx > cell || fy > cell) return null;
      return { x, y };
    };

    const onDown = (p: { x: number; y: number; id: number }): void => {
      if (this.locked) return;
      const c = toCell(p.x, p.y);
      if (!c) return;
      // 必须从某对端点开始
      const pid = this.owner[c.y]![c.x]!;
      if (pid < 0) return;
      const pair = this.pairs.find((q) => q.id === pid);
      if (!pair) return;
      // 起点：a 或 b 之一
      const start = c.x === pair.a.x && c.y === pair.a.y ? pair.a : pair.b;
      // 清掉该对既有路径（重画）
      if (this.fixedPaths.has(pid)) {
        this.clearFixed(pid);
      }
      this.dragging = { pairId: pid, path: [{ x: start.x, y: start.y }] };
      sfxPop();
      try {
        board.setPointerCapture(p.id);
      } catch {
        /* ignore */
      }
    };
    const onMove = (p: { x: number; y: number }): void => {
      if (!this.dragging) return;
      const c = toCell(p.x, p.y);
      if (!c) return;
      this.extendPath(c);
    };
    const onUp = (): void => {
      if (!this.dragging) return;
      const d = this.dragging;
      this.dragging = null;
      // 判定是否连到同色另一端
      const pair = this.pairs.find((q) => q.id === d.pairId)!;
      const last = d.path[d.path.length - 1]!;
      const other =
        pair.a.x === d.path[0]!.x && pair.a.y === d.path[0]!.y
          ? pair.b
          : pair.a;
      if (last.x === other.x && last.y === other.y && d.path.length >= 3) {
        // 成功固定
        this.commitPath(pair, d.path);
        this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
        this.resetWrongStreak();
        this.checkDone();
      } else {
        // 未连到另一端：撤回临时路径（拖动期间未修改 owner，直接重画即可）
        this.redrawLines();
      }
    };

    const down = (e: PointerEvent): void =>
      onDown({ x: e.clientX, y: e.clientY, id: e.pointerId });
    const move = (e: PointerEvent): void =>
      onMove({ x: e.clientX, y: e.clientY });
    const up = (): void => onUp();
    board.addEventListener("pointerdown", down);
    board.addEventListener("pointermove", move);
    board.addEventListener("pointerup", up);
    board.addEventListener("pointercancel", up);
    this.unbindBoard = () => {
      board.removeEventListener("pointerdown", down);
      board.removeEventListener("pointermove", move);
      board.removeEventListener("pointerup", up);
      board.removeEventListener("pointercancel", up);
    };
  }

  /** 把当前拖动路径延伸/收缩到 c。 */
  private extendPath(c: { x: number; y: number }): void {
    const d = this.dragging!;
    const path = d.path;
    const last = path[path.length - 1]!;
    // 回退：c 在路径中部 → 截断到 c
    const idx = path.findIndex((q) => q.x === c.x && q.y === c.y);
    if (idx >= 0 && idx < path.length - 1) {
      d.path = path.slice(0, idx + 1);
      this.redrawLines(d);
      return;
    }
    if (c.x === last.x && c.y === last.y) return; // 原地
    // 必须相邻
    if (Math.abs(c.x - last.x) + Math.abs(c.y - last.y) !== 1) return;
    const pair = this.pairs.find((q) => q.id === d.pairId)!;
    const start = path[0]!;
    const other =
      pair.a.x === start.x && pair.a.y === start.y ? pair.b : pair.a;
    const isOtherEnd = c.x === other.x && c.y === other.y;
    // 该格归属：必须空 或 是同对的另一端点
    const owner = this.owner[c.y]![c.x]!;
    if (owner !== -1 && !isOtherEnd) return;
    // 不能压到其它端点
    if (this.isForeignEnd(d.pairId, c)) return;
    path.push({ x: c.x, y: c.y });
    this.redrawLines(d);
  }

  private isForeignEnd(
    pairId: number,
    c: { x: number; y: number },
  ): boolean {
    for (const p of this.pairs) {
      if (p.id === pairId) continue;
      if (
        (p.a.x === c.x && p.a.y === c.y) ||
        (p.b.x === c.x && p.b.y === c.y)
      )
        return true;
    }
    return false;
  }

  /** 把一条路径固定下来（标记 owner）。 */
  private commitPath(pair: Pair, path: { x: number; y: number }[]): void {
    // 标记占用（端点保持 pair.id）
    for (const pt of path) {
      this.owner[pt.y]![pt.x] = pair.id;
    }
    this.fixedPaths.set(pair.id, path);
    this.redrawLines();
  }

  /** 清掉某对的固定路径（恢复占用）。 */
  private clearFixed(pairId: number): void {
    const path = this.fixedPaths.get(pairId);
    if (!path) return;
    for (const pt of path) {
      // 不清端点
      const pair = this.pairs.find((q) => q.id === pairId)!;
      if (
        (pt.x === pair.a.x && pt.y === pair.a.y) ||
        (pt.x === pair.b.x && pt.y === pair.b.y)
      )
        continue;
      this.owner[pt.y]![pt.x] = -1;
    }
    this.fixedPaths.delete(pairId);
  }

  /** 重画所有连线（fixed + 可选 temp）。 */
  private redrawLines(temp?: { pairId: number; path: { x: number; y: number }[] }): void {
    const board = this.root.querySelector("#ptc-board");
    if (!board) return;
    // 移除旧线条
    board.querySelectorAll(".ptc-line").forEach((el) => el.remove());
    const pairs = new Map(this.pairs.map((p) => [p.id, p]));
    const draw = (pairId: number, path: { x: number; y: number }[]): void => {
      const pair = pairs.get(pairId);
      if (!pair) return;
      for (let i = 0; i < path.length; i++) {
        const pt = path[i]!;
        // 端点格不画方块（让 dot 显现），但中间格画
        const isEnd =
          (pt.x === pair.a.x && pt.y === pair.a.y) ||
          (pt.x === pair.b.x && pt.y === pair.b.y);
        if (isEnd) continue;
        const seg = document.createElement("div");
        seg.className = "ptc-line";
        seg.style.left = `calc(6px + ${pt.x} * (var(--cell) + 4px))`;
        seg.style.top = `calc(6px + ${pt.y} * (var(--cell) + 4px))`;
        seg.style.width = "var(--cell)";
        seg.style.height = "var(--cell)";
        seg.style.background = pair.color;
        board.appendChild(seg);
      }
    };
    this.fixedPaths.forEach((path, id) => draw(id, path));
    if (temp) draw(temp.pairId, temp.path);
  }

  private checkDone(): void {
    if (this.fixedPaths.size === this.pairs.length) {
      this.locked = true;
      const board = this.root.querySelector("#ptc-board");
      board?.classList.add("ptc-board--win");
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    }
    this.updateTip();
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🔗",
      variant: "rest",
      body: "想想线该怎么绕，让每对同色点连起来、又不交叉～",
      primary: { text: "继续", icon: "🔗", onClick: () => ov.destroy() },
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
    if (document.getElementById("ptc-style")) return;
    const st = document.createElement("style");
    st.id = "ptc-style";
    st.textContent = PTC_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function PTC_CSS(theme: string): string {
  return `
.ptc-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;}
.ptc-task{font-size:1.05rem;font-weight:800;text-align:center;color:var(--ink);background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ptc-task b{color:${theme};}
.ptc-task small{color:var(--ink-soft);font-weight:700;font-size:.82rem;margin-left:6px;}
.ptc-board{position:relative;background:linear-gradient(160deg,#f0f4ff,#dbe7ff);border-radius:18px;box-shadow:var(--shadow-lg);touch-action:none;}
.ptc-board--win{animation:ptc-yes .6s ease;}
@keyframes ptc-yes{0%{transform:scale(1)}50%{transform:scale(1.04)}100%{transform:scale(1)}}
.ptc-cell{position:absolute;border:1px dashed rgba(77,150,255,.2);border-radius:6px;background:rgba(255,255,255,.3);}
.ptc-line{position:absolute;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.15);opacity:.85;z-index:2;}
.ptc-dot{position:absolute;display:flex;align-items:center;justify-content:center;font-size:calc(var(--cell) * .5);z-index:5;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));}
.ptc-tip{font-size:.95rem;font-weight:800;color:var(--ink);}
.ptc-reset{font-size:.9rem;font-weight:700;color:var(--ink);background:rgba(255,255,255,.7);border:none;padding:8px 18px;border-radius:999px;cursor:pointer;box-shadow:var(--shadow);}
.ptc-reset:active{transform:scale(.95);}
@media (max-width:380px){}
`;
}

export function create(): PathConnectGame {
  return new PathConnectGame();
}
