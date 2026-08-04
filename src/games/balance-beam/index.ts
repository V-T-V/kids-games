/* 平衡木 Balance Beam —— RAF 驱动：角色站在窄木上，会随机左右倾斜，
   孩子点"⬅️ 向左"或"➡️ 向右"把它扶正（重心归零）。
   倾斜过大（超出阈值）就掉下重开。坚持目标秒数通关。
   独特点：实时平衡反馈，培养身体协调意识；点按钮=身体重心反方向修正。
   前缀 blm-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxTick } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

export class BalanceBeamGame extends BaseGame {
  constructor() {
    super("balance-beam");
  }

  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private won = false;
  private tilt = 0; // 当前倾斜角（度），负=左倾
  private vel = 0; // 角速度
  private elapsed = 0;
  private need = 0;
  private disturbAccum = 0;
  private cleanupBtns: (() => void)[] = [];

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
    this.cleanupBtns.forEach((fn) => fn());
    this.cleanupBtns = [];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.over = false;
    this.won = false;
    this.tilt = 0;
    this.vel = 0;
    this.elapsed = 0;
    this.disturbAccum = 0;
    this.cleanupBtns = [];

    this.need =
      this.difficulty === "easy" ? 10 : this.difficulty === "medium" ? 14 : 20;

    const wrap = document.createElement("div");
    wrap.className = "blm-wrap";
    const task = document.createElement("div");
    task.className = "blm-task";
    task.innerHTML = `保持平衡！坚持 <b id="blm-t">0 / ${this.need}</b> 秒`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "blm-stage";
    stage.innerHTML = `
      <div class="blm-meter">
        <div class="blm-meter__zone blm-meter__zone--safe"></div>
        <div class="blm-meter__needle" id="blm-needle"></div>
      </div>
      <div class="blm-beam" id="blm-beam">
        <div class="blm-beam__pole"></div>
      </div>
      <div class="blm-char" id="blm-char">🤸</div>
      <div class="blm-floor"></div>
    `;
    wrap.appendChild(stage);

    const controls = document.createElement("div");
    controls.className = "blm-controls";
    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "blm-btn";
    leftBtn.textContent = "⬅️ 压左";
    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "blm-btn";
    rightBtn.textContent = "压右 ➡️";
    controls.appendChild(leftBtn);
    controls.appendChild(rightBtn);
    wrap.appendChild(controls);
    this.root.appendChild(wrap);

    // 持续按压：向对应方向施加修正（让重心归零）
    const hold = (btn: HTMLElement, dir: number) => {
      let active = false;
      const onDown = (e: Event) => {
        e.preventDefault();
        active = true;
        this.applyPush(dir);
      };
      const onUp = (e: Event) => {
        e.preventDefault();
        active = false;
      };
      btn.addEventListener("pointerdown", onDown);
      btn.addEventListener("pointerup", onUp);
      btn.addEventListener("pointercancel", onUp);
      btn.addEventListener("pointerleave", onUp);
      // 长按重复
      const rep = window.setInterval(() => {
        if (active) this.applyPush(dir);
      }, 80);
      return () => {
        btn.removeEventListener("pointerdown", onDown);
        btn.removeEventListener("pointerup", onUp);
        btn.removeEventListener("pointercancel", onUp);
        btn.removeEventListener("pointerleave", onUp);
        window.clearInterval(rep);
      };
    };
    this.cleanupBtns.push(hold(leftBtn, -1));
    this.cleanupBtns.push(hold(rightBtn, 1));

    requestAnimationFrame(() => {
      this.last = performance.now();
      this.loop();
    });
  }

  private applyPush(dir: number): void {
    if (this.over || this.won) return;
    // 向 dir 方向施加角速度（修正倾斜）
    this.vel += dir * 40;
    sfxTick();
  }

  private loop = (): void => {
    if (this.over || this.won) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 计时
    this.elapsed += dt;
    const t = this.root.querySelector("#blm-t");
    if (t) t.textContent = `${Math.floor(this.elapsed)} / ${this.need}`;
    if (this.elapsed >= this.need) {
      this.win();
      return;
    }

    // 随机扰动：每隔一段时间施加小推力（让游戏有挑战）
    this.disturbAccum += dt;
    const disturbInterval =
      this.difficulty === "easy"
        ? 1.2
        : this.difficulty === "medium"
          ? 0.9
          : 0.7;
    if (this.disturbAccum >= disturbInterval) {
      this.disturbAccum = 0;
      this.vel += (Math.random() - 0.5) * 90;
    }

    // 物理：弹簧回中力弱，让它有"漂移感"
    const restore = -this.tilt * 0.4; // 微弱回中
    this.vel += restore * dt * 60;
    this.vel *= 0.94; // 阻尼
    this.tilt += this.vel * dt;
    // 限制
    this.tilt = Math.max(-45, Math.min(45, this.tilt));

    // 更新视觉
    const beam = document.getElementById("blm-beam");
    if (beam) beam.style.transform = `rotate(${this.tilt}deg)`;
    const charEl = document.getElementById("blm-char");
    if (charEl)
      charEl.style.transform = `translateX(${-50 + this.tilt * 0.6}%) rotate(${this.tilt}deg)`;
    const needle = document.getElementById("blm-needle");
    if (needle) {
      // tilt -45..45 映射到 meter 0..100%
      const pct = ((this.tilt + 45) / 90) * 100;
      needle.style.left = `${pct}%`;
    }

    // 失败判定：倾斜超阈值
    const failLimit =
      this.difficulty === "easy" ? 40 : this.difficulty === "medium" ? 35 : 32;
    if (Math.abs(this.tilt) >= failLimit) {
      this.fall();
      return;
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    if (this.over || this.won) return;
    this.won = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const stage = this.root.querySelector(".blm-stage");
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

  private fall(): void {
    if (this.over || this.won) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const charEl = document.getElementById("blm-char");
    if (charEl) charEl.classList.add("blm-char--fall");
    sfxPop();
    const paused = this.onWrong();
    if (paused) this.showRest();
    else this.trackTimeout(() => this.startRound(), 900);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🤸",
      variant: "rest",
      body: "掉下来啦，看准重心再扶正！",
      primary: {
        text: "再试一次",
        icon: "🤸",
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
    if (document.getElementById("blm-style")) return;
    const st = document.createElement("style");
    st.id = "blm-style";
    st.textContent = BLM_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function BLM_CSS(theme: string): string {
  return `
.blm-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.blm-task{font-size:1.05rem;font-weight:800;color:var(--ink);background:#fff;padding:6px 18px;border-radius:999px;box-shadow:var(--shadow);}
.blm-task b{color:${theme};}
.blm-stage{position:relative;width:320px;height:300px;background:linear-gradient(180deg,#e0f0ff 0%,#fff 55%,#d8c8a8 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);}
.blm-meter{position:absolute;top:14px;left:30px;right:30px;height:12px;border-radius:999px;background:linear-gradient(90deg,#ff6348,#ffd93d 30%,#6bcf7f 50%,#ffd93d 70%,#ff6348);box-shadow:inset 0 1px 3px rgba(0,0,0,.2);}
.blm-meter__zone{position:absolute;inset:0;border-radius:999px;}
.blm-meter__needle{position:absolute;top:-4px;left:50%;width:6px;height:20px;background:#222;border-radius:3px;transform:translateX(-50%);transition:left .05s linear;}
.blm-beam{position:absolute;left:50%;top:210px;width:260px;height:14px;margin-left:-130px;background:linear-gradient(180deg,#c89060,#a06840);border-radius:8px;box-shadow:0 3px 6px rgba(0,0,0,.2);transform-origin:center;transition:transform .05s linear;z-index:2;}
.blm-char{position:absolute;left:50%;top:150px;font-size:2.6rem;line-height:1;transform:translateX(-50%);z-index:3;transition:transform .05s linear;}
.blm-char--fall{animation:blm-fall .5s ease forwards;}
@keyframes blm-fall{0%{transform:translateX(-50%) rotate(0)}100%{transform:translateX(20%) translateY(40px) rotate(80deg)}}
.blm-floor{position:absolute;bottom:0;left:0;right:0;height:30px;background:linear-gradient(180deg,#a8d8a0,#7ec47a);}
.blm-controls{display:flex;gap:18px;}
.blm-btn{padding:18px 28px;border:none;border-radius:16px;background:linear-gradient(180deg,#fff,#dcebff);color:${theme};font-size:1.2rem;font-weight:900;box-shadow:var(--shadow);cursor:pointer;user-select:none;touch-action:none;transition:transform .08s;}
.blm-btn:active{transform:scale(.92);}
@media (max-width:380px){.blm-stage{width:280px;height:270px;}.blm-beam{width:220px;margin-left:-110px;}.blm-char{font-size:2.2rem;}}
`;
}

export function create(): BalanceBeamGame {
  return new BalanceBeamGame();
}
