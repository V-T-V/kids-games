/* 词语配对 Word-Pair —— 左列名词、右列关联词，孩子连线配对。
   独特点：关联词（非反义非同义）训练语义联想——"太阳-亮""苹果-红"。
   巧思：配对成功两词中间画一条连线，关联词高亮；难度=配对数 + 关联远近。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface PairSet {
  /** 关联紧密（容易，easy/medium 用） */
  tight: [string, string][];
  /** 关联较远/需联想（hard 用） */
  loose: [string, string][];
}

const DATA: PairSet = {
  tight: [
    ["太阳", "亮"],
    ["苹果", "红"],
    ["雪", "白"],
    ["草", "绿"],
    ["火", "热"],
    ["冰", "冷"],
    ["兔子", "快"],
    ["乌龟", "慢"],
    ["气球", "飞"],
    ["雨伞", "雨"],
    ["小狗", "汪"],
    ["小猫", "喵"],
    ["月亮", "圆"],
    ["糖", "甜"],
    ["药", "苦"],
    ["棉花", "软"],
    ["石头", "硬"],
  ],
  loose: [
    ["妈妈", "温柔"],
    ["爸爸", "高大"],
    ["朋友", "开心"],
    ["上学", "认真"],
    ["生日", "蛋糕"],
    ["春天", "花开"],
    ["秋天", "落叶"],
    ["夜晚", "睡觉"],
    ["大海", "蓝"],
    ["高山", "陡"],
  ],
};

export class WordPairGame extends BaseGame {
  constructor() {
    super("word-pair");
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

  /** 每轮配对数。 */
  private pairCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.pairCount();
    // hard：混入关联远的；easy/medium：用紧密关联
    const pool =
      this.difficulty === "hard"
        ? [...DATA.tight, ...DATA.loose]
        : DATA.tight;
    const pairs = shuffle(pool).slice(0, n) as [string, string][];
    const leftWords = pairs.map((p) => p[0]);
    const rightWords = shuffle(pairs.map((p) => p[1]));
    this.remaining = n;
    let selLeft: string | null = null;
    let selLeftEl: HTMLElement | null = null;

    const wrap = document.createElement("div");
    wrap.className = "wpr-wrap";
    const task = document.createElement("div");
    task.className = "wpr-task";
    task.textContent = `把有关系的词连起来～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "wpr-board";
    const colL = document.createElement("div");
    colL.className = "wpr-col";
    const colR = document.createElement("div");
    colR.className = "wpr-col";

    const rightMatch: Record<string, string> = {};
    pairs.forEach((p) => {
      rightMatch[p[1]!] = p[0]!;
    });

    leftWords.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wpr-word";
      b.textContent = w;
      b.addEventListener("click", () => {
        colL
          .querySelectorAll(".wpr-word")
          .forEach((x) => x.classList.remove("wpr-word--sel"));
        b.classList.add("wpr-word--sel");
        selLeft = w;
        selLeftEl = b;
        sfxPop();
      });
      colL.appendChild(b);
    });
    rightWords.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wpr-word";
      b.textContent = w;
      b.addEventListener("click", () => {
        if (!selLeft || !selLeftEl) return;
        if (rightMatch[w] === selLeft) {
          b.classList.add("wpr-word--done");
          selLeftEl.classList.add("wpr-word--done");
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
      body: "想一想这两个词之间有什么<b>关系</b>～",
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
    if (document.getElementById("wpr-style")) return;
    const st = document.createElement("style");
    st.id = "wpr-style";
    st.textContent = WPR_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function WPR_CSS(theme: string): string {
  return `
.wpr-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(440px,100%);}
.wpr-task{font-size:1.1rem;font-weight:800;text-align:center;}
.wpr-board{display:flex;gap:44px;justify-content:center;}
.wpr-col{display:flex;flex-direction:column;gap:14px;}
.wpr-word{min-width:84px;min-height:60px;padding:0 18px;font-size:1.4rem;font-weight:800;border-radius:16px;background:#fff;box-shadow:var(--shadow);color:var(--ink,#333);}
.wpr-word:active{transform:scale(.93);}
.wpr-word--sel{outline:4px solid ${theme};outline-offset:2px;}
.wpr-word--done{background:#d4f4dd;opacity:.6;}
@media (max-width:380px){.wpr-word{min-width:72px;font-size:1.2rem;}}
`;
}

export function create(): WordPairGame {
  return new WordPairGame();
}
