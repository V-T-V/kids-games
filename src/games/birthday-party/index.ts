/* 生日派对 Birthday-Party —— 朋友过生日的派对场景，选出懂礼仪的做法
   （送祝福、不抢蛋糕、帮收玩具、守规矩）。社交启蒙：体贴 + 礼仪。
   独特点：每个场景聚焦派对上一处小细节，候选里只有一个得体。
   前缀 bdp-。 */

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
    pic: "🧒🎂🎉",
    desc: "朋友过生日吹蜡烛前，我可以说？",
    choices: [
      { emoji: "🎉", text: "祝生日快乐，健康长大", good: true },
      { emoji: "💨", text: "抢着帮他把蜡烛吹灭", good: false },
      { emoji: "🤫", text: "一言不发坐在角落", good: false },
    ],
  },
  {
    pic: "🍰🧒👶",
    desc: "切蛋糕的时候，应该怎么做？",
    choices: [
      { emoji: "🙌", text: "等主人分给我，不抢第一块", good: true },
      { emoji: "🤏", text: "伸手直接抠最大的一块", good: false },
      { emoji: "😠", text: "嫌小闹着要更多", good: false },
    ],
  },
  {
    pic: "🎁🧒👦",
    desc: "送礼物给寿星，正确的做法是？",
    choices: [
      { emoji: "🎁", text: "双手送上说生日快乐", good: true },
      { emoji: "🪧", text: "把礼物丢在地上推过去", good: false },
      { emoji: "🙋", text: "说自己送的最好最贵", good: false },
    ],
  },
  {
    pic: "🧦🧸🧒",
    desc: "派对玩完，玩具弄了一地，该怎么做？",
    choices: [
      { emoji: "🧹", text: "帮主人一起把玩具收好", good: true },
      { emoji: "🏃", text: "拍拍屁股直接回家", good: false },
      { emoji: "💥", text: "把没收的玩具再踢乱", good: false },
    ],
  },
  {
    pic: "🧒🎵💃",
    desc: "派对上大家唱歌跳舞，我应该？",
    choices: [
      { emoji: "🎶", text: "跟着一起开心玩，不推人", good: true },
      { emoji: "👊", text: "把别人推开抢中间位置", good: false },
      { emoji: "🤐", text: "捂着耳朵嫌吵", good: false },
    ],
  },
  {
    pic: "🧒🥤👧",
    desc: "朋友不小心把饮料洒在我身上，我该？",
    choices: [
      { emoji: "🤗", text: "说没关系，一起擦干净", good: true },
      { emoji: "😭", text: "大哭大闹要他赔", good: false },
      { emoji: "😾", text: "也故意把水泼他身上", good: false },
    ],
  },
];

export class BirthdayPartyGame extends BaseGame {
  constructor() {
    super("birthday-party");
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
    wrap.className = "bdp-wrap";

    const task = document.createElement("div");
    task.className = "bdp-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 选一个<b>懂礼貌</b>的好做法`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "bdp-scene";
    scene.innerHTML = `<div class="bdp-pic">${sc.pic}</div><div class="bdp-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "bdp-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bdp-opt";
      b.innerHTML = `<div class="bdp-opt__icon">${c.emoji}</div><div class="bdp-opt__text">${c.text}</div>`;
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
      btn.classList.add("bdp-opt--done");
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
      btn.classList.add("bdp-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("bdp-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🎂",
      variant: "rest",
      body: "生日派对要有礼貌：送祝福、不抢东西、玩完帮忙收拾～",
      primary: { text: "继续", icon: "🎈", onClick: () => ov.destroy() },
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
    if (document.getElementById("bdp-style")) return;
    const st = document.createElement("style");
    st.id = "bdp-style";
    st.textContent = BDP_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function BDP_CSS(theme: string): string {
  return `
.bdp-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.bdp-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.bdp-task b{color:${theme};}
.bdp-scene{background:linear-gradient(180deg,#fffbe6,#fff3b0);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.bdp-pic{font-size:3rem;letter-spacing:4px;}
.bdp-desc{font-size:1.1rem;font-weight:800;color:#5a4a1a;margin-top:8px;}
.bdp-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.bdp-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.bdp-opt:active{transform:scale(.97);}
.bdp-opt__icon{font-size:1.8rem;flex-shrink:0;width:48px;text-align:center;font-weight:900;}
.bdp-opt__text{font-size:1.05rem;font-weight:800;color:#444;}
.bdp-opt--done{background:#d4f4dd;animation:bdp-pop .4s ease;}
.bdp-opt--wrong{background:#ffe0e0;animation:bdp-shake .4s ease;}
@keyframes bdp-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes bdp-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): BirthdayPartyGame {
  return new BirthdayPartyGame();
}
