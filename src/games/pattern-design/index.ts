/* 图案设计 Pattern Design —— 用基本图形补全重复图案的规律。
   艺术启蒙：模式识别 + 审美。独特点：一行重复图形序列，缺一个或两个，
   从候选里选出正确图形补上。数据保证规律清晰可解。前缀 pds-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Puzzle {
  /** 完整序列（包括空缺处的正确答案） */
  full: string[];
  /** 哪几个位置是空缺（索引） */
  blanks: number[];
  /** 候选答案池（含正确） */
  pool: string[];
}

const SHAPES = ["🔴", "🟡", "🔵", "🟢", "🟣", "🟠", "⭐", "🔺", "🟦", "🔶"];

/** 构造一个可解规律谜题：基础重复单元 + 缺口。 */
function makePuzzle(blanks: number): Puzzle {
  // 重复单元长度 2 或 3
  const unitLen = Math.random() < 0.5 ? 2 : 3;
  const unitShapes = shuffle(SHAPES).slice(0, unitLen);
  // 总长度 6 或 8
  const total = unitLen === 2 ? 6 : unitLen === 3 ? 9 : 6;
  const full: string[] = [];
  for (let i = 0; i < total; i++) {
    full.push(unitShapes[i % unitLen]!);
  }
  // 选空缺位置（避开彼此太近导致歧义，且保证答案唯一）
  const blankIdx: number[] = [];
  const positions = shuffle(full.map((_, i) => i)).filter(
    (i) => i > 0 && i < total - 1,
  );
  for (const p of positions) {
    if (blankIdx.length >= blanks) break;
    // 避免相邻空缺
    if (blankIdx.some((b) => Math.abs(b - p) <= 1)) continue;
    blankIdx.push(p);
  }
  blankIdx.sort((a, b) => a - b);
  // 干扰选项：用未在单元里的形状
  const used = new Set(unitShapes);
  const distract = SHAPES.filter((s) => !used.has(s)).slice(0, blanks + 1);
  // 正确答案集合（去重）
  const correct = blankIdx.map((i) => full[i]!);
  const pool = shuffle([...correct, ...distract]);
  return { full, blanks: blankIdx, pool };
}

export class PatternDesignGame extends BaseGame {
  constructor() {
    super("pattern-design");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private puzzle: Puzzle | null = null;
  private filled: number = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private blanks(): number {
    return this.difficulty === "easy"
      ? 1
      : this.difficulty === "medium"
        ? 1
        : 2;
  }

  private startRound(): void {
    this.locked = false;
    this.filled = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const p = makePuzzle(this.blanks());
    this.puzzle = p;

    const wrap = document.createElement("div");
    wrap.className = "pds-wrap";

    const task = document.createElement("div");
    task.className = "pds-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 找出<b>规律</b>，把缺的图形补上`;
    wrap.appendChild(task);

    // 图案行
    const row = document.createElement("div");
    row.className = "pds-row";
    p.full.forEach((shape, i) => {
      const cell = document.createElement("div");
      cell.className = "pds-cell";
      if (p.blanks.includes(i)) {
        cell.classList.add("pds-cell--blank");
        cell.id = `pds-blank-${i}`;
        cell.dataset.idx = String(i);
        cell.innerHTML = `<span class="pds-cell__q">?</span>`;
      } else {
        cell.innerHTML = `<span class="pds-cell__shape">${shape}</span>`;
      }
      row.appendChild(cell);
    });
    wrap.appendChild(row);

    // 候选
    const hint = document.createElement("div");
    hint.className = "pds-hint";
    hint.textContent = "👉 选一个图形点缺的位置";
    wrap.appendChild(hint);

    const opts = document.createElement("div");
    opts.className = "pds-opts";
    p.pool.forEach((shape) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pds-opt";
      b.innerHTML = `<span class="pds-opt__shape">${shape}</span>`;
      b.dataset.shape = shape;
      b.addEventListener("click", () => this.pickShape(shape));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private pickShape(shape: string): void {
    if (this.locked || !this.puzzle) return;
    // 找下一个未填空缺
    const nextBlank = this.puzzle.blanks.find((i) => {
      const el = this.root.querySelector<HTMLElement>(`#pds-blank-${i}`);
      return !el?.dataset.filled;
    });
    if (nextBlank == null) return;
    const cell = this.root.querySelector<HTMLElement>(
      `#pds-blank-${nextBlank}`,
    );
    if (!cell) return;
    const correct = this.puzzle.full[nextBlank]!;
    if (shape === correct) {
      cell.innerHTML = `<span class="pds-cell__shape pds-cell__shape--in">${shape}</span>`;
      cell.dataset.filled = "1";
      cell.classList.add("pds-cell--done");
      sfxPop();
      const r = cell.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.filled += 1;
      if (this.filled >= this.puzzle.blanks.length) {
        this.locked = true;
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1000);
      }
    } else {
      cell.classList.add("pds-cell--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => cell.classList.remove("pds-cell--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "找规律～",
      emoji: "🔁",
      variant: "rest",
      body: "看看图形是按什么顺序重复的，比如红黄红黄红黄，缺的就是下一个～",
      primary: { text: "继续", icon: "✨", onClick: () => ov.destroy() },
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
    if (document.getElementById("pds-style")) return;
    const st = document.createElement("style");
    st.id = "pds-style";
    st.textContent = PDS_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function PDS_CSS(theme: string): string {
  return `
.pds-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(500px,100%);}
.pds-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.pds-task b{color:${theme};}
.pds-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;background:#fff;padding:18px 14px;border-radius:22px;box-shadow:var(--shadow);}
.pds-cell{width:56px;height:56px;border-radius:14px;background:#f6f7ff;display:flex;align-items:center;justify-content:center;}
.pds-cell--blank{background:linear-gradient(135deg,#fff5b3,#ffe066);border:2px dashed #d4a017;}
.pds-cell--done{background:#d4f4dd;}
.pds-cell__q{font-size:1.8rem;font-weight:900;color:#b8860b;}
.pds-cell__shape{font-size:2rem;}
.pds-cell__shape--in{animation:pds-in .35s ease;}
@keyframes pds-in{0%{transform:scale(.3) rotate(-30deg)}60%{transform:scale(1.3) rotate(10deg)}100%{transform:scale(1) rotate(0)}}
.pds-cell--wrong{animation:pds-shake .4s ease;}
@keyframes pds-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.pds-hint{font-size:.95rem;font-weight:800;color:#778;}
.pds-opts{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.pds-opt{width:60px;height:60px;border-radius:14px;background:#fff;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .12s;}
.pds-opt:active{transform:scale(.88);}
.pds-opt__shape{font-size:2rem;}
`;
}

export function create(): PatternDesignGame {
  return new PatternDesignGame();
}
