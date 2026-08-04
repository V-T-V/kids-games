/* 风车转转 Wind Mill —— 不停点"吹气"按钮，风车越转越快，达到目标速度算成功。
   独特点：因果反馈游戏（点=加速），用 CSS animation-duration 动态调整旋转速度，
   停止点击会自然减速（模拟惯性）。
   视觉：CSS 风车（十字四叶）+ 杆子 + 风线粒子。难度=目标速度。通关=转够目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { createRafLoop } from "../../core/loop.ts";
import { getCssVar } from "../../lobby/util.ts";

export class WindMillGame extends BaseGame {
  constructor() {
    super("wind-mill");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private power = 0; // 当前风力 0-100
  private stop?: () => void;
  private blades?: HTMLElement;
  private over = false;
  private lastDecay = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
  }

  private target(): number {
    return this.difficulty === "easy"
      ? 60
      : this.difficulty === "medium"
        ? 75
        : 90;
  }

  private startRound(): void {
    this.over = false;
    this.power = 0;
    this.lastDecay = performance.now();
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "wdm-wrap";

    const task = document.createElement("div");
    task.className = "wdm-task";
    task.id = "wdm-task";
    task.innerHTML = `不停点 <b>💨吹气</b>，让风车转到 <b>${this.target()}</b>！`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "wdm-stage";
    const mill = document.createElement("div");
    mill.className = "wdm-mill";
    const blades = document.createElement("div");
    blades.className = "wdm-blades";
    blades.innerHTML = `<span class="wdm-blade" style="--wdm-r:0deg"></span><span class="wdm-blade" style="--wdm-r:90deg"></span><span class="wdm-blade" style="--wdm-r:180deg"></span><span class="wdm-blade" style="--wdm-r:270deg"></span><span class="wdm-hub"></span>`;
    mill.appendChild(blades);
    const pole = document.createElement("div");
    pole.className = "wdm-pole";
    mill.appendChild(pole);
    stage.appendChild(mill);
    wrap.appendChild(stage);
    this.blades = blades;

    // 速度条
    const meter = document.createElement("div");
    meter.className = "wdm-meter";
    meter.innerHTML = `<div class="wdm-meter__fill" id="wdm-fill"></div><div class="wdm-meter__mark" style="left:${this.target()}%"></div>`;
    wrap.appendChild(meter);

    // 吹气按钮
    const blow = document.createElement("button");
    blow.type = "button";
    blow.className = "wdm-blow";
    blow.textContent = "💨 吹气！";
    blow.addEventListener("click", () => this.blowAir());
    wrap.appendChild(blow);

    this.root.appendChild(wrap);
    this.updateBlades();

    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  private blowAir(): void {
    if (this.over) return;
    this.power = Math.min(100, this.power + 8);
    sfxPop();
    this.resetWrongStreak();
    this.spawnWind();
  }

  /** 产生一条风线粒子。 */
  private spawnWind(): void {
    const stage = this.root.querySelector(".wdm-stage");
    if (!stage) return;
    const line = document.createElement("div");
    line.className = "wdm-wind";
    line.style.top = `${20 + Math.random() * 60}%`;
    stage.appendChild(line);
    this.trackTimeout(() => line.remove(), 800);
  }

  private tick(dt: number): void {
    if (this.over) {
      this.stop?.();
      this.stop = undefined;
      return;
    }
    // 惯性减速：每秒衰减约 18 个单位
    this.power = Math.max(0, this.power - dt * 18);
    void this.lastDecay;
    this.lastDecay = performance.now();
    this.updateBlades();
    // 达标
    if (this.power >= this.target()) {
      this.over = true;
      const rect = this.blades?.getBoundingClientRect();
      this.onCorrect(
        rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
        rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
      );
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

  /** 根据当前 power 调整叶片旋转速度与速度条。 */
  private updateBlades(): void {
    if (!this.blades) return;
    // power 0 → 8s/圈（很慢），power 100 → 0.25s/圈（飞快）
    const duration = 8 - (this.power / 100) * 7.75;
    this.blades.style.animationDuration =
      this.power > 0 ? `${duration}s` : "0s";
    this.blades.style.animationPlayState =
      this.power > 1 ? "running" : "paused";
    const fill = this.root.querySelector("#wdm-fill") as HTMLElement | null;
    if (fill) fill.style.width = `${this.power}%`;
  }

  private injectStyle(): void {
    if (document.getElementById("wdm-style")) return;
    const st = document.createElement("style");
    st.id = "wdm-style";
    st.textContent = WM_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function WM_CSS(theme: string): string {
  return `
.wdm-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(440px,100%);}
.wdm-task{font-size:1.1rem;font-weight:800;text-align:center;}
.wdm-stage{position:relative;width:100%;height:300px;background:linear-gradient(180deg,#e1f5fe,#b3e5fc 60%,#81d4fa);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;display:flex;align-items:flex-end;justify-content:center;}
.wdm-mill{position:relative;display:flex;flex-direction:column;align-items:center;padding-bottom:0;}
.wdm-blades{position:relative;width:130px;height:130px;animation:wdm-spin 2s linear infinite;transform-origin:center center;margin-bottom:-6px;z-index:3;}
.wdm-blade{position:absolute;top:0;left:50%;width:42px;height:62px;background:linear-gradient(135deg,${theme},#0288d1);border-radius:50% 50% 40% 40%/60% 60% 40% 40%;transform-origin:50% 100%;transform:translateX(-50%) rotate(var(--wdm-r));box-shadow:var(--shadow);}
.wdm-hub{position:absolute;top:50%;left:50%;width:24px;height:24px;border-radius:50%;background:#fff8e1;transform:translate(-50%,-50%);box-shadow:inset 0 -2px 4px rgba(0,0,0,.3);z-index:4;}
.wdm-pole{width:14px;height:120px;background:linear-gradient(90deg,#8d6e63,#bcaaa4);border-radius:6px;box-shadow:var(--shadow);z-index:2;}
@keyframes wdm-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.wdm-wind{position:absolute;left:-40px;width:60px;height:6px;border-radius:3px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.9));animation:wdm-blow .8s ease forwards;pointer-events:none;}
@keyframes wdm-blow{0%{left:-40px;opacity:0}30%{opacity:1}100%{left:110%;opacity:0}}
.wdm-meter{position:relative;width:100%;max-width:340px;height:18px;background:#fff;border-radius:999px;box-shadow:inset 0 2px 4px rgba(0,0,0,.15);overflow:hidden;}
.wdm-meter__fill{height:100%;width:0;background:linear-gradient(90deg,#ffd54f,${theme});border-radius:999px;transition:width .1s linear;}
.wdm-meter__mark{position:absolute;top:-4px;width:4px;height:26px;background:#ff6348;border-radius:2px;}
.wdm-blow{min-height:64px;padding:0 44px;font-size:1.3rem;font-weight:900;border-radius:999px;background:${theme};color:#fff;box-shadow:var(--shadow);transition:transform .08s;}
.wdm-blow:active{transform:scale(.94);}
`;
}

export function create(): WindMillGame {
  return new WindMillGame();
}
