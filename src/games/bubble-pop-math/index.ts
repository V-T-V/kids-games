/* 算术泡泡 Bubble Pop Math —— 屏幕飘着带数字或算式的泡泡，题目问"戳爆等于 N 的"，
   孩子戳所有等于 N 的泡泡。独特点：动态心算 + 多目标命中。
   视觉：圆形泡泡带高光，缓慢上飘，戳爆有粒子。难度 = 泡泡数 / 算式复杂度。
   通关 = 戳对目标轮数。使用 Canvas（c2d）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
  /** 显示文本（数字或算式） */
  label: string;
  /** 算出的值 */
  value: number;
  color: string;
  popped: boolean;
  /** 戳爆动画进度 0~1 */
  pop: number;
  /** 是否为目标（用于校验，不暴露给孩子） */
  isTarget: boolean;
}

const COLORS = [
  "#ff6b9d",
  "#4d96ff",
  "#ffd93d",
  "#6bcf7f",
  "#a55eea",
  "#ff9f43",
];

export class BubblePopMathGame extends BaseGame {
  constructor() {
    super("bubble-pop-math");
  }
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private raf = 0;
  private over = false;

  private bubbles: Bubble[] = [];
  /** 本轮目标值 */
  private target = 0;
  /** 本轮还需戳中的目标泡泡数 */
  private targetsLeft = 0;

