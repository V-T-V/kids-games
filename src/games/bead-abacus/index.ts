/* 算盘 Bead Abacus —— 显示一个简化算盘（每档 5 颗下珠 + 1 颗上珠），
   题目"拨出数字 N"，孩子点击珠子把它们拨到靠梁位置。
   独特点：上珠=5、下珠=1 的进位认知，拨珠带滑动动画与咔嗒声。
   视觉：木质框架 + 横档 + 红蓝珠子 + 靠梁指示线。
   难度 = 数字大小（easy 1-5 / medium 6-15 / hard 16-49，两位）。通关 = 拨对目标轮数。
   保证有解：单档最大 9，两位最大 99，题目都在范围内。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

/** 算盘档数（个位、十位） */
const RODS = 2;
const LOWER_BEADS = 5; // 下珠个数
const UPPER_BEAD_VAL = 5;

export class BeadAbacusGame extends BaseGame {
  constructor() {
    super("bead-abacus");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private target = 0;
  private locked = false;
  /** 每档每珠是否被拨到靠梁（active） */
  private rodState: boolean[][] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  /** 按难度出题范围 */
  private range(): [number, number] {
    return this.difficulty === "easy"
      ? [1, 5]
      : this.difficulty === "medium"
        ? [6, 15]
        : [16, 49];
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const [lo, hi] = this.range();
    this.target = randInt(lo, hi);
    // 初始全部"未靠梁"
    this.rodState = [];
    for (let r = 0; r < RODS; r++) {
      // 每档：1 颗上珠 + LOWER_BEADS 颗下珠
      const arr = [false, ...new Array(LOWER_BEADS).fill(false)];
      this.rodState.push(arr);
    }

    const wrap = document.createElement("div");
    wrap.className = "ba-wrap";

    const task = document.createElement("div");
    task.className = "ba-task";
    task.innerHTML = `拨出数字 <b>${this.target}</b> · 第 ${this.roundsDone + 1}/${this.roundTotal} 关`;
    wrap.appendChild(task);

    const abacus = document.createElement("div");
    abacus.className = "ba-frame";

    // 档标签（从右到左：个位、十位）
    const labels = ["个", "十"];
    for (let r = RODS - 1; r >= 0; r--) {
      const rod = document.createElement("div");
      rod.className = "ba-rod";
      rod.dataset.rod = String(r);

      // 上珠区
      const upper = document.createElement("div");
      upper.className = "ba-upper";
      const ub = document.createElement("button");
      ub.type = "button";
      ub.className = "ba-bead ba-bead--upper";
      ub.dataset.rod = String(r);
      ub.dataset.idx = "0";
      ub.addEventListener("click", () => this.toggle(r, 0));
      upper.appendChild(ub);
      rod.appendChild(upper);

      // 横梁（分隔上下）
      const beam = document.createElement("div");
      beam.className = "ba-beam";
      rod.appendChild(beam);

      // 下珠区
      const lower = document.createElement("div");
      lower.className = "ba-lower";
      for (let i = 0; i < LOWER_BEADS; i++) {
        const lb = document.createElement("button");
        lb.type = "button";
        lb.className = "ba-bead ba-bead--lower";
        lb.dataset.rod = String(r);
        lb.dataset.idx = String(i + 1);
        lb.addEventListener("click", () => this.toggle(r, i + 1));
        lower.appendChild(lb);
      }
      rod.appendChild(lower);

      // 档标签
      const lab = document.createElement("div");
      lab.className = "ba-rod-label";
      lab.textContent = labels[r]!;
      rod.appendChild(lab);

      abacus.appendChild(rod);
    }
    wrap.appendChild(abacus);

    // 当前数值显示
    const readout = document.createElement("div");
    readout.className = "ba-readout";
    readout.id = "ba-readout";
    readout.textContent = `现在：0`;
    wrap.appendChild(readout);

    // 提交按钮
    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "ba-submit";
    submit.textContent = "✓ 对啦！";
    submit.addEventListener("click", () => this.check());
    wrap.appendChild(submit);

    this.root.appendChild(wrap);
    this.applyState();
  }

  /** 切换某档某珠：实现"靠梁/离梁"。
      简化交互：点任一珠，把它和"更靠近梁侧"的珠一起切换到靠梁，
      把离梁更远的归位。这样符合算盘"拨到位置"的直觉。 */
  private toggle(rod: number, idx: number): void {
    if (this.locked) return;
    const arr = this.rodState[rod]!;
    if (idx === 0) {
      // 上珠单切
      arr[0] = !arr[0];
    } else {
      // 下珠：点击第 k 颗 → 让 1..k 全靠梁，k+1..end 全离梁；
      // 若已经全部靠梁到 k，则全部离梁
      const allOn = arr.slice(1, idx + 1).every((v) => v) && !arr[idx + 1];
      for (let i = 1; i <= LOWER_BEADS; i++) {
        if (!allOn) arr[i] = i <= idx;
        else arr[i] = false;
      }
    }
    sfxPop();
    this.applyState();
  }

  private applyState(): void {
    for (let r = 0; r < RODS; r++) {
      const arr = this.rodState[r]!;
      const rodEl = this.root.querySelector<HTMLElement>(
        `.ba-rod[data-rod="${r}"]`,
      );
      if (!rodEl) continue;
      const ub = rodEl.querySelector<HTMLButtonElement>(".ba-bead--upper");
      if (ub) ub.classList.toggle("ba-bead--active", arr[0]!);
      const lbs = rodEl.querySelectorAll<HTMLButtonElement>(".ba-bead--lower");
      lbs.forEach((b, i) => {
        b.classList.toggle("ba-bead--active", !!arr[i + 1]);
      });
    }
    const rd = this.root.querySelector("#ba-readout");
    if (rd) rd.textContent = `现在：${this.currentValue()}`;
  }

  /** 当前算盘表示的数值：十位档 *10 + 个位档，每档 = 上珠5 + 下珠靠梁数 */
  private currentValue(): number {
    let val = 0;
    for (let r = 0; r < RODS; r++) {
      const arr = this.rodState[r]!;
      const rodVal =
        (arr[0] ? UPPER_BEAD_VAL : 0) + arr.slice(1).filter((v) => v).length;
      const place = r === 0 ? 1 : 10; // r=0 是个位（最右），r=1 是十位
      val += rodVal * place;
    }
    return val;
  }

  private check(): void {
    if (this.locked) return;
    const cur = this.currentValue();
    if (cur === this.target) {
      this.locked = true;
      const rd = this.root.querySelector("#ba-readout");
      const r = rd?.getBoundingClientRect();
      this.onCorrect(
        r ? r.left + r.width / 2 : window.innerWidth / 2,
        r ? r.top : window.innerHeight / 2,
      );
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `目标是 ${this.target}，再数数珠子～ 上珠=5，下珠=1`,
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
    if (document.getElementById("ba-style")) return;
    const st = document.createElement("style");
    st.id = "ba-style";
    st.textContent = BA_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function BA_CSS(theme: string): string {
  return `
.ba-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.ba-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ba-task b{color:${theme};font-size:1.4rem;}
.ba-frame{display:flex;gap:18px;padding:14px 18px;background:linear-gradient(#d9a066,#b07a44);border-radius:16px;box-shadow:var(--shadow),inset 0 2px 4px rgba(255,255,255,.3);border:4px solid #8a5a30;}
.ba-rod{display:flex;flex-direction:column;align-items:center;gap:3px;position:relative;}
.ba-upper,.ba-lower{display:flex;flex-direction:column;align-items:center;gap:3px;min-height:36px;}
.ba-lower{flex-direction:column-reverse;}
.ba-beam{width:34px;height:8px;background:linear-gradient(#5a3d20,#3a2410);border-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,.4);margin:2px 0;}
.ba-bead{width:32px;height:18px;border-radius:50%;border:none;cursor:pointer;padding:0;position:relative;transition:transform .25s cubic-bezier(.34,1.56,.64,1);box-shadow:inset 0 -3px 4px rgba(0,0,0,.3),0 2px 3px rgba(0,0,0,.25);}
.ba-bead--upper{background:radial-gradient(ellipse at 50% 35%,#ff9aa2,#d63a4a);}
.ba-bead--lower{background:radial-gradient(ellipse at 50% 35%,#7aa5ff,#3458d6);}
.ba-bead--active{transform:translateY(0);}
.ba-bead--upper:not(.ba-bead--active){transform:translateY(-14px);}
.ba-bead--lower:not(.ba-bead--active){transform:translateY(14px);}
.ba-bead:active{filter:brightness(1.1);}
.ba-rod-label{font-size:.7rem;font-weight:800;color:#fff;background:#5a3d20;border-radius:4px;padding:1px 5px;margin-top:4px;}
.ba-readout{font-size:1.3rem;font-weight:900;color:${theme};}
.ba-submit{border:none;background:#6bcf7f;color:#fff;font-weight:800;font-size:1.1rem;padding:10px 28px;border-radius:999px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;}
.ba-submit:active{transform:scale(.94);}
@media (max-width:380px){.ba-bead{width:28px;height:16px;}.ba-beam{width:30px;}}
`;
}

export function create(): BeadAbacusGame {
  return new BeadAbacusGame();
}
