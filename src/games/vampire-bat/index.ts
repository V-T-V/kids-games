/* 吸血蝙蝠 Vampire Bat —— 蝙蝠在暗洞深处，一束光从洞口扫进洞里，
   孩子要在 <b>光没照到蝙蝠</b> 时点"移动"按钮，蝙蝠就向洞口逃一步；
   光照到时点移动会被发现（计错），蝙蝠退回一步。
   独特点：时机判断 + 避光。视觉：洞穴 + 蝙蝠 + 扫动光束（RAF）。
   难度=光束速度。通关=逃出洞口的目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

export class VampireBatGame extends BaseGame {
  constructor() {
    super("vampire-bat");
  }
  private raf = 0;
  private over = false;
  private last = 0;

  /** 光束当前角度（弧度），从洞口（右上）向洞穴内扫动 */
  private beam = 0;
  /** 光束角速度 rad/s */
  private omega = 1.6;
  /** 光束半宽（弧度） */
  private half = 0.22;

  /** 蝙蝠位置（0=洞底，1=洞口逃出）。progress 1 时过关 */
  private progress = 0;
  private stepsTotal = 5;

  private roundsDone = 0;
  private roundTotal = 0;

  private beamEl!: HTMLDivElement;
  private batEl!: HTMLDivElement;
  private lightOn = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.omega =
      this.difficulty === "easy"
        ? 1.1
        : this.difficulty === "medium"
          ? 1.7
          : 2.4;
    this.half =
      this.difficulty === "easy"
        ? 0.28
        : this.difficulty === "medium"
          ? 0.22
          : 0.17;
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
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.progress = 0;
    this.beam = 0;

    const wrap = document.createElement("div");
    wrap.className = "vbt-wrap";

    const task = document.createElement("div");
    task.className = "vbt-task";
    task.innerHTML = `趁<b>黑暗</b>时点"飞"，带蝙蝠逃出洞！<br><span class="vbt-hint">第 ${this.roundsDone + 1} / ${this.roundTotal} 关 · 已飞 <b id="vbt-prog">0</b> / ${this.stepsTotal}</span>`;
    wrap.appendChild(task);

    const cave = document.createElement("div");
    cave.className = "vbt-cave";
    cave.id = "vbt-cave";

    // 洞口光晕（右上）
    const exit = document.createElement("div");
    exit.className = "vbt-exit";
    exit.innerHTML = `<span class="vbt-moon">🌙</span>`;
    cave.appendChild(exit);

    // 光束（从右上洞口旋转扫入）
    this.beamEl = document.createElement("div");
    this.beamEl.className = "vbt-beam";
    cave.appendChild(this.beamEl);

    // 蝙蝠
    this.batEl = document.createElement("div");
    this.batEl.className = "vbt-bat";
    this.batEl.id = "vbt-bat";
    this.batEl.textContent = "🦇";
    cave.appendChild(this.batEl);

    wrap.appendChild(cave);

    // 移动按钮
    const moveBtn = document.createElement("button");
    moveBtn.type = "button";
    moveBtn.className = "vbt-move";
    moveBtn.innerHTML = `<span>🦇 飞！</span>`;
    moveBtn.addEventListener("click", () => this.fly());
    wrap.appendChild(moveBtn);

    this.root.appendChild(wrap);
    this.placeBat();

    this.last = performance.now();
    this.loop();
  }

  /** 蝙蝠在洞穴里的位置（左下角起点，向右上洞口前进） */
  private placeBat(): void {
    // 起点左下 (12%, 78%)，终点右上洞口 (82%, 18%)
    const t = this.progress / this.stepsTotal;
    const x = 12 + t * 70;
    const y = 78 - t * 60;
    this.batEl.style.left = `${x}%`;
    this.batEl.style.top = `${y}%`;
  }

  /** 蝙蝠当前在洞穴中的极角（相对洞口光源中心 82%,18%）。
   *  光束 angle=0 朝向洞穴深处（左下方向），随 beam 增大扫向不同方向。 */
  private batAngle(): number {
    const t = this.progress / this.stepsTotal;
    const bx = 12 + t * 70;
    const by = 78 - t * 60;
    // 洞口光源
    const ox = 82;
    const oy = 18;
    // 以洞口为原点的方向角（屏幕坐标，y 向下）
    return Math.atan2(by - oy, bx - ox);
  }

  private inBeam(): boolean {
    let d = this.batAngle() - this.beam;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d) <= this.half;
  }

  private fly(): void {
    if (this.over) return;
    if (this.inBeam()) {
      // 被光照到！计错，退一步（但不低于 0）
      this.batEl.classList.add("vbt-bat--caught");
      this.trackTimeout(
        () => this.batEl.classList.remove("vbt-bat--caught"),
        400,
      );
      const paused = this.onWrong();
      this.progress = Math.max(0, this.progress - 1);
      this.placeBat();
      const p = this.root.querySelector<HTMLElement>("#vbt-prog");
      if (p) p.textContent = String(this.progress);
      if (paused) this.showRest();
    } else {
      // 安全前进
      this.progress += 1;
      sfxPop();
      this.resetWrongStreak();
      this.batEl.classList.add("vbt-bat--fly");
      this.trackTimeout(() => this.batEl.classList.remove("vbt-bat--fly"), 300);
      this.placeBat();
      const p = this.root.querySelector<HTMLElement>("#vbt-prog");
      if (p) p.textContent = String(this.progress);
      // 命中粒子（蝙蝠当前位置）
      const r = this.batEl.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      if (this.progress >= this.stepsTotal) {
        this.over = true;
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 800);
      }
    }
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    this.beam += this.omega * dt;
    if (this.beam > Math.PI * 2) this.beam -= Math.PI * 2;
    // 光束视觉旋转（光束基线朝洞穴深处为 0 度，对应 atan2(深-光,深-光)≈135°）
    // 屏幕坐标系下，洞口(右上)指向蝙蝠(左下)的方向角约为 135°，光束 CSS rotate 以此为基准
    const deg = (this.beam * 180) / Math.PI + 135;
    this.beamEl.style.transform = `rotate(${deg}deg)`;
    // 蝙蝠高亮提示当前是否在光里
    const lit = this.inBeam();
    if (lit !== this.lightOn) {
      this.lightOn = lit;
      this.batEl.classList.toggle("vbt-bat--lit", lit);
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "等光束扫过去、蝙蝠变暗的时候再点飞～",
      primary: { text: "继续", icon: "🦇", onClick: () => ov.destroy() },
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
    if (document.getElementById("vbt-style")) return;
    const st = document.createElement("style");
    st.id = "vbt-style";
    st.textContent = VBT_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function VBT_CSS(theme: string): string {
  return `
.vbt-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.vbt-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.vbt-task b{color:${theme};}
.vbt-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.vbt-cave{position:relative;width:100%;max-width:480px;height:340px;border-radius:24px;overflow:hidden;background:radial-gradient(circle at 80% 20%,#3a3358 0%,#1f1b33 45%,#0f0d1c 100%);box-shadow:var(--shadow-lg);}
.vbt-cave::before{content:"";position:absolute;inset:0;background:repeating-radial-gradient(circle at 30% 70%,rgba(255,255,255,.03) 0 4px,transparent 4px 10px);}
.vbt-exit{position:absolute;top:6%;right:8%;z-index:2;}
.vbt-moon{font-size:2.2rem;filter:drop-shadow(0 0 12px #ffe9a8);animation:vbt-glow 2.5s ease-in-out infinite;}
@keyframes vbt-glow{0%,100%{filter:drop-shadow(0 0 10px #ffe9a8)}50%{filter:drop-shadow(0 0 20px #ffe9a8)}}
.vbt-beam{position:absolute;top:18%;right:18%;width:0;height:0;z-index:3;pointer-events:none;transform-origin:top right;}
.vbt-beam::before{content:"";position:absolute;top:0;left:0;width:340px;height:340px;background:linear-gradient(0deg,rgba(255,233,168,0) 0%,rgba(255,233,168,.55) 80%,rgba(255,233,168,.85) 100%);clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:top right;filter:blur(2px);}
.vbt-bat{position:absolute;font-size:2.6rem;z-index:4;transform:translate(-50%,-50%);transition:left .35s cubic-bezier(.5,-.2,.5,1.2),top .35s cubic-bezier(.5,-.2,.5,1.2);filter:drop-shadow(0 0 6px #fff3);animation:vbt-hover 1.8s ease-in-out infinite;}
@keyframes vbt-hover{0%,100%{transform:translate(-50%,-50%) rotate(-3deg)}50%{transform:translate(-50%,-55%) rotate(3deg)}}
.vbt-bat--lit{filter:drop-shadow(0 0 14px #ffe9a8) brightness(1.4);animation:none;}
.vbt-bat--fly{animation:vbt-flap .3s ease;}
@keyframes vbt-flap{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-60%) scale(1.2) rotate(8deg)}100%{transform:translate(-50%,-50%) scale(1)}}
.vbt-bat--caught{animation:vbt-caught .4s ease;}
@keyframes vbt-caught{0%,100%{transform:translate(-50%,-50%)}25%{transform:translate(calc(-50% - 6px),-50%) rotate(-10deg)}75%{transform:translate(calc(-50% + 6px),-50%) rotate(10deg)}}
.vbt-move{min-width:160px;height:64px;font-size:1.4rem;font-weight:900;border:none;border-radius:20px;background:linear-gradient(180deg,${theme},#4338ca);color:#fff;box-shadow:var(--shadow-lg),inset 0 -4px 0 rgba(0,0,0,.2);cursor:pointer;transition:transform .12s ease;}
.vbt-move:active{transform:translateY(3px) scale(.98);}
@media (max-width:380px){.vbt-cave{height:290px;}.vbt-bat{font-size:2rem;}}
`;
}

export function create(): VampireBatGame {
  return new VampireBatGame();
}
