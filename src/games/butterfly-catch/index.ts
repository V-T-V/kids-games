/* 捕蝶网 Butterfly Catch —— 几只蝴蝶飞舞（不同颜色），题目"网住蓝色的"，
   孩子拖网兜到对应蝴蝶。蝴蝶被网住即判定。
   独特点：蝴蝶用 Canvas 飞行（贝塞尔/正弦轨迹 + 翅膀扇动），网兜用 DOM 跟随指针拖拽。
   玩法：按住网兜拖到目标颜色蝴蝶上松开 / 或拖动经过即捕获。
   视觉：Canvas 蝴蝶 + DOM 网兜。难度 = 蝴蝶数。通关 = 网住目标轮数。
   前缀 btc- 不冲突。保证有解：目标颜色一定存在且唯一。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Color {
  key: string;
  cn: string;
  fill: string;
  glow: string;
}

const COLORS: Color[] = [
  { key: "red", cn: "红色", fill: "#ff5252", glow: "#ff8a8a" },
  { key: "blue", cn: "蓝色", fill: "#4d96ff", glow: "#8ab6ff" },
  { key: "yellow", cn: "黄色", fill: "#ffd93d", glow: "#ffe87a" },
  { key: "purple", cn: "紫色", fill: "#a55eea", glow: "#c79aec" },
  { key: "green", cn: "绿色", fill: "#6bcf7f", glow: "#9ee0ab" },
  { key: "orange", cn: "橙色", fill: "#ff9f43", glow: "#ffbd7a" },
];

interface Fly {
  color: Color;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  wing: number;
  caught: boolean;
}

export class ButterflyCatchGame extends BaseGame {
  constructor() {
    super("butterfly-catch");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private target!: Color;
  private flies: Fly[] = [];
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;
  private raf = 0;
  private over = false;
  private stop?: () => void;
  private last = 0;
  private t = 0;
  private netX = 0;
  private netY = 0;
  private netOn = false;
  private solved = false;
  private cw = 0;
  private ch = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stop?.();
    this.stop = undefined;
  }

  private flyCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 6;
  }

  private startRound(): void {
    this.over = false;
    this.solved = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 选目标色 + 干扰色（保证目标唯一）
    const n = this.flyCount();
    const pick = shuffle(COLORS).slice(0, n);
    this.target = sample(pick);
    this.flies = pick.map((c) => ({
      color: c,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      phase: Math.random() * Math.PI * 2,
      wing: Math.random() * Math.PI * 2,
      caught: false,
    }));

    const wrap = document.createElement("div");
    wrap.className = "btc-wrap";

    const task = document.createElement("div");
    task.className = "btc-task";
    task.innerHTML = `网住 <b style="color:${this.target.fill}">${this.target.cn}</b> 的蝴蝶！<br><span class="btc-sub">第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 拖动网兜去抓</span>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "btc-stage";
    const canvas = document.createElement("canvas");
    canvas.className = "btc-canvas";
    this.canvas = canvas;
    this.c2d = canvas.getContext("2d")!;
    stage.appendChild(canvas);

    // 网兜（DOM，跟随指针）
    const net = document.createElement("div");
    net.className = "btc-net";
    net.innerHTML = `<div class="btc-net-ring"></div><div class="btc-net-handle"></div>`;
    net.style.display = "none";
    stage.appendChild(net);

    wrap.appendChild(stage);
    this.root.appendChild(wrap);

    // 初始化蝴蝶位置 / 画布尺寸
    this.resize();
    // 绑定指针拖拽
    this.stop = bindPointer(stage, {
      down: (p) => {
        this.netOn = true;
        net.style.display = "";
        this.moveNet(p.x, p.y, stage);
      },
      move: (p) => {
        if (this.netOn) this.moveNet(p.x, p.y, stage);
      },
      up: (p) => {
        if (!this.netOn) return;
        this.netOn = false;
        // 松开时若网兜在目标蝴蝶上，则捕获
        this.tryCatch(stage);
        net.style.display = "none";
        void p;
      },
    });

    this.last = performance.now();
    this.loop();
  }

  private moveNet(clientX: number, clientY: number, stage: HTMLElement): void {
    const r = stage.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    this.netX = x;
    this.netY = y;
    const net = stage.querySelector(".btc-net") as HTMLElement | null;
    if (net) {
      net.style.left = `${x}px`;
      net.style.top = `${y}px`;
    }
    // 拖拽过程中遇到目标即捕获（更友好）
    this.tryCatch(stage);
  }

  private tryCatch(stage: HTMLElement): void {
    if (this.solved || !this.netOn) return;
    const r = stage.getBoundingClientRect();
    void r;
    // 网兜中心半径内若有目标色蝴蝶 → 捕获
    for (const f of this.flies) {
      if (f.caught) continue;
      const dx = f.x - this.netX;
      const dy = f.y - this.netY;
      if (Math.hypot(dx, dy) < 34) {
        if (f.color.key === this.target.key) {
          f.caught = true;
          this.win(stage);
          return;
        }
      }
    }
  }

  private win(stage: HTMLElement): void {
    if (this.solved) return;
    this.solved = true;
    sfxPop();
    this.onCorrect(this.netX, this.netY);
    this.resetWrongStreak();
    const net = stage.querySelector(".btc-net") as HTMLElement | null;
    if (net) net.style.display = "none";
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 700);
  }

  private resize(): void {
    // 画布逻辑尺寸：根据容器宽度
    const host = this.canvas.parentElement!;
    const w = Math.max(280, Math.min(560, host.clientWidth));
    const h = 340;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cw = w;
    this.ch = h;
    // 初始化蝴蝶位置
    this.flies.forEach((f, i) => {
      if (f.x === 0 && f.y === 0) {
        f.x = 60 + (i * (w - 120)) / Math.max(1, this.flies.length);
        f.y = 60 + Math.random() * (h - 140);
      }
      const ang = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 30;
      f.vx = Math.cos(ang) * sp;
      f.vy = Math.sin(ang) * sp;
    });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.t += dt;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    for (const f of this.flies) {
      if (f.caught) continue;
      f.phase += dt;
      f.wing += dt * 18;
      // 加入正弦摆动 + 随机转向
      const sp = Math.hypot(f.vx, f.vy);
      const turn = (Math.random() - 0.5) * 4 * dt;
      const a = Math.atan2(f.vy, f.vx) + turn;
      const sineY = Math.sin(f.phase * 2) * 12;
      f.vx = Math.cos(a) * sp;
      f.vy = Math.sin(a) * sp;
      f.x += f.vx * dt;
      f.y += f.vy * dt + sineY * dt * 0.6;
      // 边界反弹
      const m = 30;
      if (f.x < m) {
        f.x = m;
        f.vx = Math.abs(f.vx);
      } else if (f.x > this.cw - m) {
        f.x = this.cw - m;
        f.vx = -Math.abs(f.vx);
      }
      if (f.y < m) {
        f.y = m;
        f.vy = Math.abs(f.vy);
      } else if (f.y > this.ch - m) {
        f.y = this.ch - m;
        f.vy = -Math.abs(f.vy);
      }
    }
  }

  private draw(): void {
    const c2d = this.c2d;
    c2d.clearRect(0, 0, this.cw, this.ch);
    for (const f of this.flies) {
      this.drawButterfly(f);
    }
  }

  private drawButterfly(f: Fly): void {
    const c2d = this.c2d;
    const { fill, glow } = f.color;
    const flap = Math.abs(Math.sin(f.wing));
    const wingW = 16 + flap * 6;
    c2d.save();
    c2d.translate(f.x, f.y);
    if (f.caught) c2d.globalAlpha = 0.25;
    // 左右翅
    c2d.fillStyle = fill;
    c2d.beginPath();
    c2d.ellipse(-wingW * 0.6, -4, wingW, 12, -0.3, 0, Math.PI * 2);
    c2d.ellipse(-wingW * 0.5, 8, wingW * 0.75, 9, -0.1, 0, Math.PI * 2);
    c2d.ellipse(wingW * 0.6, -4, wingW, 12, 0.3, 0, Math.PI * 2);
    c2d.ellipse(wingW * 0.5, 8, wingW * 0.75, 9, 0.1, 0, Math.PI * 2);
    c2d.fill();
    // 翅膀光晕（目标色更醒目）
    if (f.color.key === this.target.key && !f.caught) {
      c2d.shadowColor = glow;
      c2d.shadowBlur = 14;
      c2d.fill();
      c2d.shadowBlur = 0;
    }
    // 身体
    c2d.fillStyle = "#2a2a2a";
    c2d.beginPath();
    c2d.ellipse(0, 2, 3, 12, 0, 0, Math.PI * 2);
    c2d.fill();
    // 头
    c2d.beginPath();
    c2d.arc(0, -8, 3.2, 0, Math.PI * 2);
    c2d.fill();
    c2d.restore();
  }

  private injectStyle(): void {
    if (document.getElementById("btc-style")) return;
    const st = document.createElement("style");
    st.id = "btc-style";
    st.textContent = BTC_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function BTC_CSS(_theme: string): string {
  void _theme;
  return `
.btc-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(600px,100%);}
.btc-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.btc-sub{font-size:.85rem;font-weight:700;color:#888;}
.btc-stage{position:relative;width:100%;max-width:560px;height:340px;background:radial-gradient(ellipse at 50% 30%,rgba(165,94,234,.18),transparent 70%),linear-gradient(180deg,#e7f3ff,#cde4ff);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;touch-action:none;cursor:grab;}
.btc-stage:active{cursor:grabbing;}
.btc-canvas{position:absolute;inset:0;display:block;}
.btc-net{position:absolute;width:70px;height:70px;transform:translate(-50%,-50%);pointer-events:none;z-index:5;}
.btc-net-ring{position:absolute;inset:0;border-radius:50%;border:5px solid #6bcf7f;background:rgba(107,207,127,.18);box-shadow:0 0 0 3px rgba(255,255,255,.6),inset 0 0 10px rgba(255,255,255,.4);}
.btc-net-handle{position:absolute;left:50%;bottom:-26px;transform:translateX(-50%) rotate(-20deg);transform-origin:top center;width:8px;height:46px;background:linear-gradient(#b08968,#7a5a36);border-radius:4px;box-shadow:0 2px 4px rgba(0,0,0,.3);}
@keyframes btc-wiggle{0%,100%{transform:translate(-50%,-50%) rotate(-4deg)}50%{transform:translate(-50%,-50%) rotate(4deg)}}
.btc-net{animation:btc-wiggle .5s ease-in-out infinite;}
@media (max-width:380px){.btc-stage{height:280px;}.btc-net{width:60px;height:60px;}}
`;
}

export function create(): ButterflyCatchGame {
  return new ButterflyCatchGame();
}
