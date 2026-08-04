/* 彩窗拼图 Stained Glass —— 一个彩色窗户图案被分成几块碎片散在下方，
   孩子把碎片拖到窗框里对应颜色的位置，拼出完整的彩色窗户。
   独特点：颜色 + 形状定位，窗框有黑色铅条勾边（教堂彩窗质感）。
   视觉：彩色几何碎片 + 窗框轮廓（带空槽）。难度=碎片数。
   通关=拼对目标轮数。用 bindPointer 拖拽。前缀 sg-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Piece {
  /** 颜色键（配对依据） */
  key: string;
  /** 颜色 hex */
  hex: string;
  /** 形状名（视觉差异，仅装饰；配对只看 key） */
  shape: "circle" | "diamond" | "hex" | "tri";
}

const COLOR_POOL = [
  { key: "red", hex: "#ef5350" },
  { key: "blue", hex: "#42a5f5" },
  { key: "yellow", hex: "#ffca28" },
  { key: "green", hex: "#66bb6a" },
  { key: "purple", hex: "#ab47bc" },
  { key: "orange", hex: "#ff9f43" },
];
const SHAPES: Piece["shape"][] = ["circle", "diamond", "hex", "tri"];

/** 把碎片渲染成 SVG（填充 + 黑铅条边）。size 正方形。 */
function pieceSVG(p: Piece, size: number): string {
  const c = size / 2;
  const r = size * 0.42;
  let path = "";
  switch (p.shape) {
    case "circle":
      path = `M ${c} ${c - r} A ${r} ${r} 0 1 0 ${c} ${c + r} A ${r} ${r} 0 1 0 ${c} ${c - r} Z`;
      break;
    case "diamond":
      path = `M ${c} ${c - r} L ${c + r} ${c} L ${c} ${c + r} L ${c - r} ${c} Z`;
      break;
    case "hex": {
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(`${c + r * Math.cos(a)} ${c + r * Math.sin(a)}`);
      }
      path = `M ${pts.join(" L ")} Z`;
      break;
    }
    case "tri":
      path = `M ${c} ${c - r} L ${c + r} ${c + r * 0.7} L ${c - r} ${c + r * 0.7} Z`;
      break;
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="sg-svg" aria-hidden="true">
    <path d="${path}" fill="${p.hex}" fill-opacity=".9" stroke="#2b2b2b" stroke-width="3" stroke-linejoin="round"/>
    <path d="${path}" fill="#fff" opacity=".18" transform="scale(.7) translate(${((size * 0.3) / 2) * (1 / 0.7 - 1) + 0},${((size * 0.3) / 2) * (1 / 0.7 - 1)})"/>
  </svg>`;
}

interface DragPiece {
  piece: Piece;
  el: HTMLElement;
  placed: boolean;
}

export class StainedGlassGame extends BaseGame {
  constructor() {
    super("stained-glass");
  }

  private unbinds: (() => void)[] = [];
  private slots: Record<string, HTMLElement> = {};
  private pieces: DragPiece[] = [];
  private remaining = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

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
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 6;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.slots = {};
    this.pieces = [];
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.pieceCount();
    // 选 n 种颜色，每种一片（保证颜色唯一可配对、可解）
    const colors = shuffle(COLOR_POOL).slice(0, n);
    const pieces: Piece[] = colors.map((c, i) => ({
      key: c.key,
      hex: c.hex,
      shape: SHAPES[i % SHAPES.length]!,
    }));

    const wrap = document.createElement("div");
    wrap.className = "sg-wrap";

    const task = document.createElement("div");
    task.className = "sg-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把<b>彩色碎片</b>拖到窗框里同色的位置，拼出彩窗 🪟`;
    wrap.appendChild(task);

    // 窗框（带空槽）
    const frame = document.createElement("div");
    frame.className = "sg-frame";
    const grid = document.createElement("div");
    grid.className = "sg-grid";
    pieces.forEach((p) => {
      const slot = document.createElement("div");
      slot.className = "sg-slot";
      slot.dataset.key = p.key;
      slot.style.setProperty("--sg-c", p.hex);
      slot.innerHTML = `<span class="sg-slot__hint">？</span>`;
      grid.appendChild(slot);
      this.slots[p.key] = slot;
    });
    frame.appendChild(grid);
    wrap.appendChild(frame);

    // 碎片托盘（打乱）
    const tray = document.createElement("div");
    tray.className = "sg-tray";
    const shuffled = shuffle(pieces);
    shuffled.forEach((p) => {
      const el = document.createElement("div");
      el.className = "sg-piece";
      el.innerHTML = pieceSVG(p, 56);
      tray.appendChild(el);
      const dp: DragPiece = { piece: p, el, placed: false };
      this.pieces.push(dp);
      this.enableDrag(dp);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
    this.remaining = this.pieces.length;
  }

  private enableDrag(dp: DragPiece): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (dp.placed || this.locked) return;
      dragging = true;
      const r = dp.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = dp.el.parentElement;
      dp.el.classList.add("sg-piece--drag");
      dp.el.style.position = "fixed";
      dp.el.style.left = `${p.x - offX}px`;
      dp.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(dp.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dp.el.style.left = `${p.x - offX}px`;
      dp.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      dp.el.classList.remove("sg-piece--drag");
      // 命中检测：指针落在哪个空槽
      let hitKey: string | null = null;
      for (const k of Object.keys(this.slots)) {
        const slot = this.slots[k]!;
        if (slot.classList.contains("sg-slot--filled")) continue;
        const r = slot.getBoundingClientRect();
        if (
          p.x >= r.left &&
          p.x <= r.right &&
          p.y >= r.top &&
          p.y <= r.bottom
        ) {
          hitKey = k;
          break;
        }
      }
      if (hitKey !== null && hitKey === dp.piece.key) {
        // 嵌入槽位
        dp.placed = true;
        dp.el.style.position = "";
        dp.el.style.left = "";
        dp.el.style.top = "";
        const slot = this.slots[hitKey]!;
        slot.classList.add("sg-slot--filled");
        slot.innerHTML = "";
        dp.el.classList.add("sg-piece--in");
        slot.appendChild(dp.el);
        this.remaining -= 1;
        const r = slot.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        if (this.remaining <= 0) {
          this.locked = true;
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
        // 归位
        dp.el.style.position = "";
        dp.el.style.left = "";
        dp.el.style.top = "";
        origin?.appendChild(dp.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(dp.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🪟",
      variant: "rest",
      body: "看看碎片的颜色，找窗框里一样颜色的空位哦～",
      primary: { text: "继续", icon: "🌈", onClick: () => ov.destroy() },
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
    if (document.getElementById("sg-style")) return;
    const st = document.createElement("style");
    st.id = "sg-style";
    st.textContent = SG_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function SG_CSS(theme: string): string {
  return `
.sg-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.sg-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.sg-task b{color:${theme};}
.sg-frame{padding:14px;border-radius:20px;background:linear-gradient(135deg,#3a3a4a,#222230);box-shadow:var(--shadow),inset 0 0 0 4px #1a1a24;}
.sg-grid{display:grid;grid-template-columns:repeat(3,90px);gap:8px;padding:6px;background:#1a1a24;border-radius:12px;}
.sg-slot{width:90px;height:90px;border-radius:8px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.06) 0 6px,transparent 6px 12px);border:3px solid #0d0d14;display:flex;align-items:center;justify-content:center;position:relative;}
.sg-slot--filled{background:transparent;border:none;animation:sg-glow .6s ease;}
@keyframes sg-glow{0%{filter:brightness(1.6)}100%{filter:brightness(1)}}
.sg-slot__hint{font-size:1.6rem;font-weight:900;color:var(--sg-c,#fff);opacity:.5;}
.sg-tray{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:16px;background:rgba(255,255,255,.7);border-radius:22px;box-shadow:var(--shadow);max-width:520px;min-height:76px;}
.sg-piece{cursor:grab;touch-action:none;user-select:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.3));transition:transform .12s;}
.sg-piece:active{transform:scale(1.1);}
.sg-piece--drag{cursor:grabbing;transform:scale(1.2);z-index:100;}
.sg-piece--in{animation:sg-snap .4s ease;cursor:default;}
.sg-piece--in .sg-svg{width:70px;height:70px;}
@keyframes sg-snap{0%{transform:scale(1.25)}60%{transform:scale(.85)}100%{transform:scale(1)}}
@media (max-width:380px){.sg-grid{grid-template-columns:repeat(3,72px);}.sg-slot{width:72px;height:72px;}}
`;
}

export function create(): StainedGlassGame {
  return new StainedGlassGame();
}
