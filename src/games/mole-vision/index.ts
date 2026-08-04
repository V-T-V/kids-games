/* 鼹鼠视野 Mole Vision —— 黑暗地下只有鼹鼠周围一圈可见，散布着蘑菇，
   孩子移动鼹鼠找到所有蘑菇。独特点：火把视野圈（径向遮罩），探索发现感。
   视觉：黑暗 + 鼹鼠周围亮圈 + 蘑菇。方向按钮/方向键控制移动。
   难度=蘑菇数量。通关=找到目标轮数。前缀 mvs-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

export class MoleVisionGame extends BaseGame {
  constructor() {
    super("mole-vision");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private grid = 6;
  private cellPx = 0;
  private mx = 0;
  private my = 0;
  private mushrooms: { x: number; y: number }[] = [];
  private found = 0;
  private boardEl: HTMLDivElement | null = null;
  private moleEl: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
  }

  private gridForDifficulty(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 6
        : 7;
  }

  private mushroomCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 5
        : 7;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.grid = this.gridForDifficulty();
    const total = this.mushroomCount();
    this.found = 0;

    const wrap = document.createElement("div");
    wrap.className = "mvs-wrap";
    const task = document.createElement("div");
    task.className = "mvs-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 在黑暗里找到 <b id="mvs-left">${total}</b> 个 🍄`;
    wrap.appendChild(task);

    const maxBoard = Math.min(window.innerWidth - 40, 420);
    this.cellPx = Math.floor(maxBoard / this.grid);

    this.boardEl = document.createElement("div");
    this.boardEl.className = "mvs-board";
    this.boardEl.style.width = `${this.grid * this.cellPx}px`;
    this.boardEl.style.height = `${this.grid * this.cellPx}px`;

    // 生成蘑菇位置（与鼹鼠起点不重叠）
    this.mushrooms = [];
    const occupied = new Set<string>();
    const mid = Math.floor(this.grid / 2);
    this.mx = mid;
    this.my = mid;
    occupied.add(`${mid},${mid}`);
    const all: { x: number; y: number }[] = [];
    for (let y = 0; y < this.grid; y++) {
      for (let x = 0; x < this.grid; x++) {
        if (!occupied.has(`${x},${y}`)) all.push({ x, y });
      }
    }
    const board: HTMLDivElement = this.boardEl; // 此时已创建，必定非空
    shuffle(all)
      .slice(0, total)
      .forEach((p) => {
        this.mushrooms.push(p);
        const el = document.createElement("div");
        el.className = "mvs-shroom";
        el.textContent = "🍄";
        el.style.width = `${this.cellPx}px`;
        el.style.height = `${this.cellPx}px`;
        el.style.left = `${p.x * this.cellPx}px`;
        el.style.top = `${p.y * this.cellPx}px`;
        el.dataset.x = String(p.x);
        el.dataset.y = String(p.y);
        board.appendChild(el);
      });

    // 鼹鼠
    this.moleEl = document.createElement("div");
    this.moleEl.className = "mvs-mole";
    this.moleEl.textContent = "🦫";
    this.moleEl.style.width = `${this.cellPx}px`;
    this.moleEl.style.height = `${this.cellPx}px`;
    this.boardEl.appendChild(this.moleEl);

    // 黑暗遮罩层（透明洞跟随鼹鼠）
    this.overlayEl = document.createElement("div");
    this.overlayEl.className = "mvs-dark";
    this.overlayEl.style.width = `${this.grid * this.cellPx}px`;
    this.overlayEl.style.height = `${this.grid * this.cellPx}px`;
    this.boardEl.appendChild(this.overlayEl);

    this.placeMole();
    wrap.appendChild(this.boardEl);

    // 方向按钮
    const pad = document.createElement("div");
    pad.className = "mvs-pad";
    const mk = (label: string, dx: number, dy: number) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mvs-pad-btn";
      b.textContent = label;
      b.addEventListener("click", () => this.tryMove(dx, dy));
      return b;
    };
    const up = mk("⬆️", 0, -1);
    const left = mk("⬅️", -1, 0);
    const right = mk("➡️", 1, 0);
    const down = mk("⬇️", 0, 1);
    pad.appendChild(up);
    const mid2 = document.createElement("div");
    mid2.className = "mvs-pad-mid";
    mid2.appendChild(left);
    mid2.appendChild(right);
    pad.appendChild(mid2);
    pad.appendChild(down);
    wrap.appendChild(pad);

    this.root.appendChild(wrap);

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

  private placeMole(): void {
    if (!this.moleEl) return;
    const s = this.cellPx;
    this.moleEl.style.left = `${this.mx * s}px`;
    this.moleEl.style.top = `${this.my * s}px`;
    // 更新黑暗遮罩的透明洞（跟随鼹鼠中心）
    if (this.overlayEl) {
      const cx = (this.mx + 0.5) * s;
      const cy = (this.my + 0.5) * s;
      const radius = s * 1.5; // 视野半径：约 1.5 格
      this.overlayEl.style.background = `radial-gradient(circle ${radius}px at ${cx}px ${cy}px, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.92) 100%)`;
    }
  }

  private tryMove(dx: number, dy: number): void {
    const nx = this.mx + dx;
    const ny = this.my + dy;
    if (nx < 0 || ny < 0 || nx >= this.grid || ny >= this.grid) return;
    this.mx = nx;
    this.my = ny;
    sfxPop();
    this.placeMole();
    // 检查是否踩到蘑菇
    const idx = this.mushrooms.findIndex((m) => m.x === nx && m.y === ny);
    if (idx >= 0) {
      const m = this.mushrooms[idx]!;
      this.mushrooms.splice(idx, 1);
      // 移除蘑菇 DOM
      const nodes = this.boardEl?.querySelectorAll(".mvs-shroom");
      nodes?.forEach((n) => {
        if (
          n instanceof HTMLElement &&
          n.dataset.x === String(m.x) &&
          n.dataset.y === String(m.y)
        ) {
          n.classList.add("mvs-shroom--got");
        }
      });
      this.found += 1;
      const r = this.boardEl?.getBoundingClientRect();
      this.onCorrect(
        r ? r.left + (nx + 0.5) * this.cellPx : window.innerWidth / 2,
        r ? r.top + (ny + 0.5) * this.cellPx : window.innerHeight / 2,
      );
      this.resetWrongStreak();
      const left = this.root.querySelector("#mvs-left");
      if (left) left.textContent = String(this.mushrooms.length);
      if (this.mushrooms.length <= 0) {
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
  }

  private injectStyle(): void {
    if (document.getElementById("mvs-style")) return;
    const st = document.createElement("style");
    st.id = "mvs-style";
    st.textContent = MVS_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function MVS_CSS(theme: string): string {
  return `
.mvs-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.mvs-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.mvs-board{position:relative;background:radial-gradient(circle at 40% 40%,#5a4a3a,#3a2a1a);border:6px solid #2a1d12;border-radius:18px;box-shadow:var(--shadow-lg),inset 0 0 40px rgba(0,0,0,.6);overflow:hidden;}
.mvs-shroom{position:absolute;display:flex;align-items:center;justify-content:center;font-size:1.6rem;z-index:1;transition:transform .2s ease,opacity .3s ease;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));}
.mvs-shroom--got{transform:scale(1.6) rotate(20deg);opacity:0;pointer-events:none;}
.mvs-mole{position:absolute;display:flex;align-items:center;justify-content:center;font-size:1.5rem;z-index:3;transition:left .12s ease,top .12s ease;filter:drop-shadow(0 0 8px rgba(255,220,120,.6)) drop-shadow(0 2px 3px rgba(0,0,0,.5));}
.mvs-dark{position:absolute;left:0;top:0;z-index:2;pointer-events:none;transition:background .12s ease;}
.mvs-pad{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:4px;}
.mvs-pad-mid{display:flex;gap:6px;}
.mvs-pad-btn{width:64px;height:64px;border:none;border-radius:16px;background:linear-gradient(180deg,#fff,${theme}33);font-size:1.6rem;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.1);transition:transform .08s;touch-action:manipulation;}
.mvs-pad-btn:active{transform:translateY(3px);}
@media (max-width:380px){.mvs-pad-btn{width:54px;height:54px;font-size:1.3rem;}}
`;
}

export function create(): MoleVisionGame {
  return new MoleVisionGame();
}
