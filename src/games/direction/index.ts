/* 方向辨别 Direction —— 根据箭头/提示选出正确的方向。
   独特点：左右上下方位认知（区别于 robot-code 的指令序列）。
   巧思：小动物朝某方向，问"它的左边是哪个"。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

const DIRS = ["⬆️", "⬇️", "⬅️", "➡️"];
const DIRS_HARD = ["⬆️", "⬇️", "⬅️", "➡️", "↗️", "↖️", "↘️", "↙️"];
const DIR_NAME: Record<string, string> = {
  "⬆️": "上",
  "⬇️": "下",
  "⬅️": "左",
  "➡️": "右",
  "↗️": "右上",
  "↖️": "左上",
  "↘️": "右下",
  "↙️": "左下",
};

export class DirectionGame extends BaseGame {
  constructor() {
    super("direction");
  }
  private roundsDone = 0;
  private answered = false;
  private roundTotal = 0;
  private reverseMode = false; // hard 档：问"反方向"增加难度

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 当前难度可用的方向池。 */
  private dirPool(): string[] {
    return this.difficulty === "hard" ? DIRS_HARD : DIRS;
  }

  /** 方向取反（用于 hard 的"反方向"问法）。 */
  private opposite(d: string): string {
    const map: Record<string, string> = {
      "⬆️": "⬇️",
      "⬇️": "⬆️",
      "⬅️": "➡️",
      "➡️": "⬅️",
      "↗️": "↙️",
      "↙️": "↗️",
      "↖️": "↘️",
      "↘️": "↖️",
    };
    return map[d] ?? d;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const pool = this.dirPool();
    const target = sample(pool);
    // hard 档有 40% 概率问反方向（增加认知难度）
    this.reverseMode = this.difficulty === "hard" && Math.random() < 0.4;
    const showName = this.reverseMode
      ? DIR_NAME[this.opposite(target)]
      : DIR_NAME[target];
    const choices = shuffle(pool);

    const wrap = document.createElement("div");
    wrap.className = "dr-wrap";
    const task = document.createElement("div");
    task.className = "dr-task";
    const prompt = this.reverseMode
      ? `点 <span class="dr-key">${showName}</span> 的<span class="dr-rev">反</span>方向`
      : `点 <span class="dr-key">${showName}</span> 方向的箭头`;
    task.innerHTML = prompt;
    wrap.appendChild(task);

    const opts = document.createElement("div");
    opts.className = "dr-opts";
    choices.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dr-opt";
      b.textContent = d;
      b.addEventListener("click", () => this.choose(d, target, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(d: string, target: string, btn: HTMLButtonElement): void {
    // 反方向模式：正确答案是 target 的反向；正方向模式：正确答案是 target 本身
    if (this.answered) return;
    const answer = this.reverseMode ? this.opposite(target) : target;
    if (d === answer) {
      sfxPop();
      this.answered = true;
      btn.classList.add("dr-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 900);
    } else {
      btn.classList.add("dr-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("dr-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想哪边是左、哪边是右～",
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
    if (document.getElementById("dr-style")) return;
    const st = document.createElement("style");
    st.id = "dr-style";
    st.textContent = DR_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function DR_CSS(theme: string): string {
  return `
.dr-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(440px,100%);}
.dr-task{font-size:1.3rem;font-weight:800;}
.dr-key{display:inline-block;color:#fff;background:${theme};padding:2px 16px;border-radius:12px;}
.dr-opts{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.dr-opt{width:80px;height:80px;font-size:2.4rem;border-radius:18px;background:#fff;box-shadow:var(--shadow);}
.dr-opt:active{transform:scale(.92);}
.dr-opt--done{background:#d4f4dd;animation:dr-pop .4s ease;}
.dr-opt--wrong{animation:dr-shake .4s ease;}
@keyframes dr-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes dr-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): DirectionGame {
  return new DirectionGame();
}
