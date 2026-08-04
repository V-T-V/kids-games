/* 四季配对 Seasons Match —— 给一个季节特征句（如"树叶黄了飘下来"），
   从春夏秋冬 4 个选项选出对应季节。
   认知启蒙：3-4 岁友好，培养对四季自然现象的观察与归类。前缀 smh-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

type Season = "春" | "夏" | "秋" | "冬";

interface SeasonOption {
  emoji: string;
  name: Season;
}

const SEASONS: SeasonOption[] = [
  { emoji: "🌸", name: "春" },
  { emoji: "☀️", name: "夏" },
  { emoji: "🍂", name: "秋" },
  { emoji: "❄️", name: "冬" },
];

interface Feature {
  /** 季节特征句 */
  text: string;
  /** 配套小图 emoji */
  emoji: string;
  season: Season;
}

const FEATURES: Feature[] = [
  // 春
  { text: "小草发芽了，花儿开了", emoji: "🌱", season: "春" },
  { text: "燕子飞回来了", emoji: "🐦", season: "春" },
  { text: "下着暖暖的小雨", emoji: "🌧️", season: "春" },
  { text: "桃树开满了粉色的花", emoji: "🌸", season: "春" },
  // 夏
  { text: "太阳火辣辣，热得想吃冰", emoji: "🍦", season: "夏" },
  { text: "知了在树上叫个不停", emoji: "🦗", season: "夏" },
  { text: "可以去海边游泳啦", emoji: "🌊", season: "夏" },
  { text: "荷花开在池塘里", emoji: "🪷", season: "夏" },
  // 秋
  { text: "树叶黄了，飘了下来", emoji: "🍁", season: "秋" },
  { text: "苹果熟了，可以摘啦", emoji: "🍎", season: "秋" },
  { text: "稻谷金黄金黄的", emoji: "🌾", season: "秋" },
  { text: "天变凉了，要穿外套", emoji: "🧥", season: "秋" },
  // 冬
  { text: "下雪啦，可以堆雪人", emoji: "⛄", season: "冬" },
  { text: "小手冷冰冰的，要戴手套", emoji: "🧤", season: "冬" },
  { text: "树枝光秃秃的，没有叶子", emoji: "🪵", season: "冬" },
  { text: "呼出的气变成白雾", emoji: "💨", season: "冬" },
];

export class SeasonsMatchGame extends BaseGame {
  constructor() {
    super("seasons-match");
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
    const f = sample(FEATURES);
    const choices = shuffle(SEASONS);

    const wrap = document.createElement("div");
    wrap.className = "smh-wrap";

    const task = document.createElement("div");
    task.className = "smh-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 这是<b>哪个季节</b>呀？`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "smh-scene";
    scene.innerHTML = `<div class="smh-pic">${f.emoji}</div><div class="smh-desc">${f.text}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "smh-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "smh-opt";
      b.innerHTML = `<div class="smh-opt__icon">${c.emoji}</div><div class="smh-opt__name">${c.name}天</div>`;
      b.addEventListener("click", () => this.choose(c.name, f.season, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(picked: Season, answer: Season, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (picked === answer) {
      this.locked = true;
      sfxPop();
      btn.classList.add("smh-opt--done");
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
      btn.classList.add("smh-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("smh-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🍂",
      variant: "rest",
      body: "看看图里的小动物、天气和衣服，想想这是春天、夏天、秋天还是冬天～",
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
    if (document.getElementById("smh-style")) return;
    const st = document.createElement("style");
    st.id = "smh-style";
    st.textContent = SMH_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function SMH_CSS(theme: string): string {
  return `
.smh-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.smh-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.smh-task b{color:${theme};}
.smh-scene{background:linear-gradient(180deg,#fff6e6,#ffe9c4);padding:24px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.smh-pic{font-size:3.4rem;letter-spacing:4px;}
.smh-desc{font-size:1.15rem;font-weight:800;color:#8a5a1a;margin-top:10px;}
.smh-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;width:100%;max-width:420px;}
.smh-opt{display:flex;flex-direction:column;align-items:center;gap:6px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:16px 12px;cursor:pointer;transition:transform .12s;min-height:88px;justify-content:center;}
.smh-opt:active{transform:scale(.96);}
.smh-opt__icon{font-size:2.4rem;line-height:1;}
.smh-opt__name{font-size:1.15rem;font-weight:800;color:#444;}
.smh-opt--done{background:#d4f4dd;outline:4px solid #34c759;animation:smh-pop .4s ease;}
.smh-opt--wrong{background:#ffe0e0;animation:smh-shake .4s ease;}
@keyframes smh-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes smh-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): SeasonsMatchGame {
  return new SeasonsMatchGame();
}
