/* 测量尺 Ruler —— 尺子上有刻度，上面放一个物品，读出长度（几厘米）。
   巧思：CSS 刻度尺 + 物品（铅笔/蜡笔/橡皮），刻度清晰；从选项选。
   难度 = 物品长度范围。通关 = 答对目标题数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

const ITEMS = [
  { emoji: "✏️", name: "铅笔" },
  { emoji: "🖍️", name: "蜡笔" },
  { emoji: "🩹", name: "橡皮" },
  { emoji: "🍬", name: "糖果" },
  { emoji: "🔑", name: "钥匙" },
];

export class RulerGame extends BaseGame {
  constructor() {
    super("ruler");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  /** 每厘米像素 */
  private readonly PX_PER_CM = 32;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    const [lo, hi] =
      this.difficulty === "easy"
        ? [2, 4]
        : this.difficulty === "medium"
          ? [2, 8]
          : [3, 12];
    const len = randInt(lo, hi);
    const startCm = randInt(0, 2); // 物品起点（厘米），增加变化
    const item = sample(ITEMS)!;

    const wrap = document.createElement("div");
    wrap.className = "ru-wrap";

    const task = document.createElement("div");
    task.className = "ru-task";
    task.textContent = `${item.name} 有几厘米长？点对的数字（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 测量区
    const measure = document.createElement("div");
    measure.className = "ru-measure";
    measure.style.setProperty("--cm", String(this.PX_PER_CM));

    // 物品（放在尺子上方对齐起点）
    const obj = document.createElement("div");
    obj.className = "ru-item";
    obj.style.left = `${startCm * this.PX_PER_CM}px`;
    obj.style.width = `${len * this.PX_PER_CM}px`;
    obj.innerHTML = `<span class="ru-item__emoji">${item.emoji}</span>`;
    // 起止标记线
    const mark0 = document.createElement("div");
    mark0.className = "ru-mark";
    mark0.style.left = `${startCm * this.PX_PER_CM}px`;
    const mark1 = document.createElement("div");
    mark1.className = "ru-mark";
    mark1.style.left = `${(startCm + len) * this.PX_PER_CM}px`;
    measure.appendChild(obj);
    measure.appendChild(mark0);
    measure.appendChild(mark1);

    // 尺子
    const ruler = document.createElement("div");
    ruler.className = "ru-ruler";
    const maxCm = Math.max(12, startCm + len + 2);
    for (let i = 0; i <= maxCm; i++) {
      const tick = document.createElement("div");
      tick.className = "ru-tick";
      tick.style.left = `${i * this.PX_PER_CM}px`;
      const lab = document.createElement("span");
      lab.className = "ru-tick-label";
      lab.textContent = String(i);
      tick.appendChild(lab);
      ruler.appendChild(tick);
    }
    measure.appendChild(ruler);
    wrap.appendChild(measure);

    // 选项
    const opts = document.createElement("div");
    opts.className = "ru-opts";
    const set = new Set<number>([len]);
    while (set.size < 4) {
      const d = len + sample([-3, -2, -1, 1, 2, 3]);
      if (d >= 1) set.add(d);
    }
    shuffle([...set]).forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ru-choice";
      b.textContent = `${v} 厘米`;
      b.addEventListener("click", () => this.choose(v, len, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(v: number, answer: number, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (v === answer) {
      this.locked = true;
      sfxPop();
      btn.classList.add("ru-choice--done");
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
      btn.classList.add("ru-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ru-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "从物品一端数到另一端，数几个大格就是几厘米～",
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
    if (document.getElementById("ru-style")) return;
    const st = document.createElement("style");
    st.id = "ru-style";
    st.textContent = RU_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function RU_CSS(theme: string): string {
  return `
.ru-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(460px,100%);}
.ru-task{font-size:1.15rem;font-weight:800;text-align:center;}
.ru-measure{position:relative;width:min(420px,94vw);padding-top:46px;overflow:visible;}
.ru-item{position:absolute;top:0;height:40px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#fff,#fff3e0);border-radius:10px;box-shadow:var(--shadow);}
.ru-item__emoji{font-size:1.6rem;}
.ru-mark{position:absolute;top:0;height:46px;width:0;border-left:3px dashed ${theme};opacity:.7;}
.ru-ruler{position:relative;height:54px;background:linear-gradient(180deg,#fffbe6,#fff3b0);border:3px solid var(--ink);border-radius:6px;box-shadow:var(--shadow);}
.ru-tick{position:absolute;top:0;width:0;height:18px;border-left:2px solid var(--ink);}
.ru-tick-label{position:absolute;top:22px;left:-6px;font-size:.8rem;font-weight:800;color:var(--ink);}
.ru-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.ru-choice{min-width:96px;min-height:60px;padding:0 18px;font-size:1.2rem;font-weight:800;border-radius:16px;background:#fff;color:var(--ink);box-shadow:var(--shadow);transition:transform .1s ease;}
.ru-choice:active{transform:scale(.94);}
.ru-choice--done{background:${theme};color:#fff;animation:ru-pop .4s ease;}
.ru-choice--wrong{animation:ru-shake .4s ease;}
@keyframes ru-pop{0%{transform:scale(.7)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes ru-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): RulerGame {
  return new RulerGame();
}
