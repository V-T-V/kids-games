/* 比大小 Card Deal —— 翻开两张数字牌（各 1-10），孩子选「哪张更大」。
   视觉：扑克牌质感（渐变 + 花色图案 + 翻牌缓动）。难度=数字范围。
   通关=答对目标轮数。两张相同时重发，保证有解。 */

import { BaseGame } from "../../core/engine.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";
import { starsByAccuracy } from "../../core/scoring.ts";

const SUITS = ["♥", "♦", "♠", "♣"] as const;

export class CardDealGame extends BaseGame {
  constructor() {
    super("card-deal");
  }

  private maxNum = 6;
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private left = 0;
  private right = 0;

  protected mount(): void {
    this.maxNum =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 8 : 10;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* 无定时器/动画需手动清理 */
  }

  private dealPair(): [number, number] {
    // 保证两张不同 → 必有「更大」
    const a = randInt(1, this.maxNum);
    let b = randInt(1, this.maxNum);
    let guard = 0;
    while (a === b && guard < 20) {
      b = randInt(1, this.maxNum);
      guard += 1;
    }
    if (a === b) b = a === this.maxNum ? a - 1 : a + 1;
    return [a, b];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    [this.left, this.right] = this.dealPair();

    const wrap = document.createElement("div");
    wrap.className = "crd-wrap";

    const task = document.createElement("div");
    task.className = "crd-task";
    task.innerHTML = `翻开两张牌，点 <b>数字更大</b> 的那张！<br><small>答对 ${this.roundTotal} 次通关</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "crd-stage";
    const cardL = this.makeCard(this.left, "L");
    const cardR = this.makeCard(this.right, "R");
    stage.appendChild(cardL);
    stage.appendChild(cardR);
    wrap.appendChild(stage);

    this.root.appendChild(wrap);

    // 翻牌动画（背→正）
    this.flip(cardL);
    this.trackTimeout(() => this.flip(cardR), 220);

    // 翻完之后启用点击
    this.trackTimeout(() => {
      cardL.classList.add("crd-card--pickable");
      cardR.classList.add("crd-card--pickable");
      cardL.addEventListener("click", () => this.onPick(cardL, "L"));
      cardR.addEventListener("click", () => this.onPick(cardR, "R"));
    }, 900);
  }

  private flip(card: HTMLElement): void {
    card.classList.add("crd-card--flipping");
    this.trackTimeout(() => {
      card.classList.remove("crd-card--back");
      card.classList.add("crd-card--front");
    }, 220);
    this.trackTimeout(() => card.classList.remove("crd-card--flipping"), 460);
  }

  private makeCard(val: number, side: "L" | "R"): HTMLElement {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "crd-card crd-card--back";
    card.dataset.side = side;
    card.dataset.val = String(val);
    const suit = SUITS[(val - 1) % SUITS.length]!;
    const isRed = suit === "♥" || suit === "♦";
    card.innerHTML = `
      <div class="crd-card__inner">
        <div class="crd-card__face crd-card__face--front">
          <span class="crd-card__corner crd-card__corner--tl">${val}<br>${suit}</span>
          <span class="crd-card__num ${isRed ? "crd-card__num--red" : ""}">${val}</span>
          <span class="crd-card__suit ${isRed ? "crd-card__num--red" : ""}">${suit}</span>
          <span class="crd-card__corner crd-card__corner--br">${val}<br>${suit}</span>
        </div>
        <div class="crd-card__face crd-card__face--back"><span class="crd-card__backpat">✦</span></div>
      </div>`;
    return card;
  }

  private onPick(card: HTMLElement, side: "L" | "R"): void {
    if (this.locked) return;
    this.locked = true;
    const picked = side === "L" ? this.left : this.right;
    const other = side === "L" ? this.right : this.left;
    const all = this.root.querySelectorAll<HTMLButtonElement>(".crd-card");
    all.forEach((b) => (b.disabled = true));

    if (picked > other) {
      card.classList.add("crd-card--win");
      const r = card.getBoundingClientRect();
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
      }, 900);
    } else {
      const paused = this.onWrong();
      card.classList.add("crd-card--lose");
      // 高亮正确那张
      const rightSide = side === "L" ? "R" : "L";
      const rightCard = this.root.querySelector<HTMLElement>(
        `.crd-card[data-side="${rightSide}"]`,
      );
      if (rightCard) rightCard.classList.add("crd-card--win");
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
      emoji: "🃏",
      variant: "rest",
      body: "比一比两个数字，<b>数字大</b>的那张牌就是答案～",
      primary: { text: "继续", icon: "🃏", onClick: () => ov.destroy() },
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
    if (document.getElementById("crd-style")) return;
    const st = document.createElement("style");
    st.id = "crd-style";
    st.textContent = CRD_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function CRD_CSS(theme: string): string {
  return `
.crd-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:100%;}
.crd-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.crd-task b{color:${theme};}
.crd-task small{display:block;margin-top:4px;font-weight:700;color:#888;font-size:.85rem;}
.crd-stage{display:flex;gap:28px;align-items:center;}
.crd-card{width:130px;height:182px;padding:0;border:none;perspective:800px;cursor:default;background:transparent;transition:transform .2s;}
.crd-card__inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .44s ease;}
.crd-card--flipping .crd-card__inner{transform:rotateY(180deg);}
.crd-card__face{position:absolute;inset:0;backface-visibility:hidden;border-radius:16px;box-shadow:var(--shadow-lg);display:flex;align-items:center;justify-content:center;background:#fff;}
.crd-card__face--back{background:linear-gradient(135deg,${theme},#a52828);transform:rotateY(180deg);}
.crd-card--back .crd-card__inner{transform:rotateY(180deg);}
.crd-card__backpat{font-size:3.2rem;color:rgba(255,255,255,.75);animation:crd-spin 3s linear infinite;}
.crd-card__num{font-size:3.4rem;font-weight:900;color:#222;}
.crd-card__num--red{color:#e63946;}
.crd-card__suit{position:absolute;bottom:14px;font-size:1.9rem;}
.crd-card__corner{position:absolute;font-size:.85rem;font-weight:800;line-height:1;}
.crd-card__corner--tl{top:8px;left:10px;}
.crd-card__corner--br{bottom:8px;right:10px;transform:rotate(180deg);}
.crd-card--pickable{cursor:pointer;}
.crd-card--pickable:hover{transform:translateY(-4px);}
.crd-card--win{animation:crd-win .6s ease;outline:4px solid #6bcf7f;outline-offset:3px;border-radius:16px;}
.crd-card--lose{animation:crd-lose .5s ease;outline:4px solid #ff6b6b;outline-offset:3px;border-radius:16px;}
@keyframes crd-win{0%{transform:scale(1)}40%{transform:scale(1.12);filter:drop-shadow(0 0 12px #ffd93d)}100%{transform:scale(1)}}
@keyframes crd-lose{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
@keyframes crd-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@media (max-width:380px){.crd-card{width:108px;height:152px;}.crd-card__num{font-size:2.7rem;}.crd-stage{gap:18px;}}
`;
}

export function create(): CardDealGame {
  return new CardDealGame();
}
