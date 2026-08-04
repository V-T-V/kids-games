/* 形状造物 Shape Builder —— 给几个基本形状，孩子拖到轮廓里拼出图案（房子/火箭/小车）。
   独特点：创造 + 空间组合。区别于 tangram（七巧板）、3d-shape（立体认知）。
   视觉：彩色形状块 + 半透明目标轮廓。难度 = 形状数。通关 = 拼对目标轮数。
   用 bindPointer 拖拽。CSS 前缀 sb2-（避免与 spin-bottle 的 sb- 冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Piece {
  /** 形状键：tri / sq / circ / rect */
  shape: "tri" | "sq" | "circ" | "rect";
  color: string;
  el: HTMLElement;
  placed: boolean;
}

interface Slot {
  shape: Piece["shape"];
  el: HTMLElement;
  filled: boolean;
}

interface Pattern {
  name: string;
  emoji: string;
  /** 槽位定义：相对画板中心的 x/y 偏移（px）+ 形状 + 大小 */
  slots: { shape: Piece["shape"]; x: number; y: number; size: number }[];
}

const PATTERNS: Pattern[] = [
  {
    name: "小房子",
    emoji: "🏠",
    slots: [
      { shape: "sq", x: 0, y: 30, size: 70 },
      { shape: "tri", x: 0, y: -35, size: 90 },
    ],
  },
  {
    name: "小汽车",
    emoji: "🚗",
    slots: [
      { shape: "rect", x: 0, y: 0, size: 110 },
      { shape: "circ", x: -28, y: 36, size: 28 },
      { shape: "circ", x: 28, y: 36, size: 28 },
    ],
  },
  {
    name: "小火箭",
    emoji: "🚀",
    slots: [
      { shape: "tri", x: 0, y: -50, size: 70 },
      { shape: "rect", x: 0, y: 10, size: 70 },
      { shape: "circ", x: 0, y: 10, size: 24 },
    ],
  },
  {
    name: "雪人",
    emoji: "⛄",
    slots: [
      { shape: "circ", x: 0, y: -35, size: 40 },
      { shape: "circ", x: 0, y: 30, size: 64 },
      { shape: "tri", x: 0, y: -35, size: 20 },
    ],
  },
];

const SHAPE_COLOR: Record<Piece["shape"], string> = {
  tri: "#ff6348",
  sq: "#4d96ff",
  circ: "#ffd93d",
  rect: "#6bcf7f",
};

export class ShapeBuilderGame extends BaseGame {
  constructor() {
    super("shape-builder");
  }
  private unbinds: (() => void)[] = [];
  private slots: Slot[] = [];
  private pieces: Piece[] = [];
  private remaining = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

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

  /** 根据难度挑选图案池（easy：2 槽；medium：3 槽；hard：3 槽含难图案）。 */
  private pickPattern(): Pattern {
    const pool = PATTERNS.filter((p) => {
      if (this.difficulty === "easy") return p.slots.length <= 2;
      return true;
    });
    return shuffle(pool)[0]!;
  }

