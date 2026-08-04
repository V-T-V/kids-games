/* 移车出库 Traffic Jam —— 简化版华容道。
   红车要从右边的出口驶出，但路上被其它车挡住了。点一辆车，它会沿自己
   能动的方向（横着或竖着）滑一格；把挡路的车全挪开，红车就能出去。
   简化为 3x3 网格，2-3 辆车，必可解。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByMoves } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

type Dir = "h" | "v"; // 横/竖

interface Car {
  id: number;
  /** 左上角坐标 */
  r: number;
  c: number;
  len: number;
  dir: Dir;
  color: string;
  emoji: string;
  red?: boolean;
}

/** 3x3 网格。红车固定在第一行，长度 2，朝右，要从 c=2 右侧出口驶出。 */
const GRID = 3;
const CAR_EMOJI = { h: "🚗", v: "🚙" };
const CAR_COLORS = ["#4d96ff", "#6bcf7f", "#ffd93d", "#a55eea", "#ff9f43"];

export class TrafficJamGame extends BaseGame {
  constructor() {
    super("traffic-jam");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private cars: Car[] = [];
  private cells: number[][] = []; // cells[r][c] = carId or -1
  private moves = 0;
  private unbinds: (() => void)[] = [];
  private solved = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private blockerCount(): number {
    return this.difficulty === "easy" ? 3: this.difficulty === "medium"
        ? 4
        : 6;
  }

  /** 生成关卡：保证红车前方至少有一辆车，且该车的某方向有空位（必可挪开）。 */
  private generate(): void {
    // 最多尝试若干次
    for (let attempt = 0; attempt < 200; attempt++) {
      const cars: Car[] = [];
      const cells: number[][] = Array.from({ length: GRID }, () =>
        Array.from({ length: GRID }, () => -1),
      );
      const occupy = (car: Car) => {
        for (let i = 0; i < car.len; i++) {
          const rr = car.dir === "v" ? car.r + i : car.r;
          const cc = car.dir === "h" ? car.c + i : car.c;
          if (rr < 0 || rr >= GRID || cc < 0 || cc >= GRID) return false;
          if (cells[rr]![cc] !== -1) return false;
        }
        for (let i = 0; i < car.len; i++) {
          const rr = car.dir === "v" ? car.r + i : car.r;
          const cc = car.dir === "h" ? car.c + i : car.c;
          cells[rr]![cc] = car.id;
        }
        return true;
      };

      // 红车：第一行，长度 2，水平。占据 (0,0)(0,1)，出口在 (0,2) 右侧。
      const red: Car = {
        id: 0,
        r: 0,
        c: 0,
        len: 2,
        dir: "h",
        color: "#ff6348",
        emoji: CAR_EMOJI.h,
        red: true,
      };
      occupy(red);
      cars.push(red);

      // 必须有一辆车挡住红车出口（占据 (0,2) 或能滑到 (0,2)）。
      // 简化：把 blocker 直接放在 (0,2)。
      // 该车不能是水平（水平长度 2 会越界），所以做成竖直长度 2，占据 (0,2)(1,2)。
      // 但要保证它能被挪开：竖直向下到 (1,2)(2,2) 或向上一格不可能，
      // 所以我们让它能向下移动（需要 (2,2) 空着）。
      const blockerDir: Dir = "v";
      const blocker: Car = {
        id: 1,
        r: 0,
        c: 2,
        len: 2,
        dir: blockerDir,
        color: sample(CAR_COLORS),
        emoji: CAR_EMOJI[blockerDir],
      };
      if (!occupy(blocker)) continue;
      cars.push(blocker);

      // 剩余空格放干扰车（不挡红车出口路径也行，纯装饰/增加移动趣味）
      const extras = this.blockerCount() - 1;
      const emptyCells: [number, number][] = [];
      for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
          if (cells[r]![c] === -1) emptyCells.push([r, c]);

      const shuffledEmpty = shuffle(emptyCells);
      let nextId = 2;
      let used = 0;
      for (const [r, c] of shuffledEmpty) {
        if (used >= extras) break;
        if (cells[r]![c] !== -1) continue;
        // 尝试放一辆长度 1（点状）的车，便于操作
        const dir: Dir = sample(["h", "v"] as const);
        const car: Car = {
          id: nextId,
          r,
          c,
          len: 1,
          dir,
          color: sample(CAR_COLORS),
          emoji: CAR_EMOJI[dir],
        };
        if (occupy(car)) {
          cars.push(car);
          nextId++;
          used++;
        }
      }

      this.cars = cars;
      this.cells = cells;
      // 验证必可解：blocker 头在 (0,2)、尾在 (1,2)，只要 (2,2) 为空，它就能向下挪一格
      // 腾出 (0,2)，红车即可驶出。extras 阻挡车是长度 1，放在其它空格不影响。
      if (cells[2]![2] === -1) return; // 可解
    }
    // 兜底：直接构造一个保证可解的最小关卡
    this.cars = [
      {
        id: 0,
        r: 0,
        c: 0,
        len: 2,
        dir: "h",
        color: "#ff6348",
        emoji: CAR_EMOJI.h,
        red: true,
      },
      {
        id: 1,
        r: 0,
        c: 2,
        len: 2,
        dir: "v",
        color: "#4d96ff",
        emoji: CAR_EMOJI.v,
      },
    ];
    this.cells = [
      [0, 0, 1],
      [-1, -1, 1],
      [-1, -1, -1],
    ];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.moves = 0;
    this.solved = false;
    this.generate();
    this.render();
  }

  private render(): void {
    const wrap = document.createElement("div");
    wrap.className = "tj-wrap";

    const task = document.createElement("div");
    task.className = "tj-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 点车让它滑一格，把 <b class="tj-red">红车</b> 从右边出口送出去`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "tj-board";
    board.id = "tj-board";

    // 出口标记
    const exit = document.createElement("div");
    exit.className = "tj-exit";
    exit.textContent = "出口→";
    board.appendChild(exit);

    // 绘制车辆
    this.cars.forEach((car) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `tj-car${car.red ? " tj-car--red" : ""}`;
      el.dataset.id = String(car.id);
      el.style.setProperty("--r", String(car.r));
      el.style.setProperty("--c", String(car.c));
      el.style.setProperty("--len", String(car.len));
      el.style.setProperty("--dir", car.dir);
      el.style.setProperty("--car-color", car.color);
      el.innerHTML = `<span class="tj-car-emoji">${car.emoji}</span>`;
      board.appendChild(el);
      this.bindCar(el, car);
    });
    wrap.appendChild(board);

    const hint = document.createElement("div");
    hint.className = "tj-hint";
    hint.id = "tj-hint";
    hint.textContent = `已移动 ${this.moves} 步`;
    wrap.appendChild(hint);

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "tj-reset";
    reset.textContent = "↺ 重来";
    reset.addEventListener("click", () => this.startRound());
    wrap.appendChild(reset);

    this.root.appendChild(wrap);
  }

