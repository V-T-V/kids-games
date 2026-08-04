/* 马赛克 Mosaic —— 一幅彩色图案被打散成方块碎片并打乱，
   孩子把碎片拖到对应的空位上，拼回完整图案。
   独特点：网格拼图 + 拖拽吸附，色彩感知与位置记忆。
   视觉：目标小图预览 + 大网格空槽 + 彩色方块碎片。
   难度 = 碎片数（easy 4 / medium 6 / hard 9）。通关 = 拼对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 调色板：每个 mosaic 关用其中若干色 */
const PALETTE = [
  "#ff6b9d",
  "#4d96ff",
  "#ffd93d",
  "#6bcf7f",
  "#a55eea",
  "#ff9f43",
  "#22d3ee",
  "#ff6348",
  "#b08968",
];

interface Cell {
  id: number;
  color: string;
  el: HTMLDivElement;
  placed: boolean;
}

export class MosaicGame extends BaseGame {
  constructor() {
    super("mosaic");
  }
  private unbinds: (() => void)[] = [];
  private remaining = 0;
  private roundsDone = 0;
  private roundTotal = 0;

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

  private gridSize(): number {
    return this.difficulty === "easy" ? 4: this.difficulty === "medium"
        ? 5
        : 6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds = [];
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = this.gridSize();
    const total = n * n;
    this.remaining = total;

    // 生成图案：每个 cell 一个颜色（从调色板抽，允许重复，整体偏亮）
    const colors = shuffle(PALETTE).slice(0, Math.min(n + 2, PALETTE.length));
    const pattern: string[] = [];
    for (let i = 0; i < total; i++) {
      pattern.push(colors[i % colors.length]!);
    }

    const wrap = document.createElement("div");
    wrap.className = "mq-wrap";

    const task = document.createElement("div");
    task.className = "mq-task";
    task.innerHTML = `把彩色方块拖到一样的位置 · 第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关`;
    wrap.appendChild(task);

    const body = document.createElement("div");
    body.className = "mq-body";

    // 左：目标小图预览
    const preview = document.createElement("div");
    preview.className = "mq-preview";
    preview.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    for (let i = 0; i < total; i++) {
      const c = document.createElement("div");
      c.className = "mq-preview-cell";
      c.style.background = pattern[i]!;
      preview.appendChild(c);
    }
    const pvLabel = document.createElement("div");
    pvLabel.className = "mq-label";
    pvLabel.textContent = "目标图";
    const pvBox = document.createElement("div");
    pvBox.className = "mq-preview-box";
    pvBox.appendChild(preview);
    pvBox.appendChild(pvLabel);
    body.appendChild(pvBox);

    // 右：拼图槽（空，待填）
    const grid = document.createElement("div");
    grid.className = "mq-grid";
    grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    const slots: HTMLDivElement[] = [];
    for (let i = 0; i < total; i++) {
      const s = document.createElement("div");
      s.className = "mq-slot";
      s.dataset.idx = String(i);
      grid.appendChild(s);
      slots.push(s);
    }
    const gridLabel = document.createElement("div");
    gridLabel.className = "mq-label";
    gridLabel.textContent = "拼到这里";
    const gridBox = document.createElement("div");
    gridBox.className = "mq-grid-box";
    gridBox.appendChild(grid);
    gridBox.appendChild(gridLabel);
    body.appendChild(gridBox);
    wrap.appendChild(body);

    // 碎片托盘
    const tray = document.createElement("div");
    tray.className = "mq-tray";
    const pieces: Cell[] = [];
    shuffle(pattern.map((color, i) => ({ color, idx: i }))).forEach(
      ({ color, idx }) => {
        const el = document.createElement("div");
        el.className = "mq-piece";
        el.style.background = color;
        tray.appendChild(el);
        pieces.push({ id: idx, color, el, placed: false });
      },
    );
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
    pieces.forEach((pc) => this.enableDrag(pc, slots));
  }

  private enableDrag(pc: Cell, slots: HTMLDivElement[]): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (pc.placed) return;
      dragging = true;
      const r = pc.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = pc.el.parentElement;
      pc.el.classList.add("mq-piece--drag");
      pc.el.style.position = "fixed";
      pc.el.style.left = `${p.x - offX}px`;
      pc.el.style.top = `${p.y - offY}px`;
      pc.el.style.width = `${r.width}px`;
      pc.el.style.height = `${r.height}px`;
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
      pc.el.classList.remove("mq-piece--drag");
      // 命中检测
      const slot = slots.find((s) => {
        if (s.classList.contains("mq-slot--filled")) return false;
        const r = s.getBoundingClientRect();
        return (
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
        );
      });
      if (slot && Number(slot.dataset.idx) === pc.id) {
        // 正确：嵌入槽
        pc.placed = true;
        pc.el.remove();
        slot.classList.add("mq-slot--filled");
        slot.style.background = pc.color;
        const r = slot.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        this.remaining -= 1;
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
        // 错误：归位
        pc.el.style.position = "";
        pc.el.style.left = "";
        pc.el.style.top = "";
        pc.el.style.width = "";
        pc.el.style.height = "";
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
      body: "先看左边的小图，再找颜色一样的格子放～",
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
    if (document.getElementById("mq-style")) return;
    const st = document.createElement("style");
    st.id = "mq-style";
    st.textContent = MQ_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function MQ_CSS(theme: string): string {
  return `
.mq-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.mq-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.mq-task b{color:${theme};}
.mq-body{display:flex;gap:24px;align-items:flex-start;justify-content:center;flex-wrap:wrap;}
.mq-preview-box,.mq-grid-box{display:flex;flex-direction:column;align-items:center;gap:6px;}
.mq-preview{display:grid;gap:3px;width:96px;height:96px;padding:5px;background:#fff;border-radius:10px;box-shadow:var(--shadow);}
.mq-preview-cell{border-radius:4px;}
.mq-grid{display:grid;gap:5px;width:min(260px,60vw);aspect-ratio:1;padding:8px;background:rgba(255,255,255,.55);border-radius:14px;box-shadow:var(--shadow);}
.mq-slot{background:#fff;border:2px dashed ${theme}66;border-radius:8px;transition:background .2s ease,transform .2s ease;}
.mq-slot--filled{border-style:solid;border-color:transparent;animation:mq-pop .35s ease;}
.mq-label{font-size:.85rem;font-weight:700;color:#777;}
.mq-tray{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding:12px;background:rgba(255,255,255,.45);border-radius:16px;box-shadow:var(--shadow);min-height:56px;max-width:480px;}
.mq-piece{width:46px;height:46px;border-radius:10px;cursor:grab;touch-action:none;box-shadow:inset 0 -3px 5px rgba(0,0,0,.18),0 3px 5px rgba(0,0,0,.18);filter:brightness(1.05);}
.mq-piece--drag{cursor:grabbing;transform:scale(1.12);z-index:100;box-shadow:0 8px 18px rgba(0,0,0,.3);}
@keyframes mq-pop{0%{transform:scale(.6)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
@media (max-width:380px){.mq-body{gap:14px;}.mq-preview{width:80px;height:80px;}.mq-piece{width:40px;height:40px;}}
`;
}

export function create(): MosaicGame {
  return new MosaicGame();
}
