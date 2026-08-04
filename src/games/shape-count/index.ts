/* 数图形 Shape-Count —— 一张图里混着多种形状，问「图里有几个三角形」，从选项选。
   独特点：在混合背景中数指定形状，训练选择性注意 + 计数。
   视觉：SVG 绘制的圆/三角/方/星，散布在画板里。难度=形状种类/数量。
   通关=答对目标轮数。前缀 shc- 避免冲突。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample, randInt } from "../../lobby/util.ts";

type ShapeKind = "triangle" | "circle" | "square" | "star";

const SHAPE_META: Record<
  ShapeKind,
  { name: string; color: string; svg: (size: number, key: number) => string }
> = {
  triangle: {
    name: "三角形",
    color: "#ff6348",
    svg: (_s, _k) => `<polygon points="50,8 92,88 8,88" />`,
  },
  circle: {
    name: "圆形",
    color: "#4d96ff",
    svg: (_s, _k) => `<circle cx="50" cy="50" r="44" />`,
  },
  square: {
    name: "正方形",
    color: "#6bcf7f",
    svg: (_s, _k) => `<rect x="10" y="10" width="80" height="80" rx="6" />`,
  },
  star: {
    name: "星形",
    color: "#ffd93d",
    svg: (_s, _k) =>
      `<polygon points="50,6 61,38 95,38 67,58 78,92 50,72 22,92 33,58 5,38 39,38" />`,
  },
};

const ENCOURAGE = ["数得真准！", "一个个数清楚～", "真厉害！", "差一点点！"];

export class ShapeCountGame extends BaseGame {
  constructor() {
    super("shape-count");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 形状种类数：easy 2，medium 3，hard 4 */
  private kindCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }
  /** 每种形状数量上限 */
  private maxPerKind(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const allKinds: ShapeKind[] = ["triangle", "circle", "square", "star"];
    const kinds = shuffle(allKinds).slice(0, this.kindCount()) as ShapeKind[];
    const maxPer = this.maxPerKind();

    /* 决定每种形状的数量：保证每种至少 1 个，最多 maxPer 个 */
    const counts: Record<string, number> = {};
    kinds.forEach((k) => {
      counts[k] = randInt(1, maxPer);
    });

    /* 选一个作为提问目标（任何一种都有 >=1 个，必定可答） */
    const target = sample(kinds);
    const answer = counts[target]!;

    /* 生成所有形状的散布列表，打乱后摆位 */
    const pieces: { kind: ShapeKind; id: number }[] = [];
    let id = 0;
    kinds.forEach((k) => {
      for (let i = 0; i < counts[k]!; i++) {
        pieces.push({ kind: k, id: id++ });
      }
    });
    const placed = shuffle(pieces);

    /* 生成干扰答案（与正确答案不同，互不相同），共 4 个选项含正确 */
    const optSet = new Set<number>([answer]);
    let guard = 0;
    while (optSet.size < 4 && guard < 50) {
      const cand = randInt(1, maxPer);
      optSet.add(cand);
      guard++;
    }
    /* 兜底：保证 4 个不同选项 */
    let extra = 1;
    while (optSet.size < 4) {
      optSet.add(answer + extra);
      extra++;
    }
    const options = shuffle([...optSet]);

    const wrap = document.createElement("div");
    wrap.className = "shc-wrap";

    const task = document.createElement("div");
    task.className = "shc-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 数一数图里有几个 <b style="color:${SHAPE_META[target].color}">${SHAPE_META[target].name}</b>`;
    wrap.appendChild(task);

    /* 形状画板 */
    const board = document.createElement("div");
    board.className = "shc-board";
    board.innerHTML = `<div class="shc-board-deco">🎨</div>`;
    /* 网格摆位，避免重叠 */
    const cols = placed.length <= 6 ? 3 : 4;
    const grid = document.createElement("div");
    grid.className = "shc-grid";
    grid.style.setProperty("--shc-cols", String(cols));
    placed.forEach((p, i) => {
      const meta = SHAPE_META[p.kind];
      const cell = document.createElement("div");
      cell.className = "shc-shape";
      cell.style.setProperty("--shc-rot", `${randInt(-12, 12)}deg`);
      cell.innerHTML = `<svg viewBox="0 0 100 100" style="fill:${meta.color};filter:drop-shadow(0 2px 3px rgba(0,0,0,.18));">${meta.svg(60, i)}</svg>`;
      grid.appendChild(cell);
    });
    board.appendChild(grid);
    wrap.appendChild(board);

    /* 选项按钮 */
    const optRow = document.createElement("div");
    optRow.className = "shc-opts";
    options.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "shc-opt";
      b.textContent = String(o);
      b.dataset.val = String(o);
      b.addEventListener("click", () =>
        this.pick(b, o, answer, options.length),
      );
      optRow.appendChild(b);
    });
    wrap.appendChild(optRow);

    this.root.appendChild(wrap);
  }

  private pick(
    btn: HTMLButtonElement,
    val: number,
    answer: number,
    _total: number,
  ): void {
    if (this.locked) return;
    if (val === answer) {
      this.locked = true;
      btn.classList.add("shc-opt--right");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("shc-opt--wrong");
      const paused = this.onWrong();
      /* 标出正确答案 */
      this.root.querySelectorAll<HTMLButtonElement>(".shc-opt").forEach((b) => {
        if (Number(b.dataset.val) === answer)
          b.classList.add("shc-opt--reveal");
      });
      this.trackTimeout(() => {
        this.root
          .querySelectorAll(".shc-opt--wrong,.shc-opt--reveal")
          .forEach((el) =>
            el.classList.remove("shc-opt--wrong", "shc-opt--reveal"),
          );
      }, 900);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🔢",
      variant: "rest",
      body: `只数题目问的那种形状，别被其他形状打扰。 ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("shc-style")) return;
    const st = document.createElement("style");
    st.id = "shc-style";
    st.textContent = SHC_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function SHC_CSS(theme: string): string {
  return `
.shc-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.shc-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.shc-board{position:relative;width:min(420px,92vw);padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.9),${theme}1a);border:3px solid ${theme};border-radius:22px;box-shadow:var(--shadow);overflow:hidden;}
.shc-board-deco{position:absolute;top:6px;right:10px;font-size:1.3rem;opacity:.4;}
.shc-grid{display:grid;grid-template-columns:repeat(var(--shc-cols,3),1fr);gap:10px;place-items:center;}
.shc-shape{width:74px;height:74px;transform:rotate(var(--shc-rot,0deg));animation:shc-in .4s ease;}
.shc-shape svg{width:100%;height:100%;}
@keyframes shc-in{0%{transform:scale(0) rotate(var(--shc-rot,0deg))}100%{transform:scale(1) rotate(var(--shc-rot,0deg))}}
.shc-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);}
.shc-opt{width:74px;height:74px;border:none;border-radius:18px;background:#fff;font-size:2rem;font-weight:900;color:#444;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.1);transition:transform .12s;border:3px solid transparent;}
.shc-opt:active{transform:translateY(2px);}
.shc-opt--right{background:linear-gradient(180deg,#e0ffe4,#6bcf7f);color:#1a7a30;border-color:#2ecc71;animation:shc-pop .4s ease;}
.shc-opt--wrong{background:linear-gradient(180deg,#ffe0d8,#ff6348);color:#a02020;border-color:#ff6348;animation:shc-shake .5s ease;}
.shc-opt--reveal{border-color:#ffd93d;background:linear-gradient(180deg,#fff7cf,#ffe88a);}
@keyframes shc-pop{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes shc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (max-width:380px){.shc-shape{width:58px;height:58px;}.shc-opt{width:60px;height:60px;font-size:1.6rem;}}
`;
}

export function create(): ShapeCountGame {
  return new ShapeCountGame();
}
