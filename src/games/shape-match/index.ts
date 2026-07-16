/* 形状配对 Shape Match —— 把形状拖到对应凹槽，配对成功"长出"小动物。
   巧思：拼图式磁吸 + 配对成功变身可爱动物 + 难度递增形状种类。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 形状定义：SVG path + 配对后变成的动物。 */
interface Shape {
  id: string;
  name: string;
  /** 绘制函数：返回 SVG innerHTML */
  draw: (size: number) => string;
  animal: string;
}

const SHAPES: Shape[] = [
  {
    id: "circle",
    name: "圆形",
    animal: "🐱",
    draw: (s) => `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 4}" />`,
  },
  {
    id: "square",
    name: "方形",
    animal: "🐶",
    draw: (s) =>
      `<rect x="4" y="4" width="${s - 8}" height="${s - 8}" rx="8" />`,
  },
  {
    id: "triangle",
    name: "三角形",
    animal: "🦊",
    draw: (s) => `<polygon points="${s / 2},6 ${s - 6},${s - 6} 6,${s - 6}" />`,
  },
  { id: "star", name: "星形", animal: "⭐", draw: (s) => starPath(s) },
  { id: "heart", name: "心形", animal: "🐰", draw: (s) => heartPath(s) },
  {
    id: "diamond",
    name: "菱形",
    animal: "🐧",
    draw: (s) =>
      `<polygon points="${s / 2},6 ${s - 6},${s / 2} ${s / 2},${s - 6} 6,${s / 2}" />`,
  },
];

function starPath(s: number): string {
  const pts: string[] = [];
  const cx = s / 2,
    cy = s / 2,
    outer = s / 2 - 4,
    inner = outer * 0.45;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
  }
  return `<polygon points="${pts.join(" ")}" />`;
}

function heartPath(s: number): string {
  const k = s / 32;
  const cx = 16 * k;
  return `<path d="M ${cx} ${28 * k} C ${4 * k} ${16 * k}, ${4 * k} ${6 * k}, ${cx} ${14 * k} C ${28 * k} ${6 * k}, ${28 * k} ${16 * k}, ${cx} ${28 * k} Z" transform="translate(${4 * k},${-2 * k})" />`;
}

const SHAPE_SIZE = 84;

interface ActiveShape {
  shape: Shape;
  el: HTMLElement;
  slotIndex: number; // 应放入的凹槽索引
  placed: boolean;
}

export class ShapeMatchGame extends BaseGame {
  constructor() {
    super("shape-match");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];

