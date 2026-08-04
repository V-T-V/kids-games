/* 逻辑网格 Logic Grid —— 3x3 网格里每行每列放一种颜色（红/蓝/黄），
   不能重复。给出几条线索（"红色不在中间"、"蓝色在左边"），从 3 个候选
   排列里选出唯一符合所有线索的那个。简化版：根据线索排除错误答案。
   独特点：把经典逻辑推理题做成"看线索选排列"的选择题，保证有解。
   前缀 lg2-（lg- 已被别的逻辑游戏占用）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

type Cell = "red" | "blue" | "yellow";
type Grid = Cell[]; // 长度9，行优先

const COLORS: { id: Cell; name: string; emoji: string; hex: string }[] = [
  { id: "red", name: "红", emoji: "🍎", hex: "#ff5252" },
  { id: "blue", name: "蓝", emoji: "🫐", hex: "#4d96ff" },
  { id: "yellow", name: "黄", emoji: "🍋", hex: "#ffd93d" },
];

const POS_NAME = ["左", "中", "右"];
const ROW_NAME = ["上", "中", "下"];

/** 生成一个标准解：每行每列都不重复（3阶拉丁方）。共 12 种。 */
function buildSolution(): Grid {
  // 用两个基础排列循环平移构造拉丁方
  const base: Cell[] = ["red", "blue", "yellow"];
  const rows: Cell[] = [];
  const off = sample([0, 1, 2]);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      rows.push(base[(c + off + r) % 3]!);
    }
  }
  return rows;
}

/** 把一条线索（行列位置约束）变成自然语言。 */
interface Clue {
  text: string;
  test: (g: Grid) => boolean;
}

function makeClues(answer: Grid, count: number): Clue[] {
  const pool: Clue[] = [];
  // 类型1：某个位置是什么颜色
  for (let i = 0; i < 9; i++) {
    const c = answer[i]!;
    const meta = COLORS.find((x) => x.id === c)!;
    const row = Math.floor(i / 3);
    const col = i % 3;
    pool.push({
      text: `${meta.emoji}${meta.name}色在${ROW_NAME[row]!}排${POS_NAME[col]!}边`,
      test: (g) => g[i] === c,
    });
  }
  // 类型2：某行不含某色（排除式线索）
  for (let r = 0; r < 3; r++) {
    const rowColors = [answer[r * 3]!, answer[r * 3 + 1]!, answer[r * 3 + 2]!];
    for (const meta of COLORS) {
      if (!rowColors.includes(meta.id)) {
        pool.push({
          text: `${ROW_NAME[r]!}排没有${meta.emoji}${meta.name}色`,
          test: (g) =>
            g[r * 3] !== meta.id &&
            g[r * 3 + 1] !== meta.id &&
            g[r * 3 + 2] !== meta.id,
        });
      }
    }
  }
  return shuffle(pool).slice(0, count);
}

/** 生成错误候选：打乱 answer 但保持是有效拉丁方，且至少违反一条线索。 */
function makeWrong(answer: Grid): Grid {
  for (let attempt = 0; attempt < 40; attempt++) {
    const cand = shuffle(answer);
    if (isValidLatin(cand) && !gridsEqual(cand, answer)) return cand;
  }
  // 兜底：整体颜色置换
  const perm = sample([
    ["red", "blue", "yellow"],
    ["yellow", "red", "blue"],
  ] as Cell[][])!;
  const map: Record<Cell, Cell> = {
    red: perm[0]!,
    blue: perm[1]!,
    yellow: perm[2]!,
  };
  return answer.map((c) => map[c]);
}

function isValidLatin(g: Grid): boolean {
  for (let r = 0; r < 3; r++) {
    const row = new Set([g[r * 3], g[r * 3 + 1], g[r * 3 + 2]]);
    if (row.size !== 3) return false;
  }
  for (let c = 0; c < 3; c++) {
    const col = new Set([g[c], g[c + 3], g[c + 6]]);
    if (col.size !== 3) return false;
  }
  return true;
}

function gridsEqual(a: Grid, b: Grid): boolean {
  return a.every((v, i) => v === b[i]);
}

