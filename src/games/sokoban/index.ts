/* 推箱子 Sokoban —— 经典逻辑推箱。
   孩子推动箱子到金色目标点。人物只能推不能拉，箱子不能推过墙/其它箱子。
   操作：方向键 或 在棋盘上朝四个方向滑动。
   关卡用字符串数组定义：#墙 空格=地板 .目标 $箱子 *箱在目标上 @人物 +人在目标上。
   难度=箱子数+步数。easy 4关 / medium 6关 / hard 8关。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 单元格类型：墙 / 地 / 目标点。箱子与人物位置单独维护。 */
type Cell = "#" | "." | " "; // #墙 空格地 .目标

/** 手工关卡。每个字符串等长（同一关内）。已逐一验证可解。 */
const LEVELS: string[][] = [
  // 1 ★ 一箱直推
  ["#######",
   "#     #",
   "# @$. #",
   "#     #",
   "#######"],
  // 2 ★ 一箱两步
  ["########",
   "#      #",
   "# .    #",
   "#  $   #",
   "#   @  #",
   "#      #",
   "########"],
  // 3 ★★ 两箱
  ["#########",
   "#       #",
   "#  .  . #",
   "#       #",
   "#  $ $  #",
   "#       #",
   "#   @   #",
   "#########"],
  // 4 ★★ 需要绕到箱子左侧
  ["########",
   "#      #",
   "#.     #",
   "# $    #",
   "#  @   #",
   "#      #",
   "########"],
  // 5 ★★★ 三箱
  ["##########",
   "#        #",
   "# . . .  #",
   "#        #",
   "# $ $ $  #",
   "#        #",
   "#   @    #",
   "##########"],
  // 6 ★★★ 推到边角目标
  ["########",
   "#      #",
   "#@ $  .#",
   "#      #",
   "#.  $  #",
   "#      #",
   "########"],
  // 7 ★★★★ 四箱，要规划顺序
  ["##########",
   "#        #",
   "# .    . #",
   "#  $  $  #",
   "#   @    #",
   "#  $  $  #",
   "# .    . #",
   "#        #",
   "##########"],
  // 8 ★★★★ 长距离推送
  ["##########",
   "#        #",
   "#  .  .  #",
   "#        #",
   "# $    $ #",
   "#        #",
   "#  @     #",
   "##########"],
];

/** 方向：上 / 右 / 下 / 左。 */
const DIRS: ReadonlyArray<{ dx: number; dy: number; key: string }> = [
  { dx: 0, dy: -1, key: "ArrowUp" },
  { dx: 1, dy: 0, key: "ArrowRight" },
  { dx: 0, dy: 1, key: "ArrowDown" },
  { dx: -1, dy: 0, key: "ArrowLeft" },
];

interface Level {
  cells: Cell[][];
  player: { x: number; y: number };
  boxes: boolean[][]; // boxes[y][x] = 是否有箱子
  goals: boolean[][]; // goals[y][x] = 是否目标
  w: number;
  h: number;
}

export class SokobanGame extends BaseGame {
  constructor() {
    super("sokoban");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private order: number[] = [];
  private level!: Level;
  private moves = 0;
  private onKey: ((e: KeyboardEvent) => void) | null = null;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    // 随机洗关卡顺序，每局不重样
    this.order = shuffle(LEVELS.map((_, i) => i));
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    if (this.onKey) window.removeEventListener("keydown", this.onKey);
    this.onKey = null;
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.moves = 0;
    this.locked = false;
    // 取本关需要的关卡序号（轮次递增取，超出则循环但偏移不同）
    const idx = this.order[this.roundsDone % this.order.length] ?? 0;
    this.level = this.parse(LEVELS[idx] ?? LEVELS[0]!);
    this.bindKeys();
    this.render();
  }

