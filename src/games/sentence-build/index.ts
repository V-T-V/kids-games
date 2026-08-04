/* 句子拼读 Sentence-Build —— 把打乱的词卡按正确顺序点出来拼成一句话。
   独特点：从词到句的语法组合训练（区别于单字识读）。
   巧思：每点一张词卡就填到顶部"句子条"里，错位时温柔提示但可继续；
         全部填完后判定整体顺序，对则朗读全句奖励。难度=词数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

/** 一道拼句题：words 是正确顺序的词序列。 */
interface Sentence {
  emoji: string;
  words: string[];
}

const SENTENCES: Sentence[] = [
  { emoji: "🐱💤", words: ["小猫", "在", "睡觉"] },
  { emoji: "🐶🦴", words: ["小狗", "吃", "骨头"] },
  { emoji: "🐱🐟", words: ["小猫", "在", "吃", "鱼"] },
  { emoji: "👧📚", words: ["小女孩", "在", "看书"] },
  { emoji: "👦🚲", words: ["小男孩", "骑", "自行车"] },
  { emoji: "🐰🥕", words: ["小白兔", "在", "吃", "萝卜"] },
  { emoji: "🌧️☔", words: ["外面", "在", "下雨"] },
  { emoji: "🌙🛏️", words: ["晚上", "宝宝", "睡觉"] },
  { emoji: "☀️🌸", words: ["春天", "花", "开了"] },
  { emoji: "🍎🧺", words: ["妈妈", "洗", "苹果"] },
];

/** 用语音合成朗读句子。 */
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

