/* 交通标志认知 Traffic-Sign —— 显示一个交通标志，从选项里选出它的含义。
   标志：红绿灯（红灯停绿灯行）/ 斑马线（过马路走这里）/ 禁止通行（不能进）。
   独特点：标志认知 + 多选项。视觉：标志卡 + 含义按钮。
   巧思：选对高亮，选错抖动并提示。前缀 tfs-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Sign {
  emoji: string;
  name: string; // 标志名（题面）
  meaning: string; // 正确含义
}
interface Way {
  text: string;
}

const SIGNS: Sign[] = [
  { emoji: "🚦", name: "红绿灯", meaning: "红灯停，绿灯行" },
  { emoji: "🚸", name: "斑马线", meaning: "过马路走这里" },
  { emoji: "🚫", name: "禁止通行", meaning: "这里不能进" },
  { emoji: "🅿️", name: "停车场", meaning: "这里可以停车" },
  { emoji: "⚠️", name: "注意安全", meaning: "前面有危险要小心" },
  { emoji: "🛑", name: "停车让行", meaning: "要停下来看一看" },
];

const DISTRACTORS: string[] = ["随便走没关系", "可以跑很快", "可以反着走"];

export class TrafficSignGame extends BaseGame {
  constructor() {
    super("traffic-sign");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private order: Sign[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.order = shuffle(SIGNS);
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const sign = this.order[this.roundsDone % this.order.length]!;
    // 正确含义 + 2 个干扰项
    const distract = shuffle(DISTRACTORS).slice(0, 2);
    const choices = shuffle<Way>([
      { text: sign.meaning },
      ...distract.map((t) => ({ text: t })),
    ]);

    const wrap = document.createElement("div");
    wrap.className = "tfs-wrap";
    const task = document.createElement("div");
    task.className = "tfs-task";
    task.innerHTML = `这个<b>${sign.name}</b>标志是什么意思？`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "tfs-card";
    card.id = "tfs-card";
    card.innerHTML = `<div class="tfs-card__emoji">${sign.emoji}</div><div class="tfs-card__name">${sign.name}</div>`;
    wrap.appendChild(card);

    const opts = document.createElement("div");
    opts.className = "tfs-opts";
    choices.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tfs-choice";
      b.textContent = w.text;
      b.addEventListener("click", () => this.choose(w.text, sign.meaning, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(text: string, meaning: string, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (text === meaning) {
      this.answered = true;
      btn.classList.add("tfs-choice--right");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("tfs-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("tfs-choice--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🚦",
      variant: "rest",
      body: "红绿灯：<b>红灯停、绿灯行</b>；斑马线：过马路走这里；禁止通行：不能进～",
      primary: { text: "继续", icon: "🛡️", onClick: () => ov.destroy() },
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
    if (document.getElementById("tfs-style")) return;
    const st = document.createElement("style");
    st.id = "tfs-style";
    st.textContent = TFS_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function TFS_CSS(theme: string): string {
  return `
.tfs-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.tfs-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.tfs-task b{color:${theme};}
.tfs-card{display:flex;flex-direction:column;align-items:center;gap:6px;background:linear-gradient(180deg,#fff,#fff3e0);padding:24px 36px;border-radius:24px;box-shadow:var(--shadow);border:4px solid ${theme};}
.tfs-card__emoji{font-size:4.4rem;line-height:1;}
.tfs-card__name{font-size:1.1rem;font-weight:900;color:#5a3a1a;}
.tfs-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:380px;}
.tfs-choice{padding:14px 18px;font-size:1rem;font-weight:700;border-radius:14px;border:3px solid #e0e0e8;background:#fff;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;color:var(--ink);}
.tfs-choice:active{transform:scale(.97);}
.tfs-choice--right{border-color:#6bcf7f;background:#d4f4dd;animation:tfs-pop .4s ease;}
.tfs-choice--wrong{border-color:#ff6348;background:#ffe0e0;animation:tfs-shake .4s ease;}
@keyframes tfs-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes tfs-pop{0%{transform:scale(.9)}60%{transform:scale(1.05)}100%{transform:scale(1)}}
`;
}

export function create(): TrafficSignGame {
  return new TrafficSignGame();
}
