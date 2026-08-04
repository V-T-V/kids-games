/* 厨房安全 Kitchen-Safety —— 判断厨房里的行为是安全还是危险
   （热锅不能碰 ✅安全认知 / 刀具不能玩 ✅ / 湿手插电 ❌危险）。安全启蒙。
   独特点：每题一个厨房情境，判断"安全做法"对 / 错。
   前缀 ksf-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface Item {
  pic: string;
  text: string;
  good: boolean;
}

const ITEMS: Item[] = [
  { pic: "🍳🔥🧒", text: "热锅很烫，不能用手去碰", good: true },
  { pic: "🔪🧒🎾", text: "拿菜刀当玩具挥来挥去", good: false },
  { pic: "🚪🧒✋", text: "大人做饭时在门外安静等", good: true },
  { pic: "💧🔌🧒", text: "湿着手去插电源插头", good: false },
  { pic: "🔥🧒🚫", text: "看到煤气灶着火赶紧叫大人", good: true },
  { pic: "🫗🧒⚖️", text: "踮脚自己去倒滚烫的热水", good: false },
  { pic: "🍳🧒👋", text: "刚炒完菜，锅还是热的别摸", good: true },
  { pic: "🧯🧒🔥", text: "油锅起火用水去浇灭", good: false },
  { pic: "🥫🧒❓", text: "不认识的瓶瓶罐罐不乱开", good: true },
  { pic: "🧊🧒🤸", text: "爬进冰箱里玩捉迷藏", good: false },
  { pic: "🧤🧒🍲", text: "帮妈妈拿东西用防烫手套", good: true },
  { pic: "🍇🧒🚽", text: "把豆子塞进鼻子里玩", good: false },
];

export class KitchenSafetyGame extends BaseGame {
  constructor() {
    super("kitchen-safety");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private current: Item | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const it = sample(ITEMS);
    this.current = it;

    const wrap = document.createElement("div");
    wrap.className = "ksf-wrap";

    const task = document.createElement("div");
    task.className = "ksf-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 这样做<b>对</b>还是<b>有危险</b>？`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "ksf-card";
    card.id = "ksf-card";
    card.innerHTML = `<div class="ksf-pic">${it.pic}</div><div class="ksf-text">${it.text}</div>`;
    wrap.appendChild(card);

    const judge = document.createElement("div");
    judge.className = "ksf-judge";
    const good = document.createElement("button");
    good.type = "button";
    good.className = "ksf-btn ksf-btn--good";
    good.innerHTML = `<span class="ksf-btn__icon">✅</span><span>对</span>`;
    good.addEventListener("click", () => this.judge(true, good));
    const bad = document.createElement("button");
    bad.type = "button";
    bad.className = "ksf-btn ksf-btn--bad";
    bad.innerHTML = `<span class="ksf-btn__icon">❌</span><span>有危险</span>`;
    bad.addEventListener("click", () => this.judge(false, bad));
    judge.appendChild(good);
    judge.appendChild(bad);
    wrap.appendChild(judge);
    this.root.appendChild(wrap);
  }

  private judge(answer: boolean, btn: HTMLButtonElement): void {
    if (this.locked || !this.current) return;
    const correct = answer === this.current.good;
    if (correct) {
      this.locked = true;
      sfxPop();
      btn.classList.add("ksf-btn--done");
      const card = this.root.querySelector("#ksf-card");
      card?.classList.add(
        this.current.good ? "ksf-card--good" : "ksf-card--bad",
      );
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("ksf-btn--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ksf-btn--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🔥",
      variant: "rest",
      body: "厨房里有危险：热锅不能碰、刀具不能玩、有危险赶紧叫大人～",
      primary: { text: "继续", icon: "🛡️", onClick: () => ov.destroy() },
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
    if (document.getElementById("ksf-style")) return;
    const st = document.createElement("style");
    st.id = "ksf-style";
    st.textContent = KSF_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function KSF_CSS(theme: string): string {
  return `
.ksf-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.ksf-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.6;}
.ksf-task b{color:${theme};}
.ksf-card{background:linear-gradient(180deg,#fff0ee,#ffd9d2);padding:26px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;transition:background .3s;}
.ksf-card--good{background:linear-gradient(180deg,#d4f4dd,#b6e9c4);}
.ksf-card--bad{background:linear-gradient(180deg,#ffe0e0,#ffcaca);}
.ksf-pic{font-size:3.4rem;letter-spacing:4px;}
.ksf-text{font-size:1.15rem;font-weight:800;color:#5a2a24;margin-top:10px;}
.ksf-judge{display:flex;gap:18px;justify-content:center;}
.ksf-btn{display:flex;flex-direction:column;align-items:center;gap:4px;width:140px;padding:18px 12px;border-radius:22px;border:none;cursor:pointer;font-size:1.1rem;font-weight:900;color:#fff;box-shadow:var(--shadow);transition:transform .12s;}
.ksf-btn:active{transform:scale(.95);}
.ksf-btn--good{background:linear-gradient(180deg,#6bcf7f,#43a047);}
.ksf-btn--bad{background:linear-gradient(180deg,#ff8a80,#e53935);}
.ksf-btn__icon{font-size:1.8rem;}
.ksf-btn--done{outline:4px solid #ffd93d;}
.ksf-btn--wrong{animation:ksf-shake .4s ease;}
@keyframes ksf-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): KitchenSafetyGame {
  return new KitchenSafetyGame();
}
