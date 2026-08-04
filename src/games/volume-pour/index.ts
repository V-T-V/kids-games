/* 量杯 Volume Pour —— 两个带刻度的量杯，一个目标体积，
   孩子按"倒水/停"按钮给指定杯子加水，让它的水位精确到达目标体积。
   独特点：水位用 Canvas 实时绘制（带波纹动画），刻度可视化毫升数。
   视觉：玻璃量杯 + 刻度线 + 蓝色水位（波纹）+ 目标红线。难度 = 目标精度。
   通关 = 倒对目标轮数。注意前缀 vp-（不冲突）。
   保证有解：每按一次按钮固定加 1 单位（或可调步长），目标为整数，可达。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

/** 量杯最大容量（毫升刻度） */
const CAPACITY = 10;

interface Beaker {
  canvas: HTMLCanvasElement;
  c2d: CanvasRenderingContext2D;
  amount: number; // 当前水量
}

export class VolumePourGame extends BaseGame {
  constructor() {
    super("volume-pour");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private target = 0; // 目标体积
  private activeIdx = 0; // 当前选中的杯子（0 或 1）
  private beakers: Beaker[] = [];
  private raf = 0;
  private over = false;
  private solved = false;
  /** 步长：每次加水量（难度越高步长越小越难精确） */
  private step = 1;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.step =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 1 : 1;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private targetRange(): [number, number] {
    // 难度越高目标越大（更接近满）
    return this.difficulty === "easy"
      ? [2, 6]
      : this.difficulty === "medium"
        ? [4, 8]
        : [5, 9];
  }

  private startRound(): void {
    this.over = false;
    this.solved = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const [lo, hi] = this.targetRange();
    this.target = randInt(lo, hi);
    this.activeIdx = 0;
    this.beakers = [];

    const wrap = document.createElement("div");
    wrap.className = "vp-wrap";

    const task = document.createElement("div");
    task.className = "vp-task";
    task.innerHTML = `让 <b>任意一个</b> 量杯的水位到 <b>${this.target}</b> · 第 ${this.roundsDone + 1}/${this.roundTotal} 关`;
    wrap.appendChild(task);

    // 两个量杯
    const beakerRow = document.createElement("div");
    beakerRow.className = "vp-beakers";
    for (let i = 0; i < 2; i++) {
      const box = document.createElement("div");
      box.className = "vp-beaker-box";
      const canvas = document.createElement("canvas");
      canvas.className = "vp-canvas";
      const dpr = window.devicePixelRatio || 1;
      canvas.width = 160 * dpr;
      canvas.height = 240 * dpr;
      canvas.style.width = "160px";
      canvas.style.height = "240px";
      const c2d = canvas.getContext("2d")!;
      c2d.scale(dpr, dpr);
      this.beakers.push({ canvas, c2d, amount: 0 });
      box.appendChild(canvas);
      const label = document.createElement("button");
      label.type = "button";
      label.className = "vp-select";
      label.textContent = `杯子 ${i + 1}`;
      label.dataset.idx = String(i);
      label.addEventListener("click", () => this.selectBeaker(i));
      box.appendChild(label);
      beakerRow.appendChild(box);
    }
    wrap.appendChild(beakerRow);

    // 控制按钮
    const controls = document.createElement("div");
    controls.className = "vp-controls";
    const pourBtn = document.createElement("button");
    pourBtn.type = "button";
    pourBtn.className = "vp-btn vp-btn--pour";
    pourBtn.textContent = `💧 倒水 (+${this.step})`;
    pourBtn.addEventListener("click", () => this.pour());
    const pourBigBtn = document.createElement("button");
    pourBigBtn.type = "button";
    pourBigBtn.className = "vp-btn vp-btn--pourbig";
    pourBigBtn.textContent = `💧💧 多倒 (+${this.step * 2})`;
    pourBigBtn.addEventListener("click", () => this.pour(this.step * 2));
    const emptyBtn = document.createElement("button");
    emptyBtn.type = "button";
    emptyBtn.className = "vp-btn vp-btn--empty";
    emptyBtn.textContent = "🗑️ 倒掉";
    emptyBtn.addEventListener("click", () => this.emptyActive());
    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "vp-btn vp-btn--check";
    checkBtn.textContent = "✓ 完成";
    checkBtn.addEventListener("click", () => this.check());
    controls.appendChild(pourBtn);
    controls.appendChild(pourBigBtn);
    controls.appendChild(emptyBtn);
    controls.appendChild(checkBtn);
    wrap.appendChild(controls);

    const hint = document.createElement("div");
    hint.className = "vp-hint";
    hint.id = "vp-hint";
    hint.textContent = "点杯子选中，再按倒水按钮";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);

    this.updateActiveUI();
    this.last = performance.now();
    this.loop();
  }

