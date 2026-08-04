/* 好听众 Good-Listener —— 别人说话时选出好行为
   （看着对方眼睛、不打断、认真听、点头回应）。社交启蒙：尊重 + 倾听。
   独特点：聚焦"听别人说话"这一具体微行为，候选里只有一个得体。
   前缀 gdl-。 */

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
    pic: "👩‍🏫🧒👂",
    desc: "老师在讲故事的时候，我应该？",
    choices: [
      { emoji: "👀", text: "看着老师，认真听", good: true },
      { emoji: "💬", text: "和同桌一直说悄悄话", good: false },
      { emoji: "🏃", text: "站起来到处乱跑", good: false },
    ],
  },
  {
    pic: "👵🧒📖",
    desc: "奶奶在给我讲从前的事，我应该？",
    choices: [
      { emoji: "🤲", text: "安静地等奶奶说完再说话", good: true },
      { emoji: "🚫", text: "一直打断她说我懂了", good: false },
      { emoji: "📱", text: "低头玩手机不理她", good: false },
    ],
  },
  {
    pic: "👦🧒🎈",
    desc: "好朋友正兴奋地讲他周末去玩了，我？",
    choices: [
      { emoji: "😀", text: "认真听，问他开不开心", good: true },
      { emoji: "😤", text: "抢着说自己玩得更厉害", good: false },
      { emoji: "🙈", text: "捂耳朵说不想听", good: false },
    ],
  },
  {
    pic: "👨🧒🗣️",
    desc: "爸爸在认真叮嘱我过马路要小心，我？",
    choices: [
      { emoji: "🙆", text: "看着爸爸点头说知道了", good: true },
      { emoji: "🙉", text: "捂耳朵嫌啰嗦", good: false },
      { emoji: "🎮", text: "边打游戏边嗯嗯敷衍", good: false },
    ],
  },
  {
    pic: "🎤🧒👭",
    desc: "小朋友在台上表演，台下的我？",
    choices: [
      { emoji: "👏", text: "安静看完，结束鼓掌", good: true },
      { emoji: "📢", text: "在下面大声喊叫捣乱", good: false },
      { emoji: "😴", text: "趴着睡觉打呼噜", good: false },
    ],
  },
  {
    pic: "🧒❓👂",
    desc: "没听清楚别人说的话，应该？",
    choices: [
      { emoji: "🤔", text: "礼貌地问：可以再说一遍吗", good: true },
      { emoji: "🤷", text: "假装没听到走开", good: false },
      { emoji: "😾", text: "生气怪别人没说清", good: false },
    ],
  },
];

export class GoodListenerGame extends BaseGame {
  constructor() {
    super("good-listener");
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
    wrap.className = "gdl-wrap";

    const task = document.createElement("div");
    task.className = "gdl-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 选一个<b>会倾听</b>的好做法`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "gdl-scene";
    scene.innerHTML = `<div class="gdl-pic">${sc.pic}</div><div class="gdl-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "gdl-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gdl-opt";
      b.innerHTML = `<div class="gdl-opt__icon">${c.emoji}</div><div class="gdl-opt__text">${c.text}</div>`;
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
      btn.classList.add("gdl-opt--done");
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
      btn.classList.add("gdl-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("gdl-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "👂",
      variant: "rest",
      body: "听人说话要有礼貌：看着眼睛、不插嘴、认真听完～",
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
    if (document.getElementById("gdl-style")) return;
    const st = document.createElement("style");
    st.id = "gdl-style";
    st.textContent = GDL_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function GDL_CSS(theme: string): string {
  return `
.gdl-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.gdl-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.gdl-task b{color:${theme};}
.gdl-scene{background:linear-gradient(180deg,#e6fffb,#cdf5ee);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.gdl-pic{font-size:3rem;letter-spacing:4px;}
.gdl-desc{font-size:1.1rem;font-weight:800;color:#0e4a44;margin-top:8px;}
.gdl-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.gdl-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.gdl-opt:active{transform:scale(.97);}
.gdl-opt__icon{font-size:1.8rem;flex-shrink:0;width:48px;text-align:center;font-weight:900;}
.gdl-opt__text{font-size:1.05rem;font-weight:800;color:#444;}
.gdl-opt--done{background:#d4f4dd;animation:gdl-pop .4s ease;}
.gdl-opt--wrong{background:#ffe0e0;animation:gdl-shake .4s ease;}
@keyframes gdl-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes gdl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): GoodListenerGame {
  return new GoodListenerGame();
}
