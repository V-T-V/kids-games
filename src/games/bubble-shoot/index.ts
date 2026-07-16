/* 泡泡射击 Bubble Shoot —— 底部发射器瞄准发射彩色泡泡，
   3 个及以上同色相连即消除。独特点：六边形蜂窝网格 + 真实飞行/吸附物理。
   视觉：圆形泡泡带高光反射，消除时爆裂粒子动画。
   难度=泡泡颜色数（easy 3 / medium 4 / hard 5）。通关=达到目标消除数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { getCssVar, sample } from "../../lobby/util.ts";
import { starsByScore } from "../../core/scoring.ts";

interface Bubble {
  x: number;
  y: number;
  color: string;
  /** 飞行中的速度，0 表示已固定 */
  vx: number;
  vy: number;
  /** 是否已固定到网格 */
  fixed: boolean;
  /** 消除标记 */
  popping: boolean;
  pop: number;
}

const PALETTE = ["#ff6b9d", "#4d96ff", "#ffd93d", "#6bcf7f", "#a55eea"];

export class BubbleShootGame extends BaseGame {
  constructor() {
    super("bubble-shoot");
  }

  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private raf = 0;
  private over = false;
  private unbind: (() => void) | null = null;

  private R = 17; // 泡泡半径
  private W = 0;
  private H = 0;
  private cols = 0;
  private rows = 0;

  private bubbles: Bubble[] = [];
  private flying: Bubble | null = null;
  private nextColors: string[] = [];

  private shooterX = 0;
  private shooterY = 0;
  private aimAngle = -Math.PI / 2; // 默认朝上
  private cooldown = 0;

  private popped = 0;
  private shots = 0;
  private target = 0;

