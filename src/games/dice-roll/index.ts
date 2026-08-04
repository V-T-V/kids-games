/* 掷骰 Dice Roll —— 显示一个 CSS 画的骰子（1-6 点），孩子点"掷"再选
   骰子是几点，答对继续。视觉：3D 风格的方块骰子，点数为彩色圆点。
   难度=点数范围（easy 1-3 / medium 1-4 / hard 1-6）。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxTick } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, randInt } from "../../lobby/util.ts";
import { starsByAccuracy } from "../../core/scoring.ts";

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 1],
    [0, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
};

export class DiceRollGame extends BaseGame {
  constructor() {
    super("dice-roll");
  }

  private maxFace = 6;
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private face = 1;

  protected mount(): void {
    this.maxFace =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 6;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* 无定时器/动画需手动清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "dr2-wrap";

    const task = document.createElement("div");
    task.className = "dr2-task";
    task.innerHTML = `看看骰子几点，点对应数字！<br><small>答对 ${this.roundTotal} 次通关</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "dr2-stage";
    const dice = document.createElement("div");
    dice.className = "dr2-dice";
    dice.id = "dr2-dice";
    stage.appendChild(dice);
    wrap.appendChild(stage);

    const choices = document.createElement("div");
    choices.className = "dr2-choices";
    choices.id = "dr2-choices";
    wrap.appendChild(choices);

    this.root.appendChild(wrap);

    // 滚动动画后定型
    this.roll(dice, choices);
  }

  private roll(dice: HTMLElement, choices: HTMLElement): void {
    // 动画：随机滚几次
    let ticks = 8;
    const animate = (): void => {
      this.face = randInt(1, 6);
      this.renderPips(dice, this.face);
      ticks -= 1;
      if (ticks > 0) {
        sfxTick();
        this.trackTimeout(animate, 70);
      } else {
        // 定型到本关范围内的一个点数
        this.face = randInt(1, this.maxFace);
        this.renderPips(dice, this.face);
        dice.classList.add("dr2-dice--done");
        this.buildChoices(choices);
      }
    };
    dice.classList.remove("dr2-dice--done");
    animate();
  }

  private renderPips(dice: HTMLElement, face: number): void {
    dice.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "dr2-pips";
    const pips = PIPS[face] ?? [];
    // 9 个格子，按 PIPS 坐标点亮点
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cell = document.createElement("span");
        cell.className = "dr2-pip";
        const on = pips.some(([pr, pc]) => pr === r && pc === c);
        if (on) cell.classList.add("dr2-pip--on");
        grid.appendChild(cell);
      }
    }
    dice.appendChild(grid);
  }

  private buildChoices(choices: HTMLElement): void {
    choices.innerHTML = "";
    // 选项：本范围内的所有数字（保证唯一），打乱
    const nums = shuffle(Array.from({ length: this.maxFace }, (_, i) => i + 1));
    nums.forEach((n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dr2-choice";
      b.textContent = String(n);
      b.addEventListener("click", () => this.onChoice(b, n));
      choices.appendChild(b);
    });
  }

  private onChoice(btn: HTMLButtonElement, n: number): void {
    if (this.locked) return;
    this.locked = true;
    const all = this.root.querySelectorAll<HTMLButtonElement>(".dr2-choice");
    all.forEach((b) => (b.disabled = true));

    if (n === this.face) {
      btn.classList.add("dr2-choice--ok");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 650);
    } else {
      const paused = this.onWrong();
      btn.classList.add("dr2-choice--bad");
      // 标出正确答案
      const right = Array.from(all).find(
        (b) => Number(b.textContent) === this.face,
      );
      if (right) right.classList.add("dr2-choice--ok");
      if (paused) {
        this.showRest();
        return;
      }
      this.trackTimeout(() => this.startRound(), 1100);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "歇一歇～",
      emoji: "🎲",
      variant: "rest",
      body: "数一数骰子上有几个圆点，就是数字几～",
      primary: { text: "继续", icon: "🎲", onClick: () => ov.destroy() },
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
    if (document.getElementById("dr2-style")) return;
    const st = document.createElement("style");
    st.id = "dr2-style";
    st.textContent = DR2_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function DR2_CSS(theme: string): string {
  return `
.dr2-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:100%;}
.dr2-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.dr2-task small{display:block;margin-top:4px;font-weight:700;color:#888;font-size:.85rem;}
.dr2-stage{perspective:600px;}
.dr2-dice{width:140px;height:140px;border-radius:26px;background:linear-gradient(135deg,#fff,#f0f0f5);box-shadow:inset 0 -8px 14px rgba(0,0,0,.12),inset 0 6px 10px rgba(255,255,255,.9),var(--shadow-lg);display:flex;align-items:center;justify-content:center;transition:transform .15s;}
.dr2-dice--done{outline:4px solid ${theme};outline-offset:3px;}
.dr2-pips{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:6px;width:96px;height:96px;}
.dr2-pip{width:22px;height:22px;border-radius:50%;background:transparent;align-self:center;justify-self:center;}
.dr2-pip--on{background:radial-gradient(circle at 35% 30%,#ff9a9a,${theme});box-shadow:inset 0 -2px 3px rgba(0,0,0,.3);}
.dr2-choices{display:grid;grid-template-columns:repeat(3,minmax(64px,1fr));gap:12px;max-width:340px;}
.dr2-choice{min-height:64px;font-size:1.8rem;font-weight:900;color:#fff;background:linear-gradient(160deg,#4d96ff,#2f6dd6);border:none;border-radius:18px;box-shadow:0 6px 0 #1f4fa8,var(--shadow);transition:transform .12s;cursor:pointer;}
.dr2-choice:active{transform:translateY(3px);}
.dr2-choice--ok{background:linear-gradient(160deg,#6bcf7f,#3da858);box-shadow:0 6px 0 #2f8c46,var(--shadow);animation:dr2-pop .4s ease;}
.dr2-choice--bad{background:linear-gradient(160deg,#ff6b6b,#c92a2a);box-shadow:0 6px 0 #a52828,var(--shadow);animation:dr2-shake .4s ease;}
@keyframes dr2-pop{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes dr2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.dr2-dice{width:120px;height:120px;}.dr2-pips{width:84px;height:84px;}.dr2-choice{font-size:1.5rem;}}
`;
}

export function create(): DiceRollGame {
  return new DiceRollGame();
}
