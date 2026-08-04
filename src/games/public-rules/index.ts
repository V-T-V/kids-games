/* 公共场所 Public-Rules —— 判断公共场所里的行为是对还是错
   （图书馆安静 ✅、医院乱跑 ❌、排队上车 ✅、随地吐痰 ❌）。社交规则启蒙。
   独特点：每题一个公共场所行为，点 ✅（对）或 ❌（错）。
   前缀 pbr-。 */

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
  { pic: "📚🤫🧒", text: "在图书馆里小声说话", good: true },
  { pic: "🏥🏃💨", text: "在医院走廊里跑来跑去", good: false },
  { pic: "🚌🧍🧍", text: "上公交车时排队不推人", good: true },
  { pic: "🚇📢🧒", text: "在地铁里大声唱歌", good: false },
  { pic: "🌳🚯", text: "把垃圾随手扔在公园草地", good: false },
  { pic: "🚦🧒🚶", text: "走斑马线看红绿灯过马路", good: true },
  { pic: "⛲🦆🤲", text: "轻轻喂鸭子不追它", good: true },
  { pic: "🎬📱", text: "看电影时手机大声外放", good: false },
  { pic: "🚪🧒👵", text: "帮后面的人扶住门", good: true },
  { pic: "🚽💦", text: "在公共厕所墙上乱画", good: false },
  { pic: "🛒🧒👈", text: "超市里把东西乱放回错货架", good: false },
  { pic: "🪑🧒🎒", text: "在公交上给老人让座", good: true },
];

export class PublicRulesGame extends BaseGame {
  constructor() {
    super("public-rules");
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
    wrap.className = "pbr-wrap";

    const task = document.createElement("div");
    task.className = "pbr-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 这样做<b>对</b>还是<b>不对</b>？`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "pbr-card";
    card.id = "pbr-card";
    card.innerHTML = `<div class="pbr-pic">${it.pic}</div><div class="pbr-text">${it.text}</div>`;
    wrap.appendChild(card);

    const judge = document.createElement("div");
    judge.className = "pbr-judge";
    const good = document.createElement("button");
    good.type = "button";
    good.className = "pbr-btn pbr-btn--good";
    good.innerHTML = `<span class="pbr-btn__icon">✅</span><span>对</span>`;
    good.addEventListener("click", () => this.judge(true, good));
    const bad = document.createElement("button");
    bad.type = "button";
    bad.className = "pbr-btn pbr-btn--bad";
    bad.innerHTML = `<span class="pbr-btn__icon">❌</span><span>不对</span>`;
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
      btn.classList.add("pbr-btn--done");
      const card = this.root.querySelector("#pbr-card");
      card?.classList.add(
        this.current.good ? "pbr-card--good" : "pbr-card--bad",
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
      btn.classList.add("pbr-btn--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("pbr-btn--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🏛️",
      variant: "rest",
      body: "公共场所要守规则：保持安静、不乱跑、不乱扔垃圾～",
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
    if (document.getElementById("pbr-style")) return;
    const st = document.createElement("style");
    st.id = "pbr-style";
    st.textContent = PBR_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function PBR_CSS(theme: string): string {
  return `
.pbr-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.pbr-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.6;}
.pbr-task b{color:${theme};}
.pbr-card{background:linear-gradient(180deg,#eef0ff,#dfe2ff);padding:26px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;transition:background .3s;}
.pbr-card--good{background:linear-gradient(180deg,#d4f4dd,#b6e9c4);}
.pbr-card--bad{background:linear-gradient(180deg,#ffe0e0,#ffcaca);}
.pbr-pic{font-size:3.4rem;letter-spacing:4px;}
.pbr-text{font-size:1.15rem;font-weight:800;color:#2a2a5a;margin-top:10px;}
.pbr-judge{display:flex;gap:18px;justify-content:center;}
.pbr-btn{display:flex;flex-direction:column;align-items:center;gap:4px;width:140px;padding:18px 12px;border-radius:22px;border:none;cursor:pointer;font-size:1.1rem;font-weight:900;color:#fff;box-shadow:var(--shadow);transition:transform .12s;}
.pbr-btn:active{transform:scale(.95);}
.pbr-btn--good{background:linear-gradient(180deg,#6bcf7f,#43a047);}
.pbr-btn--bad{background:linear-gradient(180deg,#ff8a80,#e53935);}
.pbr-btn__icon{font-size:1.8rem;}
.pbr-btn--done{outline:4px solid #ffd93d;}
.pbr-btn--wrong{animation:pbr-shake .4s ease;}
@keyframes pbr-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): PublicRulesGame {
  return new PublicRulesGame();
}
