/* 大小写配对 Upper-Lower —— 给一个大写字母，选它对应的小写。
   独特点：英文字母大小写映射训练（区别于中文识字类）。
   巧思：用单词联想帮助记忆（A→apple🍎），干扰项是形状相近的小写字母；
         难度=选项数（easy=3, medium=4, hard=6）。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** 26 个字母 + 联想单词/emoji（帮助孩子记忆）。 */
interface Letter {
  upper: string;
  lower: string;
  emoji: string;
  word: string;
}
const LETTERS: Letter[] = [
  { upper: "A", lower: "a", emoji: "🍎", word: "apple" },
  { upper: "B", lower: "b", emoji: "🐻", word: "bear" },
  { upper: "C", lower: "c", emoji: "🐱", word: "cat" },
  { upper: "D", lower: "d", emoji: "🐶", word: "dog" },
  { upper: "E", lower: "e", emoji: "🐘", word: "elephant" },
  { upper: "F", lower: "f", emoji: "🐸", word: "frog" },
  { upper: "G", lower: "g", emoji: "🍇", word: "grape" },
  { upper: "H", lower: "h", emoji: "🏠", word: "house" },
  { upper: "I", lower: "i", emoji: "🧊", word: "ice" },
  { upper: "J", lower: "j", emoji: "🤹", word: "juggle" },
  { upper: "K", lower: "k", emoji: "🪁", word: "kite" },
  { upper: "L", lower: "l", emoji: "🦁", word: "lion" },
  { upper: "M", lower: "m", emoji: "🌙", word: "moon" },
  { upper: "N", lower: "n", emoji: "🪺", word: "nest" },
  { upper: "O", lower: "o", emoji: "🍊", word: "orange" },
  { upper: "P", lower: "p", emoji: "🐧", word: "penguin" },
  { upper: "Q", lower: "q", emoji: "👑", word: "queen" },
  { upper: "R", lower: "r", emoji: "🌈", word: "rainbow" },
  { upper: "S", lower: "s", emoji: "☀️", word: "sun" },
  { upper: "T", lower: "t", emoji: "🐯", word: "tiger" },
  { upper: "U", lower: "u", emoji: "☂️", word: "umbrella" },
  { upper: "V", lower: "v", emoji: "🎻", word: "violin" },
  { upper: "W", lower: "w", emoji: "💧", word: "water" },
  { upper: "X", lower: "x", emoji: "📦", word: "box" },
  { upper: "Y", lower: "y", emoji: "🧒", word: "you" },
  { upper: "Z", lower: "z", emoji: "🦓", word: "zebra" },
];

export class UpperLowerGame extends BaseGame {
  constructor() {
    super("upper-lower");
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

  /** 选项数=难度。 */
  private optionCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 6;
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const target = sample(LETTERS);
    const need = this.optionCount();
    // 干扰字母池：排除正确答案
    const distractPool = shuffle(
      LETTERS.filter((l) => l.upper !== target.upper),
    );
    const distract = distractPool.slice(0, need - 1);
    // 选项必含正确答案
    const options = shuffle([target, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "upl-wrap";

    const task = document.createElement("div");
    task.className = "upl-task";
    task.innerHTML = `找出大写字母 <b>${target.upper}</b> 对应的<b>小写</b>字母<br><span class="upl-hint">第 ${this.roundsDone + 1}/${this.roundTotal} 题</span>`;
    wrap.appendChild(task);

    // 大写字母大卡（带联想提示）
    const targetCard = document.createElement("div");
    targetCard.className = "upl-target";
    targetCard.innerHTML = `
      <div class="upl-target__upper">${target.upper}</div>
      <div class="upl-target__hint">${target.emoji} ${target.word}</div>
    `;
    wrap.appendChild(targetCard);

    const opts = document.createElement("div");
    opts.className = "upl-opts";
    options.forEach((l) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "upl-opt";
      b.textContent = l.lower;
      b.addEventListener("click", () => this.choose(l, target, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(l: Letter, target: Letter, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (l.lower === target.lower) {
      this.answered = true;
      sfxPop();
      btn.classList.add("upl-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("upl-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("upl-opt--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看大写字母的形状，找长得像的小写字母～",
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
    if (document.getElementById("upl-style")) return;
    const st = document.createElement("style");
    st.id = "upl-style";
    st.textContent = UPL_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function UPL_CSS(theme: string): string {
  return `
.upl-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(460px,100%);}
.upl-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;}
.upl-hint{font-size:.82rem;color:var(--ink-soft);font-weight:600;}
.upl-target{display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 36px;border-radius:24px;background:linear-gradient(135deg,#fff,${theme}44);box-shadow:var(--shadow-lg);}
.upl-target__upper{font-size:4.5rem;font-weight:900;color:${theme};font-family:'Comic Sans MS','Arial Black',sans-serif;line-height:1;}
.upl-target__hint{font-size:1rem;font-weight:700;color:var(--ink-soft);}
.upl-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding-top:8px;}
.upl-opt{width:74px;height:74px;font-size:2.6rem;font-weight:900;font-family:'Comic Sans MS','Arial Black',sans-serif;background:#fff;color:var(--ink);border-radius:18px;box-shadow:var(--shadow);transition:transform .15s;}
.upl-opt:active{transform:scale(.93);}
.upl-opt--done{background:linear-gradient(135deg,#6bcf7f,#4ba85f);color:#fff;animation:upl-pop .45s ease;}
.upl-opt--wrong{animation:upl-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes upl-pop{0%{transform:scale(.5)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes upl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): UpperLowerGame {
  return new UpperLowerGame();
}
