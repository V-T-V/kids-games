/* 找一找 Seek & Find —— 在场景里找到指定的物品，找到后物品跳舞。
   巧思：场景是散布的可爱 emoji，目标物品藏在干扰物中；
   找全所有目标通关；难度递增（目标数 + 干扰密度）。 */

import { BaseGame } from "../../core/engine.ts";
import { burst } from "../../core/particles.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle, randInt } from "../../lobby/util.ts";

/** 场景物品池（干扰物）。 */
const POOL = [
  "🌳",
  "🌸",
  "🦋",
  "🐝",
  "🐞",
  "🍄",
  "🌈",
  "☁️",
  "⭐",
  "🍀",
  "🌷",
  "🌻",
  "🐰",
  "🐦",
  "🐱",
  "🐶",
  "🍎",
  "🍓",
  "🍇",
  "🥕",
] as const;

/** 目标物品池（要找的，颜色/形状辨识度高的）。 */
const TARGETS = ["🦋", "🐝", "🐞", "🍄", "⭐", "🍀", "🌷", "🍓"] as const;

interface PlacedItem {
  emoji: string;
  el: HTMLButtonElement;
  isTarget: boolean;
  found: boolean;
  x: number; // 百分比
  y: number;
}

export class SeekFindGame extends BaseGame {
  constructor() {
    super("seek-find");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private targetList: string[] = [];
  private foundCount = 0;
  private sceneEl!: HTMLDivElement;
  private checklistEl!: HTMLDivElement;

  protected mount(): void {
    this.roundTotal = this.roundsPerClear();
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private roundsPerClear(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private targetsPerRound(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private decoyCount(): number {
    return this.difficulty === "easy"
      ? 18
      : this.difficulty === "medium"
        ? 28
        : 40;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const targetN = this.targetsPerRound();
    this.targetList = shuffle([...TARGETS]).slice(0, targetN);
    this.foundCount = 0;

    // 每个目标放 1 个，外加干扰物
    const items: { emoji: string; isTarget: boolean }[] = [];
    this.targetList.forEach((t) => items.push({ emoji: t, isTarget: true }));
    for (let i = 0; i < this.decoyCount(); i++) {
      items.push({ emoji: sample(POOL), isTarget: false });
    }
    // 干扰物中也可能混入目标 emoji 的额外副本（增加难度），但对 easy 不加
    if (this.difficulty === "hard") {
      this.targetList.forEach((t) => items.push({ emoji: t, isTarget: false }));
    }
    const placed = shuffle(items);

    const wrap = document.createElement("div");
    wrap.className = "sf-wrap";

    /* —— 找物清单 —— */
    this.checklistEl = document.createElement("div");
    this.checklistEl.className = "sf-checklist";
    this.renderChecklist();
    wrap.appendChild(this.checklistEl);

    /* —— 场景 —— */
    this.sceneEl = document.createElement("div");
    this.sceneEl.className = "sf-scene";
    placed.forEach((it) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sf-item";
      btn.textContent = it.emoji;
      // 随机散布位置（百分比，留边距）
      btn.style.left = `${randInt(4, 90)}%`;
      btn.style.top = `${randInt(6, 88)}%`;
      btn.style.fontSize = `${randInt(20, 30)}px`;
      btn.style.transform = `rotate(${randInt(-15, 15)}deg)`;
      this.sceneEl.appendChild(btn);
      const item: PlacedItem = {
        emoji: it.emoji,
        el: btn,
        isTarget: it.isTarget,
        found: false,
        x: 0,
        y: 0,
      };
      btn.addEventListener("click", () => this.onClick(item));
    });
    wrap.appendChild(this.sceneEl);

    this.root.appendChild(wrap);
  }

  private onClick(item: PlacedItem): void {
    if (item.isTarget && !item.found) {
      // 找对
      item.found = true;
      item.el.classList.add("sf-item--found");
      const r = item.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      burst(r.left + r.width / 2, r.top + r.height / 2, 10);
      this.foundCount += 1;
      this.resetWrongStreak();
      this.renderChecklist();
      if (this.foundCount >= this.targetList.length) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1100);
      }
    } else if (!item.isTarget) {
      // 点了干扰物，温柔提示
      item.el.classList.add("sf-item--shake");
      this.trackTimeout(() => item.el.classList.remove("sf-item--shake"), 400);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private renderChecklist(): void {
    this.checklistEl.innerHTML = `<span class="sf-checklist__title">找一找：</span>`;
    this.targetList.forEach((t) => {
      const tag = document.createElement("span");
      const found =
        this.targetList.indexOf(t) < this.foundCount || this.isFound(t);
      tag.className = `sf-tag ${found ? "sf-tag--done" : ""}`;
      tag.textContent = found ? `✅` : t;
      this.checklistEl.appendChild(tag);
    });
  }

  private isFound(emoji: string): boolean {
    return this.targetList.indexOf(emoji) < this.foundCount;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "仔细看看，它们藏起来啦～",
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
    if (document.getElementById("sf-style")) return;
    const st = document.createElement("style");
    st.id = "sf-style";
    st.textContent = SF_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function SF_CSS(theme: string): string {
  return `
.sf-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(560px,100%);}
.sf-checklist{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;padding:8px 14px;background:#fff;border-radius:999px;box-shadow:var(--shadow);}
.sf-checklist__title{font-weight:800;font-size:1rem;}
.sf-tag{font-size:1.6rem;transition:transform .2s;}
.sf-tag--done{filter:grayscale(.5) opacity(.5);}
.sf-scene{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#e8f5e9,#fff8e1);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;border:3px solid ${theme}55;}
.sf-item{position:absolute;background:transparent;font-size:24px;line-height:1;transition:transform .3s ease;touch-action:manipulation;}
.sf-item--found{animation:sf-dance .6s ease infinite;font-size:32px!important;filter:drop-shadow(0 0 8px ${theme});}
.sf-item--shake{animation:sf-shake .4s ease;}
@keyframes sf-dance{0%,100%{transform:rotate(-15deg) scale(1.2)}50%{transform:rotate(15deg) scale(1.2)}}
@keyframes sf-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): SeekFindGame {
  return new SeekFindGame();
}
