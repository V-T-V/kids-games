/* 火山喷发 Volcano Sort —— 把火山活动的几个阶段按正确顺序排好。
   阶段：休眠 → 冒烟 → 喷发 → 岩浆流 → 熄灭。
   玩法：屏幕上是打乱顺序的阶段卡片，孩子按"从安静到结束"的顺序一张张点；
         点对的会飞到底部排好，点错会抖一下。通关 = 排对目标轮数。
   解保证：阶段集合确定、顺序确定，孩子只要逐张点对即可。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Stage {
  /** 顺序号 0..n-1。 */
  order: number;
  emoji: string;
  name: string;
  desc: string;
  color: string;
}

const ALL_STAGES: Stage[] = [
  { order: 0, emoji: "😴", name: "休眠", desc: "火山在睡觉", color: "#8d9ca8" },
  { order: 1, emoji: "💨", name: "冒烟", desc: "开始冒烟啦", color: "#b0bec5" },
  {
    order: 2,
    emoji: "🌋",
    name: "喷发",
    desc: "轰！喷出来啦",
    color: "#ff6348",
  },
  {
    order: 3,
    emoji: "🔥",
    name: "岩浆流",
    desc: "岩浆流下来",
    color: "#ff9f43",
  },
  { order: 4, emoji: "🌑", name: "熄灭", desc: "慢慢凉下来", color: "#6b5d7a" },
];

function stageCount(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 3 : diff === "medium" ? 4 : 5;
}
function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 2 : diff === "medium" ? 3 : 3;
}

export class VolcanoSortGame extends BaseGame {
  constructor() {
    super("volcano-sort");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private stages: Stage[] = [];
  private nextOrder = 0;

  protected mount(): void {
    this.roundTotal = roundTotal(this.difficulty);
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = stageCount(this.difficulty);
    // 取前 n 个阶段（顺序天然正确），然后打乱展示
    this.stages = shuffle(ALL_STAGES.slice(0, n));
    this.nextOrder = 0;

    const wrap = document.createElement("div");
    wrap.className = "vs-wrap";

    const task = document.createElement("div");
    task.className = "vs-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 按"<b>从安静到结束</b>"的顺序点火山 🌋`;
    wrap.appendChild(task);

    // 已排好的（下方时间线）
    const timeline = document.createElement("div");
    timeline.className = "vs-timeline";
    timeline.id = "vs-timeline";
    wrap.appendChild(timeline);

    // 待排序卡片
    const deck = document.createElement("div");
    deck.className = "vs-deck";
    deck.id = "vs-deck";
    this.stages.forEach((s) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "vs-card";
      card.dataset.order = String(s.order);
      card.style.setProperty("--vs-color", s.color);
      card.innerHTML = `
        <div class="vs-card-emoji">${s.emoji}</div>
        <div class="vs-card-name">${s.name}</div>
        <div class="vs-card-desc">${s.desc}</div>
      `;
      card.addEventListener("click", () => this.pick(s, card));
      deck.appendChild(card);
    });
    wrap.appendChild(deck);

    this.root.appendChild(wrap);
  }

  private pick(stage: Stage, card: HTMLButtonElement): void {
    if (card.classList.contains("vs-card--done")) return;
    if (stage.order === this.nextOrder) {
      // 正确：飞入时间线
      card.classList.add("vs-card--done");
      card.disabled = true;
      this.nextOrder += 1;
      sfxPop();
      const tl = this.root.querySelector("#vs-timeline");
      const slot = document.createElement("div");
      slot.className = "vs-tl-item";
      slot.style.setProperty("--vs-color", stage.color);
      slot.innerHTML = `<div class="vs-tl-emoji">${stage.emoji}</div><div class="vs-tl-name">${stage.name}</div>`;
      tl?.appendChild(slot);
      const r = card.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      if (this.nextOrder >= this.stages.length) {
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 800);
      }
    } else {
      // 错误：抖动
      card.classList.remove("vs-shake");
      void card.offsetWidth;
      card.classList.add("vs-shake");
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想火山最开始是怎样的？先睡觉，再冒烟……",
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
    if (document.getElementById("vs-style")) return;
    const st = document.createElement("style");
    st.id = "vs-style";
    st.textContent = VS_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function VS_CSS(theme: string): string {
  return `
.vs-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.vs-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.vs-timeline{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;min-height:74px;padding:8px 10px;background:rgba(255,255,255,.55);border-radius:16px;box-shadow:var(--shadow);width:min(420px,94%);border:2px dashed ${theme}55;}
.vs-tl-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 8px;border-radius:10px;background:linear-gradient(160deg,var(--vs-color),rgba(0,0,0,.15));box-shadow:var(--shadow);animation:vs-drop .3s ease;}
@keyframes vs-drop{from{transform:translateY(-14px);opacity:0}to{transform:translateY(0);opacity:1}}
.vs-tl-emoji{font-size:1.8rem;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.2));}
.vs-tl-name{font-size:.7rem;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);}
.vs-deck{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding:14px;background:rgba(255,255,255,.6);border-radius:20px;box-shadow:var(--shadow);width:min(420px,94%);}
.vs-card{width:120px;border:none;border-radius:14px;background:linear-gradient(160deg,var(--vs-color),rgba(0,0,0,.18));box-shadow:inset 0 2px 0 rgba(255,255,255,.3),0 4px 8px rgba(0,0,0,.18);cursor:pointer;padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;font-family:inherit;color:#fff;transition:transform .12s;}
.vs-card:hover{transform:translateY(-4px);}
.vs-card:active{transform:scale(.95);}
.vs-card-emoji{font-size:2.6rem;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));}
.vs-card-name{font-size:1rem;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,.4);}
.vs-card-desc{font-size:.7rem;opacity:.9;}
.vs-card--done{opacity:0;transform:scale(0);pointer-events:none;}
.vs-shake{animation:vs-shake .4s ease;}
@keyframes vs-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
@media (max-width:380px){.vs-card{width:100px;}.vs-card-emoji{font-size:2.1rem;}}
`;
}

export function create(): VolcanoSortGame {
  return new VolcanoSortGame();
}
