/* 影子朋友 Shadow Match —— 把物品拖到对应的黑色影子上。
   巧思：配对成功影子染上颜色变成实物。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const ITEMS = [
  { emoji: "🍎", name: "苹果" },
  { emoji: "🍌", name: "香蕉" },
  { emoji: "⭐", name: "星星" },
  { emoji: "🐱", name: "小猫" },
  { emoji: "🚗", name: "汽车" },
  { emoji: "🌸", name: "花朵" },
  { emoji: "🐠", name: "小鱼" },
  { emoji: "☂️", name: "雨伞" },
];

interface Item {
  emoji: string;
  el: HTMLElement;
  placed: boolean;
}

export class ShadowMatchGame extends BaseGame {
  constructor() {
    super("shadow-match");
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
    const n =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const picked = shuffle(ITEMS).slice(0, n);

    const wrap = document.createElement("div");
    wrap.className = "shm-wrap";
    const task = document.createElement("div");
    task.className = "shm-task";
    task.innerHTML = `把物品放到它自己的影子上～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "shm-board";
    // 左：物品
    const leftCol = document.createElement("div");
    leftCol.className = "shm-col";
    const items: Item[] = [];
    this.remaining = n;
    shuffle(picked).forEach((it) => {
      const el = document.createElement("div");
      el.className = "shm-item";
      el.textContent = it.emoji;
      leftCol.appendChild(el);
      const obj = { emoji: it.emoji, el, placed: false };
      items.push(obj);
    });
    // 右：影子
    const rightCol = document.createElement("div");
    rightCol.className = "shm-col";
    const shadowEls: HTMLDivElement[] = [];
    shuffle(picked).forEach((it) => {
      const sh = document.createElement("div");
      sh.className = "shm-shadow";
      sh.dataset.emoji = it.emoji;
      sh.innerHTML = `<span class="shm-shadow__icon">${it.emoji}</span>`;
      rightCol.appendChild(sh);
      shadowEls.push(sh);
    });

    // 拖拽
    items.forEach((obj) => this.enableDrag(obj, shadowEls));

    board.appendChild(leftCol);
    board.appendChild(rightCol);
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private enableDrag(item: Item, shadows: HTMLDivElement[]): void {
    let dragging = false,
      offX = 0,
      offY = 0,
      origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (item.placed) return;
      dragging = true;
      const r = item.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = item.el.parentElement;
      item.el.classList.add("shm-item--drag");
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
      item.el.classList.remove("shm-item--drag");
      const hit = shadows.find((s) => {
        const r = s.getBoundingClientRect();
        return (
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
        );
      });
      if (hit && hit.dataset.emoji === item.emoji) {
        item.placed = true;
        item.el.remove();
        hit.classList.add("shm-shadow--filled");
        const r = hit.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        this.remaining -= 1;
        if (this.remaining <= 0)
          this.trackTimeout(() => {
            this.roundsDone += 1;
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 1000);
      } else {
        item.el.style.position = "";
        item.el.style.left = "";
        item.el.style.top = "";
        origin?.appendChild(item.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(item.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "比一比形状像不像～",
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
    if (document.getElementById("shm-style")) return;
    const st = document.createElement("style");
    st.id = "shm-style";
    st.textContent = SHM_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function SHM_CSS(_theme: string): string {
  return `
.shm-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.shm-task{font-size:1.1rem;font-weight:800;}
.shm-board{display:flex;gap:20px;justify-content:center;}
.shm-col{display:flex;flex-direction:column;gap:12px;}
.shm-item{font-size:2.4rem;cursor:grab;touch-action:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.2));}
.shm-item--drag{cursor:grabbing;transform:scale(1.2);z-index:100;}
.shm-shadow{width:64px;height:64px;border-radius:14px;background:#eee;display:flex;align-items:center;justify-content:center;}
.shm-shadow__icon{font-size:2.2rem;filter:brightness(0) opacity(.25);}
.shm-shadow--filled{background:#fff;animation:shm-pop .4s ease;}
.shm-shadow--filled .shm-shadow__icon{filter:none;}
@keyframes shm-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
`;
}

export function create(): ShadowMatchGame {
  return new ShadowMatchGame();
}
