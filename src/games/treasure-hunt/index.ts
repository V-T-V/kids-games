/* 翻牌寻宝 Treasure Hunt —— 几个贝壳盖住宝物，先展示再盖住打乱，孩子点出宝物藏在哪。
   独特点：先看清楚位置，盖住后随机交换位置打乱，考验短时记忆与追踪。
   视觉：贝壳 emoji 盖住，翻开动画揭示宝物💎。难度=杯子数/打乱次数。通关=找对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { randInt, getCssVar } from "../../lobby/util.ts";

export class TreasureHuntGame extends BaseGame {
  constructor() {
    super("treasure-hunt");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private cups: HTMLButtonElement[] = [];
  private treasureAt = 0;
  private locked = false; // 展示/打乱阶段禁止点击

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private cupCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }
  private shuffleTimes(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 5
        : 7;
  }

  private startRound(): void {
    this.locked = true;
    this.root.innerHTML = "";
    this.cups = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "trh-wrap";

    const task = document.createElement("div");
    task.className = "trh-task";
    task.id = "trh-task";
    task.textContent = "看好💎藏在哪个贝壳下面～";
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "trh-board";
    board.id = "trh-board";
    const n = this.cupCount();
    this.treasureAt = randInt(0, n - 1);
    for (let i = 0; i < n; i++) {
      const cup = document.createElement("button");
      cup.type = "button";
      cup.className = "trh-cup";
      cup.innerHTML = `<span class="trh-cup__shell">🐚</span><span class="trh-cup__gem">💎</span>`;
      cup.style.setProperty("--trh-i", String(i));
      cup.addEventListener("click", () => this.pick(i, cup));
      board.appendChild(cup);
      this.cups.push(cup);
    }
    wrap.appendChild(board);
    this.root.appendChild(wrap);

    // 流程：展示(1.2s) → 盖住 → 打乱(N 次) → 可点
    this.showTreasure();
  }

  private showTreasure(): void {
    const gem = this.cups[this.treasureAt]?.querySelector(".trh-cup__gem");
    this.cups[this.treasureAt]?.classList.add("trh-cup--reveal");
    void gem;
    this.trackTimeout(() => {
      this.cups[this.treasureAt]?.classList.remove("trh-cup--reveal");
      this.trackTimeout(() => this.shuffle(), 400);
    }, 1300);
  }

  /** 打乱：随机交换两个贝壳的位置（带动画）。 */
  private shuffle(): void {
    const task = this.root.querySelector("#trh-task");
    if (task) task.textContent = "盯紧它跑到哪里～";
    const times = this.shuffleTimes();
    let done = 0;
    const swap = (): void => {
      if (done >= times) {
        this.locked = false;
        const t2 = this.root.querySelector("#trh-task");
        if (t2) t2.textContent = "💎在哪个贝壳里？点出来！";
        return;
      }
      const n = this.cups.length;
      const a = randInt(0, n - 1);
      let b = randInt(0, n - 1);
      while (b === a) b = randInt(0, n - 1);
      this.animateSwap(a, b, () => {
        // 交换 DOM 顺序与数组
        const arr = this.cups;
        const board = this.root.querySelector("#trh-board");
        const elA = arr[a]!;
        const elB = arr[b]!;
        arr[a] = elB;
        arr[b] = elA;
        // 更新 treasureAt 索引跟踪
        if (this.treasureAt === a) this.treasureAt = b;
        else if (this.treasureAt === b) this.treasureAt = a;
        if (board) {
          board.insertBefore(elB, elA);
        }
        done += 1;
        this.trackTimeout(swap, 280);
      });
    };
    swap();
  }

  /** 两个贝壳左右对调动画。 */
  private animateSwap(a: number, b: number, cb: () => void): void {
    const elA = this.cups[a]!;
    const elB = this.cups[b]!;
    elA.classList.add("trh-cup--lift");
    elB.classList.add("trh-cup--sink");
    this.trackTimeout(() => {
      elA.classList.remove("trh-cup--lift");
      elB.classList.remove("trh-cup--sink");
      cb();
    }, 260);
  }

  private pick(i: number, cup: HTMLButtonElement): void {
    if (this.locked) return;
    this.locked = true;
    cup.classList.add("trh-cup--reveal");
    if (i === this.treasureAt) {
      sfxPop();
      this.resetWrongStreak();
      const r = cup.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      this.onWrong();
      // 揭示正确位置
      this.trackTimeout(() => {
        this.cups[this.treasureAt]?.classList.add("trh-cup--reveal");
      }, 300);
      this.trackTimeout(() => {
        // 重试本关
        this.locked = false;
        this.cups.forEach((c) => c.classList.remove("trh-cup--reveal"));
        const task = this.root.querySelector("#trh-task");
        if (task) task.textContent = "再找一次～看好💎藏在哪！";
        this.showTreasure();
      }, 1600);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("trh-style")) return;
    const st = document.createElement("style");
    st.id = "trh-style";
    st.textContent = TH_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function TH_CSS(theme: string): string {
  return `
.trh-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(460px,100%);}
.trh-task{font-size:1.2rem;font-weight:800;text-align:center;min-height:1.6em;}
.trh-board{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;padding:24px;background:linear-gradient(180deg,#fff8e1,#ffe0b2);border-radius:24px;box-shadow:var(--shadow);min-height:160px;align-items:flex-end;}
.trh-cup{position:relative;width:78px;height:90px;border:none;background:transparent;cursor:pointer;display:flex;align-items:flex-end;justify-content:center;transition:transform .26s ease;}
.trh-cup__shell{font-size:3.4rem;line-height:1;filter:drop-shadow(0 4px 4px rgba(0,0,0,.2));transition:transform .3s ease;z-index:2;}
.trh-cup__gem{position:absolute;bottom:8px;left:50%;transform:translateX(-50%) scale(0);font-size:2rem;opacity:0;transition:transform .3s ease,opacity .3s ease;z-index:1;}
.trh-cup--reveal .trh-cup__shell{transform:translateY(-40px) scale(.9);opacity:.85;}
.trh-cup--reveal .trh-cup__gem{transform:translateX(-50%) scale(1);opacity:1;animation:trh-shine .8s ease;}
.trh-cup--lift .trh-cup__shell{transform:translateY(-18px) rotate(-8deg);}
.trh-cup--sink .trh-cup__shell{transform:translateY(6px) rotate(8deg);}
.trh-cup:active .trh-cup__shell{transform:scale(.92);}
@keyframes trh-shine{0%{filter:brightness(1)}50%{filter:brightness(1.6) drop-shadow(0 0 8px ${theme})}100%{filter:brightness(1)}}
@media (max-width:380px){.trh-cup{width:64px;height:78px;}.trh-cup__shell{font-size:2.8rem;}.trh-board{gap:10px;padding:18px;}}
`;
}

export function create(): TreasureHuntGame {
  return new TreasureHuntGame();
}
