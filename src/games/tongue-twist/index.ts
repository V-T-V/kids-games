/* 绕口令 Tongue-Twist —— 听一段绕口令，回答"听到了哪个字"。
   独特点：训练语音辨析（区分易混音 s/sh、n/l、b/p 等），区别于同音字。
   巧思：绕口令里反复出现易混的两个字（如"四/十""牛/刘"），
         孩子要竖起耳朵分辨；「再听一遍」可重放。难度=选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** 一道绕口令辨析题。 */
interface Twist {
  /** 绕口令全文（朗读用） */
  text: string;
  /** 问题：听到了哪个字？ */
  ask: string;
  /** 正确答案 */
  answer: string;
  /** 干扰字候选 */
  distract: string[];
  /** 装饰 emoji */
  emoji: string;
}

const TWISTS: Twist[] = [
  {
    text: "四是四，十是十，十四是十四，四十是四十",
    ask: "听到的是哪一个字？",
    answer: "四",
    distract: ["十", "是", "七"],
    emoji: "🔢",
  },
  {
    text: "四是四，十是十，十四是十四，四十是四十",
    ask: "哪个字读 shí？",
    answer: "十",
    distract: ["四", "是", "七"],
    emoji: "🔟",
  },
  {
    text: "吃葡萄不吐葡萄皮，不吃葡萄倒吐葡萄皮",
    ask: "吃的是什么水果？",
    answer: "葡萄",
    distract: ["苹果", "桃子", "西瓜"],
    emoji: "🍇",
  },
  {
    text: "红鲤鱼绿鲤鱼与驴，红鲤鱼绿鲤鱼与驴",
    ask: "听到的是哪种动物？",
    answer: "鲤鱼",
    distract: ["驴", "鱼", "马"],
    emoji: "🐟",
  },
  {
    text: "八百标兵奔北坡，炮兵并排北边跑",
    ask: "标兵往哪边跑？",
    answer: "北",
    distract: ["南", "东", "西"],
    emoji: "🧭",
  },
  {
    text: "牛郎恋刘娘，刘娘念牛郎",
    ask: "听到的是哪一个姓？",
    answer: "刘",
    distract: ["牛", "娘", "李"],
    emoji: "👩",
  },
  {
    text: "哥哥弟弟坡前坐，坡上卧着一只鹅",
    ask: "坡上卧着什么？",
    answer: "鹅",
    distract: ["鸡", "鸭", "狗"],
    emoji: "🦢",
  },
  {
    text: "树上有四只小鸟，树下有十只小猫",
    ask: "树上有什么？",
    answer: "小鸟",
    distract: ["小猫", "小虫", "小鸡"],
    emoji: "🐦",
  },
];

/** 用语音合成朗读绕口令（稍慢一点便于分辨）。 */
function speak(text: string): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.78;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export class TongueTwistGame extends BaseGame {
  constructor() {
    super("tongue-twist");
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
    try {
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  /** 选项数=难度。easy=2, medium=3, hard=4 */
  private optionCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const t = sample(TWISTS);
    const need = this.optionCount();
    const wrongN = Math.min(need - 1, t.distract.length);
    const distract = t.distract.slice(0, wrongN);
    // 选项必含正确答案
    const options = shuffle([t.answer, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "ttw-wrap";

    const task = document.createElement("div");
    task.className = "ttw-task";
    task.innerHTML = `仔细听绕口令：<span class="ttw-emoji">${t.emoji}</span><br><b>${t.ask}</b><br><span class="ttw-hint">第 ${this.roundsDone + 1}/${this.roundTotal} 题</span>`;
    wrap.appendChild(task);

    const player = document.createElement("div");
    player.className = "ttw-player";
    player.appendChild(
      createButton({
        text: "再听一遍",
        icon: "🔊",
        variant: "secondary",
        onClick: () => speak(t.text),
      }),
    );
    wrap.appendChild(player);

    const opts = document.createElement("div");
    opts.className = "ttw-opts";
    options.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ttw-opt";
      b.textContent = w;
      b.addEventListener("click", () => this.choose(w, t, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);

    this.trackTimeout(() => speak(t.text), 400);
  }

  private choose(w: string, t: Twist, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (w === t.answer) {
      this.answered = true;
      sfxPop();
      btn.classList.add("ttw-opt--done");
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
      btn.classList.add("ttw-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ttw-opt--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "点「再听一遍」，仔细分辨读音～",
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
    if (document.getElementById("ttw-style")) return;
    const st = document.createElement("style");
    st.id = "ttw-style";
    st.textContent = TTW_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function TTW_CSS(theme: string): string {
  return `
.ttw-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(500px,100%);}
.ttw-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.7;color:${theme};}
.ttw-emoji{font-size:1.4em;}
.ttw-hint{font-size:.82rem;color:var(--ink-soft);font-weight:600;}
.ttw-player{display:flex;justify-content:center;}
.ttw-opts{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;padding-top:6px;}
.ttw-opt{min-width:80px;height:74px;padding:0 18px;font-size:1.6rem;font-weight:800;font-family:'KaiTi','STKaiti',serif;background:#fff;border-radius:18px;box-shadow:var(--shadow);color:var(--ink);transition:transform .15s;}
.ttw-opt:active{transform:scale(.93);}
.ttw-opt--done{background:linear-gradient(135deg,#6bcf7f,#4ba85f);color:#fff;animation:ttw-pop .45s ease;}
.ttw-opt--wrong{animation:ttw-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes ttw-pop{0%{transform:scale(.5)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes ttw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): TongueTwistGame {
  return new TongueTwistGame();
}
