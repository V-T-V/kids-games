/* 汉字结构 Char-Structure —— 给一个字，问它是哪种结构（左右/上下/包围/独体）。
   独特点：训练汉字空间结构意识——理解汉字的"组装方式"。
   巧思：视觉拆解展示——把字按结构分成色块（左红右蓝/上绿下黄…），
         让结构一眼可见；难度=结构选项数 + 形近结构干扰。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

type Structure = "左右" | "上下" | "包围" | "独体";

interface CharEntry {
  char: string;
  structure: Structure;
}

const DATA: CharEntry[] = [
  // 左右结构
  { char: "明", structure: "左右" },
  { char: "林", structure: "左右" },
  { char: "好", structure: "左右" },
  { char: "村", structure: "左右" },
  { char: "听", structure: "左右" },
  // 上下结构
  { char: "雷", structure: "上下" },
  { char: "草", structure: "上下" },
  { char: "花", structure: "上下" },
  { char: "音", structure: "上下" },
  { char: "星", structure: "上下" },
  // 包围结构（含半包围）
  { char: "国", structure: "包围" },
  { char: "回", structure: "包围" },
  { char: "圆", structure: "包围" },
  { char: "问", structure: "包围" },
  { char: "同", structure: "包围" },
  // 独体字
  { char: "木", structure: "独体" },
  { char: "水", structure: "独体" },
  { char: "人", structure: "独体" },
  { char: "日", structure: "独体" },
  { char: "山", structure: "独体" },
];

const ALL_STRUCTURES: Structure[] = ["左右", "上下", "包围", "独体"];

export class CharStructureGame extends BaseGame {
  constructor() {
    super("char-structure");
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
    /* DOM 清空 */
  }

  /** 选项数。easy=2（只给2种结构，明显不同），hard=4（全四种）。 */
  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const entry = sample(DATA);
    const right = entry.structure;

    // 选干扰结构
    const others = shuffle(ALL_STRUCTURES.filter((s) => s !== right));
    let distractors = others;
    if (this.difficulty === "easy") {
      // easy：干扰取视觉上明显不同的（如目标是左右，干扰给独体；避免上下）
      const visualFar: Record<Structure, Structure> = {
        左右: "独体",
        上下: "独体",
        包围: "独体",
        独体: "包围",
      };
      const farTarget = visualFar[right]!;
      distractors = others.filter((s) => s === farTarget);
      if (distractors.length < 1) distractors = others;
    }
    const opts = shuffle([right, ...distractors.slice(0, this.optCount() - 1)]);

    const wrap = document.createElement("div");
    wrap.className = "cstr-wrap";

    const task = document.createElement("div");
    task.className = "cstr-task";
    task.innerHTML = `「<b>${entry.char}</b>」是什么结构？<span class="cstr-hint">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    // 视觉拆解展示：按结构把字放进对应色块布局
    const demo = document.createElement("div");
    demo.className = `cstr-demo cstr-demo--${right}`;
    demo.dataset.structure = right;
    const charBox = document.createElement("div");
    charBox.className = "cstr-char";
    charBox.textContent = entry.char;
    demo.appendChild(charBox);
    // 结构示意小图（虚线框）
    const diag = document.createElement("div");
    diag.className = "cstr-diag";
    diag.innerHTML = structureDiagram(right);
    demo.appendChild(diag);
    wrap.appendChild(demo);

    const grid = document.createElement("div");
    grid.className = "cstr-grid";
    for (const opt of opts) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cstr-opt";
      b.innerHTML = `<span class="cstr-opt__icon">${structureDiagram(opt)}</span><span class="cstr-opt__text">${opt}</span>`;
      b.addEventListener("click", () => this.choose(opt, right, b, grid));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
    sfxPop();
  }

  private choose(
    opt: Structure,
    right: Structure,
    btn: HTMLButtonElement,
    grid: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (opt === right) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".cstr-opt").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      btn.classList.add("cstr-opt--right");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 900);
    } else {
      btn.classList.add("cstr-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("cstr-opt--wrong"), 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看这个字是<b>左右分</b>、<b>上下叠</b>、<b>围起来</b>还是<b>一整块</b>～",
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
    if (document.getElementById("cstr-style")) return;
    const st = document.createElement("style");
    st.id = "cstr-style";
    st.textContent = CSTR_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

/** 用 CSS 网格画结构示意小图（虚线框分块）。返回内嵌 div 的 HTML。 */
function structureDiagram(s: Structure): string {
  switch (s) {
    case "左右":
      return `<span class="cstr-cell cstr-cell--l"></span><span class="cstr-cell cstr-cell--r"></span>`;
    case "上下":
      return `<span class="cstr-cell cstr-cell--t"></span><span class="cstr-cell cstr-cell--b"></span>`;
    case "包围":
      return `<span class="cstr-cell cstr-cell--frame"></span><span class="cstr-cell cstr-cell--inner"></span>`;
    case "独体":
      return `<span class="cstr-cell cstr-cell--single"></span>`;
  }
}

function CSTR_CSS(theme: string): string {
  return `
