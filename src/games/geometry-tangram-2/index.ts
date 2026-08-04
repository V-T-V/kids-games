/* 进阶七巧板 Geometry Tangram 2 —— 比基础 tangram 更复杂的图案，
   用更多形状块（三角/方/圆/六边/星/心/菱形/梯形）拼到对应轮廓内。
   独特点：块种类更丰富，轮廓按图案分组排列，拼对后整体点亮。
   视觉：彩色形状块 + 灰色轮廓凹槽。难度 = 块数。通关 = 拼对目标轮数。
   注意 CSS 前缀 gt2-（tangram=tg-, 不冲突）。
   用 bindPointer 拖拽。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const SHAPES = [
  { id: "tri", icon: "🔺", color: "#ff6b9d" },
  { id: "tri2", icon: "🔻", color: "#4d96ff" },
  { id: "sq", icon: "⬛", color: "#6bcf7f" },
  { id: "circle", icon: "🔴", color: "#ffd93d" },
  { id: "hex", icon: "🟡", color: "#a55eea" },
  { id: "star", icon: "⭐", color: "#ff9f43" },
  { id: "heart", icon: "💚", color: "#22d3ee" },
  { id: "diamond", icon: "🔹", color: "#ff6348" },
];

interface Piece {
  id: string;
  icon: string;
  color: string;
  el: HTMLElement;
  placed: boolean;
}

export class GeometryTangram2Game extends BaseGame {
  constructor() {
    super("geometry-tangram-2");
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

  private pieceCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds = [];
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = this.pieceCount();
    // 允许重复形状（更复杂图案）
    let picked = shuffle(SHAPES).slice(0, Math.min(n, SHAPES.length));
    while (picked.length < n) {
      picked = [...picked, ...shuffle(SHAPES).slice(0, n - picked.length)];
    }
    picked = picked.slice(0, n);
    this.remaining = n;

    const wrap = document.createElement("div");
    wrap.className = "gt2-wrap";

    const task = document.createElement("div");
    task.className = "gt2-task";
    task.innerHTML = `把彩块拖到同形状的灰影子里 · 第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关`;
    wrap.appendChild(task);

    // 轮廓区（按图案排列，每行最多 4 个）
    const outline = document.createElement("div");
    outline.className = "gt2-outline";
    const slots: HTMLDivElement[] = [];
    shuffle(picked).forEach((p) => {
      const s = document.createElement("div");
      s.className = "gt2-slot";
      s.dataset.id = p.id;
      // 用 data-seq 区分同形状的多个槽（按出现顺序匹配）
      s.dataset.seq = String(slots.length);
      s.innerHTML = `<span class="gt2-slot__icon">${p.icon}</span>`;
      outline.appendChild(s);
      slots.push(s);
    });
    wrap.appendChild(outline);

    // 块区
    const tray = document.createElement("div");
    tray.className = "gt2-tray";
    const pieces: Piece[] = [];
    // 块也按序号匹配，避免同形状多块时任意匹配导致逻辑混乱：
    // 这里我们让每个 piece 的"目标"是按形状 id 匹配的任一未填 slot（见 enableDrag）
    shuffle(picked).forEach((p, idx) => {
      const el = document.createElement("div");
      el.className = "gt2-piece";
      el.style.background = p.color;
      el.textContent = p.icon;
      el.dataset.id = p.id;
      el.dataset.seq = String(idx);
      tray.appendChild(el);
      pieces.push({ ...p, el, placed: false });
    });
    wrap.appendChild(tray);
    this.root.appendChild(wrap);

    pieces.forEach((pc) => this.enableDrag(pc, slots));
  }

  private enableDrag(pc: Piece, slots: HTMLDivElement[]): void {
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
      pc.el.classList.add("gt2-piece--drag");
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
      pc.el.classList.remove("gt2-piece--drag");
      // 命中：找同 id 且未填的槽
      const slot = slots.find((s) => {
        if (s.classList.contains("gt2-slot--filled")) return false;
        if (s.dataset.id !== pc.id) return false;
        const r = s.getBoundingClientRect();
        return (
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
        );
      });
      if (slot) {
        pc.placed = true;
        pc.el.remove();
        slot.classList.add("gt2-slot--filled");
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
      body: "比一比形状一样吗？颜色相同也要形状对哦～",
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
    if (document.getElementById("gt2-style")) return;
    const st = document.createElement("style");
    st.id = "gt2-style";
    st.textContent = GT2_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function GT2_CSS(theme: string): string {
  return `
.gt2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.gt2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.gt2-task b{color:${theme};}
.gt2-outline{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;justify-items:center;padding:16px;background:rgba(255,255,255,.5);border-radius:20px;box-shadow:var(--shadow);max-width:420px;}
.gt2-slot{width:70px;height:70px;border-radius:14px;background:#eee;display:flex;align-items:center;justify-content:center;border:3px dashed ${theme}55;transition:transform .2s ease;}
.gt2-slot__icon{font-size:2.2rem;opacity:.28;}
.gt2-slot--filled{border-style:solid;animation:gt2-pop .4s ease;}
.gt2-slot--filled .gt2-slot__icon{opacity:1;}
.gt2-tray{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:12px;background:rgba(255,255,255,.45);border-radius:18px;box-shadow:var(--shadow);max-width:440px;min-height:60px;}
.gt2-piece{width:60px;height:60px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:2rem;cursor:grab;touch-action:none;box-shadow:var(--shadow);filter:brightness(1.05);}
.gt2-piece--drag{cursor:grabbing;transform:scale(1.15);z-index:100;}
@keyframes gt2-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@media (max-width:380px){.gt2-outline{grid-template-columns:repeat(3,1fr);}.gt2-slot{width:60px;height:60px;}.gt2-piece{width:52px;height:52px;font-size:1.7rem;}}
`;
}

export function create(): GeometryTangram2Game {
  return new GeometryTangram2Game();
}
