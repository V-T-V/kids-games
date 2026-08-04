/* 超市找零 Grocery Store —— 买东西「花了 X 元，给了 Y 元，该找多少」，
   孩子从选项里选出找零数。独特点：商品 + 付的钱币可视化，
   帮助理解「付出 - 花费 = 找回」的减法含义。
   视觉：商品 + 钱币堆。难度=金额大小。通关=答对目标轮数。
   巧思：paid >= cost 保证答案非负；干扰项为常见错误（少找/多找 1~2 元）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle, sample } from "../../lobby/util.ts";

interface Goods {
  emoji: string;
  name: string;
  /** 基准价（元），按难度浮动 */
  base: number;
}

const GOODS: Goods[] = [
  { emoji: "🍎", name: "苹果", base: 2 },
  { emoji: "🥛", name: "牛奶", base: 3 },
  { emoji: "🍞", name: "面包", base: 4 },
  { emoji: "🍬", name: "糖果", base: 1 },
  { emoji: "🧃", name: "果汁", base: 5 },
  { emoji: "🍌", name: "香蕉", base: 2 },
  { emoji: "🥚", name: "鸡蛋", base: 3 },
];

const ENCOURAGE = [
  "算得真对！",
  "用给的钱减去花的钱～",
  "小小数学家！",
  "再想想！",
];

export class GroceryStoreGame extends BaseGame {
  constructor() {
    super("grocery-store");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answer = 0;
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

  /** 难度 → 价格区间 [cost, paid 的最大值] */
  private priceRange(): { costMax: number; paidMax: number } {
    if (this.difficulty === "easy") return { costMax: 4, paidMax: 6 };
    if (this.difficulty === "medium") return { costMax: 7, paidMax: 10 };
    return { costMax: 9, paidMax: 15 };
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    const { costMax, paidMax } = this.priceRange();
    const goods = sample(GOODS);
    const cost = randInt(1, costMax);
    /* paid 必须 >= cost；保证有解且有余钱 */
    let paid = randInt(cost, paidMax);
    if (paid === cost) paid = Math.min(paidMax, cost + 1);
    const change = paid - cost;
    this.answer = change;

    /* 选项：正确 + 3 个邻近干扰（>=0，去重） */
    const opts = new Set<number>([change]);
    let guard = 0;
    while (opts.size < 4 && guard < 50) {
      guard += 1;
      const delta = sample([-2, -1, 1, 2, 3]);
      const v = change + delta;
      if (v >= 0 && v <= paidMax) opts.add(v);
    }
    let fill = 0;
    while (opts.size < 4) {
      if (!opts.has(fill)) opts.add(fill);
      fill += 1;
    }

    const wrap = document.createElement("div");
    wrap.className = "gs-wrap";

    const task = document.createElement("div");
    task.className = "gs-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 该找多少钱？`;
    wrap.appendChild(task);

    /* 商品 + 钱币场景 */
    const scene = document.createElement("div");
    scene.className = "gs-scene";
    scene.innerHTML = `
      <div class="gs-goods">
        <div class="gs-goods-emoji">${goods.emoji}</div>
        <div class="gs-goods-name">${goods.name} <b>${cost}</b> 元</div>
      </div>
      <div class="gs-pay">
        <div class="gs-pay-label">给了</div>
        ${this.coins(paid)}
        <div class="gs-pay-name">共 <b>${paid}</b> 元</div>
      </div>
    `;
    wrap.appendChild(scene);

    const q = document.createElement("div");
    q.className = "gs-question";
    q.innerHTML = `${paid} − ${cost} = <span class="gs-q-mark">？</span> 元`;
    wrap.appendChild(q);

    /* 选项 */
    const optsEl = document.createElement("div");
    optsEl.className = "gs-options";
    shuffle([...opts]).forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gs-option";
      b.innerHTML = `<span class="gs-option-coin">🪙</span><b>${v}</b> 元`;
      b.addEventListener("click", () => this.choose(b, v));
      optsEl.appendChild(b);
    });
    wrap.appendChild(optsEl);

