/* 打招呼 Greeting —— 不同场景选出正确的问候语（早上好/再见/谢谢）。
   社交启蒙：根据场合挑对礼貌用语。独特点：场景图 + 候选问候语，
   只有一句最贴切。前缀 grt-。 */

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
    pic: "🌅👦",
    desc: "早上起床看见妈妈",
    choices: [
      { emoji: "🌅", text: "早上好！", good: true },
      { emoji: "👋", text: "再见！", good: false },
      { emoji: "🙏", text: "谢谢！", good: false },
    ],
  },
  {
    pic: "🚪🧒👋",
    desc: "放学了要离开老师",
    choices: [
      { emoji: "👋", text: "老师再见！", good: true },
      { emoji: "🙏", text: "谢谢！", good: false },
      { emoji: "😴", text: "晚安！", good: false },
    ],
  },
  {
    pic: "🎁👧🙏",
    desc: "朋友送了一个小礼物给你",
    choices: [
      { emoji: "🙏", text: "谢谢你！", good: true },
      { emoji: "👋", text: "再见！", good: false },
      { emoji: "🌅", text: "早上好！", good: false },
    ],
  },
  {
    pic: "🌙🧒🛏️",
    desc: "晚上要睡觉了和爸爸妈妈",
    choices: [
      { emoji: "🌙", text: "晚安！", good: true },
      { emoji: "🌅", text: "早上好！", good: false },
      { emoji: "🙏", text: "谢谢！", good: false },
    ],
  },
  {
    pic: "🍚👦🙏",
    desc: "阿姨给你盛好饭",
    choices: [
      { emoji: "🙏", text: "谢谢阿姨！", good: true },
      { emoji: "👋", text: "再见！", good: false },
      { emoji: "🌙", text: "晚安！", good: false },
    ],
  },
  {
    pic: "👋🧒👨",
    desc: "新朋友刚认识你",
    choices: [
      { emoji: "🤝", text: "你好呀！", good: true },
      { emoji: "🌙", text: "晚安！", good: false },
      { emoji: "🙏", text: "谢谢！", good: false },
    ],
  },
  {
    pic: "🏥🧒👋",
    desc: "看完了医生要走了",
    choices: [
      { emoji: "👋", text: "医生再见，谢谢！", good: true },
      { emoji: "🌅", text: "早上好！", good: false },
      { emoji: "😴", text: "晚安！", good: false },
    ],
  },
];

export class GreetingGame extends BaseGame {
  constructor() {
    super("greeting");
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
    wrap.className = "grt-wrap";

    const task = document.createElement("div");
    task.className = "grt-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 这时候该说<b>什么</b>呢？`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "grt-scene";
    scene.innerHTML = `<div class="grt-pic">${sc.pic}</div><div class="grt-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "grt-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "grt-opt";
      b.innerHTML = `<div class="grt-opt__icon">${c.emoji}</div><div class="grt-opt__text">${c.text}</div>`;
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
      btn.classList.add("grt-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("grt-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("grt-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "💬",
      variant: "rest",
      body: "看看图片的时间和地方，想想这时候最该说哪句话～",
      primary: { text: "继续", icon: "😊", onClick: () => ov.destroy() },
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
    if (document.getElementById("grt-style")) return;
    const st = document.createElement("style");
    st.id = "grt-style";
    st.textContent = GRT_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function GRT_CSS(theme: string): string {
  return `
.grt-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.grt-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.grt-task b{color:${theme};}
.grt-scene{background:linear-gradient(180deg,#fffbe6,#fff3c4);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.grt-pic{font-size:3rem;letter-spacing:4px;}
.grt-desc{font-size:1.1rem;font-weight:800;color:#6a5a2a;margin-top:8px;}
.grt-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.grt-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.grt-opt:active{transform:scale(.97);}
.grt-opt__icon{font-size:1.8rem;flex-shrink:0;width:48px;text-align:center;}
.grt-opt__text{font-size:1.1rem;font-weight:800;color:#444;}
.grt-opt--done{background:#d4f4dd;animation:grt-pop .4s ease;}
.grt-opt--wrong{background:#ffe0e0;animation:grt-shake .4s ease;}
@keyframes grt-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes grt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): GreetingGame {
  return new GreetingGame();
}
