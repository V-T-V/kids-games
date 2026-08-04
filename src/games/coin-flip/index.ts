/* 翻硬币 Coin Flip —— 先猜正面还是反面，再翻硬币验证。猜对继续，
   猜错可重试（不强制降星只计 wrong）。视觉：CSS 3D 翻转的硬币，
   正面太阳 / 反面月亮。难度=无关（仍按难度调目标轮数）。通关=猜对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";
import { starsByAccuracy } from "../../core/scoring.ts";

type Side = "heads" | "tails";

export class CoinFlipGame extends BaseGame {
  constructor() {
    super("coin-flip");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private actual: Side = "heads";

  protected mount(): void {
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
    wrap.className = "cnf-wrap";

    const task = document.createElement("div");
    task.className = "cnf-task";
    task.innerHTML = `先猜 <b>正面</b> 还是 <b>反面</b>，再翻硬币验证！<br><small>猜对 ${this.roundTotal} 次通关</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "cnf-stage";
    const coin = document.createElement("div");
    coin.className = "cnf-coin";
    coin.id = "cnf-coin";
    coin.innerHTML = `
      <div class="cnf-coin__face cnf-coin__face--heads">☀️</div>
      <div class="cnf-coin__face cnf-coin__face--tails">🌙</div>`;
    stage.appendChild(coin);
    wrap.appendChild(stage);

    const btns = document.createElement("div");
    btns.className = "cnf-btns";
    const bh = document.createElement("button");
    bh.type = "button";
    bh.className = "cnf-btn cnf-btn--heads";
    bh.innerHTML = "☀️ <span>正面</span>";
    const bt = document.createElement("button");
    bt.type = "button";
    bt.className = "cnf-btn cnf-btn--tails";
    bt.innerHTML = "🌙 <span>反面</span>";
    btns.appendChild(bh);
    btns.appendChild(bt);
    wrap.appendChild(btns);

    const tip = document.createElement("div");
    tip.className = "cnf-tip";
    tip.id = "cnf-tip";
    wrap.appendChild(tip);

    this.root.appendChild(wrap);

    const guess = (side: Side): void => {
      if (this.locked) return;
      this.locked = true;
      bh.disabled = true;
      bt.disabled = true;
      this.actual = sample<Side>(["heads", "tails"]);
      this.flip(side, coin, tip);
    };
    bh.addEventListener("click", () => guess("heads"));
    bt.addEventListener("click", () => guess("tails"));
  }

  private flip(guess: Side, coin: HTMLElement, tip: HTMLElement): void {
    sfxPop();
    // 翻若干圈后落到对应面
    coin.classList.remove("cnf-coin--flip-h", "cnf-coin--flip-t");
    // 触发重绘
    void coin.offsetWidth;
    coin.classList.add(
      this.actual === "heads" ? "cnf-coin--flip-h" : "cnf-coin--flip-t",
    );

    this.trackTimeout(() => {
      const ok = guess === this.actual;
      if (ok) {
        tip.innerHTML = `猜对啦！是 <b>${this.actual === "heads" ? "正面 ☀️" : "反面 🌙"}</b>`;
        const r = coin.getBoundingClientRect();
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
        }, 950);
      } else {
        const paused = this.onWrong();
        tip.innerHTML = `这回是 <b>${this.actual === "heads" ? "正面 ☀️" : "反面 🌙"}</b>，再试一次～`;
        if (paused) {
          this.showRest();
          return;
        }
        this.trackTimeout(() => this.startRound(), 1200);
      }
    }, 900);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "歇一歇～",
      emoji: "🪙",
      variant: "rest",
      body: "正面和反面是随机的，慢慢猜～",
      primary: { text: "继续", icon: "🪙", onClick: () => ov.destroy() },
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
    if (document.getElementById("cnf-style")) return;
    const st = document.createElement("style");
    st.id = "cnf-style";
    st.textContent = CNF_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function CNF_CSS(theme: string): string {
  return `
.cnf-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:100%;}
.cnf-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.cnf-task b{color:${theme};}
.cnf-task small{display:block;margin-top:4px;font-weight:700;color:#888;font-size:.85rem;}
.cnf-stage{perspective:900px;padding:8px;}
.cnf-coin{width:150px;height:150px;border-radius:50%;position:relative;transform-style:preserve-3d;box-shadow:var(--shadow-lg);}
.cnf-coin__face{position:absolute;inset:0;border-radius:50%;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;font-size:4.2rem;background:radial-gradient(circle at 35% 30%,#fff6cc,${theme} 70%,#c79a00);box-shadow:inset 0 -8px 12px rgba(0,0,0,.2),inset 0 6px 8px rgba(255,255,255,.7);}
.cnf-coin__face--tails{transform:rotateY(180deg);background:radial-gradient(circle at 35% 30%,#d7e3ff,#9bb4e8 70%,#5a78b0);}
.cnf-coin--flip-h{animation:cnf-fliph 1.0s cubic-bezier(.3,.7,.4,1) forwards;}
.cnf-coin--flip-t{animation:cnf-flipt 1.0s cubic-bezier(.3,.7,.4,1) forwards;}
@keyframes cnf-fliph{0%{transform:rotateY(0)}100%{transform:rotateY(1440deg)}}
@keyframes cnf-flipt{0%{transform:rotateY(0)}100%{transform:rotateY(1620deg)}}
.cnf-btns{display:flex;gap:24px;}
.cnf-btn{min-width:140px;min-height:80px;font-size:1.7rem;font-weight:900;color:#fff;border:none;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 6px 0 rgba(0,0,0,.2),var(--shadow);cursor:pointer;transition:transform .12s;}
.cnf-btn span{font-size:1.1rem;}
.cnf-btn--heads{background:linear-gradient(160deg,#ffd93d,#e0a800);box-shadow:0 6px 0 #b88600,var(--shadow);}
.cnf-btn--tails{background:linear-gradient(160deg,#7a96cf,#4f6fa5);box-shadow:0 6px 0 #36527e,var(--shadow);}
.cnf-btn:active{transform:translateY(3px);}
.cnf-btn:disabled{opacity:.55;}
.cnf-tip{font-size:1.15rem;font-weight:800;color:#444;min-height:1.6rem;text-align:center;}
.cnf-tip b{color:${theme};}
@media (max-width:380px){.cnf-coin{width:124px;height:124px;}.cnf-coin__face{font-size:3.4rem;}.cnf-btn{min-width:120px;min-height:70px;font-size:1.4rem;}}
`;
}

export function create(): CoinFlipGame {
  return new CoinFlipGame();
}
