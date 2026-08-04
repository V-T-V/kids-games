/* 平衡秤 Balance Scale —— 左边有砝码（标数字），点砝码加到右边让两边相等。
   独特点：天平根据两边总重实时倾斜，平衡时横杆水平并高亮"相等"。
   巧思：左边可以是多个小砝码之和，孩子通过累加理解等量关系。难度=左边砝码数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

export class BalanceScaleGame extends BaseGame {
  constructor() {
    super("balance-scale");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private target = 0; // 左边总重
  private current = 0; // 右边总重
  private trayRight!: HTMLDivElement;
  private beam!: HTMLDivElement;
  private statusLabel!: HTMLDivElement;
  private buttons: HTMLButtonElement[] = [];
  private solved = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 左边砝码个数 + 右侧候选砝码池 */
  private leftCount(): number {
    return this.difficulty === "easy" ? 3: this.difficulty === "medium"
        ? 4
        : 6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.current = 0;
    this.solved = false;

    // 生成左边砝码：个数为 leftCount，每个值 1-3，求和
    const leftVals: number[] = [];
    for (let i = 0; i < this.leftCount(); i++) {
      leftVals.push(Math.floor(Math.random() * 3) + 1); // 1..3
    }
    this.target = leftVals.reduce((a, b) => a + b, 0);

    // 右侧候选砝码池：包含足够凑出 target 的选项 + 干扰，值 1..3
    const pool = this.buildPool(this.target);

    const wrap = document.createElement("div");
    wrap.className = "bs-wrap";

    const task = document.createElement("div");
    task.className = "bs-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 点砝码加到右边，让 <b>两边一样重</b>`;
    wrap.appendChild(task);

    // 天平
    const scale = document.createElement("div");
    scale.className = "bs-scale";
    scale.innerHTML = `
      <div class="bs-stand"></div>
      <div class="bs-beam-wrap"><div class="bs-beam"></div>
        <div class="bs-pan bs-pan--left"></div>
        <div class="bs-pan bs-pan--right"></div>
      </div>
    `;
    wrap.appendChild(scale);
    this.beam = scale.querySelector(".bs-beam") as HTMLDivElement;
    const panLeft = scale.querySelector(".bs-pan--left") as HTMLDivElement;
    this.trayRight = scale.querySelector(".bs-pan--right") as HTMLDivElement;
    // 左边砝码（展示，不可点）
    leftVals.forEach((v) => {
      const w = document.createElement("div");
      w.className = "bs-weight";
      w.dataset.value = String(v);
      w.textContent = String(v);
      panLeft.appendChild(w);
    });

    this.statusLabel = document.createElement("div");
    this.statusLabel.className = "bs-status";
    this.statusLabel.textContent = `右边现在是 0，目标是 ${this.target}`;
    wrap.appendChild(this.statusLabel);

    // 候选砝码池
    const poolEl = document.createElement("div");
    poolEl.className = "bs-pool";
    this.buttons = [];
    shuffle(pool).forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bs-weight bs-weight--pick";
      b.dataset.value = String(v);
      b.textContent = String(v);
      b.addEventListener("click", () => this.add(v, b));
      poolEl.appendChild(b);
      this.buttons.push(b);
    });
    wrap.appendChild(poolEl);

    // 重置按钮
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "bs-reset";
    resetBtn.textContent = "↩️ 清空右边";
    resetBtn.addEventListener("click", () => this.resetRight());
    wrap.appendChild(resetBtn);

    this.root.appendChild(wrap);
    this.updateTilt();
  }

  /** 构造候选砝码池：保证能凑出 target，且有若干干扰。 */
  private buildPool(target: number): number[] {
    const pool: number[] = [];
    // 先放一个等于 target 的解（保证可解），简单关友好
    if (target <= 3) pool.push(target);
    else {
      // 拆成若干 1-3
      let rest = target;
      while (rest > 0) {
        const take = Math.min(3, rest);
        pool.push(take);
        rest -= take;
      }
    }
    // 干扰
    const distract =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    for (let i = 0; i < distract; i++) {
      pool.push(Math.floor(Math.random() * 3) + 1);
    }
    return pool;
  }

  private add(value: number, btn: HTMLButtonElement): void {
    if (this.solved) return;
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add("bs-weight--used");
    // 在右边托盘放一个显示砝码
    const w = document.createElement("div");
    w.className = "bs-weight";
    w.dataset.value = String(value);
    w.textContent = String(value);
    this.trayRight.appendChild(w);
    sfxPop();
    this.current += value;
    this.updateTilt();
    if (this.current === this.target) {
      this.win();
    } else if (this.current > this.target) {
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private resetRight(): void {
    if (this.solved) return;
    this.current = 0;
    this.trayRight.innerHTML = "";
    this.buttons.forEach((b) => {
      b.disabled = false;
      b.classList.remove("bs-weight--used");
    });
    this.updateTilt();
  }

  private updateTilt(): void {
    const diff = this.current - this.target;
    // 右边重 → 右下沉（正值顺时针）；右边轻 → 右上翘
    const angle = Math.max(-22, Math.min(22, diff * 8));
    this.beam.style.transform = `rotate(${angle}deg)`;
    if (diff === 0) {
      this.statusLabel.textContent = `相等！两边都是 ${this.target} 🎉`;
      this.statusLabel.classList.add("bs-status--ok");
      this.beam.classList.add("bs-beam--balanced");
    } else if (this.current < this.target) {
      this.statusLabel.textContent = `右边 ${this.current}，还差 ${this.target - this.current}`;
      this.statusLabel.classList.remove("bs-status--ok");
      this.beam.classList.remove("bs-beam--balanced");
    } else {
      this.statusLabel.textContent = `右边 ${this.current}，太重啦！多 ${this.current - this.target}`;
      this.statusLabel.classList.remove("bs-status--ok");
      this.beam.classList.remove("bs-beam--balanced");
    }
  }

  private win(): void {
    this.solved = true;
    const r = this.trayRight.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top);
    this.resetWrongStreak();
    this.buttons.forEach((b) => (b.disabled = true));
    this.trackTimeout(() => {
      this.roundsDone += 1;
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 1100);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "右边太重啦，点「清空右边」重来～",
      primary: { text: "继续", icon: "🎈", onClick: () => ov.destroy() },
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
    if (document.getElementById("bs-style")) return;
    const st = document.createElement("style");
    st.id = "bs-style";
    st.textContent = BS_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function BS_CSS(theme: string): string {
  return `
.bs-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.bs-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.bs-scale{position:relative;width:320px;height:180px;margin:6px 0;}
.bs-stand{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:18px;height:110px;background:linear-gradient(#caa472,#a07a4e);border-radius:6px;box-shadow:var(--shadow);}
.bs-stand::after{content:"";position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:70px;height:14px;background:#8a6a40;border-radius:50%;}
.bs-beam-wrap{position:absolute;top:30px;left:0;right:0;height:0;}
.bs-beam{position:absolute;left:30px;right:30px;top:0;height:14px;background:linear-gradient(${theme},color-mix(in srgb,${theme} 70%,#000));border-radius:8px;transform-origin:center;transition:transform .4s cubic-bezier(.34,1.56,.64,1);box-shadow:0 3px 6px rgba(0,0,0,.2);}
.bs-beam::before{content:"";position:absolute;left:50%;top:-12px;transform:translateX(-50%);width:22px;height:22px;background:color-mix(in srgb,${theme} 60%,#fff);border-radius:50%;box-shadow:inset 0 -3px 4px rgba(0,0,0,.2);}
.bs-beam--balanced{animation:bs-glow 1s ease infinite;}
@keyframes bs-glow{0%,100%{box-shadow:0 0 0 0 rgba(107,207,127,.6)}50%{box-shadow:0 0 16px 4px rgba(107,207,127,.7)}}
.bs-pan{position:absolute;bottom:-6px;width:120px;height:34px;background:linear-gradient(#e8e8e8,#bdbdbd);border-radius:0 0 60px 60px / 0 0 30px 30px;display:flex;align-items:flex-start;justify-content:center;gap:4px;padding-top:4px;box-shadow:inset 0 -4px 6px rgba(0,0,0,.15);}
.bs-pan--left{left:0;transform:translateX(-40px);}
.bs-pan--right{right:0;transform:translateX(40px);}
.bs-pan::before{content:"";position:absolute;top:-26px;left:50%;width:2px;height:28px;background:#999;}
.bs-weight{min-width:30px;height:30px;border-radius:6px;background:linear-gradient(#ffd93d,#ffb300);color:#5a3d00;font-weight:900;font-size:.95rem;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 -3px 4px rgba(0,0,0,.2),0 2px 3px rgba(0,0,0,.2);padding:0 4px;}
.bs-weight--pick{cursor:pointer;border:none;transition:transform .12s;}
.bs-weight--pick:active{transform:scale(.88);}
.bs-weight--used{opacity:.35;cursor:default;}
.bs-status{font-size:1.05rem;font-weight:800;text-align:center;min-height:1.6rem;}
.bs-status--ok{color:#3aab53;}
.bs-pool{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.55);border-radius:18px;box-shadow:var(--shadow);max-width:380px;}
.bs-reset{margin-top:2px;border:none;background:#fff;color:#555;font-weight:700;font-size:.95rem;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);cursor:pointer;}
.bs-reset:active{transform:scale(.95);}
@media (max-width:380px){.bs-scale{width:280px;}.bs-pan{width:100px;}.bs-pan--left{transform:translateX(-32px);}.bs-pan--right{transform:translateX(32px);}}
`;
}

export function create(): BalanceScaleGame {
  return new BalanceScaleGame();
}
