/* 解决冲突 Resolve Fight —— 两个孩子打架，选出最好的解决办法。
   社交启蒙：用沟通代替动手。独特点：冲突场景 + 多个应对方式，
   只有一个最能化解矛盾、修复关系。前缀 rsv-。 */

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
    pic: "👦👊👧🧸",
    desc: "朋友抢走了我的布娃娃，我想抢回来",
    choices: [
      { emoji: "💬", text: "说：我们一起玩好吗", good: true },
      { emoji: "👊", text: "动手打他一顿", good: false },
      { emoji: "😡", text: "把别的玩具也砸了", good: false },
    ],
  },
  {
    pic: "👧💥👦🚗",
    desc: "朋友推倒了我的小汽车",
    choices: [
      { emoji: "🗣️", text: "告诉他：你这样做我不开心", good: true },
      { emoji: "🦵", text: "也去推倒他的玩具", good: false },
      { emoji: "🤐", text: "一直憋着生闷气", good: false },
    ],
  },
  {
    pic: "🧒😤👧🎨",
    desc: "朋友画了我的画本，我很生气",
    choices: [
      { emoji: "🤝", text: "说：下次请先问问我", good: true },
      { emoji: "✂️", text: "把他的本子也画脏", good: false },
      { emoji: "🙅", text: "再也不和他玩了", good: false },
    ],
  },
  {
    pic: "👦❓👧🪀",
    desc: "两个人都说悠悠球是自己的",
    choices: [
      { emoji: "👩", text: "找大人帮忙看看是谁的", good: true },
      { emoji: "💪", text: "力气大的人就拿走", good: false },
      { emoji: "💥", text: "把悠悠球摔了谁也别要", good: false },
    ],
  },
  {
    pic: "👧😢👦🧩",
    desc: "朋友把我拼好的图弄乱了",
    choices: [
      { emoji: "🤝", text: "深呼吸，请他帮忙一起拼回去", good: true },
      { emoji: "👊", text: "推他一把", good: false },
      { emoji: "😭", text: "坐在地上大哭大叫", good: false },
    ],
  },
  {
    pic: "🧒👊👦🍪",
    desc: "朋友非要抢我的最后一块饼干",
    choices: [
      { emoji: "🍪", text: "说：我可以分一半给你", good: true },
      { emoji: "🦵", text: "踢他一脚", good: false },
      { emoji: "🛑", text: "骂他是坏孩子", good: false },
    ],
  },
];

export class ResolveFightGame extends BaseGame {
  constructor() {
    super("resolve-fight");
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
    wrap.className = "rsv-wrap";

    const task = document.createElement("div");
    task.className = "rsv-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 选一个<b>最好</b>的解决办法`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "rsv-scene";
    scene.innerHTML = `<div class="rsv-pic">${sc.pic}</div><div class="rsv-desc">${sc.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "rsv-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rsv-opt";
      b.innerHTML = `<div class="rsv-opt__icon">${c.emoji}</div><div class="rsv-opt__text">${c.text}</div>`;
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
      btn.classList.add("rsv-opt--done");
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
      btn.classList.add("rsv-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("rsv-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🕊️",
      variant: "rest",
      body: "打架和生气都不能解决问题，说出来、找大人帮忙，才是最好的办法～",
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
    if (document.getElementById("rsv-style")) return;
    const st = document.createElement("style");
    st.id = "rsv-style";
    st.textContent = RSV_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function RSV_CSS(theme: string): string {
  return `
.rsv-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.rsv-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.rsv-task b{color:${theme};}
.rsv-scene{background:linear-gradient(180deg,#fff0f0,#ffe4e4);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.rsv-pic{font-size:2.6rem;letter-spacing:4px;}
.rsv-desc{font-size:1.1rem;font-weight:800;color:#5a3a3a;margin-top:8px;}
.rsv-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.rsv-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.rsv-opt:active{transform:scale(.97);}
.rsv-opt__icon{font-size:1.8rem;flex-shrink:0;width:48px;text-align:center;}
.rsv-opt__text{font-size:1.05rem;font-weight:800;color:#444;}
.rsv-opt--done{background:#d4f4dd;animation:rsv-pop .4s ease;}
.rsv-opt--wrong{background:#ffd0d0;animation:rsv-shake .4s ease;}
@keyframes rsv-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes rsv-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ResolveFightGame {
  return new ResolveFightGame();
}
