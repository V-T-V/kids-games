/* 撕贴纸 Peel-Sticker —— 把贴纸拖到对应形状的空槽里。
   独特点：形状配对 + 精细拖拽。视觉：贴纸页 + 形状虚框槽。
   巧思：贴纸放对槽会"贴住"并变色；放错弹回。难度=贴纸数。前缀 pst-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Sticker {
  shape: string; // 形状 id
  color: string;
  el: HTMLDivElement;
  placed: boolean;
}

const SHAPES = [
  { id: "star", emoji: "⭐", name: "星星" },
  { id: "heart", emoji: "❤️", name: "爱心" },
  { id: "flower", emoji: "🌸", name: "小花" },
  { id: "sun", emoji: "☀️", name: "太阳" },
  { id: "leaf", emoji: "🍃", name: "树叶" },
];

export class PeelStickerGame extends BaseGame {
  constructor() {
    super("peel-sticker");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private stickers: Sticker[] = [];
  private slots: HTMLDivElement[] = [];
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

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.stickers = [];
    this.slots = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    this.remaining = n;
    const picked = shuffle(SHAPES).slice(0, n);

    const wrap = document.createElement("div");
    wrap.className = "pst-wrap";
    const task = document.createElement("div");
    task.className = "pst-task";
    task.innerHTML = `把贴纸拖到<b>一样</b>的形状框里～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 槽位页（目标）
    const page = document.createElement("div");
    page.className = "pst-page";
    picked.forEach((s) => {
      const slot = document.createElement("div");
      slot.className = "pst-slot";
      slot.dataset.shape = s.id;
      slot.innerHTML = `<div class="pst-slot__outline">${s.emoji}</div>`;
      page.appendChild(slot);
      this.slots.push(slot);
    });
    wrap.appendChild(page);

    // 贴纸托盘
    const tray = document.createElement("div");
    tray.className = "pst-tray";
    const shuffled = shuffle(picked);
    shuffled.forEach((s) => {
      const el = document.createElement("div");
      el.className = "pst-sticker";
      el.textContent = s.emoji;
      tray.appendChild(el);
      this.stickers.push({ shape: s.id, color: "", el, placed: false });
    });
    wrap.appendChild(tray);
    this.root.appendChild(wrap);

    this.stickers.forEach((b) => this.enableDrag(b));
  }

  private enableDrag(b: Sticker): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    const u = bindPointer(b.el, {
      down: (p) => {
        if (b.placed) return;
        dragging = true;
        const r = b.el.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        b.el.classList.add("pst-sticker--drag");
        b.el.style.position = "fixed";
        b.el.style.left = `${p.x - ox}px`;
        b.el.style.top = `${p.y - oy}px`;
        b.el.style.width = `${r.width}px`;
        b.el.style.height = `${r.height}px`;
        document.body.appendChild(b.el);
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        b.el.style.left = `${p.x - ox}px`;
        b.el.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        b.el.classList.remove("pst-sticker--drag");
        const slot = this.slots.find((h) => {
          const r = h.getBoundingClientRect();
          return (
            p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
          );
        });
        if (
          slot &&
          slot.dataset.shape === b.shape &&
          !slot.classList.contains("pst-slot--done")
        ) {
          b.placed = true;
          slot.classList.add("pst-slot--done");
          slot.appendChild(b.el);
          b.el.style.position = "absolute";
          b.el.style.left = "50%";
          b.el.style.top = "50%";
          b.el.style.transform = "translate(-50%,-50%)";
          b.el.style.width = "";
          b.el.style.height = "";
          const r = slot.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          this.remaining -= 1;
          if (this.remaining <= 0) {
            this.roundsDone += 1;
            this.reportProgress(this.roundsDone, this.roundTotal);
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal) {
                this.finishClear(starsByAccuracy(this.wrongCount));
              } else {
                this.startRound();
              }
            }, 900);
          }
        } else {
          // 弹回托盘
          b.el.parentElement?.removeChild(b.el);
          this.root.querySelector(".pst-tray")?.appendChild(b.el);
          b.el.style.position = "";
          b.el.style.left = "";
          b.el.style.top = "";
          b.el.style.width = "";
          b.el.style.height = "";
          b.el.style.transform = "";
          if (slot) {
            const paused = this.onWrong();
            if (paused) this.showRest();
          }
        }
      },
    });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🌸",
      variant: "rest",
      body: "看看贴纸和形状框是不是<b>一样</b>，一样才能贴上～",
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
    if (document.getElementById("pst-style")) return;
    const st = document.createElement("style");
    st.id = "pst-style";
    st.textContent = PST_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function PST_CSS(theme: string): string {
  return `
.pst-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.pst-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.4;}
.pst-task b{color:${theme};}
.pst-page{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:20px 16px;width:min(360px,88vw);background:linear-gradient(180deg,#fff,#f3f0ff);border-radius:20px;box-shadow:var(--shadow);min-height:130px;align-items:center;}
.pst-slot{position:relative;width:64px;height:64px;display:flex;align-items:center;justify-content:center;}
.pst-slot__outline{width:58px;height:58px;border-radius:14px;border:3px dashed #b9a8e0;background:rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;font-size:2rem;opacity:.45;filter:grayscale(.6);}
.pst-slot--done .pst-slot__outline{opacity:0;}
.pst-slot--done{animation:pst-pop .4s ease;}
.pst-tray{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:14px 18px;background:rgba(255,255,255,.6);border-radius:18px;min-height:72px;width:100%;max-width:420px;}
.pst-sticker{font-size:2.2rem;line-height:1;cursor:grab;touch-action:none;filter:drop-shadow(0 3px 3px rgba(0,0,0,.2));user-select:none;transition:transform .12s;}
.pst-sticker:active{transform:scale(1.1);}
.pst-sticker--drag{cursor:grabbing;transform:scale(1.25);z-index:100;filter:drop-shadow(0 6px 8px rgba(0,0,0,.35));}
@keyframes pst-pop{0%{transform:scale(.6)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@media (max-width:380px){.pst-slot,.pst-slot__outline{width:52px;height:52px;}.pst-sticker{font-size:1.8rem;}}
`;
}

export function create(): PeelStickerGame {
  return new PeelStickerGame();
}
