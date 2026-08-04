/* 种子生长 Seed Sprout —— 把植物生长的 5 个阶段（种子→发芽→长叶→花苞→开花）
   打乱后，按生长先后顺序依次点击。独特点：生命周期认知 + 顺序记忆。
   巧思：点对一个填入序列位、点亮；点错则清空重排，让孩子重新尝试，保证有解。
   难度 = 阶段数（4/5）。通关 = 排对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Stage {
  emoji: string;
  name: string;
  /** 正确序号（从 0 起） */
  order: number;
}

/** 完整生长序列（已按正确顺序）。 */
const SEQUENCE: Stage[] = [
  { emoji: "🌰", name: "种子", order: 0 },
  { emoji: "🌱", name: "发芽", order: 1 },
  { emoji: "🌿", name: "长叶", order: 2 },
  { emoji: "🌸", name: "花苞", order: 3 },
  { emoji: "🌷", name: "开花", order: 4 },
];

export class SeedSproutGame extends BaseGame {
  constructor() {
    super("seed-sprout");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 当前已点对的序号指针（下一个应点的 order） */
  private cursor = 0;
  /** 本关打乱后的阶段卡片 */
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
    // easy/medium 用前 4 阶段，hard 用全 5 阶段
    return this.difficulty === "hard" ? 5 : 4;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.cursor = 0;
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.stageCount();
    // 取前 n 阶段，重排 order 为 0..n-1（保证连续有解）
    const subset = SEQUENCE.slice(0, n).map((s, i) => ({ ...s, order: i }));
    this.cards = shuffle(subset);

    const wrap = document.createElement("div");
    wrap.className = "ss2-wrap";

    const task = document.createElement("div");
    task.className = "ss2-task";
    task.innerHTML = `按小植物长大的顺序，从 <b>第 1 步</b> 开始点！第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关`;
    wrap.appendChild(task);

    // 序号槽（显示已点对的进度）
    const slots = document.createElement("div");
    slots.className = "ss2-slots";
    slots.id = "ss2-slots";
    for (let i = 0; i < n; i++) {
      const slot = document.createElement("div");
      slot.className = "ss2-slot";
      slot.dataset.idx = String(i);
      slot.innerHTML = `<span class="ss2-slot-idx">${i + 1}</span><span class="ss2-slot-emoji"></span>`;
      slots.appendChild(slot);
    }
    wrap.appendChild(slots);

    // 卡片堆（乱序）
    const grid = document.createElement("div");
    grid.className = "ss2-grid";
    this.cards.forEach((stage) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "ss2-card";
      card.dataset.order = String(stage.order);
      card.innerHTML = `<div class="ss2-card-emoji">${stage.emoji}</div><div class="ss2-card-name">${stage.name}</div>`;
      card.addEventListener("click", () => this.pick(stage, card));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    this.root.appendChild(wrap);
  }

  private pick(stage: Stage, card: HTMLButtonElement): void {
    if (this.locked || card.classList.contains("ss2-card--done")) return;

    if (stage.order === this.cursor) {
      // 正确：点亮槽位 + 卡片消失
      const slot = this.root.querySelector<HTMLElement>(
        `.ss2-slot[data-idx="${this.cursor}"]`,
      );
      if (slot) {
        slot.classList.add("ss2-slot--filled");
        const emo = slot.querySelector(".ss2-slot-emoji");
        if (emo) emo.textContent = stage.emoji;
      }
      card.classList.add("ss2-card--done");
      card.disabled = true;
      sfxPop();
      this.resetWrongStreak();
      const r = card.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.cursor += 1;

      if (this.cursor >= this.cards.length) {
        // 本关完成
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 750);
      }
    } else {
      // 错：抖动卡片 + 清空序列重来
      this.locked = true;
      card.classList.add("ss2-card--shake");
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
        return;
      }
      this.trackTimeout(() => {
        card.classList.remove("ss2-card--shake");
        this.resetSequence();
        this.locked = false;
      }, 600);
    }
  }

  /** 清空已点对的槽位，让孩子重新按顺序点。 */
  private resetSequence(): void {
    this.cursor = 0;
    this.root.querySelectorAll<HTMLElement>(".ss2-slot").forEach((s) => {
      s.classList.remove("ss2-slot--filled");
      const emo = s.querySelector(".ss2-slot-emoji");
      if (emo) emo.textContent = "";
    });
    this.root
      .querySelectorAll<HTMLButtonElement>(".ss2-card--done")
      .forEach((c) => {
        c.classList.remove("ss2-card--done");
        c.disabled = false;
      });
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想小种子是先发芽，还是先开花呢～",
      primary: {
        text: "继续",
        icon: "🌱",
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
    if (document.getElementById("ss2-style")) return;
    const st = document.createElement("style");
    st.id = "ss2-style";
    st.textContent = SS2_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SS2_CSS(theme: string): string {
  return `
.ss2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.ss2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.ss2-slots{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:10px 14px;background:rgba(255,255,255,.5);border-radius:16px;box-shadow:var(--shadow);}
.ss2-slot{position:relative;width:58px;height:58px;border-radius:14px;background:#fff;border:2px dashed ${theme}55;display:flex;align-items:center;justify-content:center;font-size:2rem;}
.ss2-slot-idx{position:absolute;top:-8px;left:-8px;width:22px;height:22px;border-radius:50%;background:${theme};color:#fff;font-size:.8rem;font-weight:800;display:flex;align-items:center;justify-content:center;}
.ss2-slot-emoji{line-height:1;}
.ss2-slot--filled{background:linear-gradient(180deg,#fff,color-mix(in srgb,${theme} 30%,#fff));border-style:solid;animation:ss2-pop .35s ease;}
@keyframes ss2-pop{0%{transform:scale(.5)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
.ss2-grid{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:18px;background:rgba(255,255,255,.55);border-radius:20px;box-shadow:var(--shadow);max-width:440px;}
.ss2-card{width:96px;border:none;background:linear-gradient(180deg,#fff,#f3f7ff);border-radius:18px;padding:10px 6px 8px;box-shadow:var(--shadow),inset 0 -4px 0 rgba(0,0,0,.06);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;transition:transform .12s;}
.ss2-card:active{transform:translateY(2px) scale(.96);}
.ss2-card-emoji{font-size:2.8rem;line-height:1;filter:drop-shadow(0 3px 3px rgba(0,0,0,.15));}
.ss2-card-name{font-size:.85rem;font-weight:800;color:#555;}
.ss2-card--done{opacity:0;transform:scale(.4);pointer-events:none;}
.ss2-card--shake{animation:ss2-shake .5s ease;}
@keyframes ss2-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px) rotate(-3deg)}60%{transform:translateX(6px) rotate(3deg)}}
@media (max-width:380px){.ss2-slot{width:50px;height:50px;font-size:1.7rem;}.ss2-card{width:80px;}.ss2-card-emoji{font-size:2.3rem;}}
`;
}

export function create(): SeedSproutGame {
  return new SeedSproutGame();
}
