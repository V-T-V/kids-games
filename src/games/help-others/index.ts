/* 帮助他人 Help Others —— 看到别人有困难，选出正确的帮助方式。
   社交启蒙：观察 + 主动帮助 + 帮得对。独特点：困难场景 + 多种回应，
   只有一个真正解决问题且不会添乱。前缀 hlo-。 */

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
    pic: "👵📦",
    desc: "奶奶提的东西掉在地上了",
    choices: [
      { emoji: "🤲", text: "帮她把东西捡起来", good: true },
      { emoji: "🏃", text: "假装没看见跑开", good: false },
      { emoji: "🦶", text: "用脚踢一边去", good: false },
    ],
  },
  {
    pic: "👧😢📚",
    desc: "小朋友的绘本掉了一地",
    choices: [
      { emoji: "📚", text: "帮她一起捡起来", good: true },
      { emoji: "🤣", text: "在旁边哈哈笑", good: false },
      { emoji: "🦶", text: "再踩几脚", good: false },
    ],
  },
  {
    pic: "🧒🤔🧩",
    desc: "弟弟不会拼这块拼图",
    choices: [
      { emoji: "👉", text: "教他怎么找对的边", good: true },
      { emoji: "🙅", text: "说他笨不教他", good: false },
      { emoji: "🏃", text: "把自己那份也摔了", good: false },
    ],
  },
  {
    pic: "👴🚶",
    desc: "爷爷走路慢想过马路",
    choices: [
      { emoji: "🤝", text: "扶着爷爷慢慢走", good: true },
      { emoji: "📣", text: "大声喊他快点", good: false },
      { emoji: "🏃", text: "自己先跑过去", good: false },
    ],
  },
  {
    pic: "👦🤧🧻",
    desc: "同学打喷嚏没有纸巾",
    choices: [
      { emoji: "🧻", text: "把自己的纸巾递给他", good: true },
      { emoji: "🙈", text: "捂着鼻子躲远", good: false },
      { emoji: "🤣", text: "笑他邋遢", good: false },
    ],
  },
  {
    pic: "👧💧🎒",
    desc: "朋友的水壶倒了水流出来",
    choices: [
      { emoji: "🧽", text: "帮她一起擦干净", good: true },
      { emoji: "💦", text: "故意再推一下", good: false },
      { emoji: "🚶", text: "走开不管", good: false },
    ],
  },
  {
    pic: "🧒🪜🍪",
    desc: "小弟弟够不到桌上的饼干",
    choices: [
      { emoji: "🍪", text: "帮他拿一块下来", good: true },
      { emoji: "😝", text: "自己全部吃掉", good: false },
      { emoji: "🚫", text: "把饼干藏起来", good: false },
    ],
  },
];

export class HelpOthersGame extends BaseGame {
  constructor() {
    super("help-others");
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
    wrap.className = "hlo-wrap";

    const task = document.createElement("div");
    task.className = "hlo-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 选一个<b>会帮忙</b>的好办法`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "hlo-scene";
    scene.innerHTML = `<div class="hlo-pic">${sc.pic}</div><div class="hlo-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "hlo-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hlo-opt";
      b.innerHTML = `<div class="hlo-opt__icon">${c.emoji}</div><div class="hlo-opt__text">${c.text}</div>`;
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
      btn.classList.add("hlo-opt--done");
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
      btn.classList.add("hlo-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("hlo-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "💛",
      variant: "rest",
      body: "看到别人有困难，我们能帮就帮，但要用对方法，别帮倒忙哦～",
      primary: { text: "继续", icon: "🤝", onClick: () => ov.destroy() },
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
    if (document.getElementById("hlo-style")) return;
    const st = document.createElement("style");
    st.id = "hlo-style";
    st.textContent = HLO_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function HLO_CSS(theme: string): string {
  return `
.hlo-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.hlo-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.hlo-task b{color:${theme};}
.hlo-scene{background:linear-gradient(180deg,#fff5e6,#ffe9c4);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.hlo-pic{font-size:2.6rem;letter-spacing:4px;}
.hlo-desc{font-size:1.1rem;font-weight:800;color:#6a4f2a;margin-top:8px;}
.hlo-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.hlo-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.hlo-opt:active{transform:scale(.97);}
.hlo-opt__icon{font-size:1.8rem;flex-shrink:0;width:48px;text-align:center;}
.hlo-opt__text{font-size:1.05rem;font-weight:800;color:#444;}
.hlo-opt--done{background:#d4f4dd;animation:hlo-pop .4s ease;}
.hlo-opt--wrong{background:#ffe0e0;animation:hlo-shake .4s ease;}
@keyframes hlo-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes hlo-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): HelpOthersGame {
  return new HelpOthersGame();
}