  private selectBeaker(i: number): void {
    if (this.solved) return;
    this.activeIdx = i;
    sfxPop();
    this.updateActiveUI();
  }

  private updateActiveUI(): void {
    this.root.querySelectorAll(".vp-beaker-box").forEach((b, i) => {
      b.classList.toggle("vp-beaker-box--active", i === this.activeIdx);
    });
    const hint = this.root.querySelector("#vp-hint");
    if (hint) {
      const cur = this.beakers[this.activeIdx]?.amount ?? 0;
      hint.textContent = `已选杯子 ${this.activeIdx + 1} · 现在有 ${cur}，目标 ${this.target}`;
    }
  }

  private pour(delta: number = this.step): void {
    if (this.solved || this.over) return;
    const b = this.beakers[this.activeIdx]!;
    b.amount = Math.min(CAPACITY, b.amount + delta);
    sfxPop();
    this.updateActiveUI();
  }

  private emptyActive(): void {
    if (this.solved) return;
    const b = this.beakers[this.activeIdx]!;
    b.amount = 0;
    sfxPop();
    this.updateActiveUI();
  }

  private check(): void {
    if (this.solved) return;
    const hit = this.beakers.findIndex((b) => b.amount === this.target);
    if (hit >= 0) {
      this.solved = true;
      const c = this.beakers[hit]!.canvas;
      const r = c.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      const paused = this.onWrong();
      const hint = this.root.querySelector("#vp-hint");
      if (hint) {
        const cur = this.beakers[this.activeIdx]?.amount ?? 0;
        const diff = this.target - cur;
        hint.textContent =
          diff > 0
            ? `杯子 ${this.activeIdx + 1} 还差 ${diff}`
            : `杯子 ${this.activeIdx + 1} 多了 ${-diff}，倒掉一些`;
      }
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `目标是 ${this.target}，看看刻度线对齐了吗？`,
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

  /* ===== Canvas 渲染 ===== */
  private last = 0;
  private t = 0; // 用于波纹动画的时间

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.t += dt;
    this.beakers.forEach((b, i) => this.drawBeaker(b, i));
    this.raf = requestAnimationFrame(this.loop);
  };

  private drawBeaker(b: Beaker, idx: number): void {
    const { c2d, canvas } = b;
    const W = canvas.width;
    const H = canvas.height;
    c2d.clearRect(0, 0, W, H);

    // 量杯几何
    const left = 28;
    const right = W - 28;
    const top = 24;
    const bottom = H - 28;
    const innerW = right - left;
    const innerH = bottom - top;

    // 杯壁（玻璃）
    c2d.save();
    c2d.strokeStyle = "#9bbcd9";
    c2d.lineWidth = 3;
    c2d.beginPath();
    c2d.moveTo(left - 6, top - 6);
    c2d.lineTo(left, top);
    c2d.lineTo(left, bottom);
    c2d.bezierCurveTo(left, bottom + 14, right, bottom + 14, right, bottom);
    c2d.lineTo(right, top);
    c2d.lineTo(right + 6, top - 6);
    c2d.stroke();
    // 杯口
    c2d.strokeStyle = "#7fa8c9";
    c2d.lineWidth = 3;
    c2d.beginPath();
    c2d.moveTo(left - 8, top - 4);
    c2d.lineTo(left + 2, top + 2);
    c2d.moveTo(right + 8, top - 4);
    c2d.lineTo(right - 2, top + 2);
    c2d.stroke();
    c2d.restore();

    // 刻度线
    c2d.save();
    c2d.strokeStyle = "#cfe2f0";
    c2d.fillStyle = "#7a93a8";
    c2d.font = "10px sans-serif";
    c2d.textAlign = "right";
    c2d.textBaseline = "middle";
    for (let k = 0; k <= CAPACITY; k++) {
      const y = bottom - (k / CAPACITY) * innerH;
      const long = k % 5 === 0;
      c2d.lineWidth = long ? 1.5 : 1;
      c2d.beginPath();
      c2d.moveTo(left, y);
      c2d.lineTo(left + (long ? 16 : 9), y);
      c2d.stroke();
      if (long) c2d.fillText(String(k), left - 4, y);
    }
    c2d.restore();

    // 目标红线
    const ty = bottom - (this.target / CAPACITY) * innerH;
    c2d.save();
    c2d.strokeStyle = "#ff5252";
    c2d.setLineDash([6, 4]);
    c2d.lineWidth = 2;
    c2d.beginPath();
    c2d.moveTo(left, ty);
    c2d.lineTo(right, ty);
    c2d.stroke();
    c2d.setLineDash([]);
    c2d.fillStyle = "#ff5252";
    c2d.font = "bold 11px sans-serif";
    c2d.textAlign = "left";
    c2d.textBaseline = "bottom";
    c2d.fillText(`目标 ${this.target}`, left + 4, ty - 2);
    c2d.restore();

    // 水位
    if (b.amount > 0) {
      const wy = bottom - (b.amount / CAPACITY) * innerH;
      c2d.save();
      c2d.beginPath();
      c2d.rect(left, wy, innerW, bottom - wy);
      c2d.clip();
      // 渐变水
      const grad = c2d.createLinearGradient(0, wy, 0, bottom);
      grad.addColorStop(0, "rgba(77,150,255,.85)");
      grad.addColorStop(1, "rgba(40,110,220,.95)");
      c2d.fillStyle = grad;
      c2d.fillRect(left, wy - 10, innerW, bottom - wy + 12);
      // 波纹（两条正弦）
      c2d.strokeStyle = "rgba(255,255,255,.55)";
      c2d.lineWidth = 2;
      for (let w = 0; w < 2; w++) {
        c2d.beginPath();
        const baseY = wy + w * 3;
        for (let x = left; x <= right; x += 2) {
          const yy =
            baseY + Math.sin(x / 14 + this.t * 3 + w * 1.5) * (2.2 - w * 0.6);
          if (x === left) c2d.moveTo(x, yy);
          else c2d.lineTo(x, yy);
        }
        c2d.stroke();
      }
      c2d.restore();
    }

    // 数值
    c2d.save();
    c2d.fillStyle = "#3a4a5a";
    c2d.font = "bold 13px sans-serif";
    c2d.textAlign = "center";
    c2d.fillText(`${b.amount} / ${CAPACITY}`, W / 2, bottom + 18);
    if (idx === this.activeIdx) {
      c2d.fillStyle = "#6bcf7f";
      c2d.fillText("● 已选", W / 2, top - 10);
    }
    c2d.restore();
  }

  private injectStyle(): void {
    if (document.getElementById("vp-style")) return;
    const st = document.createElement("style");
    st.id = "vp-style";
    st.textContent = VP_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function VP_CSS(theme: string): string {
  return `
.vp-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.vp-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.vp-task b{color:${theme};}
.vp-beakers{display:flex;gap:24px;justify-content:center;flex-wrap:wrap;}
.vp-beaker-box{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px;border-radius:16px;border:3px solid transparent;background:rgba(255,255,255,.4);transition:border-color .2s ease,background .2s ease;}
.vp-beaker-box--active{border-color:${theme};background:rgba(34,211,238,.12);box-shadow:0 0 0 3px ${theme}33;}
.vp-canvas{width:140px;height:210px;display:block;}
.vp-select{border:none;background:#fff;color:var(--ink);font-weight:700;font-size:.9rem;padding:6px 14px;border-radius:999px;box-shadow:var(--shadow);cursor:pointer;}
.vp-beaker-box--active .vp-select{background:${theme};color:#fff;}
.vp-controls{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:440px;}
.vp-btn{border:none;font-weight:800;font-size:.95rem;padding:10px 16px;border-radius:14px;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s ease;}
.vp-btn:active{transform:scale(.93);}
.vp-btn--pour{background:#4d96ff;color:#fff;}
.vp-btn--pourbig{background:#6bcf7f;color:#fff;}
.vp-btn--empty{background:#fff;color:#555;}
.vp-btn--check{background:#ffd93d;color:#5a3d00;}
.vp-hint{font-size:.95rem;font-weight:700;color:#666;text-align:center;min-height:1.4rem;}
@media (max-width:380px){.vp-canvas{width:120px;height:180px;}.vp-beakers{gap:14px;}}
`;
}

export function create(): VolumePourGame {
  return new VolumePourGame();
}
