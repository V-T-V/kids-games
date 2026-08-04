/* 小厨房 Kitchen —— 一道菜的备菜步骤（洗→切→炒→装盘…），
   步骤卡片被打乱，孩子按正确顺序依次点击。
   独特点：顺序认知 + 烹饪流程，每点对一步锅"翻炒"一下，最后出锅装盘。
   视觉：步骤 emoji 卡片 + 锅。难度=步骤数。通关=排对目标轮数。
   巧思：上方始终展示目标顺序（带序号），孩子照着点即可（保证可解）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Dish {
  name: string;
  icon: string;
  steps: { name: string; emoji: string; color: string }[];
}

const DISHES: Dish[] = [
  {
    name: "番茄炒蛋",
    icon: "🍳",
    steps: [
      { name: "洗番茄", emoji: "🍅", color: "#ef5350" },
      { name: "打鸡蛋", emoji: "🥚", color: "#ffca28" },
      { name: "切番茄", emoji: "🔪", color: "#42a5f5" },
      { name: "下锅炒", emoji: "🍳", color: "#ff7043" },
      { name: "装盘", emoji: "🍽️", color: "#66bb6a" },
    ],
  },
  {
    name: "蔬菜沙拉",
    icon: "🥗",
    steps: [
      { name: "洗蔬菜", emoji: "🥬", color: "#66bb6a" },
      { name: "切蔬菜", emoji: "🔪", color: "#42a5f5" },
      { name: "放沙拉酱", emoji: "🧴", color: "#ffca28" },
      { name: "拌匀装盘", emoji: "🥗", color: "#8bc34a" },
    ],
  },
  {
    name: "水果拼盘",
    icon: "🍎",
    steps: [
      { name: "挑水果", emoji: "🍎", color: "#ef5350" },
      { name: "洗水果", emoji: "💧", color: "#42a5f5" },
      { name: "切水果", emoji: "🔪", color: "#ff7043" },
      { name: "摆盘", emoji: "🍓", color: "#ec407a" },
    ],
  },
  {
    name: "煮面条",
    icon: "🍜",
    steps: [
      { name: "烧水", emoji: "💧", color: "#42a5f5" },
      { name: "下面条", emoji: "🍜", color: "#ffca28" },
      { name: "加调料", emoji: "🧂", color: "#8d6e63" },
      { name: "盛碗", emoji: "🍲", color: "#ff7043" },
    ],
  },
];

export class KitchenGame extends BaseGame {
  constructor() {
    super("kitchen");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private order: { name: string; emoji: string; color: string }[] = [];
  private expected = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private stepCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.expected = 0;

    // 选一道菜，按难度取前 N 步（保证顺序固定唯一）
    const dish = shuffle([...DISHES])[0]!;
    const n = Math.min(this.stepCount(), dish.steps.length);
    this.order = dish.steps.slice(0, n);

    // 操作区打乱顺序
    const shown = shuffle([...this.order]);

    const wrap = document.createElement("div");
    wrap.className = "kt-wrap";

    const task = document.createElement("div");
    task.className = "kt-task";
    task.innerHTML = `做 <b>${dish.icon} ${dish.name}</b> · 按顺序点击步骤！<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 目标顺序展示（带序号，照着点即可，保证可解）
    const orderBar = document.createElement("div");
    orderBar.className = "kt-order";
    orderBar.id = "kt-order";
    this.order.forEach((s, i) => {
      const c = document.createElement("div");
      c.className = "kt-order__cell";
      c.dataset.idx = String(i);
      c.innerHTML = `<span class="kt-order__num">${i + 1}</span><span class="kt-order__emoji">${s.emoji}</span><span class="kt-order__name">${s.name}</span>`;
      c.style.setProperty("--kt-c", s.color);
      orderBar.appendChild(c);
    });
    wrap.appendChild(orderBar);

    // 锅（每点对一步翻炒）
    const potWrap = document.createElement("div");
    potWrap.className = "kt-pot-wrap";
    const pot = document.createElement("div");
    pot.className = "kt-pot";
    pot.id = "kt-pot";
    pot.textContent = "🍳";
    potWrap.appendChild(pot);
    wrap.appendChild(potWrap);

    // 操作区：打乱的步骤
    const stage = document.createElement("div");
    stage.className = "kt-stage";
    stage.id = "kt-stage";
    shown.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kt-step";
      b.dataset.name = s.name;
      b.style.setProperty("--kt-c", s.color);
      b.innerHTML = `<span class="kt-step__emoji">${s.emoji}</span><span class="kt-step__name">${s.name}</span>`;
      b.addEventListener("click", () => this.clickStep(s, b));
      stage.appendChild(b);
    });
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
  }

  private clickStep(
    s: { name: string; emoji: string; color: string },
    btn: HTMLButtonElement,
  ): void {
    if (btn.classList.contains("kt-step--done")) return;
    const target = this.order[this.expected];
    if (!target) return;
    if (s.name === target.name) {
      btn.classList.add("kt-step--done");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 高亮目标序号格
      const cells = this.root.querySelectorAll("#kt-order .kt-order__cell");
      const cell = cells[this.expected] as HTMLElement | undefined;
      cell?.classList.add("kt-order__cell--done");
      // 锅翻炒
      const pot = this.root.querySelector("#kt-pot") as HTMLElement | null;
      pot?.classList.remove("kt-pot--flip");
      void pot?.offsetWidth;
      pot?.classList.add("kt-pot--flip");
      this.expected += 1;
      if (this.expected >= this.order.length) {
        // 全部排对，出锅
        pot?.classList.add("kt-pot--serve");
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 900);
      }
    } else {
      this.onWrong();
      btn.classList.add("kt-step--shake");
      this.trackTimeout(() => btn.classList.remove("kt-step--shake"), 400);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("kt-style")) return;
    const st = document.createElement("style");
    st.id = "kt-style";
    st.textContent = KT_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function KT_CSS(theme: string): string {
  return `
.kt-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.kt-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.kt-task b{color:${theme};}
.kt-order{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;background:rgba(255,255,255,.65);padding:8px 12px;border-radius:16px;box-shadow:var(--shadow);}
.kt-order__cell{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 8px;border-radius:12px;background:var(--kt-c,#fff);min-width:58px;position:relative;border:2px solid rgba(0,0,0,.06);transition:transform .25s,opacity .25s;}
.kt-order__cell--done{opacity:.45;transform:scale(.9);}
.kt-order__cell--done::after{content:"✅";position:absolute;top:-8px;right:-6px;font-size:1rem;}
.kt-order__num{font-size:.75rem;font-weight:900;color:#fff;background:rgba(0,0,0,.35);border-radius:999px;padding:0 6px;line-height:1.4;}
.kt-order__emoji{font-size:1.6rem;}
.kt-order__name{font-size:.7rem;font-weight:700;color:#3a2e4a;}
.kt-pot-wrap{height:64px;display:flex;align-items:center;justify-content:center;}
.kt-pot{font-size:3rem;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));}
.kt-pot--flip{animation:kt-flip .5s ease;}
@keyframes kt-flip{0%{transform:rotate(0)}50%{transform:rotate(-20deg) scale(1.1)}100%{transform:rotate(0)}}
.kt-pot--serve{animation:kt-serve .8s ease;}
@keyframes kt-serve{0%{transform:scale(1)}50%{transform:scale(1.3) rotate(10deg)}100%{transform:scale(1) rotate(0)}}
.kt-stage{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.kt-step{display:flex;flex-direction:column;align-items:center;gap:4px;width:84px;background:#fff;border-radius:16px;box-shadow:var(--shadow);padding:10px 4px;border:3px solid var(--kt-c,#eee);cursor:pointer;transition:transform .12s,opacity .25s;}
.kt-step:active{transform:scale(.93);}
.kt-step__emoji{font-size:2.2rem;}
.kt-step__name{font-size:.8rem;font-weight:800;color:#3a2e4a;}
.kt-step--done{opacity:.3;pointer-events:none;transform:scale(.85);}
.kt-step--shake{animation:kt-shake .4s ease;}
@keyframes kt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (max-width:380px){.kt-step{width:70px;}.kt-order__cell{min-width:48px;}}
.kt-theme{color:${theme};}
`;
}

export function create(): KitchenGame {
  return new KitchenGame();
}
