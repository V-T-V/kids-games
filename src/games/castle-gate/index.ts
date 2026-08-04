/* 城堡门 Castle Gate —— 城堡门上有密码锁，显示一串符号序列（如 ★🌙★🌙?），
   孩子从选项里选出"?"处缺少的符号。
   独特点：序列是重复规律（ABAB/ABCABC），缺口位置的答案是唯一确定的；
   选对则门闩弹开，城堡门打开。难度=序列长度。通关=解对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

const SYMBOLS = ["★", "🌙", "☀️", "🔥", "💧", "🌿", "⚡", "❄️"];

interface Puzzle {
  /** 完整序列（含缺口处填回的正确符号），用于显示。 */
  display: (string | null)[];
  /** 缺口在 display 里的索引（值为 null）。 */
  blankIndex: number;
  /** 正确符号。 */
  answer: string;
  /** 选项（含正确 + 干扰）。 */
  options: string[];
}

export class CastleGateGame extends BaseGame {
  constructor() {
    super("castle-gate");
  }

  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const puzzle = this.genPuzzle();

    const wrap = document.createElement("div");
    wrap.className = "cgt-wrap";

    const task = document.createElement("div");
    task.className = "cgt-task";
    task.innerHTML = `找出 <b style="color:${getCssVar("--c-brown")}">?</b> 处该填的符号～<span class="cgt-prog">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "cgt-hint";
    hint.id = "cgt-hint";
    hint.textContent = "看看符号是怎么重复的～";
    wrap.appendChild(hint);

    // 城堡 + 门
    const castle = document.createElement("div");
    castle.className = "cgt-castle";
    castle.innerHTML = `
      <div class="cgt-tower cgt-tower--left"><div class="cgt-flag">🚩</div></div>
      <div class="cgt-tower cgt-tower--right"><div class="cgt-flag">🚩</div></div>
      <div class="cgt-gate">
        <div class="cgt-lock" id="cgt-lock"></div>
      </div>`;
    const lock = castle.querySelector("#cgt-lock")!;
    puzzle.display.forEach((sym, _i) => {
      const cell = document.createElement("div");
      cell.className = "cgt-cell";
      if (sym === null) {
        cell.classList.add("cgt-cell--blank");
        cell.textContent = "?";
      } else {
        cell.textContent = sym;
      }
      lock.appendChild(cell);
    });
    wrap.appendChild(castle);

    // 选项
    const options = document.createElement("div");
    options.className = "cgt-options";
    puzzle.options.forEach((sym) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cgt-option";
      b.textContent = sym;
      b.addEventListener("click", () => this.choose(sym, puzzle, b));
      options.appendChild(b);
    });
    wrap.appendChild(options);

    this.root.appendChild(wrap);
  }

  /** 生成有唯一解的重复规律谜题。 */
  private genPuzzle(): Puzzle {
    // 难度决定符号种类与序列长度
    const kindCount =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 2 : 3;
    const repeat =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 3 : 2;
    // 总长 = kindCount * repeat（保证完整周期）
    const syms = shuffle(SYMBOLS).slice(0, kindCount);
    const full: string[] = [];
    for (let r = 0; r < repeat; r++) {
      for (let k = 0; k < kindCount; k++) full.push(syms[k]!);
    }
    // 选一个"有唯一解"的缺口位置：
    // 缺口处的正确符号，必须在其他选项里不出现（避免歧义）。
    // 简单做法：缺口位置 i 的答案 = full[i]；干扰项从"未在序列里"的符号挑。
    const blankIndex = Math.floor(full.length / 2); // 中间位置，规律最清晰
    const answer = full[blankIndex]!;
    const inSeq = new Set(full);
    const distractors = shuffle(SYMBOLS.filter((s) => !inSeq.has(s))).slice(
      0,
      3,
    );
    const options = shuffle([answer, ...distractors]);

    const display: (string | null)[] = full.map((s, i) =>
      i === blankIndex ? null : s,
    );
    return { display, blankIndex, answer, options };
  }

  private choose(sym: string, puzzle: Puzzle, btn: HTMLButtonElement): void {
    if (btn.classList.contains("cgt-option--used")) return;
    if (sym === puzzle.answer) {
      btn.classList.add("cgt-option--used");
      sfxPop();
      // 把答案填进缺口
      const cells = this.root.querySelectorAll(".cgt-cell");
      const cell = cells[puzzle.blankIndex];
      if (cell) {
        cell.classList.remove("cgt-cell--blank");
        cell.classList.add("cgt-cell--filled");
        cell.textContent = sym;
      }
      // 开门动画
      const gate = this.root.querySelector(".cgt-gate");
      gate?.classList.add("cgt-gate--open");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      const hint = this.root.querySelector("#cgt-hint");
      if (hint) hint.textContent = "对啦！门开啦～ 🎉";
      // 禁用所有选项
      this.root
        .querySelectorAll<HTMLButtonElement>(".cgt-option")
        .forEach((b) => (b.disabled = true));
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1200);
    } else {
      btn.classList.add("cgt-option--shake");
      this.trackTimeout(() => btn.classList.remove("cgt-option--shake"), 400);
      const paused = this.onWrong();
      const hint = this.root.querySelector("#cgt-hint");
      if (hint) hint.textContent = "再看看，符号是怎么重复的？";
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "把符号读一遍，找找它们是怎么重复的～",
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
    if (document.getElementById("cgt-style")) return;
    const st = document.createElement("style");
    st.id = "cgt-style";
    st.textContent = CGT_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

// 让 sample 不被未使用警告（实际未在本文件用到 sample）
void sample;

function CGT_CSS(theme: string): string {
  void theme;
  return `
.cgt-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(540px,100%);}
.cgt-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.cgt-prog{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.cgt-hint{font-size:1rem;font-weight:700;color:var(--ink-soft);min-height:1.4em;}
.cgt-castle{position:relative;display:flex;align-items:flex-end;justify-content:center;gap:0;padding-top:20px;}
.cgt-tower{width:60px;height:120px;background:linear-gradient(180deg,#9a8260,#7a6248);border-radius:8px;position:relative;box-shadow:var(--shadow);}
.cgt-tower::before{content:'';position:absolute;top:-14px;left:-4px;right:-4px;height:18px;background:#5a4a36;clip-path:polygon(0 100%,12% 0,25% 100%,37% 0,50% 100%,62% 0,75% 100%,87% 0,100% 100%);}
.cgt-flag{position:absolute;top:-42px;left:50%;transform:translateX(-50%);font-size:1.4rem;}
.cgt-gate{position:relative;width:280px;height:170px;background:linear-gradient(180deg,#6b5640,#4a3a2a);border-radius:120px 120px 8px 8px / 90px 90px 8px 8px;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow);overflow:hidden;}
.cgt-gate::after{content:'🔒';position:absolute;top:10px;left:50%;transform:translateX(-50%);font-size:1.6rem;transition:opacity .4s ease,transform .4s ease;}
.cgt-gate--open::after{opacity:0;transform:translateX(-50%) translateY(-30px);}
.cgt-lock{display:flex;gap:6px;padding:14px 12px;background:rgba(0,0,0,.35);border-radius:12px;border:3px solid #3a2a1a;}
.cgt-cell{width:44px;height:50px;border-radius:8px;background:linear-gradient(180deg,#fffbe6,#ffe9a8);display:flex;align-items:center;justify-content:center;font-size:1.7rem;font-weight:800;box-shadow:inset 0 -2px 0 rgba(0,0,0,.15);}
.cgt-cell--blank{background:linear-gradient(180deg,#ffd1d1,#ff9a9a);color:#c0392b;animation:cgt-pulse 1s ease-in-out infinite;}
.cgt-cell--filled{background:linear-gradient(180deg,#d4f4dd,#a8e6b8);animation:cgt-pop .3s ease;}
@keyframes cgt-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes cgt-pop{0%{transform:scale(.5)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
.cgt-options{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.cgt-option{width:64px;height:64px;border-radius:14px;background:linear-gradient(180deg,#fff,#f0e6d2);border:3px solid var(--c-brown);font-size:1.8rem;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s ease;}
.cgt-option:active{transform:scale(.92);}
.cgt-option:disabled{opacity:.5;cursor:default;}
.cgt-option--used{background:linear-gradient(180deg,#d4f4dd,#a8e6b8);border-color:var(--c-green);}
.cgt-option--shake{animation:cgt-shake .4s ease;}
@keyframes cgt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.cgt-gate{width:240px;height:150px;}.cgt-cell{width:36px;height:42px;font-size:1.4rem;}.cgt-tower{width:50px;height:100px;}.cgt-option{width:54px;height:54px;font-size:1.5rem;}}
`;
}

export function create(): CastleGateGame {
  return new CastleGateGame();
}
