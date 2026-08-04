/* 数字天平 Math Balance —— 左盘有几个数字砝码（如 3 和 2，合 = 5），
   右盘空，孩子从候选里挑数字砝码加到右盘，让两边总和相等（平衡）。
   独特点：天平根据两边差实时倾斜，平衡时横杆水平 + 绿光，理解等量关系。
   视觉：天平支架 + 横杆 + 双盘 + 数字砝码。难度 = 数字大小。通关 = 平衡目标轮数。
   注意 CSS 前缀 mb2-（memory-flip=mf-，mini-sudoku=ms2-，不冲突）。
   保证有解：候选池里至少包含一个等于 target 的单砝码解。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

export class MathBalanceGame extends BaseGame {
  constructor() {
    super("math-balance");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private target = 0; // 左盘总和（目标）
  private current = 0; // 右盘当前总和
  private beam!: HTMLDivElement;
  private panRight!: HTMLDivElement;
  private status!: HTMLDivElement;
  private buttons: HTMLButtonElement[] = [];
  private solved = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  /** 左盘砝码数（数字范围随难度上升） */
  private leftCount(): number {
    return this.difficulty === "easy" ? 3: this.difficulty === "medium"
        ? 4
        : 6;
  }
  private valueMax(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 5
        : 9;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.current = 0;
    this.solved = false;

    // 生成左盘砝码
    const leftVals: number[] = [];
    const vmax = this.valueMax();
    for (let i = 0; i < this.leftCount(); i++) {
      leftVals.push(randInt(1, vmax));
    }
    this.target = leftVals.reduce((a, b) => a + b, 0);

    // 构造候选池：保证至少有一个解（单砝码等于 target，或拆成若干 ≤ vmax）
    const pool = this.buildPool(this.target, vmax);

    const wrap = document.createElement("div");
    wrap.className = "mb2-wrap";

    const task = document.createElement("div");
    task.className = "mb2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 加砝码到右盘，让 <b>两边一样重</b>`;
    wrap.appendChild(task);

    // 天平
    const scale = document.createElement("div");
    scale.className = "mb2-scale";
    scale.innerHTML = `
      <div class="mb2-stand"></div>
      <div class="mb2-beam-wrap"><div class="mb2-beam"></div>
        <div class="mb2-pan mb2-pan--left"></div>
        <div class="mb2-pan mb2-pan--right"></div>
      </div>`;
    wrap.appendChild(scale);
    this.beam = scale.querySelector(".mb2-beam") as HTMLDivElement;
    const panLeft = scale.querySelector(".mb2-pan--left") as HTMLDivElement;
    this.panRight = scale.querySelector(".mb2-pan--right") as HTMLDivElement;
    leftVals.forEach((v) => {
      const w = this.makeWeight(v, false);
      panLeft.appendChild(w);
    });

    // 状态行
    this.status = document.createElement("div");
    this.status.className = "mb2-status";
    wrap.appendChild(this.status);

    // 候选砝码池
    const poolEl = document.createElement("div");
    poolEl.className = "mb2-pool";
    this.buttons = [];
    shuffle(pool).forEach((v) => {
      const b = this.makeWeight(v, true) as HTMLButtonElement;
      b.addEventListener("click", () => this.add(v, b));
      poolEl.appendChild(b);
      this.buttons.push(b);
    });
    wrap.appendChild(poolEl);

    // 重置
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "mb2-reset";
    reset.textContent = "↩️ 清空右盘";
    reset.addEventListener("click", () => this.resetRight());
    wrap.appendChild(reset);

    this.root.appendChild(wrap);
    this.updateTilt();
  }

  private makeWeight(v: number, pickable: boolean): HTMLElement {
    const w = document.createElement(pickable ? "button" : "div");
    w.className = "mb2-weight" + (pickable ? " mb2-weight--pick" : "");
    if (pickable) (w as HTMLButtonElement).type = "button";
    w.dataset.value = String(v);
    w.textContent = String(v);
    return w;
  }

  /** 候选砝码池：放一个等于 target 的解 + 若干干扰，保证可解 */
  private buildPool(target: number, vmax: number): number[] {
    const pool: number[] = [];
    if (target <= vmax) {
      pool.push(target);
    } else {
      // 拆成若干 ≤ vmax
      let rest = target;
      while (rest > 0) {
        const take = Math.min(vmax, rest);
        pool.push(take);
        rest -= take;
      }
    }
    const distract =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    for (let i = 0; i < distract; i++) {
      pool.push(randInt(1, vmax));
    }
    return pool;
  }

  private add(value: number, btn: HTMLButtonElement): void {
    if (this.solved) return;
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add("mb2-weight--used");
    const w = this.makeWeight(value, false);
    this.panRight.appendChild(w);
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
    this.panRight.innerHTML = "";
    this.buttons.forEach((b) => {
      b.disabled = false;
      b.classList.remove("mb2-weight--used");
    });
    this.updateTilt();
  }

  private updateTilt(): void {
    const diff = this.current - this.target;
    const angle = Math.max(-22, Math.min(22, diff * 7));
    this.beam.style.transform = `rotate(${angle}deg)`;
    if (diff === 0) {
      this.status.innerHTML = `平衡！两边都是 <b>${this.target}</b> 🎉`;
      this.status.classList.add("mb2-status--ok");
      this.beam.classList.add("mb2-beam--balanced");
    } else if (this.current < this.target) {
      this.status.innerHTML = `右盘 ${this.current}，还差 <b>${this.target - this.current}</b>`;
      this.status.classList.remove("mb2-status--ok");
      this.beam.classList.remove("mb2-beam--balanced");
    } else {
      this.status.innerHTML = `右盘 ${this.current}，太重啦！多 <b>${this.current - this.target}</b>`;
      this.status.classList.remove("mb2-status--ok");
      this.beam.classList.remove("mb2-beam--balanced");
    }
  }

  private win(): void {
    this.solved = true;
    const r = this.panRight.getBoundingClientRect();
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
      body: "右盘太重啦，点「清空右盘」重新加～",
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
    if (document.getElementById("mb2-style")) return;
    const st = document.createElement("style");
    st.id = "mb2-style";
    st.textContent = MB2_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function MB2_CSS(theme: string): string {
  return `
.mb2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.mb2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.mb2-task b{color:${theme};}
.mb2-scale{position:relative;width:340px;height:180px;margin:6px 0;}
.mb2-stand{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:20px;height:112px;background:linear-gradient(#caa472,#a07a4e);border-radius:6px;box-shadow:var(--shadow);}
.mb2-stand::after{content:"";position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:76px;height:14px;background:#8a6a40;border-radius:50%;}
.mb2-beam-wrap{position:absolute;top:30px;left:0;right:0;height:0;}
.mb2-beam{position:absolute;left:30px;right:30px;top:0;height:14px;background:linear-gradient(${theme},color-mix(in srgb,${theme} 70%,#000));border-radius:8px;transform-origin:center;transition:transform .4s cubic-bezier(.34,1.56,.64,1);box-shadow:0 3px 6px rgba(0,0,0,.2);}
.mb2-beam::before{content:"";position:absolute;left:50%;top:-12px;transform:translateX(-50%);width:22px;height:22px;background:color-mix(in srgb,${theme} 60%,#fff);border-radius:50%;box-shadow:inset 0 -3px 4px rgba(0,0,0,.2);}
.mb2-beam--balanced{animation:mb2-glow 1s ease infinite;}
@keyframes mb2-glow{0%,100%{box-shadow:0 0 0 0 rgba(107,207,127,.6)}50%{box-shadow:0 0 16px 4px rgba(107,207,127,.7)}}
.mb2-pan{position:absolute;bottom:-6px;width:128px;height:38px;background:linear-gradient(#eee,#bdbdbd);border-radius:0 0 60px 60px / 0 0 30px 30px;display:flex;align-items:flex-start;justify-content:center;gap:4px;padding-top:5px;box-shadow:inset 0 -4px 6px rgba(0,0,0,.15);}
.mb2-pan--left{left:0;transform:translateX(-44px);}
.mb2-pan--right{right:0;transform:translateX(44px);}
.mb2-pan::before{content:"";position:absolute;top:-28px;left:50%;width:2px;height:30px;background:#999;}
.mb2-weight{min-width:32px;height:32px;border-radius:7px;background:linear-gradient(#ffd93d,#ffb300);color:#5a3d00;font-weight:900;font-size:.95rem;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 -3px 4px rgba(0,0,0,.2),0 2px 3px rgba(0,0,0,.2);padding:0 5px;}
.mb2-weight--pick{cursor:pointer;border:none;transition:transform .12s;}
.mb2-weight--pick:active{transform:scale(.88);}
.mb2-weight--used{opacity:.35;cursor:default;}
.mb2-status{font-size:1.05rem;font-weight:800;text-align:center;min-height:1.6rem;}
.mb2-status b{color:${theme};}
.mb2-status--ok{color:#3aab53;}
.mb2-pool{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.55);border-radius:18px;box-shadow:var(--shadow);max-width:400px;}
.mb2-reset{margin-top:2px;border:none;background:#fff;color:#555;font-weight:700;font-size:.95rem;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);cursor:pointer;}
.mb2-reset:active{transform:scale(.95);}
@media (max-width:380px){.mb2-scale{width:300px;}.mb2-pan{width:108px;}.mb2-pan--left{transform:translateX(-36px);}.mb2-pan--right{transform:translateX(36px);}}
`;
}

export function create(): MathBalanceGame {
  return new MathBalanceGame();
}
