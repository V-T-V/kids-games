/* 儿歌填词 Rhyme-Fill —— 给一句熟悉儿歌的最后一句，选出空格里的词。
   独特点：基于韵律记忆的语感训练（区别于单字识字）。
   巧思：仅藏最后一句最末词（最朗朗上口），干扰项是同句其他可能词；
         答对后亮起，并朗读全句。难度=选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** 一道儿歌填词题。 */
interface Rhyme {
  /** 前半句（题面） */
  line: string;
  /** 正确答案 */
  answer: string;
  /** 干扰词候选 */
  distract: string[];
  /** emoji 装饰 */
  emoji: string;
}

const RHYMES: Rhyme[] = [
  {
    line: "一闪一闪亮__",
    answer: "晶晶",
    distract: ["闪闪", "星星", "亮亮", "明明"],
    emoji: "⭐",
  },
  {
    line: "两只老虎跑得__",
    answer: "快",
    distract: ["慢", "远", "高", "低"],
    emoji: "🐯",
  },
  {
    line: "小白兔白又__",
    answer: "白",
    distract: ["红", "黑", "胖", "矮"],
    emoji: "🐰",
  },
  {
    line: "世上只有妈妈__",
    answer: "好",
    distract: ["抱", "笑", "亲", "哭"],
    emoji: "👩",
  },
  {
    line: "我在马路边捡到一__钱",
    answer: "分",
    distract: ["块", "毛", "角", "分"],
    emoji: "🪙",
  },
  {
    line: "小星星，亮晶__",
    answer: "晶",
    distract: ["亮", "闪", "光", "照"],
    emoji: "✨",
  },
  {
    line: "拔萝卜，拔萝__",
    answer: "卜",
    distract: ["菜", "瓜", "果", "米"],
    emoji: "🥕",
  },
  {
    line: "找呀找呀找朋__",
    answer: "友",
    distract: ["伴", "亲", "家", "友"],
    emoji: "🤝",
  },
];

/** 用语音合成朗读文本。 */
function speak(text: string): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export class RhymeFillGame extends BaseGame {
  constructor() {
    super("rhyme-fill");
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

  /** 选项数=难度。easy=3, medium=4, hard=5 */
  private optionCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const r = sample(RHYMES);
    const need = this.optionCount();
    // 干扰词池可能不足，去重并补足
    const distractPool = shuffle(r.distract);
    const distract = distractPool.slice(0, need - 1);
    // 选项必含正确答案
    const options = shuffle([r.answer, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "rhy-wrap";

    const task = document.createElement("div");
    task.className = "rhy-task";
    task.innerHTML = `唱一唱，选对的词填进空格里<br><span class="rhy-hint">第 ${this.roundsDone + 1}/${this.roundTotal} 题</span>`;
    wrap.appendChild(task);

    // 儿歌卡片：把空格渲染成虚线方框
    const card = document.createElement("div");
    card.className = "rhy-card";
    const safeLine = r.line.replace(/</g, "&lt;");
    const htmlLine = safeLine.replace(
      "__",
      `<span class="rhy-blank">？</span>`,
    );
    card.innerHTML = `<div class="rhy-emoji">${r.emoji}</div><div class="rhy-line">${htmlLine}</div>`;
    wrap.appendChild(card);

    // 朗读整句一次（带"哪个词"的引导）
    const player = document.createElement("div");
    player.className = "rhy-player";
    player.appendChild(
      createButton({
        text: "听儿歌",
        icon: "🔊",
        variant: "secondary",
        onClick: () => speak(r.line.replace("__", r.answer)),
      }),
    );
    wrap.appendChild(player);

    const opts = document.createElement("div");
    opts.className = "rhy-opts";
    options.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rhy-opt";
      b.textContent = w;
      b.addEventListener("click", () => this.choose(w, r, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);

    this.trackTimeout(() => speak(r.line.replace("__", r.answer)), 400);
  }

  private choose(w: string, r: Rhyme, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (w === r.answer) {
      this.answered = true;
      sfxPop();
      btn.classList.add("rhy-opt--done");
      // 把空格填上正确答案
      const blank = this.root.querySelector(".rhy-blank");
      if (blank) {
        blank.textContent = r.answer;
        blank.classList.add("rhy-blank--filled");
      }
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      // 朗读整句作为奖励
      this.trackTimeout(() => speak(r.line.replace("__", r.answer)), 400);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1500);
    } else {
      btn.classList.add("rhy-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("rhy-opt--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "把儿歌<b>大声唱一遍</b>，最后那个词是什么？",
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
    if (document.getElementById("rhy-style")) return;
    const st = document.createElement("style");
    st.id = "rhy-style";
    st.textContent = RHY_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function RHY_CSS(theme: string): string {
  return `
.rhy-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(500px,100%);}
.rhy-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;}
.rhy-hint{font-size:.82rem;color:var(--ink-soft);font-weight:600;}
.rhy-card{display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 26px;border-radius:22px;background:linear-gradient(135deg,#fff,${theme}33);box-shadow:var(--shadow-lg);}
.rhy-emoji{font-size:2.6rem;line-height:1;}
.rhy-line{font-size:1.45rem;font-weight:800;color:var(--ink);font-family:'KaiTi','STKaiti',serif;}
.rhy-blank{display:inline-block;min-width:48px;padding:0 6px;border-bottom:3px dashed ${theme};color:${theme};font-weight:900;text-align:center;}
.rhy-blank--filled{border-bottom:none;background:#fff7cc;border-radius:6px;}
.rhy-player{display:flex;justify-content:center;}
.rhy-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding-top:6px;}
.rhy-opt{min-width:78px;height:64px;padding:0 16px;font-size:1.4rem;font-weight:800;font-family:'KaiTi','STKaiti',serif;background:#fff;border-radius:16px;box-shadow:var(--shadow);transition:transform .15s;}
.rhy-opt:active{transform:scale(.93);}
.rhy-opt--done{background:linear-gradient(135deg,#6bcf7f,#4ba85f);color:#fff;animation:rhy-pop .45s ease;}
.rhy-opt--wrong{animation:rhy-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes rhy-pop{0%{transform:scale(.5)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes rhy-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): RhymeFillGame {
  return new RhymeFillGame();
}
