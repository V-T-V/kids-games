/* 像素画 Pixel Art —— 网格里每格标了数字（1=红/2=蓝/3=黄），
   孩子选颜色后点对应数字的格子，填满画出像素图。
   巧思：预设可识别图案（爱心/箭头/房子），保证"画出来像样"。
   先选调色板颜色，再点对应数字的格子；选错色点错格判错。
   视觉：网格 + 调色板。难度=网格大小。通关=填完目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

/** 数字 → 颜色映射（固定 3 色 + 留白 0） */
const PALETTE: Record<number, { name: string; hex: string }> = {
  1: { name: "红", hex: "#ff5252" },
  2: { name: "蓝", hex: "#4d96ff" },
  3: { name: "黄", hex: "#ffd93d" },
};

/** 预设图案：5x5 或 6x6 网格，0=空白格，1/2/3=对应颜色。
 *  每个图案都用真实可识别的形状。 */
interface Pattern {
  size: number;
  name: string;
  emoji: string;
  grid: number[][]; // [row][col]
}

const PATTERNS: Pattern[] = [
  {
    // 爱心（5x5）
    size: 5,
    name: "爱心",
    emoji: "❤️",
    grid: [
      [0, 1, 0, 1, 0],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
  },
  {
    // 箭头（5x5）
    size: 5,
    name: "上箭头",
    emoji: "⬆️",
    grid: [
      [0, 0, 2, 0, 0],
      [0, 2, 2, 2, 0],
      [2, 2, 2, 2, 2],
      [0, 0, 2, 0, 0],
      [0, 0, 2, 0, 0],
    ],
  },
  {
    // 星星（5x5）
    size: 5,
    name: "星星",
    emoji: "⭐",
    grid: [
      [0, 0, 3, 0, 0],
      [3, 3, 3, 3, 3],
      [0, 3, 3, 3, 0],
      [3, 3, 0, 3, 3],
      [3, 0, 0, 0, 3],
    ],
  },
  {
    // 房子（5x5，双色）
    size: 5,
    name: "房子",
    emoji: "🏠",
    grid: [
      [0, 0, 2, 0, 0],
      [0, 2, 2, 2, 0],
      [2, 2, 2, 2, 2],
      [1, 1, 3, 1, 1],
      [1, 1, 1, 1, 1],
    ],
  },
  {
    // 花（5x5，双色）
    size: 5,
    name: "花",
    emoji: "🌸",
    grid: [
      [0, 1, 0, 1, 0],
      [1, 3, 1, 3, 1],
      [0, 1, 2, 1, 0],
      [0, 0, 2, 0, 0],
      [0, 2, 0, 2, 0],
    ],
  },
];

export class PixelArtGame extends BaseGame {
  constructor() {
    super("pixel-art");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private remaining = 0;
  private selected = 0; // 当前选中颜色（1/2/3）

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private startRound(): void {
    this.selected = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 按难度选图案：easy 单色简单，hard 多色
    const pool =
      this.difficulty === "easy"
        ? PATTERNS.filter((p) => distinctColors(p) === 1)
        : this.difficulty === "medium"
          ? PATTERNS.filter((p) => distinctColors(p) <= 2)
          : PATTERNS;
    const pat = sample(pool.length > 0 ? pool : PATTERNS);
    const usedNums = [...new Set(pat.grid.flat().filter((n) => n !== 0))];

    // 统计需要填的格子数
    let need = 0;
    pat.grid.forEach((row) =>
      row.forEach((v) => {
        if (v !== 0) need += 1;
      }),
    );
    this.remaining = need;

    const wrap = document.createElement("div");
    wrap.className = "pa2-wrap";

    const task = document.createElement("div");
    task.className = "pa2-task";
    task.textContent = `选颜色，点对应数字填出 ${pat.emoji}（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 调色板（只显示本图案用到的颜色）
    const palette = document.createElement("div");
    palette.className = "pa2-palette";
    usedNums.forEach((n) => {
      const c = PALETTE[n]!;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pa2-pal";
      b.dataset.num = String(n);
      b.style.background = c.hex;
      b.innerHTML = `<span class="pa2-pal__num">${n}</span>`;
      b.addEventListener("click", () => this.selectColor(n, b));
      palette.appendChild(b);
    });
    wrap.appendChild(palette);

    const pickTip = document.createElement("div");
    pickTip.className = "pa2-tip";
    pickTip.id = "pa2-tip";
    pickTip.textContent = "先点上面的颜色～";
    wrap.appendChild(pickTip);

    // 网格
    const gridEl = document.createElement("div");
    gridEl.className = "pa2-grid";
    gridEl.style.gridTemplateColumns = `repeat(${pat.size},1fr)`;
    pat.grid.forEach((row, r) => {
      row.forEach((v, c) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "pa2-cell";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        if (v === 0) {
          cell.classList.add("pa2-cell--blank");
          cell.disabled = true;
        } else {
          cell.classList.add("pa2-cell--todo");
          cell.dataset.num = String(v);
          const num = document.createElement("span");
          num.className = "pa2-cell__num";
          num.textContent = String(v);
          cell.appendChild(num);
          cell.addEventListener("click", () => this.fillCell(v, cell));
        }
        gridEl.appendChild(cell);
      });
    });
    wrap.appendChild(gridEl);

    this.root.appendChild(wrap);
  }

  private selectColor(n: number, btn: HTMLButtonElement): void {
    this.selected = n;
    this.root
      .querySelectorAll<HTMLButtonElement>(".pa2-pal")
      .forEach((b) => b.classList.remove("pa2-pal--on"));
    btn.classList.add("pa2-pal--on");
    const tip = this.root.querySelector("#pa2-tip");
    if (tip)
      tip.textContent = `选中了 ${PALETTE[n]!.name}色，点数字 ${n} 的格子～`;
  }

  private fillCell(target: number, cell: HTMLButtonElement): void {
    if (cell.classList.contains("pa2-cell--done")) return;
    if (this.selected === 0) {
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    if (this.selected === target) {
      cell.classList.remove("pa2-cell--todo");
      cell.classList.add("pa2-cell--done");
      cell.style.background = PALETTE[target]!.hex;
      const num = cell.querySelector(".pa2-cell__num");
      if (num) num.textContent = "";
      sfxPop();
      const r = cell.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.remaining -= 1;
      if (this.remaining <= 0) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 900);
      }
    } else {
      cell.classList.add("pa2-cell--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => cell.classList.remove("pa2-cell--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先选颜色，再点一样数字的格子～",
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
    if (document.getElementById("pa2-style")) return;
    const st = document.createElement("style");
    st.id = "pa2-style";
    st.textContent = PA2_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

/** 图案用到几种颜色 */
function distinctColors(p: Pattern): number {
  return new Set(p.grid.flat().filter((n) => n !== 0)).size;
}

function PA2_CSS(theme: string): string {
  return `
.pa2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.pa2-task{font-size:1.08rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.pa2-palette{display:flex;gap:14px;}
.pa2-pal{position:relative;width:58px;height:58px;border-radius:16px;border:4px solid #fff;box-shadow:0 3px 7px rgba(0,0,0,.2);cursor:pointer;transition:transform .1s,box-shadow .2s;}
.pa2-pal:active{transform:scale(.92);}
.pa2-pal--on{transform:translateY(-3px) scale(1.06);box-shadow:0 0 0 4px ${theme},0 6px 12px rgba(0,0,0,.25);}
.pa2-pal__num{position:absolute;top:2px;left:4px;font-size:.95rem;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6);}
.pa2-tip{font-size:.95rem;font-weight:700;color:var(--ink-soft);}
.pa2-grid{display:grid;gap:4px;background:rgba(255,255,255,.5);padding:8px;border-radius:16px;box-shadow:var(--shadow);width:min(320px,80vw);}
.pa2-cell{aspect-ratio:1/1;border:none;border-radius:8px;background:#fff;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s,transform .1s;}
.pa2-cell--blank{background:rgba(0,0,0,.04);cursor:default;}
.pa2-cell--todo{background:#fff;}
.pa2-cell--todo .pa2-cell__num{font-size:1.3rem;font-weight:800;color:var(--ink);}
.pa2-cell--done{box-shadow:inset 0 0 0 2px rgba(255,255,255,.4);animation:pa2-fill .25s ease;}
.pa2-cell--wrong{animation:pa2-shake .4s ease;}
@keyframes pa2-fill{0%{transform:scale(.6)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes pa2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (max-width:380px){.pa2-pal{width:50px;height:50px;}.pa2-cell--todo .pa2-cell__num{font-size:1.1rem;}}
`;
}

export function create(): PixelArtGame {
  return new PixelArtGame();
}
