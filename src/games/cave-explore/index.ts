/* 洞穴探路 Cave Explore —— 黑暗洞穴的网格迷宫，只能看到角色周围一圈（火把视野），
   孩子用方向键探索，走到出口即可。独特点：战争迷雾 + 局部视野（区别于全图可见迷宫）。
   视觉：网格 + 黑暗 + 角色周围亮圈（火把）+ 出口。
   难度=网格大小。通关=找到出口目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar } from "../../lobby/util.ts";

type Cell = 0 | 1; // 0=通路，1=岩石墙
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export class CaveExploreGame extends BaseGame {
  constructor() {
    super("cave-explore");
  }

  private n = 6;
  private grid: Cell[][] = [];
  private hero: [number, number] = [0, 0];
  private exit: [number, number] = [0, 0];
  private cell = 54;

  private roundsDone = 0;
  private roundTotal = 0;
  private over = false;
  private unbindKey: (() => void) | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    if (this.unbindKey) this.unbindKey();
    this.unbindKey = null;
  }

  private gridSize(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 6
        : 7;
  }

  private startRound(): void {
    this.over = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root.innerHTML = "";
    this.n = this.gridSize();
    this.generate();
    this.cell = this.n <= 5 ? 62 : this.n === 6 ? 54 : 46;
    this.render();
  }

  /** 生成保证连通的洞穴：随机墙但用 BFS 验证 hero->exit 可达；不可达就重试。 */
  private generate(): void {
    const N = this.n;
    for (let attempt = 0; attempt < 300; attempt++) {
      const density =
        this.difficulty === "easy"
          ? 0.18
          : this.difficulty === "medium"
            ? 0.26
            : 0.32;
      const g: Cell[][] = Array.from({ length: N }, () =>
        Array.from({ length: N }, () => (Math.random() < density ? 1 : 0)),
      );
      const sx = 0,
        sy = 0;
      const ex = N - 1,
        ey = N - 1;
      g[sy]![sx] = 0;
      g[ey]![ex] = 0;
      // BFS 连通性
      if (!this.reachable(g, N, [sx, sy], [ex, ey])) continue;
      this.grid = g;
      this.hero = [sx, sy];
      this.exit = [ex, ey];
      return;
    }
    // 兜底：空旷
    this.grid = Array.from({ length: N }, () =>
      Array.from({ length: N }, () => 0 as Cell),
    );
    this.hero = [0, 0];
    this.exit = [N - 1, N - 1];
  }

  private reachable(
    g: Cell[][],
    N: number,
    s: [number, number],
    e: [number, number],
  ): boolean {
    const seen = Array.from({ length: N }, () =>
      Array.from({ length: N }, () => false),
    );
    const q: [number, number][] = [[s[0], s[1]]];
    seen[s[1]]![s[0]] = true;
    while (q.length) {
      const [x, y] = q.shift()!;
      if (x === e[0] && y === e[1]) return true;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
        if (seen[ny]![nx]) continue;
        if (g[ny]![nx] === 1) continue;
        seen[ny]![nx] = true;
        q.push([nx, ny]);
      }
    }
    return false;
  }

  private render(): void {
    const wrap = document.createElement("div");
    wrap.className = "cv2-wrap";

    const task = document.createElement("div");
    task.className = "cv2-task";
    task.innerHTML = `用方向键走出黑暗洞穴，找到 <b>🚪出口</b>！<br><span class="cv2-hint">火把只能照亮周围一圈，慢慢探～ 第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "cv2-board";
    board.id = "cv2-board";
    board.style.setProperty("--n", String(this.n));
    board.style.setProperty("--cell", `${this.cell}px`);
    board.style.width = `${this.n * this.cell}px`;
    board.style.height = `${this.n * this.cell}px`;

    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < this.n; x++) {
        const c = document.createElement("div");
        c.className = "cv2-cell";
        c.dataset.x = String(x);
        c.dataset.y = String(y);
        if (this.grid[y]![x] === 1) c.classList.add("cv2-cell--wall");
        if (x === this.exit[0] && y === this.exit[1]) {
          c.classList.add("cv2-cell--exit");
          c.textContent = "🚪";
        }
        board.appendChild(c);
      }
    }
    // 角色
    const hero = document.createElement("div");
    hero.className = "cv2-hero";
    hero.id = "cv2-hero";
    hero.textContent = "🧒";
    hero.style.width = `${this.cell}px`;
    hero.style.height = `${this.cell}px`;
    board.appendChild(hero);

    // 火把光圈（绝对定位径向蒙版覆盖）
    const torch = document.createElement("div");
    torch.className = "cv2-torch";
    torch.id = "cv2-torch";
    board.appendChild(torch);

    wrap.appendChild(board);

    // 方向键
    const pad = document.createElement("div");
    pad.className = "cv2-pad";
    pad.innerHTML = `
      <button type="button" class="cv2-key" data-d="0" aria-label="向上">⬆️</button>
      <div class="cv2-pad-row">
        <button type="button" class="cv2-key" data-d="3" aria-label="向左">⬅️</button>
        <button type="button" class="cv2-key cv2-key--mid" disabled>🔦</button>
        <button type="button" class="cv2-key" data-d="1" aria-label="向右">➡️</button>
      </div>
      <button type="button" class="cv2-key" data-d="2" aria-label="向下">⬇️</button>`;
    wrap.appendChild(pad);

    this.root.appendChild(wrap);

    pad.querySelectorAll<HTMLButtonElement>(".cv2-key[data-d]").forEach((b) => {
      b.addEventListener("click", () => this.move(Number(b.dataset.d)));
    });

    // 键盘
    this.unbindKey = (() => {
      const kd = (e: KeyboardEvent): void => {
        const k = e.key;
        let d = -1;
        if (k === "ArrowUp" || k === "w") d = 0;
        else if (k === "ArrowRight" || k === "d") d = 1;
        else if (k === "ArrowDown" || k === "s") d = 2;
        else if (k === "ArrowLeft" || k === "a") d = 3;
        if (d < 0) return;
        e.preventDefault();
        this.move(d);
      };
      window.addEventListener("keydown", kd);
      return () => window.removeEventListener("keydown", kd);
    })();

    this.updateView();
  }

  private move(dir: number): void {
    if (this.over) return;
    const [dx, dy] = DIRS[dir]!;
    const nx = this.hero[0] + dx;
    const ny = this.hero[1] + dy;
    if (nx < 0 || nx >= this.n || ny < 0 || ny >= this.n) return;
    if (this.grid[ny]![nx] === 1) {
      // 撞墙：温和提示
      sfxPop();
      const hero = this.root.querySelector("#cv2-hero") as HTMLElement | null;
      if (hero) {
        hero.classList.add("cv2-hero--bump");
        this.trackTimeout(() => hero.classList.remove("cv2-hero--bump"), 200);
      }
      return;
    }
    this.hero = [nx, ny];
    this.resetWrongStreak();
    sfxPop();
    this.updateView();
    if (nx === this.exit[0] && ny === this.exit[1]) {
      this.over = true;
      const hero = this.root.querySelector("#cv2-hero") as HTMLElement | null;
      const r = hero?.getBoundingClientRect();
      this.onCorrect(
        r ? r.left + r.width / 2 : window.innerWidth / 2,
        r ? r.top + r.height / 2 : window.innerHeight / 2,
      );
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 700);
    }
  }

  /** 更新角色位置、视野亮区、火把光圈 */
  private updateView(): void {
    const hero = this.root.querySelector("#cv2-hero") as HTMLElement | null;
    if (hero) {
      hero.style.left = `${this.hero[0] * this.cell}px`;
      hero.style.top = `${this.hero[1] * this.cell}px`;
    }
    // 视野范围：曼哈顿距离 <=2 的格子显示
    const cells = this.root.querySelectorAll<HTMLElement>(".cv2-cell");
    cells.forEach((c) => {
      const x = Number(c.dataset.x);
      const y = Number(c.dataset.y);
      const d = Math.abs(x - this.hero[0]) + Math.abs(y - this.hero[1]);
      c.classList.toggle("cv2-cell--seen", d <= 2);
      c.classList.toggle("cv2-cell--near", d <= 1);
    });
    // 火把光圈跟随角色中心
    const torch = this.root.querySelector("#cv2-torch") as HTMLElement | null;
    if (torch) {
      const cx = (this.hero[0] + 0.5) * this.cell;
      const cy = (this.hero[1] + 0.5) * this.cell;
      torch.style.left = `${cx}px`;
      torch.style.top = `${cy}px`;
    }
  }

  private injectStyle(): void {
    if (document.getElementById("cv2-style")) return;
    const st = document.createElement("style");
    st.id = "cv2-style";
    st.textContent = CV2_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function CV2_CSS(theme: string): string {
  return `
.cv2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;}
.cv2-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);max-width:440px;}
.cv2-task b{color:${theme};}
.cv2-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.cv2-board{position:relative;background:linear-gradient(135deg,#2a1a3e,#120a22);border-radius:18px;box-shadow:var(--shadow-lg);overflow:hidden;border:3px solid ${theme};}
.cv2-cell{position:absolute;box-sizing:border-box;}
.cv2-cell--wall{background:linear-gradient(135deg,#555,#2c2c2c);border-radius:4px;box-shadow:inset 0 2px 0 rgba(255,255,255,.08);}
.cv2-cell--seen{background:rgba(99,102,241,.12);}
.cv2-cell--seen.cv2-cell--wall{background:linear-gradient(135deg,#6b6b6b,#3a3a3a);}
.cv2-cell--near{background:rgba(255,220,120,.18);}
.cv2-cell--exit{display:flex;align-items:center;justify-content:center;font-size:1.6rem;}
.cv2-cell--exit.cv2-cell--seen{animation:cv2-glow 1s ease-in-out infinite alternate;}
@keyframes cv2-glow{from{filter:drop-shadow(0 0 4px #ffd93d)}to{filter:drop-shadow(0 0 12px #ffd93d)}}
.cv2-hero{position:absolute;display:flex;align-items:center;justify-content:center;font-size:1.7rem;z-index:6;transition:left .15s ease,top .15s ease;filter:drop-shadow(0 0 8px #ffcc66);will-change:left,top;}
.cv2-hero--bump{animation:cv2-bump .2s ease;}
@keyframes cv2-bump{0%,100%{transform:translate(0,0)}50%{transform:translate(3px,0)}}
.cv2-torch{position:absolute;width:1px;height:1px;border-radius:50%;pointer-events:none;z-index:5;box-shadow:0 0 60px 40px rgba(255,210,120,.55),0 0 120px 70px rgba(255,180,80,.25);}
.cv2-pad{display:flex;flex-direction:column;align-items:center;gap:6px;}
.cv2-pad-row{display:flex;gap:6px;align-items:center;}
.cv2-key{width:58px;height:58px;font-size:1.5rem;border:none;border-radius:14px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 30%,#fff));box-shadow:var(--shadow);cursor:pointer;transition:transform .1s ease;display:flex;align-items:center;justify-content:center;}
.cv2-key:active{transform:scale(.92);}
.cv2-key:disabled{cursor:default;opacity:.6;}
.cv2-key--mid{font-size:1.3rem;}
@media (max-width:380px){.cv2-key{width:50px;height:50px;font-size:1.3rem;}}
`;
}

export function create(): CaveExploreGame {
  return new CaveExploreGame();
}
