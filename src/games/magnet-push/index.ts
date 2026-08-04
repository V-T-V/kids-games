/* 磁铁推拉 Magnet Push —— 屏幕上有一颗小铁珠 🔩 和一块磁铁 🧲。
   孩子拖动磁铁，铁珠被磁铁吸引（异极相吸的简化版：磁铁靠近就吸过来）。
   任务：把铁珠引到目标位置 🎯。难度=目标距离 + 障碍墙数量。
   巧思：磁力=指向磁铁的方向向量，铁珠沿磁力线被「拉」过去；
         障碍墙会挡住铁珠，需绕路；磁力线用虚线 SVG 可视化。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ARENA_W = 460;
const ARENA_H = 340;
const BALL_R = 16;
const MAG_R = 22;
const TARGET_R = 28;

export class MagnetPushGame extends BaseGame {
  constructor() {
    super("magnet-push");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private busy = false;

  private ball = { x: 60, y: ARENA_H - 60, vx: 0, vy: 0 };
  private magnet = { x: ARENA_W / 2, y: ARENA_H / 2 };
  private target = { x: ARENA_W - 60, y: 60 };
  private walls: Wall[] = [];
  private dragging = false;

  private rafId = 0;
  private svgLine: SVGLineElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private startRound(): void {
    this.busy = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    if (this.rafId) cancelAnimationFrame(this.rafId);

    // 起点固定左下，目标越远越难；障碍墙数量随难度增加。
    this.ball = { x: 56, y: ARENA_H - 56, vx: 0, vy: 0 };
    this.target = {
      x: ARENA_W - 56,
      y: this.difficulty === "easy" ? ARENA_H - 56 : 56,
    };
    this.magnet = { x: ARENA_W / 2, y: ARENA_H / 2 };

    // 生成障碍墙（不挡住起点/目标）
    const wallCount =
      this.difficulty === "easy" ? 0 : this.difficulty === "medium" ? 2 : 4;
    this.walls = [];
    if (wallCount > 0) {
      const candidates: Wall[] = [];
      for (let i = 0; i < 24; i++) {
        const w = 60 + Math.floor(Math.random() * 60);
        const h = 20;
        const wx = 120 + Math.floor(Math.random() * (ARENA_W - 260));
        const wy = 60 + Math.floor(Math.random() * (ARENA_H - 140));
        // 避开起点与目标
        const tooClose =
          dist(wx, wy, this.ball.x, this.ball.y) < 70 ||
          dist(wx + w, wy, this.target.x, this.target.y) < 70;
        if (!tooClose) candidates.push({ x: wx, y: wy, w, h });
      }
      this.walls = shuffle(candidates).slice(0, wallCount);
    }

    const wrap = document.createElement("div");
    wrap.className = "mgp-wrap";

    const task = document.createElement("div");
    task.className = "mgp-task";
    task.innerHTML = `拖着 <b>🧲磁铁</b>，把 <b>🔩铁珠</b> 吸到 <b>🎯目标</b>！<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 关</small>`;
    wrap.appendChild(task);

    const arena = document.createElement("div");
    arena.className = "mgp-arena";
    arena.style.width = `${ARENA_W}px`;
    arena.style.height = `${ARENA_H}px`;

    // 障碍墙
    this.walls.forEach((wll) => {
      const el = document.createElement("div");
      el.className = "mgp-wall";
      el.style.left = `${wll.x}px`;
      el.style.top = `${wll.y}px`;
      el.style.width = `${wll.w}px`;
      el.style.height = `${wll.h}px`;
      arena.appendChild(el);
    });

    // 目标
    const tgt = document.createElement("div");
    tgt.className = "mgp-target";
    tgt.style.left = `${this.target.x - TARGET_R}px`;
    tgt.style.top = `${this.target.y - TARGET_R}px`;
    tgt.innerHTML = "🎯";
    arena.appendChild(tgt);

    // 磁力线（SVG 虚线，连接磁铁与铁珠）
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("class", "mgp-field");
    svg.setAttribute("viewBox", `0 0 ${ARENA_W} ${ARENA_H}`);
    const line = document.createElementNS(svgNs, "line");
    line.setAttribute("x1", "0");
    line.setAttribute("y1", "0");
    line.setAttribute("x2", "0");
    line.setAttribute("y2", "0");
    svg.appendChild(line);
    arena.appendChild(svg);
    this.svgLine = line;

    // 铁珠
    const ball = document.createElement("div");
    ball.className = "mgp-ball";
    ball.innerHTML = "🔩";
    arena.appendChild(ball);

    // 磁铁（可拖动）
    const magnet = document.createElement("div");
    magnet.className = "mgp-magnet";
    magnet.innerHTML = "🧲";
    arena.appendChild(magnet);

    wrap.appendChild(arena);
    this.root.appendChild(wrap);

    // 指针拖动磁铁
    const onMove = (cx: number, cy: number): void => {
      const rect = arena.getBoundingClientRect();
      const x = clamp(cx - rect.left, MAG_R, ARENA_W - MAG_R);
      const y = clamp(cy - rect.top, MAG_R, ARENA_H - MAG_R);
      this.magnet.x = x;
      this.magnet.y = y;
      magnet.style.left = `${x - MAG_R}px`;
      magnet.style.top = `${y - MAG_R}px`;
    };
    const pointerDown = (ev: PointerEvent): void => {
      const rect = arena.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      // 只有点在磁铁附近才开始拖（更直观），但容差大方便幼儿
      if (dist(cx, cy, this.magnet.x, this.magnet.y) < 80) {
        this.dragging = true;
        arena.setPointerCapture(ev.pointerId);
        onMove(ev.clientX, ev.clientY);
      }
    };
    const pointerMove = (ev: PointerEvent): void => {
      if (!this.dragging) return;
      onMove(ev.clientX, ev.clientY);
    };
    const pointerUp = (): void => {
      this.dragging = false;
    };
    arena.addEventListener("pointerdown", pointerDown);
    arena.addEventListener("pointermove", pointerMove);
    arena.addEventListener("pointerup", pointerUp);
    arena.addEventListener("pointercancel", pointerUp);

    // 初始位置
    magnet.style.left = `${this.magnet.x - MAG_R}px`;
    magnet.style.top = `${this.magnet.y - MAG_R}px`;
    ball.style.left = `${this.ball.x - BALL_R}px`;
    ball.style.top = `${this.ball.y - BALL_R}px`;

    // 物理循环
    const tick = (): void => {
      this.physicsStep(ball);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /** 每帧：磁力吸引铁珠，碰撞墙/边界，检测到达目标。 */
  private physicsStep(ballEl: HTMLElement): void {
    if (this.busy) return;
    const dx = this.magnet.x - this.ball.x;
    const dy = this.magnet.y - this.ball.y;
    const d = Math.hypot(dx, dy) || 1;
    // 磁力强度：距离越近越强（反比，有上限）
    const force = Math.min(0.6, 1400 / (d * d));
    this.ball.vx += (dx / d) * force;
    this.ball.vy += (dy / d) * force;
    // 阻尼（摩擦）
    this.ball.vx *= 0.92;
    this.ball.vy *= 0.92;
    // 限速
    const sp = Math.hypot(this.ball.vx, this.ball.vy);
    const max = 7;
    if (sp > max) {
      this.ball.vx = (this.ball.vx / sp) * max;
      this.ball.vy = (this.ball.vy / sp) * max;
    }
    // 新位置
    let nx = this.ball.x + this.ball.vx;
    let ny = this.ball.y + this.ball.vy;
    // 边界
    nx = clamp(nx, BALL_R, ARENA_W - BALL_R);
    ny = clamp(ny, BALL_R, ARENA_H - BALL_R);
    // 墙碰撞（AABB，简单回弹）
    for (const wll of this.walls) {
      if (
        nx + BALL_R > wll.x &&
        nx - BALL_R < wll.x + wll.w &&
        ny + BALL_R > wll.y &&
        ny - BALL_R < wll.y + wll.h
      ) {
        // 推回上一帧位置并反弹
        if (Math.abs(this.ball.vx) > Math.abs(this.ball.vy)) {
          this.ball.vx *= -0.5;
          nx = clamp(this.ball.x, BALL_R, ARENA_W - BALL_R);
        } else {
          this.ball.vy *= -0.5;
          ny = clamp(this.ball.y, BALL_R, ARENA_H - BALL_R);
        }
      }
    }
    this.ball.x = nx;
    this.ball.y = ny;
    ballEl.style.left = `${nx - BALL_R}px`;
    ballEl.style.top = `${ny - BALL_R}px`;

    // 磁力线虚线
    if (this.svgLine) {
      this.svgLine.setAttribute("x1", String(this.ball.x));
      this.svgLine.setAttribute("y1", String(this.ball.y));
      this.svgLine.setAttribute("x2", String(this.magnet.x));
      this.svgLine.setAttribute("y2", String(this.magnet.y));
      // 距离近时虚线更亮
      const opacity = Math.max(0.15, Math.min(0.9, 1 - d / 300));
      this.svgLine.setAttribute("stroke-opacity", String(opacity));
    }

    // 到达目标？
    if (dist(this.ball.x, this.ball.y, this.target.x, this.target.y) < TARGET_R) {
      this.win(ballEl);
    }
  }

  private win(ballEl: HTMLElement): void {
    if (this.busy) return;
    this.busy = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    ballEl.classList.add("mgp-ball--win");
    const r = ballEl.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    sfxPop();
    this.roundsDone += 1;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal)
        this.finishClear(starsByAccuracy(this.wrongCount));
      else this.startRound();
    }, 1300);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "慢慢拖磁铁就好啦～",
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
    if (document.getElementById("mgp-style")) return;
    const st = document.createElement("style");
    st.id = "mgp-style";
    st.textContent = MGP_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x1 - x2, y1 - y2);
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function MGP_CSS(theme: string): string {
  return `
.mgp-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(${ARENA_W}px,100%);}
.mgp-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);}
.mgp-task b{color:${theme};}
.mgp-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.mgp-arena{position:relative;background:radial-gradient(circle at 50% 40%,#2a3470,#11163a);border-radius:24px;box-shadow:var(--shadow-lg);overflow:hidden;touch-action:none;cursor:grab;max-width:100%;}
.mgp-arena:active{cursor:grabbing;}
.mgp-wall{position:absolute;background:repeating-linear-gradient(45deg,#5b6bd6,#5b6bd6 8px,#3d4aa8 8px,#3d4aa8 16px);border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.3);}
.mgp-target{position:absolute;width:${TARGET_R * 2}px;height:${TARGET_R * 2}px;display:flex;align-items:center;justify-content:center;font-size:2rem;animation:mgp-pulse 1.2s ease-in-out infinite;filter:drop-shadow(0 0 8px #ffd84d);}
@keyframes mgp-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
.mgp-field{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.mgp-field line{stroke:${theme};stroke-width:3;stroke-dasharray:6 8;animation:mgp-dash .8s linear infinite;}
@keyframes mgp-dash{to{stroke-dashoffset:-28;}}
.mgp-ball{position:absolute;width:${BALL_R * 2}px;height:${BALL_R * 2}px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));transition:none;}
.mgp-ball--win{animation:mgp-win .5s ease;}
@keyframes mgp-win{0%{transform:scale(1)}50%{transform:scale(1.6) rotate(20deg)}100%{transform:scale(1)}}
.mgp-magnet{position:absolute;width:${MAG_R * 2}px;height:${MAG_R * 2}px;display:flex;align-items:center;justify-content:center;font-size:2.2rem;cursor:grab;filter:drop-shadow(0 0 10px ${theme});animation:mgp-glow 1.4s ease-in-out infinite;}
@keyframes mgp-glow{0%,100%{filter:drop-shadow(0 0 6px ${theme})}50%{filter:drop-shadow(0 0 16px ${theme})}}
@media (max-width:520px){.mgp-arena{transform-origin:top center;}}
`;
}

export function create(): MagnetPushGame {
  return new MagnetPushGame();
}
