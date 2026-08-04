/* 数字描红 Number Trace —— Canvas 上数字虚线轮廓，孩子沿虚线描，按偏离度评分。
   独特点：把数字作为参照字形以大字+虚线呈现，孩子在其上描画，覆盖率算星。
   巧思：1-9 单笔画或多笔画数字，适合数字书写启蒙。Canvas 用 c2d。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByRate } from "../../core/scoring.ts";
import { createButton } from "../../ui/Button.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

const W = 320;
const H = 320;

export class NumberTraceGame extends BaseGame {
  constructor() {
    super("number-trace");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private mask!: Uint8Array;
  private covered = 0;
  private totalGlyph = 0;
  private drawing = false;
  private unbind: (() => void) | null = null;
  private currentNum = "1";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbind?.();
    this.unbind = null;
    this.reportProgress(this.roundsDone, this.roundTotal);
    // 1-9，避免 0（太简单）
    this.currentNum = String(randInt(1, 9));
    this.covered = 0;

    const wrap = document.createElement("div");
    wrap.className = "ntr-wrap";
    const task = document.createElement("div");
    task.className = "ntr-task";
    task.textContent = `沿着虚线描数字 ${this.currentNum}（第 ${this.roundsDone + 1}/${this.roundTotal} 个）`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "ntr-canvas";
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.c2d = this.canvas.getContext("2d", { willReadFrequently: true })!;
    this.c2d.scale(dpr, dpr);
    this.buildMaskAndDraw();

    wrap.appendChild(this.canvas);

    const actions = document.createElement("div");
    actions.className = "ntr-actions";
    actions.appendChild(
      createButton({
        text: "重描",
        icon: "🔄",
        variant: "secondary",
        onClick: () => this.startRound(),
      }),
    );
    wrap.appendChild(actions);
    this.root.appendChild(wrap);

    const getPos = (e: { x: number; y: number }) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.x - r.left, y: e.y - r.top };
    };
    this.unbind = bindPointer(this.canvas, {
      down: (p) => {
        this.drawing = true;
        const pos = getPos(p);
        this.c2d.beginPath();
        this.c2d.moveTo(pos.x, pos.y);
        this.mark(pos);
      },
      move: (p) => {
        if (!this.drawing) return;
        const pos = getPos(p);
        this.c2d.strokeStyle = getCssVar("--c-blue");
        this.c2d.lineWidth = 14;
        this.c2d.lineCap = "round";
        this.c2d.lineJoin = "round";
        this.c2d.lineTo(pos.x, pos.y);
        this.c2d.stroke();
        this.mark(pos);
      },
      up: () => {
        this.drawing = false;
        this.checkDone();
      },
    });
  }

  private buildMaskAndDraw(): void {
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const oc = off.getContext("2d", { willReadFrequently: true })!;
    oc.clearRect(0, 0, W, H);
    oc.fillStyle = "#000";
    oc.font = "bold 250px Georgia, serif";
    oc.textAlign = "center";
    oc.textBaseline = "middle";
    oc.fillText(this.currentNum, W / 2, H / 2 + 10);
    const data = oc.getImageData(0, 0, W, H).data;
    this.mask = new Uint8Array(W * H);
    let total = 0;
    for (let i = 0; i < W * H; i++) {
      if (data[i * 4 + 3]! > 40) {
        this.mask[i] = 1;
        total += 1;
      }
    }
    this.totalGlyph = total;

    const c2d = this.c2d;
    c2d.clearRect(0, 0, W, H);
    const grad = c2d.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#f0f8ff");
    grad.addColorStop(1, "#e6f0ff");
    c2d.fillStyle = grad;
    c2d.fillRect(0, 0, W, H);
    c2d.strokeStyle = "#bcd4ff";
    c2d.lineWidth = 1.5;
    c2d.setLineDash([4, 4]);
    [H * 0.2, H * 0.5, H * 0.8].forEach((y) => {
      c2d.beginPath();
      c2d.moveTo(20, y);
      c2d.lineTo(W - 20, y);
      c2d.stroke();
    });
    c2d.setLineDash([]);
    c2d.fillStyle = "#d8e0ee";
    c2d.font = "bold 250px Georgia, serif";
    c2d.textAlign = "center";
    c2d.textBaseline = "middle";
    c2d.strokeStyle = "#7fa8ff";
    c2d.lineWidth = 2;
    c2d.setLineDash([6, 8]);
    c2d.strokeText(this.currentNum, W / 2, H / 2 + 10);
    c2d.setLineDash([]);
  }

  private mark(pos: { x: number; y: number }): void {
    if (this.totalGlyph === 0) return;
    const r = 9;
    const x0 = Math.max(0, Math.floor(pos.x - r));
    const x1 = Math.min(W - 1, Math.ceil(pos.x + r));
    const y0 = Math.max(0, Math.floor(pos.y - r));
    const y1 = Math.min(H - 1, Math.ceil(pos.y + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = y * W + x;
        if (this.mask[idx] === 1) {
          this.mask[idx] = 2;
        }
      }
    }
  }

  private checkDone(): void {
    if (this.drawing) return;
    let coveredNow = 0;
    for (let i = 0; i < this.mask.length; i++) {
      if (this.mask[i] === 2) coveredNow += 1;
    }
    this.covered = coveredNow;
    const ratio = this.totalGlyph > 0 ? this.covered / this.totalGlyph : 0;
    if (ratio < 0.55) return;
    sfxPop();
    const r = this.canvas.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        const stars = starsByRate(Math.round(ratio * 100), 100, [0.85, 0.6]);
        this.finishClear(stars);
      } else {
        this.startRound();
      }
    }, 700);
  }

  private injectStyle(): void {
    if (document.getElementById("ntr-style")) return;
    const st = document.createElement("style");
    st.id = "ntr-style";
    st.textContent = NTR_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function NTR_CSS(_theme: string): string {
  return `
.ntr-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(380px,100%);}
.ntr-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ntr-canvas{background:#fff;border-radius:22px;box-shadow:var(--shadow);touch-action:none;cursor:crosshair;max-width:100%;height:auto;}
.ntr-actions{display:flex;gap:12px;}
`;
}

export function create(): NumberTraceGame {
  return new NumberTraceGame();
}
