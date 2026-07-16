/* 找反义词 Antonym —— 把意思相反的词配对。
   独特点：语义关系配对（反义，区别于同义/近义）。
   巧思：配对成功两词中间画一条对比线。 */

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
  ["上", "下"],
  ["左", "右"],
  ["黑", "白"],
  ["开", "关"],
];

export class AntonymGame extends BaseGame {
  constructor() {
    super("antonym");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private pairCount(): number {
    return this.difficulty === "easy"
      ? 2
      : this.difficulty === "medium"
        ? 3
        : 4;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = this.pairCount();
    const pairs = shuffle(PAIRS).slice(0, n) as [string, string][];
    const leftWords = pairs.map((p) => p[0]);
    const rightWords = shuffle(pairs.map((p) => p[1]));
    this.remaining = n;
    let selLeft: string | null = null;
    let selLeftEl: HTMLElement | null = null;

    const wrap = document.createElement("div");
    wrap.className = "an-wrap";
    const task = document.createElement("div");
    task.className = "an-task";
    task.textContent = `把意思相反的字连起来～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "an-board";
    const colL = document.createElement("div");
    colL.className = "an-col";
    const colR = document.createElement("div");
    colR.className = "an-col";

    const rightMatch: Record<string, string> = {};
    pairs.forEach((p) => {
      rightMatch[p[1]!] = p[0]!;
    });

    leftWords.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "an-word";
      b.textContent = w;
      b.dataset.side = "L";
      b.addEventListener("click", () => {
        colL
          .querySelectorAll(".an-word")
          .forEach((x) => x.classList.remove("an-word--sel"));
        b.classList.add("an-word--sel");
        selLeft = w;
        selLeftEl = b;
        sfxPop();
      });
      colL.appendChild(b);
    });
    rightWords.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "an-word";
      b.textContent = w;
      b.dataset.side = "R";
      b.addEventListener("click", () => {
        if (!selLeft || !selLeftEl) return;
        if (rightMatch[w] === selLeft) {
          b.classList.add("an-word--done");
          selLeftEl.classList.add("an-word--done");
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
          const paused = this.onWrong();
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
      body: "想想哪个意思正好相反～",
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
    if (document.getElementById("an-style")) return;
    const st = document.createElement("style");
    st.id = "an-style";
    st.textContent = AN_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function AN_CSS(theme: string): string {
  return `
.an-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(420px,100%);}
.an-task{font-size:1.1rem;font-weight:800;text-align:center;}
.an-board{display:flex;gap:40px;justify-content:center;}
.an-col{display:flex;flex-direction:column;gap:14px;}
.an-word{min-width:72px;height:64px;font-size:1.6rem;font-weight:800;border-radius:16px;background:#fff;box-shadow:var(--shadow);}
.an-word:active{transform:scale(.93);}
.an-word--sel{outline:4px solid ${theme};outline-offset:2px;}
.an-word--done{background:#d4f4dd;opacity:.6;}
`;
}

export function create(): AntonymGame {
  return new AntonymGame();
}