  private startRound(): void {
    this.answered = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.slots = [];
    this.pieces = [];
    this.root.innerHTML = "";

    const pat = this.pickPattern();
    this.remaining = pat.slots.length;

    const wrap = document.createElement("div");
    wrap.className = "sb2-wrap";
    const task = document.createElement("div");
    task.className = "sb2-task";
    task.textContent = `用形状拼出一个${pat.name} ${pat.emoji}～拖到虚线框里（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 拼装板（轮廓区）
    const board = document.createElement("div");
    board.className = "sb2-board";
    board.id = "sb2-board";
    pat.slots.forEach((s, i) => {
      const slot = document.createElement("div");
      slot.className = `sb2-slot sb2-shape--${s.shape}`;
      slot.style.left = `calc(50% + ${s.x}px)`;
      slot.style.top = `calc(50% + ${s.y}px)`;
      slot.style.width = `${s.size}px`;
      slot.style.height = `${s.shape === "rect" ? s.size * 0.7 : s.size}px`;
      slot.dataset.shape = s.shape;
      slot.dataset.idx = String(i);
      board.appendChild(slot);
      this.slots.push({ shape: s.shape, el: slot, filled: false });
    });
    wrap.appendChild(board);

    // 形状块区（打乱顺序）
    const tray = document.createElement("div");
    tray.className = "sb2-tray";
    const colorOrder = shuffle(pat.slots.map((s) => s.shape));
    colorOrder.forEach((shape, i) => {
      const el = document.createElement("div");
      const size = pat.slots.find((s) => s.shape === shape)!.size;
      el.className = `sb2-piece sb2-shape--${shape}`;
      el.style.width = `${size}px`;
      el.style.height = `${shape === "rect" ? size * 0.7 : size}px`;
      el.style.background = SHAPE_COLOR[shape]!;
      el.dataset.shape = shape;
      tray.appendChild(el);
      const piece: Piece = {
        shape,
        color: SHAPE_COLOR[shape]!,
        el,
        placed: false,
      };
      this.pieces.push(piece);
      this.enableDrag(piece, i);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private enableDrag(piece: Piece, _idx: number): void {
    let dragging = false;
    let offX = 0,
      offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (piece.placed) return;
      dragging = true;
      const r = piece.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = piece.el.parentElement;
      piece.el.classList.add("sb2-piece--drag");
      piece.el.style.position = "fixed";
      piece.el.style.left = `${p.x - offX}px`;
      piece.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(piece.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      piece.el.style.left = `${p.x - offX}px`;
      piece.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      piece.el.classList.remove("sb2-piece--drag");
      // 找最近的匹配且未填充的槽
      let best: { slot: Slot; dist: number } | null = null;
      for (const slot of this.slots) {
        if (slot.filled) continue;
        if (slot.shape !== piece.shape) continue;
        const r = slot.el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(p.x - cx, p.y - cy);
        if (!best || dist < best.dist) best = { slot, dist };
      }
      if (best && best.dist < 70) {
        const slot = best.slot;
        slot.filled = true;
        piece.placed = true;
        // 把形状块吸附到槽位
        slot.el.classList.add("sb2-slot--filled");
        slot.el.style.background = piece.color;
        piece.el.remove();
        this.remaining -= 1;
        const r = slot.el.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        if (this.remaining <= 0) {
          this.answered = true;
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 1100);
        }
      } else {
        // 归位
        piece.el.style.position = "";
        piece.el.style.left = "";
        piece.el.style.top = "";
        origin?.appendChild(piece.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(piece.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看形状和虚线框是不是一样的形状～",
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
    if (document.getElementById("sb2-style")) return;
    const st = document.createElement("style");
    st.id = "sb2-style";
    st.textContent = SB2_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function SB2_CSS(theme: string): string {
  return `
.sb2-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(520px,100%);}
.sb2-task{font-size:1.1rem;font-weight:800;text-align:center;}
.sb2-board{position:relative;width:300px;height:300px;background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(165,94,234,.1));border-radius:24px;box-shadow:var(--shadow);overflow:hidden;}
.sb2-tray{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;min-height:80px;padding:12px;background:rgba(255,255,255,.55);border-radius:18px;}
/* 通用形状基础 */
.sb2-slot{position:absolute;transform:translate(-50%,-50%);border:3px dashed ${theme};background:rgba(165,94,234,.06);transition:background .25s ease,transform .2s ease;}
.sb2-piece{cursor:grab;touch-action:none;box-shadow:0 4px 10px rgba(0,0,0,.18);transition:transform .12s ease;}
.sb2-piece--drag{cursor:grabbing;transform:scale(1.12);z-index:100;opacity:.95;}
/* 三角形：用 clip-path */
.sb2-shape--tri{clip-path:polygon(50% 0,100% 100%,0 100%);border:none;background:${theme};}
.sb2-shape--tri.sb2-slot{background:rgba(165,94,234,.12);border:none;}
/* 圆 */
.sb2-shape--circ{border-radius:50%;}
/* 正方 */
.sb2-shape--sq{border-radius:8px;}
/* 长方 */
.sb2-shape--rect{border-radius:8px;}
.sb2-slot--filled{border-style:solid;box-shadow:0 0 0 4px #fff inset,0 6px 14px rgba(0,0,0,.2);animation:sb2-pop .35s ease;}
@keyframes sb2-pop{0%{transform:translate(-50%,-50%) scale(.7)}60%{transform:translate(-50%,-50%) scale(1.12)}100%{transform:translate(-50%,-50%) scale(1)}}
@media (max-width:380px){.sb2-board{width:260px;height:260px;}}
`;
}

export function create(): ShapeBuilderGame {
  return new ShapeBuilderGame();
}
