/* 因果推理 Cause-Effect —— 给"原因"预测"结果"，或反过来（因果逻辑思维）。
   独特点：因果链理解（区别于 before-after 的"时间先后排序"，
           这里训练的是"为什么会产生这个结果"的因果推导，海马体+前额叶）。
   巧思：每对因果可双向出题（正向预测结果 / 逆向推测原因），
         干扰项是看似合理但错误的选项，难度=因果链复杂度。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface CausePair {
  /** 原因 */
  cause: { emoji: string; text: string };
  /** 正确结果 */
  effect: { emoji: string; text: string };
  /** 干扰结果 */
  distract: { emoji: string; text: string };
}

const PAIRS: CausePair[] = [
  {
    cause: { emoji: "☀️🧊", text: "把冰块放太阳下" },
    effect: { emoji: "💧", text: "化成水" },
    distract: { emoji: "🔺", text: "变得更大" },
  },
  {
    cause: { emoji: "🌱💧", text: "给种子浇水" },
    effect: { emoji: "🌿", text: "发芽长大" },
    distract: { emoji: "🥀", text: "枯萎了" },
  },
  {
    cause: { emoji: "☁️☁️", text: "天上出现乌云" },
    effect: { emoji: "🌧️", text: "下起雨来" },
    distract: { emoji: "☀️", text: "出大太阳" },
  },
  {
    cause: { emoji: "🌙", text: "天黑了" },
    effect: { emoji: "💡", text: "要开灯" },
    distract: { emoji: "💤", text: "立刻睡着" },
  },
  {
    cause: { emoji: "🚗💧", text: "下雨地上有水" },
    effect: { emoji: "🌧️", text: "地会变滑" },
    distract: { emoji: "🔥", text: "地会变烫" },
  },
  {
    cause: { emoji: "🌬️🎈", text: "风吹气球" },
    effect: { emoji: "🎈", text: "气球飘走" },
    distract: { emoji: "🪨", text: "气球变重" },
  },
  {
    cause: { emoji: "🔥🍳", text: "把鸡蛋放火上" },
    effect: { emoji: "🍳", text: "鸡蛋熟了" },
    distract: { emoji: "🥚", text: "鸡蛋变大" },
  },
  {
    cause: { emoji: "🧤❄️", text: "冬天戴上手套" },
    effect: { emoji: "🤲", text: "手会暖和" },
    distract: { emoji: "🥶", text: "手会冻僵" },
  },
  {
    cause: { emoji: "👦🪥", text: "认真刷牙" },
    effect: { emoji: "😁", text: "牙齿健康" },
    distract: { emoji: "🦷", text: "牙齿掉光" },
  },
  {
    cause: { emoji: "🌻☀️", text: "向日葵见太阳" },
    effect: { emoji: "🌻", text: "转向太阳" },
    distract: { emoji: "🥀", text: "低下头来" },
  },
  {
    cause: { emoji: "🧊🥤", text: "饮料里加冰块" },
    effect: { emoji: "❄️", text: "饮料变凉" },
    distract: { emoji: "🔥", text: "饮料变烫" },
  },
  {
    cause: { emoji: "👂🔊", text: "听到很大声音" },
    effect: { emoji: "🙉", text: "想捂住耳朵" },
    distract: { emoji: "🤤", text: "想张大嘴巴" },
  },
  {
    cause: { emoji: "💧🪨", text: "水一直滴在石头上" },
    effect: { emoji: "🕳️", text: "石头被滴出洞" },
    distract: { emoji: "✨", text: "石头变发光" },
  },
  {
    cause: { emoji: "🍂🌬️", text: "秋天树叶变黄" },
    effect: { emoji: "🍃", text: "叶子会掉下来" },
    distract: { emoji: "🌸", text: "长出新叶子" },
  },
];

/** 一道题：正向（cause→effect）或逆向（effect→cause）。 */
interface Question {
  /** 题干（已给的部分） */
  given: { emoji: string; text: string };
  /** 要选的目标（正确答案） */
  answer: { emoji: string; text: string };
  /** 干扰项 */
  distract: { emoji: string; text: string };
  /** 提问方向文案 */
  prompt: string;
}