  protected mount(): void {
    this.roundTotal = this.roundsPerClear();
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private roundsPerClear(): number {
    return this.difficulty === "hard" ? 4 : 3;
  }

  private shapesPerRound(): number {
    if (this.difficulty === "easy") return 3;
    if (this.difficulty === "medium") return 4;
    return 6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const count = this.shapesPerRound();
    const picked = shuffle(SHAPES).slice(0, count);
    const slots = shuffle(picked); // 凹槽顺序打乱

    const wrap = document.createElement("div");
    wrap.className = "sm-wrap";

    const task = document.createElement("div");
    task.className = "sm-task";
    task.textContent = `把形状放进对应的洞洞里～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    /* —— 凹槽区 —— */
    const slotArea = document.createElement("div");
    slotArea.className = "sm-slots";
    const slotEls: HTMLElement[] = [];
    slots.forEach((sh) => {
      const slot = document.createElement("div");
      slot.className = "sm-slot";
      slot.dataset.shapeId = sh.id;
      slot.innerHTML = `<svg viewBox="0 0 ${SHAPE_SIZE} ${SHAPE_SIZE}" width="${SHAPE_SIZE}" height="${SHAPE_SIZE}">${sh.draw(SHAPE_SIZE)}</svg>`;
      slotArea.appendChild(slot);
      slotEls.push(slot);
    });
    wrap.appendChild(slotArea);

    /* —— 形状区（待拖拽）—— */
    const shapeArea = document.createElement("div");
    shapeArea.className = "sm-shapes";
    wrap.appendChild(shapeArea);

    this.root.appendChild(wrap);

    const active: ActiveShape[] = [];
    picked.forEach((sh) => {
      const targetSlotIdx = slots.findIndex((s) => s.id === sh.id);
      const piece = document.createElement("div");
      piece.className = "sm-piece";
      piece.innerHTML = `<svg viewBox="0 0 ${SHAPE_SIZE} ${SHAPE_SIZE}" width="${SHAPE_SIZE}" height="${SHAPE_SIZE}">${sh.draw(SHAPE_SIZE)}</svg>`;
      shapeArea.appendChild(piece);
      const a: ActiveShape = {
        shape: sh,
        el: piece,
        slotIndex: targetSlotIdx,
        placed: false,
      };
      active.push(a);
      this.enableDrag(a, slotEls, active);
    });
  }

  /** 给一个形状启用拖拽。 */
  private enableDrag(
    a: ActiveShape,
    slots: HTMLElement[],
    all: ActiveShape[],
  ): void {
    const piece = a.el;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    let originParent: HTMLElement | null = null;

    const onDown = (p: { x: number; y: number }) => {
      if (a.placed) return;
      dragging = true;
      const rect = piece.getBoundingClientRect();
      offsetX = p.x - rect.left;
      offsetY = p.y - rect.top;
      originParent = piece.parentElement;
      piece.classList.add("sm-piece--dragging");
      piece.style.position = "fixed";
      piece.style.left = `${p.x - offsetX}px`;
      piece.style.top = `${p.y - offsetY}px`;
      piece.style.zIndex = "1000";
      document.body.appendChild(piece);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      piece.style.left = `${p.x - offsetX}px`;
      piece.style.top = `${p.y - offsetY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      piece.classList.remove("sm-piece--dragging");
      const targetSlot = slots[a.slotIndex]!;
      const sr = targetSlot.getBoundingClientRect();
      const inside =
        p.x >= sr.left && p.x <= sr.right && p.y >= sr.top && p.y <= sr.bottom;
      if (inside) {
        this.placeCorrect(a, targetSlot);
        this.checkRoundComplete(all);
      } else {
        // 归位
        piece.style.position = "";
        piece.style.left = "";
        piece.style.top = "";
        piece.style.zIndex = "";
        originParent?.appendChild(piece);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };

    const unbind = bindPointer(piece, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(unbind);
  }

  private placeCorrect(a: ActiveShape, slot: HTMLElement): void {
    a.placed = true;
    a.el.remove();
    slot.classList.add("sm-slot--done");
    const r = slot.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    slot.innerHTML = `<div class="sm-animal">${a.shape.animal}</div>`;
    this.resetWrongStreak();
  }

  private checkRoundComplete(all: ActiveShape[]): void {
    if (all.every((a) => a.placed)) {
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "慢慢来，不着急～让小手歇一歇。",
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
    if (document.getElementById("sm-style")) return;
    const st = document.createElement("style");
    st.id = "sm-style";
    st.textContent = SM_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function SM_CSS(theme: string): string {
  return `
.sm-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.sm-task{font-size:1.15rem;font-weight:800;}
.sm-slots{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:24px;box-shadow:var(--shadow);}
.sm-slot{width:${SHAPE_SIZE}px;height:${SHAPE_SIZE}px;display:flex;align-items:center;justify-content:center;border-radius:14px;}
.sm-slot svg{fill:none;stroke:${theme};stroke-width:4;stroke-dasharray:8 6;opacity:.55;transition:all .3s;}
.sm-slot--done{animation:sm-pop .4s ease;}
.sm-slot--done svg{display:none;}
.sm-animal{font-size:3rem;animation:sm-wiggle .6s ease;}
.sm-shapes{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;min-height:90px;padding:10px;}
.sm-piece{width:${SHAPE_SIZE}px;height:${SHAPE_SIZE}px;display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;transition:transform .1s;}
.sm-piece svg{fill:${theme};stroke:#fff;stroke-width:3;filter:drop-shadow(0 4px 6px rgba(0,0,0,.2));}
.sm-piece--dragging{cursor:grabbing;transform:scale(1.1);}
@keyframes sm-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes sm-wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}
`;
}

export function create(): ShapeMatchGame {
  return new ShapeMatchGame();
}
