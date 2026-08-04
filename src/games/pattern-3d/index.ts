/* 3D 规律 Pattern 3D —— 一排立体图形 emoji（🎲🧊🎲🧊?），孩子选出下一个。
   独特点：用立体感强的 emoji（骰子/方块/球/金字塔）做视觉规律题。
   巧思：规律用 AB/ABC/AABB/ABCABC 等可验证模板生成，保证唯一答案。
   前缀 p3d-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

const SHAPES = ["🎲", "🧊", "🔵", "🔺", "🧊", "🟪", "🟡", "🟢"];

interface Template {
  /** 用形状池生成完整的一周期序列 */
  build: (pool: string[]) => string[];
  hint: string;
}

const TEMPLATES: Template[] = [
  { hint: "ABABAB…", build: (p) => [p[0]!, p[1]!] },
  { hint: "ABCABC…", build: (p) => [p[0]!, p[1]!, p[2]!] },
  { hint: "AABBAABB…", build: (p) => [p[0]!, p[0]!, p[1]!, p[1]!] },
  { hint: "AABAAB…", build: (p) => [p[0]!, p[0]!, p[1]!] },
  { hint: "ABACABAC…", build: (p) => [p[0]!, p[1]!, p[0]!, p[2]!] },
];

export class Pattern3DGame extends BaseGame {
  constructor() {
    super("pattern-3d");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private answer = "";

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

    const tmplIdx =
      this.difficulty === "easy"
        ? sample([0, 0, 1])
        : this.difficulty === "medium"
          ? sample([1, 2, 3])
          : sample([2, 3, 4]);
    const tmpl = TEMPLATES[tmplIdx]!;
    // 选独特的形状池（去重 emoji）
    const pool = shuffle(SHAPES).filter((s, i, arr) => arr.indexOf(s) === i);
    const period = tmpl.build(pool.slice(0, 3));
    // 展示长度：3-5 个周期，最后一个是问号
    const cycleCount = this.difficulty === "easy" ? 2 : 3;
    const seq: string[] = [];
    for (let i = 0; i < cycleCount + 1; i++) {
      for (const c of period) seq.push(c);
    }
    const shown = seq.slice(0, -1);
    this.answer = seq[seq.length - 1]!;

    // 选项 = 答案 + 3 个干扰（来自池/全集）
    const distractors = shuffle(SHAPES.filter((s) => s !== this.answer)).slice(
      0,
      3,
    );
    const options = shuffle([this.answer, ...distractors]);

    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "p3d-wrap";

    const task = document.createElement("div");
    task.className = "p3d-task";
    task.innerHTML = `找规律，下一个是<b>什么</b>？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "p3d-hint";
    hint.textContent = `规律提示：${tmpl.hint}`;
    wrap.appendChild(hint);

    const row = document.createElement("div");
    row.className = "p3d-row";
    for (const s of shown) {
      const cell = document.createElement("div");
      cell.className = "p3d-cell";
      cell.textContent = s;
      row.appendChild(cell);
    }
    const q = document.createElement("div");
    q.className = "p3d-cell p3d-cell--q";
    q.textContent = "?";
    row.appendChild(q);
    wrap.appendChild(row);

    const opts = document.createElement("div");
    opts.className = "p3d-opts";
    for (const o of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "p3d-opt";
      b.textContent = o;
      b.addEventListener("click", () => this.choose(o, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(c: string, btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    if (c === this.answer) {
      btn.classList.add("p3d-opt--correct");
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
      }, 850);
    } else {
      btn.classList.add("p3d-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".p3d-opt--wrong")
          .forEach((el) => el.classList.remove("p3d-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("p3d-style")) return;
    const st = document.createElement("style");
    st.id = "p3d-style";
    st.textContent = P3D_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function P3D_CSS(theme: string): string {
  return `
.p3d-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.p3d-task{font-size:1.1rem;font-weight:800;text-align:center;color:var(--ink);}
.p3d-task b{color:${theme};}
.p3d-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.p3d-hint{font-size:.9rem;font-weight:700;color:var(--ink-soft);background:#fff;padding:4px 14px;border-radius:999px;box-shadow:var(--shadow);}
.p3d-row{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:14px;background:linear-gradient(160deg,#fff,#eef4ff);border-radius:18px;box-shadow:var(--shadow);max-width:560px;}
.p3d-cell{width:58px;height:58px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:2rem;background:linear-gradient(160deg,#fff,#e8efff);box-shadow:inset 0 -3px 4px rgba(0,0,0,.1),0 2px 4px rgba(0,0,0,.08);transition:transform .15s;}
.p3d-cell:hover{transform:translateY(-3px);}
.p3d-cell--q{background:linear-gradient(160deg,#fff3b0,#ffd93d);color:#7a5b00;font-weight:900;font-size:1.8rem;animation:p3d-blink 1.2s ease-in-out infinite;}
@keyframes p3d-blink{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.p3d-opts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;width:100%;max-width:420px;}
@media (max-width:380px){.p3d-opts{grid-template-columns:repeat(2,1fr);}.p3d-cell{width:48px;height:48px;font-size:1.6rem;}}
.p3d-opt{padding:18px 4px;border:3px solid transparent;border-radius:16px;background:#fff;box-shadow:var(--shadow);cursor:pointer;font-size:2rem;min-height:64px;transition:transform .12s ease,border-color .2s,background .2s;}
.p3d-opt:active{transform:scale(.93);}
.p3d-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:p3d-yes .4s ease;}
@keyframes p3d-yes{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
.p3d-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:p3d-no .3s ease;}
@keyframes p3d-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): Pattern3DGame {
  return new Pattern3DGame();
}
