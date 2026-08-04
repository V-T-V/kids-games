/* 数字描红 2 Number Trace 2 —— 大数字点阵/虚线轮廓，孩子用手指描，描完点"画好啦"确认。
   独特点：相比 number-trace（1-9 单笔画、按覆盖率自动判定），本作面向 1-20 的完整书写练习，
   孩子主动按"画好啦"自评，鼓励书写自信；点阵字形轮廓 + 彩色描迹。
   巧思：Canvas 字形掩码 + 画笔轨迹叠加，描迹覆盖率做"画好啦"按钮的启用门槛。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByRate } from "../../core/scoring.ts";
import { createButton } from "../../ui/Button.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

const W = 320;
const H = 320;

export class NumberTrace2Game extends BaseGame {
  constructor() {
    super("number-trace-2");
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
  private doneBtn: HTMLButtonElement | null = null;
  private traceColor = "";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    this.unbind?.();
    this.unbind = null;
    this.doneBtn = null;
  }

  private numRange(): [number, number] {
    if (this.difficulty === "easy") return [1, 5];
    if (this.difficulty === "medium") return [1, 10];
    return [1, 20];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbind?.();
    this.unbind = null;
    this.doneBtn = null;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const [minN, maxN] = this.numRange();
    this.currentNum = String(randInt(minN, maxN));
    this.covered = 0;
    // 每轮换一个描迹色，增加趣味
    const palette = ["#ff6b9d", "#4d96ff", "#6bcf7f", "#ff9f43", "#a55eea"];
    this.traceColor = palette[randInt(0, palette.length - 1)]!;

    const wrap = document.createElement("div");
    wrap.className = "nt2-wrap";

    const task = document.createElement("div");
    task.className = "nt2-task";
    task.innerHTML = `用手指描数字 <span class="nt2-num">${this.currentNum}</span>，描好点「画好啦」`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "nt2-canvas";
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
    actions.className = "nt2-actions";
    actions.appendChild(
      createButton({
        text: "重描",
        icon: "🔄",
        variant: "secondary",
        onClick: () => this.startRound(),
      }),
    );
    this.doneBtn = createButton({
      text: "画好啦",
      icon: "✅",
      variant: "primary",
      onClick: () => this.confirmDone(),
    });
    this.doneBtn.classList.add("nt2-done");
    this.doneBtn.disabled = true;
    actions.appendChild(this.doneBtn);
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
        this.c2d.strokeStyle = this.traceColor;
        this.c2d.lineWidth = 16;
        this.c2d.lineCap = "round";
        this.c2d.lineJoin = "round";
        this.c2d.lineTo(pos.x, pos.y);
        this.c2d.stroke();
        this.mark(pos);
      },
      up: () => {
        this.drawing = false;
        this.refreshDoneBtn();
      },
    });
  }

  /** 先把字形画到离屏画布做掩码，再画点阵字形到主画布。 */
  private buildMaskAndDraw(): void {
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const oc = off.getContext("2d", { willReadFrequently: true })!;
    oc.clearRect(0, 0, W, H);
    oc.fillStyle = "#000";
    // 两位数用小一号字号保证塞下
    const fontSize = this.currentNum.length > 1 ? 200 : 240;
    oc.font = `bold ${fontSize}px Georgia, serif`;
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
    grad.addColorStop(0, "#fffdf5");
    grad.addColorStop(1, "#fff4e8");
    c2d.fillStyle = grad;
    c2d.fillRect(0, 0, W, H);

    // 三条书写辅助线
    c2d.strokeStyle = "#ffe0b3";
    c2d.lineWidth = 1.5;
    c2d.setLineDash([4, 4]);
    [H * 0.2, H * 0.5, H * 0.8].forEach((y) => {
      c2d.beginPath();
      c2d.moveTo(20, y);
      c2d.lineTo(W - 20, y);
      c2d.stroke();
    });
    c2d.setLineDash([]);

    // 点阵字形轮廓：沿字形像素稀疏打点，形成"虚线轮廓"视觉
    const glyph = this.mask;
    const step = 6; // 点距，越小越密
    c2d.fillStyle = "#d8c9a8";
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        // 仅在字形边缘附近打点（字形内 + 紧邻外侧）
        let onGlyph = false;
        outer: for (let dy = -step; dy <= step; dy += step) {
          for (let dx = -step; dx <= step; dx += step) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
            if (glyph[yy * W + xx] === 1) {
              onGlyph = true;
              break outer;
            }
          }
        }
        if (onGlyph) {
          c2d.beginPath();
          c2d.arc(x + step / 2, y + step / 2, 1.8, 0, Math.PI * 2);
          c2d.fill();
        }
      }
    }
  }

  private mark(pos: { x: number; y: number }): void {
    if (this.totalGlyph === 0) return;
    const r = 10;
    const x0 = Math.max(0, Math.floor(pos.x - r));
    const x1 = Math.min(W - 1, Math.ceil(pos.x + r));
    const y0 = Math.max(0, Math.floor(pos.y - r));
    const y1 = Math.min(H - 1, Math.ceil(pos.y + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = y * W + x;
        if (this.mask[idx] === 1) this.mask[idx] = 2;
      }
    }
  }

  private refreshDoneBtn(): void {
    let c = 0;
    for (let i = 0; i < this.mask.length; i++) {
      if (this.mask[i] === 2) c += 1;
    }
    this.covered = c;
    const ratio = this.totalGlyph > 0 ? this.covered / this.totalGlyph : 0;
    if (this.doneBtn && ratio >= 0.45) {
      this.doneBtn.disabled = false;
      this.doneBtn.classList.add("nt2-done--ready");
    }
  }

  private confirmDone(): void {
    if (!this.doneBtn || this.doneBtn.disabled) return;
    let coveredNow = 0;
    for (let i = 0; i < this.mask.length; i++) {
      if (this.mask[i] === 2) coveredNow += 1;
    }
    this.covered = coveredNow;
    const ratio =
      this.totalGlyph > 0 ? this.covered / this.totalGlyph : 0;
    sfxPop();
    const r = this.canvas.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    const finalRatio = ratio;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        const stars = starsByRate(Math.round(finalRatio * 100), 100, [
          0.75,
          0.5,
        ]);
        this.finishClear(stars);
      } else {
        this.startRound();
      }
    }, 800);
  }

  private injectStyle(): void {
    if (document.getElementById("nt2-style")) return;
    const st = document.createElement("style");
    st.id = "nt2-style";
    st.textContent = NT2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function NT2_CSS(theme: string): string {
  return `
.nt2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(380px,100%);}
.nt2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.nt2-num{display:inline-block;color:${theme};font-size:1.4em;}
.nt2-canvas{background:#fff;border-radius:22px;box-shadow:var(--shadow);touch-action:none;cursor:crosshair;max-width:100%;height:auto;}
.nt2-actions{display:flex;gap:12px;align-items:center;}
.nt2-done{opacity:.5;transition:opacity .25s ease,transform .25s ease;}
.nt2-done--ready{opacity:1;animation:nt2-pulse 1.1s ease-in-out infinite;}
@keyframes nt2-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
`;
}

export function create(): NumberTrace2Game {
  return new NumberTrace2Game();
}