  protected mount(): void {
    this.target =
      this.difficulty === "easy" ? 15 : this.difficulty === "medium" ? 22 : 30;
    const colors =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.setupCanvas(colors);
  }

  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.unbind?.();
    this.unbind = null;
  }

  private setupCanvas(colorCount: number): void {
    this.root.innerHTML = "";
    this.over = false;
    this.popped = 0;
    this.shots = 0;

    const wrap = document.createElement("div");
    wrap.className = "bs-wrap";

    const task = document.createElement("div");
    task.className = "bs-task";
    task.innerHTML = `消除 <span id="bs-pop">0</span> / ${this.target} 个泡泡～`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.c2d = this.canvas.getContext("2d")!;
    wrap.appendChild(this.canvas);

    this.root.appendChild(wrap);

    this.resize();
    this.nextColors = [this.pickColor(colorCount), this.pickColor(colorCount)];

    // 生成初始网格
    this.bubbles = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.colsAt(r); c++) {
        const pos = this.slotPos(r, c);
        this.bubbles.push({
          x: pos.x,
          y: pos.y,
          color: sample(PALETTE.slice(0, colorCount)),
          vx: 0,
          vy: 0,
          fixed: true,
          popping: false,
          pop: 0,
        });
      }
    }
    this.shooterX = this.W / 2;
    this.shooterY = this.H - this.R * 2;

    this.bindPointer();
    this.loop();
  }

  private resize(): void {
    const maxW = Math.min(420, window.innerWidth - 32);
    // 画布宽需容纳 cols 列（每列 2R）+ 半列交错偏移 + 边距，共约 22R
    this.R = Math.max(14, Math.floor(maxW / 22));
    this.W = this.R * 22;
    this.cols = 10;
    this.rows =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.H = this.R * 22;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 某行的列数：奇数行少一列并内缩半个泡泡。 */
  private colsAt(_r: number): number {
    return this.cols;
  }

  /** 网格槽位的像素坐标。 */
  private slotPos(r: number, c: number): { x: number; y: number } {
    const odd = r % 2 === 1;
    const x = c * this.R * 2 + this.R + (odd ? this.R : 0);
    const y = r * this.R * Math.sqrt(3) + this.R;
    return { x, y };
  }

  /** 反查：像素坐标 → 最近的空网格槽位。 */
  private nearestSlot(
    x: number,
    y: number,
  ): { r: number; c: number; pos: { x: number; y: number } } {
    let best: { r: number; c: number; pos: { x: number; y: number } } | null =
      null;
    let bestD = Infinity;
    for (let r = 0; r < this.rows + 1; r++) {
      for (let c = 0; c < this.cols; c++) {
        const pos = this.slotPos(r, c);
        const occupied = this.bubbles.some(
          (b) =>
            b.fixed &&
            !b.popping &&
            Math.abs(b.x - pos.x) < 1 &&
            Math.abs(b.y - pos.y) < 1,
        );
        if (occupied) continue;
        const d = (pos.x - x) ** 2 + (pos.y - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { r, c, pos };
        }
      }
    }
    // 兜底：若网格全满（无空槽），退化为贴到顶部最近行，避免空指针崩溃
    if (!best) {
      best = { r: 0, c: 0, pos: this.slotPos(0, 0) };
    }
    return best;
  }

  private pickColor(colorCount: number): string {
    return sample(PALETTE.slice(0, colorCount));
  }

  private bindPointer(): void {
    const onMove = (ev: PointerEvent): void => {
      const rect = this.canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      this.aimAngle = Math.atan2(py - this.shooterY, px - this.shooterX);
      // 限制不能向下射
      if (this.aimAngle > -0.2) this.aimAngle = -0.2;
      if (this.aimAngle < -Math.PI + 0.2) this.aimAngle = -Math.PI + 0.2;
    };
    const onDown = (ev: PointerEvent): void => {
      onMove(ev);
      this.fire();
    };
    this.canvas.addEventListener("pointermove", onMove);
    this.canvas.addEventListener("pointerdown", onDown);
    this.unbind = () => {
      this.canvas.removeEventListener("pointermove", onMove);
      this.canvas.removeEventListener("pointerdown", onDown);
    };
  }

  private fire(): void {
    if (this.flying || this.cooldown > 0 || this.over) return;
    const speed = 11;
    this.flying = {
      x: this.shooterX,
      y: this.shooterY,
      color: this.nextColors[0]!,
      vx: Math.cos(this.aimAngle) * speed,
      vy: Math.sin(this.aimAngle) * speed,
      fixed: false,
      popping: false,
      pop: 0,
    };
    this.nextColors[0] = this.nextColors[1]!;
    this.nextColors[1] = this.pickColor(
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5,
    );
    this.shots += 1;
    this.cooldown = 6;
    sfxPop();
  }

  private loop = (): void => {
    if (this.over) return;
    this.update();
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(): void {
    if (this.cooldown > 0) this.cooldown -= 1;
    // 飞行泡泡
    if (this.flying) {
      const b = this.flying;
      b.x += b.vx;
      b.y += b.vy;
      // 左右墙反弹
      if (b.x < this.R) {
        b.x = this.R;
        b.vx = Math.abs(b.vx);
      }
      if (b.x > this.W - this.R) {
        b.x = this.W - this.R;
        b.vx = -Math.abs(b.vx);
      }
      // 顶部碰撞
      if (b.y < this.R) {
        this.snapFlying();
      } else if (this.hitsFixed(b)) {
        this.snapFlying();
      }
    }
    // 消除动画
    for (const b of this.bubbles) {
      if (b.popping) {
        b.pop += 1;
        b.x += (Math.random() - 0.5) * 2;
        b.y += (Math.random() - 0.5) * 2;
      }
    }
    this.bubbles = this.bubbles.filter((b) => !(b.popping && b.pop > 14));
  }

  private hitsFixed(b: Bubble): boolean {
    const d2 = (this.R * 2 - 2) ** 2;
    for (const o of this.bubbles) {
      if (!o.fixed || o.popping) continue;
      if ((o.x - b.x) ** 2 + (o.y - b.y) ** 2 < d2) return true;
    }
    return false;
  }

  private snapFlying(): void {
    const f = this.flying;
    if (!f) return;
    const slot = this.nearestSlot(f.x, f.y);
    const placed: Bubble = {
      x: slot.pos.x,
      y: slot.pos.y,
      color: f.color,
      vx: 0,
      vy: 0,
      fixed: true,
      popping: false,
      pop: 0,
    };
    this.bubbles.push(placed);
    this.flying = null;
    // 匹配：从 placed 出发 flood fill 同色
    const group = this.matchGroup(placed);
    if (group.length >= 3) {
      for (const g of group) {
        g.popping = true;
      }
      this.popped += group.length;
      // 顶部迸发粒子
      const rect = this.canvas.getBoundingClientRect();
      const cx = rect.left + placed.x;
      const cy = rect.top + placed.y;
      burst(cx, cy, Math.min(24, group.length * 6), ["circle", "star"]);
      this.onCorrect(cx, cy);
      this.resetWrongStreak();
      // 更新计数 UI
      const pop = this.root.querySelector("#bs-pop");
      if (pop) pop.textContent = String(this.popped);
      // 检查浮动泡泡（未连到顶部）一并消除
      this.dropFloaters();
      if (this.popped >= this.target) {
        this.over = true;
        cancelAnimationFrame(this.raf);
        this.trackTimeout(
          () =>
            this.finishClear(
              starsByScore(this.popped, [
                this.target,
                Math.ceil(this.target * 0.6),
              ]),
            ),
          500,
        );
      }
    } else {
      // 没匹配上不算错（避免挫败），仅轻微反馈
      sfxPop();
    }
  }

  private matchGroup(start: Bubble): Bubble[] {
    const result: Bubble[] = [];
    const stack = [start];
    const seen = new Set<Bubble>();
    while (stack.length) {
      const b = stack.pop()!;
      if (seen.has(b)) continue;
      seen.add(b);
      result.push(b);
      const d2 = (this.R * 2 + 1) ** 2;
      for (const o of this.bubbles) {
        if (seen.has(o) || !o.fixed || o.popping) continue;
        if (o.color === b.color && (o.x - b.x) ** 2 + (o.y - b.y) ** 2 <= d2) {
          stack.push(o);
        }
      }
    }
    return result;
  }

  /** 清除未与顶部相连的悬浮泡泡（奖励）。 */
  private dropFloaters(): void {
    const connected = new Set<Bubble>();
    const stack = this.bubbles.filter(
      (b) => b.fixed && !b.popping && b.y <= this.R * 2,
    );
    while (stack.length) {
      const b = stack.pop()!;
      if (connected.has(b)) continue;
      connected.add(b);
      const d2 = (this.R * 2 + 1) ** 2;
      for (const o of this.bubbles) {
        if (connected.has(o) || !o.fixed || o.popping) continue;
        if ((o.x - b.x) ** 2 + (o.y - b.y) ** 2 <= d2) stack.push(o);
      }
    }
    for (const b of this.bubbles) {
      if (b.fixed && !b.popping && !connected.has(b)) {
        b.popping = true;
        this.popped += 1;
      }
    }
    const pop = this.root.querySelector("#bs-pop");
    if (pop) pop.textContent = String(this.popped);
  }

  private draw(): void {
    const ctx = this.c2d;
    ctx.clearRect(0, 0, this.W, this.H);
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, "rgba(34,211,238,0.10)");
    g.addColorStop(1, "rgba(255,255,255,0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    // 危险线
    ctx.strokeStyle = "rgba(255,99,72,0.4)";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, this.H - this.R * 5);
    ctx.lineTo(this.W, this.H - this.R * 5);
    ctx.stroke();
    ctx.setLineDash([]);

    // 泡泡
    for (const b of this.bubbles) {
      this.drawBubble(
        b.x,
        b.y,
        b.color,
        b.popping ? 1 + b.pop * 0.05 : 1,
        b.popping ? 1 - b.pop / 14 : 1,
      );
    }
    if (this.flying) {
      this.drawBubble(this.flying.x, this.flying.y, this.flying.color, 1, 1);
    }

    // 瞄准虚线
    if (!this.flying && this.cooldown <= 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(58,46,74,0.35)";
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(this.shooterX, this.shooterY);
      const len = 220;
      ctx.lineTo(
        this.shooterX + Math.cos(this.aimAngle) * len,
        this.shooterY + Math.sin(this.aimAngle) * len,
      );
      ctx.stroke();
      ctx.restore();
    }

    // 发射器底座
    ctx.save();
    ctx.fillStyle = getCssVar("--c-cyan");
    ctx.beginPath();
    ctx.arc(this.shooterX, this.shooterY, this.R * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(this.shooterX, this.shooterY, this.R * 1.4, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = getCssVar("--c-cyan");
    ctx.stroke();
    ctx.restore();

    // 下一个泡泡预览（装在发射器上）
    const previewColor = this.nextColors[0]!;
    this.drawBubble(this.shooterX, this.shooterY, previewColor, 1, 1);
  }

  private drawBubble(
    x: number,
    y: number,
    color: string,
    scale: number,
    alpha: number,
  ): void {
    const ctx = this.c2d;
    const r = this.R * scale;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    // 主体
    const grad = ctx.createRadialGradient(
      x - r * 0.3,
      y - r * 0.3,
      r * 0.1,
      x,
      y,
      r,
    );
    grad.addColorStop(0, this.lighten(color, 0.5));
    grad.addColorStop(0.7, color);
    grad.addColorStop(1, this.darken(color, 0.2));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // 边框
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = this.darken(color, 0.25);
    ctx.stroke();
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.ellipse(
      x - r * 0.32,
      y - r * 0.38,
      r * 0.28,
      r * 0.18,
      -0.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  private lighten(hex: string, amt: number): string {
    const { r, g, b } = this.parse(hex);
    return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(g + (255 - g) * amt)},${Math.round(b + (255 - b) * amt)})`;
  }
  private darken(hex: string, amt: number): string {
    const { r, g, b } = this.parse(hex);
    return `rgb(${Math.round(r * (1 - amt))},${Math.round(g * (1 - amt))},${Math.round(b * (1 - amt))})`;
  }
  private parse(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace("#", "");
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  private injectStyle(): void {
    if (document.getElementById("bs-style")) return;
    const st = document.createElement("style");
    st.id = "bs-style";
    st.textContent = BS_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function BS_CSS(theme: string): string {
  return `
.bs-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;}
.bs-task{font-size:1.15rem;font-weight:800;color:#3a2e4a;}
.bs-task span{color:${theme};}
canvas.bs-canvas, .bs-wrap canvas{border-radius:20px;background:rgba(255,255,255,.5);box-shadow:var(--shadow-lg);touch-action:none;cursor:crosshair;}
@keyframes bs-burst{0%{transform:scale(1);opacity:1}100%{transform:scale(1.8);opacity:0}}
`;
}

export function create(): BubbleShootGame {
  return new BubbleShootGame();
}
