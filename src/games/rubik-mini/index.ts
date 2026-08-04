/* 迷你魔方 Rubik Mini —— 简化版：2x2 颜色网格，每格一种颜色，点格子循环
   切换颜色，目标是把全部格子变成同一种颜色（孩子先选的「目标色」）。
   视觉：彩色 2x2 卡片 + 颜色选择条 + 步数。难度=颜色种类。
   通关=归位目标轮数。保证有解：初始时所有格子已是单一颜色或可逐步归位。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";
import { starsByMoves } from "../../core/scoring.ts";

const COLORS = [
  { key: "red", hex: "#ff6b6b", name: "红" },
  { key: "yellow", hex: "#ffd93d", name: "黄" },
  { key: "green", hex: "#6bcf7f", name: "绿" },
  { key: "blue", hex: "#4d96ff", name: "蓝" },
];

export class RubikMiniGame extends BaseGame {
  constructor() {
    super("rubik-mini");
  }

  private kinds = 2;
  private cells: string[] = []; // 4 个格子当前的颜色 key
  private target: string = "red";
  private moves = 0;
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.kinds =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* 无定时器/动画需手动清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.moves = 0;

    const palette = COLORS.slice(0, this.kinds);
    // 目标色：从调色板随机
    this.target = sample(palette).key;
    // 初始：全部已归位概率应避免（不然没挑战）。生成时至少 1 格 != target。
    // 同时保证「可解」：因为是单格循环切换，任意状态都能在最多 (kinds-1)*4 步归位。
    const keys = palette.map((c) => c.key);
    do {
      this.cells = [];
      for (let i = 0; i < 4; i++) this.cells.push(sample(keys));
    } while (this.cells.every((c) => c === this.target));
    // 兜底保证非全对
    if (this.cells.every((c) => c === this.target)) {
      this.cells[0] = keys.find((k) => k !== this.target) ?? this.target;
    }

    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "rbk-wrap";

    const task = document.createElement("div");
    task.className = "rbk-task";
    task.innerHTML = `点格子切换颜色，让全部格子变成 <b style="color:${this.hexOf(this.target)}">${this.nameOf(this.target)}色</b>！<br><small>第 ${this.roundsDone + 1} / ${this.roundTotal} 关 · 步数 <b id="rbk-moves">0</b></small>`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "rbk-board";
    board.id = "rbk-board";
    for (let i = 0; i < 4; i++) {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "rbk-cell";
      c.dataset.idx = String(i);
      c.style.setProperty("--rbk-color", this.hexOf(this.cells[i]!));
      c.addEventListener("click", () => this.onCell(c, i));
      board.appendChild(c);
    }
    wrap.appendChild(board);

    // 颜色选择条（信息用）
    const legend = document.createElement("div");
    legend.className = "rbk-legend";
    palette.forEach((c) => {
      const s = document.createElement("span");
      s.className = "rbk-legend__chip";
      s.style.setProperty("--rbk-color", c.hex);
      s.textContent = c.name;
      legend.appendChild(s);
    });
    wrap.appendChild(legend);

    this.root.appendChild(wrap);
  }

  private onCell(cell: HTMLButtonElement, idx: number): void {
    const palette = COLORS.slice(0, this.kinds).map((c) => c.key);
    const cur = this.cells[idx]!;
    const i = palette.indexOf(cur);
    const next = palette[(i + 1) % palette.length]!;
    this.cells[idx] = next;
    cell.style.setProperty("--rbk-color", this.hexOf(next));
    sfxPop();
    this.moves += 1;
    const movesEl = this.root.querySelector<HTMLElement>("#rbk-moves");
    if (movesEl) movesEl.textContent = String(this.moves);

    if (this.cells.every((c) => c === this.target)) {
      // 全归位
      const r = cell.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      const board = this.root.querySelector<HTMLElement>("#rbk-board");
      board?.classList.add("rbk-board--done");
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(
            starsByMoves(this.moves, [this.kinds * 2, this.kinds * 4]),
          );
        } else {
          this.startRound();
        }
      }, 850);
    }
  }

  private hexOf(key: string): string {
    return COLORS.find((c) => c.key === key)?.hex ?? "#888";
  }
  private nameOf(key: string): string {
    return COLORS.find((c) => c.key === key)?.name ?? "?";
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "歇一歇～",
      emoji: "🟦",
      variant: "rest",
      body: "每个格子可以一直点，颜色会循环切换。把它们都变成上面的<b>目标色</b>～",
      primary: { text: "继续", icon: "🟦", onClick: () => ov.destroy() },
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
    if (document.getElementById("rbk-style")) return;
    const st = document.createElement("style");
    st.id = "rbk-style";
    st.textContent = RBK_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function RBK_CSS(theme: string): string {
  return `
.rbk-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;}
.rbk-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.rbk-task small{display:block;margin-top:3px;font-weight:700;color:#888;font-size:.82rem;}
.rbk-board{display:grid;grid-template-columns:repeat(2,110px);grid-auto-rows:110px;gap:8px;padding:12px;background:#2a2336;border:4px solid ${theme};border-radius:20px;box-shadow:var(--shadow-lg);transition:transform .3s;}
.rbk-board--done{animation:rbk-cheer .6s ease;}
.rbk-cell{border:none;border-radius:14px;background:var(--rbk-color,#888);box-shadow:inset 0 -6px 0 rgba(0,0,0,.18),inset 0 4px 0 rgba(255,255,255,.25),var(--shadow);transition:transform .14s,background .2s;cursor:pointer;}
.rbk-cell:active{transform:scale(.92);}
.rbk-cell:hover{transform:translateY(-2px);}
.rbk-legend{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.rbk-legend__chip{display:inline-flex;align-items:center;gap:6px;font-size:.85rem;font-weight:800;color:#555;background:#fff;padding:4px 10px;border-radius:999px;box-shadow:var(--shadow);}
.rbk-legend__chip::before{content:"";display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--rbk-color,#888);box-shadow:inset 0 -2px 0 rgba(0,0,0,.2);}
@keyframes rbk-cheer{0%{transform:scale(1)}50%{transform:scale(1.06) rotate(2deg)}100%{transform:scale(1)}}
@media (max-width:380px){.rbk-board{grid-template-columns:repeat(2,88px);grid-auto-rows:88px;}.rbk-cell{border-radius:12px;}}
`;
}

export function create(): RubikMiniGame {
  return new RubikMiniGame();
}
