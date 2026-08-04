/* 贝壳猜珠 Shell Game —— 3-5 个贝壳，一个珠子藏在其中一个下，
   先展示珠子位置，然后贝壳快速交换位置打乱，孩子追踪珠子在哪。
   独特点：视觉追踪 + 记忆（与 magic-hat 同类，但用贝壳 + 珍珠主题）。
   视觉：🐚 贝壳 + 闪亮珍珠。难度=贝壳数/交换次数。
   通关=猜对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Shell {
  el: HTMLElement;
}

export class ShellGameGame extends BaseGame {
  constructor() {
    super("shell-game");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 逻辑位置 i 上的贝壳元素（珠子位置用 pearlPos 索引） */
  private slots: Shell[] = [];
  /** 珠子当前所在的逻辑位置 */
  private pearlPos = 0;
  private shellN = 3;
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

  private shellCount(): number {
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
    this.shellN = this.shellCount();
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "sg2-wrap";

    const task = document.createElement("div");
    task.className = "sg2-task";
    task.innerHTML = `盯紧珍珠藏在哪个贝壳下！<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "sg2-stage";
    stage.id = "sg2-stage";

    this.slots = [];
    for (let i = 0; i < this.shellN; i++) {
      const h = document.createElement("button");
      h.type = "button";
      h.className = "sg2-shell";
      h.setAttribute("aria-label", `贝壳 ${i + 1}`);
      h.innerHTML = `<span class="sg2-shell__emoji">🐚</span>`;
      const shellObj: Shell = { el: h };
      h.addEventListener("click", () => this.guessByEl(shellObj, h));
      stage.appendChild(h);
      this.slots.push(shellObj);
    }
    wrap.appendChild(stage);
    this.root.appendChild(wrap);

    this.pearlPos = randInt(0, this.shellN - 1);

    /* 阶段 1：抬起贝壳露出珍珠 */
    this.trackTimeout(() => {
      const sh = this.slots[this.pearlPos]!;
      sh.el.classList.add("sg2-shell--up");
      this.showPearl(this.pearlPos, true);
      this.trackTimeout(() => {
        sh.el.classList.remove("sg2-shell--up");
        this.showPearl(this.pearlPos, false);
        this.trackTimeout(() => this.doSwaps(), 500);
      }, 1400);
    }, 600);
  }

  private showPearl(pos: number, show: boolean): void {
    const sh = this.slots[pos];
    if (!sh) return;
    const stage = sh.el.parentElement;
    if (!stage) return;
    let pearl = stage.querySelector(
      `.sg2-pearl[data-pos="${pos}"]`,
    ) as HTMLDivElement | null;
    if (show) {
      if (!pearl) {
        pearl = document.createElement("div");
        pearl.className = "sg2-pearl";
        pearl.dataset.pos = String(pos);
        stage.appendChild(pearl);
      }
      this.layoutPearl(pos);
      pearl.classList.add("sg2-pearl--show");
    } else {
      pearl?.classList.remove("sg2-pearl--show");
    }
  }

  private layoutPearl(pos: number): void {
    const stage = this.root.querySelector("#sg2-stage") as HTMLElement | null;
    if (!stage) return;
    const pearl = stage.querySelector(
      `.sg2-pearl[data-pos="${pos}"]`,
    ) as HTMLDivElement | null;
    if (!pearl) return;
    const shells = stage.querySelectorAll(".sg2-shell");
    if (pos >= shells.length) return;
    const target = shells[pos]!.getBoundingClientRect();
    const stageR = stage.getBoundingClientRect();
    pearl.style.left = `${target.left - stageR.left + target.width / 2}px`;
    pearl.style.top = `${target.top - stageR.top + target.height - 20}px`;
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
      if (this.pearlPos === i) this.pearlPos = j;
      else if (this.pearlPos === j) this.pearlPos = i;
      sfxPop();
      this.trackTimeout(doOne, 480);
    };
    doOne();
  }

  private pickSwapPair(): [number, number] {
    const i = randInt(0, this.shellN - 1);
    let j: number;
    if (Math.random() < 0.7 && this.shellN > 1) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      j = i + dir;
      if (j < 0) j = i + 1;
      if (j >= this.shellN) j = i - 1;
    } else {
      do {
        j = randInt(0, this.shellN - 1);
      } while (j === i);
    }
    return [i, Math.max(0, Math.min(this.shellN - 1, j))];
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

  private guessByEl(shellObj: Shell, btn: HTMLButtonElement): void {
    if (this.busy) return;
    this.busy = true;
    const clickedIdx = this.slots.indexOf(shellObj);
    if (clickedIdx === this.pearlPos) {
      shellObj.el.classList.add("sg2-shell--up");
      this.showPearl(this.pearlPos, true);
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
      const correct = this.slots[this.pearlPos]!;
      correct.el.classList.add("sg2-shell--up");
      this.showPearl(this.pearlPos, true);
      btn.classList.add("sg2-shell--wrong");
      this.onWrong();
      this.trackTimeout(() => this.startRound(), 1400);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("sg2-style")) return;
    const st = document.createElement("style");
    st.id = "sg2-style";
    st.textContent = SG2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function SG2_CSS(theme: string): string {
  return `
.sg2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.sg2-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;}
.sg2-stage{position:relative;display:flex;justify-content:center;align-items:flex-end;gap:14px;width:100%;min-height:200px;padding:30px 10px;background:radial-gradient(ellipse at 50% 30%,rgba(255,159,67,.18),transparent 70%),linear-gradient(180deg,#ffe7c2,#ffd5a8);border-radius:24px;box-shadow:var(--shadow);}
.sg2-shell{position:relative;font-size:0;background:transparent;border:none;cursor:pointer;transition:transform .45s cubic-bezier(.5,1.6,.5,1);transform-origin:50% 100%;filter:drop-shadow(0 6px 6px rgba(0,0,0,.25));}
.sg2-shell__emoji{font-size:3.6rem;line-height:1;display:block;}
.sg2-shell:active{transform:scale(.92);}
.sg2-shell--up{transform:translateY(-50px) scale(1.05);}
.sg2-shell--wrong{filter:drop-shadow(0 6px 6px rgba(0,0,0,.25)) hue-rotate(-30deg);opacity:.55;}
.sg2-pearl{position:absolute;width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,${theme} 60%,#c97a2a);box-shadow:inset 0 -3px 5px rgba(0,0,0,.3),0 2px 6px rgba(0,0,0,.3);transform:translate(-50%,-50%) scale(0);opacity:0;transition:transform .3s ease,opacity .3s ease;pointer-events:none;z-index:1;}
.sg2-pearl--show{transform:translate(-50%,-50%) scale(1);opacity:1;}
@media (max-width:380px){.sg2-shell__emoji{font-size:2.9rem;}.sg2-stage{gap:8px;}}
`;
}

export function create(): ShellGameGame {
  return new ShellGameGame();
}
