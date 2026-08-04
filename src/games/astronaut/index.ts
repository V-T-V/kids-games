/* 修飞船 Astronaut —— 飞船缺几个零件（缺口有形状轮廓），把对应形状的零件拖回去。
   独特点：形状配对拖拽 + 太空主题（区别于 shape-builder 的"拼图造物"和 toy-fix 的工具修理）。
   视觉：飞船轮廓 + 零件形状。难度=零件数。通关=修好目标轮数。
   用 bindPointer 拖拽。巧思：缺口形状与零件一一对应，拖错归位提示，拖对吸附。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

type Shape = "tri" | "sq" | "circ" | "rect" | "ring";

interface Part {
  shape: Shape;
  color: string;
  el: HTMLElement;
  placed: boolean;
}

interface Slot {
  shape: Shape;
  el: HTMLElement;
  filled: boolean;
}

interface Blueprint {
  name: string;
  /** 槽位：相对飞船区中心的 x/y 偏移（px）+ 形状 + 大小 */
  slots: { shape: Shape; x: number; y: number; size: number }[];
}

const SHAPE_COLOR: Record<Shape, string> = {
  tri: "#ff6348",
  sq: "#4d96ff",
  circ: "#ffd93d",
  rect: "#6bcf7f",
  ring: "#a55eea",
};

const BLUEPRINTS: Blueprint[] = [
  { name: "探测卫星", slots: [{ shape: "rect", x: 0, y: 0, size: 96 }] },
  {
    name: "登月舱",
    slots: [
      { shape: "circ", x: 0, y: -22, size: 44 },
      { shape: "rect", x: 0, y: 34, size: 80 },
    ],
  },
  {
    name: "空间站",
    slots: [
      { shape: "ring", x: -38, y: 0, size: 46 },
      { shape: "rect", x: 0, y: 0, size: 70 },
      { shape: "ring", x: 38, y: 0, size: 46 },
    ],
  },
  {
    name: "星际飞船",
    slots: [
      { shape: "tri", x: 0, y: -52, size: 60 },
      { shape: "circ", x: 0, y: 0, size: 40 },
      { shape: "sq", x: -34, y: 30, size: 40 },
      { shape: "sq", x: 34, y: 30, size: 40 },
    ],
  },
];

const ENCOURAGE = [
  "修好了！",
  "零件找得真准！",
  "你是小小工程师！",
  "看形状一样再放～",
];

export class AstronautGame extends BaseGame {
  constructor() {
    super("astronaut");
  }

  private unbinds: (() => void)[] = [];
  private slots: Slot[] = [];
  private parts: Part[] = [];
  private remaining = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

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

