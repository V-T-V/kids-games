/* 字母描红 Letter Trace —— Canvas 上字母虚线轮廓，孩子沿虚线描，按偏离度评分。
   独特点：把字母作为"参照字形"以大字+虚线描绘，孩子在其上描画，偏离度算星。
   巧思：用 canvas 测量孩子笔画在字形像素上的覆盖率（描红覆盖率）。Canvas 用 c2d。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByRate } from "../../core/scoring.ts";
import { createButton } from "../../ui/Button.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

const W = 320;
const H = 320;

const LETTERS = ["A", "B", "C", "D", "E", "L", "M", "O", "T", "V", "W", "X"];

export class LetterTraceGame extends BaseGame {
  constructor() {
    super("letter-trace");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  // 字形掩码：1=字形像素
  private mask!: Uint8Array;
  private covered = 0;
  private totalGlyph = 0;
  private drawing = false;
  private unbind: (() => void) | null = null;
  private currentLetter = "";

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
    this.currentLetter = sample(LETTERS);
    this.covered = 0;

    const wrap = document.createElement("div");
    wrap.className = "ltr-wrap";
    const task = document.createElement("div");
    task.className = "ltr-task";
    task.textContent = `沿着虚线描字母 ${this.currentLetter}（第 ${this.roundsDone + 1}/${this.roundTotal} 个）`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "ltr-canvas";
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
    actions.className = "ltr-actions";
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
        this.c2d.strokeStyle = getCssVar("--c-red");
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

  /** 先把字形画到掩码画布，再画虚线字形到主画布。 */
  private buildMaskAndDraw(): void {
    // 用离屏 canvas 测量字形像素
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const oc = off.getContext("2d", { willReadFrequently: true })!;
    oc.clearRect(0, 0, W, H);
    oc.fillStyle = "#000";
    oc.font = "bold 240px Georgia, serif";
    oc.textAlign = "center";
    oc.textBaseline = "middle";
    oc.fillText(this.currentLetter, W / 2, H / 2 + 10);
    const data = oc.getImageData(0, 0, W, H).data;
    this.mask = new Uint8Array(W * H);
    let total = 0;
    for (let i = 0; i < W * H; i++) {
      if (data[i * 4 + 3]! > 40) {
        // alpha 通道
        this.mask[i] = 1;
        total += 1;
      }
    }
    this.totalGlyph = total;

    // 主画布：背景 + 虚线字形
    const c2d = this.c2d;
    c2d.clearRect(0, 0, W, H);
    const grad = c2d.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#fff8f0");
    grad.addColorStop(1, "#fff0f5");
    c2d.fillStyle = grad;
    c2d.fillRect(0, 0, W, H);
    // 三条书写辅助线
    c2d.strokeStyle = "#ffd1dc";
    c2d.lineWidth = 1.5;
    c2d.setLineDash([4, 4]);
    [H * 0.2, H * 0.5, H * 0.8].forEach((y) => {
      c2d.beginPath();
      c2d.moveTo(20, y);
      c2d.lineTo(W - 20, y);
      c2d.stroke();
    });
    c2d.setLineDash([]);
    // 虚线字形
    c2d.fillStyle = "#d8d8e8";
    c2d.font = "bold 240px Georgia, serif";
    c2d.textAlign = "center";
    c2d.textBaseline = "middle";
    // 描边虚线呈现
    c2d.strokeStyle = "#b9a7e8";
    c2d.lineWidth = 2;
    c2d.setLineDash([6, 8]);
    c2d.strokeText(this.currentLetter, W / 2, H / 2 + 10);
    c2d.setLineDash([]);
  }

  /** 标记孩子描画覆盖到的字形像素（在画笔半径范围内）。 */
  private mark(pos: { x: number; y: number }): void {
    if (this.totalGlyph === 0) return;
    const r = 9; // 画笔影响半径
    const x0 = Math.max(0, Math.floor(pos.x - r));
    const x1 = Math.min(W - 1, Math.ceil(pos.x + r));
    const y0 = Math.max(0, Math.floor(pos.y - r));
    const y1 = Math.min(H - 1, Math.ceil(pos.y + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = y * W + x;
        if (this.mask[idx] === 1) {
          this.mask[idx] = 2; // 已覆盖
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
    // 描红覆盖率 >= 0.55 视为完成
    if (ratio < 0.55) return;
    sfxPop();
    const r = this.canvas.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        // 综合覆盖率算星
        const stars = starsByRate(Math.round(ratio * 100), 100, [0.85, 0.6]);
        this.finishClear(stars);
      } else {
        this.startRound();
      }
    }, 700);
  }

  private injectStyle(): void {
    if (document.getElementById("ltr-style")) return;
    const st = document.createElement("style");
    st.id = "ltr-style";
    st.textContent = LTR_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function LTR_CSS(_theme: string): string {
  return `
.ltr-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(380px,100%);}
.ltr-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ltr-canvas{background:#fff;border-radius:22px;box-shadow:var(--shadow);touch-action:none;cursor:crosshair;max-width:100%;height:auto;}
.ltr-actions{display:flex;gap:12px;}
`;
}

export function create(): LetterTraceGame {
  return new LetterTraceGame();
}
