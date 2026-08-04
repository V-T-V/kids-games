/* 蜂蜜量 Bee Honey —— 蜂蜜罐有目标刻度线，孩子按按钮倒蜂蜜到刻度。
   独特点：粘稠蜂蜜缓慢上升 + 表面波纹，比水量更需要耐心控制。
   玩法：按"倒一点/倒很多"加蜂蜜，超了可按"倒掉"。到目标刻度后按"完成"。
   视觉：玻璃蜂蜜罐 + 刻度线 + 金色蜂蜜（粘稠波纹）+ 目标红线。
   难度 = 目标精度（步长越小越难）。通关 = 倒对目标轮数。
   保证有解：每按一次固定加整数单位，目标为整数，可达。前缀 bhy- 不冲突。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

/** 蜂蜜罐最大容量（刻度格） */
const CAPACITY = 10;

interface Jar {
  canvas: HTMLCanvasElement;
  c2d: CanvasRenderingContext2D;
  amount: number;
  /** 显示用的平滑量（追赶真实 amount，做出粘稠缓慢上升效果） */
  shown: number;
}

export class BeeHoneyGame extends BaseGame {
  constructor() {
    super("bee-honey");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private target = 0;
  private jar!: Jar;
  private raf = 0;
  private over = false;
  private solved = false;
  private step = 1;
  private last = 0;
  private t = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.step = 1;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private targetRange(): [number, number] {
    return this.difficulty === "easy"
      ? [3, 6]
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

    const wrap = document.createElement("div");
    wrap.className = "bhy-wrap";

    const task = document.createElement("div");
    task.className = "bhy-task";
    task.innerHTML = `把蜂蜜倒到 <b>${this.target}</b> 格 · 第 ${this.roundsDone + 1}/${this.roundTotal} 关`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "bhy-stage";
    const canvas = document.createElement("canvas");
    canvas.className = "bhy-canvas";
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 200 * dpr;
    canvas.height = 280 * dpr;
    canvas.style.width = "200px";
    canvas.style.height = "280px";
    const c2d = canvas.getContext("2d")!;
    c2d.scale(dpr, dpr);
    this.jar = { canvas, c2d, amount: 0, shown: 0 };
    stage.appendChild(canvas);

    // 蜜蜂装饰
    const bee = document.createElement("div");
    bee.className = "bhy-bee";
    bee.textContent = "🐝";
    stage.appendChild(bee);
    wrap.appendChild(stage);

    const controls = document.createElement("div");
    controls.className = "bhy-controls";
    const pourBtn = document.createElement("button");
    pourBtn.type = "button";
    pourBtn.className = "bhy-btn bhy-btn--pour";
    pourBtn.textContent = `🍯 倒一点 (+${this.step})`;
    pourBtn.addEventListener("click", () => this.pour(this.step));
    const pourBigBtn = document.createElement("button");
    pourBigBtn.type = "button";
    pourBigBtn.className = "bhy-btn bhy-btn--pourbig";
    pourBigBtn.textContent = `🍯🍯 多倒 (+${this.step * 2})`;
    pourBigBtn.addEventListener("click", () => this.pour(this.step * 2));
    const emptyBtn = document.createElement("button");
    emptyBtn.type = "button";
    emptyBtn.className = "bhy-btn bhy-btn--empty";
    emptyBtn.textContent = "🥄 舀出来";
    emptyBtn.addEventListener("click", () => this.empty());
    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "bhy-btn bhy-btn--check";
    checkBtn.textContent = "✓ 完成";
    checkBtn.addEventListener("click", () => this.check());
    controls.appendChild(pourBtn);
    controls.appendChild(pourBigBtn);
    controls.appendChild(emptyBtn);
    controls.appendChild(checkBtn);
    wrap.appendChild(controls);

    const hint = document.createElement("div");
    hint.className = "bhy-hint";
    hint.id = "bhy-hint";
    hint.textContent = `现在 0 格，目标 ${this.target} 格`;
    wrap.appendChild(hint);

    this.root.appendChild(wrap);

    this.last = performance.now();
    this.loop();
  }

  private pour(delta: number): void {
    if (this.solved || this.over) return;
    this.jar.amount = Math.min(CAPACITY, this.jar.amount + delta);
    sfxPop();
    this.updateHint();
  }

  private empty(): void {
    if (this.solved) return;
    this.jar.amount = 0;
    sfxPop();
    this.updateHint();
  }

  private updateHint(): void {
    const hint = this.root.querySelector("#bhy-hint");
    if (!hint) return;
    const cur = this.jar.amount;
    if (cur === this.target) {
      hint.textContent = `正好 ${cur} 格！按「完成」🎉`;
    } else if (cur < this.target) {
      hint.textContent = `现在 ${cur} 格，还差 ${this.target - cur} 格`;
    } else {
      hint.textContent = `现在 ${cur} 格，多了 ${cur - this.target} 格，舀出来一些`;
    }
  }

  private check(): void {
    if (this.solved) return;
    if (this.jar.amount === this.target) {
      this.solved = true;
      const r = this.jar.canvas.getBoundingClientRect();
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
      this.updateHint();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `目标是 ${this.target} 格，看看红线对齐了吗？多了就舀出来。`,
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
  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.t += dt;
    // 粘稠追赶：蜂蜜缓缓逼近目标量
    const diff = this.jar.amount - this.jar.shown;
    this.jar.shown += diff * Math.min(1, dt * 4);
    this.drawJar();
    this.raf = requestAnimationFrame(this.loop);
  };

  private drawJar(): void {
    const { c2d, canvas, shown } = this.jar;
    const W = canvas.width;
    const H = canvas.height;
    c2d.clearRect(0, 0, W, H);

    const left = 36;
    const right = W - 36;
    const top = 30;
    const bottom = H - 34;
    const innerW = right - left;
    const innerH = bottom - top;

    // 罐口（玻璃）
    c2d.save();
    c2d.strokeStyle = "#b58741";
    c2d.lineWidth = 3;
    c2d.beginPath();
    c2d.moveTo(left - 8, top - 4);
    c2d.lineTo(left, top);
    c2d.lineTo(left, bottom);
    c2d.bezierCurveTo(left, bottom + 16, right, bottom + 16, right, bottom);
    c2d.lineTo(right, top);
    c2d.lineTo(right + 8, top - 4);
    c2d.stroke();
    c2d.restore();

    // 刻度线
    c2d.save();
    c2d.strokeStyle = "#d8a85e";
    c2d.fillStyle = "#7a5320";
    c2d.font = "bold 11px sans-serif";
    c2d.textAlign = "right";
    c2d.textBaseline = "middle";
    for (let k = 0; k <= CAPACITY; k++) {
      const y = bottom - (k / CAPACITY) * innerH;
      const long = k % 5 === 0;
      c2d.lineWidth = long ? 1.5 : 1;
      c2d.beginPath();
      c2d.moveTo(left, y);
      c2d.lineTo(left + (long ? 18 : 10), y);
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

    // 蜂蜜（粘稠，慢波纹）
    if (shown > 0.02) {
      const wy = bottom - (shown / CAPACITY) * innerH;
      c2d.save();
      c2d.beginPath();
      c2d.rect(left, wy, innerW, bottom - wy);
      c2d.clip();
      const grad = c2d.createLinearGradient(0, wy, 0, bottom);
      grad.addColorStop(0, "#ffd45e");
      grad.addColorStop(1, "#e8930a");
      c2d.fillStyle = grad;
      c2d.fillRect(left, wy - 12, innerW, bottom - wy + 14);
      // 表面波纹（粘稠：振幅小、频率低）
      c2d.strokeStyle = "rgba(255,255,255,.55)";
      c2d.lineWidth = 2;
      for (let w = 0; w < 2; w++) {
        c2d.beginPath();
        const baseY = wy + w * 3;
        for (let x = left; x <= right; x += 2) {
          const yy =
            baseY + Math.sin(x / 20 + this.t * 1.8 + w * 1.5) * (1.6 - w * 0.5);
          if (x === left) c2d.moveTo(x, yy);
          else c2d.lineTo(x, yy);
        }
        c2d.stroke();
      }
      c2d.restore();
    }

    // 数值
    c2d.save();
    c2d.fillStyle = "#5a3d00";
    c2d.font = "bold 14px sans-serif";
    c2d.textAlign = "center";
    c2d.fillText(`${this.jar.amount} / ${CAPACITY}`, W / 2, bottom + 22);
    c2d.restore();
  }

  private injectStyle(): void {
    if (document.getElementById("bhy-style")) return;
    const st = document.createElement("style");
    st.id = "bhy-style";
    st.textContent = BHY_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function BHY_CSS(theme: string): string {
  return `
.bhy-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.bhy-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.bhy-task b{color:${theme};}
.bhy-stage{position:relative;display:flex;align-items:center;justify-content:center;padding:10px;background:linear-gradient(180deg,rgba(255,231,150,.45),rgba(255,217,100,.25));border-radius:24px;box-shadow:var(--shadow);}
.bhy-canvas{width:180px;height:252px;display:block;}
.bhy-bee{position:absolute;top:-6px;right:8px;font-size:2rem;animation:bhy-fly 3.2s ease-in-out infinite;pointer-events:none;}
@keyframes bhy-fly{0%,100%{transform:translate(0,0) rotate(-8deg)}50%{transform:translate(-12px,8px) rotate(8deg)}}
.bhy-controls{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:440px;}
.bhy-btn{border:none;font-weight:800;font-size:.95rem;padding:11px 16px;border-radius:14px;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s ease;}
.bhy-btn:active{transform:scale(.93);}
.bhy-btn--pour{background:#ffb300;color:#fff;}
.bhy-btn--pourbig{background:#ff9f43;color:#fff;}
.bhy-btn--empty{background:#fff;color:#7a5320;}
.bhy-btn--check{background:${theme};color:#5a3d00;}
.bhy-hint{font-size:.98rem;font-weight:700;color:#7a5320;text-align:center;min-height:1.4rem;background:#fff;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
@media (max-width:380px){.bhy-canvas{width:150px;height:210px;}}
`;
}

export function create(): BeeHoneyGame {
  return new BeeHoneyGame();
}
