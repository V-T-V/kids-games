/* 钟摆接物 Pendulum Swing —— 钟摆左右摆动，每次摆到最低点（正中下方）时
   出现一颗星星，孩子在那一刻点击"抓住"即可得分。
   独特点：时机判断——抓住摆动经过最低点的瞬间（物理节律感）。
   巧思：奖励物只在接近最低点的小窗口出现，给足反应时间；难度=摆速（快慢）。
   视觉：顶部支点 + 摆杆 + 摆锤 + 底部奖励槽。RAF 驱动摆动；通关=抓住目标数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar } from "../../lobby/util.ts";

export class PendulumSwingGame extends BaseGame {
  constructor() {
    super("pendulum-swing");
  }

  private pivot!: HTMLDivElement;
  private arm!: HTMLDivElement;
  private bob!: HTMLDivElement;

  private phase = 0; // 当前摆动相位（弧度）
  private omega = 0; // 角速度（rad/s），难度越大越快
  private amp = 0; // 振幅（度）
  private raf = 0;
  private last = 0;
  private over = false;

  private caught = 0; // 本关已抓住
  private goal = 0; // 本关目标
  private windowOpen = false; // 抓取窗口是否打开（接近最低点）
  private itemShown = false; // 当前最低点奖励是否已生成
  private lastPhaseSign = 0; // 上一帧 sin(phase) 符号，用于检测过零点

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
    this.caught = 0;
    // 难度=摆速：角速度越大摆得越快越难抓
    this.omega =
      this.difficulty === "easy"
        ? 1.6
        : this.difficulty === "medium"
          ? 2.3
          : 3.0;
    this.amp = this.difficulty === "hard" ? 52 : 60; // hard 略小振幅更刁
    this.goal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.phase = -0.4;
    this.lastPhaseSign = Math.sin(this.phase) >= 0 ? 1 : -1;
    this.windowOpen = false;
    this.itemShown = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.render();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "psw-wrap";

    const task = document.createElement("div");
    task.className = "psw-task";
    task.innerHTML = `摆锤经过<b>最下方</b>时星星会出现，点 <b>抓住！</b><br>抓住 <b id="psw-caught">${this.caught}</b> / ${this.goal} 颗 · 第 ${this.roundsDone + 1} / ${this.roundTotal} 关`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "psw-stage";
    stage.id = "psw-stage";

    // 支架横梁
    const beam = document.createElement("div");
    beam.className = "psw-beam";
    stage.appendChild(beam);

    // 支点
    this.pivot = document.createElement("div");
    this.pivot.className = "psw-pivot";
    this.pivot.id = "psw-pivot";
    stage.appendChild(this.pivot);

    // 摆杆 + 摆锤
    this.arm = document.createElement("div");
    this.arm.className = "psw-arm";
    this.arm.id = "psw-arm";
    this.bob = document.createElement("div");
    this.bob.className = "psw-bob";
    this.bob.id = "psw-bob";
    this.bob.textContent = "🔔";
    this.arm.appendChild(this.bob);
    stage.appendChild(this.arm);

    // 底部"最低点"提示槽
    const slot = document.createElement("div");
    slot.className = "psw-slot";
    slot.id = "psw-slot";
    slot.textContent = "在这里抓！";
    stage.appendChild(slot);

    wrap.appendChild(stage);

    // 抓住按钮（大按钮，方便孩子点）
    const grab = document.createElement("button");
    grab.type = "button";
    grab.className = "psw-grab";
    grab.id = "psw-grab";
    grab.textContent = "✋ 抓住！";
    grab.addEventListener("click", () => this.grab());
    wrap.appendChild(grab);

    this.root.appendChild(wrap);
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 简谐摆动 phase += omega*dt
    this.phase += this.omega * dt;
    const s = Math.sin(this.phase);
    const deg = s * this.amp;
    // 摆杆旋转（绕顶端支点）
    this.arm.style.transform = `rotate(${deg}deg)`;

    // 检测过零点（经过最低点）：符号反转
    const sign = s >= 0 ? 1 : -1;
    const crossing = sign !== this.lastPhaseSign;
    this.lastPhaseSign = sign;

    // 抓取窗口：当 |sin| 很小（接近最低点）时打开
    const nearLow = Math.abs(s) < 0.35;
    const slot = this.root.querySelector("#psw-slot");
    const grab = this.root.querySelector(
      "#psw-grab",
    ) as HTMLButtonElement | null;
    if (nearLow) {
      this.windowOpen = true;
      if (slot) slot.classList.add("psw-slot--open");
      if (grab) grab.classList.add("psw-grab--ready");
      // 过零点时生成一颗星星
      if (crossing && !this.itemShown) {
        this.itemShown = true;
        this.spawnStar();
      }
    } else {
      this.windowOpen = false;
      this.itemShown = false;
      if (slot) slot.classList.remove("psw-slot--open");
      if (grab) grab.classList.remove("psw-grab--ready");
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  /** 在最低点上方生成一颗可抓的星星，仅作视觉提示。 */
  private spawnStar(): void {
    const stage = this.root.querySelector("#psw-stage");
    if (!stage) return;
    const star = document.createElement("div");
    star.className = "psw-star";
    star.textContent = "⭐";
    stage.appendChild(star);
    this.trackTimeout(() => star.remove(), 700);
  }

  private grab(): void {
    if (this.over) return;
    const grab = this.root.querySelector(
      "#psw-grab",
    ) as HTMLButtonElement | null;
    if (this.windowOpen) {
      // 抓中
      this.caught += 1;
      this.resetWrongStreak();
      sfxPop();
      const c = this.root.querySelector("#psw-caught");
      if (c) c.textContent = String(this.caught);
      if (grab) {
        grab.classList.add("psw-grab--hit");
        this.trackTimeout(() => grab.classList.remove("psw-grab--hit"), 250);
      }
      const r = grab ? grab.getBoundingClientRect() : null;
      this.onCorrect(
        r ? r.left + r.width / 2 : window.innerWidth / 2,
        r ? r.top + r.height / 2 : window.innerHeight / 2,
      );
      this.windowOpen = false; // 本窗口已抓，避免连点
      if (this.caught >= this.goal) {
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
      // 抓空
      this.onWrong();
      if (grab) {
        grab.classList.add("psw-grab--miss");
        this.trackTimeout(() => grab.classList.remove("psw-grab--miss"), 300);
      }
    }
  }

  private injectStyle(): void {
    if (document.getElementById("psw-style")) return;
    const st = document.createElement("style");
    st.id = "psw-style";
    st.textContent = PSW_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function PSW_CSS(theme: string): string {
  return `
.psw-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.psw-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;max-width:420px;}
.psw-task b{color:${theme};}
.psw-stage{position:relative;width:100%;max-width:380px;height:340px;background:radial-gradient(circle at 50% 30%,#fff,#ede7f6);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;}
.psw-beam{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:70%;height:12px;background:linear-gradient(180deg,#8d6e63,#5d4037);border-radius:6px;box-shadow:var(--shadow);}
.psw-pivot{position:absolute;top:20px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#5d4037);box-shadow:var(--shadow);z-index:4;}
.psw-arm{position:absolute;top:26px;left:50%;width:6px;height:220px;margin-left:-3px;background:repeating-linear-gradient(180deg,#6d4c41 0 8px,transparent 8px 12px);transform-origin:top center;transform:rotate(0deg);z-index:3;will-change:transform;}
.psw-bob{position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.6rem;background:radial-gradient(circle at 32% 30%,#fff6,${theme} 70%,color-mix(in srgb,${theme} 60%,#000));box-shadow:inset 0 -4px 6px rgba(0,0,0,.25),0 4px 6px rgba(0,0,0,.25);}
.psw-slot{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);padding:4px 16px;border-radius:999px;background:#fff;color:var(--ink-soft);font-size:.8rem;font-weight:700;box-shadow:var(--shadow);transition:background .15s ease,color .15s ease;}
.psw-slot--open{background:${theme};color:#fff;animation:psw-pulse .4s ease infinite alternate;}
@keyframes psw-pulse{from{transform:translateX(-50%) scale(1)}to{transform:translateX(-50%) scale(1.08)}}
.psw-star{position:absolute;bottom:54px;left:50%;transform:translateX(-50%);font-size:1.8rem;animation:psw-spark .7s ease forwards;z-index:5;}
@keyframes psw-spark{0%{opacity:0;transform:translateX(-50%) scale(.3)}40%{opacity:1;transform:translateX(-50%) scale(1.2)}100%{opacity:0;transform:translateX(-50%) scale(1.4) translateY(-20px)}}
.psw-grab{min-width:200px;min-height:64px;border:none;border-radius:20px;background:linear-gradient(160deg,${theme},color-mix(in srgb,${theme} 70%,#000));color:#fff;font-size:1.5rem;font-weight:900;box-shadow:0 6px 0 color-mix(in srgb,${theme} 50%,#000),var(--shadow);cursor:pointer;transition:transform .1s ease,box-shadow .1s ease;}
.psw-grab:active{transform:translateY(4px);box-shadow:0 2px 0 color-mix(in srgb,${theme} 50%,#000),var(--shadow);}
.psw-grab--ready{box-shadow:0 6px 0 color-mix(in srgb,${theme} 50%,#000),0 0 0 6px ${theme}55;}
.psw-grab--hit{animation:psw-hit .25s ease;}
@keyframes psw-hit{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
.psw-grab--miss{animation:psw-miss .3s ease;}
@keyframes psw-miss{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.psw-stage{height:300px;}.psw-arm{height:190px;}.psw-grab{min-width:170px;font-size:1.3rem;}}
`;
}

export function create(): PendulumSwingGame {
  return new PendulumSwingGame();
}
