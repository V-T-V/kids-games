/* 镜像字 Mirror Word —— 显示一个字/字母的镜像（CSS scaleX(-1)），选出原始的字。
   独特点：用 CSS 水平翻转呈现，训练孩子字形识别与空间翻转还原能力。
   巧思：含中文字与英文字母；难度=选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

// 字库（简单、笔画少，适合 3-6 岁）
const WORDS = [
  "山",
  "口",
  "日",
  "田",
  "木",
  "人",
  "A",
  "B",
  "E",
  "H",
  "K",
  "M",
  "T",
  "W",
  "X",
  "Y",
];

export class MirrorWordGame extends BaseGame {
  constructor() {
    super("mirror-word");
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

    const target = sample(WORDS);
    const distractors = shuffle(WORDS.filter((w) => w !== target)).slice(
      0,
      this.optCount() - 1,
    );
    const options = shuffle([target, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "mwd-wrap";

    const task = document.createElement("div");
    task.className = "mwd-task";
    task.textContent = "镜子里的字是反的，原来是什么字？";
    wrap.appendChild(task);

    const mirror = document.createElement("div");
    mirror.className = "mwd-mirror";
    const inner = document.createElement("span");
    inner.className = "mwd-mirror-inner";
    inner.textContent = target;
    mirror.appendChild(inner);
    // 镜框 + 镜像字
    wrap.appendChild(mirror);

    const grid = document.createElement("div");
    grid.className = "mwd-grid";
    for (const opt of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mwd-opt";
      b.textContent = opt;
      b.addEventListener("click", () => this.choose(opt, target, b, grid));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private choose(
    opt: string,
    target: string,
    btn: HTMLButtonElement,
    grid: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (opt === target) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".mwd-opt").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      btn.classList.add("mwd-opt--right");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 800);
    } else {
      btn.classList.add("mwd-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("mwd-opt--wrong"), 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想一想，把镜子里的字反过来念～",
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
    if (document.getElementById("mwd-style")) return;
    const st = document.createElement("style");
    st.id = "mwd-style";
    st.textContent = MWD_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function MWD_CSS(theme: string): string {
  return `
.mwd-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(440px,100%);}
.mwd-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.mwd-mirror{width:170px;height:170px;border-radius:24px;background:linear-gradient(135deg,#e3f2fd,#bbdefb);box-shadow:var(--shadow),inset 0 0 24px rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;border:6px solid #fff;position:relative;}
.mwd-mirror::before{content:"🪞";position:absolute;top:6px;left:8px;font-size:1.3rem;opacity:.6;}
.mwd-mirror-inner{font-size:6rem;font-weight:900;color:${theme};transform:scaleX(-1);user-select:none;}
.mwd-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
.mwd-opt{width:96px;height:84px;border-radius:18px;background:#fff;font-size:2.4rem;font-weight:900;color:${theme};box-shadow:var(--shadow);}
.mwd-opt:active{transform:scale(.93);}
.mwd-opt--right{background:#d4f4dd;outline:4px solid #34c759;}
.mwd-opt--wrong{background:#ffe0e0;outline:4px solid #ff3b30;}
`;
}

export function create(): MirrorWordGame {
  return new MirrorWordGame();
}
