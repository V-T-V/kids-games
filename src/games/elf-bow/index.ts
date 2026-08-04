/* 精灵弓箭 Elf Bow —— 靶子左右移动，孩子按住屏幕蓄力，松开射箭，
   箭按蓄力时长以不同速度飞出，命中靶子即得分。
   独特点：蓄力时机 + 轨迹预测。视觉：森林背景 + 弓箭手 + 移动靶 + 飞行箭。
   用 RAF 驱动靶子移动与箭飞行。难度=靶子速度。通关=射中目标数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";
import { bindPointer } from "../../core/input.ts";

export class ElfBowGame extends BaseGame {
  constructor() {
    super("elf-bow");
  }
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private raf = 0;
  private over = false;
  private unbind: (() => void) | null = null;

  private W = 0;
  private H = 0;
  private dpr = 1;

  /** 靶子位置（中心 y 固定，x 移动） */
  private tx = 0;
  private ty = 0;
  private tdir = 1;
  private tspeed = 0; // px/s
  private tr = 36; // 靶半径

  /** 蓄力：按下后 charge 从 0 增长到 1 */
  private charging = false;
  private chargeStart = 0;
  private charge = 0;

  /** 飞行中的箭（最多一支） */
  private arrow: { x: number; y: number; vx: number; vy: number } | null = null;

  private hits = 0;
  private target = 0;
  private last = 0;
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.target =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.tspeed =
      this.difficulty === "easy"
        ? 90
        : this.difficulty === "medium"
          ? 150
          : 220;
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.setupCanvas();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unbind?.();
    this.unbind = null;
  }

  private setupCanvas(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.over = false;
    this.hits = 0;
    this.arrow = null;
    this.charging = false;

    const wrap = document.createElement("div");
    wrap.className = "elb-wrap";
    const task = document.createElement("div");
    task.className = "elb-task";
    task.id = "elb-task";
    task.innerHTML = `按住蓄力，松开射箭！命中 <b id="elb-hits">0</b> / ${this.target}`;
    wrap.appendChild(task);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "elb-canvas";
    this.c2d = this.canvas.getContext("2d")!;
    wrap.appendChild(this.canvas);

    const hint = document.createElement("div");
    hint.className = "elb-hint";
    hint.textContent = "长按画面蓄力，松开发射～蓄得越久射得越快";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);

    this.resize();
    this.tx = this.W * 0.7;
    this.ty = this.H * 0.45;

    // 绑定蓄力/发射
    this.unbind = bindPointer(this.canvas, {
      down: () => {
        if (this.over || this.arrow) return;
        this.charging = true;
        this.chargeStart = performance.now();
        this.charge = 0;
      },
      up: () => {
        if (!this.charging) return;
        this.charging = false;
        this.fire();
      },
    });

    this.last = performance.now();
    this.loop();
  }

  private resize(): void {
    const maxW = Math.min(520, this.root.clientWidth || 480);
    const w = maxW;
    const h = Math.round(w * 0.72);
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.c2d.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.W = w;
    this.H = h;
  }

  private fire(): void {
    // 弓箭手位置（左下）
    const sx = this.W * 0.1;
    const sy = this.H * 0.8;
    // 蓄力决定速度（最小也能到达靶区，保证有解）
    const power = 0.35 + this.charge * 0.65; // 0.35..1
    const speed = 420 + power * 560; // px/s
    // 朝靶子方向发射（带轻微预判）
    const dx = this.tx - sx;
    const dy = this.ty - sy;
    const dist = Math.hypot(dx, dy) || 1;
    this.arrow = {
      x: sx,
      y: sy,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
    };
    sfxPop();
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 蓄力增长
    if (this.charging) {
      this.charge = Math.min(1, (now - this.chargeStart) / 1100);
    }

    // 靶子移动
    this.tx += this.tdir * this.tspeed * dt;
    if (this.tx > this.W - this.tr - 6) {
      this.tx = this.W - this.tr - 6;
      this.tdir = -1;
    } else if (this.tx < this.W * 0.45) {
      this.tx = this.W * 0.45;
      this.tdir = 1;
    }

    // 箭飞行
    if (this.arrow) {
      this.arrow.x += this.arrow.vx * dt;
      this.arrow.y += this.arrow.vy * dt;
      // 命中判定
      const d = Math.hypot(this.arrow.x - this.tx, this.arrow.y - this.ty);
      if (d <= this.tr) {
        this.onHit();
        this.arrow = null;
      } else if (
        this.arrow.x > this.W + 30 ||
        this.arrow.y < -30 ||
        this.arrow.x < -30
      ) {
        // 脱靶，箭消失
        this.arrow = null;
      }
    }

    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private onHit(): void {
    this.hits += 1;
    const r = this.canvas.getBoundingClientRect();
    const px = r.left + this.tx;
    const py = r.top + this.ty;
    this.onCorrect(px, py);
    this.resetWrongStreak();
    const hitsEl = this.root.querySelector<HTMLElement>("#elb-hits");
    if (hitsEl) hitsEl.textContent = String(this.hits);
    if (this.hits >= this.target) {
      this.over = true;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByScore(this.hits, [this.target, this.target]));
        } else {
          this.setupCanvas();
        }
      }, 700);
    }
  }

  private draw(): void {
    const c = this.c2d;
    const W = this.W;
    const H = this.H;
    // 背景：森林天空
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#bfe3c0");
    sky.addColorStop(0.6, "#9fd6a0");
    sky.addColorStop(1, "#6ab07a");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);
    // 远处树
    c.fillStyle = "#4a8a5a";
    for (let i = 0; i < 6; i++) {
      const tx = (i / 6) * W + 10;
      c.beginPath();
      c.moveTo(tx, H * 0.7);
      c.lineTo(tx + 18, H * 0.45);
      c.lineTo(tx + 36, H * 0.7);
      c.closePath();
      c.fill();
    }
    // 地面
    c.fillStyle = "#5a9a4a";
    c.fillRect(0, H * 0.8, W, H * 0.2);

    // 靶子（同心圆）
    const rings = [
      { r: this.tr, color: "#ffffff" },
      { r: this.tr * 0.75, color: "#1f2937" },
      { r: this.tr * 0.5, color: "#4d96ff" },
      { r: this.tr * 0.25, color: "#ff6348" },
    ];
    for (const ring of rings) {
      c.beginPath();
      c.arc(this.tx, this.ty, ring.r, 0, Math.PI * 2);
      c.fillStyle = ring.color;
      c.fill();
    }
    // 靶杆
    c.fillStyle = "#8b5a2b";
    c.fillRect(this.tx - 3, this.ty, 6, H * 0.35);

    // 弓箭手（emoji）
    c.font = `${Math.round(H * 0.16)}px serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("🧝", W * 0.1, H * 0.74);

    // 蓄力条 + 弓拉满视觉
    if (this.charging) {
      const bx = W * 0.1 - 30;
      const by = H * 0.9;
      c.fillStyle = "rgba(0,0,0,.2)";
      c.fillRect(bx, by, 60, 8);
      const col = this.charge > 0.85 ? "#ff6348" : "#ffd93d";
      c.fillStyle = col;
      c.fillRect(bx, by, 60 * this.charge, 8);
    }

    // 箭
    if (this.arrow) {
      const a = this.arrow;
      const ang = Math.atan2(a.vy, a.vx);
      c.save();
      c.translate(a.x, a.y);
      c.rotate(ang);
      c.fillStyle = "#8b5a2b";
      c.fillRect(-16, -2, 26, 4);
      c.fillStyle = "#3a2e1a";
      c.beginPath();
      c.moveTo(10, 0);
      c.lineTo(4, -5);
      c.lineTo(4, 5);
      c.closePath();
      c.fill();
      c.fillStyle = "#ff6348";
      c.beginPath();
      c.moveTo(-16, 0);
      c.lineTo(-22, -5);
      c.lineTo(-22, 5);
      c.closePath();
      c.fill();
      c.restore();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看准靶子位置，蓄力久一点射得更远哦～",
      primary: { text: "继续", icon: "🏹", onClick: () => ov.destroy() },
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

  /** 休息护盾入口（连错时基类不会自动触发，这里预留以便扩展）。 */
  protected triggerRest(): void {
    this.showRest();
  }

  private injectStyle(): void {
    if (document.getElementById("elb-style")) return;
    const st = document.createElement("style");
    st.id = "elb-style";
    st.textContent = ELB_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function ELB_CSS(theme: string): string {
  return `
.elb-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(520px,100%);}
.elb-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.elb-task b{color:${theme};font-size:1.3rem;}
.elb-canvas{border-radius:20px;box-shadow:var(--shadow-lg);background:#bfe3c0;cursor:pointer;touch-action:none;}
.elb-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
`;
}

export function create(): ElfBowGame {
  return new ElfBowGame();
}
