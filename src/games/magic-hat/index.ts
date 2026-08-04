/* 魔术帽 Magic Hat —— 3-5 顶帽子，一个球藏在其中一顶下，
   先展示球在哪顶，然后帽子快速交换位置打乱，孩子追踪球在哪顶。
   独特点：视觉追踪 + 记忆，帽子交换用 CSS 动画呈现移动轨迹。
   巧思：交换通过维护"逻辑位置→帽子元素"映射，用 transform 平移到位。
   难度=帽数/交换次数。通关=猜对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Hat {
  el: HTMLElement;
}

export class MagicHatGame extends BaseGame {
  constructor() {
    super("magic-hat");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 逻辑位置 i 上的帽子元素（球的位置用 ballPos 索引到这个数组） */
  private slots: Hat[] = [];
  /** 球当前所在的逻辑位置（0..n-1） */
  private ballPos = 0;
  private hatN = 3;
  private busy = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 + trackTimeout 自动清理 */
  }

  private hatCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }
  private swapCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 5
        : 7;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = true;
    this.hatN = this.hatCount();
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "mh-wrap";
    wrap.id = "mh-wrap";

    const task = document.createElement("div");
    task.className = "mh-task";
    task.innerHTML = `盯紧球藏在哪顶帽子下！<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "mh-stage";
    stage.id = "mh-stage";

    this.slots = [];
    for (let i = 0; i < this.hatN; i++) {
      const h = document.createElement("button");
      h.type = "button";
      h.className = "mh-hat";
      h.setAttribute("aria-label", `帽子 ${i + 1}`);
      h.textContent = "🎩";
      // 用元素引用判定，避免位置索引漂移
      const hatObj: Hat = { el: h };
      h.addEventListener("click", () => this.guessByEl(hatObj, h));
      stage.appendChild(h);
      this.slots.push(hatObj);
    }
    wrap.appendChild(stage);
    this.root.appendChild(wrap);

    // 球随机藏在某顶下
    this.ballPos = randInt(0, this.hatN - 1);

    // 阶段 1：抬起帽子露出球 1.2s
    this.trackTimeout(() => {
      const hat = this.slots[this.ballPos]!;
      hat.el.classList.add("mh-hat--up");
      this.showBall(this.ballPos, true);
      this.trackTimeout(() => {
        hat.el.classList.remove("mh-hat--up");
        this.showBall(this.ballPos, false);
        // 阶段 2：交换位置打乱
        this.trackTimeout(() => this.doSwaps(), 500);
      }, 1400);
    }, 600);
  }

  /** 在某顶帽子下方显示/隐藏球视觉。 */
  private showBall(pos: number, show: boolean): void {
    const hat = this.slots[pos];
    if (!hat) return;
    let ball = hat.el.parentElement?.querySelector(
      `.mh-ball[data-pos="${pos}"]`,
    ) as HTMLDivElement | null;
    if (show) {
      if (!ball) {
        ball = document.createElement("div");
        ball.className = "mh-ball";
        ball.dataset.pos = String(pos);
        hat.el.parentElement!.appendChild(ball);
      }
      this.layoutBall(pos);
      ball.classList.add("mh-ball--show");
    } else {
      ball?.classList.remove("mh-ball--show");
      // 球元素保留以便位置后续复用，最终由 root.innerHTML 清空
    }
  }

  private layoutBall(pos: number): void {
    const stage = this.root.querySelector("#mh-stage") as HTMLElement | null;
    if (!stage) return;
    const ball = stage.querySelector(
      `.mh-ball[data-pos="${pos}"]`,
    ) as HTMLDivElement | null;
    if (!ball) return;
    const hats = stage.querySelectorAll(".mh-hat");
    if (pos >= hats.length) return;
    const target = hats[pos]!.getBoundingClientRect();
    const stageR = stage.getBoundingClientRect();
    ball.style.left = `${target.left - stageR.left + target.width / 2}px`;
    ball.style.top = `${target.top - stageR.top + target.height - 16}px`;
  }

  /** 执行若干次相邻或任意两顶交换，每次更新 slots 顺序 + 球位置。 */
  private doSwaps(): void {
    const n = this.swapCount();
    let done = 0;
    const doOne = (): void => {
      if (done >= n) {
        this.busy = false;
        return;
      }
      done += 1;
      const [i, j] = this.pickSwapPair();
      // CSS 用 transition 平移；通过 flex order 重排视觉
      this.applySwap(i, j);
      // 交换 slots 数组中的元素
      [this.slots[i], this.slots[j]] = [this.slots[j]!, this.slots[i]!];
      // 球跟随：如果球在 i，现在去 j；反之亦然
      if (this.ballPos === i) this.ballPos = j;
      else if (this.ballPos === j) this.ballPos = i;
      sfxPop();
      this.trackTimeout(doOne, 480);
    };
    doOne();
  }

  /** 选两个不同的逻辑位置交换（保证至少相邻或近邻，便于追踪）。 */
  private pickSwapPair(): [number, number] {
    const i = randInt(0, this.hatN - 1);
    // 优先与相邻交换（视觉更清晰）
    let j: number;
    if (Math.random() < 0.7 && this.hatN > 1) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      j = i + dir;
      if (j < 0) j = i + 1;
      if (j >= this.hatN) j = i - 1;
    } else {
      do {
        j = randInt(0, this.hatN - 1);
      } while (j === i);
    }
    return [i, Math.max(0, Math.min(this.hatN - 1, j))];
  }

  /** 用 DOM 节点真正交换两个帽子的视觉位置（不用 order）。 */
  private applySwap(i: number, j: number): void {
    if (i === j) return;
    const stage = this.slots[i]!.el.parentElement!;
    const elI = this.slots[i]!.el;
    const elJ = this.slots[j]!.el;
    // 用占位节点实现两个节点的 DOM 位置交换
    const placeholder = document.createElement("span");
    stage.insertBefore(placeholder, elI);
    stage.insertBefore(elI, elJ);
    stage.insertBefore(elJ, placeholder);
    placeholder.remove();
  }

  /** 通过帽子元素引用判定（球在 slots[ballPos]，找到被点击帽子在 slots 中的索引比较）。 */
  private guessByEl(hatObj: Hat, btn: HTMLButtonElement): void {
    if (this.busy) return;
    this.busy = true;
    // 被点击的帽子在当前 slots 数组里的位置
    const clickedIdx = this.slots.indexOf(hatObj);
    if (clickedIdx === this.ballPos) {
      // 答对：抬起露出球
      hatObj.el.classList.add("mh-hat--up");
      this.showBall(this.ballPos, true);
      sfxPop();
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
      }, 1100);
    } else {
      // 答错：揭示正确帽子
      const correct = this.slots[this.ballPos]!;
      correct.el.classList.add("mh-hat--up");
      this.showBall(this.ballPos, true);
      btn.classList.add("mh-hat--wrong");
      this.onWrong();
      this.trackTimeout(() => this.startRound(), 1400);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("mh-style")) return;
    const st = document.createElement("style");
    st.id = "mh-style";
    st.textContent = MH_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function MH_CSS(theme: string): string {
  return `
