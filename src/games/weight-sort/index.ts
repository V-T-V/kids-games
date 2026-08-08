/* 称重排序 Weight Sort —— 把动物按从轻到重排队。
   独特点：先称重（点秤看数值）再排序，引入"测量"步骤（区别于 balance 二选一）。
   巧思：可先点秤逐个称，再按从小到大点击动物。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const ANIMALS = [
  { emoji: "🐜", w: 1 },
  { emoji: "🐭", w: 2 },
  { emoji: "🐱", w: 3 },
  { emoji: "🐶", w: 4 },
  { emoji: "🐘", w: 5 },
  { emoji: "🐳", w: 6 },
];

export class WeightSortGame extends BaseGame {
  constructor() {
    super("weight-sort");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private picked: { emoji: string; w: number }[] = [];
  private expected = 1;
  private expectedIdx = 0; // 当前应点的 picked 索引（修复：不再依赖 w 值连续递增）

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
    this.picked = shuffle(ANIMALS)
      .slice(0, this.count())
      .sort((a, b) => a.w - b.w);
    // FIX: expected 按实际 picked 序列初始化（不再假设 w 值连续）
    this.expectedIdx = 0;
    this.expected = this.picked[0]?.w ?? 1;
    // 展示顺序打乱（但内部已排序）
    const shown = shuffle(this.picked);

    const wrap = document.createElement("div");
    wrap.className = "ws-wrap";
    const task = document.createElement("div");
    task.className = "ws-task";
    task.innerHTML = `按从<span style="color:var(--c-green)">轻</span>到<span style="color:var(--c-red)">重</span>点动物～<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const tip = document.createElement("div");
    tip.className = "ws-tip";
    tip.id = "ws-tip";
    tip.textContent = "可以先点动物看它多重～";
    wrap.appendChild(tip);

    const stage = document.createElement("div");
    stage.className = "ws-stage";
    shown.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ws-animal";
      b.innerHTML = `<div class="ws-emoji">${a.emoji}</div><div class="ws-weight"></div>`;
      b.addEventListener("click", () => this.click(a, b));
      stage.appendChild(b);
    });
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
  }

  private click(a: { emoji: string; w: number }, btn: HTMLButtonElement): void {
    if (btn.classList.contains("ws-animal--done")) {
      // 已完成，只显示重量（称重模式）
      return;
    }
    const weightEl = btn.querySelector(".ws-weight")!;
    if (!weightEl.textContent) {
      // 第一次点：称重，显示重量
      weightEl.textContent = `${a.w} kg`;
      sfxPop();
      const tip = this.root.querySelector("#ws-tip");
      if (tip) tip.textContent = "记住重量，从轻到重点吧～";
      return;
    }
    // 排序点击
    if (a.w === this.expected) {
      btn.classList.add("ws-animal--done");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.expectedIdx += 1;
      // FIX: 按 picked 排序序列递增，而非 expected+1（w 值可能不连续）
      this.expected = this.picked[this.expectedIdx]?.w ?? 999;
      if (this.expectedIdx >= this.picked.length) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1000);
      }
    } else {
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看哪个数字最小～",
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
    if (document.getElementById("ws-style")) return;
    const st = document.createElement("style");
    st.id = "ws-style";
    st.textContent = WS_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function WS_CSS(_theme: string): string {
  return `
.ws-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.ws-task{font-size:1.2rem;font-weight:800;text-align:center;line-height:1.5;}
.ws-tip{font-size:.95rem;color:var(--ink-soft);font-weight:600;min-height:1.4em;}
.ws-stage{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.ws-animal{width:80px;background:#fff;border-radius:16px;box-shadow:var(--shadow);padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;}
.ws-animal:active{transform:scale(.93);}
.ws-emoji{font-size:2.6rem;}
.ws-weight{font-size:.8rem;font-weight:700;color:var(--ink-soft);min-height:1em;}
.ws-animal--done{background:#d4f4dd;opacity:.5;}
`;
}

export function create(): WeightSortGame {
  return new WeightSortGame();
}
