/* 时间线排序 TimeTimeline —— 把日常活动按一天中的时间先后排到时间线上。
   巧思：点一张卡片选中（高亮），再点时间线空槽放入；点已放卡片可撤回。
   难度 = 卡片数（easy 3 / medium 4 / hard 5）。通关 = 排对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxTick } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Activity {
  emoji: string;
  name: string;
  /** 24 小时制小时数，决定先后 */
  hour: number;
}

const POOL: Activity[] = [
  { emoji: "🌅", name: "起床", hour: 7 },
  { emoji: "🥣", name: "吃早饭", hour: 8 },
  { emoji: "🏫", name: "上学", hour: 8 },
  { emoji: "📖", name: "上课", hour: 9 },
  { emoji: "🍎", name: "吃午餐", hour: 12 },
  { emoji: "😴", name: "午睡", hour: 13 },
  { emoji: "⚽", name: "玩耍", hour: 16 },
  { emoji: "🍚", name: "吃晚饭", hour: 18 },
  { emoji: "🛁", name: "洗澡", hour: 19 },
  { emoji: "📺", name: "看电视", hour: 20 },
  { emoji: "🪥", name: "刷牙", hour: 21 },
  { emoji: "🛏️", name: "睡觉", hour: 21 },
];

export class TimeTimelineGame extends BaseGame {
  constructor() {
    super("time-timeline");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private cardCount = 3;
  private selectedIdx = -1; // 当前选中的待放置卡片索引
  private placed: (Activity | null)[] = [];
  private remaining: (Activity | null)[] = [];
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 3 : 4;
    this.cardCount =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.selectedIdx = -1;
    this.root.innerHTML = "";
    // 从池中随机取 cardCount 个不同活动
    this.remaining = shuffle(POOL).slice(0, this.cardCount);
    this.placed = new Array(this.cardCount).fill(null);

    const wrap = document.createElement("div");
    wrap.className = "tl-wrap";

    const task = document.createElement("div");
    task.className = "tl-task";
    task.textContent = `按一天中的先后顺序排一排（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 时间线
    const line = document.createElement("div");
    line.className = "tl-line";
    const arrow = document.createElement("div");
    arrow.className = "tl-arrow";
    arrow.textContent = "早 → 晚";
    line.appendChild(arrow);
    const slots = document.createElement("div");
    slots.className = "tl-slots";
    for (let i = 0; i < this.cardCount; i++) {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "tl-slot";
      slot.dataset.slot = String(i);
      slot.addEventListener("click", () => this.onSlot(i));
      slots.appendChild(slot);
    }
    line.appendChild(slots);
    wrap.appendChild(line);

    // 待选卡片
    const tray = document.createElement("div");
    tray.className = "tl-tray";
    const trayLabel = document.createElement("div");
    trayLabel.className = "tl-tray-label";
    trayLabel.textContent = "点一张卡片，再点上面的空格放进～";
    tray.appendChild(trayLabel);
    const cards = document.createElement("div");
    cards.className = "tl-cards";
    this.remaining.forEach((act, idx) => {
      if (!act) return;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "tl-card";
      card.dataset.idx = String(idx);
      card.innerHTML = `<span class="tl-card__emoji">${act.emoji}</span><span class="tl-card__name">${act.name}</span>`;
      card.addEventListener("click", () => this.onCard(idx));
      cards.appendChild(card);
    });
    tray.appendChild(cards);
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private render(): void {
    // 更新槽位显示
    const slots = this.root.querySelectorAll<HTMLButtonElement>(".tl-slot");
    slots.forEach((slot, i) => {
      const act = this.placed[i];
      if (act) {
        slot.classList.add("tl-slot--filled");
        slot.innerHTML = `<span class="tl-card__emoji">${act.emoji}</span><span class="tl-card__name">${act.name}</span>`;
      } else {
        slot.classList.remove("tl-slot--filled");
        slot.textContent = String(i + 1);
      }
    });
    // 更新待选卡片显示
    const cards = this.root.querySelectorAll<HTMLButtonElement>(".tl-card");
    cards.forEach((card) => {
      const idx = Number(card.dataset.idx);
      const act = this.remaining[idx];
      if (!act) {
        card.classList.add("tl-card--used");
        card.style.visibility = "hidden";
      } else if (idx === this.selectedIdx) {
        card.classList.add("tl-card--sel");
      } else {
        card.classList.remove("tl-card--sel");
      }
    });
  }

  private onCard(idx: number): void {
    if (this.locked) return;
    if (!this.remaining[idx]) return;
    sfxTick();
    this.selectedIdx = this.selectedIdx === idx ? -1 : idx;
    this.render();
  }

  private onSlot(slotIdx: number): void {
    if (this.locked) return;
    const existing = this.placed[slotIdx];
    if (this.selectedIdx >= 0) {
      // 把选中的卡片放进该槽
      const act = this.remaining[this.selectedIdx]!;
      if (existing) {
        // 槽位已有：把原来的退回 remaining 原选中位置
        this.remaining[this.selectedIdx] = existing;
      } else {
        this.remaining[this.selectedIdx] = null;
      }
      this.placed[slotIdx] = act;
      this.selectedIdx = -1;
      sfxPop();
      this.render();
      this.maybeCheck();
    } else if (existing) {
      // 没选中卡片但点了已放卡片：撤回
      const emptyHole = this.remaining.findIndex((r) => r === null);
      if (emptyHole >= 0) {
        this.remaining[emptyHole] = existing;
        this.placed[slotIdx] = null;
        sfxTick();
        this.render();
      }
    }
  }

  private maybeCheck(): void {
    if (this.placed.every((p) => p !== null)) {
      // 全部放好，检查顺序是否按 hour 升序
      const hours = this.placed.map((p) => (p ? p.hour : 0));
      const sorted = [...hours].sort((a, b) => a - b).join(",");
      const ok = hours.join(",") === sorted;
      this.locked = true;
      if (ok) {
        const lastSlot = this.root.querySelector<HTMLButtonElement>(
          ".tl-slot:last-child",
        );
        const r = lastSlot?.getBoundingClientRect();
        this.onCorrect(
          r ? r.left + r.width / 2 : window.innerWidth / 2,
          r ? r.top + r.height / 2 : window.innerHeight / 2,
        );
        this.resetWrongStreak();
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1100);
      } else {
        // 标红错位的卡片
        this.root
          .querySelectorAll<HTMLButtonElement>(".tl-slot")
          .forEach((s) => s.classList.add("tl-slot--wrong"));
        const paused = this.onWrong();
        this.trackTimeout(() => {
          this.root
            .querySelectorAll<HTMLButtonElement>(".tl-slot")
            .forEach((s) => s.classList.remove("tl-slot--wrong"));
          // 清空重来
          this.locked = false;
          this.startRound();
        }, 1200);
        if (paused) this.showRest();
      }
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想一想：早上先做什么，晚上才做什么呢？",
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
    if (document.getElementById("tl-style")) return;
    const st = document.createElement("style");
    st.id = "tl-style";
    st.textContent = TL_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function TL_CSS(theme: string): string {
  return `
.tl-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.tl-task{font-size:1.15rem;font-weight:800;text-align:center;}
.tl-line{width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;}
.tl-arrow{font-size:.95rem;font-weight:700;color:var(--ink-soft);letter-spacing:2px;}
.tl-slots{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;position:relative;padding-top:14px;}
.tl-slots::before{content:"";position:absolute;top:34px;left:6%;right:6%;height:6px;background:linear-gradient(90deg,${theme},#ffd9b3);border-radius:3px;z-index:0;}
.tl-slot{position:relative;z-index:1;width:84px;height:96px;border-radius:16px;background:#fff;color:var(--ink-soft);font-size:1.6rem;font-weight:800;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:var(--shadow);transition:transform .1s ease;border:3px dashed ${theme};}
.tl-slot--filled{border-style:solid;background:#fff7ef;color:var(--ink);}
.tl-slot:active{transform:scale(.95);}
.tl-slot--wrong{animation:tl-shake .4s ease;border-color:#ff6348;}
.tl-tray{width:100%;display:flex;flex-direction:column;align-items:center;gap:10px;}
.tl-tray-label{font-size:.95rem;color:var(--ink-soft);}
.tl-cards{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.tl-card{width:84px;height:96px;border-radius:16px;background:#fff;color:var(--ink);font-size:1rem;font-weight:700;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;box-shadow:var(--shadow);transition:transform .1s ease,box-shadow .15s ease;border:3px solid transparent;}
.tl-card:active{transform:scale(.95);}
.tl-card--sel{border-color:${theme};box-shadow:0 0 0 4px rgba(255,159,67,.25),var(--shadow);transform:translateY(-4px);}
.tl-card--used{opacity:.4;}
.tl-card__emoji{font-size:1.9rem;}
.tl-card__name{font-size:.85rem;}
@keyframes tl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): TimeTimelineGame {
  return new TimeTimelineGame();
}