export class SentenceBuildGame extends BaseGame {
  constructor() {
    super("sentence-build");
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
    try {
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  /** 词数=难度。easy=3, medium=4, hard=5。 */
  private wordCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 选一句至少含 wordCount 个词的；如果不够就尽量取最长的
    const candidates = SENTENCES.filter(
      (s) => s.words.length >= this.wordCount(),
    );
    const pool = candidates.length > 0 ? candidates : SENTENCES;
    const full = sample(pool);
    // 截取前 wordCount 个词
    const n = Math.min(this.wordCount(), full.words.length);
    const correct = full.words.slice(0, n);
    const shuffled = shuffle(correct);
    // 已填入到句子条中的词（按点击顺序）
    const placed: string[] = [];

    const wrap = document.createElement("div");
    wrap.className = "sntb-wrap";

    const task = document.createElement("div");
    task.className = "sntb-task";
    task.innerHTML = `按顺序点词，拼出一句话<br><span class="sntb-hint">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    // 场景提示 emoji
    const scene = document.createElement("div");
    scene.className = "sntb-scene";
    scene.textContent = full.emoji;
    wrap.appendChild(scene);

    // 句子条：显示已点词
    const bar = document.createElement("div");
    bar.className = "sntb-bar";
    bar.innerHTML = `<span class="sntb-bar__ph">点下面的词...</span>`;
    wrap.appendChild(bar);

    // 词卡库
    const poolEl = document.createElement("div");
    poolEl.className = "sntb-pool";
    shuffled.forEach((w, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sntb-word";
      b.dataset.idx = String(i);
      b.textContent = w;
      b.addEventListener("click", () =>
        this.pickWord(w, b, placed, correct, bar),
      );
      poolEl.appendChild(b);
    });
    wrap.appendChild(poolEl);

    // 重置按钮
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "sntb-reset";
    reset.textContent = "↺ 重新拼";
    reset.addEventListener("click", () => this.resetBar(bar, poolEl, placed));
    wrap.appendChild(reset);

    this.root.appendChild(wrap);
  }

  private renderBar(
    placed: string[],
    correct: string[],
    bar: HTMLElement,
  ): void {
    bar.innerHTML = "";
    placed.forEach((w, i) => {
      const chip = document.createElement("span");
      chip.className = "sntb-chip";
      // 已点对的位置高亮绿色，否则保持中性（即时反馈但不剧透）
      if (i < correct.length && correct[i] === w) {
        chip.classList.add("sntb-chip--ok");
      }
      chip.textContent = w;
      chip.addEventListener("click", () => {
        // 点击句子条上的词可撤销
        placed.splice(i, 1);
        this.renderBar(placed, correct, bar);
        // 恢复词卡可用
        const cards =
          this.root.querySelectorAll<HTMLButtonElement>(".sntb-word");
        cards.forEach((c) => {
          if (c.textContent === w) {
            c.classList.remove("sntb-word--used");
          }
        });
        this.updateCardStates(placed);
      });
      bar.appendChild(chip);
    });
    if (placed.length === 0) {
      bar.innerHTML = `<span class="sntb-bar__ph">点下面的词...</span>`;
    }
  }

  /** 把已使用的词卡标灰。 */
  private updateCardStates(placed: string[]): void {
    const cards = this.root.querySelectorAll<HTMLButtonElement>(".sntb-word");
    cards.forEach((c) => {
      const text = c.textContent ?? "";
      // 多个相同词时按出现次数判定（这里假设词不重复）
      const usedCount = placed.filter((p) => p === text).length;
      const seenCount = placed.filter((p) => p === text).length;
      void seenCount;
      if (usedCount > 0) {
        c.classList.add("sntb-word--used");
      } else {
        c.classList.remove("sntb-word--used");
      }
    });
  }

  private pickWord(
    w: string,
    btn: HTMLButtonElement,
    placed: string[],
    correct: string[],
    bar: HTMLElement,
  ): void {
    if (btn.classList.contains("sntb-word--used")) return;
    placed.push(w);
    btn.classList.add("sntb-word--used");
    sfxPop();
    this.renderBar(placed, correct, bar);

    // 填满后判定
    if (placed.length >= correct.length) {
      const ok = placed.every((p, i) => p === correct[i]);
      if (ok) {
        // 全对：庆祝并朗读
        bar.classList.add("sntb-bar--done");
        const r = btn.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        this.trackTimeout(() => speak(correct.join("")), 300);
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1800);
      } else {
        // 错位：抖动句子条 + 累计一次错误，然后清空让重试
        const paused = this.onWrong();
        bar.classList.add("sntb-bar--shake");
        this.trackTimeout(() => {
          bar.classList.remove("sntb-bar--shake");
          placed.length = 0;
          this.renderBar(placed, correct, bar);
          this.root
            .querySelectorAll<HTMLButtonElement>(".sntb-word")
            .forEach((c) => c.classList.remove("sntb-word--used"));
        }, 700);
        if (paused) {
          this.trackTimeout(() => this.showRest(), 800);
        }
      }
    }
  }

  private resetBar(
    bar: HTMLElement,
    poolEl: HTMLElement,
    placed: string[],
  ): void {
    // 真正清空当前句子条：移除已填词、还原词卡可点状态、清空 placed 数组。
    // 之前的实现调用了 startRound()，会重新随机抽一句，孩子看到的是新句子而非"清空当前"。
    placed.length = 0;
    bar.classList.remove("sntb-bar--done", "sntb-bar--shake");
    bar.innerHTML = `<span class="sntb-bar__ph">点下面的词...</span>`;
    poolEl
      .querySelectorAll<HTMLButtonElement>(".sntb-word")
      .forEach((c) => c.classList.remove("sntb-word--used"));
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想这句话<b>先说谁</b>、再说<b>做啥</b>～",
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
    if (document.getElementById("sntb-style")) return;
    const st = document.createElement("style");
    st.id = "sntb-style";
    st.textContent = SNT_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function SNT_CSS(theme: string): string {
  return `
.sntb-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(500px,100%);}
.sntb-task{font-size:1.15rem;font-weight:800;text-align:center;}
.sntb-hint{font-size:.82rem;color:var(--ink-soft);font-weight:600;display:block;margin-top:2px;}
.sntb-scene{font-size:2.6rem;line-height:1;user-select:none;}
.sntb-bar{min-height:64px;width:100%;max-width:420px;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 16px;background:#fff;border-radius:18px;box-shadow:var(--shadow);border:3px dashed ${theme}66;}
.sntb-bar--done{background:#d4f4dd;border-color:#6bcf7f;animation:sntb-pop .5s ease;}
.sntb-bar--shake{animation:sntb-shake .5s ease;}
.sntb-bar__ph{color:var(--ink-soft);font-weight:600;font-size:.95rem;}
.sntb-chip{padding:8px 14px;border-radius:12px;background:#f0f0f5;font-weight:800;font-size:1.1rem;font-family:'KaiTi','STKaiti',serif;color:var(--ink);cursor:pointer;}
.sntb-chip--ok{background:#d4f4dd;color:#2d8a47;}
.sntb-pool{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:14px;background:rgba(255,255,255,.5);border-radius:18px;}
.sntb-word{padding:14px 20px;font-size:1.25rem;font-weight:800;font-family:'KaiTi','STKaiti',serif;background:#fff;color:var(--ink);border-radius:14px;box-shadow:var(--shadow);transition:transform .15s;}
.sntb-word:active{transform:scale(.94);}
.sntb-word--used{opacity:.3;pointer-events:none;background:#eee;}
.sntb-reset{margin-top:4px;padding:6px 16px;font-size:.9rem;font-weight:700;background:#fff;border-radius:999px;box-shadow:var(--shadow);color:var(--ink-soft);cursor:pointer;}
.sntb-reset:active{transform:scale(.95);}
@keyframes sntb-pop{0%{transform:scale(.95)}50%{transform:scale(1.03)}100%{transform:scale(1)}}
@keyframes sntb-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
`;
}

export function create(): SentenceBuildGame {
  return new SentenceBuildGame();
}
