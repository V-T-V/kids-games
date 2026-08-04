/* 煎饼翻 Pancake Flip —— 煎饼在锅里慢慢变熟，底部颜色从白→金黄→焦黑。
   孩子要在底部恰好金黄时点击翻面：翻太早（生面）或太晚（焦了）都算错。
   每一面有自己的目标熟度时机。视觉：锅 + 圆煎饼 + 底部焦色渐变 + 蒸汽。
   独特点：时机判断 + 颜色辨识（金黄 vs 焦黑）。难度=容差精度。通关=翻对目标轮数。前缀 pc3-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar } from "../../lobby/util.ts";

/**
 * 煎饼状态：生 → 熟 → 焦
 * cookT 从 0 增长到 1（熟）再到 1.5（焦）
 * golden 区间是 [0.8, 1.05]，正好点击算成功
 */
const RAW_T = 0.55; // 小于此值算生（翻早）
const GOLDEN_LO = 0.8;
const GOLDEN_HI = 1.05; // golden 区间
const BURN_T = 1.25; // 超过即焦（翻晚）

export class PancakeFlipGame extends BaseGame {
  constructor() {
    super("pancake-flip");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  /** 当前煎饼的熟度 0~1.5 */
  private cookT = 0;
  /** 熟度增长速度（每秒） */
  private cookRate = 0.5;
  /** 容差提示区间（用于显示金色光环宽度，难度越高越窄） */
  private goldenHalf = 0.12;
  /** 当前轮需要的翻面次数（每翻一面算一次） */
  private flipsNeeded = 2;
  private flipsDone = 0;
  private locked = false;
  private bottomEl: HTMLElement | null = null;
  private pancakeEl: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 3 : 4;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.over = false;
    this.locked = false;
    this.flipsDone = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "pc3-wrap";

    const task = document.createElement("div");
    task.className = "pc3-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 锅 · 等<b style="color:#f4a93b">金黄</b>时点煎饼翻面！`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "pc3-stage";

    // 锅
    const pan = document.createElement("div");
    pan.className = "pc3-pan";
    const panInner = document.createElement("div");
    panInner.className = "pc3-pan-inner";
    pan.appendChild(panInner);

    // 煎饼
    const pancake = document.createElement("button");
    pancake.type = "button";
    pancake.className = "pc3-pancake";
    pancake.setAttribute("aria-label", "煎饼，点击翻面");
    const bottom = document.createElement("span");
    bottom.className = "pc3-bottom";
    pancake.appendChild(bottom);
    const top = document.createElement("span");
    top.className = "pc3-top";
    pancake.appendChild(top);
    pancake.addEventListener("click", () => this.tryFlip());
    panInner.appendChild(pancake);

    stage.appendChild(pan);

    // 蒸汽
    const steam = document.createElement("div");
    steam.className = "pc3-steam";
    steam.innerHTML = `<span></span><span></span><span></span>`;
    stage.appendChild(steam);

    // 提示
    const hint = document.createElement("div");
    hint.className = "pc3-hint";
    hint.id = "pc3-hint";
    wrap.appendChild(hint);

    wrap.appendChild(stage);
    this.root.appendChild(wrap);

    this.bottomEl = bottom;
    this.pancakeEl = pancake;
    this.hintEl = hint;

    this.cookT = 0;
    // 难度：决定熟化速度 + golden 容差
    if (this.difficulty === "easy") {
      this.cookRate = 0.42;
      this.goldenHalf = 0.16;
      this.flipsNeeded = 2;
    } else if (this.difficulty === "medium") {
      this.cookRate = 0.5;
      this.goldenHalf = 0.12;
      this.flipsNeeded = 2;
    } else {
      this.cookRate = 0.62;
      this.goldenHalf = 0.09;
      this.flipsNeeded = 3;
    }

    this.last = performance.now();
    this.renderColor();
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    if (!this.locked) {
      this.cookT += this.cookRate * dt;
      this.renderColor();
      // 自动焦了（玩家没翻）
      if (this.cookT > BURN_T + 0.15) {
        this.failFlip("burned");
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  /** 根据熟度更新底部颜色与发光环。 */
  private renderColor(): void {
    const t = this.cookT;
    // 颜色：0=奶白，0.6=浅金，1=金黄，1.3=深棕，1.5=焦黑
    let color: string;
    if (t < GOLDEN_LO) {
      // 白 → 金黄渐变
      const k = Math.max(0, Math.min(1, (t - RAW_T) / (GOLDEN_LO - RAW_T)));
      color = lerpColor("#fff6e0", "#f4a93b", k);
    } else if (t <= GOLDEN_HI) {
      color = "#f4a93b"; // 金黄
    } else {
      const k = Math.max(
        0,
        Math.min(1, (t - GOLDEN_HI) / (BURN_T - GOLDEN_HI)),
      );
      color = lerpColor("#f4a93b", "#3a2410", k);
    }
    if (this.bottomEl) this.bottomEl.style.background = color;

    // golden 环：用 box-shadow 提示
    if (this.pancakeEl) {
      if (t >= GOLDEN_LO && t <= GOLDEN_HI) {
        this.pancakeEl.classList.add("pc3-pancake--gold");
      } else {
        this.pancakeEl.classList.remove("pc3-pancake--gold");
      }
    }
  }

  private tryFlip(): void {
    if (this.over || this.locked) return;
    const t = this.cookT;
    if (t < RAW_T) {
      this.failFlip("raw");
      return;
    }
    if (t > BURN_T) {
      this.failFlip("burned");
      return;
    }
    // golden 区间
    if (t >= GOLDEN_LO - this.goldenHalf && t <= GOLDEN_HI + this.goldenHalf) {
      // 成功翻面
      this.locked = true;
      sfxPop();
      this.flipsDone += 1;
      this.pancakeEl?.classList.add("pc3-pancake--flip");
      const r = this.pancakeEl?.getBoundingClientRect();
      this.onCorrect(
        r ? r.left + r.width / 2 : window.innerWidth / 2,
        r ? r.top + r.height / 2 : window.innerHeight / 2,
      );
      this.resetWrongStreak();
      if (this.hintEl) this.hintEl.textContent = "✅ 好香！";
      this.trackTimeout(() => {
        this.pancakeEl?.classList.remove("pc3-pancake--flip");
        if (this.flipsDone >= this.flipsNeeded) {
          // 这一锅完成
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        } else {
          // 继续翻另一面
          this.cookT = 0;
          this.locked = false;
          this.renderColor();
          if (this.hintEl) this.hintEl.textContent = "";
        }
      }, 700);
    } else {
      // 在容差外
      this.failFlip(t < GOLDEN_LO ? "early" : "late");
    }
  }

  private failFlip(reason: "raw" | "early" | "late" | "burned"): void {
    if (this.over || this.locked) return;
    this.locked = true;
    const msgMap: Record<"raw" | "early" | "late" | "burned", string> = {
      raw: "还太生啦，再等等～",
      early: "稍早了一点点，等变金黄～",
      late: "稍微晚啦，下次早一点～",
      burned: "焦啦！要在金黄时翻～",
    };
    if (this.hintEl) this.hintEl.textContent = msgMap[reason];
    this.pancakeEl?.classList.add("pc3-pancake--shake");
    this.onWrong();
    this.trackTimeout(() => {
      this.pancakeEl?.classList.remove("pc3-pancake--shake");
      // 重置这一面，让孩子再试
      this.cookT = 0;
      this.locked = false;
      this.renderColor();
      if (this.hintEl) this.hintEl.textContent = "";
    }, 1100);
  }

  private injectStyle(): void {
    if (document.getElementById("pc3-style")) return;
    const st = document.createElement("style");
    st.id = "pc3-style";
    st.textContent = PC3_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

/** 线性插值两个 hex 颜色。 */
function lerpColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function PC3_CSS(theme: string): string {
  void theme;
  return `
.pc3-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.pc3-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.pc3-hint{font-size:1.1rem;font-weight:800;color:#ff7a3d;min-height:1.4em;text-align:center;}
.pc3-stage{position:relative;width:100%;height:54vh;min-height:320px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#fff3e0 0%,#ffe2b8 100%);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;}
/* 蒸汽 */
.pc3-steam{position:absolute;top:8%;left:50%;transform:translateX(-50%);display:flex;gap:18px;pointer-events:none;}
.pc3-steam span{display:block;width:10px;height:34px;border-radius:50%;background:rgba(255,255,255,.7);filter:blur(3px);animation:pc3-rise 2.4s ease-in-out infinite;}
.pc3-steam span:nth-child(2){animation-delay:.6s;}
.pc3-steam span:nth-child(3){animation-delay:1.2s;}
@keyframes pc3-rise{0%{transform:translateY(10px) scale(.8);opacity:0;}30%{opacity:.8;}100%{transform:translateY(-30px) scale(1.3);opacity:0;}}
/* 锅 */
.pc3-pan{position:relative;width:300px;max-width:80vw;height:300px;max-height:80vw;border-radius:50%;background:linear-gradient(180deg,#5a5a5a,#2a2a2a);box-shadow:0 12px 24px rgba(0,0,0,.35),inset 0 -8px 16px rgba(0,0,0,.5);}
.pc3-pan::after{content:"";position:absolute;right:-46px;top:50%;transform:translateY(-50%);width:70px;height:24px;background:linear-gradient(180deg,#6a3a1a,#3a1f0a);border-radius:12px;box-shadow:var(--shadow);}
.pc3-pan-inner{position:absolute;inset:18px;border-radius:50%;background:radial-gradient(circle at 50% 40%,#3a3a3a,#1a1a1a);box-shadow:inset 0 6px 14px rgba(0,0,0,.6);}
/* 煎饼 */
.pc3-pancake{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:200px;max-width:60%;height:200px;max-height:60%;border-radius:50%;border:none;cursor:pointer;padding:0;background:transparent;transition:box-shadow .15s ease;}
.pc3-pancake--gold{box-shadow:0 0 0 6px rgba(244,169,59,.5),0 0 30px 8px rgba(244,169,59,.7);}
.pc3-top{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff3d6,#f6dca0 60%,#e9c578);box-shadow:inset 0 -6px 10px rgba(0,0,0,.15);}
.pc3-top::before,.pc3-top::after{content:"";position:absolute;border-radius:50%;background:rgba(180,120,40,.35);}
.pc3-top::before{width:14px;height:14px;left:35%;top:30%;}
.pc3-top::after{width:10px;height:10px;left:60%;top:55%;}
.pc3-bottom{position:absolute;inset:0;border-radius:50%;background:#fff6e0;opacity:0;transition:background .08s linear;}
.pc3-pancake--flip{animation:pc3-flip .55s ease;}
@keyframes pc3-flip{0%{transform:translate(-50%,-50%) rotateY(0) scale(1);}50%{transform:translate(-50%,-50%) rotateY(90deg) scale(1.1) translateY(-12px);}100%{transform:translate(-50%,-50%) rotateY(180deg) scale(1);}}
.pc3-pancake--shake{animation:pc3-shake .35s ease;}
@keyframes pc3-shake{0%,100%{transform:translate(-50%,-50%);}25%{transform:translate(-54%,-50%) rotate(-4deg);}75%{transform:translate(-46%,-50%) rotate(4deg);}}
@media (max-width:380px){.pc3-pan{width:240px;height:240px;}}
`;
}

export function create(): PancakeFlipGame {
  return new PancakeFlipGame();
}
