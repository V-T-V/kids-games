/* 请谢谢 Please-Thanks —— 场景配对正确的礼貌用语
   （得到帮助→谢谢，请求→请，道歉→对不起，问候→你好）。
   社交启蒙：把礼貌话用在对的场合。独特点：每题给一个场景，从三句话里挑最合适的。
   前缀 plt-。 */

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
    pic: "🧑‍🍳🧒🍪",
    desc: "阿姨给了我一块小饼干，我应该说？",
    choices: [
      { emoji: "🙏", text: "谢谢阿姨", good: true },
      { emoji: "🙋", text: "请再给我一块", good: false },
      { emoji: "🙇", text: "对不起阿姨", good: false },
    ],
  },
  {
    pic: "🧒🥛🍽️",
    desc: "想请妈妈帮我倒杯水，我应该说？",
    choices: [
      { emoji: "🙋", text: "妈妈请帮我倒杯水好吗", good: true },
      { emoji: "🙏", text: "谢谢妈妈", good: false },
      { emoji: "📢", text: "快给我拿水来", good: false },
    ],
  },
  {
    pic: "🧒🦶👦",
    desc: "我不小心踩到同学的脚，我应该说？",
    choices: [
      { emoji: "🙇", text: "对不起，你没事吧", good: true },
      { emoji: "🙏", text: "谢谢你", good: false },
      { emoji: "🙋", text: "请你让开", good: false },
    ],
  },
  {
    pic: "🚪🧒👵",
    desc: "早上出门遇到邻居奶奶，我应该说？",
    choices: [
      { emoji: "👋", text: "奶奶早上好", good: true },
      { emoji: "🙏", text: "谢谢奶奶", good: false },
      { emoji: "🙇", text: "对不起奶奶", good: false },
    ],
  },
  {
    pic: "🧒📚👧",
    desc: "想借用同学的橡皮，我应该说？",
    choices: [
      { emoji: "🙋", text: "请问可以借我用一下吗", good: true },
      { emoji: "🤏", text: "直接伸手拿走", good: false },
      { emoji: "🙏", text: "谢谢你", good: false },
    ],
  },
  {
    pic: "🧑‍🏫🧒⭐",
    desc: "老师夸我今天表现好，我应该说？",
    choices: [
      { emoji: "🙏", text: "谢谢老师", good: true },
      { emoji: "🙇", text: "对不起老师", good: false },
      { emoji: "😎", text: "哼，我本来就厉害", good: false },
    ],
  },
  {
    pic: "🧒👋🏫",
    desc: "放学跟老师道别，我应该说？",
    choices: [
      { emoji: "👋", text: "老师再见", good: true },
      { emoji: "🙋", text: "老师请", good: false },
      { emoji: "🙏", text: "老师谢谢", good: false },
    ],
  },
];

export class PleaseThanksGame extends BaseGame {
  constructor() {
    super("please-thanks");
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
    wrap.className = "plt-wrap";

    const task = document.createElement("div");
    task.className = "plt-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 选一句<b>最合适</b>的礼貌话`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "plt-scene";
    scene.innerHTML = `<div class="plt-pic">${sc.pic}</div><div class="plt-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "plt-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "plt-opt";
      b.innerHTML = `<div class="plt-opt__icon">${c.emoji}</div><div class="plt-opt__text">${c.text}</div>`;
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
      btn.classList.add("plt-opt--done");
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
      btn.classList.add("plt-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("plt-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🙏",
      variant: "rest",
      body: "把礼貌话用对：得到帮助说谢谢，请人帮忙说请～",
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
    if (document.getElementById("plt-style")) return;
    const st = document.createElement("style");
    st.id = "plt-style";
    st.textContent = PLT_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function PLT_CSS(theme: string): string {
  return `
.plt-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.plt-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.plt-task b{color:${theme};}
.plt-scene{background:linear-gradient(180deg,#fff0f6,#ffe0ec);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.plt-pic{font-size:3rem;letter-spacing:4px;}
.plt-desc{font-size:1.1rem;font-weight:800;color:#5a2a44;margin-top:8px;}
.plt-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.plt-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.plt-opt:active{transform:scale(.97);}
.plt-opt__icon{font-size:1.8rem;flex-shrink:0;width:48px;text-align:center;font-weight:900;}
.plt-opt__text{font-size:1.05rem;font-weight:800;color:#444;}
.plt-opt--done{background:#d4f4dd;animation:plt-pop .4s ease;}
.plt-opt--wrong{background:#ffe0e0;animation:plt-shake .4s ease;}
@keyframes plt-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes plt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): PleaseThanksGame {
  return new PleaseThanksGame();
}
