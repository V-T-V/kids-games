/* 颜色分家 Color Sort —— 把同色物品拖到对应颜色的篮子。
   巧思：篮子装满会笑；分类完成全部通关。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const GROUPS = [
  { color: "#ff6b9d", emoji: "🍓", name: "粉" },
  { color: "#ffd93d", emoji: "🍋", name: "黄" },
  { color: "#4d96ff", emoji: "🫐", name: "蓝" },
  { color: "#6bcf7f", emoji: "🥝", name: "绿" },
  { color: "#ff9f43", emoji: "🍊", name: "橙" },
];

interface Item {
  emoji: string;
  color: string;
  el: HTMLElement;
  placed: boolean;
}

export class ColorSortGame extends BaseGame {
  constructor() {
    super("color-sort");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private baskets: HTMLDivElement[] = [];
  private items: Item[] = [];
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.items = [];
    const groupCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const perGroup = this.difficulty === "hard" ? 4 : 3;
    const groups = shuffle(GROUPS).slice(0, groupCount);

    const wrap = document.createElement("div");
    wrap.className = "cs-wrap";
    const task = document.createElement("div");
    task.className = "cs-task";
    task.innerHTML = `把水果放进同颜色的篮子～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 物品区
    const itemArea = document.createElement("div");
    itemArea.className = "cs-items";
    const allItems: { emoji: string; color: string }[] = [];
    groups.forEach((g) => {
      for (let i = 0; i < perGroup; i++)
        allItems.push({ emoji: g.emoji, color: g.color });
    });
    this.remaining = allItems.length;

    // 篮子区
    const basketRow = document.createElement("div");
    basketRow.className = "cs-baskets";
    this.baskets = [];
    const basketFill = new Map<string, number>();
    groups.forEach((g) => basketFill.set(g.color, 0));

    shuffle(allItems).forEach((it) => {
      const el = document.createElement("div");
      el.className = "cs-item";
      el.textContent = it.emoji;
      itemArea.appendChild(el);
      const item: Item = { ...it, el, placed: false };
      this.items.push(item);
      this.enableDrag(item, basketFill, task);
    });

    groups.forEach((g) => {
      const b = document.createElement("div");
      b.className = "cs-basket";
      b.style.setProperty("--bcolor", g.color);
      b.dataset.color = g.color;
      b.dataset.need = String(perGroup);
      b.innerHTML = `<div class="cs-basket__emoji">🧺</div><div class="cs-basket__count">0/${perGroup}</div>`;
      basketRow.appendChild(b);
      this.baskets.push(b);
    });

    wrap.appendChild(itemArea);
    wrap.appendChild(basketRow);
    this.root.appendChild(wrap);
  }

  private enableDrag(
    item: Item,
    fill: Map<string, number>,
    task: HTMLElement,
  ): void {
    let dragging = false;
    let offX = 0,
      offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (item.placed) return;
      dragging = true;
      const r = item.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = item.el.parentElement;
      item.el.classList.add("cs-item--drag");
      item.el.style.position = "fixed";
      item.el.style.left = `${p.x - offX}px`;
      item.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(item.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      item.el.style.left = `${p.x - offX}px`;
      item.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      item.el.classList.remove("cs-item--drag");
      const basket = this.baskets.find((b) => {
        const r = b.getBoundingClientRect();
        return (
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
        );
      });
      if (basket && basket.dataset.color === item.color) {
        // 正确
        item.placed = true;
        item.el.remove();
        this.remaining -= 1;
        const cur = (fill.get(item.color) ?? 0) + 1;
        fill.set(item.color, cur);
        const cnt = basket.querySelector(".cs-basket__count")!;
        cnt.textContent = `${cur}/${basket.dataset.need}`;
        if (cur >= Number(basket.dataset.need))
          basket.classList.add("cs-basket--full");
        const r = basket.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top);
        this.resetWrongStreak();
        if (this.remaining <= 0) {
          this.trackTimeout(() => {
            this.roundsDone += 1;
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 1000);
        }
      } else {
        // 归位
        item.el.style.position = "";
        item.el.style.left = "";
        item.el.style.top = "";
        origin?.appendChild(item.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
      void task;
    };
    const u = bindPointer(item.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看水果是什么颜色～",
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
    if (document.getElementById("cs-style")) return;
    const st = document.createElement("style");
    st.id = "cs-style";
    st.textContent = CS_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function CS_CSS(_theme: string): string {
  return `
.cs-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.cs-task{font-size:1.1rem;font-weight:800;}
.cs-items{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;min-height:80px;padding:10px;}
.cs-item{font-size:2.2rem;cursor:grab;touch-action:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.2));}
.cs-item--drag{cursor:grabbing;transform:scale(1.2);z-index:100;}
.cs-baskets{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.cs-basket{width:96px;height:110px;border-radius:16px 16px 12px 12px;background:color-mix(in srgb,var(--bcolor) 25%,#fff);border:4px solid var(--bcolor);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;}
.cs-basket__emoji{font-size:2.8rem;}
.cs-basket__count{font-size:.85rem;font-weight:700;color:var(--ink);}
.cs-basket--full{animation:cs-happy .5s ease;background:color-mix(in srgb,var(--bcolor) 45%,#fff);}
.cs-basket--full .cs-basket__emoji::after{content:'😀';}
@keyframes cs-happy{0%{transform:scale(1)}50%{transform:scale(1.12) rotate(-5deg)}100%{transform:scale(1)}}
`;
}

export function create(): ColorSortGame {
  return new ColorSortGame();
}
