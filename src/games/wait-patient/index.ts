/* 耐心等 Wait-Patient —— 判断哪些场合需要耐心等待
   （排队、别人说话、红灯、轮流玩）。社交启蒙：守规则 + 延迟满足。
   独特点：每题一个场景，选出"需要等待"的正确做法。
   前缀 wpt-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Choice {
  emoji: string;
  text: string;
  good: boolean;
}
interface Scene {
  pic: string;
  desc: string;
  choices: Choice[];
}

const SCENES: Scene[] = [
  {
    pic: "🧒🧍🧍",
    desc: "买冰淇淋时前面有人在排队，我？",
    choices: [
      { emoji: "⏳", text: "排在后面安静等轮到我", good: true },
      { emoji: "🤚", text: "插队挤到最前面", good: false },
      { emoji: "😫", text: "大哭大闹催快点", good: false },
    ],
  },
  {
    pic: "🚦🧒🚗",
    desc: "走到路口是红灯，没有车，我？",
    choices: [
      { emoji: "🚦", text: "等绿灯亮了再走", good: true },
      { emoji: "🏃", text: "趁没车赶紧跑过去", good: false },
      { emoji: "🚶", text: "边走边看手机溜过去", good: false },
    ],
  },
  {
    pic: "👧🗣️🧒",
    desc: "好朋友正和老师说话，我有事想告诉她，我？",
    choices: [
      { emoji: "🤫", text: "等她说完再说", good: true },
      { emoji: "📢", text: "大声打断喊她的名字", good: false },
      { emoji: "👉", text: "拉她衣服把她拽过来", good: false },
    ],
  },
  {
    pic: "🧒🛝👧",
    desc: "滑梯前面有好几个小朋友，我？",
    choices: [
      { emoji: "🧍", text: "排队一个一个滑", good: true },
      { emoji: "💨", text: "把小朋友推开自己先滑", good: false },
      { emoji: "🤸", text: "从滑梯下面往上爬", good: false },
    ],
  },
  {
    pic: "🎮🧒👦",
    desc: "想玩哥哥手里的游戏机，他在玩，我？",
    choices: [
      { emoji: "⏰", text: "等他玩好这局再问我玩", good: true },
      { emoji: "🤏", text: "直接抢过来玩", good: false },
      { emoji: "😾", text: "把电源拔掉", good: false },
    ],
  },
  {
    pic: "🚽🧒🧍",
    desc: "想上厕所但里面有人，我？",
    choices: [
      { emoji: "⏳", text: "在门口排队等一等", good: true },
      { emoji: "🚪", text: "用力推门闯进去", good: false },
      { emoji: "😫", text: "在地上打滚哭闹", good: false },
    ],
  },
];

export class WaitPatientGame extends BaseGame {
  constructor() {
    super("wait-patient");
  }
  private roundsDone = 0;
  private roundTotal = 0;
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

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const sc = sample(SCENES);
    const choices = shuffle(sc.choices);

    const wrap = document.createElement("div");
    wrap.className = "wpt-wrap";

    const task = document.createElement("div");
    task.className = "wpt-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 选一个<b>会等待</b>的好做法`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "wpt-scene";
    scene.innerHTML = `<div class="wpt-pic">${sc.pic}</div><div class="wpt-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "wpt-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wpt-opt";
      b.innerHTML = `<div class="wpt-opt__icon">${c.emoji}</div><div class="wpt-opt__text">${c.text}</div>`;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(c: Choice, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (c.good) {
      this.locked = true;
      sfxPop();
      btn.classList.add("wpt-opt--done");
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
      btn.classList.add("wpt-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("wpt-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "⏰",
      variant: "rest",
      body: "很多地方要排队等待：红灯停、轮流玩、不打断别人～",
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
    if (document.getElementById("wpt-style")) return;
    const st = document.createElement("style");
    st.id = "wpt-style";
    st.textContent = WPT_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function WPT_CSS(theme: string): string {
  return `
.wpt-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.wpt-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.wpt-task b{color:${theme};}
.wpt-scene{background:linear-gradient(180deg,#fff3e0,#ffe4c0);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.wpt-pic{font-size:3rem;letter-spacing:4px;}
.wpt-desc{font-size:1.1rem;font-weight:800;color:#5a3a1a;margin-top:8px;}
.wpt-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.wpt-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.wpt-opt:active{transform:scale(.97);}
.wpt-opt__icon{font-size:1.8rem;flex-shrink:0;width:48px;text-align:center;font-weight:900;}
.wpt-opt__text{font-size:1.05rem;font-weight:800;color:#444;}
.wpt-opt--done{background:#d4f4dd;animation:wpt-pop .4s ease;}
.wpt-opt--wrong{background:#ffe0e0;animation:wpt-shake .4s ease;}
@keyframes wpt-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes wpt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): WaitPatientGame {
  return new WaitPatientGame();
}
