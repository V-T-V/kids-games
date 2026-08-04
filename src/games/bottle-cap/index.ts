/* 瓶盖配对 Bottle Cap —— 几个瓶子（瓶口不同颜色）和几个瓶盖（对应颜色），
   孩子把瓶盖拖到同色瓶口上盖好。独特点：精细拖拽 + 颜色一一对应，盖上去有"咔"反馈。
   巧思：每个瓶口只接同色瓶盖；颜色一一对应保证有解。难度 = 配对数。
   通关 = 配完目标轮数。用 bindPointer 拖拽。 */

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

interface Bottle {
  color: ColorDef;
  el: HTMLDivElement;
  mouth: HTMLDivElement;
  capped: boolean;
}

export class BottleCapGame extends BaseGame {
  constructor() {
    super("bottle-cap");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private bottles: Bottle[] = [];
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private pairCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.bottles = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const colors = shuffle(PALETTE).slice(0, this.pairCount());
    this.remaining = colors.length;

    const wrap = document.createElement("div");
    wrap.className = "bc-wrap";

    const task = document.createElement("div");
    task.className = "bc-task";
    task.innerHTML = `把瓶盖拖到 <b>同色</b> 的瓶口上！第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · <span id="bc-left">还剩 ${this.remaining} 个</span>`;
    wrap.appendChild(task);

    // 瓶子排（打乱顺序，增加匹配难度）
    const stage = document.createElement("div");
    stage.className = "bc-stage";
    shuffle(colors).forEach((c) => {
      const bottleEl = document.createElement("div");
      bottleEl.className = "bc-bottle";
      const body = document.createElement("div");
      body.className = "bc-bottle-body";
      body.style.setProperty("--bc-color", c.hex);
      const mouth = document.createElement("div");
      mouth.className = "bc-mouth";
      mouth.style.setProperty("--bc-color", c.hex);
      bottleEl.appendChild(mouth);
      bottleEl.appendChild(body);
      stage.appendChild(bottleEl);
      this.bottles.push({ color: c, el: bottleEl, mouth, capped: false });
    });
    wrap.appendChild(stage);

    // 瓶盖托盘（打乱顺序）
    const tray = document.createElement("div");
    tray.className = "bc-tray";
    shuffle(colors).forEach((c) => {
      const cap = document.createElement("div");
      cap.className = "bc-cap";
      cap.style.setProperty("--bc-color", c.hex);
      cap.setAttribute("aria-label", `${c.name}色瓶盖`);
      tray.appendChild(cap);
      this.enableDrag(cap, c);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private enableDrag(cap: HTMLElement, color: ColorDef): void {
    const u = bindPointer(cap, {
      down: (p) => this.startDrag(cap, color, p),
    });
    this.unbinds.push(u);
  }

  private startDrag(
    cap: HTMLElement,
    color: ColorDef,
    p0: { x: number; y: number },
  ): void {
    if (cap.classList.contains("bc-cap--gone")) return;
    const rect = cap.getBoundingClientRect();
    const ox = p0.x - rect.left;
    const oy = p0.y - rect.top;
    const placeholder = document.createElement("div");
    placeholder.className = "bc-cap-ph";
    cap.parentElement?.insertBefore(placeholder, cap);
    cap.classList.add("bc-cap--drag");
    cap.style.position = "fixed";
    cap.style.left = `${p0.x - ox}px`;
    cap.style.top = `${p0.y - oy}px`;
    document.body.appendChild(cap);

    const move = (pt: { x: number; y: number }) => {
      cap.style.left = `${pt.x - ox}px`;
      cap.style.top = `${pt.y - oy}px`;
    };
    const up = (pt: { x: number; y: number }) => {
      window.removeEventListener("pointermove", onMove as EventListener);
      window.removeEventListener("pointerup", onUp as EventListener);
      window.removeEventListener("pointercancel", onUp as EventListener);
      cap.classList.remove("bc-cap--drag");
      // 命中判定：指针落在同色且未盖的瓶口矩形内
      let placed = false;
      for (const b of this.bottles) {
        if (b.capped || b.color.hex !== color.hex) continue;
        const mr = b.mouth.getBoundingClientRect();
        if (
          pt.x >= mr.left &&
          pt.x <= mr.right &&
          pt.y >= mr.top - 10 &&
          pt.y <= mr.bottom + 10
        ) {
          this.snapCap(b, cap, placeholder);
          placed = true;
          break;
        }
      }
      if (!placed) {
        cap.style.position = "";
        cap.style.left = "";
        cap.style.top = "";
        placeholder.replaceWith(cap);
      }
    };
    const onMove = (e: PointerEvent) => move({ x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => up({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  private snapCap(b: Bottle, cap: HTMLElement, placeholder: HTMLElement): void {
    b.capped = true;
    b.el.classList.add("bc-bottle--capped");
    b.mouth.classList.add("bc-mouth--capped");
    b.mouth.style.setProperty("--bc-color", b.color.hex);
    cap.classList.add("bc-cap--gone");
    placeholder.remove();
    sfxPop();
    this.resetWrongStreak();
    const mr = b.mouth.getBoundingClientRect();
    this.onCorrect(mr.left + mr.width / 2, mr.top);

    this.remaining -= 1;
    const left = this.root.querySelector("#bc-left");
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
    if (document.getElementById("bc-style")) return;
    const st = document.createElement("style");
    st.id = "bc-style";
    st.textContent = BC_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function BC_CSS(theme: string): string {
  return `
.bc-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.bc-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.bc-stage{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:20px 16px 14px;background:rgba(255,255,255,.55);border-radius:20px;box-shadow:var(--shadow);max-width:440px;}
.bc-bottle{display:flex;flex-direction:column;align-items:center;transition:transform .25s;}
.bc-mouth{--bc-color:${theme};width:30px;height:14px;border-radius:6px 6px 3px 3px;background:var(--bc-color);box-shadow:inset 0 -3px 0 rgba(0,0,0,.2);position:relative;z-index:2;}
.bc-mouth--capped::after{content:"";position:absolute;left:50%;top:-10px;transform:translateX(-50%);width:42px;height:20px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,var(--bc-color));box-shadow:inset 0 -3px 5px rgba(0,0,0,.25);animation:bc-snap .3s ease;}
@keyframes bc-snap{0%{transform:translateX(-50%) translateY(-20px) scale(1.3)}100%{transform:translateX(-50%) translateY(0) scale(1)}}
.bc-bottle-body{--bc-color:${theme};width:50px;height:96px;border-radius:14px 14px 18px 18px;background:linear-gradient(180deg,color-mix(in srgb,var(--bc-color) 60%,#fff) 0%,var(--bc-color) 100%);box-shadow:inset -6px 0 0 rgba(0,0,0,.1),inset 6px 0 0 rgba(255,255,255,.25),var(--shadow);position:relative;margin-top:-2px;}
.bc-bottle-body::before{content:"";position:absolute;top:30%;left:14%;width:30%;height:30%;background:rgba(255,255,255,.4);border-radius:50%;filter:blur(1px);}
.bc-bottle--capped{animation:bc-pop .35s ease;}
@keyframes bc-pop{0%{transform:scale(1)}50%{transform:scale(1.1) translateY(-4px)}100%{transform:scale(1)}}
.bc-tray{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:18px;box-shadow:var(--shadow);max-width:440px;min-height:72px;}
.bc-cap{--bc-color:${theme};width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,var(--bc-color));box-shadow:inset 0 -5px 7px rgba(0,0,0,.22),0 4px 8px rgba(0,0,0,.15);cursor:grab;touch-action:none;transition:transform .12s;position:relative;}
.bc-cap::after{content:"";position:absolute;top:22%;left:28%;width:28%;height:28%;background:rgba(255,255,255,.5);border-radius:50%;}
.bc-cap:active{transform:scale(.9);}
.bc-cap--drag{cursor:grabbing;transform:scale(1.18);z-index:200;box-shadow:inset 0 -5px 7px rgba(0,0,0,.22),0 10px 20px rgba(0,0,0,.3);}
.bc-cap--gone{display:none;}
.bc-cap-ph{width:54px;height:54px;border-radius:50%;border:2px dashed rgba(0,0,0,.15);background:rgba(0,0,0,.03);}
@media (max-width:380px){.bc-bottle-body{width:42px;height:82px;}.bc-mouth{width:26px;}.bc-cap,.bc-cap-ph{width:46px;height:46px;}}
`;
}

export function create(): BottleCapGame {
  return new BottleCapGame();
}
