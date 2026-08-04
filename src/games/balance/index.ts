/* 天平称重 Balance —— 比较两边物品轻重，选哪边更重/更轻或一样重。
   巧思：天平根据选择倾斜动画；重量用动物大小暗示。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

// 每个物品有一个"重量"（1-5），用 emoji
const ITEMS = [
  { emoji: "🐜", w: 1 },
  { emoji: "🐭", w: 2 },
  { emoji: "🐱", w: 3 },
  { emoji: "🐶", w: 4 },
  { emoji: "🐘", w: 5 },
  { emoji: "🐦", w: 1 },
  { emoji: "🐰", w: 2 },
  { emoji: "🐷", w: 4 },
];

export class BalanceGame extends BaseGame {
  constructor() {
    super("balance");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private beamEl!: HTMLDivElement;

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
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const [minN, maxN] =
      this.difficulty === "easy"
        ? [1, 3]
        : this.difficulty === "medium"
          ? [1, 4]
          : [2, 5];
    const left = sample(ITEMS.filter((i) => i.w >= minN && i.w <= maxN))!;
    const right = sample(ITEMS.filter((i) => i.w >= minN && i.w <= maxN))!;
    // 题目：哪边更重？
    const askHeavier = Math.random() < 0.5;
    let answer: "left" | "right" | "equal";
    if (left.w > right.w) answer = "left";
    else if (right.w > left.w) answer = "right";
    else answer = "equal";

    const wrap = document.createElement("div");
    wrap.className = "bl-wrap";
    const task = document.createElement("div");
    task.className = "bl-task";
    task.textContent = askHeavier ? "哪边更重？" : "哪边更轻？";
    wrap.appendChild(task);

    // 天平
    const scale = document.createElement("div");
    scale.className = "bl-scale";
    this.beamEl = document.createElement("div");
    this.beamEl.className = "bl-beam";
    const leftPan = document.createElement("div");
    leftPan.className = "bl-pan bl-pan--left";
    leftPan.textContent = left.emoji;
    const rightPan = document.createElement("div");
    rightPan.className = "bl-pan bl-pan--right";
    rightPan.textContent = right.emoji;
    this.beamEl.appendChild(leftPan);
    this.beamEl.appendChild(rightPan);
    scale.appendChild(this.beamEl);
    const stand = document.createElement("div");
    stand.className = "bl-stand";
    scale.appendChild(stand);
    wrap.appendChild(scale);

    // 选项
    const opts = document.createElement("div");
    opts.className = "bl-opts";
    const choices: { id: "left" | "right" | "equal"; label: string }[] = [
      { id: "left", label: "⬅️ 左边" },
      { id: "equal", label: "⚖️ 一样" },
      { id: "right", label: "➡️ 右边" },
    ];
    // 如果问"更轻"且实际一样，answer 是 equal；正确判定需结合 askHeavier
    let realAns: "left" | "right" | "equal" = answer;
    // 更轻则反转比较方向
    if (!askHeavier) {
      if (answer === "left") realAns = "right";
      else if (answer === "right") realAns = "left";
    }
    shuffle(choices).forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bl-choice";
      b.textContent = c.label;
      b.addEventListener("click", () =>
        this.choose(c.id, realAns, b, left.w, right.w),
      );
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(
    id: string,
    answer: string,
    btn: HTMLButtonElement,
    lw: number,
    rw: number,
  ): void {
    if (id === answer) {
      sfxPop();
      btn.classList.add("bl-choice--done");
      // 天平倾斜展示真相
      const tilt = lw > rw ? -12 : rw > lw ? 12 : 0;
      this.beamEl.style.transform = `rotate(${tilt}deg)`;
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1300);
    } else {
      btn.classList.add("bl-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("bl-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想哪种动物更重～",
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
    if (document.getElementById("bl-style")) return;
    const st = document.createElement("style");
    st.id = "bl-style";
    st.textContent = BL_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function BL_CSS(theme: string): string {
  return `
.bl-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(440px,100%);}
.bl-task{font-size:1.3rem;font-weight:800;}
.bl-scale{position:relative;width:280px;height:120px;display:flex;flex-direction:column;align-items:center;}
.bl-beam{position:relative;width:240px;height:10px;background:${theme};border-radius:5px;margin-top:10px;transition:transform .8s ease;transform-origin:center;}
.bl-pan{position:absolute;top:0;width:64px;height:64px;font-size:2.4rem;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:0 0 32px 32px;box-shadow:var(--shadow);}
.bl-pan--left{left:-20px;top:0;}
.bl-pan--right{right:-20px;top:0;}
.bl-stand{width:14px;height:70px;background:${theme};border-radius:4px;margin-top:-2px;}
.bl-opts{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.bl-choice{min-height:56px;padding:0 22px;font-size:1.1rem;font-weight:700;border-radius:999px;background:#fff;box-shadow:var(--shadow);}
.bl-choice:active{transform:scale(.95);}
.bl-choice--done{background:#d4f4dd;animation:bl-pop .4s ease;}
.bl-choice--wrong{animation:bl-shake .4s ease;}
@keyframes bl-pop{0%{transform:scale(.7)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes bl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): BalanceGame {
  return new BalanceGame();
}
