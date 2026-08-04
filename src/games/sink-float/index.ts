/* 沉浮实验 Sink Float —— 给一个物品，问「放进水里会沉下去还是浮起来？」
   孩子选 ⬇️沉 或 ⬆️浮，再放入水中用 CSS 动画展示结果。
   难度=轮数（4/6/8）+ 干扰项相似度。12+ 种物品，3-5 岁友好。
   巧思：先选答案再放入水中，正确则物品停在应处的位置（沉到底/浮在水面），
         错误则物品先按孩子选的方向走再「纠正」回真实位置，强化因果认知。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Item {
  emoji: string;
  name: string;
  /** true=浮，false=沉（基于真实物理：密度<水则浮） */
  floats: boolean;
}
const ITEMS: Item[] = [
  { emoji: "🪨", name: "石头", floats: false },
  { emoji: "🪵", name: "木头", floats: true },
  { emoji: "⛓️", name: "铁链", floats: false },
  { emoji: "🥤", name: "塑料瓶", floats: true },
  { emoji: "🎈", name: "气球", floats: true },
  { emoji: "🍃", name: "树叶", floats: true },
  { emoji: "🪙", name: "硬币", floats: false },
  { emoji: "🧊", name: "冰块", floats: true },
  { emoji: "🧱", name: "砖头", floats: false },
  { emoji: "🍎", name: "苹果", floats: true },
  { emoji: "🥄", name: "铁勺", floats: false },
  { emoji: "🏓", name: "乒乓球", floats: true },
  { emoji: "🦴", name: "骨头", floats: false },
  { emoji: "🐚", name: "贝壳", floats: false },
  { emoji: "🪺", name: "小篮子", floats: true },
];

export class SinkFloatGame extends BaseGame {
  constructor() {
    super("sink-float");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const item = sample(shuffle(ITEMS));

    const wrap = document.createElement("div");
    wrap.className = "snf-wrap";

    const task = document.createElement("div");
    task.className = "snf-task";
    task.innerHTML = `<b>${item.emoji}${item.name}</b> 放进水里，会怎样？<br><small>第 ${this.roundsDone + 1}/${this.roundTotal} 关</small>`;
    wrap.appendChild(task);

    // 水缸舞台
    const stage = document.createElement("div");
    stage.className = "snf-stage";
    stage.innerHTML = `<div class="snf-tank"><div class="snf-water"></div><div class="snf-thing">${item.emoji}</div></div>`;
    wrap.appendChild(stage);
    const thing = stage.querySelector<HTMLElement>(".snf-thing")!;

    // 两个选择按钮
    const board = document.createElement("div");
    board.className = "snf-board";
    const makeBtn = (label: string, icon: string, picked: boolean): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "snf-choice";
      b.innerHTML = `<span class="snf-choice__icon">${icon}</span><span class="snf-choice__label">${label}</span>`;
      b.addEventListener("click", () => this.choose(item, picked, thing, b));
      board.appendChild(b);
      return b;
    };
    makeBtn("浮起来", "⬆️", true);
    makeBtn("沉下去", "⬇️", false);
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private choose(
    item: Item,
    picked: boolean,
    thing: HTMLElement,
    btn: HTMLButtonElement,
  ): void {
    if (this.answered) return;
    this.answered = true;
    const correct = picked === item.floats;
    if (correct) {
      sfxPop();
      btn.classList.add("snf-choice--done");
      // 物品按真实情况落到对应位置
      thing.classList.add(item.floats ? "snf-thing--float" : "snf-thing--sink");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1500);
    } else {
      btn.classList.add("snf-choice--wrong");
      // 先按孩子选的方向走一点，再纠正回真实位置（学习反馈）
      thing.classList.add(item.floats ? "snf-thing--float" : "snf-thing--sink");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("snf-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "⛵",
      variant: "rest",
      body: "重的硬的东西容易沉哦～",
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
    if (document.getElementById("snf-style")) return;
    const st = document.createElement("style");
    st.id = "snf-style";
    st.textContent = SNF_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function SNF_CSS(theme: string): string {
  return `
.snf-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(420px,100%);}
.snf-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);}
.snf-task b{color:${theme};}
.snf-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.snf-stage{width:240px;height:230px;}
.snf-tank{position:relative;width:100%;height:100%;border-radius:0 0 28px 28px;border:5px solid #b8c4dc;background:linear-gradient(180deg,transparent 30%,rgba(125,200,255,.25) 30%,rgba(77,150,255,.45));overflow:hidden;box-shadow:var(--shadow-lg);}
.snf-water{position:absolute;left:0;right:0;top:30%;bottom:0;background:linear-gradient(180deg,rgba(125,200,255,.35),rgba(77,150,255,.6));}
.snf-water::before{content:"";position:absolute;left:0;right:0;top:-4px;height:8px;background:radial-gradient(circle at 20% 0,#fff 2px,transparent 3px),radial-gradient(circle at 60% 0,#fff 2px,transparent 3px);animation:snf-ripple 2s linear infinite;}
@keyframes snf-ripple{0%{transform:translateX(0)}100%{transform:translateX(40px)}}
.snf-thing{position:absolute;left:50%;top:8%;transform:translateX(-50%);font-size:2.8rem;transition:top 1.2s cubic-bezier(.4,1.4,.6,1);}
/* 浮：停在水面附近，上下轻晃 */
.snf-thing--float{top:30%;animation:snf-bob 1.4s ease-in-out infinite 1.2s;}
@keyframes snf-bob{0%,100%{top:30%}50%{top:34%}}
/* 沉：落到底部 */
.snf-thing--sink{top:80%;}
.snf-board{display:flex;gap:18px;justify-content:center;}
.snf-choice{min-width:120px;min-height:64px;border-radius:18px;border:none;background:#fff;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;}
.snf-choice:active{transform:scale(.95);}
.snf-choice__icon{font-size:1.8rem;}
.snf-choice__label{font-size:1rem;font-weight:800;color:var(--ink);}
.snf-choice--done{background:#d4f4dd;animation:snf-pop .4s ease;}
.snf-choice--wrong{animation:snf-shake .4s ease;}
@keyframes snf-pop{0%{transform:scale(.6)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes snf-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): SinkFloatGame {
  return new SinkFloatGame();
}