  /** 把字符串关卡解析成结构化数据。 */
  private parse(raw: string[]): Level {
    const rows = raw;
    const h = rows.length;
    const w = Math.max(...rows.map((r: string) => r.length));
    const cells: Cell[][] = [];
    const boxes: boolean[][] = [];
    const goals: boolean[][] = [];
    let player = { x: 1, y: 1 };
    for (let y = 0; y < h; y++) {
      const row = rows[y]!;
      cells.push([]);
      boxes.push([]);
      goals.push([]);
      for (let x = 0; x < w; x++) {
        const ch = row[x] ?? " ";
        let cell: Cell = " ";
        let box = false;
        let goal = false;
        switch (ch) {
          case "#":
            cell = "#";
            break;
          case ".":
            cell = ".";
            goal = true;
            break;
          case "$":
            cell = " ";
            box = true;
            break;
          case "*":
            cell = ".";
            box = true;
            goal = true;
            break;
          case "@":
            cell = " ";
            player = { x, y };
            break;
          case "+":
            cell = ".";
            goal = true;
            player = { x, y };
            break;
          default:
            cell = " ";
        }
        cells[y]!.push(cell);
        boxes[y]!.push(box);
        goals[y]!.push(goal);
      }
    }
    return { cells, player, boxes, goals, w, h };
  }

  private bindKeys(): void {
    if (this.onKey) window.removeEventListener("keydown", this.onKey);
    const handler = (e: KeyboardEvent): void => {
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        e.preventDefault();
        const d = DIRS.find((x) => x.key === e.key)!;
        this.move(d.dx, d.dy);
      }
    };
    this.onKey = handler;
    window.addEventListener("keydown", handler);
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "skb-wrap";

