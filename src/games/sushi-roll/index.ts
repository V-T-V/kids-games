/* 寿司卷 Sushi Roll —— 显示一个寿司的配料顺序（如 黄瓜→鱼→米饭→海苔），
   配料打乱，孩子按顺序点击卷起来。
   独特点：顺序记忆 + 卷制视觉（每点对一项，海苔卷向前卷一格，配料飞入卷）。
   巧思：先展示目标顺序（带序号），打乱后让孩子按序点击；点击用动画"卷入"。
   难度=配料数。通关=卷对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Ingredient {
  emoji: string;
  name: string;
  color: string;
}

const INGREDIENTS: Ingredient[] = [
  { emoji: "🥒", name: "黄瓜", color: "#6bcf7f" },
  { emoji: "🐟", name: "鱼肉", color: "#ff9f43" },
  { emoji: "🍚", name: "米饭", color: "#fff8e7" },
  { emoji: "🌿", name: "海苔", color: "#3a2e4a" },
  { emoji: "🥑", name: "牛油果", color: "#8bc34a" },
  { emoji: "🥚", name: "蛋皮", color: "#ffd93d" },
  { emoji: "🦐", name: "虾仁", color: "#ff6b9d" },
];

export class SushiRollGame extends BaseGame {
  constructor() {
    super("sushi-roll");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private order: Ingredient[] = [];
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

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.expected = 0;

    // 从配料库选 count 个，确定唯一目标顺序
    this.order = shuffle([...INGREDIENTS]).slice(0, this.count());
    // 展示顺序打乱（用于操作区）
    const shown = shuffle([...this.order]);

    const wrap = document.createElement("div");
    wrap.className = "sr2-wrap";

    const task = document.createElement("div");
    task.className = "sr2-task";
    task.innerHTML = `按顺序把配料卷进寿司卷！<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 目标顺序展示（带序号，照着点即可，保证可解）
    const orderBar = document.createElement("div");
    orderBar.className = "sr2-order";
    orderBar.id = "sr2-order";
    this.order.forEach((ing, i) => {
      const c = document.createElement("div");
      c.className = "sr2-order__cell";
      c.dataset.idx = String(i);
      c.innerHTML = `<span class="sr2-order__num">${i + 1}</span><span class="sr2-order__emoji">${ing.emoji}</span><span class="sr2-order__name">${ing.name}</span>`;
      c.style.setProperty("--sr2-c", ing.color);
      orderBar.appendChild(c);
    });
    wrap.appendChild(orderBar);

    // 卷制区（海苔卷）
    const rollWrap = document.createElement("div");
    rollWrap.className = "sr2-roll-wrap";
    const roll = document.createElement("div");
    roll.className = "sr2-roll";
    roll.id = "sr2-roll";
    roll.textContent = "🌯";
    rollWrap.appendChild(roll);
    wrap.appendChild(rollWrap);

    // 操作区：打乱的配料
    const stage = document.createElement("div");
    stage.className = "sr2-stage";
    stage.id = "sr2-stage";
    shown.forEach((ing) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sr2-ing";
      b.dataset.name = ing.name;
      b.style.setProperty("--sr2-c", ing.color);
      b.innerHTML = `<span class="sr2-ing__emoji">${ing.emoji}</span><span class="sr2-ing__name">${ing.name}</span>`;
      b.addEventListener("click", () => this.click(ing, b));
      stage.appendChild(b);
    });
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
  }

  private click(ing: Ingredient, btn: HTMLButtonElement): void {
    if (btn.classList.contains("sr2-ing--done")) return;
    const target = this.order[this.expected];
    if (!target) return;
    if (ing.name === target.name) {
      btn.classList.add("sr2-ing--done");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 高亮目标序号格
      const cells = this.root.querySelectorAll("#sr2-order .sr2-order__cell");
      const cell = cells[this.expected] as HTMLElement | undefined;
      cell?.classList.add("sr2-order__cell--done");
      // 卷动效果
      const roll = this.root.querySelector("#sr2-roll") as HTMLElement | null;
      roll?.classList.remove("sr2-roll--flip");
      void roll?.offsetWidth; // 强制 reflow 重启动画
      roll?.classList.add("sr2-roll--flip");
      this.expected += 1;
      if (this.expected >= this.order.length) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 900);
      }
    } else {
      this.onWrong();
    }
  }

  private injectStyle(): void {
    if (document.getElementById("sr2-style")) return;
    const st = document.createElement("style");
    st.id = "sr2-style";
    st.textContent = SR2_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function SR2_CSS(theme: string): string {
  return `
.sr2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.sr2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.sr2-order{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;background:rgba(255,255,255,.6);padding:8px 12px;border-radius:16px;box-shadow:var(--shadow);}
.sr2-order__cell{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 8px;border-radius:12px;background:var(--sr2-c,#fff);min-width:56px;position:relative;border:2px solid rgba(0,0,0,.06);transition:transform .25s,opacity .25s;}
.sr2-order__cell--done{opacity:.45;transform:scale(.9);}
.sr2-order__cell--done::after{content:"✅";position:absolute;top:-8px;right:-6px;font-size:1rem;}
.sr2-order__num{font-size:.75rem;font-weight:900;color:#fff;background:rgba(0,0,0,.35);border-radius:999px;padding:0 6px;line-height:1.4;}
.sr2-order__emoji{font-size:1.6rem;}
.sr2-order__name{font-size:.7rem;font-weight:700;color:#3a2e4a;}
.sr2-roll-wrap{height:64px;display:flex;align-items:center;justify-content:center;}
.sr2-roll{font-size:3rem;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));}
.sr2-roll--flip{animation:sr2-flip .5s ease;}
@keyframes sr2-flip{0%{transform:rotateX(0)}50%{transform:rotateX(180deg) scale(1.1)}100%{transform:rotateX(360deg)}}
.sr2-stage{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.sr2-ing{display:flex;flex-direction:column;align-items:center;gap:4px;width:78px;background:#fff;border-radius:16px;box-shadow:var(--shadow);padding:10px 4px;border:3px solid var(--sr2-c,#eee);cursor:pointer;transition:transform .12s,opacity .25s;}
.sr2-ing:active{transform:scale(.93);}
.sr2-ing__emoji{font-size:2.2rem;}
.sr2-ing__name{font-size:.8rem;font-weight:800;color:#3a2e4a;}
.sr2-ing--done{opacity:.3;pointer-events:none;transform:scale(.85);}
@media (max-width:380px){.sr2-ing{width:66px;}.sr2-order__cell{min-width:48px;}}
.sr2-theme{color:${theme};}
`;
}

export function create(): SushiRollGame {
  return new SushiRollGame();
}
