/* 比大小 Big & Small —— 屏幕上出现两个动物（一大一小），
   问"哪个更大？"或"哪个更小？"，孩子点对应动物。
   认知启蒙：通过视觉大小对比，建立"大/小"概念。
   独特点：用 emoji 字号差异直观表现大小，3-4 岁只 2 选项最简单。前缀 bsm-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Animal {
  emoji: string;
}

const ANIMALS: Animal[] = [
  { emoji: "🐘" },
  { emoji: "🐭" },
  { emoji: "🦁" },
  { emoji: "🐰" },
  { emoji: "🐯" },
  { emoji: "🐹" },
  { emoji: "🐂" },
  { emoji: "🐱" },
  { emoji: "🦒" },
  { emoji: "🐤" },
  { emoji: "🐋" },
  { emoji: "🐠" },
];

type AskMode = "big" | "small";

export class BigSmallGame extends BaseGame {
  constructor() {
    super("big-small");
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
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 抽两个不同的动物，确保一大一小
    const pair = shuffle(ANIMALS).slice(0, 2);
    const askMode: AskMode = sample<AskMode>(["big", "small"] as const);
    // 正确项 = 大动物（askMode=big）或小动物（askMode=small）
    // pair[0] 显示为大号，pair[1] 显示为小号
    const correctEmoji = askMode === "big" ? pair[0]!.emoji : pair[1]!.emoji;

    const wrap = document.createElement("div");
    wrap.className = "bsm-wrap";

    const task = document.createElement("div");
    task.className = "bsm-task";
    task.innerHTML =
      askMode === "big"
        ? `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 哪个<b>更大</b>？点它～`
        : `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 哪个<b>更小</b>？点它～`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "bsm-stage";
    pair.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bsm-animal";
      // pair[0] 是大的，字号大；pair[1] 是小的，字号小
      if (a === pair[0]) b.classList.add("bsm-animal--big");
      else b.classList.add("bsm-animal--small");
      b.textContent = a.emoji;
      b.addEventListener("click", () =>
        this.choose(a.emoji, correctEmoji, b, stage),
      );
      stage.appendChild(b);
    });
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
  }

  private choose(
    emoji: string,
    correctEmoji: string,
    btn: HTMLButtonElement,
    stage: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (emoji === correctEmoji) {
      this.locked = true;
      sfxPop();
      btn.classList.add("bsm-animal--done");
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      stage.querySelectorAll(".bsm-animal").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("bsm-animal--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("bsm-animal--wrong"), 400);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "看一看～",
      emoji: "🔍",
      variant: "rest",
      body: "比一比两只动物，看看哪个个头更大、哪个更小，再点一下～",
      primary: { text: "继续", icon: "😊", onClick: () => ov.destroy() },
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
    if (document.getElementById("bsm-style")) return;
    const st = document.createElement("style");
    st.id = "bsm-style";
    st.textContent = BS_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function BS_CSS(theme: string): string {
  return `
.bsm-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(460px,100%);}
.bsm-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:12px 24px;border-radius:999px;box-shadow:var(--shadow);}
.bsm-task b{color:${theme};font-size:1.3rem;}
.bsm-stage{display:flex;align-items:center;justify-content:center;gap:36px;background:linear-gradient(180deg,#f0fff4,#d4f4dd);padding:30px 28px;border-radius:24px;box-shadow:var(--shadow);width:100%;box-sizing:border-box;min-height:240px;}
.bsm-animal{background:#fff;border:none;border-radius:24px;padding:18px 22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow);transition:transform .12s;line-height:1;}
.bsm-animal:active{transform:scale(.94);}
.bsm-animal--big{font-size:6.5rem;min-width:140px;min-height:160px;animation:bsm-bob 2.2s ease-in-out infinite;}
.bsm-animal--small{font-size:2.6rem;min-width:90px;min-height:110px;animation:bsm-bob 2.2s ease-in-out .6s infinite;}
@keyframes bsm-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.bsm-animal--done{background:#d4f4dd;outline:5px solid #34c759;animation:bsm-pop .4s ease;}
.bsm-animal--wrong{background:#ffe0e0;outline:5px solid #ff3b30;animation:bsm-shake .4s ease;}
@keyframes bsm-pop{0%{transform:scale(.7)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes bsm-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): BigSmallGame {
  return new BigSmallGame();
}
