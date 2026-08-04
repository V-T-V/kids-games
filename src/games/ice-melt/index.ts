/* 冰块融化 Ice Melt —— 把冰块融化的 4 个阶段（大冰块→小冰块→水洼→水蒸气消散）
   打乱后，按融化先后顺序依次点击。独特点：物态变化认知 + 顺序排列。
   巧思：点对填入序列位；点错清空序列重来，保证有解。难度 = 阶段数。
   通关 = 排对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Stage {
  emoji: string;
  name: string;
  order: number;
}

/** 完整融化序列（已按正确顺序）。 */
const SEQUENCE: Stage[] = [
  { emoji: "🧊", name: "大冰块", order: 0 },
  { emoji: "🧊", name: "小冰块", order: 1 },
  { emoji: "💧", name: "水洼", order: 2 },
  { emoji: "💨", name: "水蒸气", order: 3 },
];

export class IceMeltGame extends BaseGame {
  constructor() {
    super("ice-melt");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private cursor = 0;
  private cards: Stage[] = [];
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root 清空，无定时器/RAF */
  }

  private stageCount(): number {
    return 4; // 固定 4 阶段；难度体现在轮数与干扰提示
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.cursor = 0;
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.stageCount();
    const subset = SEQUENCE.slice(0, n).map((s, i) => ({ ...s, order: i }));
    this.cards = shuffle(subset);

    const wrap = document.createElement("div");
    wrap.className = "im-wrap";

    const task = document.createElement("div");
    task.className = "im-task";
    task.innerHTML = `太阳晒冰块，按融化的顺序点！从 <b>第 1 步</b> 开始 · 第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关`;
    wrap.appendChild(task);

    // 太阳提示
    const sun = document.createElement("div");
    sun.className = "im-sun";
    sun.textContent = "☀️";
    sun.setAttribute("aria-hidden", "true");
    wrap.appendChild(sun);

    // 序号槽
    const slots = document.createElement("div");
    slots.className = "im-slots";
    for (let i = 0; i < n; i++) {
      const slot = document.createElement("div");
      slot.className = "im-slot";
      slot.dataset.idx = String(i);
      slot.innerHTML = `<span class="im-slot-idx">${i + 1}</span><span class="im-slot-emoji"></span>`;
      slots.appendChild(slot);
    }
    wrap.appendChild(slots);

    // 卡片堆（乱序）
    const grid = document.createElement("div");
    grid.className = "im-grid";
    this.cards.forEach((stage, idx) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "im-card";
      card.dataset.order = String(stage.order);
      // 第二张（小冰块）用缩小样式区分于第一张大冰块
      if (stage.emoji === "🧊" && stage.order === 1) {
        card.classList.add("im-card--small");
      }
      card.innerHTML = `<div class="im-card-emoji">${stage.emoji}</div><div class="im-card-name">${stage.name}</div>`;
      card.addEventListener("click", () => this.pick(stage, idx, card));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    this.root.appendChild(wrap);
  }

  private pick(stage: Stage, idx: number, card: HTMLButtonElement): void {
    if (this.locked || card.classList.contains("im-card--done")) return;

    if (stage.order === this.cursor) {
      const slot = this.root.querySelector<HTMLElement>(
        `.im-slot[data-idx="${this.cursor}"]`,
      );
      if (slot) {
        slot.classList.add("im-slot--filled");
        const emo = slot.querySelector(".im-slot-emoji");
        if (emo) {
          emo.textContent = stage.emoji;
          if (stage.emoji === "🧊" && stage.order === 1) {
            emo.classList.add("im-slot-emoji--small");
          }
        }
      }
      card.classList.add("im-card--done");
      card.disabled = true;
      sfxPop();
      this.resetWrongStreak();
      const r = card.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.cursor += 1;

      if (this.cursor >= this.cards.length) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 800);
      }
    } else {
      this.locked = true;
      card.classList.add("im-card--shake");
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
        return;
      }
      this.trackTimeout(() => {
        card.classList.remove("im-card--shake");
        this.resetSequence();
        this.locked = false;
      }, 600);
    }
    void idx;
  }

  private resetSequence(): void {
    this.cursor = 0;
    this.root.querySelectorAll<HTMLElement>(".im-slot").forEach((s) => {
      s.classList.remove("im-slot--filled");
      const emo = s.querySelector(".im-slot-emoji");
      if (emo) {
        emo.textContent = "";
        emo.classList.remove("im-slot-emoji--small");
      }
    });
    this.root
      .querySelectorAll<HTMLButtonElement>(".im-card--done")
      .forEach((c) => {
        c.classList.remove("im-card--done");
        c.disabled = false;
      });
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "冰块晒了太阳，会先变小，再变成水，最后变成水蒸气～",
      primary: {
        text: "继续",
        icon: "🧊",
        onClick: () => {
          ov.destroy();
          this.locked = false;
          this.resetSequence();
        },
      },
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
    if (document.getElementById("im-style")) return;
    const st = document.createElement("style");
    st.id = "im-style";
    st.textContent = IM_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function IM_CSS(theme: string): string {
  return `
.im-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.im-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.im-sun{font-size:2.6rem;animation:im-spin 14s linear infinite;filter:drop-shadow(0 0 14px rgba(255,200,0,.6));}
@keyframes im-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.im-slots{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:10px 14px;background:rgba(255,255,255,.5);border-radius:16px;box-shadow:var(--shadow);}
.im-slot{position:relative;width:58px;height:58px;border-radius:14px;background:#fff;border:2px dashed ${theme}66;display:flex;align-items:center;justify-content:center;font-size:2rem;}
.im-slot-idx{position:absolute;top:-8px;left:-8px;width:22px;height:22px;border-radius:50%;background:${theme};color:#fff;font-size:.8rem;font-weight:800;display:flex;align-items:center;justify-content:center;}
.im-slot-emoji{line-height:1;}
.im-slot-emoji--small{transform:scale(.7);}
.im-slot--filled{background:linear-gradient(180deg,#fff,color-mix(in srgb,${theme} 30%,#fff));border-style:solid;animation:im-pop .35s ease;}
@keyframes im-pop{0%{transform:scale(.5)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
.im-grid{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:18px;background:rgba(255,255,255,.55);border-radius:20px;box-shadow:var(--shadow);max-width:440px;}
.im-card{width:96px;border:none;background:linear-gradient(180deg,#fff,#eef9ff);border-radius:18px;padding:10px 6px 8px;box-shadow:var(--shadow),inset 0 -4px 0 rgba(0,0,0,.06);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;transition:transform .12s;}
.im-card:active{transform:translateY(2px) scale(.96);}
.im-card-emoji{font-size:2.8rem;line-height:1;filter:drop-shadow(0 3px 3px rgba(0,0,0,.15));}
.im-card--small .im-card-emoji{transform:scale(.7);}
.im-card-name{font-size:.85rem;font-weight:800;color:#555;}
.im-card--done{opacity:0;transform:scale(.4);pointer-events:none;}
.im-card--shake{animation:im-shake .5s ease;}
@keyframes im-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px) rotate(-3deg)}60%{transform:translateX(6px) rotate(3deg)}}
@media (max-width:380px){.im-slot{width:50px;height:50px;font-size:1.7rem;}.im-card{width:80px;}.im-card-emoji{font-size:2.3rem;}}
`;
}

export function create(): IceMeltGame {
  return new IceMeltGame();
}
