/* 安慰人 Comfort-Friend —— 朋友难过时，选出温暖的安慰方式
   （抱抱、说我陪你、分享玩具、递纸巾）。社交启蒙：同理心。
   独特点：聚焦"朋友难过"这一情感场景，候选里只有一个温柔做法。
   前缀 cmf-。 */

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
    pic: "👧😢💔",
    desc: "朋友的布娃娃坏了，她在哭，我？",
    choices: [
      { emoji: "🤗", text: "轻轻抱抱她说：我陪你", good: true },
      { emoji: "😂", text: "哈哈笑她爱哭鬼", good: false },
      { emoji: "🏃", text: "嫌烦跑开不理她", good: false },
    ],
  },
  {
    pic: "👦😢📉",
    desc: "朋友没选上比赛有点难过，我？",
    choices: [
      { emoji: "💪", text: "说下次再努力，我帮你练", good: true },
      { emoji: "😏", text: "说反正你本来就不行", good: false },
      { emoji: "🤷", text: "说他自己活该", good: false },
    ],
  },
  {
    pic: "👧😭🧊",
    desc: "朋友摔跤膝盖疼哭起来，我？",
    choices: [
      { emoji: "🧻", text: "帮他叫老师，递张纸巾", good: true },
      { emoji: "👉", text: "说他娇气这都哭", good: false },
      { emoji: "📸", text: "拍照发给大家看笑话", good: false },
    ],
  },
  {
    pic: "👦😞🧸",
    desc: "好朋友搬家要走了很难过，我？",
    choices: [
      { emoji: "🎁", text: "送他一张我的画说想我就看", good: true },
      { emoji: "🙄", text: "说走了正好我不在乎", good: false },
      { emoji: "🙉", text: "装没听见走开", good: false },
    ],
  },
  {
    pic: "👧😢🍪",
    desc: "朋友的小饼干掉地上了很伤心，我？",
    choices: [
      { emoji: "🍪", text: "把自己的掰一半分给她", good: true },
      { emoji: "😋", text: "当着她面吃自己的", good: false },
      { emoji: "💢", text: "说她笨手笨脚", good: false },
    ],
  },
  {
    pic: "👦😢🌧️",
    desc: "朋友因为下雨不能出去玩在叹气，我？",
    choices: [
      { emoji: "🎲", text: "说我们可以在屋里一起玩玩具", good: true },
      { emoji: "😤", text: "也跟着抱怨发脾气", good: false },
      { emoji: "🚪", text: "把他推到雨里去", good: false },
    ],
  },
];

export class ComfortFriendGame extends BaseGame {
  constructor() {
    super("comfort-friend");
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
    wrap.className = "cmf-wrap";

    const task = document.createElement("div");
    task.className = "cmf-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 选一个<b>温暖</b>的好做法`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "cmf-scene";
    scene.innerHTML = `<div class="cmf-pic">${sc.pic}</div><div class="cmf-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "cmf-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cmf-opt";
      b.innerHTML = `<div class="cmf-opt__icon">${c.emoji}</div><div class="cmf-opt__text">${c.text}</div>`;
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
      btn.classList.add("cmf-opt--done");
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
      btn.classList.add("cmf-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("cmf-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🤗",
      variant: "rest",
      body: "朋友难过时，抱抱他、陪他、分给他，会让他心里暖暖的～",
      primary: { text: "继续", icon: "💛", onClick: () => ov.destroy() },
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
    if (document.getElementById("cmf-style")) return;
    const st = document.createElement("style");
    st.id = "cmf-style";
    st.textContent = CMF_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function CMF_CSS(theme: string): string {
  return `
.cmf-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.cmf-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.cmf-task b{color:${theme};}
.cmf-scene{background:linear-gradient(180deg,#f5f0ff,#ece0ff);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.cmf-pic{font-size:3rem;letter-spacing:4px;}
.cmf-desc{font-size:1.1rem;font-weight:800;color:#3a2a5a;margin-top:8px;}
.cmf-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.cmf-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.cmf-opt:active{transform:scale(.97);}
.cmf-opt__icon{font-size:1.8rem;flex-shrink:0;width:48px;text-align:center;font-weight:900;}
.cmf-opt__text{font-size:1.05rem;font-weight:800;color:#444;}
.cmf-opt--done{background:#d4f4dd;animation:cmf-pop .4s ease;}
.cmf-opt--wrong{background:#ffe0e0;animation:cmf-shake .4s ease;}
@keyframes cmf-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes cmf-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ComfortFriendGame {
  return new ComfortFriendGame();
}
