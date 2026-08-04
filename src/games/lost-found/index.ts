/* 丢东西 Lost-Found —— 丢了心爱东西或走散时，选出正确应对
   （找大人帮忙、原地等、不慌张、记住特征）。安全 + 应急启蒙。
   独特点：聚焦"丢东西/走散"这一高频儿童焦虑场景，候选里只有一个安全做法。
   前缀 lfd-。 */

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
    pic: "🧒❓🧸",
    desc: "在商场发现我的布娃娃不见了，我应该？",
    choices: [
      { emoji: "👮", text: "找附近的大人或工作人员帮忙", good: true },
      { emoji: "😭", text: "一个人乱跑到处哭喊", good: false },
      { emoji: "🤐", text: "不告诉任何人自己回家", good: false },
    ],
  },
  {
    pic: "🧒❓👨",
    desc: "在公园和爸爸妈妈走散了，应该？",
    choices: [
      { emoji: "📍", text: "站在原地等，或找穿制服的人帮忙", good: true },
      { emoji: "🚗", text: "跑到马路边拦车去找", good: false },
      { emoji: " stranger", text: "跟着陌生人走说带去找", good: false },
    ],
  },
  {
    pic: "🧒😰🎒",
    desc: "突然发现书包找不到了，第一反应是？",
    choices: [
      { emoji: "🧘", text: "不慌张，回想刚才去过哪里", good: true },
      { emoji: "😱", text: "大哭大叫把东西乱扔", good: false },
      { emoji: "🏃", text: "直接跑回家假装没丢", good: false },
    ],
  },
  {
    pic: "🧒📞📱",
    desc: "捡到一个不认识小朋友的电话手表，该？",
    choices: [
      { emoji: "🙋", text: "交给大人或警察叔叔", good: true },
      { emoji: "💸", text: "自己留着玩里面的游戏", good: false },
      { emoji: "🗑️", text: "扔到垃圾桶里", good: false },
    ],
  },
  {
    pic: "🧒🔑🏠",
    desc: "回家时发现钥匙不见了，应该？",
    choices: [
      { emoji: "📞", text: "打电话给爸爸妈妈", good: true },
      { emoji: "🔨", text: "用力砸门或爬窗户", good: false },
      { emoji: "😴", text: "蹲门口睡一觉等", good: false },
    ],
  },
  {
    pic: "🧒🧥❓",
    desc: "幼儿园放学发现外套不见了，该怎么做？",
    choices: [
      { emoji: "🔎", text: "回教室问老师一起找", good: true },
      { emoji: "😾", text: "怪同学偷了发脾气", good: false },
      { emoji: "🚪", text: "不穿就光着回家", good: false },
    ],
  },
];

export class LostFoundGame extends BaseGame {
  constructor() {
    super("lost-found");
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
    wrap.className = "lfd-wrap";

    const task = document.createElement("div");
    task.className = "lfd-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 选一个<b>安全</b>的好的做法`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "lfd-scene";
    scene.innerHTML = `<div class="lfd-pic">${sc.pic}</div><div class="lfd-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "lfd-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lfd-opt";
      b.innerHTML = `<div class="lfd-opt__icon">${c.emoji}</div><div class="lfd-opt__text">${c.text}</div>`;
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
      btn.classList.add("lfd-opt--done");
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
      btn.classList.add("lfd-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("lfd-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🔍",
      variant: "rest",
      body: "丢东西别慌：找大人帮忙、原地等、不跟陌生人走～",
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
    if (document.getElementById("lfd-style")) return;
    const st = document.createElement("style");
    st.id = "lfd-style";
    st.textContent = LFD_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function LFD_CSS(theme: string): string {
  return `
.lfd-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.lfd-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.lfd-task b{color:${theme};}
.lfd-scene{background:linear-gradient(180deg,#eef5ff,#dce8ff);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.lfd-pic{font-size:3rem;letter-spacing:4px;}
.lfd-desc{font-size:1.1rem;font-weight:800;color:#1a3a5a;margin-top:8px;}
.lfd-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.lfd-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.lfd-opt:active{transform:scale(.97);}
.lfd-opt__icon{font-size:1.8rem;flex-shrink:0;width:48px;text-align:center;font-weight:900;}
.lfd-opt__text{font-size:1.05rem;font-weight:800;color:#444;}
.lfd-opt--done{background:#d4f4dd;animation:lfd-pop .4s ease;}
.lfd-opt--wrong{background:#ffe0e0;animation:lfd-shake .4s ease;}
@keyframes lfd-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes lfd-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): LostFoundGame {
  return new LostFoundGame();
}
