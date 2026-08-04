/* 糖果花纹 Candy Pattern —— 一排糖果按规律排列（如红黄红黄红?），孩子从选项选缺的。
   独特点：视觉规律识别。区别于 pattern（通用 emoji 序列）、number-sequence（数字）。
   视觉：彩色糖果 emoji 排列 + 问号占位。难度 = 规律复杂度（周期长度）。
   通关 = 答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 糖果：emoji + 名称 + 颜色（用于按钮高亮）。 */
const CANDIES = [
  { emoji: "🍬", name: "水果糖", color: "#ff6b9d" },
  { emoji: "🍫", name: "巧克力", color: "#8b5e34" },
  { emoji: "🍭", name: "棒棒糖", color: "#4d96ff" },
  { emoji: "🍪", name: "饼干", color: "#d4a056" },
  { emoji: "🧁", name: "纸杯糕", color: "#a55eea" },
  { emoji: "🍩", name: "甜甜圈", color: "#ffd93d" },
] as const;

interface Puzzle {
  /** 完整序列（emoji 数组，含一个问号位由 '?' 表示） */
  display: string[];
  /** 问号在 display 中的索引 */
  qIdx: number;
  /** 正确答案 emoji */
  answer: string;
  /** 选项 emoji */
  choices: string[];
}

/** 生成一道题：周期为 period 的重复规律，挖一个空。 */
function genPuzzle(diff: string): Puzzle {
  const period = diff === "easy" ? 4 : diff === "medium" ? 2 : 3;
  const total = diff === "easy" ? 5 : diff === "medium" ? 7 : 8;
  const pool = shuffle(CANDIES).slice(0, period);
  const base = pool.map((c) => c.emoji);
  // 拼接到 total 长度
  const full: string[] = [];
  for (let i = 0; i < total; i++) full.push(base[i % period]!);
  // 挖空：选一个能让"规律可推断"的位置——优先后半段
  const qIdx = Math.floor(total / 2) + (diff === "easy" ? 0 : 1);
  const answer = full[qIdx]!;
  full[qIdx] = "?";
  // 干扰项
  const distract: string[] = [];
  const allEmojis = CANDIES.map((c) => c.emoji);
  while (distract.length < 3) {
    const c = shuffle(allEmojis)[0]!;
    if (c !== answer && !distract.includes(c) && !base.includes(c)) {
      distract.push(c);
    } else if (distract.length < 2 && !distract.includes(c) && c !== answer) {
      // 兜底：实在凑不够非规律项时，允许少量重选
      if (!distract.includes(c)) distract.push(c);
    }
    if (distract.length >= 3) break;
  }
  return {
    display: full,
    qIdx,
    answer,
    choices: shuffle([answer, ...distract.slice(0, 3)]),
  };
}

export class CandyPatternGame extends BaseGame {
  constructor() {
    super("candy-pattern");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    const puzzle = genPuzzle(this.difficulty);

    const wrap = document.createElement("div");
    wrap.className = "cp-wrap";
    const task = document.createElement("div");
    task.className = "cp-task";
    task.textContent = `问号处该放哪颗糖？找找重复的规律～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 糖果盘（一条传送带视觉）
    const belt = document.createElement("div");
    belt.className = "cp-belt";
    puzzle.display.forEach((c, i) => {
      const slot = document.createElement("div");
      slot.className = "cp-slot";
      if (c === "?") {
        slot.classList.add("cp-slot--q");
        slot.id = "cp-q";
        slot.textContent = "？";
      } else {
        slot.textContent = c;
        slot.classList.add("cp-slot--candy");
      }
      // 给每 3 个分组着色，强调周期
      if (i > 0 && i % 3 === 0 && c !== "?") {
        slot.classList.add("cp-slot--group");
      }
      belt.appendChild(slot);
    });
    wrap.appendChild(belt);

    // 选项
    const opts = document.createElement("div");
    opts.className = "cp-opts";
    puzzle.choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cp-choice";
      b.textContent = c;
      b.addEventListener("click", () => this.choose(c, puzzle.answer, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(c: string, answer: string, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (c === answer) {
      this.answered = true;
      const q = this.root.querySelector("#cp-q");
      if (q) {
        q.textContent = answer;
        q.classList.remove("cp-slot--q");
        q.classList.add("cp-slot--candy", "cp-slot--done");
      }
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("cp-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("cp-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看糖果是按什么顺序重复的，找出下一个～",
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
    if (document.getElementById("cp-style")) return;
    const st = document.createElement("style");
    st.id = "cp-style";
    st.textContent = CP_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function CP_CSS(theme: string): string {
  return `
.cp-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(560px,100%);}
.cp-task{font-size:1.1rem;font-weight:800;text-align:center;}
.cp-belt{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;background:linear-gradient(180deg,#fff,#fff0f6);padding:14px 16px;border-radius:22px;box-shadow:var(--shadow);position:relative;}
.cp-belt::after{content:'';position:absolute;left:10px;right:10px;bottom:6px;height:6px;background:repeating-linear-gradient(90deg,${theme} 0 8px,transparent 8px 14px);border-radius:3px;opacity:.5;}
.cp-slot{width:54px;height:60px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:1.9rem;box-shadow:0 2px 6px rgba(0,0,0,.12);margin-bottom:8px;}
.cp-slot--candy{animation:cp-drop .4s ease;}
.cp-slot--q{background:#fff3c4;font-size:2rem;font-weight:900;color:${theme};border:3px dashed ${theme};}
.cp-slot--done{background:#d4f4dd;border:none;animation:cp-pop .4s ease;}
.cp-slot--group{outline:2px dashed #ddd;outline-offset:2px;}
.cp-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.cp-choice{width:70px;height:70px;font-size:2.2rem;border-radius:50%;background:#fff;box-shadow:var(--shadow);transition:transform .12s ease;}
.cp-choice:active{transform:scale(.92);}
.cp-choice--wrong{animation:cp-shake .4s ease;}
@keyframes cp-drop{0%{transform:translateY(-14px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes cp-pop{0%{transform:scale(.6)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes cp-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.cp-slot{width:46px;height:52px;font-size:1.6rem;}.cp-choice{width:60px;height:60px;font-size:1.9rem;}}
`;
}

export function create(): CandyPatternGame {
  return new CandyPatternGame();
}