  private pickBlueprint(): Blueprint {
    const pool = BLUEPRINTS.filter((b) => {
      if (this.difficulty === "easy") return b.slots.length <= 1;
      if (this.difficulty === "medium") return b.slots.length <= 3;
      return true;
    });
    // 优先选与上一轮不同的
    return shuffle(pool)[0]!;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.slots = [];
    this.parts = [];
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const bp = this.pickBlueprint();
    this.remaining = bp.slots.length;

    const wrap = document.createElement("div");
    wrap.className = "ast-wrap";

    const task = document.createElement("div");
    task.className = "ast-task";
    task.textContent = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把零件拖到一样形状的缺口里，修好${bp.name}！`;
    wrap.appendChild(task);

    // 飞船板（缺口区）
    const board = document.createElement("div");
    board.className = "ast-board";
    board.id = "ast-board";
    // 飞船剪影背景
    const ship = document.createElement("div");
    ship.className = "ast-ship";
    ship.textContent = "🛰️";
    board.appendChild(ship);
    bp.slots.forEach((s, i) => {
      const slot = document.createElement("div");
      slot.className = `ast-slot ast-shape--${s.shape}`;
      slot.style.left = `calc(50% + ${s.x}px)`;
      slot.style.top = `calc(50% + ${s.y}px)`;
      slot.style.width = `${s.size}px`;
      const h = s.shape === "rect" ? s.size * 0.62 : s.size;
      slot.style.height = `${h}px`;
      slot.dataset.shape = s.shape;
      slot.dataset.idx = String(i);
      board.appendChild(slot);
      this.slots.push({ shape: s.shape, el: slot, filled: false });
    });
    wrap.appendChild(board);

    // 零件区（打乱）
    const tray = document.createElement("div");
    tray.className = "ast-tray";
    const order = shuffle(bp.slots);
    order.forEach((s) => {
      const el = document.createElement("div");
      el.className = `ast-part ast-shape--${s.shape}`;
      el.style.width = `${s.size}px`;
      const h = s.shape === "rect" ? s.size * 0.62 : s.size;
      el.style.height = `${h}px`;
      el.style.background = SHAPE_COLOR[s.shape]!;
      el.dataset.shape = s.shape;
      tray.appendChild(el);
      const p: Part = {
        shape: s.shape,
        color: SHAPE_COLOR[s.shape]!,
        el,
        placed: false,
      };
      this.parts.push(p);
      this.enableDrag(p);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private enableDrag(p: Part): void {
    let dragging = false;
    let offX = 0,
      offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (pt: { x: number; y: number }) => {
      if (p.placed || this.locked) return;
      dragging = true;
      const r = p.el.getBoundingClientRect();
      offX = pt.x - r.left;
      offY = pt.y - r.top;
      origin = p.el.parentElement;
      p.el.classList.add("ast-part--drag");
      p.el.style.position = "fixed";
      p.el.style.left = `${pt.x - offX}px`;
      p.el.style.top = `${pt.y - offY}px`;
      document.body.appendChild(p.el);
      sfxPop();
    };
    const onMove = (pt: { x: number; y: number }) => {
      if (!dragging) return;
      p.el.style.left = `${pt.x - offX}px`;
      p.el.style.top = `${pt.y - offY}px`;
    };
    const onUp = (pt: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      p.el.classList.remove("ast-part--drag");
      // 找最近匹配且未填充的槽
      let best: { slot: Slot; dist: number } | null = null;
      for (const slot of this.slots) {
        if (slot.filled || slot.shape !== p.shape) continue;
        const r = slot.el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(pt.x - cx, pt.y - cy);
        if (!best || dist < best.dist) best = { slot, dist };
      }
      if (best && best.dist < 70) {
        const slot = best.slot;
        slot.filled = true;
        p.placed = true;
        slot.el.classList.add("ast-slot--filled");
        slot.el.style.background = p.color;
        p.el.remove();
        this.remaining -= 1;
        const r = slot.el.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        if (this.remaining <= 0) {
          this.locked = true;
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 1000);
        }
      } else {
        p.el.style.position = "";
        p.el.style.left = "";
        p.el.style.top = "";
        origin?.appendChild(p.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(p.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🧑‍🚀",
      variant: "rest",
      body: `看看零件和缺口的形状是不是一样的～ ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("ast-style")) return;
    const st = document.createElement("style");
    st.id = "ast-style";
    st.textContent = AS_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function AS_CSS(theme: string): string {
  return `
.ast-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(520px,100%);}
.ast-task{font-size:1.08rem;font-weight:800;text-align:center;line-height:1.4;}
.ast-board{position:relative;width:300px;height:300px;background:radial-gradient(circle at 50% 40%,rgba(99,102,241,.18),rgba(13,27,62,.85));border-radius:24px;box-shadow:var(--shadow);overflow:hidden;}
.ast-ship{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:8rem;opacity:.18;filter:saturate(.6);pointer-events:none;}
.ast-board::before{content:"✨";position:absolute;top:14px;left:24px;font-size:1rem;opacity:.7;}
.ast-board::after{content:"⭐";position:absolute;top:30px;right:30px;font-size:.9rem;opacity:.6;}
.ast-tray{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;min-height:80px;padding:14px;background:rgba(255,255,255,.55);border-radius:18px;}
/* 槽位基础 */
.ast-slot{position:absolute;transform:translate(-50%,-50%);border:3px dashed ${theme};background:rgba(99,102,241,.1);transition:background .25s ease;}
.ast-part{cursor:grab;touch-action:none;box-shadow:0 4px 10px rgba(0,0,0,.25);transition:transform .12s ease;}
.ast-part:active{transform:scale(1.08);}
.ast-part--drag{cursor:grabbing;transform:scale(1.12);z-index:100;opacity:.96;}
/* 形状：三角、圆、正方、长方、环 */
.ast-shape--tri{clip-path:polygon(50% 0,100% 100%,0 100%);background:${theme};}
.ast-shape--tri.ast-slot{background:rgba(99,102,241,.16);border:none;}
.ast-shape--circ{border-radius:50%;}
.ast-shape--sq{border-radius:8px;}
.ast-shape--rect{border-radius:8px;}
.ast-shape--ring{border-radius:50%;background:transparent !important;border:6px solid ${theme} !important;box-sizing:border-box;}
.ast-shape--ring.ast-part{background:${theme} !important;}
.ast-shape--ring.ast-slot{border-style:dashed !important;background:rgba(99,102,241,.06) !important;}
.ast-slot--filled{border-style:solid !important;box-shadow:0 0 0 4px #fff inset,0 6px 14px rgba(0,0,0,.25);animation:ast-pop .35s ease;}
@keyframes ast-pop{0%{transform:translate(-50%,-50%) scale(.7)}60%{transform:translate(-50%,-50%) scale(1.12)}100%{transform:translate(-50%,-50%) scale(1)}}
@media (max-width:380px){.ast-board{width:264px;height:264px;}.ast-ship{font-size:6.5rem;}}
`;
}

export function create(): AstronautGame {
  return new AstronautGame();
}
