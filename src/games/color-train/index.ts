/* 颜色火车 Color Train —— 火车头后面几节车厢标着目标颜色，孩子把彩色货物球
   拖到对应颜色的车厢。独特点：颜色匹配 + 拖拽进位，车厢装满会冒烟点头。
   巧思：每节车厢有 2 个货位；货物颜色与车厢颜色一一对应，保证有解。
   难度 = 车厢数。通关 = 装完目标轮数。用 bindPointer 拖拽。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface ColorDef {
  hex: string;
  name: string;
}

const PALETTE: ColorDef[] = [
  { hex: "#ff6b9d", name: "粉" },
  { hex: "#4d96ff", name: "蓝" },
  { hex: "#6bcf7f", name: "绿" },
  { hex: "#ffd93d", name: "黄" },
  { hex: "#ff9f43", name: "橙" },
  { hex: "#a55eea", name: "紫" },
];

interface Car {
  color: ColorDef;
  el: HTMLDivElement;
  slots: HTMLDivElement[];
}

export class ColorTrainGame extends BaseGame {
  constructor() {
    super("color-train");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private cars: Car[] = [];
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private carCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.cars = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const colors = shuffle(PALETTE).slice(0, this.carCount());
    this.remaining = colors.length * 2; // 每车厢 2 个货物

    const wrap = document.createElement("div");
    wrap.className = "ct2-wrap";

    const task = document.createElement("div");
    task.className = "ct2-task";
    task.innerHTML = `把彩色球拖到 <b>同色</b> 车厢里！第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · <span id="ct2-left">还剩 ${this.remaining} 个</span>`;
    wrap.appendChild(task);

    // 火车
    const train = document.createElement("div");
    train.className = "ct2-train";
    const head = document.createElement("div");
    head.className = "ct2-head";
    head.innerHTML = `<div class="ct2-head-emoji">🚂</div><div class="ct2-puff"></div>`;
    train.appendChild(head);
    colors.forEach((c) => {
      const carEl = document.createElement("div");
      carEl.className = "ct2-car";
      carEl.style.setProperty("--ct2-color", c.hex);
      const label = document.createElement("div");
      label.className = "ct2-car-label";
      label.textContent = c.name;
      const slots = document.createElement("div");
      slots.className = "ct2-car-slots";
      const slotEls: HTMLDivElement[] = [];
      for (let i = 0; i < 2; i++) {
        const s = document.createElement("div");
        s.className = "ct2-slot";
        slots.appendChild(s);
        slotEls.push(s);
      }
      carEl.appendChild(label);
      carEl.appendChild(slots);
      train.appendChild(carEl);
      this.cars.push({ color: c, el: carEl, slots: slotEls });
    });
    wrap.appendChild(train);

    // 轨道
    const rail = document.createElement("div");
    rail.className = "ct2-rail";
    rail.setAttribute("aria-hidden", "true");
    wrap.appendChild(rail);

    // 货物托盘
    const tray = document.createElement("div");
    tray.className = "ct2-tray";
    const cargos: { color: ColorDef }[] = [];
    colors.forEach((c) => {
      cargos.push({ color: c });
      cargos.push({ color: c });
    });
    shuffle(cargos).forEach((cargo) => {
      const ball = document.createElement("div");
      ball.className = "ct2-ball";
      ball.style.setProperty("--ct2-color", cargo.color.hex);
      ball.setAttribute("aria-label", `${cargo.color.name}色货物`);
      tray.appendChild(ball);
      this.enableDrag(ball, cargo.color);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  /** 拖拽货物球到车厢。 */
  private enableDrag(ball: HTMLElement, color: ColorDef): void {
    const u = bindPointer(ball, {
      down: (p) => this.startDrag(ball, color, p),
    });
    this.unbinds.push(u);
  }

  private startDrag(
    ball: HTMLElement,
    color: ColorDef,
    p0: { x: number; y: number },
  ): void {
    if (ball.classList.contains("ct2-ball--gone")) return;
    const rect = ball.getBoundingClientRect();
    const ox = p0.x - rect.left;
    const oy = p0.y - rect.top;
    const placeholder = document.createElement("div");
    placeholder.className = "ct2-ball-ph";
    ball.parentElement?.insertBefore(placeholder, ball);
    // 切到 fixed 跟随指针，挂到 body 防裁剪
    const prevParent = ball.parentElement;
    ball.classList.add("ct2-ball--drag");
    ball.style.position = "fixed";
    ball.style.left = `${p0.x - ox}px`;
    ball.style.top = `${p0.y - oy}px`;
    document.body.appendChild(ball);

    const move = (pt: { x: number; y: number }) => {
      ball.style.left = `${pt.x - ox}px`;
      ball.style.top = `${pt.y - oy}px`;
    };
    const up = (pt: { x: number; y: number }) => {
      window.removeEventListener("pointermove", onMove as EventListener);
      window.removeEventListener("pointerup", onUp as EventListener);
      window.removeEventListener("pointercancel", onUp as EventListener);
      ball.classList.remove("ct2-ball--drag");
      // 命中判定：找同色车厢中第一个空槽，指针落在车厢矩形内或附近（容差 20px）
      let placed = false;
      let bestDist = Infinity;
      let bestSlot: HTMLDivElement | undefined;
      let bestCar: Car | undefined;
      for (const car of this.cars) {
        if (car.color.hex !== color.hex) continue;
        const slot = car.slots.find(
          (s) => !s.classList.contains("ct2-slot--filled"),
        );
        if (!slot) continue;
        const cr = car.el.getBoundingClientRect();
        // 扩大命中区域：在车厢矩形内或距离边缘 20px 以内
        const near =
          pt.x >= cr.left - 20 &&
          pt.x <= cr.right + 20 &&
          pt.y >= cr.top - 20 &&
          pt.y <= cr.bottom + 20;
        if (near) {
          const cx = cr.left + cr.width / 2;
          const cy = cr.top + cr.height / 2;
          const dist = Math.hypot(pt.x - cx, pt.y - cy);
          if (dist < bestDist) {
            bestDist = dist;
            bestSlot = slot;
            bestCar = car;
          }
        }
      }
      if (bestSlot && bestCar) {
        this.fillSlot(bestSlot, color, bestCar, ball, placeholder);
        placed = true;
      }
      if (!placed) {
        // 归位到托盘
        ball.style.position = "";
        ball.style.left = "";
        ball.style.top = "";
        placeholder.replaceWith(ball);
      }
    };
    const onMove = (e: PointerEvent) => move({ x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => up({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    void prevParent;
  }

  private fillSlot(
    slot: HTMLDivElement,
    color: ColorDef,
    car: Car,
    ball: HTMLElement,
    placeholder: HTMLElement,
  ): void {
    slot.classList.add("ct2-slot--filled");
    slot.style.setProperty("--ct2-color", color.hex);
    ball.classList.add("ct2-ball--gone");
    placeholder.remove();
    sfxPop();
    this.resetWrongStreak();
    // 车厢装满 → 冒烟点头
    if (car.slots.every((s) => s.classList.contains("ct2-slot--filled"))) {
      car.el.classList.add("ct2-car--full");
      this.onCorrect(
        car.el.getBoundingClientRect().left +
          car.el.getBoundingClientRect().width / 2,
        car.el.getBoundingClientRect().top,
      );
    }
    this.remaining -= 1;
    const left = this.root.querySelector("#ct2-left");
    if (left) left.textContent = `还剩 ${this.remaining} 个`;

    if (this.remaining <= 0) {
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 700);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("ct2-style")) return;
    const st = document.createElement("style");
    st.id = "ct2-style";
    st.textContent = CT2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function CT2_CSS(theme: string): string {
  return `
.ct2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.ct2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.ct2-train{display:flex;align-items:flex-end;gap:6px;flex-wrap:nowrap;justify-content:center;width:100%;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch;}
.ct2-head{position:relative;display:flex;flex-direction:column;align-items:center;}
.ct2-head-emoji{font-size:3.4rem;line-height:1;filter:drop-shadow(0 4px 4px rgba(0,0,0,.2));}
.ct2-puff{width:14px;height:14px;background:rgba(255,255,255,.85);border-radius:50%;margin-top:-6px;animation:ct2-smoke 1.4s ease-out infinite;}
@keyframes ct2-smoke{0%{transform:translate(0,0) scale(.6);opacity:.9}100%{transform:translate(-14px,-30px) scale(1.6);opacity:0}}
.ct2-car{--ct2-color:${theme};display:flex;flex-direction:column;align-items:center;gap:4px;width:80px;min-width:80px;background:linear-gradient(180deg,color-mix(in srgb,var(--ct2-color) 85%,#fff),var(--ct2-color));border-radius:12px 12px 6px 6px;padding:6px 4px 10px;box-shadow:var(--shadow),inset 0 -4px 0 rgba(0,0,0,.12);transition:transform .2s;position:relative;}
.ct2-car::before{content:"";position:absolute;bottom:-8px;left:8px;right:8px;height:8px;background:#444;border-radius:0 0 6px 6px;}
.ct2-car-label{font-size:.85rem;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.3);}
.ct2-car-slots{display:flex;gap:4px;}
.ct2-slot{width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.35);box-shadow:inset 0 2px 4px rgba(0,0,0,.2);border:2px dashed rgba(255,255,255,.7);}
.ct2-slot--filled{--ct2-color:${theme};background:radial-gradient(circle at 35% 30%,#fff6,var(--ct2-color));border-style:solid;border-color:transparent;box-shadow:inset 0 -2px 4px rgba(0,0,0,.2);animation:ct2-pop .3s ease;}
@keyframes ct2-pop{0%{transform:scale(.4)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
.ct2-car--full{animation:ct2-bounce .5s ease;}
@keyframes ct2-bounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
.ct2-rail{width:100%;height:8px;background:repeating-linear-gradient(90deg,#8d6e63 0 22px,#6d4c41 22px 28px);border-radius:4px;box-shadow:var(--shadow);}
.ct2-tray{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:18px;box-shadow:var(--shadow);max-width:440px;min-height:72px;}
.ct2-ball{--ct2-color:${theme};width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff6,var(--ct2-color));box-shadow:inset 0 -4px 6px rgba(0,0,0,.18),0 4px 8px rgba(0,0,0,.15);cursor:grab;touch-action:none;transition:transform .12s;}
.ct2-ball:active{transform:scale(.9);}
.ct2-ball--drag{cursor:grabbing;transform:scale(1.15);z-index:200;box-shadow:inset 0 -4px 6px rgba(0,0,0,.18),0 8px 18px rgba(0,0,0,.3);}
.ct2-ball--gone{display:none;}
.ct2-ball-ph{width:54px;height:54px;border-radius:50%;border:2px dashed rgba(0,0,0,.15);background:rgba(0,0,0,.03);}
@media (max-width:380px){.ct2-car{width:64px;}.ct2-ball,.ct2-ball-ph{width:46px;height:46px;}}
`;
}

export function create(): ColorTrainGame {
  return new ColorTrainGame();
}
