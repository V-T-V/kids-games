/* 分拣帽子 Sorting Hat —— 把物品拖到正确的分类箱（颜色/形状等维度）。
   独特点：每关随机一个分类维度（颜色/形状/种类），箱子上写着规则。
   巧思：拖对箱子弹一下并发出"啵"，拖错回弹。难度=物品数 + 维度。用 bindPointer 拖拽。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface SortItem {
  emoji: string;
  group: string;
}

interface Dimension {
  name: string; // "按颜色分"
  groups: { id: string; label: string; emoji: string; members: SortItem[] }[];
}

// 维度一：颜色
const COLORS: Dimension = {
  name: "颜色",
  groups: [
    {
      id: "red",
      label: "红色放这",
      emoji: "🟥",
      members: [
        { emoji: "🍎", group: "red" },
        { emoji: "🌹", group: "red" },
        { emoji: "🐞", group: "red" },
      ],
    },
    {
      id: "yellow",
      label: "黄色放这",
      emoji: "🟨",
      members: [
        { emoji: "🍌", group: "yellow" },
        { emoji: "⭐", group: "yellow" },
        { emoji: "🌻", group: "yellow" },
      ],
    },
    {
      id: "green",
      label: "绿色放这",
      emoji: "🟩",
      members: [
        { emoji: "🥦", group: "green" },
        { emoji: "🌿", group: "green" },
        { emoji: "🐸", group: "green" },
      ],
    },
  ],
};

// 维度二：形状
const SHAPES: Dimension = {
  name: "形状",
  groups: [
    {
      id: "round",
      label: "圆的放这",
      emoji: "⭕",
      members: [
        { emoji: "⚽", group: "round" },
        { emoji: "🍊", group: "round" },
        { emoji: "🥚", group: "round" },
      ],
    },
    {
      id: "square",
      label: "方的放这",
      emoji: "⬜",
      members: [
        { emoji: "📦", group: "square" },
        { emoji: "📖", group: "square" },
        { emoji: "🧀", group: "square" },
      ],
    },
    {
      id: "triangle",
      label: "三角的放这",
      emoji: "🔺",
      members: [
        { emoji: "🍕", group: "triangle" },
        { emoji: "🎈", group: "triangle" },
        { emoji: "⛺", group: "triangle" },
      ],
    },
  ],
};

// 维度三：天上/水里
const PLACES: Dimension = {
  name: "哪里",
  groups: [
    {
      id: "sky",
      label: "天上的放这",
      emoji: "☁️",
      members: [
        { emoji: "🐦", group: "sky" },
        { emoji: "✈️", group: "sky" },
        { emoji: "🌤️", group: "sky" },
      ],
    },
    {
      id: "water",
      label: "水里的放这",
      emoji: "💧",
      members: [
        { emoji: "🐟", group: "water" },
        { emoji: "🚢", group: "water" },
        { emoji: "🐙", group: "water" },
      ],
    },
  ],
};

const DIMENSIONS = [COLORS, SHAPES, PLACES];

interface Piece extends SortItem {
  el: HTMLElement;
  placed: boolean;
}

export class SortingHatGame extends BaseGame {
  constructor() {
    super("sorting-hat");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private remaining = 0;
  private unbinds: (() => void)[] = [];

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

    const dim = sample(DIMENSIONS);
    // 每组取的物品数随难度
    const per =
      this.difficulty === "easy" ? 1 : this.difficulty === "medium" ? 2 : 2;
    const groups = dim.groups.map((g) => ({
      ...g,
      members: shuffle(g.members).slice(0, per),
    }));

    const allItems: SortItem[] = [];
    groups.forEach((g) => g.members.forEach((m) => allItems.push(m)));
    this.remaining = allItems.length;

    const wrap = document.createElement("div");
    wrap.className = "sh-wrap";
    const task = document.createElement("div");
    task.className = "sh-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 按 <b>${dim.name}</b> 把东西分到对的箱子`;
    wrap.appendChild(task);

    const itemArea = document.createElement("div");
    itemArea.className = "sh-items";
    const pieces: Piece[] = [];
    shuffle(allItems).forEach((it) => {
      const el = document.createElement("div");
      el.className = "sh-item";
      el.textContent = it.emoji;
      itemArea.appendChild(el);
      pieces.push({ ...it, el, placed: false });
    });
    wrap.appendChild(itemArea);

    const binRow = document.createElement("div");
    binRow.className = "sh-bins";
    const binEls: HTMLDivElement[] = [];
    groups.forEach((g) => {
      const el = document.createElement("div");
      el.className = "sh-bin";
      el.dataset.id = g.id;
      el.innerHTML = `<div class="sh-bin__emoji">${g.emoji}</div><div class="sh-bin__label">${g.label}</div><div class="sh-bin__count"></div>`;
      binRow.appendChild(el);
      binEls.push(el);
    });
    wrap.appendChild(binRow);
    this.root.appendChild(wrap);

    pieces.forEach((p) => this.enableDrag(p, binEls));
  }

  private enableDrag(p: Piece, bins: HTMLDivElement[]): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    let origin: HTMLElement | null = null;
    const u = bindPointer(p.el, {
      down: (pt) => {
        if (p.placed) return;
        dragging = true;
        const r = p.el.getBoundingClientRect();
        ox = pt.x - r.left;
        oy = pt.y - r.top;
        origin = p.el.parentElement;
        p.el.classList.add("sh-item--drag");
        p.el.style.position = "fixed";
        p.el.style.left = `${pt.x - ox}px`;
        p.el.style.top = `${pt.y - oy}px`;
        document.body.appendChild(p.el);
        sfxPop();
      },
      move: (pt) => {
        if (!dragging) return;
        p.el.style.left = `${pt.x - ox}px`;
        p.el.style.top = `${pt.y - oy}px`;
        // 高亮悬停的箱子
        bins.forEach((b) => b.classList.remove("sh-bin--hover"));
        const hover = this.binAt(pt, bins);
        if (hover) hover.classList.add("sh-bin--hover");
      },
      up: (pt) => {
        if (!dragging) return;
        dragging = false;
        p.el.classList.remove("sh-item--drag");
        bins.forEach((b) => b.classList.remove("sh-bin--hover"));
        const bin = this.binAt(pt, bins);
        if (bin && bin.dataset.id === p.group) {
          p.placed = true;
          p.el.remove();
          this.remaining -= 1;
          const count = bin.querySelector(".sh-bin__count");
          if (count) {
            const span = document.createElement("span");
            span.className = "sh-bin__chip";
            span.textContent = p.emoji;
            count.appendChild(span);
          }
          bin.classList.add("sh-bin--pop");
          this.trackTimeout(() => bin.classList.remove("sh-bin--pop"), 400);
          const r = bin.getBoundingClientRect();
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
            }, 800);
          }
        } else {
          // 回弹
          p.el.style.position = "";
          p.el.style.left = "";
          p.el.style.top = "";
          origin?.appendChild(p.el);
          p.el.classList.add("sh-item--shake");
          this.trackTimeout(() => p.el.classList.remove("sh-item--shake"), 450);
          const paused = this.onWrong();
          if (paused) this.showRest();
        }
      },
    });
    this.unbinds.push(u);
  }

  private binAt(
    pt: { x: number; y: number },
    bins: HTMLDivElement[],
  ): HTMLDivElement | null {
    for (const b of bins) {
      const r = b.getBoundingClientRect();
      if (
        pt.x >= r.left &&
        pt.x <= r.right &&
        pt.y >= r.top &&
        pt.y <= r.bottom
      ) {
        return b;
      }
    }
    return null;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看箱子上写的规则，再想想它该放哪～",
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
    if (document.getElementById("sh-style")) return;
    const st = document.createElement("style");
    st.id = "sh-style";
    st.textContent = SH_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function SH_CSS(theme: string): string {
  return `
.sh-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.sh-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.sh-items{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;min-height:70px;padding:12px;background:rgba(255,255,255,.55);border-radius:16px;width:100%;max-width:400px;}
.sh-item{font-size:2.3rem;cursor:grab;touch-action:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.2));transition:transform .15s;}
.sh-item--drag{cursor:grabbing;transform:scale(1.25);z-index:100;}
.sh-item--shake{animation:sh-shake .45s ease;}
@keyframes sh-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}
.sh-bins{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.sh-bin{width:104px;min-height:112px;border-radius:18px;background:color-mix(in srgb,${theme} 18%,#fff);border:3px solid ${theme};display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;padding:8px 4px;transition:transform .2s,box-shadow .2s;box-shadow:0 3px 6px rgba(0,0,0,.12);}
.sh-bin__emoji{font-size:2.2rem;}
.sh-bin__label{font-size:.82rem;font-weight:800;text-align:center;line-height:1.15;}
.sh-bin__count{display:flex;flex-wrap:wrap;gap:2px;justify-content:center;min-height:18px;}
.sh-bin__chip{font-size:1rem;}
.sh-bin--hover{transform:translateY(-6px) scale(1.05);box-shadow:0 8px 16px rgba(0,0,0,.2);}
.sh-bin--pop{animation:sh-pop .4s ease;}
@keyframes sh-pop{0%{transform:scale(1)}40%{transform:scale(1.15)}100%{transform:scale(1)}}
@media (max-width:380px){.sh-item{font-size:2rem;}.sh-bin{width:88px;}}
`;
}

export function create(): SortingHatGame {
  return new SortingHatGame();
}
