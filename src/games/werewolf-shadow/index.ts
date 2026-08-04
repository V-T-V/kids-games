/* 狼人影子 Werewolf Shadow —— 狼人在月光下走来走去，影子投在地上。
   孩子要点地上的<b>影子</b>位置踩住它。月亮角度变化时影子方向会变。
   独特点：空间追踪 + 角度判断。视觉：夜空 + 月亮 + 走动的狼人 + 椭圆影子（RAF）。
   难度=狼人移动速度。通关=踩中目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";
import { bindPointer } from "../../core/input.ts";

export class WerewolfShadowGame extends BaseGame {
  constructor() {
    super("werewolf-shadow");
  }
  private raf = 0;
  private over = false;
  private last = 0;
  private unbind: (() => void) | null = null;

  private W = 0;
  private H = 0;
  private dpr = 1;

  /** 狼人位置（脚底中心 x，地面 y） */
  private wolfX = 0;
  private wolfY = 0;
  private wolfDir = 1;
  private wolfSpeed = 0; // px/s
  private wolfR = 30; // 命中半径

  /** 月亮角度（弧度）：决定影子投射方向。
   *  moonAngle=0 月亮在正上方（影子在脚下），>0 月亮偏右（影子偏左） */
  private moonAngle = 0;

  private roundsDone = 0;
  private roundTotal = 0;

  /** 影子命中反馈动画时长 */
  private flash = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.wolfSpeed =
      this.difficulty === "easy"
        ? 70
        : this.difficulty === "medium"
          ? 120
          : 180;
    this.injectStyle();
    this.setupStage();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unbind?.();
    this.unbind = null;
  }

  private setupStage(): void {
    this.root.innerHTML = "";
    this.over = false;
    this.flash = 0;

    const wrap = document.createElement("div");
    wrap.className = "wsh-wrap";
    const task = document.createElement("div");
    task.className = "wsh-task";
    task.innerHTML = `踩到狼人的 <b>影子</b>！<br><span class="wsh-hint">已踩中 <b id="wsh-done">0</b> / ${this.roundTotal} · 第 ${this.roundsDone + 1} 关</span>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "wsh-stage";
    stage.id = "wsh-stage";
    // 月亮
    const moon = document.createElement("div");
    moon.className = "wsh-moon";
    moon.textContent = "🌕";
    moon.id = "wsh-moon";
    stage.appendChild(moon);
    // 狼人
    const wolf = document.createElement("div");
    wolf.className = "wsh-wolf";
    wolf.id = "wsh-wolf";
    wolf.textContent = "🐺";
    stage.appendChild(wolf);
    // 影子
    const shadow = document.createElement("div");
    shadow.className = "wsh-shadow";
    shadow.id = "wsh-shadow";
    stage.appendChild(shadow);
    // 闪光
    const flash = document.createElement("div");
    flash.className = "wsh-flash";
    flash.id = "wsh-flash";
    stage.appendChild(flash);
    wrap.appendChild(stage);

    const hint = document.createElement("div");
    hint.className = "wsh-hint2";
    hint.textContent = "点屏幕踩影子，月亮移动时影子方向会变～";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);

    // 测量尺寸
    const rect = stage.getBoundingClientRect();
    this.W = rect.width;
    this.H = rect.height;

    this.wolfX = this.W * 0.3;
    this.wolfY = this.H * 0.72;
    this.moonAngle = -0.3;

    // 绑定点击踩影子
    this.unbind = bindPointer(stage, {
      down: (p) => this.tryStomp(p.x, p.y, stage),
    });

    this.last = performance.now();
    this.loop();
  }

  /** 影子中心位置（地面上的椭圆中心），随月亮角度偏移 */
  private shadowPos(): { x: number; y: number } {
    // 月亮偏右(moonAngle>0) → 影子偏左(-)；月亮偏左 → 影子偏右
    const offset = Math.sin(this.moonAngle) * 60;
    return { x: this.wolfX - offset, y: this.wolfY + 6 };
  }

  private tryStomp(px: number, py: number, stage: HTMLElement): void {
    if (this.over) return;
    const r = stage.getBoundingClientRect();
    const lx = px - r.left;
    const ly = py - r.top;
    const sh = this.shadowPos();
    const d = Math.hypot(lx - sh.x, ly - sh.y);
    if (d <= 42) {
      // 踩中！
      sfxPop();
      this.onCorrect(px, py);
      this.resetWrongStreak();
      this.flash = 1;
      const fl = this.root.querySelector<HTMLElement>("#wsh-flash");
      if (fl) {
        fl.style.left = `${sh.x}px`;
        fl.style.top = `${sh.y}px`;
        fl.classList.add("wsh-flash--show");
        this.trackTimeout(() => fl.classList.remove("wsh-flash--show"), 500);
      }
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      const done = this.root.querySelector<HTMLElement>("#wsh-done");
      if (done) done.textContent = String(this.roundsDone);
      if (this.roundsDone >= this.roundTotal) {
        this.over = true;
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.trackTimeout(
          () => this.finishClear(starsByAccuracy(this.wrongCount)),
          700,
        );
      }
    } else {
      // 踩偏：温和提示（不直接计错，避免高速狼人太难）。累计 2 次踩偏才计一次错
      this.missCount = (this.missCount ?? 0) + 1;
      if ((this.missCount ?? 0) % 2 === 0) {
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

    // 狼人走动（左右往返）
    this.wolfX += this.wolfDir * this.wolfSpeed * dt;
    if (this.wolfX > this.W - 30) {
      this.wolfX = this.W - 30;
      this.wolfDir = -1;
    } else if (this.wolfX < 30) {
      this.wolfX = 30;
      this.wolfDir = 1;
    }

    // 月亮缓慢摆动，带动影子方向变化
    this.moonAngle += 0.35 * dt;
    const moonDeg = Math.sin(this.moonAngle * 0.6) * 35; // 月亮左右摆
    const moon = this.root.querySelector<HTMLElement>("#wsh-moon");
    if (moon) moon.style.left = `${50 + moonDeg * 0.7}%`;

    // 更新狼人 DOM
    const wolf = this.root.querySelector<HTMLElement>("#wsh-wolf");
    if (wolf) {
      wolf.style.left = `${this.wolfX}px`;
      wolf.style.top = `${this.wolfY}px`;
      wolf.style.transform = `translate(-50%,-90%) scaleX(${this.wolfDir})`;
    }
    // 更新影子 DOM
    const sh = this.shadowPos();
    const shadow = this.root.querySelector<HTMLElement>("#wsh-shadow");
    if (shadow) {
      shadow.style.left = `${sh.x}px`;
      shadow.style.top = `${sh.y}px`;
      // 影子长度随月亮高度变化
      const stretch = 1 + Math.abs(Math.sin(this.moonAngle)) * 0.5;
      shadow.style.transform = `translate(-50%,-50%) scaleX(${stretch})`;
    }

    this.flash = Math.max(0, this.flash - dt * 2);
    this.raf = requestAnimationFrame(this.loop);
  };

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看月亮在哪边，影子就在相反方向，踩中地上的黑影～",
      primary: { text: "继续", icon: "🐺", onClick: () => ov.destroy() },
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
    if (document.getElementById("wsh-style")) return;
    const st = document.createElement("style");
    st.id = "wsh-style";
    st.textContent = WSH_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function WSH_CSS(theme: string): string {
  return `
.wsh-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(520px,100%);}
.wsh-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.wsh-task b{color:${theme};}
.wsh-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.wsh-hint b{color:${theme};}
.wsh-stage{position:relative;width:100%;max-width:480px;height:340px;border-radius:24px;overflow:hidden;cursor:pointer;touch-action:none;background:linear-gradient(180deg,#1a2340 0%,#2d3a5e 55%,#3a4a3a 75%,#2a3a2a 100%);box-shadow:var(--shadow-lg);}
.wsh-stage::before{content:"⭐ ✨  ⭐   ✨";position:absolute;top:8px;left:10px;font-size:.9rem;color:#fff8;letter-spacing:18px;}
.wsh-stage::after{content:"";position:absolute;inset:auto 0 0 0;height:28%;background:repeating-linear-gradient(90deg,#3a4a2e 0 16px,#33422a 16px 32px);}
.wsh-moon{position:absolute;top:18px;left:50%;font-size:2.6rem;transform:translateX(-50%);transition:left .3s ease;filter:drop-shadow(0 0 16px #fff8cc);z-index:2;animation:wsh-glow 3s ease-in-out infinite;}
@keyframes wsh-glow{0%,100%{filter:drop-shadow(0 0 12px #fff8cc)}50%{filter:drop-shadow(0 0 22px #fff8cc)}}
.wsh-wolf{position:absolute;font-size:3rem;z-index:3;transition:none;filter:drop-shadow(0 4px 4px rgba(0,0,0,.4));}
.wsh-shadow{position:absolute;width:70px;height:26px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.55),rgba(0,0,0,.15) 70%,transparent);z-index:2;pointer-events:none;}
.wsh-flash{position:absolute;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle,rgba(255,235,120,.9),transparent 70%);transform:translate(-50%,-50%) scale(0);pointer-events:none;z-index:4;opacity:0;}
.wsh-flash--show{animation:wsh-pop .5s ease;}
@keyframes wsh-pop{0%{transform:translate(-50%,-50%) scale(.3);opacity:1}100%{transform:translate(-50%,-50%) scale(2);opacity:0}}
.wsh-hint2{font-size:.8rem;color:var(--ink-soft);font-weight:700;}
@media (max-width:380px){.wsh-stage{height:290px;}.wsh-wolf{font-size:2.4rem;}.wsh-shadow{width:56px;height:22px;}}
`;
}

export function create(): WerewolfShadowGame {
  return new WerewolfShadowGame();
}
