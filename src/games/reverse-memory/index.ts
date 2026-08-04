/* 倒序记忆 Reverse Memory —— 记住一串图案，然后按「相反」顺序点出来。
   独特点：逆序输出（区别于 feed-order 的正序、memory-flip 的配对）。
   巧思：先正序闪现，要求孩子倒着点；难度=序列长度。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

const ICONS = ["🍎", "🍌", "🍇", "🐶", "🐱", "⭐", "🌸", "🚗"];

export class ReverseMemoryGame extends BaseGame {
  constructor() {
    super("reverse-memory");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private seq: string[] = [];
  private revStep = 0; // 从最后往前点的索引
  private animating = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private len(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.revStep = 0;
    this.animating = true;
    const len = this.len();
    const pool = shuffle(ICONS).slice(0, len);
    this.seq = Array.from({ length: len }, () => sample(pool));

    const wrap = document.createElement("div");
    wrap.className = "rm-wrap";
    const task = document.createElement("div");
    task.className = "rm-task";
    task.innerHTML = `记住顺序，然后 <span class="rm-rev">倒着</span> 点出来！<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const display = document.createElement("div");
    display.className = "rm-display";
    display.id = "rm-display";
    wrap.appendChild(display);

    const opts = document.createElement("div");
    opts.className = "rm-opts";
    pool.forEach((icon) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rm-opt";
      b.textContent = icon;
      b.addEventListener("click", () => this.click(icon, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);

    // 正序展示序列
    const showEl = document.getElementById("rm-display")!;
    this.seq.forEach((icon, i) => {
      this.trackTimeout(
        () => {
          showEl.textContent = icon;
          sfxPop();
          if (i === this.seq.length - 1) {
            this.trackTimeout(() => {
              showEl.textContent = "现在倒着点～";
              this.animating = false;
            }, 700);
          }
        },
        i * 700 + 400,
      );
    });
  }

  private click(icon: string, btn: HTMLButtonElement): void {
    if (this.animating) return;
    // 期望从最后一个开始：seq[len-1], seq[len-2], ...
    const expectIdx = this.seq.length - 1 - this.revStep;
    const expected = this.seq[expectIdx]!;
    if (icon === expected) {
      btn.classList.add("rm-opt--done");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.revStep += 1;
      const showEl = document.getElementById("rm-display");
      if (showEl) showEl.textContent = `${this.revStep}/${this.seq.length}`;
      if (this.revStep >= this.seq.length) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1000);
      }
    } else {
      this.revStep = 0;
      btn.classList.add("rm-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("rm-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "要从最后一个开始倒着点哦～",
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
    if (document.getElementById("rm-style")) return;
    const st = document.createElement("style");
    st.id = "rm-style";
    st.textContent = RM_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function RM_CSS(theme: string): string {
  return `
.rm-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(440px,100%);}
.rm-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.rm-rev{color:${theme};font-size:1.2em;}
.rm-display{font-size:3rem;min-height:80px;display:flex;align-items:center;justify-content:center;background:#fff;padding:10px 30px;border-radius:20px;box-shadow:var(--shadow);font-weight:800;}
.rm-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.rm-opt{width:72px;height:72px;font-size:2.4rem;border-radius:18px;background:#fff;box-shadow:var(--shadow);}
.rm-opt:active{transform:scale(.92);}
.rm-opt--done{background:#d4f4dd;pointer-events:none;}
.rm-opt--wrong{animation:rm-shake .4s ease;}
@keyframes rm-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ReverseMemoryGame {
  return new ReverseMemoryGame();
}
