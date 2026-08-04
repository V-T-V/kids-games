/* 十字绣 Stitch Pattern —— 网格上已有部分绣好的花纹（用彩色 X 标记），
   孩子根据规律把剩余空格补全成相同颜色的 X。
   独特点：规律识别 + 创造补全，理解颜色循环模式。
   视觉：网格 + 彩色 X 标记 + 调色盘。
   难度 = 网格大小（easy 3x3 / medium 4x4 / hard 5x5）。通关 = 绣完目标轮数。
   保证有解：所有空格的正确答案来自题目本身预设的规律（按列循环或棋盘）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

const THREADS = ["#ff6b9d", "#4d96ff", "#ffd93d", "#6bcf7f", "#a55eea"];

/** 一个格子的状态：null = 空，string = 已绣颜色 */
type Cell = string | null;

export class StitchPatternGame extends BaseGame {
  constructor() {
    super("stitch-pattern");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private size = 3;
  private solution: Cell[] = [];
  private cells: HTMLDivElement[] = [];
  private selectedColor = "";
  private remaining = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.size =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  /** 生成有规律的全解图案：
      方案 A：每行循环同色（条纹）；
      方案 B：棋盘（i+j)%2 双色交替；
      方案 C：每列循环同色。
      用 2-3 种颜色。 */
  private buildSolution(): Cell[] {
    const n = this.size;
    const colors = shuffle(THREADS).slice(0, n <= 3 ? 2 : 3);
    const mode = sample(["row", "col", "checker"] as const);
    const grid: Cell[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (mode === "row") grid.push(colors[i % colors.length]!);
        else if (mode === "col") grid.push(colors[j % colors.length]!);
        else grid.push(colors[(i + j) % colors.length]!);
      }
    }
    return grid;
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.solution = this.buildSolution();
    const n = this.size;
    const total = n * n;
    this.cells = [];

    // 决定每个格子是否预先绣好（约 45% 预填，保证剩余可补全）
    const prefilled = new Array(total).fill(false);
    const idxList = shuffle([...Array(total).keys()]);
    const preCount = Math.floor(total * 0.45);
    for (let k = 0; k < preCount; k++) prefilled[idxList[k]!] = true;
    this.remaining = total - preCount;
    this.selectedColor = "";

    const wrap = document.createElement("div");
    wrap.className = "sth-wrap";

    const task = document.createElement("div");
    task.className = "sth-task";
    task.innerHTML = `看规律，把空白格子绣满 · 第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关`;
    wrap.appendChild(task);

    // 调色盘
    const palette = document.createElement("div");
    palette.className = "sth-palette";
    const usedColors = Array.from(
      new Set(this.solution.filter(Boolean)),
    ) as string[];
    shuffle(usedColors).forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sth-swatch";
      btn.style.background = c;
      btn.dataset.color = c;
      btn.setAttribute("aria-label", "选线");
      btn.addEventListener("click", () => this.pickColor(c, btn));
      palette.appendChild(btn);
    });
    wrap.appendChild(palette);

    const hint = document.createElement("div");
    hint.className = "sth-hint";
    hint.textContent = "先点选一个颜色，再点格子绣 X";
    wrap.appendChild(hint);

    // 网格（绣布）
    const cloth = document.createElement("div");
    cloth.className = "sth-cloth";
    cloth.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    for (let i = 0; i < total; i++) {
      const cell = document.createElement("div");
      cell.className = "sth-cell";
      cell.dataset.idx = String(i);
      if (prefilled[i]) {
        cell.classList.add("sth-cell--done");
        cell.style.color = this.solution[i]!;
        cell.innerHTML = `<span class="sth-x">✕</span>`;
      } else {
        cell.addEventListener("click", () => this.stitch(i, cell));
      }
      cloth.appendChild(cell);
      this.cells.push(cell);
    }
    wrap.appendChild(cloth);
    this.root.appendChild(wrap);
  }

  private pickColor(c: string, btn: HTMLButtonElement): void {
    if (this.locked) return;
    this.selectedColor = c;
    this.root
      .querySelectorAll(".sth-swatch")
      .forEach((s) => s.classList.remove("sth-swatch--sel"));
    btn.classList.add("sth-swatch--sel");
    sfxPop();
  }

  private stitch(idx: number, cell: HTMLDivElement): void {
    if (this.locked) return;
    if (cell.classList.contains("sth-cell--done")) return;
    if (!this.selectedColor) {
      // 没选颜色，轻提示
      cell.classList.add("sth-cell--blink");
      this.trackTimeout(() => cell.classList.remove("sth-cell--blink"), 360);
      return;
    }
    if (this.selectedColor === this.solution[idx]) {
      cell.classList.add("sth-cell--done");
      cell.style.color = this.selectedColor;
      cell.innerHTML = `<span class="sth-x">✕</span>`;
      sfxPop();
      const r = cell.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.remaining -= 1;
      if (this.remaining <= 0) {
        this.locked = true;
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 700);
      }
    } else {
      // 颜色错了：闪一下红色但不消耗（不留下错误痕迹）
      cell.classList.add("sth-cell--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => cell.classList.remove("sth-cell--wrong"), 420);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看每一行/每一列的颜色规律，再选对颜色哦～",
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
    if (document.getElementById("sth-style")) return;
    const st = document.createElement("style");
    st.id = "sth-style";
    st.textContent = STH_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function STH_CSS(theme: string): string {
  return `
.sth-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(440px,100%);}
.sth-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.sth-task b{color:${theme};}
.sth-palette{display:flex;gap:10px;}
.sth-swatch{width:40px;height:40px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.2),inset 0 -3px 5px rgba(0,0,0,.2);cursor:pointer;transition:transform .12s ease;}
.sth-swatch:active{transform:scale(.9);}
.sth-swatch--sel{transform:scale(1.18);border-color:${theme};box-shadow:0 0 0 3px ${theme}55,0 3px 6px rgba(0,0,0,.25);}
.sth-hint{font-size:.9rem;color:#888;font-weight:600;}
.sth-cloth{display:grid;gap:2px;padding:10px;background:repeating-linear-gradient(45deg,#fff 0 8px,#f3e9f7 8px 16px);border-radius:14px;box-shadow:var(--shadow);width:min(320px,80vw);aspect-ratio:1;}
.sth-cell{background:#fff;border:1px solid #eee;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s ease;user-select:none;}
.sth-cell:hover{background:#fafafa;}
.sth-cell--done{background:#fff;cursor:default;}
.sth-x{font-size:1.7rem;font-weight:900;line-height:1;animation:sth-pop .3s ease;}
.sth-cell--wrong{animation:sth-shake .4s ease;background:#ffe0e0;}
.sth-cell--blink{animation:sth-shake .35s ease;}
@keyframes sth-pop{0%{transform:scale(.3) rotate(-30deg)}100%{transform:scale(1) rotate(0)}}
@keyframes sth-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@media (max-width:380px){.sth-x{font-size:1.3rem;}.sth-swatch{width:34px;height:34px;}}
`;
}

export function create(): StitchPatternGame {
  return new StitchPatternGame();
}
