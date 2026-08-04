/* 水果秤 Fruit Weight —— 天平两边放不同水果，孩子判断哪边更重并选择。
   独特点：重量比较 + 视觉天平反馈。每种水果隐含重量（西瓜重草莓轻）。
   视觉：CSS 天平（横梁可旋转），水果 emoji 堆在两边托盘上。选对后横梁按真实重量倾斜。
   难度 = 重量差异大小（差异越小越难判断）。通关 = 答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Fruit {
  emoji: string;
  weight: number;
}

const FRUITS: Fruit[] = [
  { emoji: "🍓", weight: 1 },
  { emoji: "🍒", weight: 1 },
  { emoji: "🍇", weight: 2 },
  { emoji: "🍎", weight: 3 },
  { emoji: "🍊", weight: 3 },
  { emoji: "🍐", weight: 3 },
  { emoji: "🍌", weight: 4 },
  { emoji: "🥭", weight: 4 },
  { emoji: "🍍", weight: 5 },
  { emoji: "🍉", weight: 6 },
];

export class FruitWeightGame extends BaseGame {
  constructor() {
    super("fruit-weight");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 根据难度生成左右两侧水果组合，返回 {left, right, heavierSide}。 */
  private genPair(): {
    left: Fruit[];
    right: Fruit[];
    heavier: "left" | "right";
  } {
    const pool = shuffle(FRUITS);
    // 难度决定两侧数量与差异
    const perSide =
      this.difficulty === "easy" ? 1 : this.difficulty === "medium" ? 2 : 2;
    // easy：1 vs 1，差异大；medium/hard：多水果，差异小
    const left: Fruit[] = [];
    const right: Fruit[] = [];
    for (let i = 0; i < perSide; i++) left.push(pool[i]!);
    for (let i = 0; i < perSide; i++) right.push(pool[perSide + i]!);
    const lw = left.reduce((s, f) => s + f.weight, 0);
    const rw = right.reduce((s, f) => s + f.weight, 0);
    if (lw === rw) {
      // 极少出现：把右侧第一颗换成稍重的，保证有答案
      right[0] = pool[perSide * 2] ?? right[0]!;
    }
    const lw2 = left.reduce((s, f) => s + f.weight, 0);
    const rw2 = right.reduce((s, f) => s + f.weight, 0);
    return {
      left,
      right,
      heavier: lw2 > rw2 ? "left" : "right",
    };
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    const pair = this.genPair();

    const wrap = document.createElement("div");
    wrap.className = "fw-wrap";
    const task = document.createElement("div");
    task.className = "fw-task";
    task.textContent = `哪边更重？点下面正确的按钮～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 天平
    const scale = document.createElement("div");
    scale.className = "fw-scale";
    const beamWrap = document.createElement("div");
    beamWrap.className = "fw-beam-wrap";
    const beam = document.createElement("div");
    beam.className = "fw-beam";
    beam.id = "fw-beam";

    // 左托盘
    const leftPan = document.createElement("div");
    leftPan.className = "fw-pan fw-pan--left";
    const leftFruits = document.createElement("div");
    leftFruits.className = "fw-fruits";
    pair.left.forEach((f) => {
      const e = document.createElement("span");
      e.className = "fw-fruit";
      e.textContent = f.emoji;
      leftFruits.appendChild(e);
    });
    leftPan.appendChild(leftFruits);
    const leftRope = document.createElement("div");
    leftRope.className = "fw-rope fw-rope--left";
    beam.appendChild(leftRope);
    beam.appendChild(leftPan);

    // 右托盘
    const rightPan = document.createElement("div");
    rightPan.className = "fw-pan fw-pan--right";
    const rightFruits = document.createElement("div");
    rightFruits.className = "fw-fruits";
    pair.right.forEach((f) => {
      const e = document.createElement("span");
      e.className = "fw-fruit";
      e.textContent = f.emoji;
      rightFruits.appendChild(e);
    });
    rightPan.appendChild(rightFruits);
    const rightRope = document.createElement("div");
    rightRope.className = "fw-rope fw-rope--right";
    beam.appendChild(rightRope);
    beam.appendChild(rightPan);

    // 中轴
    const pole = document.createElement("div");
    pole.className = "fw-pole";
    const fulcrum = document.createElement("div");
    fulcrum.className = "fw-fulcrum";
    pole.appendChild(fulcrum);

    beamWrap.appendChild(beam);
    scale.appendChild(beamWrap);
    scale.appendChild(pole);
    wrap.appendChild(scale);

    // 选项
    const opts = document.createElement("div");
    opts.className = "fw-opts";
    const mk = (side: "left" | "right", label: string, emoji: string) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fw-opt";
      b.innerHTML = `${emoji} ${label}更重`;
      b.addEventListener("click", () =>
        this.choose(side, pair.heavier, beam, b),
      );
      return b;
    };
    opts.appendChild(mk("left", "左边", "⬅️"));
    opts.appendChild(mk("right", "右边", "➡️"));
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(
    side: "left" | "right",
    answer: "left" | "right",
    beam: HTMLElement,
    btn: HTMLButtonElement,
  ): void {
    if (this.answered) return;
    if (side === answer) {
      this.answered = true;
      sfxPop();
      // 横梁按真实重量倾斜（重的那边下沉）
      beam.classList.add(
        answer === "left" ? "fw-beam--left-heavy" : "fw-beam--right-heavy",
      );
      btn.classList.add("fw-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1300);
    } else {
      btn.classList.add("fw-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("fw-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "比一比哪种水果更重，大的水果通常更重哦～",
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
    if (document.getElementById("fw-style")) return;
    const st = document.createElement("style");
    st.id = "fw-style";
    st.textContent = FW_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function FW_CSS(theme: string): string {
  return `
.fw-wrap{display:flex;flex-direction:column;align-items:center;gap:26px;width:min(520px,100%);}
.fw-task{font-size:1.15rem;font-weight:800;text-align:center;}
.fw-scale{position:relative;width:340px;height:230px;}
.fw-beam-wrap{position:absolute;left:50%;top:50px;transform:translateX(-50%);width:300px;height:30px;}
.fw-beam{position:relative;width:100%;height:8px;background:linear-gradient(180deg,#caa472,#8b5e34);border-radius:4px;box-shadow:var(--shadow);transform-origin:center center;transition:transform .6s cubic-bezier(.34,1.56,.64,1);}
.fw-beam--left-heavy{transform:rotate(-14deg);}
.fw-beam--right-heavy{transform:rotate(14deg);}
.fw-rope{position:absolute;top:4px;width:2px;height:46px;background:#8b5e34;}
.fw-rope--left{left:18px;}
.fw-rope--right{right:18px;}
.fw-pan{position:absolute;top:48px;width:110px;min-height:46px;padding:4px;background:linear-gradient(180deg,#fff,#f0e6d6);border:3px solid ${theme};border-radius:8px 8px 26px 26px;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;}
.fw-pan--left{left:-37px;}
.fw-pan--right{right:-37px;}
.fw-fruits{display:flex;flex-wrap:wrap;gap:2px;justify-content:center;}
.fw-fruit{font-size:1.5rem;line-height:1;}
.fw-pole{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:14px;height:120px;background:linear-gradient(90deg,#5b3a1a,#8b5e34,#5b3a1a);border-radius:4px;}
.fw-fulcrum{position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:18px solid transparent;border-right:18px solid transparent;border-bottom:14px solid #8b5e34);}
.fw-opts{display:flex;gap:18px;}
.fw-opt{min-height:56px;padding:0 24px;border-radius:18px;background:#fff;font-size:1.2rem;font-weight:800;box-shadow:var(--shadow);}
.fw-opt:active{transform:scale(.94);}
.fw-opt--done{background:#d4f4dd;animation:fw-pop .4s ease;}
.fw-opt--wrong{animation:fw-shake .4s ease;}
@keyframes fw-pop{0%{transform:scale(.7)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes fw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.fw-scale{width:300px;height:210px;}.fw-beam-wrap{width:270px;}}
`;
}

export function create(): FruitWeightGame {
  return new FruitWeightGame();
}
