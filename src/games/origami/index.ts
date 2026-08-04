/* 折纸 Origami —— 折一个作品分几步（如折纸船：对折→再折→展开→成型），
   步骤卡片被打乱了，孩子按正确顺序把它们排好。
   独特点：顺序记忆/因果推理，上方"折到第几步"会实时展示已排好的步骤。
   视觉：步骤卡片（图+文字）。难度=步骤数。通关=排对目标轮数。
   玩法：提示"现在该第 N 步"，从乱序卡片里点对的那张。前缀 og-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface FoldStep {
  /** emoji 图 */
  icon: string;
  /** 一句话动作 */
  text: string;
}

/** 折纸作品库：每个作品有完整步骤序列（已按正确顺序）。 */
const ORIGAMI: { name: string; emoji: string; steps: FoldStep[] }[] = [
  {
    name: "纸船",
    emoji: "⛵",
    steps: [
      { icon: "📄", text: "拿一张方纸" },
      { icon: "📐", text: "对折成三角" },
      { icon: "🔺", text: "两角向上折" },
      { icon: "🔓", text: "撑开中间" },
      { icon: "⛵", text: "拉成小船" },
    ],
  },
  {
    name: "纸飞机",
    emoji: "✈️",
    steps: [
      { icon: "📄", text: "拿一张长纸" },
      { icon: "▾", text: "上方对折" },
      { icon: "◢◣", text: "折两边翅膀" },
      { icon: "✈️", text: "整理机身" },
    ],
  },
  {
    name: "小青蛙",
    emoji: "🐸",
    steps: [
      { icon: "📄", text: "方形纸" },
      { icon: "✦", text: "折出对角线" },
      { icon: "🔺", text: "折出四个腿" },
      { icon: "🐸", text: "压平成青蛙" },
    ],
  },
  {
    name: "纸杯",
    emoji: "🥤",
    steps: [
      { icon: "📄", text: "方形纸" },
      { icon: "📐", text: "对角折" },
      { icon: "↩️", text: "一角翻折" },
      { icon: "↪️", text: "另一角翻折" },
      { icon: "🥤", text: "撑开成杯" },
    ],
  },
];

export class OrigamiGame extends BaseGame {
  constructor() {
    super("origami");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private nextStep = 0;
  private steps: FoldStep[] = [];
  private locked = false;
  private workName = "";

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
    this.nextStep = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 选一个作品，按难度决定步骤数（取前 k 步，保证最后是成品）
    const work = sample(ORIGAMI);
    this.workName = work.name;
    const k =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    // 步骤数不能超过作品本身；不足则用全部
    const total = Math.min(k, work.steps.length);
    this.steps = work.steps.slice(0, total);

    const wrap = document.createElement("div");
    wrap.className = "og-wrap";

    const task = document.createElement("div");
    task.className = "og-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 折一只<b>${work.name}</b>${work.emoji}，把步骤按顺序排好`;
    wrap.appendChild(task);

    // 已折好的进度行（按顺序展示已确认的步骤）
    const done = document.createElement("div");
    done.className = "og-done";
    done.id = "og-done";
    const doneLabel = document.createElement("div");
    doneLabel.className = "og-label";
    doneLabel.textContent = "折到这一步啦";
    done.appendChild(doneLabel);
    const doneRow = document.createElement("div");
    doneRow.className = "og-done-row";
    doneRow.id = "og-done-row";
    done.appendChild(doneRow);
    wrap.appendChild(done);

    // 提示"现在该第几步"
    const hint = document.createElement("div");
    hint.className = "og-hint";
    hint.id = "og-hint";
    hint.innerHTML = `现在该<b>第 1 步</b>，点对的卡片 👇`;
    wrap.appendChild(hint);

    // 乱序步骤卡片
    const pile = document.createElement("div");
    pile.className = "og-pile";
    const shuffled = shuffle(this.steps);
    shuffled.forEach((s) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "og-card";
      card.innerHTML = `<div class="og-card__icon">${s.icon}</div><div class="og-card__text">${s.text}</div>`;
      card.addEventListener("click", () => this.pick(s, card));
      pile.appendChild(card);
    });
    wrap.appendChild(pile);

    this.root.appendChild(wrap);
    this.updateHint();
  }

  private updateHint(): void {
    const hint = this.root.querySelector("#og-hint");
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
      // 正确：把这张卡片移到"已折好"行
      card.disabled = true;
      card.classList.add("og-card--used");
      const chip = document.createElement("div");
      chip.className = "og-chip";
      chip.innerHTML = `<div class="og-chip__n">${this.nextStep + 1}</div><div class="og-chip__icon">${s.icon}</div>`;
      const doneRow = this.root.querySelector("#og-done-row");
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
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1200);
      }
    } else {
      card.classList.add("og-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => card.classList.remove("og-card--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
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
    if (document.getElementById("og-style")) return;
    const st = document.createElement("style");
    st.id = "og-style";
    st.textContent = OG_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function OG_CSS(theme: string): string {
  return `
.og-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.og-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.og-task b{color:${theme};}
.og-done{width:100%;max-width:520px;background:linear-gradient(180deg,#f6fff0,#e3ffe9);border-radius:20px;box-shadow:var(--shadow);padding:12px 14px;box-sizing:border-box;}
.og-label{font-size:.9rem;font-weight:900;color:#5a8a5a;text-align:center;margin-bottom:8px;}
.og-done-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;min-height:54px;}
.og-chip{display:flex;flex-direction:column;align-items:center;gap:2px;background:#fff;border-radius:12px;padding:4px 8px;box-shadow:0 2px 5px rgba(0,0,0,.12);animation:og-in .35s ease;}
.og-chip__n{font-size:.75rem;font-weight:900;color:${theme};}
.og-chip__icon{font-size:1.6rem;}
@keyframes og-in{0%{transform:scale(.6) translateY(-6px)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
.og-hint{font-size:1rem;font-weight:800;color:${theme};text-align:center;}
.og-hint b{font-size:1.2rem;}
.og-pile{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:16px;background:rgba(255,255,255,.7);border-radius:22px;box-shadow:var(--shadow);max-width:540px;}
.og-card{width:108px;min-height:104px;border-radius:16px;background:#fff;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px;cursor:pointer;transition:transform .12s;position:relative;}
.og-card:active{transform:scale(.95);}
.og-card__icon{font-size:2.2rem;}
.og-card__text{font-size:.85rem;font-weight:800;color:#444;text-align:center;line-height:1.2;}
.og-card--used{opacity:.3;pointer-events:none;}
.og-card--used::after{content:'✓';position:absolute;top:6px;right:8px;color:#6bcf7f;font-weight:900;}
.og-card--wrong{animation:og-shake .4s ease;}
@keyframes og-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.og-card{width:92px;min-height:92px;}.og-card__icon{font-size:1.9rem;}}
`;
}

export function create(): OrigamiGame {
  return new OrigamiGame();
}