    this.root.appendChild(wrap);
  }

  /** 渲染若干枚钱币 emoji */
  private coins(n: number): string {
    let s = '<div class="gs-coins">';
    for (let i = 0; i < n; i++) {
      s += `<span class="gs-coin" style="--gs-d:${(i % 5) * 60}ms">🪙</span>`;
    }
    s += "</div>";
    return s;
  }

  private choose(btn: HTMLButtonElement, value: number): void {
    if (this.locked) return;
    if (value === this.answer) {
      this.locked = true;
      btn.classList.add("gs-option--right");
      /* 把问号换成答案 */
      const mark = this.root.querySelector(".gs-q-mark");
      if (mark) mark.textContent = String(value);
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("gs-option--wrong");
      this.trackTimeout(() => btn.classList.remove("gs-option--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🛒",
      variant: "rest",
      body: `用「给的钱」减去「花的钱」，就是该找回的钱。${sample(ENCOURAGE)}`,
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
    if (document.getElementById("gs-style")) return;
    const st = document.createElement("style");
    st.id = "gs-style";
    st.textContent = GS_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function GS_CSS(theme: string): string {
  return `
.gs-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.gs-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.gs-scene{display:flex;align-items:center;justify-content:center;gap:24px;padding:18px;background:linear-gradient(135deg,#fff7e6,#ffe9c4);border-radius:22px;box-shadow:var(--shadow);width:min(440px,92vw);flex-wrap:wrap;}
.gs-goods{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 16px;background:#fff;border-radius:18px;box-shadow:0 3px 8px rgba(0,0,0,.1);}
.gs-goods-emoji{font-size:3.4rem;line-height:1;}
.gs-goods-name{font-size:.95rem;font-weight:700;color:#555;}
.gs-goods-name b{color:${theme};font-size:1.3rem;}
.gs-pay{display:flex;flex-direction:column;align-items:center;gap:4px;}
.gs-pay-label{font-size:.85rem;color:#8a6d3b;font-weight:700;}
.gs-pay-name{font-size:.95rem;font-weight:700;color:#555;}
.gs-pay-name b{color:${theme};font-size:1.3rem;}
.gs-coins{display:flex;flex-wrap:wrap;gap:2px;max-width:120px;justify-content:center;}
.gs-coin{font-size:1.5rem;line-height:1;animation:gs-jingle 1.6s ease-in-out infinite;animation-delay:var(--gs-d,0ms);}
@keyframes gs-jingle{0%,100%{transform:translateY(0) rotate(-3deg);}50%{transform:translateY(-2px) rotate(3deg);}}
.gs-question{font-size:1.5rem;font-weight:900;color:#333;background:#fff;padding:8px 24px;border-radius:999px;box-shadow:var(--shadow);}
.gs-q-mark{display:inline-block;min-width:1.4em;color:${theme};}
.gs-options{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:440px;}
.gs-option{min-width:84px;height:70px;border:none;border-radius:16px;background:linear-gradient(180deg,#fff,${theme}33);font-size:1.3rem;font-weight:900;color:#333;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.12);transition:transform .1s;}
.gs-option-coin{font-size:1.4rem;}
.gs-option b{color:${theme};font-size:1.6rem;}
.gs-option:active{transform:translateY(3px);}
.gs-option--right{background:linear-gradient(180deg,#bff0c1,#6bcf7f);}
.gs-option--right b{color:#1d6b2c;animation:gs-bounce .5s ease;}
.gs-option--wrong{background:linear-gradient(180deg,#ffd0c4,#ff8a72);animation:gs-shake .5s ease;}
@keyframes gs-bounce{0%,100%{transform:scale(1)}40%{transform:scale(1.2)}}
@keyframes gs-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.gs-goods-emoji{font-size:2.6rem;}.gs-scene{gap:14px;}.gs-option{min-width:70px;height:60px;font-size:1.1rem;}.gs-option b{font-size:1.3rem;}}
`;
}

export function create(): GroceryStoreGame {
  return new GroceryStoreGame();
}