  private roundsDone = 0;
  private roundTotal = 0;
  private W = 0;
  private H = 0;
  /** 按颜色缓存的泡泡径向渐变（原点 (0,0)，绘制时用 translate 定位）。
   *  避免每帧为每个泡泡重新 createRadialGradient（10 泡泡 × 60fps = 600 次/秒 GC 压力）。 */
  private gradCache: Map<string, CanvasGradient> = new Map();
  /** 缓存的背景渐变（尺寸不变时复用）。 */
  private bgGrad: CanvasGradient | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.setupCanvas();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
  }

  /** 难度参数：泡泡总数、目标值范围、是否用算式。 */
  private diff() {
    if (this.difficulty === "easy") {
      return { total: 6, maxTarget: 5, useExpr: false };
    }
    if (this.difficulty === "medium") {
      return { total: 8, maxTarget: 9, useExpr: true };
    }
    return { total: 10, maxTarget: 12, useExpr: true };
  }

  /** 生成一个值等于 v 的标签（数字或算式）。 */
  private labelFor(v: number, useExpr: boolean): string {
    if (!useExpr || Math.random() < 0.4) return String(v);
    const kind = randInt(0, 2);
    if (kind === 0) {
      // 加法 v = a + b
      const a = randInt(0, v);
      return `${a}+${v - a}`;
    }
    if (kind === 1) {
      // 减法 v = a - b
      const a = v + randInt(0, 5);
      return `${a}-${a - v}`;
    }
    // 乘法（仅在 v 可分解时）
    for (let tries = 0; tries < 8; tries++) {
      const f = randInt(2, Math.max(2, v));
      if (v % f === 0 && f <= 9 && v / f <= 9) {
        return `${f}×${v / f}`;
      }
    }
    return String(v);
  }

  /** 生成一个非目标值的干扰标签。 */
  private distract(
    target: number,
    useExpr: boolean,
  ): { label: string; value: number } {
    for (let tries = 0; tries < 20; tries++) {
      const v = randInt(0, Math.max(6, target + 5));
      if (v !== target) {
        return { label: this.labelFor(v, useExpr), value: v };
      }
    }
    return { label: String(target + 1), value: target + 1 };
  }

  private setupCanvas(): void {
    this.over = false;
    this.root.innerHTML = "";

    const d = this.diff();
    this.target = randInt(1, d.maxTarget);

    const wrap = document.createElement("div");
    wrap.className = "bm-wrap";
    const task = document.createElement("div");
    task.className = "bm-task";
    task.innerHTML = `戳爆所有等于 <b>${this.target}</b> 的泡泡～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.c2d = this.canvas.getContext("2d")!;
    wrap.appendChild(this.canvas);

    this.root.appendChild(wrap);
    this.resize();

    // 生成泡泡：约一半为目标
    this.bubbles = [];
    const targetCount = Math.max(2, Math.floor(d.total / 2));
    const specs: { label: string; value: number; isTarget: boolean }[] = [];
    for (let i = 0; i < targetCount; i++) {
      const v = this.target;
      specs.push({
        label: this.labelFor(v, d.useExpr),
        value: v,
        isTarget: true,
      });
    }
    for (let i = 0; i < d.total - targetCount; i++) {
      const dt = this.distract(this.target, d.useExpr);
      specs.push({ label: dt.label, value: dt.value, isTarget: false });
    }
    this.targetsLeft = targetCount;
    shuffle(specs).forEach((s, i) => {
      const r = 34;
      this.bubbles.push({
        x: r + 20 + ((i * 73) % Math.max(40, this.W - 2 * r - 40)),
        y: this.H - r - ((i * 50) % 200) - Math.random() * 80,
        r,
        vy: 0.25 + Math.random() * 0.35,
        label: s.label,
        value: s.value,
        color: COLORS[i % COLORS.length]!,
        popped: false,
        pop: 0,
        isTarget: s.isTarget,
      });
    });

    // 点击处理
    this.canvas.addEventListener("pointerdown", (e) =>
      this.onTap(e.clientX, e.clientY),
    );

    this.loop();
  }

  private resize(): void {
    const maxW = Math.min(460, window.innerWidth - 24);
    const maxH = Math.min(440, window.innerHeight - 200);
    this.W = maxW;
    this.H = maxH;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(maxW * dpr);
    this.canvas.height = Math.floor(maxH * dpr);
    this.canvas.style.width = `${maxW}px`;
    this.canvas.style.height = `${maxH}px`;
    this.c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 重建缓存：背景渐变 + 泡泡渐变（半径取标准 r，绘制时 translate 即可复用）
    const c = this.c2d;
    const bg = c.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, "rgba(173,216,255,.25)");
    bg.addColorStop(1, "rgba(77,150,255,.12)");
    this.bgGrad = bg;
    this.gradCache.clear();
    const r = 34; // 与 setupCanvas 里 b.r 一致
    for (const col of COLORS) {
      const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.5, `${col}cc`);
      g.addColorStop(1, `${col}88`);
      this.gradCache.set(col, g);
    }
  }

  private onTap(cx: number, cy: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = cx - rect.left;
    const y = cy - rect.top;
    for (const b of this.bubbles) {
      if (b.popped) continue;
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx * dx + dy * dy <= b.r * b.r) {
        this.popBubble(b, cx, cy);
        break;
      }
    }
  }

  private popBubble(b: Bubble, sx: number, sy: number): void {
    b.popped = true;
    b.pop = 0.001;
    sfxPop();
    if (b.isTarget) {
      this.targetsLeft -= 1;
      burst(sx, sy);
      this.resetWrongStreak();
      if (this.targetsLeft <= 0) {
        // 本轮通过
        this.roundsDone += 1;
        this.onCorrect(sx, sy);
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.setupCanvas();
        }, 700);
      }
    } else {
      // 戳错了：屏幕轻震，记一次错
      const paused = this.onWrong();
      this.canvas.classList.add("bm-shake");
      this.trackTimeout(() => this.canvas.classList.remove("bm-shake"), 300);
      if (paused) this.showRest();
    }
  }

  private loop = (): void => {
    if (this.over) return;
    this.raf = requestAnimationFrame(this.loop);
    const c = this.c2d;
    c.clearRect(0, 0, this.W, this.H);
    // 背景渐变（水池感，缓存复用，避免每帧创建）
    c.fillStyle = this.bgGrad ?? "rgba(173,216,255,.2)";
    c.fillRect(0, 0, this.W, this.H);

    for (const b of this.bubbles) {
      if (b.popped) {
        b.pop += 0.06;
        if (b.pop > 1) continue;
        const scale = 1 + b.pop * 0.6;
        const alpha = 1 - b.pop;
        c.save();
        c.globalAlpha = alpha;
        c.beginPath();
        c.arc(b.x, b.y, b.r * scale, 0, Math.PI * 2);
        c.strokeStyle = b.color;
        c.lineWidth = 3;
        c.stroke();
        c.restore();
        continue;
      }
      // 上飘
      b.y -= b.vy;
      b.x += Math.sin(b.y * 0.02) * 0.3;
      if (b.y < -b.r) {
        // 回到底部
        b.y = this.H + b.r;
        b.x = b.r + 20 + Math.random() * Math.max(40, this.W - 2 * b.r - 40);
      }
      // 泡泡主体（用按颜色缓存的渐变 + translate 定位，避免每帧每泡创建渐变）
      c.save();
      c.translate(b.x, b.y);
      c.beginPath();
      c.arc(0, 0, b.r, 0, Math.PI * 2);
      c.fillStyle = this.gradCache.get(b.color) ?? b.color;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.stroke();
      // 高光（坐标已 translate 到泡泡中心，用相对坐标）
      c.beginPath();
      c.arc(-b.r * 0.35, -b.r * 0.35, b.r * 0.22, 0, Math.PI * 2);
      c.fillStyle = "rgba(255,255,255,0.85)";
      c.fill();
      // 数字/算式（坐标已 translate 到泡泡中心）
      c.fillStyle = "#1f2937";
      c.font = `bold ${b.label.length > 3 ? 16 : 22}px system-ui, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(b.label, 0, 0);
      c.restore();
    }
  };

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先算算泡泡上的算式等于几，再戳哦～",
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
    if (document.getElementById("bm-style")) return;
    const st = document.createElement("style");
    st.id = "bm-style";
    st.textContent = BM_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function BM_CSS(_theme: string): string {
  return `
.bm-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.bm-task{font-size:1.2rem;font-weight:800;text-align:center;}
.bm-task b{color:#4d96ff;font-size:1.5rem;}
.bm-wrap canvas{display:block;border-radius:20px;box-shadow:var(--shadow);background:rgba(255,255,255,.5);touch-action:none;}
.bm-shake{animation:bm-shake .3s ease;}
@keyframes bm-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
`;
}

export function create(): BubblePopMathGame {
  return new BubblePopMathGame();
}
