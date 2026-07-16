/* 电路连通 Circuit —— 电池与灯泡之间是一段段「断开的电线」，
   点击旋转每段电线（横/竖/弯头）使电路连通，连通后灯泡亮起。
   独特点：电池 + 灯泡 + 电线段，连通瞬间电流流动 + 灯泡发光脉冲。
   巧思：用「每格 4 向开口位掩码 + 旋转」表示电线；BFS 判断从电池到灯泡是否贯通。
   难度=网格大小。通关=连通电路让灯亮。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar } from "../../lobby/util.ts";

// 每种电线在 rotation=0 时的开口位掩码（1=上,2=右,4=下,8=左）
const U = 1;
const R = 2;
const D = 4;
const L = 8;
type PipeKind = "h" | "v" | "tr" | "tl" | "br" | "bl";
// 基础开口（0 度）
const BASE_OPEN: Record<PipeKind, number> = {
  h: L | R, // 横管：左右
  v: U | D, // 竖管：上下
  tr: D | R, // ┗ 形：下+右（左上角弯）
  tl: D | L, // ┛ 形：下+左（右上角弯）
  br: U | R, // ┏ 形：上+右（左下角弯）
  bl: U | L, // ┓ 形：上+左（右下角弯）
};

interface Cell {
  kind: PipeKind | "battery" | "bulb" | "empty";
  rot: number; // 0/90/180/270，仅 pipe 有效
}

export class CircuitGame extends BaseGame {
  constructor() {
    super("circuit");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  /** 过渡锁：lightUp 动画期间禁止再点击，防跳关。 */
  private busy = false;
  private grid: Cell[][] = [];
  private rows = 0;
  private cols = 0;
  /** 电池位置 */
  private battery = { x: 0, y: 0 };
  /** 电池开口位掩码（由 layoutSolution 决定） */
  private batteryOpen = R;
  /** 灯泡位置 */
  private bulb = { x: 0, y: 0 };
  /** 灯泡开口位掩码（由 layoutSolution 决定） */
  private bulbOpen = L;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private size(): { rows: number; cols: number } {
    return this.difficulty === "easy"
      ? { rows: 1, cols: 3 }
      : this.difficulty === "medium"
        ? { rows: 2, cols: 3 }
        : { rows: 3, cols: 3 };
  }

  private startRound(): void {
    this.busy = false; // 解除过渡锁
    this.root.innerHTML = "";
    const { rows, cols } = this.size();
    this.rows = rows;
    this.cols = cols;

    // 电池固定在左侧，灯泡固定在右侧；中间是电线网格
    // 整体逻辑网格 = cols 列：第 0 列电池，最后一列灯泡，中间管道
    this.battery = { x: 0, y: 0 };
    this.bulb = { x: cols - 1, y: rows - 1 };

    // 构造 grid：每格 cell
    this.grid = [];
    for (let y = 0; y < rows; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < cols; x++) {
        if (x === 0 && y === 0) {
          row.push({ kind: "battery", rot: 0 });
        } else if (x === cols - 1 && y === rows - 1) {
          row.push({ kind: "bulb", rot: 0 });
        } else {
          // 先放一条「正确路径」上的管道（电池→灯泡的一条通路）
          row.push({ kind: "h", rot: 0 });
        }
      }
      this.grid.push(row);
    }

    // 构造一条解路径：从 (0,0) 走到 (cols-1, rows-1)，
    // 沿路给每格赋予「正确」的管道类型与朝向；其余格给随机管道。
    this.layoutSolution();
    // 把所有管道随机旋转打乱
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const c = this.grid[y]![x]!;
        if (isPipe(c.kind)) {
          c.rot = ([0, 90, 180, 270] as const)[Math.floor(Math.random() * 4)]!;
        }
      }
    }

    const wrap = document.createElement("div");
    wrap.className = "cr-wrap";

    const task = document.createElement("div");
    task.className = "cr-task";
    task.innerHTML = `点击电线转方向，把 <b>🔋电池</b> 和 <b>💡灯泡</b> 连起来！<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 关</small>`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "cr-board";
    board.style.setProperty("--cols", String(cols));
    board.style.setProperty("--rows", String(rows));

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const c = this.grid[y]![x]!;
        const el = document.createElement("div");
        el.className = "cr-cell";
        el.dataset.x = String(x);
        el.dataset.y = String(y);
        const inner = document.createElement("div");
        inner.className = "cr-cell__inner";
        if (c.kind === "battery") {
          el.classList.add("cr-cell--battery");
          inner.innerHTML = "🔋";
        } else if (c.kind === "bulb") {
          el.classList.add("cr-cell--bulb");
          inner.innerHTML = "💡";
        } else {
          el.classList.add("cr-cell--pipe");
          inner.innerHTML = this.pipeSVG(c.kind as PipeKind);
          inner.style.transform = `rotate(${c.rot}deg)`;
          el.addEventListener("click", () => this.rotate(x, y));
        }
        el.appendChild(inner);
        board.appendChild(el);
      }
    }
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  /** 在 grid 上铺一条解路径，并设置正确的管道类型/朝向 */
  private layoutSolution(): void {
    // 简单策略：先沿 x 走到目标列，再沿 y 走到目标行（L 形路径）
    const path: { x: number; y: number }[] = [];
    let cx = 0;
    let cy = 0;
    path.push({ x: cx, y: cy });
    // 先向右走到 bulb 列
    while (cx < this.bulb.x) {
      cx++;
      path.push({ x: cx, y: cy });
    }
    // 再向下走到 bulb 行
    while (cy < this.bulb.y) {
      cy++;
      path.push({ x: cx, y: cy });
    }

    // 电池开口 = 第一段从电池离开的方向（电池 → path[1]）
    this.batteryOpen = dirFromTo(path[0]!, path[1]!);
    // 灯泡开口 = 最后一段进入灯泡的方向（来自倒数第二个 → 灯泡）
    this.bulbOpen = dirFromTo(path[path.length - 1]!, path[path.length - 2]!);

    // 给路径上中间格（非电池/灯泡）分配正确管道
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1]!;
      const cur = path[i]!;
      const next = path[i + 1]!;
      const inDir = dirFromTo(cur, prev); // 进入方向（来自 prev）
      const outDir = dirFromTo(cur, next); // 离开方向（去 next）
      const { kind, rot } = pickPipe(inDir, outDir);
      this.grid[cur.y]![cur.x] = { kind, rot };
    }
    // 路径外的中间格随机放一个管道（解谜时只是干扰/可不动）
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const c = this.grid[y]![x]!;
        if (isPipe(c.kind)) {
          const onPath = path.some((p) => p.x === x && p.y === y);
          if (!onPath) {
            const kinds: PipeKind[] = ["h", "v", "tr", "tl", "br", "bl"];
            this.grid[y]![x] = {
              kind: kinds[Math.floor(Math.random() * kinds.length)]!,
              rot: 0,
            };
          } else {
            // 路径上的也记下「正确朝向」（rot 已由 pickPipe 设好）
          }
        }
      }
    }
  }

  private rotate(x: number, y: number): void {
    const c = this.grid[y]![x]!;
    if (!isPipe(c.kind)) return;
    if (this.busy) return; // 过渡锁：动画期间禁止操作
    c.rot = (c.rot + 90) % 360;
    sfxPop();
    const el = this.root.querySelector<HTMLElement>(
      `.cr-cell[data-x="${x}"][data-y="${y}"] .cr-cell__inner`,
    );
    if (el) el.style.transform = `rotate(${c.rot}deg)`;
    this.resetWrongStreak();
    if (this.isConnected()) {
      this.lightUp();
    }
  }

  /** 计算某格旋转后的开口位掩码 */
  private openMask(x: number, y: number): number {
    const c = this.grid[y]![x]!;
    if (c.kind === "battery") return this.batteryOpen;
    if (c.kind === "bulb") return this.bulbOpen;
    const base = BASE_OPEN[c.kind as PipeKind];
    return rotateMask(base, c.rot);
  }

  /** BFS：从电池能否到达灯泡，且每一步开口对接 */
  private isConnected(): boolean {
    const seen = new Set<string>();
    const stack: { x: number; y: number }[] = [this.battery];
    seen.add(`${this.battery.x},${this.battery.y}`);
    while (stack.length) {
      const cur = stack.pop()!;
      const mask = this.openMask(cur.x, cur.y);
      const dirs: { dx: number; dy: number; bit: number; opp: number }[] = [
        { dx: 0, dy: -1, bit: U, opp: D },
        { dx: 1, dy: 0, bit: R, opp: L },
        { dx: 0, dy: 1, bit: D, opp: U },
        { dx: -1, dy: 0, bit: L, opp: R },
      ];
      for (const d of dirs) {
        if (!(mask & d.bit)) continue;
        const nx = cur.x + d.dx;
        const ny = cur.y + d.dy;
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        const nmask = this.openMask(nx, ny);
        if (!(nmask & d.opp)) continue; // 邻格对应方向也需开口
        seen.add(key);
        if (nx === this.bulb.x && ny === this.bulb.y) return true;
        stack.push({ x: nx, y: ny });
      }
    }
    return false;
  }

  private lightUp(): void {
    this.busy = true; // 锁定，动画期间禁止操作
    // 全部管道加 flow 类，灯泡加 on
    const board = this.root.querySelector(".cr-board");
    board?.querySelectorAll(".cr-cell").forEach((el) => {
      el.classList.add("cr-cell--energized");
    });
    const bulbCell = this.root.querySelector(".cr-cell--bulb");
    bulbCell?.classList.add("cr-cell--bulbOn");
    const r = bulbCell?.getBoundingClientRect();
    if (r) {
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    } else {
      this.onCorrect();
    }
    this.roundsDone += 1;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(3);
      } else {
        this.startRound();
      }
    }, 1500);
  }

  /** 生成管道 SVG（0 度基础形态） */
  private pipeSVG(kind: PipeKind): string {
    const stroke = "url(#cr-wire)";
    const defs =
      '<defs><linearGradient id="cr-wire" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#9aa6d4"/><stop offset="1" stop-color="#5b6bd6"/>' +
      "</linearGradient></defs>";
    const w =
      'stroke="' +
      stroke +
      '" stroke-width="14" fill="none" stroke-linecap="round"';
    const node = '<circle cx="50" cy="50" r="9" fill="#5b6bd6"/>';
    switch (kind) {
      case "h":
        return svg(defs, `<line x1="6" y1="50" x2="94" y2="50" ${w}/>` + node);
      case "v":
        return svg(defs, `<line x1="50" y1="6" x2="50" y2="94" ${w}/>` + node);
      case "tr": // 下+右
        return svg(defs, `<path d="M50 94 L50 50 L94 50" ${w}/>` + node);
      case "tl": // 下+左
        return svg(defs, `<path d="M50 94 L50 50 L6 50" ${w}/>` + node);
      case "br": // 上+右
        return svg(defs, `<path d="M50 6 L50 50 L94 50" ${w}/>` + node);
      case "bl": // 上+左
        return svg(defs, `<path d="M50 6 L50 50 L6 50" ${w}/>` + node);
      default:
        return "";
    }
  }

  private injectStyle(): void {
    if (document.getElementById("cr-style")) return;
    const st = document.createElement("style");
    st.id = "cr-style";
    st.textContent = CR_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function svg(defs: string, body: string): string {
  return `<svg viewBox="0 0 100 100" width="100%" height="100%">${defs}${body}</svg>`;
}

function isPipe(kind: Cell["kind"]): kind is PipeKind {
  return (
    kind === "h" ||
    kind === "v" ||
    kind === "tr" ||
    kind === "tl" ||
    kind === "br" ||
    kind === "bl"
  );
}

/** 从 a 到 b 的方向位（基于曼哈顿邻接） */
function dirFromTo(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  if (b.y < a.y) return U;
  if (b.x > a.x) return R;
  if (b.y > a.y) return D;
  return L;
}

/** 旋转位掩码：每 90° 顺时针，U→R→D→L→U */
function rotateMask(mask: number, rot: number): number {
  const steps = (((rot % 360) + 360) % 360) / 90;
  let m = mask;
  for (let i = 0; i < steps; i++) {
    let n = 0;
    if (m & U) n |= R;
    if (m & R) n |= D;
    if (m & D) n |= L;
    if (m & L) n |= U;
    m = n;
  }
  return m;
}

/** 给定进入方向（来自）与离开方向（去），选合适的管道类型 + 0 度基础朝向
 *  返回的 rot 让 BASE_OPEN 经 rotateMask 后 = inDir|outDir */
function pickPipe(
  inDir: number,
  outDir: number,
): {
  kind: PipeKind;
  rot: number;
} {
  const target = inDir | outDir;
  // 候选基础形态 + 旋转，找到 rotateMask(BASE,rot)==target
  const kinds: PipeKind[] = ["h", "v", "tr", "tl", "br", "bl"];
  const rots = [0, 90, 180, 270];
  for (const k of kinds) {
    for (const r of rots) {
      if (rotateMask(BASE_OPEN[k], r) === target) {
        return { kind: k, rot: r };
      }
    }
  }
  return { kind: "h", rot: 0 };
}

function CR_CSS(theme: string): string {
  return `
.cr-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.cr-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.7;color:var(--ink);}
.cr-task b{color:${theme};}
.cr-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.cr-board{display:grid;grid-template-columns:repeat(var(--cols,3),1fr);grid-template-rows:repeat(var(--rows,1),1fr);gap:6px;padding:16px;background:linear-gradient(180deg,#1b2350,#0b1026);border-radius:22px;box-shadow:var(--shadow-lg);}
.cr-cell{width:92px;height:92px;border-radius:14px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;position:relative;}
.cr-cell--battery,.cr-cell--bulb{font-size:2.4rem;background:rgba(255,255,255,.1);box-shadow:inset 0 0 12px rgba(255,255,255,.1);}
.cr-cell--pipe{cursor:pointer;}
.cr-cell--pipe:hover{background:rgba(255,255,255,.12);}
.cr-cell__inner{width:100%;height:100%;display:flex;align-items:center;justify-content:center;transition:transform .22s cubic-bezier(.34,1.56,.64,1);font-size:2.4rem;}
.cr-cell--energized .cr-cell__inner{filter:drop-shadow(0 0 6px #ffd84d);}
.cr-cell--energized.cr-cell--pipe .cr-cell__inner svg line,
.cr-cell--energized.cr-cell--pipe .cr-cell__inner svg path{stroke:${theme} !important;animation:cr-flow 1s linear infinite;}
@keyframes cr-flow{0%{filter:brightness(1) drop-shadow(0 0 4px #ffe89a)}50%{filter:brightness(1.5) drop-shadow(0 0 10px #fff)}100%{filter:brightness(1) drop-shadow(0 0 4px #ffe89a)}}
.cr-cell--bulbOn{background:radial-gradient(circle,#fff7c0,#ffd84d 70%);animation:cr-bulb .9s ease-in-out infinite;box-shadow:0 0 24px #ffd84d;}
@keyframes cr-bulb{0%,100%{transform:scale(1);box-shadow:0 0 20px #ffd84d}50%{transform:scale(1.08);box-shadow:0 0 36px #fff3a0}}
.cr-cell--bulbOn .cr-cell__inner{filter:drop-shadow(0 0 8px #fff);}
`;
}

export function create(): CircuitGame {
  return new CircuitGame();
}
