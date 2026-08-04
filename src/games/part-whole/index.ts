/* 部分与整体 Part Whole —— 显示一个部分（如车轮），选出对应的整体（汽车）。
   独特点：部分→整体归属推理，训练从局部推知整体的能力。
   巧思：部分用 emoji + 放大呈现，难度=选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Pair {
  part: string;
  partEmoji: string;
  whole: string;
  wholeEmoji: string;
}

const PAIRS: Pair[] = [
  { part: "车轮", partEmoji: "🛞", whole: "汽车", wholeEmoji: "🚗" },
  { part: "树叶", partEmoji: "🍃", whole: "大树", wholeEmoji: "🌳" },
  { part: "花瓣", partEmoji: "🌸", whole: "花朵", wholeEmoji: "🌷" },
  { part: "尾巴", partEmoji: "〰️", whole: "小狗", wholeEmoji: "🐶" },
  { part: "翅膀", partEmoji: "🪽", whole: "小鸟", wholeEmoji: "🐦" },
  { part: "房顶", partEmoji: "🏠", whole: "房子", wholeEmoji: "🏡" },
  { part: "伞柄", partEmoji: "☂️", whole: "雨伞", wholeEmoji: "🌂" },
  { part: "鞋带", partEmoji: "👟", whole: "鞋子", wholeEmoji: "🥿" },
  { part: "窗子", partEmoji: "🪟", whole: "房子", wholeEmoji: "🏡" },
  { part: "轮子", partEmoji: "🛞", whole: "自行车", wholeEmoji: "🚲" },
];

export class PartWholeGame extends BaseGame {
  constructor() {
    super("part-whole");
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

  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const target = sample(PAIRS);
    const distractors = shuffle(
      PAIRS.filter((p) => p.whole !== target.whole),
    ).slice(0, this.optCount() - 1);
    const options = shuffle([target, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "pwh-wrap";

    const task = document.createElement("div");
    task.className = "pwh-task";
    task.textContent = `「${target.part}」是哪个东西的一部分？`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "pwh-stage";
    const emoji = document.createElement("div");
    emoji.className = "pwh-emoji";
    emoji.textContent = target.partEmoji;
    stage.appendChild(emoji);
    wrap.appendChild(stage);

    const grid = document.createElement("div");
    grid.className = "pwh-grid";
    for (const opt of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pwh-opt";
      b.innerHTML = `<span class="pwh-opt-emoji">${opt.wholeEmoji}</span><span class="pwh-opt-text">${opt.whole}</span>`;
      b.addEventListener("click", () => this.choose(opt, target, b, grid));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private choose(
    opt: Pair,
    target: Pair,
    btn: HTMLButtonElement,
    grid: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (opt.whole === target.whole) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".pwh-opt").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      btn.classList.add("pwh-opt--right");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 800);
    } else {
      btn.classList.add("pwh-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("pwh-opt--wrong"), 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想一想这个小零件属于哪个东西～",
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
    if (document.getElementById("pwh-style")) return;
    const st = document.createElement("style");
    st.id = "pwh-style";
    st.textContent = PWH_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function PWH_CSS(theme: string): string {
  return `
.pwh-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.pwh-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.pwh-stage{width:150px;height:150px;border-radius:32px;background:#fff;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;}
.pwh-emoji{font-size:5rem;filter:drop-shadow(0 6px 8px rgba(0,0,0,.15));animation:pwh-pulse 2s ease-in-out infinite;}
@keyframes pwh-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.pwh-grid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
.pwh-opt{min-width:110px;min-height:84px;padding:8px 18px;border-radius:18px;background:#fff;font-weight:800;color:${theme};box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;gap:4px;}
.pwh-opt-emoji{font-size:2.2rem;}
.pwh-opt-text{font-size:1.05rem;}
.pwh-opt:active{transform:scale(.93);}
.pwh-opt--right{background:#d4f4dd;outline:4px solid #34c759;color:#2e8b57;}
.pwh-opt--wrong{background:#ffe0e0;outline:4px solid #ff3b30;}
`;
}

export function create(): PartWholeGame {
  return new PartWholeGame();
}
