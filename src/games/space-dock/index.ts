/* 空间站对接 Space Dock —— 空间站周围有若干不同颜色的端口，
   底部有待对接飞船，飞船也有颜色，拖飞船到同色端口即对接成功。
   独特点：颜色匹配 + 拖拽到目标；每关端口颜色唯一，飞船颜色与之一一对应，
   保证有解。视觉：星空 + 空间站 + 彩色端口 + 飞船。用 bindPointer 拖拽。
   难度 = 端口数。通关 = 对接目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { createRafLoop } from "../../core/loop.ts";
import { shuffle, getCssVar } from "../../lobby/util.ts";

interface Port {
  el: HTMLDivElement;
  color: string;
  x: number;
  y: number;
  docked: boolean;
}

interface Ship {
  el: HTMLDivElement;
  color: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  docked: boolean;
  dragging: boolean;
}

const COLORS = [
  { hex: "#ff6348", name: "红" },
  { hex: "#ffd93d", name: "黄" },
  { hex: "#4d96ff", name: "蓝" },
  { hex: "#6bcf7f", name: "绿" },
  { hex: "#a55eea", name: "紫" },
  { hex: "#ff9f43", name: "橙" },
];

export class SpaceDockGame extends BaseGame {
  constructor() {
    super("space-dock");
  }

  private sceneEl!: HTMLDivElement;
  private ports: Port[] = [];
  private ships: Ship[] = [];
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private activeShip: Ship | null = null;
  private stop?: () => void;
  private unbind: (() => void) | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    this.unbind?.();
    this.unbind = null;
  }

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.over = false;
    this.ports = [];
    this.ships = [];
    this.activeShip = null;
    this.root.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "spd-wrap";
    const task = document.createElement("div");
    task.className = "spd-task";
    task.innerHTML = `拖 🚀 到 <b>同色</b> 端口对接！<span class="spd-prog">${this.roundsDone + 1}/${this.roundTotal}</span>`;
    wrap.appendChild(task);

    this.sceneEl = document.createElement("div");
    this.sceneEl.className = "spd-scene";
    wrap.appendChild(this.sceneEl);
    this.root.appendChild(wrap);

    requestAnimationFrame(() => this.layout());
  }

  private layout(): void {
    const r = this.sceneEl.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    const cx = w / 2;
    const cy = h * 0.4;
    const radius = Math.min(w, h) * 0.3;
    const n = this.count();

    /* 中心空间站 */
    const station = document.createElement("div");
    station.className = "spd-station";
    station.textContent = "🏛️";
    station.style.left = `${cx}px`;
    station.style.top = `${cy}px`;
    this.sceneEl.appendChild(station);

    /* 端口颜色：唯一 */
    const palette = shuffle(COLORS).slice(0, n);
    /* 端口环绕空间站分布 */
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      const el = document.createElement("div");
      el.className = "spd-port";
      el.style.setProperty("--spd-c", palette[i]!.hex);
      el.style.left = `${px}px`;
      el.style.top = `${py}px`;
      el.textContent = "⭕";
      this.sceneEl.appendChild(el);
      this.ports.push({
        el,
        color: palette[i]!.hex,
        x: px,
        y: py,
        docked: false,
      });
    }

    /* 飞船在底部一字排开，颜色与端口一一对应（打乱顺序） */
    const shipPalette = shuffle(palette);
    const margin = 50;
    const usable = w - margin * 2;
    const shipY = h - 44;
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      el.className = "spd-ship";
      el.style.setProperty("--spd-c", shipPalette[i]!.hex);
      el.textContent = "🚀";
      const sx = n === 1 ? w / 2 : margin + (usable * i) / (n - 1);
      el.style.left = `${sx}px`;
      el.style.top = `${shipY}px`;
      this.sceneEl.appendChild(el);
      const ship: Ship = {
        el,
        color: shipPalette[i]!.hex,
        x: sx,
        y: shipY,
        homeX: sx,
        homeY: shipY,
        docked: false,
        dragging: false,
      };
      this.ships.push(ship);
      el.addEventListener("pointerdown", (e) => {
        if (this.over || ship.docked) return;
        e.preventDefault();
        this.activeShip = ship;
        ship.dragging = true;
        el.classList.add("spd-ship--drag");
      });
    }

    this.unbind = bindPointer(this.sceneEl, {
      move: (p) => {
        if (!this.activeShip) return;
        const rr = this.sceneEl.getBoundingClientRect();
        const x = Math.max(26, Math.min(rr.width - 26, p.x - rr.left));
        const y = Math.max(26, Math.min(rr.height - 26, p.y - rr.top));
        this.activeShip.x = x;
        this.activeShip.y = y;
        this.activeShip.el.style.left = `${x}px`;
        this.activeShip.el.style.top = `${y}px`;
      },
      up: () => this.release(),
    });

    this.stop = createRafLoop(() => this.tick());
  }

  private tick = (): void => {
    if (this.over) {
      this.stop?.();
      this.stop = undefined;
      return;
    }
    /* 拖动中高亮匹配的近端口 */
    for (const p of this.ports) {
      p.el.classList.remove("spd-port--near");
    }
    if (this.activeShip) {
      const s = this.activeShip;
      for (const p of this.ports) {
        if (p.docked) continue;
        const near =
          Math.abs(s.x - p.x) < 34 &&
          Math.abs(s.y - p.y) < 34 &&
          p.color === s.color;
        if (near) {
          p.el.classList.add("spd-port--near");
          /* 吸附对接 */
          this.dock(s, p);
          return;
        }
      }
    }
  };

  private release(): void {
    if (!this.activeShip) return;
    const s = this.activeShip;
    s.dragging = false;
    s.el.classList.remove("spd-ship--drag");
    this.activeShip = null;
    /* 未对接 → 回到原位 */
    if (!s.docked) {
      s.x = s.homeX;
      s.y = s.homeY;
      s.el.style.left = `${s.homeX}px`;
      s.el.style.top = `${s.homeY}px`;
    }
  }

  private dock(ship: Ship, port: Port): void {
    if (this.over || ship.docked || port.docked) return;
    ship.docked = true;
    port.docked = true;
    ship.el.classList.remove("spd-ship--drag");
    ship.el.classList.add("spd-ship--docked");
    /* 吸附到端口 */
    ship.x = port.x;
    ship.y = port.y;
    ship.el.style.left = `${port.x}px`;
    ship.el.style.top = `${port.y}px`;
    port.el.classList.add("spd-port--done");
    port.el.textContent = "🛰️";
    sfxPop();
    const pr = port.el.getBoundingClientRect();
    this.onCorrect(pr.left + pr.width / 2, pr.top + pr.height / 2);
    this.resetWrongStreak();
    this.activeShip = null;

    const dockedCount = this.ships.filter((s) => s.docked).length;
    if (dockedCount >= this.count()) {
      /* 本关全部对接完成 */
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 800);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("spd-style")) return;
    const st = document.createElement("style");
    st.id = "spd-style";
    st.textContent = SPD_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function SPD_CSS(theme: string): string {
  return `
.spd-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.spd-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;}
.spd-prog{background:${theme};color:#fff;padding:2px 10px;border-radius:999px;font-size:.85rem;}
.spd-scene{position:relative;width:100%;height:64vh;min-height:380px;background:radial-gradient(circle at 50% 40%,#1a1a4a 0%,#0a0a2e 55%,#050518 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;user-select:none;}
.spd-scene::before{content:"";position:absolute;inset:0;background-image:radial-gradient(1px 1px at 15% 20%,#fff,transparent),radial-gradient(1px 1px at 70% 15%,#fff,transparent),radial-gradient(1px 1px at 40% 35%,#fff,transparent),radial-gradient(2px 2px at 85% 30%,#fff,transparent),radial-gradient(1px 1px at 25% 70%,#fff,transparent),radial-gradient(1px 1px at 60% 80%,#fff,transparent);opacity:.6;pointer-events:none;}
.spd-station{position:absolute;font-size:3rem;line-height:1;transform:translate(-50%,-50%);z-index:2;filter:drop-shadow(0 0 12px rgba(120,180,255,.7));animation:spd-spin 12s linear infinite;}
@keyframes spd-spin{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}
.spd-port{position:absolute;font-size:2rem;line-height:1;width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:var(--spd-c);border-radius:50%;transform:translate(-50%,-50%);z-index:3;box-shadow:0 0 0 4px rgba(255,255,255,.35) inset,0 4px 10px rgba(0,0,0,.4);pointer-events:none;transition:transform .15s;}
.spd-port--near{transform:translate(-50%,-50%) scale(1.2);box-shadow:0 0 0 5px #fff inset,0 0 18px #fff;}
.spd-port--done{transform:translate(-50%,-50%) scale(1);box-shadow:0 0 0 4px #fff inset,0 0 14px var(--spd-c);}
.spd-ship{position:absolute;font-size:2rem;line-height:1;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:var(--spd-c);border-radius:12px;transform:translate(-50%,-50%) rotate(-45deg);z-index:5;box-shadow:0 4px 8px rgba(0,0,0,.4),0 0 0 3px rgba(255,255,255,.4) inset;cursor:grab;touch-action:none;user-select:none;transition:transform .1s;}
.spd-ship--drag{transform:translate(-50%,-50%) rotate(-45deg) scale(1.15);cursor:grabbing;box-shadow:0 8px 16px rgba(0,0,0,.5),0 0 0 3px #fff inset;}
.spd-ship--docked{cursor:default;animation:spd-pop .4s ease;}
@keyframes spd-pop{0%{transform:translate(-50%,-50%) rotate(-45deg) scale(1.3)}100%{transform:translate(-50%,-50%) rotate(-45deg) scale(1)}}
@media (max-width:380px){.spd-station{font-size:2.4rem;}.spd-port{font-size:1.6rem;width:40px;height:40px;}.spd-ship{font-size:1.6rem;width:38px;height:38px;}}
`;
}

export function create(): SpaceDockGame {
  return new SpaceDockGame();
}
