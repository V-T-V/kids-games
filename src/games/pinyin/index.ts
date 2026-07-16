/* 拼音首字母 Pinyin —— 给拼音找对应的汉字图。
   独特点：中文拼音启蒙（区别于英文字母 letter-bee）。
   巧思：点击喇叭发音，答对汉字亮起。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Word {
  py: string;
  zh: string;
  emoji: string;
}
const WORDS: Word[] = [
  { py: "b", zh: "b-杯", emoji: "🥤" },
  { py: "p", zh: "p-盆", emoji: "🪣" },
  { py: "m", zh: "m-猫", emoji: "🐱" },
  { py: "f", zh: "f-房", emoji: "🏠" },
  { py: "d", zh: "d-灯", emoji: "💡" },
  { py: "t", zh: "t-兔", emoji: "🐰" },
  { py: "n", zh: "n-鸟", emoji: "🐦" },
  { py: "l", zh: "l-梨", emoji: "🍐" },
  { py: "g", zh: "g-狗", emoji: "🐶" },
  { py: "h", zh: "h-花", emoji: "🌸" },
];

export class PinyinGame extends BaseGame {
  constructor() {
    super("pinyin");
  }
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    const n =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    const picked = shuffle(WORDS).slice(0, n);
    const target = sample(picked);

    const wrap = document.createElement("div");
    wrap.className = "py-wrap";
    const task = document.createElement("div");
    task.className = "py-task";
    task.innerHTML = `听到的拼音是「<span class="py-letter">${target.py}</span>」，找对应的图<br><span class="py-hint">${target.zh}的声母</span>`;
    wrap.appendChild(task);

    const opts = document.createElement("div");
    opts.className = "py-opts";
    shuffle(picked).forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "py-opt";
      b.innerHTML = `<div class="py-emoji">${w.emoji}</div><div class="py-zh">${w.zh}</div>`;
      b.addEventListener("click", () => this.choose(w, target, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(w: Word, target: Word, btn: HTMLButtonElement): void {
    if (w.py === target.py) {
      sfxPop();
      btn.classList.add("py-opt--done");
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
      btn.classList.add("py-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("py-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想哪个字的开头和它一样～",
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
    if (document.getElementById("py-style")) return;
    const st = document.createElement("style");
    st.id = "py-style";
    st.textContent = PY_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function PY_CSS(theme: string): string {
  return `
.py-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(460px,100%);}
.py-task{font-size:1.2rem;font-weight:800;text-align:center;line-height:1.6;}
.py-letter{display:inline-block;color:#fff;background:${theme};padding:2px 16px;border-radius:12px;font-size:1.4em;}
.py-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.py-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.py-opt{width:92px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;}
.py-opt:active{transform:scale(.93);}
.py-emoji{font-size:2.6rem;}
.py-zh{font-size:.85rem;font-weight:700;}
.py-opt--done{background:#d4f4dd;animation:py-pop .4s ease;}
.py-opt--wrong{animation:py-shake .4s ease;}
@keyframes py-pop{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes py-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): PinyinGame {
  return new PinyinGame();
}
