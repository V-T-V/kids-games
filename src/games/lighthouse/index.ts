/* 灯塔 Lighthouse —— 灯塔光束像探照灯一样旋转扫过海面，
   孩子要在光束扫到某艘船的瞬间点亮它（点船）。
   独特点：时机反应——只有光束扫到船时点船才会被照亮（区别于随便点）。
   视觉：夜空 + 灯塔 + 旋转光束（CSS conic/旋转 div）+ 小船 emoji。
   难度=船数/光束转速。通关=照亮目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Boat {
  el: HTMLButtonElement;
  /** 极角（弧度，相对灯塔光源中心），0=右，逆时针正 */
  angle: number;
  lit: boolean;
}

const BOAT_EMOJIS = ["🛶", "⛵", "🚤", "🛳️"];

export class LighthouseGame extends BaseGame {
  constructor() {
    super("lighthouse");
  }

  private raf = 0;
  private over = false;
  private last = 0;
  /** 光束当前指向角度（弧度），随时间增长 */
  private beam = 0;
  /** 光束角速度 rad/s */
  private omega = 1.4;
  /** 光束半宽（弧度） */
  private half = 0.18;

  private beamEl!: HTMLDivElement;
  private boats: Boat[] = [];
  private need = 0;
  private lit = 0;
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private startRound(): void {
    this.over = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root.innerHTML = "";

    this.omega =
      this.difficulty === "easy"
        ? 1.1
        : this.difficulty === "medium"
          ? 1.6
          : 2.2;
    this.half =
      this.difficulty === "easy"
        ? 0.26
        : this.difficulty === "medium"
          ? 0.2
          : 0.16;
    const boatCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.need = boatCount;
    this.lit = 0;
    this.beam = -Math.PI / 2;

    const wrap = document.createElement("div");
    wrap.className = "lh-wrap";
    const task = document.createElement("div");
    task.className = "lh-task";
    task.id = "lh-task";
    task.innerHTML = `光束照到 <b>船</b> 时，快点亮它！<br><span class="lh-hint">已照亮 <b id="lh-lit">0</b> / ${this.need} · 第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const sea = document.createElement("div");
    sea.className = "lh-sea";
    sea.id = "lh-sea";

    // 灯塔（视觉装饰，固定在顶部中央）
    const tower = document.createElement("div");
    tower.className = "lh-tower";
    tower.innerHTML = `<div class="lh-light">🗼</div>`;
    sea.appendChild(tower);

    // 光束（从灯塔光源中心旋转的扇形）
    this.beamEl = document.createElement("div");
    this.beamEl.className = "lh-beam";
    sea.appendChild(this.beamEl);

    // 船：分布在海面下半圈
    this.boats = [];
    const emojis = shuffle(BOAT_EMOJIS);
    for (let i = 0; i < boatCount; i++) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "lh-boat";
      el.textContent = emojis[i % emojis.length]!;
      const angle = Math.PI * 0.15 + Math.PI * 0.7 * ((i + 0.5) / boatCount);
      sea.appendChild(el);
      const b: Boat = { el, angle, lit: false };
      this.placeBoat(b);
      el.addEventListener("click", () => this.tryLight(b));
      this.boats.push(b);
    }

    wrap.appendChild(sea);
    this.root.appendChild(wrap);

    this.last = performance.now();
    this.loop();
  }

  /** 把船按极角摆在海面上（相对灯塔光源中心） */
  private placeBoat(b: Boat): void {
    const radius = 130;
    const cx = 50; // %
    const cy = 22; // % （光源大致在海面顶部）
    const x = cx + (radius / 3.6) * Math.cos(b.angle);
    const y = cy + (radius / 2.4) * Math.sin(b.angle);
    b.el.style.left = `${x}%`;
    b.el.style.top = `${y}%`;
  }

  /** 光束是否覆盖某船角度 */
  private inBeam(angle: number): boolean {
    let d = angle - this.beam;
    // 归一到 [-PI, PI]
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d) <= this.half;
  }

  private tryLight(b: Boat): void {
    if (this.over || b.lit) return;
    if (this.inBeam(b.angle)) {
      b.lit = true;
      b.el.classList.add("lh-boat--lit");
      this.lit += 1;
      this.resetWrongStreak();
      sfxPop();
      const r = b.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      const litEl = this.root.querySelector("#lh-lit");
      if (litEl) litEl.textContent = String(this.lit);
      if (this.lit >= this.need) {
        this.over = true;
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 800);
      }
    } else {
      // 光束没照到，提示但不判错（避免太挫败）—— 仅短暂抖动
      b.el.classList.add("lh-boat--shake");
      this.trackTimeout(() => b.el.classList.remove("lh-boat--shake"), 300);
      // 连续错点 3 次才算一次 wrong（温和护盾）
      this.missCount = (this.missCount ?? 0) + 1;
      if ((this.missCount ?? 0) % 3 === 0) {
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    }
  }
  private missCount = 0;

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    this.beam += this.omega * dt;
    // 旋转光束：从灯塔光源向下扫，beam=PI/2 时朝下
    const deg = (this.beam * 180) / Math.PI;
    this.beamEl.style.transform = `rotate(${deg}deg)`;
    // 高亮当前在光束里的船
    for (const b of this.boats) {
      if (!b.lit) b.el.classList.toggle("lh-boat--glow", this.inBeam(b.angle));
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "等光束扫到船再点亮它哦～",
      primary: { text: "继续", icon: "🗼", onClick: () => ov.destroy() },
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
    if (document.getElementById("lh-style")) return;
    const st = document.createElement("style");
    st.id = "lh-style";
    st.textContent = LH_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function LH_CSS(theme: string): string {
  return `
.lh-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.lh-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.lh-task b{color:${theme};}
.lh-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.lh-sea{position:relative;width:min(440px,94vw);height:380px;border-radius:24px;background:linear-gradient(180deg,#0d1b3e 0%,#1a3a6b 45%,#0a2a52 100%);box-shadow:var(--shadow-lg);overflow:hidden;}
.lh-sea::after{content:"";position:absolute;left:0;right:0;bottom:0;height:38%;background:repeating-linear-gradient(180deg,rgba(255,255,255,.08) 0 6px,transparent 6px 12px);animation:lh-tide 4s linear infinite;}
@keyframes lh-tide{from{background-position:0 0}to{background-position:24px 0}}
.lh-tower{position:absolute;top:6px;left:50%;transform:translateX(-50%);width:64px;text-align:center;z-index:5;filter:drop-shadow(0 4px 6px rgba(0,0,0,.4));}
.lh-light{font-size:3rem;animation:lh-blink 1.4s ease-in-out infinite;}
@keyframes lh-blink{0%,100%{filter:drop-shadow(0 0 8px ${theme})}50%{filter:drop-shadow(0 0 18px ${theme})}}
.lh-beam{position:absolute;top:22%;left:50%;width:6px;height:0;transform-origin:top center;z-index:3;pointer-events:none;}
.lh-beam::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);width:140px;height:380px;background:linear-gradient(180deg,${theme}cc 0%,${theme}66 40%,${theme}00 100%);clip-path:polygon(50% 0,100% 100%,0 100%);filter:blur(2px);opacity:.85;}
.lh-boat{position:absolute;border:none;background:transparent;font-size:2.2rem;cursor:pointer;transform:translate(-50%,-50%);filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));transition:transform .12s ease,filter .12s ease;line-height:1;padding:4px;}
.lh-boat:active{transform:translate(-50%,-50%) scale(.9);}
.lh-boat--glow{filter:drop-shadow(0 0 10px ${theme}) brightness(1.15);}
.lh-boat--lit{filter:drop-shadow(0 0 14px #fff) brightness(1.3);animation:lh-lit .5s ease;}
@keyframes lh-lit{0%{transform:translate(-50%,-50%) scale(1.3)}100%{transform:translate(-50%,-50%) scale(1)}}
.lh-boat--shake{animation:lh-shake .3s ease;}
@keyframes lh-shake{0%,100%{transform:translate(-50%,-50%)}25%{transform:translate(calc(-50% - 6px),-50%)}75%{transform:translate(calc(-50% + 6px),-50%)}}
@media (max-width:380px){.lh-sea{height:330px;}.lh-boat{font-size:1.9rem;}}
`;
}

export function create(): LighthouseGame {
  return new LighthouseGame();
}