.cstr-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(460px,100%);}
.cstr-task{font-size:1.1rem;font-weight:800;text-align:center;}
.cstr-task b{font-size:2.2rem;color:${theme};font-family:'KaiTi','STKaiti',serif;vertical-align:middle;}
.cstr-hint{font-size:.78rem;color:var(--ink-soft,#888);font-weight:600;margin-left:8px;}
.cstr-demo{display:flex;align-items:center;gap:18px;background:rgba(255,255,255,.6);padding:16px 22px;border-radius:22px;box-shadow:var(--shadow);}
.cstr-char{width:96px;height:96px;display:flex;align-items:center;justify-content:center;font-size:3.4rem;font-weight:900;color:${theme};font-family:'KaiTi','STKaiti',serif;animation:cstr-pop .4s ease;}
/* 结构示意小图：用虚线框分块，让结构可视化 */
.cstr-diag{width:64px;height:64px;display:grid;gap:3px;}
.cstr-cell{border:2.5px dashed ${theme}88;border-radius:6px;background:rgba(99,102,241,.06);}
/* 左右：两列 */
.cstr-demo--左右 .cstr-diag{grid-template-columns:1fr 1fr;}
/* 上下：两行 */
.cstr-demo--上下 .cstr-diag{grid-template-rows:1fr 1fr;}
/* 包围：外框套内块 */
.cstr-demo--包围 .cstr-diag{grid-template-columns:1fr;position:relative;}
.cstr-demo--包围 .cstr-cell--frame{position:absolute;inset:0;background:transparent;}
.cstr-demo--包围 .cstr-cell--inner{margin:14px;background:${theme}33;}
/* 独体：一整块 */
.cstr-demo--独体 .cstr-diag{grid-template-columns:1fr;}
.cstr-demo--独体 .cstr-cell--single{background:${theme}22;}
.cstr-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;width:min(380px,100%);}
.cstr-opt{display:flex;align-items:center;gap:10px;min-height:64px;padding:10px 16px;background:#fff;border-radius:16px;box-shadow:var(--shadow);cursor:pointer;}
.cstr-opt:active{transform:scale(.96);}
.cstr-opt__icon{width:34px;height:34px;display:grid;gap:2px;flex-shrink:0;}
.cstr-opt__icon .cstr-cell{border-width:2px;border-radius:3px;}
.cstr-opt__text{font-size:1.25rem;font-weight:800;color:var(--ink,#333);}
.cstr-opt--right{background:#d4f4dd;outline:4px solid #34c759;animation:cstr-pop .4s ease;}
.cstr-opt--wrong{background:#ffe0e0;outline:4px solid #ff3b30;}
@keyframes cstr-pop{0%{transform:scale(.7)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@media (max-width:380px){.cstr-char{width:80px;height:80px;font-size:2.8rem;}.cstr-grid{grid-template-columns:1fr 1fr;gap:10px;}.cstr-opt__text{font-size:1.1rem;}}
`;
}

export function create(): CharStructureGame {
  return new CharStructureGame();
}