.mh-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.mh-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;}
.mh-stage{position:relative;display:flex;justify-content:center;align-items:flex-end;gap:14px;width:100%;min-height:200px;padding:30px 10px;background:radial-gradient(ellipse at 50% 30%,rgba(165,94,234,.12),transparent 70%),rgba(255,255,255,.55);border-radius:24px;box-shadow:var(--shadow);}
.mh-hat{position:relative;font-size:3.4rem;line-height:1;background:transparent;border:none;cursor:pointer;order:0;transition:transform .45s cubic-bezier(.5,1.6,.5,1);transform-origin:50% 100%;filter:drop-shadow(0 6px 6px rgba(0,0,0,.25));}
.mh-hat:active{transform:scale(.92);}
.mh-hat--up{transform:translateY(-50px) scale(1.05);}
.mh-hat--wrong{filter:drop-shadow(0 6px 6px rgba(0,0,0,.25)) hue-rotate(-40deg);opacity:.55;}
.mh-ball{position:absolute;width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,${theme});box-shadow:inset 0 -3px 5px rgba(0,0,0,.25),0 2px 4px rgba(0,0,0,.3);transform:translate(-50%,-50%) scale(0);opacity:0;transition:transform .3s ease,opacity .3s ease;pointer-events:none;z-index:1;}
.mh-ball--show{transform:translate(-50%,-50%) scale(1);opacity:1;}
@media (max-width:380px){.mh-hat{font-size:2.7rem;}.mh-stage{gap:8px;}}
`;
}

export function create(): MagicHatGame {
  return new MagicHatGame();
}
