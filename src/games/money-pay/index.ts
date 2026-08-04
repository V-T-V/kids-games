/* 付钱练习 Money Pay —— 商品有标价（如 3 元），孩子用硬币组合付够
   （点 1 元 / 2 元 / 5 元硬币累加）。当前总额等于标价时通关，多了视为错。
   比 money 更聚焦"用硬币组合付钱"。数学启蒙：货币组合凑数。前缀 mp-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxTick } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Denom {
  /** 元为单位 */
  yuan: number;
  label: string;
}

const DENOMS: Denom[] = [
  { yuan: 1, label: "1 元" },
  { yuan: 2, label: "2 元" },
  { yuan: 5, label: "5 元" },
];

interface Goods {
  emoji: string;
  name: string;
}

const GOODS: Goods[] = [
  { emoji: "🍭", name: "棒棒糖" },
  { emoji: "🧃", name: "果汁" },
  { emoji: "🍎", name: "苹果" },
  { emoji: "🍞", name: "面包" },
  { emoji: "🥕", name: "胡萝卜" },
  { emoji: "🎈", name: "气球" },
  { emoji: "📕", name: "小绘本" },
  { emoji: "🧸", name: "小熊" },
  { emoji: "🖍️", name: "蜡笔" },
  { emoji: "🍪", name: "饼干" },
];

export class MoneyPayGame extends BaseGame {
  constructor() {
    super("money-pay");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private targetYuan = 0;
  private currentYuan = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.currentYuan = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    // 难度决定价格范围（元）；保证可用硬币组合凑出（1/2/5 可凑任意正整数）
    const [lo, hi] =
      this.difficulty === "easy"
        ? [2, 5]
        : this.difficulty === "medium"
          ? [3, 8]
          : [5, 12];
    this.targetYuan = randInt(lo, hi);
    const goods = GOODS[randInt(0, GOODS.length - 1)]!;

    const wrap = document.createElement("div");
    wrap.className = "mp-wrap";

    const task = document.createElement("div");
    task.className = "mp-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 点硬币<b>付够钱</b>买${goods.name}`;
    wrap.appendChild(task);

    // 商品价签
    const tag = document.createElement("div");
    tag.className = "mp-tag";
    tag.innerHTML = `<div class="mp-tag__emoji">${goods.emoji}</div><div class="mp-tag__info"><div class="mp-tag__name">${goods.name}</div><div class="mp-tag__price">${this.targetYuan} 元</div></div>`;
    wrap.appendChild(tag);

    // 已付展示区
    const wallet = document.createElement("div");
    wallet.className = "mp-wallet";
    const walletLabel = document.createElement("div");
    walletLabel.className = "mp-wallet-label";
    walletLabel.textContent = "已经付了：";
    const walletVal = document.createElement("div");
    walletVal.className = "mp-wallet-val";
    walletVal.textContent = "0 元";
    walletLabel.appendChild(walletVal);
    wallet.appendChild(walletLabel);
    wrap.appendChild(wallet);

    // 硬币按钮
    const tray = document.createElement("div");
    tray.className = "mp-tray";
    DENOMS.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mp-coin";
      b.innerHTML = `<div class="mp-coin__num">${d.yuan}</div><div class="mp-coin__unit">元</div>`;
      b.addEventListener("click", () => this.add(d, walletVal, b));
      tray.appendChild(b);
    });
    wrap.appendChild(tray);

    // 操作
    const actions = document.createElement("div");
    actions.className = "mp-actions";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "mp-btn mp-btn--ghost";
    clear.textContent = "退回去";
    clear.addEventListener("click", () => {
      if (this.locked) return;
      sfxTick();
      this.currentYuan = 0;
      walletVal.textContent = "0 元";
    });
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "mp-btn mp-btn--ok";
    ok.textContent = "付好啦！";
    ok.addEventListener("click", () => this.check(walletVal, ok));
    actions.appendChild(clear);
    actions.appendChild(ok);
    wrap.appendChild(actions);

    this.root.appendChild(wrap);
  }

  private add(
    d: Denom,
    walletVal: HTMLDivElement,
    btn: HTMLButtonElement,
  ): void {
    if (this.locked) return;
    this.currentYuan += d.yuan;
    sfxTick();
    walletVal.textContent = `${this.currentYuan} 元`;
    btn.classList.add("mp-pulse");
    this.trackTimeout(() => btn.classList.remove("mp-pulse"), 250);
  }

  private check(walletVal: HTMLDivElement, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (this.currentYuan === this.targetYuan) {
      // 正好付够
      this.locked = true;
      sfxPop();
      btn.classList.add("mp-btn--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      // 多付或没付够
      const paused = this.onWrong();
      walletVal.classList.add("mp-wallet-val--wrong");
      this.trackTimeout(
        () => walletVal.classList.remove("mp-wallet-val--wrong"),
        450,
      );
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "💰",
      variant: "rest",
      body: "要付的钱正好等于价签上的钱才行哦～多付了就点「退回去」重新付。",
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
    if (document.getElementById("mp-style")) return;
    const st = document.createElement("style");
    st.id = "mp-style";
    st.textContent = MP_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function MP_CSS(theme: string): string {
  return `
.mp-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.mp-task{font-size:1.1rem;font-weight:800;text-align:center;}
.mp-task b{color:${theme};}
.mp-tag{display:flex;align-items:center;gap:16px;background:#fff;border-radius:20px;padding:14px 24px;box-shadow:var(--shadow);min-width:240px;}
.mp-tag__emoji{font-size:2.8rem;line-height:1;}
.mp-tag__info{display:flex;flex-direction:column;gap:2px;}
.mp-tag__name{font-size:1.1rem;font-weight:800;color:#444;}
.mp-tag__price{font-size:1.6rem;font-weight:900;color:${theme};}
.mp-wallet{background:#fff;border-radius:16px;padding:10px 24px;box-shadow:var(--shadow);min-width:200px;text-align:center;}
.mp-wallet-label{font-size:.95rem;color:var(--ink-soft);}
.mp-wallet-val{font-size:1.7rem;font-weight:900;color:var(--ink);margin-top:2px;}
.mp-wallet-val--wrong{animation:mp-shake .4s ease;color:#ff6348;}
.mp-tray{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;align-items:center;}
.mp-coin{width:84px;height:84px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe9a8,#f5b800);color:#7a5b00;border:4px solid #d99a00;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;transition:transform .1s ease;cursor:pointer;}
.mp-coin:active{transform:scale(.92);}
.mp-coin__num{font-size:1.7rem;font-weight:900;line-height:1;}
.mp-coin__unit{font-size:.85rem;font-weight:800;}
.mp-pulse{animation:mp-pop .25s ease;}
.mp-actions{display:flex;gap:14px;}
.mp-btn{min-height:54px;padding:0 26px;font-size:1.1rem;font-weight:800;border-radius:999px;box-shadow:var(--shadow);transition:transform .1s ease;}
.mp-btn:active{transform:scale(.95);}
.mp-btn--ghost{background:#fff;color:var(--ink);}
.mp-btn--ok{background:${theme};color:#fff;}
.mp-btn--done{background:#ffd93d;color:var(--ink);animation:mp-pop .4s ease;}
@keyframes mp-pop{0%{transform:scale(.8)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes mp-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): MoneyPayGame {
  return new MoneyPayGame();
}
