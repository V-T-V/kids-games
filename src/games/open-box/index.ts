/* 开盒子 Open-Box —— 给出一种盒子（翻盖/抽屉/旋转盖），
   孩子从 3 种开法里点出<b>正确的</b>打开方式。
   独特点：开盖方式认知 + 多选项。视觉：盒子卡 + 开法按钮。
   巧思：点对盒子"打开"动画；点错抖动并提示。前缀 obx-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface BoxKind {
  emoji: string;
  name: string;
  /** 唯一正确的开法 id */
  answer: string;
}
interface Way {
  id: string;
  emoji: string;
  text: string;
}

const WAYS: Way[] = [
  { id: "flip", emoji: "🔝", text: "往上翻开盖子" },
  { id: "pull", emoji: "↔️", text: "往外拉开抽屉" },
  { id: "twist", emoji: "🔄", text: "转一转拧开盖子" },
];

const BOXES: BoxKind[] = [
  { emoji: "📦", name: "快递纸盒", answer: "flip" },
  { emoji: "🗄️", name: "抽屉柜子", answer: "pull" },
  { emoji: "🫙", name: "果酱罐子", answer: "twist" },
  { emoji: "🎁", name: "礼物盒子", answer: "flip" },
  { emoji: "🧰", name: "工具箱子", answer: "pull" },
  { emoji: "🥤", name: "饮料瓶子", answer: "twist" },
];

export class OpenBoxGame extends BaseGame {
  constructor() {
    super("open-box");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private order: BoxKind[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.order = shuffle(BOXES);
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
    const box = this.order[this.roundsDone % this.order.length]!;
    // 把正确项 + 两个干扰项随机排
    const distract = shuffle(WAYS.filter((w) => w.id !== box.answer)).slice(
      0,
      2,
    );
    const rightWay = WAYS.find((w) => w.id === box.answer)!;
    const choices = shuffle([rightWay, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "obx-wrap";
    const task = document.createElement("div");
    task.className = "obx-task";
    task.innerHTML = `这个<b>${box.name}</b>，用哪种方法打开？`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "obx-card";
    card.id = "obx-card";
    card.innerHTML = `<div class="obx-card__emoji">${box.emoji}</div>`;
    wrap.appendChild(card);

    const opts = document.createElement("div");
    opts.className = "obx-opts";
    choices.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "obx-choice";
      b.innerHTML = `<span class="obx-choice__emoji">${w.emoji}</span><span>${w.text}</span>`;
      b.addEventListener("click", () => this.choose(w.id, b, box.emoji));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(id: string, btn: HTMLButtonElement, emoji: string): void {
    if (this.answered) return;
    const box = this.order[this.roundsDone % this.order.length]!;
    if (id === box.answer) {
      this.answered = true;
      btn.classList.add("obx-choice--right");
      sfxPop();
      const card = this.root.querySelector("#obx-card");
      card?.classList.add("obx-card--open");
      if (card)
        card.innerHTML = `<div class="obx-card__emoji obx-card__emoji--open">${emoji}</div><div class="obx-card__star">⭐</div>`;
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
      }, 1100);
    } else {
      btn.classList.add("obx-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("obx-choice--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "📦",
      variant: "rest",
      body: "盒子和盖子开法不一样：纸盒<b>翻开</b>、抽屉<b>拉开</b>、瓶罐<b>拧开</b>～",
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
    if (document.getElementById("obx-style")) return;
    const st = document.createElement("style");
    st.id = "obx-style";
    st.textContent = OBX_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function OBX_CSS(theme: string): string {
  return `
.obx-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.obx-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.obx-task b{color:${theme};}
.obx-card{width:160px;height:160px;border-radius:28px;background:linear-gradient(180deg,#fff,#ffe7d4);box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;transition:transform .3s;position:relative;}
.obx-card--open{transform:scale(1.1);}
.obx-card__emoji{font-size:5rem;line-height:1;}
.obx-card__emoji--open{animation:obx-open .8s ease;}
.obx-card__star{position:absolute;font-size:2rem;animation:obx-pop .6s ease;}
@keyframes obx-open{0%{transform:scale(1) rotate(0)}50%{transform:scale(1.3) rotate(8deg)}100%{transform:scale(1) rotate(0)}}
@keyframes obx-pop{0%{transform:translateY(0) scale(0)}100%{transform:translateY(-30px) scale(1.4)}}
.obx-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:360px;}
.obx-choice{display:flex;align-items:center;gap:10px;padding:14px 18px;font-size:1rem;font-weight:700;border-radius:14px;border:3px solid #e0e0e8;background:#fff;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;color:var(--ink);}
.obx-choice:active{transform:scale(.97);}
.obx-choice__emoji{font-size:1.6rem;}
.obx-choice--right{border-color:#6bcf7f;background:#d4f4dd;animation:obx-pop2 .4s ease;}
.obx-choice--wrong{border-color:#ff6348;background:#ffe0e0;animation:obx-shake .4s ease;}
@keyframes obx-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes obx-pop2{0%{transform:scale(.9)}60%{transform:scale(1.05)}100%{transform:scale(1)}}
`;
}

export function create(): OpenBoxGame {
  return new OpenBoxGame();
}