/** 由一对因果生成一道题，正/逆向随机。 */
function makeQuestion(pair: CausePair, reverse: boolean): Question {
  if (reverse) {
    return {
      given: pair.effect,
      answer: pair.cause,
      distract: pair.distract,
      prompt: "这是结果，是什么原因造成的？",
    };
  }
  return {
    given: pair.cause,
    answer: pair.effect,
    distract: pair.distract,
    prompt: "会发生什么？选对的结果",
  };
}

export class CauseEffectGame extends BaseGame {
  constructor() {
    super("cause-effect");
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
    const pair = sample(PAIRS);
    // easy 纯正向；medium 起 30% 逆向；hard 50% 逆向，强化双向推导
    const reverseRate = this.difficulty === "easy" ? 0 : this.difficulty === "medium" ? 0.3 : 0.5;
    const reverse = Math.random() < reverseRate;
    const q = makeQuestion(pair, reverse);
    const choices = shuffle([q.answer, q.distract]);

    const wrap = document.createElement("div");
    wrap.className = "cef-wrap";

    const task = document.createElement("div");
    task.className = "cef-task";
    task.textContent = q.prompt;
    wrap.appendChild(task);

    // 因果链展示：given → ?
    const chain = document.createElement("div");
    chain.className = "cef-chain";
    chain.innerHTML = `<div class="cef-given"><span class="cef-given__emoji">${q.given.emoji}</span><span class="cef-given__text">${q.given.text}</span></div><div class="cef-arrow">→</div><div class="cef-qmark">❓</div>`;
    wrap.appendChild(chain);

    const opts = document.createElement("div");
    opts.className = "cef-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cef-opt";
      b.innerHTML = `<span class="cef-opt__emoji">${c.emoji}</span><span class="cef-opt__txt">${c.text}</span>`;
      b.addEventListener("click", () =>
        this.choose(c.text === q.answer.text && c.emoji === q.answer.emoji, b),
      );
      opts.appendChild(b);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(ok: boolean, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (ok) {
      this.answered = true;
      sfxPop();
      btn.classList.add("cef-opt--done");
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
      btn.classList.add("cef-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("cef-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想生活中遇到这样的事，会怎么样～",
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
    if (document.getElementById("cef-style")) return;
    const st = document.createElement("style");
    st.id = "cef-style";
    st.textContent = CEF_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function CEF_CSS(theme: string): string {
  return `
.cef-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.cef-task{font-size:1.1rem;font-weight:800;background:#fff;padding:8px 22px;border-radius:999px;box-shadow:var(--shadow);}
.cef-chain{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;background:#fff;padding:18px 24px;border-radius:22px;box-shadow:var(--shadow);width:min(440px,94%);}
.cef-given{display:flex;flex-direction:column;align-items:center;gap:6px;}
.cef-given__emoji{font-size:3rem;line-height:1;}
.cef-given__text{font-size:1rem;font-weight:800;color:var(--ink);text-align:center;}
.cef-arrow{font-size:2rem;font-weight:900;color:${theme};}
.cef-qmark{font-size:3rem;animation:cef-bounce 1s ease-in-out infinite;}
@keyframes cef-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.cef-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;width:min(440px,100%);}
.cef-opt{min-height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:14px 10px;transition:transform .12s ease;}
.cef-opt:active{transform:scale(.93);}
.cef-opt__emoji{font-size:2.6rem;line-height:1;}
.cef-opt__txt{font-size:.95rem;font-weight:800;color:var(--ink);text-align:center;line-height:1.3;}
.cef-opt--done{background:#d4f4dd;outline:4px solid #34c759;animation:cef-pop .4s ease;}
.cef-opt--wrong{animation:cef-shake .4s ease;}
@keyframes cef-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes cef-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): CauseEffectGame {
  return new CauseEffectGame();
}
