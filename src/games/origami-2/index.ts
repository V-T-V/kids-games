/* 折纸进阶 Origami 2 —— 比基础版更复杂的 6 步折纸排序。
   艺术启蒙：顺序记忆 + 因果推理。独特点：每个作品固定 6 步（无论难度），
   难度只改变总轮数。已折好的步骤实时显示在上方进度条。
   注意：用 org2- 前缀（og- 已被 origami 占用）。前缀 org2-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface FoldStep {
  icon: string;
  text: string;
}

const ORIGAMI: { name: string; emoji: string; steps: FoldStep[] }[] = [
  {
    name: "千纸鹤",
    emoji: "🕊️",
    steps: [
      { icon: "📄", text: "拿一张方纸" },
      { icon: "📐", text: "对角折成三角" },
      { icon: "🔺", text: "再把三角对折" },
      { icon: "✦", text: "撑开压成菱形" },
      { icon: "🪶", text: "折出两个翅膀" },
      { icon: "🕊️", text: "拉出头和尾巴" },
    ],
  },
  {
    name: "纸花",
    emoji: "🌸",
    steps: [
      { icon: "📄", text: "拿方形纸" },
      { icon: "📐", text: "对折成长方" },
      { icon: "🔺", text: "一角向中折" },
      { icon: "🔁", text: "四角都向中折" },
      { icon: "🌹", text: "卷起每片花瓣" },
      { icon: "🌸", text: "展开成花朵" },
    ],
  },
  {
    name: "小帽子",
    emoji: "🎩",
    steps: [
      { icon: "📄", text: "拿一张方纸" },
      { icon: "▾", text: "上角向下折" },
      { icon: "◢◣", text: "下边向上卷" },
      { icon: "🔁", text: "两边向中折" },
      { icon: "🔺", text: "顶尖向下压" },
      { icon: "🎩", text: "撑开成帽子" },
    ],
  },
  {
    name: "小鱼",
    emoji: "🐟",
    steps: [
      { icon: "📄", text: "方形纸" },
      { icon: "📐", text: "对角折成三角" },
      { icon: "➡️", text: "尖角向右折" },
      { icon: "◀", text: "尾巴向后折" },
      { icon: "👁️", text: "画上眼睛" },
      { icon: "🐟", text: "整理成小鱼" },
    ],
  },
];

export class Origami2Game extends BaseGame {
  constructor() {
    super("origami-2");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private nextStep = 0;
  private steps: FoldStep[] = [];
  private locked = false;
  private workName = "";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.nextStep = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const work = sample(ORIGAMI);
    this.workName = work.name;
    this.steps = work.steps;

    const wrap = document.createElement("div");
    wrap.className = "org2-wrap";

    const task = document.createElement("div");
    task.className = "org2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 折一只<b>${work.name}</b>${work.emoji}，把 6 步按顺序排好`;
    wrap.appendChild(task);

    const done = document.createElement("div");
    done.className = "org2-done";
    const doneLabel = document.createElement("div");
    doneLabel.className = "org2-label";
    doneLabel.textContent = "折到这一步啦";
    done.appendChild(doneLabel);
    const doneRow = document.createElement("div");
    doneRow.className = "org2-done-row";
    doneRow.id = "org2-done-row";
    done.appendChild(doneRow);
    wrap.appendChild(done);

    const hint = document.createElement("div");
    hint.className = "org2-hint";
    hint.id = "org2-hint";
    hint.innerHTML = `现在该<b>第 1 步</b>，点对的卡片 👇`;
    wrap.appendChild(hint);

    const pile = document.createElement("div");
    pile.className = "org2-pile";
    const shuffled = shuffle(this.steps);
    shuffled.forEach((s) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "org2-card";
      card.innerHTML = `<div class="org2-card__icon">${s.icon}</div><div class="org2-card__text">${s.text}</div>`;
      card.addEventListener("click", () => this.pick(s, card));
      pile.appendChild(card);
    });
    wrap.appendChild(pile);
    this.root.appendChild(wrap);
    this.updateHint();
  }

  private updateHint(): void {
    const hint = this.root.querySelector("#org2-hint");
    if (hint) {
      hint.innerHTML =
        this.nextStep < this.steps.length
          ? `现在该<b>第 ${this.nextStep + 1} 步</b>，点对的卡片 👇`
          : `折好啦！🎉`;
    }
  }

  private pick(s: FoldStep, card: HTMLButtonElement): void {
    if (this.locked) return;
    const expect = this.steps[this.nextStep]!;
    if (s === expect) {
      card.disabled = true;
      card.classList.add("org2-card--used");
      const chip = document.createElement("div");
      chip.className = "org2-chip";
      chip.innerHTML = `<div class="org2-chip__n">${this.nextStep + 1}</div><div class="org2-chip__icon">${s.icon}</div>`;
      const doneRow = this.root.querySelector("#org2-done-row");
      if (doneRow) doneRow.appendChild(chip);
      sfxPop();
      const r = card.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.nextStep += 1;
      this.updateHint();
      if (this.nextStep >= this.steps.length) {
        this.locked = true;
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1200);
      }
    } else {
      card.classList.add("org2-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => card.classList.remove("org2-card--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "📄",
      variant: "rest",
      body: `折${this.workName}要从第一步开始，仔细想想接下来该做什么～`,
      primary: { text: "继续", icon: "✋", onClick: () => ov.destroy() },
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
    if (document.getElementById("org2-style")) return;
    const st = document.createElement("style");
    st.id = "org2-style";
    st.textContent = ORG2_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function ORG2_CSS(theme: string): string {
  return `
.org2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(560px,100%);}
.org2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.org2-task b{color:${theme};}
.org2-done{width:100%;max-width:520px;background:linear-gradient(180deg,#f0fffb,#dcfff2);border-radius:18px;box-shadow:var(--shadow);padding:10px 12px;box-sizing:border-box;}
.org2-label{font-size:.85rem;font-weight:900;color:#3a8a7a;text-align:center;margin-bottom:6px;}
.org2-done-row{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;min-height:48px;}
.org2-chip{display:flex;flex-direction:column;align-items:center;gap:1px;background:#fff;border-radius:10px;padding:3px 7px;box-shadow:0 2px 5px rgba(0,0,0,.12);animation:org2-in .3s ease;}
.org2-chip__n{font-size:.7rem;font-weight:900;color:${theme};}
.org2-chip__icon{font-size:1.4rem;}
@keyframes org2-in{0%{transform:scale(.5)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
.org2-hint{font-size:.95rem;font-weight:800;color:${theme};text-align:center;}
.org2-hint b{font-size:1.15rem;}
.org2-pile{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px;background:rgba(255,255,255,.7);border-radius:20px;box-shadow:var(--shadow);max-width:520px;}
.org2-card{min-height:90px;border-radius:14px;background:#fff;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px;cursor:pointer;transition:transform .12s;position:relative;}
.org2-card:active{transform:scale(.95);}
.org2-card__icon{font-size:1.8rem;}
.org2-card__text{font-size:.78rem;font-weight:800;color:#444;text-align:center;line-height:1.2;}
.org2-card--used{opacity:.3;pointer-events:none;}
.org2-card--used::after{content:'✓';position:absolute;top:4px;right:6px;color:#6bcf7f;font-weight:900;}
.org2-card--wrong{animation:org2-shake .4s ease;}
@keyframes org2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.org2-pile{grid-template-columns:repeat(2,1fr);}.org2-card{min-height:84px;}}
`;
}

export function create(): Origami2Game {
  return new Origami2Game();
}
