/* 呼啦圈 Hula Hoop —— 跟着节奏点"转"，让呼啦圈保持高速旋转。
   每次点击在节奏窗口内 = 加速 + 得分；点太慢（转速低于阈值）就掉落重开。
   独特点：把"持续节奏点击"做成能量衰减模型，转得越快圈越亮；
   难度=目标转速维持时长。前缀 hlh2-（hlh- 已被别的呼啦圈类占用）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxTick } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

export class HulaHoopGame extends BaseGame {
  constructor() {
    super("hula-hoop");
  }

  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private won = false;
  private spin = 0; // 当前转速（角速度 rad/s），越高越好
  private angle = 0; // 累计旋转角（用于视觉旋转）
  private elapsed = 0;
  private need = 0; // 维持目标时长（秒）
  private goodTime = 0; // 在"达标转速"下累计的秒数
  private cleanupBtn: (() => void) | null = null;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cleanupBtn?.();
    this.cleanupBtn = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.over = false;
    this.won = false;
    this.spin = 2; // 起始转速
    this.angle = 0;
    this.elapsed = 0;
    this.goodTime = 0;
    this.cleanupBtn = null;

    this.need =
      this.difficulty === "easy" ? 8 : this.difficulty === "medium" ? 12 : 16;

    const wrap = document.createElement("div");
    wrap.className = "hlh2-wrap";
    const task = document.createElement("div");
    task.className = "hlh2-task";
    task.innerHTML = `跟着节奏点<b>转</b>，保持呼啦圈不掉！ <b id="hlh2-t">0 / ${this.need}</b>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "hlh2-stage";
    stage.innerHTML = `
      <div class="hlh2-meter">
        <div class="hlh2-meter__fill" id="hlh2-fill"></div>
      </div>
      <div class="hlh2-kid" id="hlh2-kid">🧒</div>
      <div class="hlh2-hoop" id="hlh2-hoop">⭕</div>
    `;
    wrap.appendChild(stage);

    const spinBtn = document.createElement("button");
    spinBtn.type = "button";
    spinBtn.className = "hlh2-btn";
    spinBtn.textContent = "🔄 转！";
    wrap.appendChild(spinBtn);
    this.root.appendChild(wrap);

    const onSpin = (e: Event) => {
      e.preventDefault();
      this.push();
    };
    spinBtn.addEventListener("pointerdown", onSpin);
    this.cleanupBtn = () => spinBtn.removeEventListener("pointerdown", onSpin);

    requestAnimationFrame(() => {
      this.last = performance.now();
      this.loop();
    });
  }

  private push(): void {
    if (this.over || this.won) return;
    // 每次点击给一个能量冲击
    this.spin = Math.min(this.spin + 2.2, 9);
    sfxTick();
    const hoop = document.getElementById("hlh2-hoop");
    if (hoop) hoop.classList.add("hlh2-hoop--pulse");
    this.trackTimeout(() => hoop?.classList.remove("hlh2-hoop--pulse"), 120);
  }

  private loop = (): void => {
    if (this.over || this.won) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 转速衰减
    this.spin -= 1.6 * dt;
    if (this.spin < 0) this.spin = 0;
    this.angle += this.spin * dt * 60;

    // 在达标转速（>=2.5）下累计时间
    const target =
      this.difficulty === "easy"
        ? 2.0
        : this.difficulty === "medium"
          ? 2.6
          : 3.2;
    if (this.spin >= target) {
      this.goodTime += dt;
      const t = this.root.querySelector("#hlh2-t");
      if (t) t.textContent = `${Math.floor(this.goodTime)} / ${this.need}`;
      if (this.goodTime >= this.need) {
        this.win();
        return;
      }
    }

    // 视觉
    const hoop = document.getElementById("hlh2-hoop");
    if (hoop) {
      // 高速时呼啦圈倾斜旋转（3D 效果）
      const tilt = Math.min(this.spin * 6, 40);
      hoop.style.transform = `rotateX(${70 - tilt}deg) rotateZ(${this.angle}deg)`;
    }
    // 转速条
    const fill = document.getElementById("hlh2-fill");
    if (fill) {
      const pct = Math.min(100, (this.spin / 9) * 100);
      fill.style.width = `${pct}%`;
      fill.style.background =
        this.spin >= target
          ? "linear-gradient(90deg,#6bcf7f,#4d96ff)"
          : this.spin >= target * 0.6
            ? "linear-gradient(90deg,#ffd93d,#ff9f43)"
            : "linear-gradient(90deg,#ff6348,#ff6b9d)";
    }
    const kid = document.getElementById("hlh2-kid");
    if (kid) {
      const wob = Math.sin(this.angle * 0.05) * this.spin * 0.8;
      kid.style.transform = `translateX(${wob}px)`;
    }

    // 掉落：转速归零持续一段
    if (this.spin <= 0.05) {
      this.drop();
      return;
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    if (this.over || this.won) return;
    this.won = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const stage = this.root.querySelector(".hlh2-stage");
    const rect = stage
      ? stage.getBoundingClientRect()
      : new DOMRect(window.innerWidth / 2, window.innerHeight / 2);
    this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount, [0, 2]));
      } else {
        this.startRound();
      }
    }, 600);
  }

  private drop(): void {
    if (this.over || this.won) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const hoop = document.getElementById("hlh2-hoop");
    if (hoop) hoop.classList.add("hlh2-hoop--drop");
    sfxPop();
    const paused = this.onWrong();
    if (paused) this.showRest();
    else this.trackTimeout(() => this.startRound(), 900);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "⭕",
      variant: "rest",
      body: "呼啦圈掉啦，跟着节奏点让它转起来！",
      primary: {
        text: "再转一次",
        icon: "🔄",
        onClick: () => {
          ov.destroy();
          this.startRound();
        },
      },
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
    if (document.getElementById("hlh2-style")) return;
    const st = document.createElement("style");
    st.id = "hlh2-style";
    st.textContent = HLH2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function HLH2_CSS(theme: string): string {
  return `
.hlh2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.hlh2-task{font-size:1.05rem;font-weight:800;color:var(--ink);background:#fff;padding:6px 18px;border-radius:999px;box-shadow:var(--shadow);}
.hlh2-task b{color:${theme};}
.hlh2-stage{position:relative;width:280px;height:280px;background:radial-gradient(circle at 50% 40%,#fff4e6 0%,#fff 50%,#ffe0c0 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);perspective:600px;}
.hlh2-meter{position:absolute;top:14px;left:20px;right:20px;height:14px;border-radius:999px;background:rgba(0,0,0,.1);overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.2);}
.hlh2-meter__fill{height:100%;width:30%;background:linear-gradient(90deg,#6bcf7f,#4d96ff);transition:width .1s linear,background .2s;}
.hlh2-kid{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);font-size:3rem;line-height:1;z-index:2;}
.hlh2-hoop{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%) rotateX(70deg);font-size:4.5rem;line-height:1;z-index:3;will-change:transform;filter:drop-shadow(0 4px 6px rgba(0,0,0,.2));transform-style:preserve-3d;}
.hlh2-hoop--pulse{animation:hlh2-pulse .15s ease;}
@keyframes hlh2-pulse{0%{filter:drop-shadow(0 0 10px ${theme})}100%{filter:drop-shadow(0 4px 6px rgba(0,0,0,.2))}}
.hlh2-hoop--drop{animation:hlh2-drop .6s ease forwards;}
@keyframes hlh2-drop{0%{transform:translate(-50%,-50%) rotateX(70deg)}100%{transform:translate(-50%,80px) rotateX(70deg) rotate(180deg);opacity:.4}}
.hlh2-btn{padding:18px 56px;border:none;border-radius:999px;background:linear-gradient(135deg,${theme},#ffb84d);color:#fff;font-size:1.5rem;font-weight:900;box-shadow:var(--shadow);cursor:pointer;user-select:none;touch-action:none;transition:transform .08s;}
.hlh2-btn:active{transform:scale(.93);}
@media (max-width:380px){.hlh2-stage{width:240px;height:240px;}.hlh2-kid{font-size:2.4rem;}.hlh2-hoop{font-size:3.6rem;}}
`;
}

export function create(): HulaHoopGame {
  return new HulaHoopGame();
}
