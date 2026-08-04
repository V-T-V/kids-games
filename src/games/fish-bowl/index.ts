/* 鱼缸水 Fish Bowl —— 鱼缸有目标水位线，孩子按按钮加水到刻度。
   独特点：水位实时绘制（蓝色波纹），鱼会随水位上浮游动，比量杯更有生命感。
   玩法：按"加水/多加/舀出"调整水位到目标刻度，按"完成"判定。
   视觉：圆腹玻璃鱼缸 + 刻度线 + 蓝色水位（波纹）+ 游动的鱼 + 目标红线。
   难度 = 目标精度（步长越小越难）。通关 = 加对目标轮数。
   保证有解：每按一次固定加整数单位，目标为整数，可达。前缀 fbw- 不冲突。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

const CAPACITY = 10;
const FISH_EMOJI = ["🐠", "🐟", "🐡", "🐙"] as const;

interface Fish {
  emoji: string;
  x: number; // 0~1 缸内横向比例
  dir: 1 | -1;
  phase: number;
}

interface Bowl {
  canvas: HTMLCanvasElement;
  c2d: CanvasRenderingContext2D;
  amount: number;
  shown: number;
}

export class FishBowlGame extends BaseGame {
  constructor() {
    super("fish-bowl");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private target = 0;
  private bowl!: Bowl;
  private fish: Fish[] = [];
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
    this.fish = [
      { emoji: sample([...FISH_EMOJI]), x: 0.3, dir: 1, phase: 0 },
      { emoji: sample([...FISH_EMOJI]), x: 0.7, dir: -1, phase: 1.5 },
    ];

    const wrap = document.createElement("div");
    wrap.className = "fbw-wrap";

    const task = document.createElement("div");
    task.className = "fbw-task";
    task.innerHTML = `把水加到 <b>${this.target}</b> 格 · 第 ${this.roundsDone + 1}/${this.roundTotal} 关`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "fbw-stage";
    const canvas = document.createElement("canvas");
    canvas.className = "fbw-canvas";
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 220 * dpr;
    canvas.height = 280 * dpr;
    canvas.style.width = "220px";
    canvas.style.height = "280px";
    const c2d = canvas.getContext("2d")!;
    c2d.scale(dpr, dpr);
    this.bowl = { canvas, c2d, amount: 0, shown: 0 };
    stage.appendChild(canvas);
    wrap.appendChild(stage);

    const controls = document.createElement("div");
    controls.className = "fbw-controls";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "fbw-btn fbw-btn--add";
    addBtn.textContent = `💧 加水 (+${this.step})`;
    addBtn.addEventListener("click", () => this.add(this.step));
    const addBigBtn = document.createElement("button");
    addBigBtn.type = "button";
    addBigBtn.className = "fbw-btn fbw-btn--addbig";
    addBigBtn.textContent = `💧💧 多加 (+${this.step * 2})`;
    addBigBtn.addEventListener("click", () => this.add(this.step * 2));
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "fbw-btn fbw-btn--remove";
    removeBtn.textContent = "🥄 舀出";
    removeBtn.addEventListener("click", () => this.remove());
    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "fbw-btn fbw-btn--check";
    checkBtn.textContent = "✓ 完成";
    checkBtn.addEventListener("click", () => this.check());
    controls.appendChild(addBtn);
    controls.appendChild(addBigBtn);
    controls.appendChild(removeBtn);
    controls.appendChild(checkBtn);
    wrap.appendChild(controls);

    const hint = document.createElement("div");
    hint.className = "fbw-hint";
    hint.id = "fbw-hint";
    hint.textContent = `现在 0 格，目标 ${this.target} 格`;
    wrap.appendChild(hint);

    this.root.appendChild(wrap);

    this.last = performance.now();
    this.loop();
  }

  private add(delta: number): void {
    if (this.solved || this.over) return;
    this.bowl.amount = Math.min(CAPACITY, this.bowl.amount + delta);
    sfxPop();
    this.updateHint();
  }

  private remove(): void {
    if (this.solved) return;
    this.bowl.amount = Math.max(0, this.bowl.amount - this.step);
    sfxPop();
    this.updateHint();
  }

  private updateHint(): void {
    const hint = this.root.querySelector("#fbw-hint");
    if (!hint) return;
    const cur = this.bowl.amount;
    if (cur === this.target) {
      hint.textContent = `正好 ${cur} 格！按「完成」🎉`;
    } else if (cur < this.target) {
      hint.textContent = `现在 ${cur} 格，还差 ${this.target - cur} 格`;
    } else {
      hint.textContent = `现在 ${cur} 格，多了 ${cur - this.target} 格，舀出一些`;
    }
  }

  private check(): void {
    if (this.solved) return;
    if (this.bowl.amount === this.target) {
      this.solved = true;
      const r = this.bowl.canvas.getBoundingClientRect();
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
      emoji: "🐟",
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
    // 水位平滑追赶
    const diff = this.bowl.amount - this.bowl.shown;
    this.bowl.shown += diff * Math.min(1, dt * 5);
    // 鱼游动
    for (const f of this.fish) {
      f.phase += dt;
      f.x += f.dir * dt * 0.12;
      if (f.x > 0.9) {
        f.x = 0.9;
        f.dir = -1;
      } else if (f.x < 0.1) {
        f.x = 0.1;
        f.dir = 1;
      }
    }
    this.drawBowl();
    this.raf = requestAnimationFrame(this.loop);
  };

  private drawBowl(): void {
    const { c2d, canvas, shown } = this.bowl;
    const W = canvas.width;
    const H = canvas.height;
    c2d.clearRect(0, 0, W, H);

    // 圆腹鱼缸几何
    const cx = W / 2;
    const bowlTop = 26;
    const bowlBottom = H - 22;
    const bowlLeft = 30;
    const bowlRight = W - 30;
    const innerW = bowlRight - bowlLeft;
    const innerH = bowlBottom - bowlTop;

    // 缸口
    c2d.save();
    c2d.strokeStyle = "#9bbcd9";
    c2d.lineWidth = 3;
    c2d.beginPath();
    c2d.moveTo(bowlLeft - 6, bowlTop - 4);
    c2d.lineTo(bowlLeft + 6, bowlTop + 2);
    c2d.moveTo(bowlRight + 6, bowlTop - 4);
    c2d.lineTo(bowlRight - 6, bowlTop + 2);
    c2d.stroke();
    // 缸壁（圆腹）
    c2d.strokeStyle = "#7fa8c9";
    c2d.lineWidth = 3;
    c2d.beginPath();
    c2d.moveTo(bowlLeft + 6, bowlTop + 2);
    c2d.bezierCurveTo(
      bowlLeft - 16,
      bowlTop + innerH * 0.4,
      bowlLeft - 16,
      bowlBottom - 10,
      cx,
      bowlBottom,
    );
    c2d.bezierCurveTo(
      bowlRight + 16,
      bowlBottom - 10,
      bowlRight + 16,
      bowlTop + innerH * 0.4,
      bowlRight - 6,
      bowlTop + 2,
    );
    c2d.stroke();
    c2d.restore();

    // 用 clip 限定水+鱼在缸内
    c2d.save();
    c2d.beginPath();
    c2d.moveTo(bowlLeft + 6, bowlTop + 2);
    c2d.bezierCurveTo(
      bowlLeft - 14,
      bowlTop + innerH * 0.4,
      bowlLeft - 14,
      bowlBottom - 12,
      cx,
      bowlBottom - 2,
    );
    c2d.bezierCurveTo(
      bowlRight + 14,
      bowlBottom - 12,
      bowlRight + 14,
      bowlTop + innerH * 0.4,
      bowlRight - 6,
      bowlTop + 2,
    );
    c2d.closePath();
    c2d.clip();

    // 刻度线（在缸内中央竖列）
    c2d.save();
    c2d.strokeStyle = "rgba(255,255,255,.5)";
    c2d.fillStyle = "rgba(255,255,255,.85)";
    c2d.font = "bold 10px sans-serif";
    c2d.textAlign = "left";
    c2d.textBaseline = "middle";
    for (let k = 0; k <= CAPACITY; k++) {
      const y = bowlBottom - (k / CAPACITY) * innerH;
      const long = k % 5 === 0;
      c2d.lineWidth = long ? 1.5 : 1;
      c2d.beginPath();
      c2d.moveTo(bowlLeft + 8, y);
      c2d.lineTo(bowlLeft + 8 + (long ? 16 : 9), y);
      c2d.stroke();
      if (long) c2d.fillText(String(k), bowlLeft + 28, y);
    }
    c2d.restore();

    // 目标红线
    const ty = bowlBottom - (this.target / CAPACITY) * innerH;
    c2d.save();
    c2d.strokeStyle = "#ff5252";
    c2d.setLineDash([6, 4]);
    c2d.lineWidth = 2;
    c2d.beginPath();
    c2d.moveTo(bowlLeft + 4, ty);
    c2d.lineTo(bowlRight - 4, ty);
    c2d.stroke();
    c2d.setLineDash([]);
    c2d.restore();

    // 水位
    if (shown > 0.02) {
      const wy = bowlBottom - (shown / CAPACITY) * innerH;
      const grad = c2d.createLinearGradient(0, wy, 0, bowlBottom);
      grad.addColorStop(0, "rgba(77,150,255,.85)");
      grad.addColorStop(1, "rgba(40,110,220,.95)");
      c2d.fillStyle = grad;
      c2d.fillRect(bowlLeft - 16, wy - 10, innerW + 32, bowlBottom - wy + 14);
      // 表面波纹
      c2d.strokeStyle = "rgba(255,255,255,.55)";
      c2d.lineWidth = 2;
      for (let w = 0; w < 2; w++) {
        c2d.beginPath();
        const baseY = wy + w * 3;
        for (let x = bowlLeft - 14; x <= bowlRight + 14; x += 2) {
          const yy =
            baseY + Math.sin(x / 16 + this.t * 3 + w * 1.5) * (2.2 - w * 0.6);
          if (x === bowlLeft - 14) c2d.moveTo(x, yy);
          else c2d.lineTo(x, yy);
        }
        c2d.stroke();
      }
      // 鱼在水中游（y 随水位）
      const waterTop = Math.max(wy + 16, bowlTop + 30);
      const waterBottom = bowlBottom - 10;
      for (const f of this.fish) {
        const fx = bowlLeft + f.x * innerW;
        const fy =
          waterTop +
          (waterBottom - waterTop) * (0.5 + Math.sin(f.phase) * 0.25);
        c2d.save();
        c2d.translate(fx, fy);
        if (f.dir < 0) c2d.scale(-1, 1);
        c2d.font = "22px sans-serif";
        c2d.textAlign = "center";
        c2d.textBaseline = "middle";
        c2d.fillText(f.emoji, 0, 0);
        c2d.restore();
      }
    }
    c2d.restore();

    // 数值
    c2d.save();
    c2d.fillStyle = "#3a4a5a";
    c2d.font = "bold 14px sans-serif";
    c2d.textAlign = "center";
    c2d.fillText(`${this.bowl.amount} / ${CAPACITY}`, cx, bowlBottom + 16);
    c2d.restore();
  }

  private injectStyle(): void {
    if (document.getElementById("fbw-style")) return;
    const st = document.createElement("style");
    st.id = "fbw-style";
    st.textContent = FBW_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function FBW_CSS(theme: string): string {
  return `
.fbw-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.fbw-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.fbw-task b{color:${theme};}
.fbw-stage{display:flex;align-items:center;justify-content:center;padding:10px;background:linear-gradient(180deg,rgba(180,220,255,.4),rgba(200,230,255,.2));border-radius:24px;box-shadow:var(--shadow);}
.fbw-canvas{width:200px;height:252px;display:block;}
.fbw-controls{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:440px;}
.fbw-btn{border:none;font-weight:800;font-size:.95rem;padding:11px 16px;border-radius:14px;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s ease;}
.fbw-btn:active{transform:scale(.93);}
.fbw-btn--add{background:#4d96ff;color:#fff;}
.fbw-btn--addbig{background:#6bcf7f;color:#fff;}
.fbw-btn--remove{background:#fff;color:#555;}
.fbw-btn--check{background:${theme};color:#fff;}
.fbw-hint{font-size:.98rem;font-weight:700;color:#3a4a5a;text-align:center;min-height:1.4rem;background:#fff;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
@media (max-width:380px){.fbw-canvas{width:170px;height:214px;}}
`;
}

export function create(): FishBowlGame {
  return new FishBowlGame();
}
