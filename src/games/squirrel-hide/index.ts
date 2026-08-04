/* 松鼠藏果 Squirrel Hide —— 几个树洞，松鼠把坚果藏在一个洞里，
   展示后洞交换位置打乱，孩子追踪坚果位置。
   独特点：树洞交换动画（DOM 位置互换 + 缓动），松鼠会跑动示意。
   玩法：盯紧坚果藏哪个洞，洞打乱后点对的洞。
   视觉：树洞（CSS 木纹）+ 松鼠 emoji + 坚果。难度 = 洞数/交换次数。
   通关 = 猜对目标轮数。前缀 sqh- 不冲突。
   保证有解：坚果位置逻辑追踪，唯一正确洞。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Hole {
  el: HTMLButtonElement;
}

export class SquirrelHideGame extends BaseGame {
  constructor() {
    super("squirrel-hide");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 逻辑位置 i 上的洞元素 */
  private slots: Hole[] = [];
  /** 坚果当前所在的逻辑位置 */
  private nutPos = 0;
  private holeN = 3;
  private busy = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM/trackTimeout 由基类清理 */
  }

  private holeCount(): number {
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
    this.holeN = this.holeCount();
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "sqh-wrap";

    const task = document.createElement("div");
    task.className = "sqh-task";
    task.innerHTML = `盯紧坚果藏在哪个树洞！<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "sqh-stage";
    stage.id = "sqh-stage";

    this.slots = [];
    for (let i = 0; i < this.holeN; i++) {
      const h = document.createElement("button");
      h.type = "button";
      h.className = "sqh-hole";
      h.setAttribute("aria-label", `树洞 ${i + 1}`);
      h.innerHTML = `<span class="sqh-hole-rim"></span><span class="sqh-hole-in"></span>`;
      const holeObj: Hole = { el: h };
      h.addEventListener("click", () => this.guessByEl(holeObj, h));
      stage.appendChild(h);
      this.slots.push(holeObj);
    }

    // 松鼠装饰
    const sq = document.createElement("div");
    sq.className = "sqh-squirrel";
    sq.textContent = "🐿️";
    stage.appendChild(sq);

    wrap.appendChild(stage);
    this.root.appendChild(wrap);

    this.nutPos = randInt(0, this.holeN - 1);

    // 阶段 1：抬起洞露出坚果
    this.trackTimeout(() => {
      const ho = this.slots[this.nutPos]!;
      ho.el.classList.add("sqh-hole--up");
      this.showNut(this.nutPos, true);
      this.trackTimeout(() => {
        ho.el.classList.remove("sqh-hole--up");
        this.showNut(this.nutPos, false);
        this.trackTimeout(() => this.doSwaps(), 500);
      }, 1400);
    }, 600);
  }

  private showNut(pos: number, show: boolean): void {
    const ho = this.slots[pos];
    if (!ho) return;
    const stage = ho.el.parentElement;
    if (!stage) return;
    let nut = stage.querySelector(
      `.sqh-nut[data-pos="${pos}"]`,
    ) as HTMLDivElement | null;
    if (show) {
      if (!nut) {
        nut = document.createElement("div");
        nut.className = "sqh-nut";
        nut.dataset.pos = String(pos);
        nut.textContent = "🌰";
        stage.appendChild(nut);
      }
      this.layoutNut(pos);
      nut.classList.add("sqh-nut--show");
    } else {
      nut?.classList.remove("sqh-nut--show");
    }
  }

  private layoutNut(pos: number): void {
    const stage = this.root.querySelector("#sqh-stage") as HTMLElement | null;
    if (!stage) return;
    const nut = stage.querySelector(
      `.sqh-nut[data-pos="${pos}"]`,
    ) as HTMLDivElement | null;
    if (!nut) return;
    const holes = stage.querySelectorAll(".sqh-hole");
    if (pos >= holes.length) return;
    const target = holes[pos]!.getBoundingClientRect();
    const stageR = stage.getBoundingClientRect();
    nut.style.left = `${target.left - stageR.left + target.width / 2}px`;
    nut.style.top = `${target.top - stageR.top + target.height / 2}px`;
  }

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
      this.applySwap(i, j);
      [this.slots[i], this.slots[j]] = [this.slots[j]!, this.slots[i]!];
      if (this.nutPos === i) this.nutPos = j;
      else if (this.nutPos === j) this.nutPos = i;
      sfxPop();
      this.trackTimeout(doOne, 480);
    };
    doOne();
  }

  private pickSwapPair(): [number, number] {
    const i = randInt(0, this.holeN - 1);
    let j: number;
    if (Math.random() < 0.7 && this.holeN > 1) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      j = i + dir;
      if (j < 0) j = i + 1;
      if (j >= this.holeN) j = i - 1;
    } else {
      do {
        j = randInt(0, this.holeN - 1);
      } while (j === i);
    }
    return [i, Math.max(0, Math.min(this.holeN - 1, j))];
  }

  private applySwap(i: number, j: number): void {
    if (i === j) return;
    const stage = this.slots[i]!.el.parentElement!;
    const elI = this.slots[i]!.el;
    const elJ = this.slots[j]!.el;
    const placeholder = document.createElement("span");
    stage.insertBefore(placeholder, elI);
    stage.insertBefore(elI, elJ);
    stage.insertBefore(elJ, placeholder);
    placeholder.remove();
  }

  private guessByEl(holeObj: Hole, btn: HTMLButtonElement): void {
    if (this.busy) return;
    this.busy = true;
    const clickedIdx = this.slots.indexOf(holeObj);
    if (clickedIdx === this.nutPos) {
      holeObj.el.classList.add("sqh-hole--up");
      this.showNut(this.nutPos, true);
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
      const correct = this.slots[this.nutPos]!;
      correct.el.classList.add("sqh-hole--up");
      this.showNut(this.nutPos, true);
      btn.classList.add("sqh-hole--wrong");
      this.onWrong();
      this.trackTimeout(() => this.startRound(), 1400);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("sqh-style")) return;
    const st = document.createElement("style");
    st.id = "sqh-style";
    st.textContent = SQH_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function SQH_CSS(_theme: string): string {
  void _theme;
  return `
.sqh-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.sqh-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.sqh-stage{position:relative;display:flex;justify-content:center;align-items:flex-end;gap:14px;width:100%;min-height:220px;padding:36px 10px 26px;background:radial-gradient(ellipse at 50% 30%,rgba(176,137,104,.22),transparent 70%),linear-gradient(180deg,#e6f3e0,#bfe0b0);border-radius:24px;box-shadow:var(--shadow);}
.sqh-hole{position:relative;width:90px;height:80px;background:transparent;border:none;cursor:pointer;transition:transform .45s cubic-bezier(.5,1.6,.5,1);transform-origin:50% 100%;filter:drop-shadow(0 6px 6px rgba(0,0,0,.2));}
.sqh-hole:active{transform:scale(.94);}
.sqh-hole--up{transform:translateY(-44px) scale(1.04);}
.sqh-hole--wrong{filter:drop-shadow(0 6px 6px rgba(0,0,0,.2)) saturate(.4);opacity:.55;}
.sqh-hole-rim{position:absolute;inset:0;display:block;background:radial-gradient(ellipse at 50% 45%,#3a2410 30%,#7a4a22 60%,#a86a32 100%);border-radius:50%;}
.sqh-hole-in{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:54px;height:42px;background:radial-gradient(ellipse at 50% 40%,#000,#2a1a08);border-radius:50%;box-shadow:inset 0 4px 6px rgba(0,0,0,.6);}
.sqh-nut{position:absolute;width:34px;height:34px;font-size:1.8rem;line-height:1;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%) scale(0);opacity:0;transition:transform .3s ease,opacity .3s ease;pointer-events:none;z-index:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));}
.sqh-nut--show{transform:translate(-50%,-50%) scale(1);opacity:1;animation:sqh-wiggle .8s ease-in-out infinite;}
@keyframes sqh-wiggle{0%,100%{transform:translate(-50%,-50%) scale(1) rotate(-8deg)}50%{transform:translate(-50%,-50%) scale(1.08) rotate(8deg)}}
.sqh-squirrel{position:absolute;top:6px;left:10px;font-size:2rem;z-index:2;animation:sqh-hop 1.8s ease-in-out infinite;pointer-events:none;}
@keyframes sqh-hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@media (max-width:380px){.sqh-hole{width:74px;height:66px;}.sqh-stage{gap:8px;}.sqh-squirrel{font-size:1.6rem;}}
`;
}

export function create(): SquirrelHideGame {
  return new SquirrelHideGame();
}
