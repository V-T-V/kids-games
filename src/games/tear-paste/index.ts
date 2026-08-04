/* 撕纸贴画 Tear Paste —— 把散落的彩纸碎片拖到对应的轮廓位置，拼成一幅画。
   独特点：形状轮廓匹配 + 精细拖拽。视觉：彩纸碎片（不规则多边形）+ 虚线轮廓。
   巧思：每个碎片对应一个轮廓槽，拖到正确槽位吸附就位；拖错弹回。
   难度 = 碎片数（3/4/6）。通关 = 完成目标轮数。前缀 trps-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Piece {
  id: number;
  color: string;
  emoji: string;
  el: HTMLDivElement;
  placed: boolean;
  origin: HTMLElement;
}

interface Slot {
  id: number;
  color: string;
  el: HTMLDivElement;
}

/** 一组主题：碎片 = 轮廓槽（同色配对），组成一幅画。 */
interface Scene {
  name: string;
  bg: string;
  pieces: { color: string; emoji: string }[];
}

const SCENES: Scene[] = [
  {
    name: "小花",
    bg: "linear-gradient(180deg,#e0f7fa,#fff)",
    pieces: [
      { color: "#ff5252", emoji: "🔴" },
      { color: "#ffd93d", emoji: "🟡" },
      { color: "#6bcf7f", emoji: "🟢" },
    ],
  },
  {
    name: "小车",
    bg: "linear-gradient(180deg,#e3f2fd,#fff)",
    pieces: [
      { color: "#4d96ff", emoji: "🟦" },
      { color: "#333", emoji: "⚫" },
      { color: "#333", emoji: "⚫" },
      { color: "#ff5252", emoji: "🟥" },
    ],
  },
  {
    name: "毛毛虫",
    bg: "linear-gradient(180deg,#f1f8e9,#fff)",
    pieces: [
      { color: "#6bcf7f", emoji: "🟢" },
      { color: "#6bcf7f", emoji: "🟢" },
      { color: "#6bcf7f", emoji: "🟢" },
      { color: "#ffd93d", emoji: "🟡" },
    ],
  },
];

export class TearPasteGame extends BaseGame {
  constructor() {
    super("tear-paste");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private pieces: Piece[] = [];
  private slots: Slot[] = [];
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.pieces = [];
    this.slots = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const scene = SCENES[this.roundsDone % SCENES.length]!;
    this.remaining = scene.pieces.length;

    const wrap = document.createElement("div");
    wrap.className = "trps-wrap";
    const task = document.createElement("div");
    task.className = "trps-task";
    task.innerHTML = `把纸片拖到<b>一样颜色</b>的虚线框里，拼出${scene.name}～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 画布区（含轮廓）
    const board = document.createElement("div");
    board.className = "trps-board";
    board.style.background = scene.bg;
    scene.pieces.forEach((p, i) => {
      const slot = document.createElement("div");
      slot.className = "trps-slot";
      slot.dataset.color = p.color;
      slot.dataset.id = String(i);
      slot.style.setProperty("--trps-color", p.color);
      board.appendChild(slot);
      this.slots.push({ id: i, color: p.color, el: slot });
    });
    wrap.appendChild(board);

    // 碎片托盘
    const tray = document.createElement("div");
    tray.className = "trps-tray";
    const shuffled = shuffle(scene.pieces);
    shuffled.forEach((p, i) => {
      const el = document.createElement("div");
      el.className = "trps-piece";
      el.style.setProperty("--trps-color", p.color);
      el.textContent = p.emoji;
      tray.appendChild(el);
      this.pieces.push({
        id: i,
        color: p.color,
        emoji: p.emoji,
        el,
        placed: false,
        origin: tray,
      });
    });
    wrap.appendChild(tray);
    this.root.appendChild(wrap);

    this.pieces.forEach((p) => this.enableDrag(p));
  }

  private enableDrag(p: Piece): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    const u = bindPointer(p.el, {
      down: (pt) => {
        if (p.placed) return;
        dragging = true;
        const r = p.el.getBoundingClientRect();
        ox = pt.x - r.left;
        oy = pt.y - r.top;
        p.el.classList.add("trps-piece--drag");
        p.el.style.position = "fixed";
        p.el.style.left = `${pt.x - ox}px`;
        p.el.style.top = `${pt.y - oy}px`;
        p.el.style.width = `${r.width}px`;
        p.el.style.height = `${r.height}px`;
        document.body.appendChild(p.el);
        sfxPop();
      },
      move: (pt) => {
        if (!dragging) return;
        p.el.style.left = `${pt.x - ox}px`;
        p.el.style.top = `${pt.y - oy}px`;
      },
      up: (pt) => {
        if (!dragging) return;
        dragging = false;
        p.el.classList.remove("trps-piece--drag");
        const slot = this.slots.find((s) => {
          if (s.el.classList.contains("trps-slot--filled")) return false;
          const r = s.el.getBoundingClientRect();
          return (
            pt.x >= r.left &&
            pt.x <= r.right &&
            pt.y >= r.top &&
            pt.y <= r.bottom
          );
        });
        if (slot && slot.color === p.color) {
          // 贴对
          p.placed = true;
          slot.el.classList.add("trps-slot--filled");
          slot.el.appendChild(p.el);
          p.el.style.position = "absolute";
          p.el.style.left = "50%";
          p.el.style.top = "50%";
          p.el.style.transform = "translate(-50%,-50%)";
          p.el.style.width = "";
          p.el.style.height = "";
          const r = slot.el.getBoundingClientRect();
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
            }, 1000);
          }
        } else {
          // 弹回托盘
          p.origin.appendChild(p.el);
          p.el.style.position = "";
          p.el.style.left = "";
          p.el.style.top = "";
          p.el.style.width = "";
          p.el.style.height = "";
          p.el.style.transform = "";
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
      title: "休息一下～",
      emoji: "🎨",
      variant: "rest",
      body: "看看纸片的颜色，再找<b>一样颜色</b>的虚线框～",
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
    if (document.getElementById("trps-style")) return;
    const st = document.createElement("style");
    st.id = "trps-style";
    st.textContent = TRPS_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function TRPS_CSS(_theme: string): string {
  return `
.trps-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(440px,100%);}
.trps-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.4;}
.trps-board{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:center;padding:22px 16px;width:min(360px,86vw);min-height:140px;border-radius:20px;box-shadow:var(--shadow);}
.trps-slot{position:relative;width:58px;height:58px;border:3px dashed var(--trps-color,#888);border-radius:12px;background:rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;}
.trps-slot--filled{border-style:solid;background:transparent;animation:trps-pop .4s ease;}
.trps-tray{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:14px 18px;background:rgba(255,255,255,.55);border-radius:18px;min-height:72px;width:100%;max-width:420px;}
.trps-piece{width:50px;height:50px;border-radius:30% 70% 60% 40%/40% 50% 60% 50%;background:radial-gradient(circle at 35% 30%,#fff8,var(--trps-color,#888));box-shadow:0 2px 4px rgba(0,0,0,.25);font-size:1.4rem;display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;filter:saturate(.4);}
.trps-piece--drag{cursor:grabbing;transform:scale(1.2);z-index:100;filter:drop-shadow(0 6px 6px rgba(0,0,0,.35));}
@keyframes trps-pop{0%{transform:scale(.5)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@media (max-width:380px){.trps-slot,.trps-piece{width:46px;height:46px;}}
`;
}

export function create(): TearPasteGame {
  return new TearPasteGame();
}
