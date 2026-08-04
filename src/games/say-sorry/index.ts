/* 道歉练习 Say Sorry —— 做错事后选出正确的道歉方式（说对不起 / 帮忙修好）。
   社交启蒙：承担责任 + 弥补过错。独特点：每题一个"不小心"的小事故，
   候选做法里只有一个是真正负责任的道歉。前缀 sry-。 */

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
    pic: "🧒💥🧸",
    desc: "我不小心把朋友的布娃娃摔到地上了",
    choices: [
      { emoji: "🙇", text: "说对不起，再帮忙看看坏没坏", good: true },
      { emoji: "🏃", text: "假装没看见跑掉", good: false },
      { emoji: "👉", text: "说是朋友的错", good: false },
    ],
  },
  {
    pic: "🧒💧🎨",
    desc: "我不小心把水洒在朋友的画上了",
    choices: [
      { emoji: "🙏", text: "道歉并帮忙重新画一张", good: true },
      { emoji: "😤", text: "说画本来就不好看", good: false },
      { emoji: "🤐", text: "什么都不说", good: false },
    ],
  },
  {
    pic: "🧒🦶👦",
    desc: "跑步时不小心踩到别人的脚",
    choices: [
      { emoji: "Sorry", text: "停下来说对不起问没事吧", good: true },
      { emoji: "💨", text: "继续往前跑", good: false },
      { emoji: "😂", text: "哈哈笑对方", good: false },
    ],
  },
  {
    pic: "🧒🥛📚",
    desc: "我不小心把朋友的绘本弄破了",
    choices: [
      { emoji: "🩹", text: "道歉并帮忙用胶带粘好", good: true },
      { emoji: "🙈", text: "把书藏起来", good: false },
      { emoji: "🤷", text: "说本来就是破的", good: false },
    ],
  },
  {
    pic: "🧒🧱🏗️",
    desc: "我不小心碰倒了朋友搭的积木塔",
    choices: [
      { emoji: "🤝", text: "道歉并一起重新搭", good: true },
      { emoji: "👋", text: "把剩下的也推倒", good: false },
      { emoji: "🏃", text: "赶紧躲起来", good: false },
    ],
  },
  {
    pic: "🧒🍪👧",
    desc: "我不小心吃了朋友的小饼干",
    choices: [
      { emoji: "🍪", text: "道歉并把自己的分给她", good: true },
      { emoji: "🙃", text: "说反正我也不馋了", good: false },
      { emoji: "🛑", text: "不承认是我吃的", good: false },
    ],
  },
];

export class SaySorryGame extends BaseGame {
  constructor() {
    super("say-sorry");
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
    wrap.className = "sry-wrap";

    const task = document.createElement("div");
    task.className = "sry-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 选一个<b>有担当</b>的道歉方式`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "sry-scene";
    scene.innerHTML = `<div class="sry-pic">${sc.pic}</div><div class="sry-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "sry-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sry-opt";
      b.innerHTML = `<div class="sry-opt__icon">${c.emoji}</div><div class="sry-opt__text">${c.text}</div>`;
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
      btn.classList.add("sry-opt--done");
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
      btn.classList.add("sry-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("sry-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🙇",
      variant: "rest",
      body: "做错事不可怕，说声对不起，再想办法帮着修好，才是勇敢的孩子～",
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
    if (document.getElementById("sry-style")) return;
    const st = document.createElement("style");
    st.id = "sry-style";
    st.textContent = SRY_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function SRY_CSS(theme: string): string {
  return `
.sry-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.sry-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.sry-task b{color:${theme};}
.sry-scene{background:linear-gradient(180deg,#f7f0ff,#efe4ff);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.sry-pic{font-size:3rem;letter-spacing:4px;}
.sry-desc{font-size:1.1rem;font-weight:800;color:#4a3a5a;margin-top:8px;}
.sry-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.sry-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.sry-opt:active{transform:scale(.97);}
.sry-opt__icon{font-size:1.8rem;flex-shrink:0;width:48px;text-align:center;font-weight:900;}
.sry-opt__text{font-size:1.05rem;font-weight:800;color:#444;}
.sry-opt--done{background:#d4f4dd;animation:sry-pop .4s ease;}
.sry-opt--wrong{background:#ffe0e0;animation:sry-shake .4s ease;}
@keyframes sry-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes sry-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): SaySorryGame {
  return new SaySorryGame();
}
