/* 情绪调节 Emotion-Regulate —— 给情境选择好的应对方式（社会情感·情绪调节）。
   独特点：情境→应对策略的评估（区别于 emotion 的"情境→情绪识别"，
           这里训练的是"识别情绪后如何恰当处理"，情绪调节策略是情商核心）。
   巧思：大表情 emoji 呈现情绪，好/坏应对成对出现，答对给出鼓励语。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Option {
  text: string;
  icon: string;
}

interface Situation {
  /** 情绪 emoji */
  face: string;
  /** 情境描述 */
  desc: string;
  /** 情绪词 */
  feeling: string;
  /** 好的应对 */
  good: Option;
  /** 不好的应对（干扰） */
  bad: Option;
}

const SITUATIONS: Situation[] = [
  {
    face: "😡",
    desc: "积木塔倒了，好生气！",
    feeling: "生气",
    good: { text: "深呼吸再来", icon: "🌬️" },
    bad: { text: "把积木乱扔", icon: "💢" },
  },
  {
    face: "😢",
    desc: "心爱的玩具坏了，好难过",
    feeling: "难过",
    good: { text: "告诉妈妈", icon: "🤱" },
    bad: { text: "一个人偷偷哭", icon: "😭" },
  },
  {
    face: "😨",
    desc: "晚上一个人好害怕",
    feeling: "害怕",
    good: { text: "抱紧小熊", icon: "🧸" },
    bad: { text: "躲进柜子里", icon: "🚪" },
  },
  {
    face: "😠",
    desc: "朋友抢了我的画笔",
    feeling: "生气",
    good: { text: "好好说还给我", icon: "🗣️" },
    bad: { text: "动手打他", icon: "✊" },
  },
  {
    face: "😣",
    desc: "摔倒了膝盖好疼",
    feeling: "疼痛",
    good: { text: "找大人帮忙", icon: "🙋" },
    bad: { text: "忍着不说话", icon: "🤐" },
  },
  {
    face: "😤",
    desc: "拼图拼了好久还没拼好",
    feeling: "着急",
    good: { text: "休息一下再试", icon: "🎈" },
    bad: { text: "把拼图撕掉", icon: "撕" },
  },
  {
    face: "😟",
    desc: "明天要去新幼儿园好紧张",
    feeling: "紧张",
    good: { text: "和爸爸妈妈聊聊", icon: "💬" },
    bad: { text: "躲起来不上学", icon: "🙈" },
  },
  {
    face: "😠",
    desc: "弟弟弄坏了我的书",
    feeling: "生气",
    good: { text: "教他以后小心", icon: "📖" },
    bad: { text: "也弄坏他的东西", icon: "🔨" },
  },
  {
    face: "😢",
    desc: "好朋友搬家走了",
    feeling: "想念",
    good: { text: "画画送给他", icon: "🎨" },
    bad: { text: "再也不交朋友了", icon: "💔" },
  },
  {
    face: "😣",
    desc: "想吃糖可是吃晚饭前",
    feeling: "嘴馋",
    good: { text: "吃完饭再吃", icon: "🍚" },
    bad: { text: "偷偷把饭倒掉", icon: "🚮" },
  },
  {
    face: "😫",
    desc: "玩具到处都是不想收",
    feeling: "不想动",
    good: { text: "一样一样收起来", icon: "🧹" },
    bad: { text: "一脚全踢到床下", icon: "🦶" },
  },
  {
    face: "😨",
    desc: "听见打雷好大声",
    feeling: "害怕",
    good: { text: "抱抱小熊", icon: "🧸" },
    bad: { text: "捂住耳朵尖叫", icon: "😱" },
  },
];

export class EmotionRegulateGame extends BaseGame {
  constructor() {
    super("emotion-regulate");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const sit = sample(SITUATIONS);
    const choices = shuffle([sit.good, sit.bad]);

    const wrap = document.createElement("div");
    wrap.className = "erg-wrap";

    const task = document.createElement("div");
    task.className = "erg-task";
    task.textContent = "遇到这样的事，怎么做更好？";
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "erg-scene";
    scene.innerHTML = `<div class="erg-face">${sit.face}</div><div class="erg-desc">${sit.desc}</div><div class="erg-feeling">心情：${sit.feeling}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "erg-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "erg-opt";
      b.innerHTML = `<span class="erg-opt__icon">${c.icon}</span><span class="erg-opt__txt">${c.text}</span>`;
      b.addEventListener("click", () => this.choose(c === sit.good, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(isGood: boolean, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (isGood) {
      this.answered = true;
      sfxPop();
      btn.classList.add("erg-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("erg-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("erg-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想哪个办法对自己更好～",
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
    if (document.getElementById("erg-style")) return;
    const st = document.createElement("style");
    st.id = "erg-style";
    st.textContent = ERG_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function ERG_CSS(theme: string): string {
  return `
.erg-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.erg-task{font-size:1.15rem;font-weight:800;background:#fff;padding:8px 22px;border-radius:999px;box-shadow:var(--shadow);}
.erg-scene{background:#fff;padding:20px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:min(380px,92%);}
.erg-face{font-size:4.5rem;line-height:1;}
.erg-desc{font-size:1.15rem;font-weight:800;margin-top:10px;color:var(--ink);}
.erg-feeling{font-size:.95rem;font-weight:700;margin-top:6px;color:${theme};}
.erg-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;width:min(440px,100%);}
.erg-opt{min-height:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:14px 10px;transition:transform .12s ease;}
.erg-opt:active{transform:scale(.93);}
.erg-opt__icon{font-size:2.4rem;}
.erg-opt__txt{font-size:1rem;font-weight:800;color:var(--ink);text-align:center;line-height:1.3;}
.erg-opt--done{background:#d4f4dd;outline:4px solid #34c759;animation:erg-pop .4s ease;}
.erg-opt--wrong{animation:erg-shake .4s ease;}
@keyframes erg-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes erg-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): EmotionRegulateGame {
  return new EmotionRegulateGame();
}
