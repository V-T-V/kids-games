/* 七巧板 Tangram —— 拖动彩色形状块到对应轮廓凹槽（吸附）。
   巧思：拼完整体点亮；用经典七巧板块（三角/方/平行四边形）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

// 用 emoji 化简：每个"块"是一个图形 emoji，配对应轮廓
const PIECES = [
  { id: "tri1", icon: "🔺", color: "#ff6b9d" },
  { id: "tri2", icon: "🔻", color: "#4d96ff" },
  { id: "sq", icon: "🟦", color: "#6bcf7f" },
  { id: "circle", icon: "🟡", color: "#ffd93d" },
  { id: "star", icon: "⭐", color: "#ff9f43" },
  { id: "heart", icon: "🟪", color: "#a55eea" },
];

interface Piece {
  id: string;
  icon: string;
  color: string;
  el: HTMLElement;
  placed: boolean;
}

export class TangramGame extends BaseGame {
  constructor() {
    super("tangram");
  }
  private roundTotal = 0;
  private roundsDone = 0;
  private unbinds: (() => void)[] = [];
  private remaining = 0;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root.innerHTML = "";
    this.unbinds = [];
    const n =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 6;
    const picked = shuffle(PIECES).slice(0, n);
    this.remaining = n;

    const wrap = document.createElement("div");
    wrap.className = "tg-wrap";
    const task = document.createElement("div");
    task.className = "tg-task";
    task.textContent = "把彩块拖到同形状的灰影子里～";
    wrap.appendChild(task);

    // 轮廓区
    const outline = document.createElement("div");
    outline.className = "tg-outline";
    const slots: HTMLDivElement[] = [];
    shuffle(picked).forEach((p) => {
      const s = document.createElement("div");
      s.className = "tg-slot";
      s.dataset.id = p.id;
      s.innerHTML = `<span class="tg-slot__icon">${p.icon}</span>`;
      outline.appendChild(s);
      slots.push(s);
    });
    wrap.appendChild(outline);

    // 块区
    const tray = document.createElement("div");
    tray.className = "tg-tray";
    const pieces: Piece[] = [];
    shuffle(picked).forEach((p) => {
      const el = document.createElement("div");
      el.className = "tg-piece";
      el.style.background = p.color;
      el.textContent = p.icon;
      tray.appendChild(el);
      pieces.push({ ...p, el, placed: false });
    });
    wrap.appendChild(tray);
    this.root.appendChild(wrap);

    pieces.forEach((pc) => this.enableDrag(pc, slots));
  }

  private enableDrag(pc: Piece, slots: HTMLDivElement[]): void {
    let dragging = false,
      offX = 0,
      offY = 0,
      origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (pc.placed) return;
      dragging = true;
      const r = pc.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = pc.el.parentElement;
      pc.el.classList.add("tg-piece--drag");
      pc.el.style.position = "fixed";
      pc.el.style.left = `${p.x - offX}px`;
      pc.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(pc.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      pc.el.style.left = `${p.x - offX}px`;
      pc.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      pc.el.classList.remove("tg-piece--drag");
      const slot = slots.find((s) => {
        const r = s.getBoundingClientRect();
        return (
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
        );
      });
      if (slot && slot.dataset.id === pc.id) {
        pc.placed = true;
        pc.el.remove();
        slot.classList.add("tg-slot--filled");
        slot.style.background = pc.color;
        const r = slot.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        this.remaining -= 1;
        if (this.remaining <= 0)
          this.trackTimeout(() => {
            this.roundsDone += 1;
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 900);
      } else {
        pc.el.style.position = "";
        pc.el.style.left = "";
        pc.el.style.top = "";
        origin?.appendChild(pc.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(pc.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "比一比形状一样吗～",
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
    if (document.getElementById("tg-style")) return;
    const st = document.createElement("style");
    st.id = "tg-style";
    st.textContent = TG_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function TG_CSS(theme: string): string {
  return `
.tg-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.tg-task{font-size:1.1rem;font-weight:800;}
.tg-outline{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:16px;background:rgba(255,255,255,.5);border-radius:20px;box-shadow:var(--shadow);}
.tg-slot{width:68px;height:68px;border-radius:14px;background:#eee;display:flex;align-items:center;justify-content:center;border:3px dashed ${theme}55;}
.tg-slot__icon{font-size:2.2rem;opacity:.3;}
.tg-slot--filled{border-style:solid;animation:tg-pop .4s ease;}
.tg-slot--filled .tg-slot__icon{opacity:1;}
.tg-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:10px;}
.tg-piece{width:60px;height:60px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:2rem;cursor:grab;touch-action:none;box-shadow:var(--shadow);filter:brightness(1.05);}
.tg-piece--drag{cursor:grabbing;transform:scale(1.15);z-index:100;}
@keyframes tg-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
`;
}

export function create(): TangramGame {
  return new TangramGame();
}
