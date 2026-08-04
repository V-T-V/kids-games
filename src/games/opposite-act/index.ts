/* 相反动作 Opposite Act —— 显示一个动作，选出相反的动作。
   独特点：动作语义反义配对（站↔坐、开↔关），融合肢体认知与语言。
   巧思：每个动作用 emoji 表现，难度=选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Act {
  text: string;
  emoji: string;
  opposite: string;
}

// 成对的动作
const PAIRS: [Act, Act][] = [
  [
    { text: "站起来", emoji: "🧍", opposite: "坐下去" },
    { text: "坐下去", emoji: "🪑", opposite: "站起来" },
  ],
  [
    { text: "睁开眼睛", emoji: "👀", opposite: "闭上眼睛" },
    { text: "闭上眼睛", emoji: "😴", opposite: "睁开眼睛" },
  ],
  [
    { text: "打开门", emoji: "🚪", opposite: "关上门" },
    { text: "关上门", emoji: "🔒", opposite: "打开门" },
  ],
  [
    { text: "举手", emoji: "🙋", opposite: "放手" },
    { text: "放手", emoji: "✋", opposite: "举手" },
  ],
  [
    { text: "向前走", emoji: "🚶", opposite: "向后退" },
    { text: "向后退", emoji: "↩️", opposite: "向前走" },
  ],
  [
    { text: "大声说", emoji: "📢", opposite: "小声说" },
    { text: "小声说", emoji: "🤫", opposite: "大声说" },
  ],
];

const ALL_ACTS: Act[] = PAIRS.flat();

export class OppositeActGame extends BaseGame {
  constructor() {
    super("opposite-act");
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

    const target = sample(ALL_ACTS);
    // 干扰项：不等于正确答案、且不等于 target 自身
    const distractors = shuffle(
      ALL_ACTS.filter(
        (a) => a.text !== target.text && a.text !== target.opposite,
      ),
    ).slice(0, this.optCount() - 1);
    const options = shuffle([
      { text: target.opposite, emoji: this.emojiOf(target.opposite) },
      ...distractors.map((d) => ({ text: d.text, emoji: d.emoji })),
    ]);

    const wrap = document.createElement("div");
    wrap.className = "opa-wrap";

    const task = document.createElement("div");
    task.className = "opa-task";
    task.textContent = `「${target.text}」的相反动作是什么？`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "opa-stage";
    const emoji = document.createElement("div");
    emoji.className = "opa-emoji";
    emoji.textContent = target.emoji;
    stage.appendChild(emoji);
    const label = document.createElement("div");
    label.className = "opa-label";
    label.textContent = target.text;
    stage.appendChild(label);
    wrap.appendChild(stage);

    const grid = document.createElement("div");
    grid.className = "opa-grid";
    for (const opt of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opa-opt";
      b.innerHTML = `<span class="opa-opt-emoji">${opt.emoji}</span><span>${opt.text}</span>`;
      b.addEventListener("click", () =>
        this.choose(opt.text, target.opposite, b, grid),
      );
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private emojiOf(text: string): string {
    const found = ALL_ACTS.find((a) => a.text === text);
    return found ? found.emoji : "❓";
  }

  private choose(
    opt: string,
    answer: string,
    btn: HTMLButtonElement,
    grid: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (opt === answer) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".opa-opt").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      btn.classList.add("opa-opt--right");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 800);
    } else {
      btn.classList.add("opa-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("opa-opt--wrong"), 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想一想这个动作反着做是什么～",
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
    if (document.getElementById("opa-style")) return;
    const st = document.createElement("style");
    st.id = "opa-style";
    st.textContent = OPA_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function OPA_CSS(theme: string): string {
  return `
.opa-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.opa-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.opa-stage{background:#fff;border-radius:22px;padding:16px 28px;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;gap:6px;}
.opa-emoji{font-size:4.5rem;line-height:1.2;}
.opa-label{font-size:1.3rem;font-weight:800;color:${theme};}
.opa-grid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
.opa-opt{min-width:120px;min-height:72px;padding:8px 20px;border-radius:18px;background:#fff;font-weight:800;font-size:1.05rem;color:${theme};box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;gap:4px;}
.opa-opt-emoji{font-size:2rem;}
.opa-opt:active{transform:scale(.93);}
.opa-opt--right{background:#d4f4dd;outline:4px solid #34c759;color:#2e8b57;}
.opa-opt--wrong{background:#ffe0e0;outline:4px solid #ff3b30;}
`;
}

export function create(): OppositeActGame {
  return new OppositeActGame();
}
