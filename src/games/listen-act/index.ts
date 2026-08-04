/* 听指令 Listen-Act —— 听到一句动作指令，从动作图里选对应的。
   独特点：纯听觉驱动，孩子学会「听-理解-行动」三步（区别于看图选词）。
   巧思：用语音合成朗读指令，配大 emoji 动作图；
         「再听一遍」按钮，避免孩子漏听后束手无策；难度=选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** 动作库：emoji + 朗读指令 + 小提示文字。 */
interface Action {
  emoji: string;
  /** 朗读给孩子的指令（直白短句） */
  say: string;
  /** 卡片下方的提示文字 */
  label: string;
}
const ACTIONS: Action[] = [
  { emoji: "👏", say: "拍拍手", label: "拍手" },
  { emoji: "🦶", say: "跺跺脚", label: "跺脚" },
  { emoji: "🙌", say: "举举手", label: "举手" },
  { emoji: "🤚", say: "挥挥手", label: "挥手" },
  { emoji: "🕺", say: "扭扭腰", label: "扭腰" },
  { emoji: "🤸", say: "点点头", label: "点头" },
  { emoji: "👀", say: "眨眨眼", label: "眨眼" },
  { emoji: "🤗", say: "抱一抱", label: "抱抱" },
  { emoji: "🦵", say: "踢踢腿", label: "踢腿" },
  { emoji: "💃", say: "跳一跳", label: "跳跳" },
];

/** 用语音合成朗读指令。 */
function speak(text: string): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* 浏览器不支持则静默 */
  }
}

export class ListenActGame extends BaseGame {
  constructor() {
    super("listen-act");
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
    try {
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  /** 选项数 = 难度。easy=3, medium=4, hard=5 */
  private optionCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.optionCount();
    const picked = shuffle(ACTIONS).slice(0, n);
    const target = sample(picked);

    const wrap = document.createElement("div");
    wrap.className = "lac-wrap";

    const task = document.createElement("div");
    task.className = "lac-task";
    task.innerHTML = `听一听，点出你听到的动作<br><span class="lac-hint">第 ${this.roundsDone + 1}/${this.roundTotal} 题</span>`;
    wrap.appendChild(task);

    const player = document.createElement("div");
    player.className = "lac-player";
    player.appendChild(
      createButton({
        text: "再听一遍",
        icon: "🔊",
        variant: "secondary",
        onClick: () => speak(target.say),
      }),
    );
    wrap.appendChild(player);

    const grid = document.createElement("div");
    grid.className = "lac-grid";
    shuffle(picked).forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lac-opt";
      b.innerHTML = `<div class="lac-emoji">${a.emoji}</div><div class="lac-label">${a.label}</div>`;
      b.addEventListener("click", () => this.choose(a, target, b));
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    this.root.appendChild(wrap);

    // 进关卡后稍等再朗读，避免上一关音效冲突
    this.trackTimeout(() => speak(target.say), 400);
  }

  private choose(a: Action, target: Action, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (a.emoji === target.emoji) {
      this.answered = true;
      sfxPop();
      btn.classList.add("lac-opt--done");
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
      btn.classList.add("lac-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("lac-opt--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "点「再听一遍」仔细听动作～",
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
    if (document.getElementById("lac-style")) return;
    const st = document.createElement("style");
    st.id = "lac-style";
    st.textContent = LAC_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function LAC_CSS(theme: string): string {
  void theme;
  return `
.lac-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(460px,100%);}
.lac-task{font-size:1.25rem;font-weight:800;text-align:center;line-height:1.5;}
.lac-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;display:inline-block;margin-top:4px;}
.lac-player{display:flex;justify-content:center;}
.lac-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;justify-content:center;}
@media(min-width:420px){.lac-grid{grid-template-columns:repeat(5,1fr);}}
.lac-opt{width:88px;background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;transition:transform .15s;}
.lac-opt:active{transform:scale(.93);}
.lac-emoji{font-size:2.8rem;line-height:1;}
.lac-label{font-size:.85rem;font-weight:700;color:var(--ink);}
.lac-opt--done{background:linear-gradient(135deg,#6bcf7f,#4ba85f);color:#fff;animation:lac-pop .45s ease;}
.lac-opt--done .lac-label{color:#fff;}
.lac-opt--wrong{animation:lac-shake .4s ease;background:#ff6348;color:#fff;}
.lac-opt--wrong .lac-label{color:#fff;}
@keyframes lac-pop{0%{transform:scale(.5)}60%{transform:scale(1.22)}100%{transform:scale(1)}}
@keyframes lac-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ListenActGame {
  return new ListenActGame();
}
