/* 色词干扰 Stroop Test —— 显示一个颜色词（如"红"字用蓝色写），
   问"这个字是什么颜色的？"（不是字的意思）。训练 Stroop 抗干扰。
   5-6 岁简化版：只看字的墨水颜色，不看字义。
   难度=干扰强度。easy: 字义=墨色（无干扰）；medium: 50% 冲突；hard: 多数冲突 + 3 选项。
   巧思：显示大号彩色汉字，选项是颜色块；点对粒子，点错再答。
   前缀 stp-（stroop）。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { sample, shuffle } from "../../lobby/util.ts";

/** 颜色定义：字 + 墨色。选 4 种差异明显的颜色（5-6 岁可辨识）。 */
const COLORS: { word: string; ink: string }[] = [
  { word: "红", ink: "#ff5252" },
  { word: "蓝", ink: "#4d96ff" },
  { word: "绿", ink: "#6bcf7f" },
  { word: "黄", ink: "#ffd93d" },
];

/** 本关题目数（与统一规范一致：easy 4 / medium 6 / hard 8）。 */
function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 4 : diff === "medium" ? 6 : 8;
}

interface Question {
  word: string; // 显示的字（字义）
  ink: string; // 字的墨色（正确答案依据）
}

/** 生成一道题：word 与 ink 是否冲突取决于难度。 */
function makeQuestion(diff: "easy" | "medium" | "hard"): Question {
  const inkIdx = Math.floor(Math.random() * COLORS.length);
  const ink = COLORS[inkIdx]!;
  // 冲突概率：easy 0（字义=墨色，无干扰）；medium 0.5；hard 0.8
  const conflictRate = diff === "easy" ? 0 : diff === "medium" ? 0.5 : 0.8;
  const conflict = Math.random() < conflictRate;
  let word: string;
  if (!conflict) {
    word = ink.word;
  } else {
    // 选一个字义 ≠ 墨色的字
    const others = COLORS.filter((c) => c.word !== ink.word);
    word = sample(others).word;
  }
  return { word, ink: ink.ink };
}

export class StroopTestGame extends BaseGame {
  constructor() {
    super("stroop-test");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal = roundTotal(this.difficulty);
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空，定时器由基类清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.answered = false;
    const q = makeQuestion(this.difficulty);

    const wrap = document.createElement("div");
    wrap.className = "stp-wrap";

    const task = document.createElement("div");
    task.className = "stp-task";
    task.innerHTML = `这个字是什么<b>颜色</b>的？（不是看字的意思哦）（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 彩色汉字
    const wordEl = document.createElement("div");
    wordEl.className = "stp-word";
    wordEl.textContent = q.word;
    wordEl.style.color = q.ink;
    wordEl.style.textShadow = `0 4px 0 ${q.ink}33`;
    wrap.appendChild(wordEl);

    // 选项：颜色块。easy/medium 给 2 个（含正确答案 + 1 干扰），hard 给 3 个
    const optionCount = this.difficulty === "hard" ? 3 : 2;
    const correct = COLORS.find((c) => c.ink === q.ink)!;
    const distractors = shuffle(COLORS.filter((c) => c.ink !== q.ink)).slice(
      0,
      optionCount - 1,
    );
    const opts = shuffle([correct, ...distractors]);

    const choices = document.createElement("div");
    choices.className = "stp-choices";
    for (const c of opts) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "stp-opt";
      b.style.background = c.ink;
      b.dataset.ink = c.ink;
      b.setAttribute("aria-label", `${c.word}色`);
      b.addEventListener("click", () => this.choose(c.ink, q.ink, b));
      choices.appendChild(b);
    }
    wrap.appendChild(choices);
    this.root.appendChild(wrap);
  }

  private choose(picked: string, answer: string, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (picked === answer) {
      this.answered = true;
      btn.classList.add("stp-opt--right");
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
      }, 700);
    } else {
      btn.classList.add("stp-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("stp-opt--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "记住哦：要看字是什么颜色的，不要管它念什么～",
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
    if (document.getElementById("stp-style")) return;
    const st = document.createElement("style");
    st.id = "stp-style";
    st.textContent = STP_CSS();
    document.head.appendChild(st);
  }
}

function STP_CSS(): string {
  return `
.stp-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(440px,100%);}
.stp-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.stp-task b{color:#a55eea;}
.stp-word{font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:clamp(5rem,22vw,8rem);font-weight:900;line-height:1.2;user-select:none;}
.stp-choices{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;}
.stp-opt{width:96px;height:96px;min-width:48px;min-height:48px;border:none;border-radius:24px;box-shadow:0 5px 0 rgba(0,0,0,.15),var(--shadow);cursor:pointer;transition:transform .12s;touch-action:manipulation;}
.stp-opt:hover{transform:translateY(-3px);}
.stp-opt:active{transform:scale(.93);}
.stp-opt--right{box-shadow:0 0 0 5px #fff,0 0 0 9px #6bcf7f;animation:stp-pop .3s ease;}
.stp-opt--wrong{box-shadow:0 0 0 5px #fff,0 0 0 9px #ff6348;animation:stp-shake .4s ease;}
@keyframes stp-pop{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes stp-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.stp-opt{width:76px;height:76px;}}
`;
}

export function create(): StroopTestGame {
  return new StroopTestGame();
}