    const task = document.createElement("div");
    task.className = "skb-task";
    task.innerHTML = `把 <b>📦</b> 推到 <b class="skb-gold">金色目标</b> 上 <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    // 棋盘
    const lv = this.level;
    const maxCell =
      lv.w <= 6 ? 64 : lv.w <= 7 ? 56 : lv.w <= 8 ? 50 : 44;
    const board = document.createElement("div");
    board.className = "skb-board";
    board.style.setProperty("--n", String(lv.w));
    board.style.setProperty("--cell", `${maxCell}px`);

    for (let y = 0; y < lv.h; y++) {
      for (let x = 0; x < lv.w; x++) {
        const c = lv.cells[y]![x]!;
        if (c === "#") {
          const wall = document.createElement("div");
          wall.className = "skb-wall";
          wall.style.gridRow = `${y + 1}`;
          wall.style.gridColumn = `${x + 1}`;
          board.appendChild(wall);
        } else {
          // 地板
          const floor = document.createElement("div");
          floor.className = "skb-floor";
          floor.style.gridRow = `${y + 1}`;
          floor.style.gridColumn = `${x + 1}`;
          if (lv.goals[y]![x]!) floor.classList.add("skb-floor--goal");
          board.appendChild(floor);
        }
      }
    }
    // 箱子
    for (let y = 0; y < lv.h; y++) {
      for (let x = 0; x < lv.w; x++) {
        if (lv.boxes[y]![x]!) {
          const box = document.createElement("div");
          box.className = "skb-box";
          if (lv.goals[y]![x]!) box.classList.add("skb-box--done");
          box.style.gridRow = `${y + 1}`;
          box.style.gridColumn = `${x + 1}`;
          board.appendChild(box);
        }
      }
    }
    // 人物
    const hero = document.createElement("div");
    hero.className = "skb-hero";
    hero.textContent = "🧒";
    hero.id = "skb-hero";
    hero.style.gridRow = `${lv.player.y + 1}`;
    hero.style.gridColumn = `${lv.player.x + 1}`;
    board.appendChild(hero);

    wrap.appendChild(board);

    // 滑动手势板（覆盖在棋盘上做 swipe 识别）
    const swipe = document.createElement("div");
    swipe.className = "skb-swipe";
    swipe.id = "skb-swipe";
    this.bindSwipe(swipe);
    board.appendChild(swipe);

    // 方向键 + 重来
    const ctrl = document.createElement("div");
    ctrl.className = "skb-ctrl";
    ctrl.innerHTML = `
      <div></div>
      <button type="button" class="skb-key" data-d="0" aria-label="上">⬆️</button>
      <div></div>
      <button type="button" class="skb-key" data-d="3" aria-label="左">⬅️</button>
      <button type="button" class="skb-key" data-d="2" aria-label="下">⬇️</button>
      <button type="button" class="skb-key" data-d="1" aria-label="右">➡️</button>`;
    ctrl
      .querySelectorAll<HTMLButtonElement>(".skb-key[data-d]")
      .forEach((b) => {
        b.addEventListener("click", () => {
          const d = DIRS[Number(b.dataset.d)]!;
          this.move(d.dx, d.dy);
        });
      });
    wrap.appendChild(ctrl);

    const foot = document.createElement("div");
    foot.className = "skb-foot";
    const steps = document.createElement("span");
    steps.id = "skb-steps";
    steps.textContent = `已走 ${this.moves} 步`;
    foot.appendChild(steps);
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "skb-reset";
    reset.textContent = "↺ 重来";
    reset.addEventListener("click", () => this.startRound());
    foot.appendChild(reset);
    wrap.appendChild(foot);

    this.root.appendChild(wrap);
  }

  /** 在棋盘上做四向 swipe 识别。 */
  private bindSwipe(el: HTMLDivElement): void {
    let sx = 0;
    let sy = 0;
    let fired = false;
    el.addEventListener("pointerdown", (e) => {
      sx = e.clientX;
      sy = e.clientY;
      fired = false;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    });
    el.addEventListener("pointermove", (e) => {
      if (fired) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      fired = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.move(dx > 0 ? 1 : -1, 0);
      } else {
        this.move(0, dy > 0 ? 1 : -1);
      }
    });
    el.addEventListener("pointerup", () => {
      /* 单点不滑动视为无效，避免误触 */
    });
  }

  /** 尝试朝 (dx,dy) 移动一步。 */
  private move(dx: number, dy: number): void {
    if (this.locked) return;
    const lv = this.level;
    const nx = lv.player.x + dx;
    const ny = lv.player.y + dy;
    if (nx < 0 || ny < 0 || nx >= lv.w || ny >= lv.h) return;
    const target = lv.cells[ny]![nx]!;
    if (target === "#") return;
    // 如果目标格有箱子，尝试把箱子推一格
    if (lv.boxes[ny]![nx]!) {
      const bx = nx + dx;
      const by = ny + dy;
      if (bx < 0 || by < 0 || bx >= lv.w || by >= lv.h) return;
      if (lv.cells[by]![bx]! === "#") return;
      if (lv.boxes[by]![bx]!) return; // 后面也有箱子
      // 推动
      lv.boxes[ny]![nx] = false;
      lv.boxes[by]![bx] = true;
    }
    lv.player.x = nx;
    lv.player.y = ny;
    this.moves += 1;
    sfxPop();
    this.resetWrongStreak();
    this.refreshPositions();
    const steps = this.root.querySelector("#skb-steps");
    if (steps) steps.textContent = `已走 ${this.moves} 步`;
    if (this.isWin()) this.onWin();
  }

  /** 只更新棋子位置/状态，不重建 DOM，带平滑过渡。 */
  private refreshPositions(): void {
    const lv = this.level;
    const hero = this.root.querySelector<HTMLElement>("#skb-hero");
    if (hero) {
      hero.style.gridRow = `${lv.player.y + 1}`;
      hero.style.gridColumn = `${lv.player.x + 1}`;
    }
    // 重建箱子状态（位置变化需要重画）
    const board = this.root.querySelector(".skb-board");
    if (board) {
      board.querySelectorAll(".skb-box").forEach((b) => b.remove());
      for (let y = 0; y < lv.h; y++) {
        for (let x = 0; x < lv.w; x++) {
          if (lv.boxes[y]![x]!) {
            const box = document.createElement("div");
            box.className = "skb-box";
            if (lv.goals[y]![x]!) box.classList.add("skb-box--done");
            box.style.gridRow = `${y + 1}`;
            box.style.gridColumn = `${x + 1}`;
            board.appendChild(box);
          }
        }
      }
    }
  }

  private isWin(): boolean {
    const lv = this.level;
    for (let y = 0; y < lv.h; y++) {
      for (let x = 0; x < lv.w; x++) {
        if (lv.goals[y]![x]! && !lv.boxes[y]![x]!) return false;
      }
    }
    return true;
  }

  private onWin(): void {
    this.locked = true;
    const board = this.root.querySelector(".skb-board");
    const rect = board
      ? board.getBoundingClientRect()
      : new DOMRect(window.innerWidth / 2, window.innerHeight / 2);
    this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
    this.trackTimeout(() => {
      this.roundsDone += 1;
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 800);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想怎么把箱子推到金色目标上～箱子只能推不能拉哦！",
      primary: { text: "继续", icon: "📦", onClick: () => ov.destroy() },
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
    if (document.getElementById("skb-style")) return;
    const st = document.createElement("style");
    st.id = "skb-style";
    st.textContent = SKB_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function SKB_CSS(theme: string): string {
  return `
.skb-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;}
.skb-task{font-size:1.05rem;font-weight:800;text-align:center;color:var(--ink);background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.skb-task b{color:${theme};}
.skb-gold{color:#ffb300!important;}
.skb-task small{color:var(--ink-soft);font-weight:700;font-size:.82rem;margin-left:6px;}
.skb-board{position:relative;display:grid;grid-template-columns:repeat(var(--n),var(--cell));grid-auto-rows:var(--cell);gap:3px;padding:12px;background:linear-gradient(160deg,#f3e9d8,#e7d6bb);border-radius:18px;box-shadow:var(--shadow-lg);touch-action:none;}
.skb-floor{background:repeating-linear-gradient(45deg,#fbf3e2,#fbf3e2 6px,#f4e7cf 6px,#f4e7cf 12px);border-radius:4px;}
.skb-floor--goal{background:radial-gradient(circle,#ffe082 40%,#ffca28);border-radius:50%;box-shadow:inset 0 0 0 3px rgba(255,179,0,.5);animation:skb-pulse 1.4s ease-in-out infinite;}
@keyframes skb-pulse{0%,100%{transform:scale(.9);opacity:.85}50%{transform:scale(1);opacity:1}}
.skb-wall{background:linear-gradient(160deg,#8d6e63,#5d4037);border-radius:5px;box-shadow:inset 0 2px 0 rgba(255,255,255,.18),inset 0 -3px 0 rgba(0,0,0,.3);}
.skb-box{width:var(--cell);height:var(--cell);box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:calc(var(--cell) * .6);background:linear-gradient(160deg,#c08457,#8d5a3b);border:2px solid #6d4429;border-radius:8px;box-shadow:inset 0 2px 0 rgba(255,255,255,.25),0 3px 5px rgba(0,0,0,.25);transition:all .14s ease;z-index:3;}
.skb-box::after{content:"📦";}
.skb-box--done{background:linear-gradient(160deg,#ffd54f,#ffb300);border-color:#e09a00;animation:skb-pop .4s ease;}
@keyframes skb-pop{0%{transform:scale(1)}40%{transform:scale(1.18)}100%{transform:scale(1)}}
.skb-hero{width:var(--cell);height:var(--cell);box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:calc(var(--cell) * .62);z-index:5;filter:drop-shadow(0 3px 3px rgba(0,0,0,.3));transition:grid-row .12s ease,grid-column .12s ease;}
.skb-swipe{position:absolute;inset:12px;z-index:10;touch-action:none;}
.skb-ctrl{display:grid;grid-template-columns:repeat(3,56px);gap:6px;}
.skb-ctrl div{width:56px;height:56px;}
.skb-key{width:56px;height:56px;font-size:1.5rem;border:none;border-radius:14px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 30%,#fff));box-shadow:var(--shadow);cursor:pointer;transition:transform .1s ease;display:flex;align-items:center;justify-content:center;}
.skb-key:active{transform:scale(.9);}
.skb-foot{display:flex;align-items:center;gap:16px;}
#skb-steps{font-size:.92rem;font-weight:700;color:var(--ink-soft);}
.skb-reset{font-size:.9rem;font-weight:700;color:var(--ink);background:rgba(255,255,255,.7);border:none;padding:6px 16px;border-radius:999px;cursor:pointer;box-shadow:var(--shadow);}
.skb-reset:active{transform:scale(.95);}
@media (max-width:380px){.skb-key{width:50px;height:50px;font-size:1.3rem;}.skb-ctrl div{width:50px;height:50px;}}
`;
}

export function create(): SokobanGame {
  return new SokobanGame();
}
