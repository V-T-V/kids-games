/* 小小钱包 Money —— 给一个价格，用硬币/纸币凑出。点 1元/5角/1角 代币累加。
   巧思：圆形硬币 + 长方形纸币样式；凑够即对，多了或少了都提示。
   内部统一用"角"为单位（1元=10角, 5角, 1角）。难度 = 金额。通关 = 答对目标题数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxTick } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Denom {
  /** 角为单位 */
  jiao: number;
  label: string;
  kind: "coin" | "note";
}

const DENOMS: Denom[] = [
  { jiao: 10, label: "1 元", kind: "note" },
  { jiao: 5, label: "5 角", kind: "coin" },
  { jiao: 1, label: "1 角", kind: "coin" },
];

export class MoneyGame extends BaseGame {
  constructor() {
    super("money");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private targetJiao = 0; // 目标金额（角）
  private currentJiao = 0; // 当前凑出（角）
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.currentJiao = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    // 难度决定目标金额范围（角）
    const [lo, hi] =
      this.difficulty === "easy"
        ? [5, 15]
        : this.difficulty === "medium"
          ? [10, 30]
          : [20, 60];
    this.targetJiao = randInt(lo, hi);

    const wrap = document.createElement("div");
    wrap.className = "mn-wrap";

    const task = document.createElement("div");
    task.className = "mn-task";
    task.textContent = `凑出 ${this.fmt(this.targetJiao)} 买到东西（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 价格牌
    const price = document.createElement("div");
    price.className = "mn-price";
    price.innerHTML = `🛒 需要 <b>${this.fmt(this.targetJiao)}</b>`;
    wrap.appendChild(price);

    // 当前钱包
    const wallet = document.createElement("div");
    wallet.className = "mn-wallet";
    const walletLabel = document.createElement("div");
    walletLabel.className = "mn-wallet-label";
    walletLabel.textContent = "已凑：";
    const walletVal = document.createElement("div");
    walletVal.className = "mn-wallet-val";
    walletVal.textContent = this.fmt(0);
    walletLabel.appendChild(walletVal);
    wallet.appendChild(walletLabel);
    wrap.appendChild(wallet);

    // 代币按钮
    const tray = document.createElement("div");
    tray.className = "mn-tray";
    DENOMS.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = d.kind === "coin" ? "mn-coin" : "mn-note";
      b.textContent = d.label;
      b.addEventListener("click", () => this.add(d, walletVal, b));
      tray.appendChild(b);
    });
    wrap.appendChild(tray);

    // 操作
    const actions = document.createElement("div");
    actions.className = "mn-actions";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "mn-btn mn-btn--ghost";
    clear.textContent = "清空";
    clear.addEventListener("click", () => {
      if (this.locked) return;
      sfxTick();
      this.currentJiao = 0;
      walletVal.textContent = this.fmt(0);
    });
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "mn-btn mn-btn--ok";
    ok.textContent = "好啦！";
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
    this.currentJiao += d.jiao;
    sfxTick();
    walletVal.textContent = this.fmt(this.currentJiao);
    btn.classList.add("mn-pulse");
    this.trackTimeout(() => btn.classList.remove("mn-pulse"), 250);
  }

  private check(walletVal: HTMLDivElement, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (this.currentJiao === this.targetJiao) {
      this.locked = true;
      sfxPop();
      btn.classList.add("mn-btn--done");
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
      const paused = this.onWrong();
      walletVal.classList.add("mn-wallet-val--wrong");
      this.trackTimeout(
        () => walletVal.classList.remove("mn-wallet-val--wrong"),
        450,
      );
      if (paused) this.showRest();
    }
  }

  /** 角 → 显示文案 */
  private fmt(jiao: number): string {
    if (jiao % 10 === 0) return `${jiao / 10} 元`;
    if (jiao < 10) return `${jiao} 角`;
    const yuan = Math.floor(jiao / 10);
    const j = jiao % 10;
    return `${yuan} 元 ${j} 角`;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "1 元 = 10 角，5 角 + 5 角 = 1 元哦～",
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
    if (document.getElementById("mn-style")) return;
    const st = document.createElement("style");
    st.id = "mn-style";
    st.textContent = MN_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function MN_CSS(theme: string): string {
  return `
.mn-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.mn-task{font-size:1.15rem;font-weight:800;text-align:center;}
.mn-price{background:#fff;border-radius:16px;padding:10px 22px;font-size:1.2rem;font-weight:700;box-shadow:var(--shadow);}
.mn-price b{color:${theme};}
.mn-wallet{background:#fff;border-radius:16px;padding:10px 22px;box-shadow:var(--shadow);min-width:200px;text-align:center;}
.mn-wallet-label{font-size:.95rem;color:var(--ink-soft);}
.mn-wallet-val{font-size:1.6rem;font-weight:800;color:var(--ink);margin-top:2px;}
.mn-wallet-val--wrong{animation:mn-shake .4s ease;color:#ff6348;}
.mn-tray{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;align-items:center;}
.mn-coin{width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe9a8,#f5b800);color:#7a5b00;font-size:1rem;font-weight:800;border:4px solid #d99a00;box-shadow:var(--shadow);transition:transform .1s ease;}
.mn-coin:active{transform:scale(.92);}
.mn-note{width:120px;height:64px;border-radius:10px;background:linear-gradient(135deg,#9fd0ff,#4d96ff);color:#fff;font-size:1rem;font-weight:800;border:3px solid #2f6dd6;box-shadow:var(--shadow);transition:transform .1s ease;}
.mn-note:active{transform:scale(.95);}
.mn-pulse{animation:mn-pop .25s ease;}
.mn-actions{display:flex;gap:14px;}
.mn-btn{min-height:54px;padding:0 26px;font-size:1.1rem;font-weight:800;border-radius:999px;box-shadow:var(--shadow);transition:transform .1s ease;}
.mn-btn:active{transform:scale(.95);}
.mn-btn--ghost{background:#fff;color:var(--ink);}
.mn-btn--ok{background:${theme};color:#fff;}
.mn-btn--done{background:#ffd93d;color:var(--ink);animation:mn-pop .4s ease;}
@keyframes mn-pop{0%{transform:scale(.8)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes mn-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): MoneyGame {
  return new MoneyGame();
}
