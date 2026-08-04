/* 约朋友玩 Play-Date —— 约好朋友一起玩的场景，选出正确的做法
   （提前问大人、带玩具分享、按时到、有礼貌）。社交启蒙：尊重 + 友善。
   独特点：每个场景都是孩子真实的社交小困境，候选里只有一个是得体的。
   前缀 pld-。 */

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
    pic: "🧒📞🏠",
    desc: "我想去小明家玩，应该先做什么？",
    choices: [
      { emoji: "🙋", text: "先问爸爸妈妈，再问小明家方不方便", good: true },
      { emoji: "🏃", text: "自己偷偷跑过去敲门", good: false },
      { emoji: "🚪", text: "不告诉任何人直接进门", good: false },
    ],
  },
  {
    pic: "🧒🧸👦",
    desc: "去朋友家玩，可以怎么做更好？",
    choices: [
      { emoji: "🎁", text: "带一个自己的玩具，和好朋友一起分享", good: true },
      { emoji: "😤", text: "把朋友的玩具全抢过来玩", good: false },
      { emoji: "🙅", text: "什么都不带也不肯分享", good: false },
    ],
  },
  {
    pic: "⏰🧒🏠",
    desc: "约好了三点去朋友家，现在应该？",
    choices: [
      { emoji: "✅", text: "按时到达，不迟到", good: true },
      { emoji: "🎈", text: "想几点去就几点去", good: false },
      { emoji: "🎮", text: "玩得忘了时间很晚才去", good: false },
    ],
  },
  {
    pic: "🧒🍪👧",
    desc: "朋友拿出小饼干招待我，我该？",
    choices: [
      { emoji: "🙏", text: "说谢谢，再一起吃", good: true },
      { emoji: "🤏", text: "把所有饼干都装进口袋带走", good: false },
      { emoji: "😾", text: "说不好吃推开", good: false },
    ],
  },
  {
    pic: "🧒🚪👋",
    desc: "到朋友家第一件事，应该怎么做？",
    choices: [
      { emoji: "🚪", text: "先敲门，等大人开门问好", good: true },
      { emoji: "📢", text: "用力拍门大声喊", good: false },
      { emoji: "🔑", text: "自己推门闯进去", good: false },
    ],
  },
  {
    pic: "🧒👋🏠",
    desc: "玩完要回家时，应该怎么做？",
    choices: [
      { emoji: "👋", text: "说谢谢招待，再见", good: true },
      { emoji: "🏃", text: "一句话不说直接跑走", good: false },
      { emoji: "😣", text: "赖着不肯走闹脾气", good: false },
    ],
  },
];

export class PlayDateGame extends BaseGame {
  constructor() {
    super("play-date");
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
    wrap.className = "pld-wrap";

    const task = document.createElement("div");
    task.className = "pld-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 选一个<b>有礼貌</b>的好的做法`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "pld-scene";
    scene.innerHTML = `<div class="pld-pic">${sc.pic}</div><div class="pld-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "pld-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pld-opt";
      b.innerHTML = `<div class="pld-opt__icon">${c.emoji}</div><div class="pld-opt__text">${c.text}</div>`;
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
      btn.classList.add("pld-opt--done");
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
      btn.classList.add("pld-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("pld-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "👫",
      variant: "rest",
      body: "约朋友玩要有礼貌：先问大人、按时到、记得说谢谢～",
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
    if (document.getElementById("pld-style")) return;
    const st = document.createElement("style");
    st.id = "pld-style";
    st.textContent = PLD_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function PLD_CSS(theme: string): string {
  return `
.pld-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.pld-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.pld-task b{color:${theme};}
.pld-scene{background:linear-gradient(180deg,#fff0f6,#ffe4ee);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.pld-pic{font-size:3rem;letter-spacing:4px;}
.pld-desc{font-size:1.1rem;font-weight:800;color:#5a3a4a;margin-top:8px;}
.pld-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.pld-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.pld-opt:active{transform:scale(.97);}
.pld-opt__icon{font-size:1.8rem;flex-shrink:0;width:48px;text-align:center;font-weight:900;}
.pld-opt__text{font-size:1.05rem;font-weight:800;color:#444;}
.pld-opt--done{background:#d4f4dd;animation:pld-pop .4s ease;}
.pld-opt--wrong{background:#ffe0e0;animation:pld-shake .4s ease;}
@keyframes pld-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes pld-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): PlayDateGame {
  return new PlayDateGame();
}
