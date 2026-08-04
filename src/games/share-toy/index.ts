/* 分享玩具 Share Toy —— 两个孩子抢一个玩具，选出最好的做法（轮流玩/分享）。
   社交启蒙：在冲突场景里选对友好的解决方式。独特点：场景图 + 多个候选做法，
   只有一个真正能让大家都开心。前缀 shr-。 */

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
  /** 场景图（emoji 组合） */
  pic: string;
  /** 场景描述 */
  desc: string;
  /** 候选做法 */
  choices: Choice[];
}

const SCENES: Scene[] = [
  {
    pic: "🧒🧸👧",
    desc: "两个人都想玩同一个布娃娃",
    choices: [
      { emoji: "🔄", text: "轮流玩，一人玩一会儿", good: true },
      { emoji: "😠", text: "用力抢过来自己玩", good: false },
      { emoji: "😢", text: "一直哭不让别人碰", good: false },
    ],
  },
  {
    pic: "🚗👦👧",
    desc: "只有一辆小汽车，两个人都想要",
    choices: [
      { emoji: "🤝", text: "一起推着小车玩", good: true },
      { emoji: "👊", text: "打人抢走小车", good: false },
      { emoji: "🤐", text: "生气地躲到角落", good: false },
    ],
  },
  {
    pic: "🎨🧒👧",
    desc: "只有一盒水彩笔，大家都想画画",
    choices: [
      { emoji: "🖍️", text: "分几支笔给好朋友", good: true },
      { emoji: "🙅", text: "全部抱走不给别人", good: false },
      { emoji: "💢", text: "把笔扔到地上", good: false },
    ],
  },
  {
    pic: "🪀👦👧",
    desc: "一个悠悠球，两个人都想先玩",
    choices: [
      { emoji: "⏳", text: "数到十交换玩", good: true },
      { emoji: "🦵", text: "绊倒对方抢走", good: false },
      { emoji: "😭", text: "坐在地上大哭", good: false },
    ],
  },
  {
    pic: "📚🧒👦",
    desc: "一本好看的绘本，两人都想看",
    choices: [
      { emoji: "📖", text: "一起坐下来翻着看", good: true },
      { emoji: "撕", text: "把书撕成两半", good: false },
      { emoji: "🏃", text: "抱着书跑掉", good: false },
    ],
  },
  {
    pic: "🧩👧🧒",
    desc: "一盒拼图，大家都想拼",
    choices: [
      { emoji: "🧩", text: "一人拼一半一起完成", good: true },
      { emoji: "🛑", text: "把对方的拼图藏起来", good: false },
      { emoji: "🙊", text: "不说话把图全抢走", good: false },
    ],
  },
];

export class ShareToyGame extends BaseGame {
  constructor() {
    super("share-toy");
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
    wrap.className = "shr-wrap";

    const task = document.createElement("div");
    task.className = "shr-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 选一个<b>好朋友</b>都会开心的做法`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "shr-scene";
    scene.innerHTML = `<div class="shr-pic">${sc.pic}</div><div class="shr-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "shr-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "shr-opt";
      b.innerHTML = `<div class="shr-opt__icon">${c.emoji}</div><div class="shr-opt__text">${c.text}</div>`;
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
      btn.classList.add("shr-opt--done");
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
      btn.classList.add("shr-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("shr-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🤝",
      variant: "rest",
      body: "好朋友会怎么做呢？让大家都能开心的办法才是好办法～",
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
    if (document.getElementById("shr-style")) return;
    const st = document.createElement("style");
    st.id = "shr-style";
    st.textContent = SHR_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function SHR_CSS(theme: string): string {
  return `
.shr-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.shr-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.shr-task b{color:${theme};}
.shr-scene{background:linear-gradient(180deg,#fff5f8,#ffeef4);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.shr-pic{font-size:3.4rem;letter-spacing:6px;}
.shr-desc{font-size:1.15rem;font-weight:800;color:#5a4555;margin-top:8px;}
.shr-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.shr-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.shr-opt:active{transform:scale(.97);}
.shr-opt__icon{font-size:2.2rem;flex-shrink:0;width:48px;text-align:center;}
.shr-opt__text{font-size:1.05rem;font-weight:800;color:#444;}
.shr-opt--done{background:#d4f4dd;animation:shr-pop .4s ease;}
.shr-opt--wrong{background:#ffe0e0;animation:shr-shake .4s ease;}
@keyframes shr-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes shr-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ShareToyGame {
  return new ShareToyGame();
}
