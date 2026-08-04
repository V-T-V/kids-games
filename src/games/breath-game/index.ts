/* 深呼吸 Breath Game —— 跟着圆圈缩放呼吸：吸气 4s（圆变大）→ 屏息 2s → 呼气 4s（圆变小）。
   完成 3-5 轮即通关。沙盒类（不计错，放松向）。
   独特点：用 RAF 驱动的圆圈缩放做呼吸引导，配文字提示，
   培养孩子放松与自我调节能力。前缀 brt2-（brt- 已被别的呼吸类游戏占用）。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByScore } from "../../core/scoring.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

// 呼吸阶段
type Phase = "inhale" | "hold" | "exhale" | "rest";

const PHASE_DUR: Record<Phase, number> = {
  inhale: 4,
  hold: 2,
  exhale: 4,
  rest: 1,
};

const PHASE_LABEL: Record<Phase, string> = {
  inhale: "🫁 吸气…",
  hold: "🤫 屏住",
  exhale: "😮‍💨 呼气…",
  rest: "😌 放松",
};

export class BreathGameGame extends BaseGame {
  constructor() {
    super("breath-game");
  }

  private raf = 0;
  private last = 0;
  private over = false;
  private phase: Phase = "inhale";
  private phaseElapsed = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private circleEl: HTMLDivElement | null = null;
  private phaseEl: HTMLDivElement | null = null;
  private cntEl: HTMLDivElement | null = null;
  private ringEl: HTMLDivElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
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
    this.phase = "inhale";
    this.phaseElapsed = 0;

    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    this.reportProgress(this.roundsDone, this.roundTotal);
    wrap.className = "brt2-wrap";

    const task = document.createElement("div");
    task.className = "brt2-task";
    task.innerHTML = `跟着圆圈<b>深呼吸</b> <small><b id="brt2-cnt">${this.roundsDone} / ${this.roundTotal}</b></small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "brt2-stage";
    const ring = document.createElement("div");
    ring.className = "brt2-ring";
    const circle = document.createElement("div");
    circle.className = "brt2-circle";
    circle.textContent = "🌸";
    ring.appendChild(circle);
    stage.appendChild(ring);
    wrap.appendChild(stage);

    const phaseEl = document.createElement("div");
    phaseEl.className = "brt2-phase";
    phaseEl.textContent = PHASE_LABEL.inhale;
    wrap.appendChild(phaseEl);

    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "brt2-skip";
    skipBtn.textContent = "🏠 结束";
    skipBtn.addEventListener("click", () => navigate(""));
    wrap.appendChild(skipBtn);

    this.root.appendChild(wrap);
    this.circleEl = circle;
    this.phaseEl = phaseEl;
    this.ringEl = ring;
    this.cntEl = this.root.querySelector("#brt2-cnt");

    requestAnimationFrame(() => {
      this.last = performance.now();
      this.updateCircle();
      this.loop();
    });
  }

  private updateCircle(): void {
    if (!this.circleEl) return;
    // 根据当前阶段进度计算缩放
    const dur = PHASE_DUR[this.phase];
    const t = Math.min(1, this.phaseElapsed / dur);
    let scale = 0.5;
    if (this.phase === "inhale") scale = 0.5 + t * 0.5;
    else if (this.phase === "hold") scale = 1.0;
    else if (this.phase === "exhale") scale = 1.0 - t * 0.5;
    else scale = 0.5;
    this.circleEl.style.transform = `scale(${scale})`;
    if (this.ringEl) {
      // 环也跟随
      this.ringEl.style.transform = `scale(${0.8 + scale * 0.2})`;
    }
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;

    this.phaseElapsed += dt;
    const dur = PHASE_DUR[this.phase];
    if (this.phaseElapsed >= dur) {
      this.phaseElapsed = 0;
      // 切换阶段
      const order: Phase[] = ["inhale", "hold", "exhale", "rest"];
      const idx = order.indexOf(this.phase);
      this.phase = order[(idx + 1) % order.length]!;
      // 一轮 = inhale→hold→exhale→rest 完成
      if (this.phase === "inhale") {
        this.roundsDone++;
        if (this.cntEl)
          this.cntEl.textContent = `${this.roundsDone} / ${this.roundTotal}`;
        if (this.roundsDone >= this.roundTotal) {
          this.win();
          return;
        }
      }
      if (this.phaseEl) this.phaseEl.textContent = PHASE_LABEL[this.phase];
    }
    this.updateCircle();
    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const stage = this.root.querySelector(".brt2-stage");
    const rect = stage
      ? stage.getBoundingClientRect()
      : new DOMRect(window.innerWidth / 2, window.innerHeight / 2);
    this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
    this.trackTimeout(() => {
      this.finishClear(
        starsByScore(this.roundTotal, [this.roundTotal, this.roundTotal]),
      );
    }, 800);
  }

  private injectStyle(): void {
    if (document.getElementById("brt2-style")) return;
    const st = document.createElement("style");
    st.id = "brt2-style";
    st.textContent = BRT2_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function BRT2_CSS(theme: string): string {
  return `
.brt2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.brt2-task{font-size:1.1rem;font-weight:800;color:var(--ink);background:#fff;padding:8px 22px;border-radius:999px;box-shadow:var(--shadow);}
.brt2-task b{color:${theme};}
.brt2-task small{color:var(--ink-soft);font-weight:700;font-size:.9rem;margin-left:6px;}
.brt2-stage{width:320px;height:320px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,#e0fbff 0%,#fff 60%,#d8f3f7 100%);border-radius:28px;box-shadow:var(--shadow);}
.brt2-ring{width:240px;height:240px;border-radius:50%;border:3px dashed ${theme};display:flex;align-items:center;justify-content:center;transition:transform .8s ease;}
.brt2-circle{width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,${theme});display:flex;align-items:center;justify-content:center;font-size:3rem;box-shadow:0 0 30px ${theme};transform:scale(.5);will-change:transform;}
.brt2-phase{font-size:1.6rem;font-weight:900;color:${theme};min-height:2rem;animation:brt2-fade .4s ease;}
@keyframes brt2-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.brt2-skip{padding:10px 24px;border:none;border-radius:999px;background:#fff;color:var(--ink-soft);font-weight:800;font-size:.9rem;box-shadow:var(--shadow);cursor:pointer;}
.brt2-skip:active{transform:scale(.93);}
@media (max-width:380px){.brt2-stage{width:260px;height:260px;}.brt2-ring{width:200px;height:200px;}.brt2-circle{width:100px;height:100px;font-size:2.4rem;}}
`;
}

export function create(): BreathGameGame {
  return new BreathGameGame();
}
