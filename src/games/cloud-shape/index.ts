/* 云朵想象 Cloud Shape —— 看天上一朵云，猜它最像什么。
   独特点：开放性想象力训练 + 形状联想。每朵云用 emoji + 文字提示，
   孩子从选项图卡中挑出它最像的东西。创造性认知。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Cloud {
  /** 云的 CSS 变形样式 id（不同形状） */
  shape: string;
  /** 正确答案的 emoji */
  answer: string;
  /** 正确答案的名字 */
  name: string;
  /** 干扰选项 */
  options: { emoji: string; name: string }[];
}

const BANK: Cloud[] = [
  {
    shape: "sheep",
    answer: "🐑",
    name: "绵羊",
    options: [
      { emoji: "🐑", name: "绵羊" },
      { emoji: "🚗", name: "汽车" },
      { emoji: "🍎", name: "苹果" },
      { emoji: "🏠", name: "房子" },
    ],
  },
  {
    shape: "candy",
    answer: "🍬",
    name: "糖果",
    options: [
      { emoji: "🍬", name: "糖果" },
      { emoji: "🌳", name: "大树" },
      { emoji: "🐟", name: "小鱼" },
      { emoji: "🎈", name: "气球" },
    ],
  },
  {
    shape: "fish",
    answer: "🐟",
    name: "小鱼",
    options: [
      { emoji: "🐟", name: "小鱼" },
      { emoji: "☁️", name: "云" },
      { emoji: "🚀", name: "火箭" },
      { emoji: "🌻", name: "向日葵" },
    ],
  },
  {
    shape: "rabbit",
    answer: "🐰",
    name: "兔子",
    options: [
      { emoji: "🐰", name: "兔子" },
      { emoji: "🍌", name: "香蕉" },
      { emoji: "🦴", name: "骨头" },
      { emoji: "⚽", name: "皮球" },
    ],
  },
  {
    shape: "heart",
    answer: "❤️",
    name: "爱心",
    options: [
      { emoji: "❤️", name: "爱心" },
      { emoji: "⭐", name: "星星" },
      { emoji: "🌙", name: "月亮" },
      { emoji: "🚲", name: "自行车" },
    ],
  },
  {
    shape: "tree",
    answer: "🌳",
    name: "大树",
    options: [
      { emoji: "🌳", name: "大树" },
      { emoji: "🍦", name: "冰淇淋" },
      { emoji: "🦋", name: "蝴蝶" },
      { emoji: "🐳", name: "鲸鱼" },
    ],
  },
];

export class CloudShapeGame extends BaseGame {
  constructor() {
    super("cloud-shape");
  }

  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private optionCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const cloud = sample(BANK);
    const need = this.optionCount();
    // 保证正确选项在内
    const correct = cloud.options.find((o) => o.emoji === cloud.answer)!;
    const distractors = shuffle(
      cloud.options.filter((o) => o.emoji !== cloud.answer),
    ).slice(0, need - 1);
    const opts = shuffle([correct, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "csh-wrap";

    const task = document.createElement("div");
    task.className = "csh-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 这朵云像什么呢？`;
    wrap.appendChild(task);

    // 云朵舞台
    const stage = document.createElement("div");
    stage.className = "csh-stage";
    const cloudEl = document.createElement("div");
    cloudEl.className = `csh-cloud csh-cloud--${cloud.shape}`;
    cloudEl.innerHTML = `<span class="csh-cloud-emoji">☁️</span>`;
    stage.appendChild(cloudEl);
    wrap.appendChild(stage);

    // 选项
    const optsRow = document.createElement("div");
    optsRow.className = "csh-options";
    opts.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "csh-option";
      b.innerHTML = `<span class="csh-option-emoji">${o.emoji}</span><span class="csh-option-name">${o.name}</span>`;
      b.addEventListener("click", () =>
        this.pick(b, o.emoji === cloud.answer, cloudEl),
      );
      optsRow.appendChild(b);
    });
    wrap.appendChild(optsRow);

    this.root.appendChild(wrap);
  }

  private pick(
    btn: HTMLButtonElement,
    correct: boolean,
    cloudEl: HTMLElement,
  ): void {
    if (btn.classList.contains("csh-option--used")) return;
    if (correct) {
      btn.classList.add("csh-option--correct");
      btn.classList.add("csh-option--used");
      sfxPop();
      cloudEl.classList.add("csh-cloud--happy");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("csh-option--wrong");
      this.trackTimeout(() => btn.classList.remove("csh-option--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想这朵云圆圆的、软软的，最像哪个小动物或东西呢～",
      primary: { text: "继续", icon: "☁️", onClick: () => ov.destroy() },
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
    if (document.getElementById("csh-style")) return;
    const st = document.createElement("style");
    st.id = "csh-style";
    st.textContent = CSH_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function CSH_CSS(theme: string): string {
  return `
.csh-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.csh-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);border-bottom:4px solid ${theme};}
.csh-stage{position:relative;width:100%;height:280px;border-radius:24px;background:linear-gradient(180deg,#bfeaff 0%,#e8f7ff 60%,#fff 100%);box-shadow:var(--shadow);overflow:hidden;display:flex;align-items:center;justify-content:center;}
.csh-cloud{position:relative;width:200px;height:140px;animation:csh-float 6s ease-in-out infinite;}
.csh-cloud-emoji{position:absolute;font-size:9rem;line-height:1;filter:drop-shadow(0 8px 12px rgba(0,0,0,.15));}
@keyframes csh-float{0%,100%{transform:translateY(0) translateX(0)}50%{transform:translateY(-10px) translateX(8px)}}
.csh-cloud--happy{animation:csh-happy .8s ease;}
@keyframes csh-happy{0%,100%{transform:scale(1)}50%{transform:scale(1.15) rotate(5deg)}}
/* 不同云形状的变形 */
.csh-cloud--sheep .csh-cloud-emoji{transform:scaleX(1.1);}
.csh-cloud--candy .csh-cloud-emoji{transform:scale(.9) rotate(15deg);}
.csh-cloud--fish .csh-cloud-emoji{transform:scaleX(1.3) scaleY(.7);}
.csh-cloud--rabbit .csh-cloud-emoji{transform:scaleY(1.2);}
.csh-cloud--heart .csh-cloud-emoji{transform:scale(1) rotate(-10deg);}
.csh-cloud--tree .csh-cloud-emoji{transform:scale(1.1) scaleY(1.2);}
.csh-options{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
.csh-option{width:108px;height:124px;border:none;border-radius:18px;cursor:pointer;background:linear-gradient(180deg,#fff,#f3f5fa);box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;transition:transform .12s;}
.csh-option:active{transform:scale(.94);}
.csh-option-emoji{font-size:2.8rem;line-height:1;}
.csh-option-name{font-size:.95rem;font-weight:800;color:var(--ink);}
.csh-option--correct{background:linear-gradient(180deg,#b7f3bf,#6bcf7f)!important;animation:csh-pop .5s ease;}
.csh-option--wrong{background:linear-gradient(180deg,#ffd2c8,#ff9f8a)!important;animation:csh-shake .4s ease;}
.csh-option--used{pointer-events:none;}
@keyframes csh-pop{0%{transform:scale(1)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes csh-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.csh-stage{height:220px;}.csh-cloud-emoji{font-size:7rem;}.csh-option{width:88px;height:108px;}.csh-option-emoji{font-size:2.2rem;}}
`;
}

export function create(): CloudShapeGame {
  return new CloudShapeGame();
}
