/* 拧瓶盖 Screw-Cap —— 拖着瓶盖绕圆心转一圈，把它拧紧。
   独特点：旋转手势精细练习。视觉：瓶子 + 瓶盖（带把手），盖子随手指绕圆心旋转。
   巧思：累计转过的角度到达 360°，盖子咔嗒拧紧；沙盒类，finishClear(3)。前缀 scr-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar } from "../../lobby/util.ts";

export class ScrewCapGame extends BaseGame {
  constructor() {
    super("screw-cap");
  }
  private unbind: (() => void) | null = null;
  private center = { x: 0, y: 0 };
  private lastAngle = 0;
  private turned = 0; // 累计转过的度数（绝对值，正向）
  private cap: HTMLDivElement | null = null;
  private done = false;

  protected mount(): void {
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.done = false;
    this.root.innerHTML = "";
    this.turned = 0;

    const wrap = document.createElement("div");
    wrap.className = "scr-wrap";
    const task = document.createElement("div");
    task.className = "scr-task";
    task.innerHTML = `拖动瓶盖的把手，<b>转一整圈</b>把它拧紧～`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "scr-stage";
    const bottle = document.createElement("div");
    bottle.className = "scr-bottle";
    bottle.innerHTML = `<div class="scr-neck"></div>`;
    const ring = document.createElement("div");
    ring.className = "scr-ring"; // 进度环槽
    stage.appendChild(ring);
    const ringFill = document.createElement("div");
    ringFill.className = "scr-ring-fill";
    ringFill.style.setProperty("--scr-pct", "0%");
    stage.appendChild(ringFill);

    const cap = document.createElement("div");
    cap.className = "scr-cap";
    cap.innerHTML = `<div class="scr-cap__top"></div><div class="scr-cap__handle">👆</div>`;
    stage.appendChild(cap);
    bottle.appendChild(stage);
    wrap.appendChild(bottle);

    const meter = document.createElement("div");
    meter.className = "scr-meter";
    meter.id = "scr-meter";
    meter.innerHTML = `<span id="scr-deg">0</span>° / 360°`;
    wrap.appendChild(meter);

    this.root.appendChild(wrap);
    this.cap = cap;

    // 初始化旋转中心和把手角度
    requestAnimationFrame(() => {
      const r = stage.getBoundingClientRect();
      this.center = {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
      };
      const a = this.angleToCenter(this.center.x, this.center.y);
      this.lastAngle = a;
      this.placeCap(a);
    });

    this.unbind = bindPointer(cap, {
      down: () => {
        // 旋转中心在按下时刷新一次（防布局变化）
        const r = stage.getBoundingClientRect();
        this.center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        const a = this.angleToCenter(this.center.x, this.center.y);
        this.lastAngle = a;
      },
      move: (p) => {
        if (this.done) return;
        const a = this.angleToCenter(p.x, p.y);
        let delta = a - this.lastAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        this.turned += Math.abs(delta);
        this.lastAngle = a;
        this.placeCap(a);
        this.updateMeter();
        if (this.turned >= 360) this.finish();
      },
      up: () => {
        /* 松手不重置，继续累计 */
      },
    });
  }

  /** 指针相对圆心的角度（度）。 */
  private angleToCenter(x: number, y: number): number {
    return (Math.atan2(y - this.center.y, x - this.center.x) * 180) / Math.PI;
  }

  /** 把盖子放到指定角度的位置（绕圆心）。 */
  private placeCap(angle: number): void {
    if (!this.cap) return;
    this.cap.style.setProperty("--scr-rot", `${angle}deg`);
  }

  private updateMeter(): void {
    const pct = Math.min(100, (this.turned / 360) * 100);
    const deg = document.getElementById("scr-deg");
    if (deg) deg.textContent = String(Math.min(360, Math.round(this.turned)));
    this.root
      .querySelector<HTMLElement>(".scr-ring-fill")
      ?.style.setProperty("--scr-pct", `${pct}%`);
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.cap?.classList.add("scr-cap--tight");
    sfxPop();
    this.onCorrect(this.center.x, this.center.y);
    this.trackTimeout(() => {
      this.finishClear(3);
    }, 900);
  }

  private injectStyle(): void {
    if (document.getElementById("scr-style")) return;
    const st = document.createElement("style");
    st.id = "scr-style";
    st.textContent = SCR_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function SCR_CSS(theme: string): string {
  return `
.scr-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(420px,100%);}
.scr-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.scr-task b{color:${theme};}
.scr-bottle{display:flex;flex-direction:column;align-items:center;}
.scr-neck{width:70px;height:36px;background:linear-gradient(180deg,#cdeede,#9fd8d8);border-radius:6px 6px 0 0;}
.scr-stage{position:relative;width:200px;height:200px;display:flex;align-items:center;justify-content:center;}
.scr-ring{position:absolute;inset:18px;border-radius:50%;border:8px dashed rgba(0,0,0,.12);}
.scr-ring-fill{position:absolute;inset:18px;border-radius:50%;background:conic-gradient(${theme} calc(var(--scr-pct,0%)),transparent 0);mask:radial-gradient(circle,transparent 56%,#000 58%);-webkit-mask:radial-gradient(circle,transparent 56%,#000 58%);}
.scr-cap{position:absolute;width:120px;height:120px;display:flex;align-items:center;justify-content:center;transform:rotate(var(--scr-rot,0deg));transition:transform .04s linear;cursor:grab;touch-action:none;}
.scr-cap:active{cursor:grabbing;}
.scr-cap__top{position:absolute;width:96px;height:96px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,${theme});box-shadow:0 4px 8px rgba(0,0,0,.25),inset 0 -4px 6px rgba(0,0,0,.2);}
.scr-cap__handle{position:absolute;top:-4px;left:50%;transform:translateX(-50%);font-size:1.6rem;background:#fff;padding:2px 8px;border-radius:999px;box-shadow:var(--shadow);}
.scr-cap--tight .scr-cap__top{box-shadow:0 4px 8px rgba(0,0,0,.25),inset 0 -4px 6px rgba(0,0,0,.2),0 0 0 4px #6bcf7f;animation:scr-tight .4s ease;}
@keyframes scr-tight{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
.scr-meter{font-size:1.1rem;font-weight:800;color:#555;background:#fff;padding:8px 22px;border-radius:999px;box-shadow:var(--shadow);}
#scr-deg{color:${theme};}
@media (max-width:380px){.scr-stage{width:170px;height:170px;}.scr-cap{width:100px;height:100px;}.scr-cap__top{width:82px;height:82px;}}
`;
}

export function create(): ScrewCapGame {
  return new ScrewCapGame();
}
