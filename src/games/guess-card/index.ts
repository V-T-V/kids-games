/* 猜大小 Guess Card —— 翻开一张数字牌（1-10），猜下一张更大还是更小。
   独特点：3D 翻牌动画（CSS transform rotateY）+ 连胜进度条。
   视觉：扑克牌质感（渐变 + 花色图案）、翻牌缓动、猜对金光。
   难度=数字范围（easy 1-6 / medium 1-8 / hard 1-10）。通关=连续猜对目标次数。
   相等视为重来（不计错也不计对），降低挫败。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";
import { starsByAccuracy } from "../../core/scoring.ts";

const SUITS = ["♥", "♦", "♠", "♣"] as const;

export class GuessCardGame extends BaseGame {
  constructor() {
    super("guess-card");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private streak = 0;
  private streakTarget = 0;
  private maxNum = 0;
  private current = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.streakTarget = 2;
    this.maxNum =
      this.difficulty === "easy" ? 6 : this.difficulty === "medium" ? 8 : 10;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* 无定时器/动画需手动清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    this.streak = 0;
    this.current = randInt(1, this.maxNum);

    const wrap = document.createElement("div");
    wrap.className = "gc-wrap";

    const task = document.createElement("div");
    task.className = "gc-task";
    task.innerHTML = `下一张数字会 <b>更大</b> 还是 <b>更小</b>？<br><small>（第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 连续猜对 ${this.streakTarget} 次过关）</small>`;
    wrap.appendChild(task);

    const progress = document.createElement("div");
    progress.className = "gc-progress";
    progress.innerHTML = `本关连胜：<b>${this.streak}</b> / ${this.streakTarget} · 已过 <b>${this.roundsDone}</b>/${this.roundTotal} 关`;
    wrap.appendChild(progress);

    const stage = document.createElement("div");
    stage.className = "gc-stage";

    // 当前牌（已翻开）
    const cur = this.makeCard(this.current, false);
    cur.classList.add("gc-card--cur");
    stage.appendChild(cur);

    // 下一张牌（背面）
    const next = this.makeCard(this.current, true);
    next.classList.add("gc-card--next");
    next.id = "gc-next";
    stage.appendChild(next);

    wrap.appendChild(stage);

    const btns = document.createElement("div");
    btns.className = "gc-btns";
    const big = document.createElement("button");
    big.type = "button";
    big.className = "gc-btn gc-btn--big";
    big.innerHTML = "⬆ <span>更大</span>";
    const small = document.createElement("button");
    small.type = "button";
    small.className = "gc-btn gc-btn--small";
    small.innerHTML = "⬇ <span>更小</span>";
    btns.appendChild(big);
    btns.appendChild(small);
    wrap.appendChild(btns);

    this.root.appendChild(wrap);

    const guess = (choice: "big" | "small"): void => {
      if (this.locked) return;
      this.locked = true;
      big.disabled = true;
      small.disabled = true;
      const nextVal = randInt(1, this.maxNum);
      // 翻开下一张
      const flipTimer = this.revealNext(next, nextVal);
      flipTimer.then(() => {
        // 判定
        let correct = false;
        let equal = false;
        if (nextVal === this.current) equal = true;
        else if (choice === "big") correct = nextVal > this.current;
        else correct = nextVal < this.current;

        if (equal) {
          // 相等：不算对错，重置当前为下一张继续
          sfxPop();
          this.trackTimeout(() => {
            this.current = nextVal;
            this.startRound();
          }, 800);
          return;
        }
        if (correct) {
          this.streak += 1;
          this.resetWrongStreak();
          const rect = next.getBoundingClientRect();
          this.onCorrect(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          next.classList.add("gc-card--win");
          this.trackTimeout(() => {
            if (this.streak >= this.streakTarget) {
              this.roundsDone += 1;
              if (this.roundsDone >= this.roundTotal) {
                this.finishClear(starsByAccuracy(this.wrongCount));
              } else {
                this.current = nextVal;
                this.startRound();
              }
            } else {
              this.current = nextVal;
              this.startRound();
            }
          }, 900);
        } else {
          const paused = this.onWrong();
          next.classList.add("gc-card--lose");
          if (paused) {
            this.showRest();
            return;
          }
          this.streak = 0;
          this.trackTimeout(() => {
            this.current = nextVal;
            this.startRound();
          }, 900);
        }
      });
    };
    big.addEventListener("click", () => guess("big"));
    small.addEventListener("click", () => guess("small"));
  }

  private async revealNext(card: HTMLElement, val: number): Promise<void> {
    card.classList.add("gc-card--flipping");
    // 一半时切换内容
    await new Promise<void>((res) => this.trackTimeout(res, 220));
    card.classList.remove("gc-card--back");
    card.classList.add("gc-card--front");
    const numEl = card.querySelector(".gc-card__num");
    if (numEl) numEl.textContent = String(val);
    card.dataset.val = String(val);
    const suitEl = card.querySelector(".gc-card__suit");
    if (suitEl) suitEl.textContent = SUITS[(val - 1) % SUITS.length]!;
    await new Promise<void>((res) => this.trackTimeout(res, 220));
    card.classList.remove("gc-card--flipping");
  }

  private makeCard(val: number, back: boolean): HTMLElement {
    const card = document.createElement("div");
    card.className = "gc-card" + (back ? " gc-card--back" : " gc-card--front");
    card.dataset.val = String(val);
    const suit = SUITS[(val - 1) % SUITS.length]!;
    const isRed = suit === "♥" || suit === "♦";
    card.innerHTML = `
      <div class="gc-card__inner">
        <div class="gc-card__face gc-card__face--front">
          <span class="gc-card__corner gc-card__corner--tl">${val}<br>${suit}</span>
          <span class="gc-card__num ${isRed ? "gc-card__num--red" : ""}">${val}</span>
          <span class="gc-card__suit ${isRed ? "gc-card__num--red" : ""}">${suit}</span>
          <span class="gc-card__corner gc-card__corner--br">${val}<br>${suit}</span>
        </div>
        <div class="gc-card__face gc-card__face--back">
          <span class="gc-card__backpat">✦</span>
        </div>
      </div>`;
    return card;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再看一眼数字，慢慢猜～",
      primary: {
        text: "继续",
        icon: "🎈",
        onClick: () => {
          ov.destroy();
          this.streak = 0;
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
    if (document.getElementById("gc-style")) return;
    const st = document.createElement("style");
    st.id = "gc-style";
    st.textContent = GC_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function GC_CSS(theme: string): string {
  return `
.gc-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;}
.gc-task{font-size:1.2rem;font-weight:800;text-align:center;line-height:1.5;}
.gc-task b{color:${theme};}
.gc-task small{font-weight:600;color:#888;font-size:.9rem;}
.gc-progress{font-size:1.1rem;font-weight:700;}
.gc-progress b{color:${theme};}
.gc-stage{position:relative;display:flex;gap:24px;align-items:center;}
.gc-card{width:120px;height:168px;perspective:800px;cursor:default;transition:transform .25s;}
.gc-card__inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .44s ease;}
.gc-card--flipping .gc-card__inner{transform:rotateY(180deg);}
.gc-card__face{position:absolute;inset:0;backface-visibility:hidden;border-radius:14px;box-shadow:var(--shadow-lg);display:flex;align-items:center;justify-content:center;background:#fff;}
.gc-card__face--back{background:linear-gradient(135deg,${theme},#c4452f);transform:rotateY(180deg);}
.gc-card--back .gc-card__inner{transform:rotateY(180deg);}
.gc-card__backpat{font-size:3rem;color:rgba(255,255,255,.7);text-shadow:0 2px 6px rgba(0,0,0,.2);animation:gc-spin 3s linear infinite;}
.gc-card__num{font-size:3.2rem;font-weight:900;color:#222;}
.gc-card__num--red{color:#e63946;}
.gc-card__suit{position:absolute;bottom:14px;font-size:1.8rem;}
.gc-card__corner{position:absolute;font-size:.85rem;font-weight:800;line-height:1;}
.gc-card__corner--tl{top:8px;left:10px;}
.gc-card__corner--br{bottom:8px;right:10px;transform:rotate(180deg);}
.gc-card--cur{transform:scale(.85);opacity:.7;}
.gc-card--next{outline:3px solid ${theme};outline-offset:3px;}
.gc-card--win{animation:gc-win .6s ease;}
.gc-card--lose{animation:gc-lose .5s ease;}
.gc-btns{display:flex;gap:20px;}
.gc-btn{min-width:130px;min-height:72px;font-size:1.5rem;font-weight:900;border-radius:20px;color:#fff;box-shadow:0 6px 0 var(--shadow-color,#00000033),var(--shadow);display:flex;flex-direction:column;align-items:center;gap:2px;}
.gc-btn span{font-size:1rem;font-weight:700;}
.gc-btn--big{background:linear-gradient(160deg,#6bcf7f,#3da858);box-shadow:0 6px 0 #2f8c46,var(--shadow);}
.gc-btn--small{background:linear-gradient(160deg,#4d96ff,#2f6dd6);box-shadow:0 6px 0 #1f4fa8,var(--shadow);}
.gc-btn:active{transform:translateY(3px);}
.gc-btn:disabled{opacity:.5;}
@keyframes gc-win{0%{transform:scale(1)}40%{transform:scale(1.15) rotate(-3deg);box-shadow:0 0 24px 8px #ffd93d}100%{transform:scale(1)}}
@keyframes gc-lose{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
@keyframes gc-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
`;
}

export function create(): GuessCardGame {
  return new GuessCardGame();
}