  /** 绑定点击：每次点击让车沿其方向滑一格（优先朝出口/朝空位方向）。 */
  private bindCar(el: HTMLButtonElement, car: Car): void {
    const moveByDrag = (
      dx: number,
      dy: number,
    ): { dr: number; dc: number } | null => {
      // 根据拖拽方向决定移动一格
      if (car.dir === "h") {
        if (dx > 8) return { dr: 0, dc: 1 };
        if (dx < -8) return { dr: 0, dc: -1 };
      } else {
        if (dy > 8) return { dr: 1, dc: 0 };
        if (dy < -8) return { dr: -1, dc: 0 };
      }
      return null;
    };
    let startX = 0;
    let startY = 0;
    let moved = false;
    const onDown = (p: { x: number; y: number }) => {
      startX = p.x;
      startY = p.y;
      moved = false;
    };
    const onMove = (p: { x: number; y: number }) => {
      if (moved) return;
      const d = moveByDrag(p.x - startX, p.y - startY);
      if (d) {
        moved = true;
        this.tryMove(car, d.dr, d.dc, el);
      }
    };
    const onUp = () => {
      // 没拖动就当作点击：自动找可移动方向
      if (!moved) {
        if (car.dir === "h") {
          if (!this.tryMove(car, 0, 1, el) && !this.tryMove(car, 0, -1, el)) {
            // 卡住，轻微摇晃提示
            el.classList.add("tj-car--shake");
            this.trackTimeout(() => el.classList.remove("tj-car--shake"), 400);
          }
        } else {
          if (!this.tryMove(car, 1, 0, el) && !this.tryMove(car, -1, 0, el)) {
            el.classList.add("tj-car--shake");
            this.trackTimeout(() => el.classList.remove("tj-car--shake"), 400);
          }
        }
      }
    };
    const u = bindPointer(el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  /** 尝试把 car 移动 (dr,dc)，成功返回 true。 */
  private tryMove(
    car: Car,
    dr: number,
    dc: number,
    el: HTMLButtonElement,
  ): boolean {
    // 红车朝右移动若超出网格且 (0,2) 已空，则视为驶出
    if (car.red && dr === 0 && dc === 1) {
      // 红车当前占 (0,0)(0,1)，若 (0,2) 空，可驶出
      if (this.cells[0]![2] === -1) {
        // 驶出动画
        this.solved = true;
        sfxPop();
        el.classList.add("tj-car--out");
        // 清理红车占用
        for (let i = 0; i < car.len; i++) {
          this.cells[car.r]![car.c + i] = -1;
        }
        this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByMoves(this.moves, [6, 12]));
          } else {
            this.startRound();
          }
        }, 900);
        return true;
      }
    }
    // 普通移动：新位置所有格子必须有效且空
    const newR = car.r + dr;
    const newC = car.c + dc;
    for (let i = 0; i < car.len; i++) {
      const rr = car.dir === "v" ? newR + i : newR;
      const cc = car.dir === "h" ? newC + i : newC;
      if (rr < 0 || rr >= GRID || cc < 0 || cc >= GRID) return false;
      const owner = this.cells[rr]![cc];
      if (owner !== -1 && owner !== car.id) return false;
    }
    // 清除旧位置
    for (let i = 0; i < car.len; i++) {
      const rr = car.dir === "v" ? car.r + i : car.r;
      const cc = car.dir === "h" ? car.c + i : car.c;
      this.cells[rr]![cc] = -1;
    }
    car.r = newR;
    car.c = newC;
    // 占据新位置
    for (let i = 0; i < car.len; i++) {
      const rr = car.dir === "v" ? car.r + i : car.r;
      const cc = car.dir === "h" ? car.c + i : car.c;
      this.cells[rr]![cc] = car.id;
    }
    this.moves += 1;
    sfxPop();
    el.style.setProperty("--r", String(car.r));
    el.style.setProperty("--c", String(car.c));
    const hint = this.root.querySelector("#tj-hint");
    if (hint) hint.textContent = `已移动 ${this.moves} 步`;
    return true;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "把挡住红车的车挪开，红车就能开走啦～",
      primary: { text: "继续", icon: "🚗", onClick: () => ov.destroy() },
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
    if (document.getElementById("tj-style")) return;
    const st = document.createElement("style");
    st.id = "tj-style";
    st.textContent = TJ_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function TJ_CSS(theme: string): string {
  const cell = 96;
  return `
.tj-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(420px,100%);}
.tj-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.tj-red{color:#ff6348;}
.tj-board{position:relative;display:grid;grid-template-columns:repeat(3,${cell}px);grid-template-rows:repeat(3,${cell}px);gap:6px;padding:14px;background:linear-gradient(180deg,#e8e8ee,#cfd0d8);border-radius:20px;box-shadow:var(--shadow);touch-action:none;}
.tj-exit{position:absolute;right:-6px;top:calc(14px + ${cell * 0}px + ${cell / 2}px - 16px);transform:translateX(100%);font-size:.85rem;font-weight:800;color:#ff6348;background:#fff;padding:4px 8px;border-radius:8px;box-shadow:var(--shadow);white-space:nowrap;}
.tj-car{
  grid-column-start:calc(var(--c) + 1);
  grid-row-start:calc(var(--r) + 1);
  grid-column-end:calc(var(--c) + 1 + var(--len));
  display:flex;align-items:center;justify-content:center;
  border:none;border-radius:12px;cursor:pointer;
  background:linear-gradient(180deg,color-mix(in srgb,var(--car-color,${theme}) 75%,#fff),var(--car-color,${theme}));
  box-shadow:inset 0 -4px 6px rgba(0,0,0,.2),0 4px 8px rgba(0,0,0,.18);
  transition:grid-column-start .18s ease,grid-row-start .18s ease,transform .12s;
  touch-action:none;
}
.tj-car[style*="--dir:v"]{grid-column-end:calc(var(--c) + 2);grid-row-end:calc(var(--r) + 1 + var(--len));}
.tj-car:active{transform:scale(.95);}
.tj-car--red{background:linear-gradient(180deg,#ff8a75,#ff6348);box-shadow:inset 0 -4px 6px rgba(0,0,0,.2),0 0 14px rgba(255,99,72,.6);}
.tj-car-emoji{font-size:2.4rem;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3));}
.tj-car--out{animation:tj-out .8s ease forwards;}
@keyframes tj-out{0%{transform:translateX(0)}100%{transform:translateX(200px) scale(.6);opacity:0}}
.tj-car--shake{animation:tj-shake .4s ease;}
@keyframes tj-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.tj-hint{font-size:.95rem;font-weight:700;color:var(--ink);opacity:.85;}
.tj-reset{font-size:.9rem;font-weight:700;color:var(--ink);background:rgba(255,255,255,.7);border:none;padding:6px 16px;border-radius:999px;cursor:pointer;box-shadow:var(--shadow);}
.tj-reset:active{transform:scale(.95);}
@media (max-width:380px){.tj-board{grid-template-columns:repeat(3,76px);grid-template-rows:repeat(3,76px);}.tj-car-emoji{font-size:1.9rem;}.tj-exit{top:calc(14px + 38px - 16px);}}
`;
}

export function create(): TrafficJamGame {
  return new TrafficJamGame();
}