export class LogicGridGame extends BaseGame {
  constructor() {
    super("logic-grid");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 与定时器由基类清理 */
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const answer = buildSolution();
    const clueCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const clues = makeClues(answer, clueCount);
    // 错误候选必须违反至少一条线索
    const wrongs: Grid[] = [];
    while (wrongs.length < 2) {
      const w = makeWrong(answer);
      if (wrongs.some((x) => gridsEqual(x, w))) continue;
      // 确认它违反了某条线索（不满足全部线索）
      if (clues.some((cl) => !cl.test(w))) wrongs.push(w);
    }
    const options = shuffle([answer, ...wrongs]);

    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "lg2-wrap";

    const task = document.createElement("div");
    task.className = "lg2-task";
    task.innerHTML = `看线索，选<b>对的</b>颜色排列 <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const clueBox = document.createElement("div");
    clueBox.className = "lg2-clues";
    clueBox.innerHTML = `<div class="lg2-clues__title">🔎 线索</div>`;
    const list = document.createElement("ul");
    for (const cl of clues) {
      const li = document.createElement("li");
      li.textContent = cl.text;
      list.appendChild(li);
    }
    clueBox.appendChild(list);
    wrap.appendChild(clueBox);

    const optsWrap = document.createElement("div");
    optsWrap.className = "lg2-opts";
    options.forEach((opt, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lg2-opt";
      const grid = document.createElement("div");
      grid.className = "lg2-grid";
      for (let i = 0; i < 9; i++) {
        const cell = document.createElement("div");
        cell.className = "lg2-cell";
        const meta = COLORS.find((x) => x.id === opt[i])!;
        cell.style.setProperty("--lg2-c", meta.hex);
        cell.textContent = meta.emoji;
        grid.appendChild(cell);
      }
      b.appendChild(grid);
      const tag = document.createElement("span");
      tag.className = "lg2-opt__tag";
      tag.textContent = `排列 ${String.fromCharCode(65 + idx)}`;
      b.appendChild(tag);
      b.addEventListener("click", () => this.choose(opt, answer, b));
      optsWrap.appendChild(b);
    });
    wrap.appendChild(optsWrap);
    this.root.appendChild(wrap);
  }

  private choose(picked: Grid, answer: Grid, btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    const ok = gridsEqual(picked, answer);
    if (ok) {
      btn.classList.add("lg2-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      sfxPop();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("lg2-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".lg2-opt--wrong")
          .forEach((el) => el.classList.remove("lg2-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("lg2-style")) return;
    const st = document.createElement("style");
    st.id = "lg2-style";
    st.textContent = LG2_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function LG2_CSS(theme: string): string {
  return `
.lg2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.lg2-task{font-size:1.1rem;font-weight:800;text-align:center;color:var(--ink);}
.lg2-task b{color:${theme};}
.lg2-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.lg2-clues{width:100%;max-width:440px;background:linear-gradient(160deg,#fff,#eef2ff);border-radius:18px;padding:14px 18px;box-shadow:var(--shadow);}
.lg2-clues__title{font-weight:900;font-size:1rem;color:${theme};margin-bottom:6px;}
.lg2-clues ul{margin:0;padding-left:20px;}
.lg2-clues li{font-size:.98rem;font-weight:700;line-height:1.9;color:var(--ink);}
.lg2-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:100%;max-width:520px;}
@media (max-width:480px){.lg2-opts{grid-template-columns:repeat(2,1fr);}}
.lg2-opt{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px;border:3px solid transparent;border-radius:16px;background:#fff;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s ease,background .2s ease;}
.lg2-opt:active{transform:scale(.95);}
.lg2-opt__tag{font-size:.85rem;font-weight:800;color:var(--ink-soft);}
.lg2-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;}
.lg2-cell{width:38px;height:38px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;background:var(--lg2-c,#eee);box-shadow:inset 0 -2px 3px rgba(0,0,0,.12);}
.lg2-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:lg2-yes .4s ease;}
@keyframes lg2-yes{0%{transform:scale(1)}50%{transform:scale(1.06)}100%{transform:scale(1)}}
.lg2-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:lg2-no .3s ease;}
@keyframes lg2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
`;
}

export function create(): LogicGridGame {
  return new LogicGridGame();
}
