/* 吹箱子 Wind Push —— 网格上有箱子和目标点，孩子点方向吹风，
   所有箱子朝该方向一起被风吹到撞墙/撞别的箱子才停。把所有箱子推到目标。
   独特点：一次操作吹动所有箱子（推冰块式），整体策略思考。
   巧思：每个箱子与其目标放在同一"轨道"上且轨道间不交叉，保证可解。
   视觉：网格 + 木箱 + 旗帜目标。难度=箱子数。通关=推到目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

interface Box {
  x: number;
  y: number;
}

export class WindPushGame extends BaseGame {
  constructor() {
    super("wind-push");
  }

  private n = 6;
  private walls: boolean[][] = [];
  private goals: boolean[][] = [];
  private boxes: Box[] = [];
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.n =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 6 : 7;
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private boxCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  /** 本关初始状态（供"重来"使用）。 */
  private initBoxes: Box[] = [];

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.generateLevel();
    // 保存本关初始箱位，便于"重来本关"
    this.initBoxes = this.boxes.map((b) => ({ x: b.x, y: b.y }));
    this.render();
  }

  /** 重来本关：恢复到初始箱位，不换题。 */
  private resetRound(): void {
    this.boxes = this.initBoxes.map((b) => ({ x: b.x, y: b.y }));
    this.render();
  }

  /**
   * 生成保证可解的关卡：
   * 策略——给每个箱子分配一条"独立轨道"（独占的一行或一列），
   * 该轨道上只有这一个箱子与它的目标，目标贴墙，箱子在轨道上某处。
   * 这样每个箱子都能单独被吹向对应方向到目标，互不干扰，必可解。
   */
  private generateLevel(): void {
    const n = this.n;
    const count = this.boxCount();
    for (let attempt = 0; attempt < 300; attempt++) {
      const walls: boolean[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => false),
      );
      const goals: boolean[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => false),
      );
      // 随机一些墙（装饰，但避开轨道），让画面更丰富
      const wallDensity =
        this.difficulty === "easy"
          ? 0.06
          : this.difficulty === "medium"
            ? 0.1
            : 0.14;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (Math.random() < wallDensity) walls[y]![x] = true;
        }
      }

      // 选择 count 条互不相同的轨道（行号或列号）
      const useRows = count <= n;
      let indices: number[] = [];
      if (useRows) {
        // 用行作为轨道
        indices = shuffle(Array.from({ length: n }, (_, i) => i)).slice(
          0,
          count,
        );
      } else {
        indices = shuffle(Array.from({ length: n }, (_, i) => i)).slice(
          0,
          count,
        );
      }

      const boxes: Box[] = [];
      let ok = true;
      for (let i = 0; i < count; i++) {
        const track = indices[i]!;
        if (useRows) {
          // 该行作为轨道：先清空该行所有墙
          for (let x = 0; x < n; x++) walls[track]![x] = false;
          // 目标贴某一边墙
          const goalLeft = Math.random() < 0.5;
          const gx = goalLeft ? 0 : n - 1;
          goals[track]![gx] = true;
          // 箱子放在该行非目标、非墙格（已清空墙），且至少离目标 2 格
          const positions: number[] = [];
          for (let x = 0; x < n; x++) {
            if (x === gx) continue;
            if (Math.abs(x - gx) >= 2) positions.push(x);
          }
          if (positions.length === 0) {
            ok = false;
            break;
          }
          const bx = positions[randInt(0, positions.length - 1)]!;
          // 确保该位置不与已有箱子冲突（同行独占，不会冲突）
          boxes.push({ x: bx, y: track });
        } else {
          // 该列作为轨道
          for (let y = 0; y < n; y++) walls[y]![track] = false;
          const goalTop = Math.random() < 0.5;
          const gy = goalTop ? 0 : n - 1;
          goals[gy]![track] = true;
          const positions: number[] = [];
          for (let y = 0; y < n; y++) {
            if (y === gy) continue;
            if (Math.abs(y - gy) >= 2) positions.push(y);
          }
          if (positions.length === 0) {
            ok = false;
            break;
          }
          const by = positions[randInt(0, positions.length - 1)]!;
          boxes.push({ x: track, y: by });
        }
      }
      if (!ok) continue;
      // 校验：箱子初始不在目标上（否则该箱已"完成"无意义），且箱子两两不重合
      let valid = true;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i]!;
        if (goals[b.y]![b.x]!) {
          valid = false;
          break;
        }
        for (let j = i + 1; j < boxes.length; j++) {
          if (boxes[j]!.x === b.x && boxes[j]!.y === b.y) {
            valid = false;
            break;
          }
        }
        if (!valid) break;
      }
      if (!valid) continue;
      // 校验目标数 == 箱子数
      let goalCount = 0;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) if (goals[y]![x]) goalCount++;
      if (goalCount !== count) continue;

      this.walls = walls;
      this.goals = goals;
      this.boxes = boxes;
      return;
    }
    // 兜底：极简单箱关卡
    this.walls = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => false),
    );
    this.goals = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => false),
    );
    this.goals[0]![0] = true;
    this.boxes = [{ x: n - 1, y: 0 }];
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "wp-wrap";
    const task = document.createElement("div");
    task.className = "wp-task";
    task.innerHTML = `点方向吹风，把所有箱子吹到 🎯 上！<br><span class="wp-hint">风会把箱子<b>吹到撞墙才停</b>～ ${this.roundsDone + 1} / ${this.roundTotal}</span>`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "wp-board";
    const cell = this.n <= 5 ? 62 : this.n === 6 ? 54 : 48;
    board.style.width = `${this.n * cell}px`;
    board.style.height = `${this.n * cell}px`;

    // 背景格
    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < this.n; x++) {
        const c = document.createElement("div");
        c.className = "wp-cell";
        c.style.left = `${x * cell}px`;
        c.style.top = `${y * cell}px`;
        c.style.width = `${cell}px`;
        c.style.height = `${cell}px`;
        if (this.walls[y]![x]!) c.classList.add("wp-cell--wall");
        if (this.goals[y]![x]!) {
          const g = document.createElement("div");
          g.className = "wp-goal";
          g.textContent = "🎯";
          c.appendChild(g);
        }
        board.appendChild(c);
      }
    }
    // 箱子
    this.boxes.forEach((b, i) => {
      const el = document.createElement("div");
      el.className = "wp-box";
      el.dataset.idx = String(i);
      el.textContent = "📦";
      el.style.width = `${cell}px`;
      el.style.height = `${cell}px`;
      el.style.left = `${b.x * cell}px`;
      el.style.top = `${b.y * cell}px`;
      if (this.goals[b.y]![b.x]!) el.classList.add("wp-box--done");
      board.appendChild(el);
    });

    wrap.appendChild(board);

    // 风向键
    const pad = document.createElement("div");
    pad.className = "wp-pad";
    pad.innerHTML = `
      <button type="button" class="wp-key" data-d="0" aria-label="向上吹">⬆️<span>吹</span></button>
      <div class="wp-pad-row">
        <button type="button" class="wp-key" data-d="3" aria-label="向左吹">⬅️<span>吹</span></button>
        <button type="button" class="wp-key wp-key--mid" disabled>🌬️</button>
        <button type="button" class="wp-key" data-d="1" aria-label="向右吹">➡️<span>吹</span></button>
      </div>
      <button type="button" class="wp-key" data-d="2" aria-label="向下吹">⬇️<span>吹</span></button>`;
    wrap.appendChild(pad);

    pad.querySelectorAll<HTMLButtonElement>(".wp-key[data-d]").forEach((b) => {
      b.addEventListener("click", () => this.blow(Number(b.dataset.d)));
    });

    // 重置本关
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "wp-reset";
    reset.textContent = "🔄 重来本关";
    reset.addEventListener("click", () => {
      sfxPop();
      this.resetRound();
    });
    wrap.appendChild(reset);

    this.root.appendChild(wrap);
  }

  private blow(dir: number): void {
    const [dx, dy] = DIRS[dir]!;
    // 所有箱子按移动方向排序，确保前面的先到位（避免穿透）
    const order = [...this.boxes.keys()].sort((a, b) => {
      if (dx !== 0)
        return dx > 0
          ? this.boxes[b]!.x - this.boxes[a]!.x
          : this.boxes[a]!.x - this.boxes[b]!.x;
      return dy > 0
        ? this.boxes[b]!.y - this.boxes[a]!.y
        : this.boxes[a]!.y - this.boxes[b]!.y;
    });
    let moved = false;
    for (const idx of order) {
      const b = this.boxes[idx]!;
      let cx = b.x,
        cy = b.y;
      while (true) {
        const nx = cx + dx,
          ny = cy + dy;
        if (nx < 0 || nx >= this.n || ny < 0 || ny >= this.n) break;
        if (this.walls[ny]![nx]!) break;
        // 撞别的箱子？
        if (this.boxes.some((o, oi) => oi !== idx && o.x === nx && o.y === ny))
          break;
        cx = nx;
        cy = ny;
      }
      if (cx !== b.x || cy !== b.y) {
        b.x = cx;
        b.y = cy;
        moved = true;
      }
    }
    if (!moved) {
      sfxPop();
      return;
    }
    sfxPop();
    this.resetWrongStreak();
    this.updateBoxPositions();
    // 是否全部到位
    if (this.boxes.every((b) => this.goals[b.y]![b.x]!)) {
      const rect = this.root
        .querySelector(".wp-board")
        ?.getBoundingClientRect();
      this.onCorrect(
        rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
        rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
      );
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 600);
    }
  }

  private updateBoxPositions(): void {
    const cell = this.n <= 5 ? 62 : this.n === 6 ? 54 : 48;
    this.boxes.forEach((b, i) => {
      const el = this.root.querySelector(
        `.wp-box[data-idx="${i}"]`,
      ) as HTMLDivElement | null;
      if (!el) return;
      el.style.transition = "left .2s ease, top .2s ease";
      el.style.left = `${b.x * cell}px`;
      el.style.top = `${b.y * cell}px`;
      if (this.goals[b.y]![b.x]!) el.classList.add("wp-box--done");
      else el.classList.remove("wp-box--done");
    });
  }

  private injectStyle(): void {
    if (document.getElementById("wp-style")) return;
    const st = document.createElement("style");
    st.id = "wp-style";
    st.textContent = WP_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function WP_CSS(theme: string): string {
  return `
.wp-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;}
.wp-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.wp-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.wp-hint b{color:${theme};}
.wp-board{position:relative;background:linear-gradient(135deg,#e8f5e9,#c8e6c9);border-radius:16px;box-shadow:var(--shadow-lg);border:3px solid ${theme};}
.wp-cell{position:absolute;box-sizing:border-box;border:1px dashed rgba(0,120,80,.2);}
.wp-cell--wall{background:linear-gradient(135deg,#616161,#424242);border:1px solid #2c2c2c;border-radius:4px;box-shadow:inset 0 2px 0 rgba(255,255,255,.15),inset 0 -2px 0 rgba(0,0,0,.3);}
.wp-goal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.7rem;animation:wp-pulse 1.1s ease-in-out infinite alternate;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));}
@keyframes wp-pulse{from{transform:scale(1)}to{transform:scale(1.12)}}
.wp-box{position:absolute;display:flex;align-items:center;justify-content:center;font-size:1.7rem;z-index:5;filter:drop-shadow(0 3px 4px rgba(0,0,0,.25));will-change:left,top;}
.wp-box--done{filter:drop-shadow(0 0 8px #6bcf7f) drop-shadow(0 3px 4px rgba(0,0,0,.25));}
.wp-box--done::after{content:"✓";position:absolute;color:#fff;background:#6bcf7f;border-radius:50%;width:18px;height:18px;font-size:.8rem;display:flex;align-items:center;justify-content:center;top:-2px;right:-2px;}
.wp-pad{display:flex;flex-direction:column;align-items:center;gap:6px;}
.wp-pad-row{display:flex;gap:6px;align-items:center;}
.wp-key{width:64px;height:60px;font-size:1.3rem;border:none;border-radius:14px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 30%,#fff));box-shadow:var(--shadow);cursor:pointer;transition:transform .1s ease;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;padding:2px;}
.wp-key span{font-size:.7rem;font-weight:800;color:var(--ink-soft);margin-top:2px;}
.wp-key:active{transform:scale(.92);}
.wp-key:disabled{cursor:default;opacity:.6;}
.wp-key--mid{font-size:1.4rem;}
.wp-reset{margin-top:4px;border:none;background:rgba(0,0,0,.06);color:var(--ink-soft);font-weight:700;font-size:.85rem;padding:6px 16px;border-radius:999px;cursor:pointer;}
.wp-reset:active{transform:scale(.95);}
@media (max-width:380px){.wp-key{width:54px;height:54px;font-size:1.1rem;}}
`;
}

export function create(): WindPushGame {
  return new WindPushGame();
}
