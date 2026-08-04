/* 水果凑数 Fruit Basket —— 篮子里已经有几个水果，再选几个刚好凑到目标数。
   独特点：凑数（补数）认知，比单纯加法更直观；篮子里的水果随选入实时计数，
   凑齐了篮子会摇晃欢呼。难度=目标数大小。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

const FRUITS = ["🍎", "🍌", "🍇", "🍓", "🍊", "🍉", "🍑", "🥝", "🍒"];

export class FruitBasketGame extends BaseGame {
  constructor() {
    super("fruit-basket");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private target = 0;
  private current = 0;
  private fruitEmoji = "";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private maxTarget(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 7
        : 10;
  }
  private pileSize(): number {
    // 水果堆数量：确保足够凑齐，且包含若干干扰（错误按钮会直接结束本轮失败计入 wrong）
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 6
        : 7;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const maxT = this.maxTarget();
    // 目标数至少 3，已有至少 1，保证需要再补至少 1
    const target = randInt(3, maxT);
    const have = randInt(1, target - 1); // 已有 1 ~ target-1，需要补 target-have >= 1
    this.target = target;
    this.current = have;
    this.fruitEmoji = sample(FRUITS);

    const wrap = document.createElement("div");
    wrap.className = "fbk-wrap";

    const task = document.createElement("div");
    task.className = "fbk-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 凑到 <b class="fbk-target">${target}</b> 个${this.fruitEmoji}`;
    wrap.appendChild(task);

    // 篮子
    const stage = document.createElement("div");
    stage.className = "fbk-stage";
    const basket = document.createElement("div");
    basket.className = "fbk-basket";
    basket.innerHTML = `
      <div class="fbk-count" id="fbk-count">${have} / ${target}</div>
      <div class="fbk-fruitrow" id="fbk-fruitrow"></div>
      <div class="fbk-basket-emoji">🧺</div>
    `;
    stage.appendChild(basket);
    wrap.appendChild(stage);

    // 初始已有水果
    const fruitrow = basket.querySelector("#fbk-fruitrow") as HTMLElement;
    for (let i = 0; i < have; i++) {
      const f = document.createElement("span");
      f.className = "fbk-fruit";
      f.textContent = this.fruitEmoji;
      fruitrow.appendChild(f);
    }

    // 提示
    const hint = document.createElement("div");
    hint.className = "fbk-hint";
    hint.id = "fbk-hint";
    hint.textContent = `再选 ${target - have} 个就够啦`;
    wrap.appendChild(hint);

    // 水果堆：点击 +1。每个水果按钮可多次点击直到凑齐。
    const pile = document.createElement("div");
    pile.className = "fbk-pile";
    const pileN = this.pileSize();
    // 让按钮数量适中，全部点击都是「+1」（避免无解）
    for (let i = 0; i < pileN; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fbk-pick";
      b.textContent = sample(FRUITS);
      // 用正确的水果图案作为视觉一致性（点击任意都计入同种计数）
      b.addEventListener("click", () => this.pick(b, basket, hint));
      pile.appendChild(b);
    }
    wrap.appendChild(pile);

    // 重置按钮
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "fbk-reset";
    reset.textContent = "↺ 重来";
    reset.addEventListener("click", () => this.startRound());
    wrap.appendChild(reset);

    this.root.appendChild(wrap);
  }

  private pick(
    btn: HTMLButtonElement,
    basket: HTMLElement,
    hint: HTMLElement,
  ): void {
    if (this.current >= this.target) return;
    this.current += 1;
    sfxPop();

    const fruitrow = basket.querySelector(
      "#fbk-fruitrow",
    ) as HTMLElement | null;
    if (fruitrow) {
      const f = document.createElement("span");
      f.className = "fbk-fruit fbk-fruit--pop";
      f.textContent = this.fruitEmoji;
      fruitrow.appendChild(f);
    }
    const count = basket.querySelector("#fbk-count");
    if (count) count.textContent = `${this.current} / ${this.target}`;

    btn.classList.add("fbk-pick--used");
    this.trackTimeout(() => btn.classList.remove("fbk-pick--used"), 250);

    if (this.current >= this.target) {
      basket.classList.add("fbk-basket--full");
      hint.textContent = "凑齐啦！真棒～";
      this.resetWrongStreak();
      const r = basket.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top);
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    } else {
      hint.textContent = `再选 ${this.target - this.current} 个就够啦`;
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `数一数篮子里有几个，还要凑到 ${this.target} 个～`,
      primary: { text: "继续", icon: "🧺", onClick: () => ov.destroy() },
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
    if (document.getElementById("fbk-style")) return;
    const st = document.createElement("style");
    st.id = "fbk-style";
    st.textContent = FBK_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function FBK_CSS(theme: string): string {
  return `
.fbk-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.fbk-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.fbk-target{color:${theme};font-size:1.4rem;}
.fbk-stage{display:flex;flex-direction:column;align-items:center;}
.fbk-basket{position:relative;width:240px;height:180px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;padding-bottom:18px;background:linear-gradient(180deg,#fff4,#fff0);border-radius:24px;transition:transform .2s;}
.fbk-basket--full{animation:fbk-cheer .6s ease;}
@keyframes fbk-cheer{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
.fbk-count{font-size:1.3rem;font-weight:900;color:var(--ink);}
.fbk-fruitrow{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;max-width:200px;min-height:36px;}
.fbk-fruit{font-size:1.5rem;line-height:1;}
.fbk-fruit--pop{animation:fbk-pop .3s ease;}
@keyframes fbk-pop{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
.fbk-basket-emoji{position:absolute;bottom:-10px;font-size:7rem;line-height:1;filter:drop-shadow(0 6px 8px rgba(0,0,0,.2));}
.fbk-hint{font-size:1rem;font-weight:700;color:var(--ink);opacity:.85;}
.fbk-pile{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:14px;background:rgba(255,255,255,.55);border-radius:20px;box-shadow:var(--shadow);max-width:440px;}
.fbk-pick{width:68px;height:68px;border-radius:50%;border:none;background:radial-gradient(circle at 35% 30%,#fff6,${theme});font-size:2.2rem;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:inset 0 -4px 6px rgba(0,0,0,.15),0 4px 8px rgba(0,0,0,.15);transition:transform .12s;}
.fbk-pick:active{transform:scale(.86);}
.fbk-pick--used{transform:scale(.92);}
.fbk-reset{font-size:.9rem;font-weight:700;color:var(--ink);background:rgba(255,255,255,.7);border:none;padding:6px 16px;border-radius:999px;cursor:pointer;box-shadow:var(--shadow);}
.fbk-reset:active{transform:scale(.95);}
@media (max-width:380px){.fbk-basket{width:200px;height:160px;}.fbk-basket-emoji{font-size:5.5rem;}.fbk-pick{width:58px;height:58px;font-size:1.9rem;}}
`;
}

export function create(): FruitBasketGame {
  return new FruitBasketGame();
}
