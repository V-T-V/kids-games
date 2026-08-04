/* 收拾房间 Tidy Up —— 把物品拖到对应的生活容器（衣柜/书架/玩具箱）。
   独特点：物品归位到语义容器（家具，区别于颜色分家的按颜色篮子）。
   巧思：房间乱→整洁，物品按用途归类。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const BINS = [
  {
    id: "cloth",
    name: "衣柜",
    icon: "👔",
    items: ["👕", "👖", "👗", "🧢", "🧦", "🧣"],
  },
  {
    id: "book",
    name: "书架",
    icon: "📚",
    items: ["📖", "📕", "📗", "✏️", "📐", "🖍️"],
  },
  {
    id: "toy",
    name: "玩具箱",
    icon: "🧸",
    items: ["⚽", "🚗", "🪀", "🧩", "🎲", "🪁"],
  },
  {
    id: "food",
    name: "冰箱",
    icon: "🧊",
    items: ["🍎", "🥛", "🧀", "🍌", "🥕", "🥚"],
  },
];

interface Item {
  emoji: string;
  bin: string;
  el: HTMLElement;
  placed: boolean;
}

export class TidyUpGame extends BaseGame {
  constructor() {
    super("tidy-up");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    const binCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const per = this.difficulty === "hard" ? 3 : 2;
    const bins = shuffle(BINS).slice(0, binCount);
    const allItems: { emoji: string; bin: string }[] = [];
    bins.forEach((b) => {
      shuffle(b.items)
        .slice(0, per)
        .forEach((it) => allItems.push({ emoji: it, bin: b.id }));
    });
    this.remaining = allItems.length;

    const wrap = document.createElement("div");
    wrap.className = "tu-wrap";
    const task = document.createElement("div");
    task.className = "tu-task";
    task.innerHTML = `把东西放回该放的地方～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const itemArea = document.createElement("div");
    itemArea.className = "tu-items";
    const items: Item[] = [];
    shuffle(allItems).forEach((it) => {
      const el = document.createElement("div");
      el.className = "tu-item";
      el.textContent = it.emoji;
      itemArea.appendChild(el);
      items.push({ ...it, el, placed: false });
    });
    wrap.appendChild(itemArea);

    const binRow = document.createElement("div");
    binRow.className = "tu-bins";
    const binEls: HTMLDivElement[] = [];
    bins.forEach((b) => {
      const el = document.createElement("div");
      el.className = "tu-bin";
      el.dataset.id = b.id;
      el.innerHTML = `<div class="tu-bin__icon">${b.icon}</div><div class="tu-bin__name">${b.name}</div>`;
      binRow.appendChild(el);
      binEls.push(el);
    });
    wrap.appendChild(binRow);
    this.root.appendChild(wrap);

    items.forEach((it) => this.enableDrag(it, binEls));
  }

  private enableDrag(it: Item, bins: HTMLDivElement[]): void {
    let dragging = false,
      ox = 0,
      oy = 0,
      origin: HTMLElement | null = null;
    const u = bindPointer(it.el, {
      down: (p) => {
        if (it.placed) return;
        dragging = true;
        const r = it.el.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        origin = it.el.parentElement;
        it.el.classList.add("tu-item--drag");
        it.el.style.position = "fixed";
        it.el.style.left = `${p.x - ox}px`;
        it.el.style.top = `${p.y - oy}px`;
        document.body.appendChild(it.el);
        sfxPop();
      },
      move: (p) => {
        if (dragging) {
          it.el.style.left = `${p.x - ox}px`;
          it.el.style.top = `${p.y - oy}px`;
        }
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        it.el.classList.remove("tu-item--drag");
        const bin = bins.find((b) => {
          const r = b.getBoundingClientRect();
          return (
            p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
          );
        });
        if (bin && bin.dataset.id === it.bin) {
          it.placed = true;
          it.el.remove();
          this.remaining -= 1;
          const r = bin.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top);
          this.resetWrongStreak();
          if (this.remaining <= 0)
            this.trackTimeout(() => {
              this.roundsDone += 1;
              if (this.roundsDone >= this.roundTotal) {
                this.finishClear(starsByAccuracy(this.wrongCount));
              } else {
                this.startRound();
              }
            }, 900);
        } else {
          it.el.style.position = "";
          it.el.style.left = "";
          it.el.style.top = "";
          origin?.appendChild(it.el);
          const paused = this.onWrong();
          if (paused) this.showRest();
        }
      },
    });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想这个东西平时放哪～",
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
    if (document.getElementById("tu-style")) return;
    const st = document.createElement("style");
    st.id = "tu-style";
    st.textContent = TU_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function TU_CSS(theme: string): string {
  return `
.tu-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.tu-task{font-size:1.1rem;font-weight:800;}
.tu-items{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;min-height:70px;padding:8px;background:rgba(255,255,255,.5);border-radius:14px;width:100%;max-width:360px;}
.tu-item{font-size:2.2rem;cursor:grab;touch-action:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.2));}
.tu-item--drag{cursor:grabbing;transform:scale(1.2);z-index:100;}
.tu-bins{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.tu-bin{width:88px;height:96px;border-radius:16px;background:color-mix(in srgb,${theme} 20%,#fff);border:3px solid ${theme};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;}
.tu-bin__icon{font-size:2.4rem;}
.tu-bin__name{font-size:.85rem;font-weight:700;}
`;
}

export function create(): TidyUpGame {
  return new TidyUpGame();
}
