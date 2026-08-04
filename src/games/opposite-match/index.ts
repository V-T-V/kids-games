/* 反义词配对 Opposite-Match —— 左边一个词，右边选项里选它的反义词。
   独特点：扩展版反义词语料库（高矮/胖瘦/快慢/冷热/黑白/长短/多少/深浅...），
           区别于 antonym：词对更丰富，难度梯度更细。
   巧思：每关选 N 对词，左列展示已学词，右列乱序；
         点左边一个词高亮，再点右边即判定；正确则两词变绿。难度=选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const PAIRS: [string, string][] = [
  ["大", "小"],
  ["多", "少"],
  ["高", "矮"],
  ["长", "短"],
  ["冷", "热"],
  ["快", "慢"],
  ["黑", "白"],
  ["胖", "瘦"],
  ["深", "浅"],
  ["上", "下"],
  ["左", "右"],
  ["开", "关"],
  ["来", "去"],
  ["好", "坏"],
  ["新", "旧"],
  ["哭", "笑"],
  ["远", "近"],
  ["重", "轻"],
];

export class OppositeMatchGame extends BaseGame {
  constructor() {
    super("opposite-match");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 每关配对数=难度。 */
  private pairCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = this.pairCount();
    const pairs = shuffle(PAIRS).slice(0, n) as [string, string][];
    const leftWords = pairs.map((p) => p[0]!);
    const rightWords = shuffle(pairs.map((p) => p[1]!));
    this.remaining = n;
    let selLeft: string | null = null;
    let selLeftEl: HTMLElement | null = null;

    const wrap = document.createElement("div");
    wrap.className = "opm-wrap";
    const task = document.createElement("div");
    task.className = "opm-task";
    task.innerHTML = `把意思<b>相反</b>的字连起来<br><span class="opm-hint">先点左边的字，再点右边相反的字（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "opm-board";
    const colL = document.createElement("div");
    colL.className = "opm-col";
    const colR = document.createElement("div");
    colR.className = "opm-col";

    // 右边字 → 对应的左边字（用于判定）
    const rightMatch: Record<string, string> = {};
    pairs.forEach((p) => {
      const l = p[0]!;
      const r = p[1]!;
      rightMatch[r] = l;
    });

    leftWords.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opm-word";
      b.textContent = w;
      b.addEventListener("click", () => {
        if (b.classList.contains("opm-word--done")) return;
        colL
          .querySelectorAll(".opm-word")
          .forEach((x) => x.classList.remove("opm-word--sel"));
        b.classList.add("opm-word--sel");
        selLeft = w;
        selLeftEl = b;
        sfxPop();
      });
      colL.appendChild(b);
    });
    rightWords.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opm-word";
      b.textContent = w;
      b.addEventListener("click", () => {
        if (!selLeft || !selLeftEl) return;
        if (b.classList.contains("opm-word--done")) return;
        if (rightMatch[w] === selLeft) {
          b.classList.add("opm-word--done");
          selLeftEl.classList.add("opm-word--done");
          selLeftEl.classList.remove("opm-word--sel");
          const r = b.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          this.remaining -= 1;
          selLeft = null;
          selLeftEl = null;
          if (this.remaining <= 0) {
            this.roundsDone += 1;
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal)
                this.finishClear(starsByAccuracy(this.wrongCount));
              else this.startRound();
            }, 1000);
          }
        } else {
          b.classList.add("opm-word--wrong");
          const paused = this.onWrong();
          this.trackTimeout(() => b.classList.remove("opm-word--wrong"), 450);
          if (paused) this.showRest();
        }
      });
      colR.appendChild(b);
    });
    board.appendChild(colL);
    board.appendChild(colR);
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想哪个字意思<b>正好相反</b>～",
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
    if (document.getElementById("opm-style")) return;
    const st = document.createElement("style");
    st.id = "opm-style";
    st.textContent = OPM_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function OPM_CSS(theme: string): string {
  return `
.opm-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(440px,100%);}
.opm-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.opm-hint{font-size:.8rem;color:var(--ink-soft);font-weight:600;display:block;margin-top:2px;}
.opm-board{display:flex;gap:44px;justify-content:center;}
.opm-col{display:flex;flex-direction:column;gap:14px;}
.opm-word{min-width:80px;height:68px;font-size:1.7rem;font-weight:800;font-family:'KaiTi','STKaiti',serif;border-radius:18px;background:#fff;box-shadow:var(--shadow);color:var(--ink);transition:transform .15s;}
.opm-word:active{transform:scale(.93);}
.opm-word--sel{outline:4px solid ${theme};outline-offset:3px;background:#fff7f5;}
.opm-word--done{background:linear-gradient(135deg,#6bcf7f,#4ba85f);color:#fff;opacity:.85;}
.opm-word--wrong{animation:opm-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes opm-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): OppositeMatchGame {
  return new OppositeMatchGame();
}
