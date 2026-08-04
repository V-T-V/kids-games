/* 餐桌礼 Table-Manners —— 判断吃饭时的行为是好习惯还是坏习惯
   （不挑食 ✅、吧唧嘴 ❌、坐端正 ✅、玩食物 ❌）。生活礼仪启蒙。
   独特点：每题一个用餐行为，点 ✅（好习惯）或 ❌（坏习惯）。
   前缀 tbl-。 */

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
  { pic: "🥦😋", text: "蔬菜肉肉都吃，不挑食", good: true },
  { pic: "🤤🔊", text: "吃饭吧唧嘴，声音很大", good: false },
  { pic: "🪑🧒🍽️", text: "坐端正，安静地吃", good: true },
  { pic: "🍚🏐", text: "拿饭团当球扔着玩", good: false },
  { pic: "🥄🧒🍽️", text: "用勺子慢慢吃，不掉饭粒", good: true },
  { pic: "🦶🍽️", text: "脚翘到桌子上吃饭", good: false },
  { pic: "🍎🧒👍", text: "把不喜欢吃的悄悄拨给别人", good: false },
  { pic: "🥛🧒✨", text: "吃完把自己的碗筷收好", good: true },
  { pic: "📺🍚", text: "边看电视边扒饭", good: false },
  { pic: "🧽🍽️", text: "饭后帮忙擦桌子", good: true },
  { pic: "🤚🥢", text: "用筷子敲碗叮叮当当", good: false },
  { pic: "🤲🍚", text: "饭前洗手再吃饭", good: true },
];

export class TableMannersGame extends BaseGame {
  constructor() {
    super("table-manners");
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
    wrap.className = "tbl-wrap";

    const task = document.createElement("div");
    task.className = "tbl-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 这是<b>好习惯</b>还是<b>坏习惯</b>？`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "tbl-card";
    card.id = "tbl-card";
    card.innerHTML = `<div class="tbl-pic">${it.pic}</div><div class="tbl-text">${it.text}</div>`;
    wrap.appendChild(card);

    const judge = document.createElement("div");
    judge.className = "tbl-judge";
    const good = document.createElement("button");
    good.type = "button";
    good.className = "tbl-btn tbl-btn--good";
    good.innerHTML = `<span class="tbl-btn__icon">✅</span><span>好习惯</span>`;
    good.addEventListener("click", () => this.judge(true, good));
    const bad = document.createElement("button");
    bad.type = "button";
    bad.className = "tbl-btn tbl-btn--bad";
    bad.innerHTML = `<span class="tbl-btn__icon">❌</span><span>坏习惯</span>`;
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
      btn.classList.add("tbl-btn--done");
      const card = this.root.querySelector("#tbl-card");
      card?.classList.add(
        this.current.good ? "tbl-card--good" : "tbl-card--bad",
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
      btn.classList.add("tbl-btn--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("tbl-btn--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🍽️",
      variant: "rest",
      body: "吃饭要有好习惯：不挑食、不吧唧嘴、坐端正、饭后帮忙收拾～",
      primary: { text: "继续", icon: "🤗", onClick: () => ov.destroy() },
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
    if (document.getElementById("tbl-style")) return;
    const st = document.createElement("style");
    st.id = "tbl-style";
    st.textContent = TBL_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function TBL_CSS(theme: string): string {
  return `
.tbl-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.tbl-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.6;}
.tbl-task b{color:${theme};}
.tbl-card{background:linear-gradient(180deg,#f0fff0,#dcf5dc);padding:26px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;transition:background .3s;}
.tbl-card--good{background:linear-gradient(180deg,#d4f4dd,#b6e9c4);}
.tbl-card--bad{background:linear-gradient(180deg,#ffe0e0,#ffcaca);}
.tbl-pic{font-size:3.4rem;letter-spacing:4px;}
.tbl-text{font-size:1.15rem;font-weight:800;color:#2a4a2a;margin-top:10px;}
.tbl-judge{display:flex;gap:18px;justify-content:center;}
.tbl-btn{display:flex;flex-direction:column;align-items:center;gap:4px;width:140px;padding:18px 12px;border-radius:22px;border:none;cursor:pointer;font-size:1.1rem;font-weight:900;color:#fff;box-shadow:var(--shadow);transition:transform .12s;}
.tbl-btn:active{transform:scale(.95);}
.tbl-btn--good{background:linear-gradient(180deg,#6bcf7f,#43a047);}
.tbl-btn--bad{background:linear-gradient(180deg,#ff8a80,#e53935);}
.tbl-btn__icon{font-size:1.8rem;}
.tbl-btn--done{outline:4px solid #ffd93d;}
.tbl-btn--wrong{animation:tbl-shake .4s ease;}
@keyframes tbl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): TableMannersGame {
  return new TableMannersGame();
}
