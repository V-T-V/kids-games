/* 看标签 Price-Tag —— 商品有价标，孩子用 1元/2元/5元 钱币凑出对应金额付钱。
   独特点：凑钱付款，训练数感 + 简单加法 + 货币认知。
   视觉：商品 + 钱币按钮 + 当前已付。难度=金额上限。
   通关=付对目标轮数。点钱币累加，多了可退回。前缀 pr3- 避免冲突。
   可解性：金额必为正整数，1 元币永远存在，任何金额都能凑出。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

const COINS: { value: number; emoji: string; name: string; color: string }[] = [
  { value: 1, emoji: "🥇", name: "1 元", color: "#ffd93d" },
  { value: 2, emoji: "🥈", name: "2 元", color: "#c0c0d0" },
  { value: 5, emoji: "🥉", name: "5 元", color: "#ff9f43" },
];

const ITEMS = [
  { emoji: "🍭", name: "棒棒糖" },
  { emoji: "🎈", name: "气球" },
  { emoji: "🖍️", name: "蜡笔" },
  { emoji: "🧃", name: "果汁" },
  { emoji: "🍩", name: "甜甜圈" },
  { emoji: "🧸", name: "小熊" },
  { emoji: "📗", name: "小书" },
  { emoji: "🚗", name: "玩具车" },
];

const ENCOURAGE = ["算得真清楚！", "再加一点试试～", "真厉害！", "差一点点！"];

export class PriceTagGame extends BaseGame {
  constructor() {
    super("price-tag");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private target = 0;
  private paid = 0;
  private paidCoins: number[] = [];
  private locked = false;
  private paidEl: HTMLElement | null = null;
  private payBtn: HTMLButtonElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 金额上限：easy 6，medium 10，hard 15 */
  private maxPrice(): number {
    return this.difficulty === "easy"
      ? 6
      : this.difficulty === "medium"
        ? 10
        : 15;
  }
  private minPrice(): number {
    return this.difficulty === "easy" ? 2 : 3;
  }

  private startRound(): void {
    this.locked = false;
    this.paid = 0;
    this.paidCoins = [];
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    this.target = randInt(this.minPrice(), this.maxPrice());
    const item = sample(ITEMS);

    const wrap = document.createElement("div");
    wrap.className = "pr3-wrap";

    const task = document.createElement("div");
    task.className = "pr3-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 凑够标签上的钱，付给老板`;
    wrap.appendChild(task);

    /* 商品 + 标签 */
    const goods = document.createElement("div");
    goods.className = "pr3-goods";
    goods.innerHTML = `
      <div class="pr3-goods-emoji">${item.emoji}</div>
      <div class="pr3-goods-name">${item.name}</div>
      <div class="pr3-tag">🏷️ <b>${this.target}</b> 元</div>
    `;
    wrap.appendChild(goods);

    /* 已付显示 */
    const paidBox = document.createElement("div");
    paidBox.className = "pr3-paid";
    paidBox.innerHTML = `
      <div class="pr3-paid-label">已付：<b id="pr3-paid">0</b> / ${this.target} 元</div>
      <div class="pr3-paid-bar"><div class="pr3-paid-fill" id="pr3-fill"></div></div>
      <div class="pr3-paid-coins" id="pr3-coins"></div>
    `;
    wrap.appendChild(paidBox);

    /* 钱币 */
    const coinRow = document.createElement("div");
    coinRow.className = "pr3-coins";
    COINS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pr3-coin";
      b.style.setProperty("--pr3-color", c.color);
      b.innerHTML = `<span class="pr3-coin-emoji">${c.emoji}</span><span class="pr3-coin-name">${c.name}</span>`;
      b.addEventListener("click", () => this.addCoin(c.value));
      coinRow.appendChild(b);
    });
    wrap.appendChild(coinRow);

    /* 操作按钮 */
    const actions = document.createElement("div");
    actions.className = "pr3-actions";
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "pr3-btn pr3-btn--undo";
    undo.textContent = "↩ 退一个";
    undo.addEventListener("click", () => this.undo());
    const pay = document.createElement("button");
    pay.type = "button";
    pay.className = "pr3-btn pr3-btn--pay";
    pay.textContent = "付钱！";
    pay.addEventListener("click", () => this.check());
    actions.appendChild(undo);
    actions.appendChild(pay);
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
    this.paidEl = this.root.querySelector<HTMLElement>("#pr3-paid");
    this.payBtn = pay;
    this.renderPaid();
  }

  private addCoin(v: number): void {
    if (this.locked) return;
    this.paidCoins.push(v);
    this.paid += v;
    sfxPop();
    this.renderPaid();
  }

  private undo(): void {
    if (this.locked || this.paidCoins.length === 0) return;
    const v = this.paidCoins.pop()!;
    this.paid -= v;
    sfxPop();
    this.renderPaid();
  }

  private renderPaid(): void {
    if (this.paidEl) this.paidEl.textContent = String(this.paid);
    const fill = this.root.querySelector<HTMLElement>("#pr3-fill");
    if (fill) {
      const ratio = Math.min(1, this.paid / this.target);
      fill.style.width = `${ratio * 100}%`;
      const over = this.paid > this.target;
      fill.classList.toggle("pr3-paid-fill--over", over);
      fill.classList.toggle("pr3-paid-fill--exact", this.paid === this.target);
    }
    const coinsEl = this.root.querySelector<HTMLElement>("#pr3-coins");
    if (coinsEl) {
      coinsEl.innerHTML = "";
      this.paidCoins.forEach((v) => {
        const meta = COINS.find((c) => c.value === v)!;
        const s = document.createElement("span");
        s.className = "pr3-paid-coin";
        s.textContent = meta.emoji;
        coinsEl.appendChild(s);
      });
    }
    if (this.payBtn) {
      const ready = this.paid === this.target;
      this.payBtn.classList.toggle("pr3-btn--ready", ready);
    }
  }

  private check(): void {
    if (this.locked) return;
    if (this.paid === this.target) {
      this.locked = true;
      const r = this.payBtn!.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 950);
    } else {
      const paused = this.onWrong();
      /* 视觉提示：多了→红色，少了→黄色 */
      const fill = this.root.querySelector("#pr3-fill");
      if (fill) {
        fill.classList.add(
          this.paid > this.target
            ? "pr3-paid-fill--over"
            : "pr3-paid-fill--less",
        );
      }
      this.trackTimeout(() => {
        this.root
          .querySelectorAll(".pr3-paid-fill--over,.pr3-paid-fill--less")
          .forEach((el) => {
            el.classList.remove("pr3-paid-fill--over");
            el.classList.remove("pr3-paid-fill--less");
          });
      }, 600);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🏷️",
      variant: "rest",
      body: `已付的钱要<b>刚好等于</b>标签上的钱，不能多也不能少。 ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("pr3-style")) return;
    const st = document.createElement("style");
    st.id = "pr3-style";
    st.textContent = PR3_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function PR3_CSS(theme: string): string {
  return `
.pr3-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.pr3-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.pr3-goods{display:flex;flex-direction:column;align-items:center;gap:4px;padding:18px 28px;background:linear-gradient(180deg,rgba(255,255,255,.85),${theme}22);border:3px solid ${theme};border-radius:22px;box-shadow:var(--shadow);}
.pr3-goods-emoji{font-size:4rem;line-height:1;filter:drop-shadow(0 3px 5px rgba(0,0,0,.2));animation:pr3-bob 2.4s ease-in-out infinite;}
@keyframes pr3-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.pr3-goods-name{font-size:1rem;font-weight:700;color:#555;}
.pr3-tag{font-size:1.4rem;font-weight:900;color:#fff;background:linear-gradient(180deg,#ff9f43,#ff6348);padding:4px 18px;border-radius:999px;box-shadow:0 3px 0 rgba(0,0,0,.15);margin-top:4px;}
.pr3-tag b{font-size:1.7rem;}
.pr3-paid{width:min(360px,90vw);background:rgba(255,255,255,.6);padding:12px 16px;border-radius:18px;box-shadow:var(--shadow);}
.pr3-paid-label{font-size:1rem;font-weight:700;color:#444;text-align:center;margin-bottom:8px;}
.pr3-paid-label b{color:${theme};font-size:1.3rem;}
.pr3-paid-bar{height:14px;background:rgba(0,0,0,.1);border-radius:999px;overflow:hidden;}
.pr3-paid-fill{height:100%;width:0;background:linear-gradient(90deg,${theme},#0a9aa0);border-radius:999px;transition:width .2s,background .2s;}
.pr3-paid-fill--exact{background:linear-gradient(90deg,#6bcf7f,#2ecc71);}
.pr3-paid-fill--over,.pr3-paid-fill--less{background:linear-gradient(90deg,#ff6348,#ff9f43);animation:pr3-shake .4s ease;}
@keyframes pr3-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.pr3-paid-coins{display:flex;flex-wrap:wrap;gap:3px;justify-content:center;margin-top:8px;min-height:24px;}
.pr3-paid-coin{font-size:1.5rem;line-height:1;animation:pr3-coin-in .25s ease;}
@keyframes pr3-coin-in{0%{transform:scale(0) translateY(-10px)}100%{transform:scale(1) translateY(0)}}
.pr3-coins{display:flex;gap:14px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);}
.pr3-coin{width:88px;height:96px;border:none;border-radius:50%;background:linear-gradient(180deg,#fff,var(--pr3-color,#ffd93d)55);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.15),0 6px 10px rgba(0,0,0,.12);border:3px solid var(--pr3-color,#ffd93d);transition:transform .12s;}
.pr3-coin:active{transform:translateY(3px);}
.pr3-coin-emoji{font-size:2.4rem;line-height:1;}
.pr3-coin-name{font-size:.78rem;font-weight:900;color:#5a4500;}
.pr3-actions{display:flex;gap:14px;justify-content:center;}
.pr3-btn{border:none;border-radius:999px;padding:13px 26px;font-size:1.1rem;font-weight:900;color:#fff;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.15);}
.pr3-btn:active{transform:translateY(2px);}
.pr3-btn--undo{background:linear-gradient(180deg,#9aa6b5,#7a8696);}
.pr3-btn--pay{background:linear-gradient(180deg,#9aa6b5,#7a8696);}
.pr3-btn--ready{background:linear-gradient(180deg,${theme},#2ecc71);box-shadow:0 4px 0 #1a9a50,0 6px 12px rgba(0,0,0,.2);animation:pr3-ready 1.1s ease-in-out infinite;}
@keyframes pr3-ready{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@media (max-width:380px){.pr3-coin{width:72px;height:80px;}.pr3-coin-emoji{font-size:2rem;}.pr3-goods-emoji{font-size:3.2rem;}.pr3-tag{font-size:1.2rem;}.pr3-tag b{font-size:1.4rem;}}
`;
}

export function create(): PriceTagGame {
  return new PriceTagGame();
}
