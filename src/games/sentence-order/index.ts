/* 句子排序进阶 Sentence-Order —— 把打乱的词卡按正确顺序拼成完整句子。
   独特点：与 sentence-build 同类但句库更丰富（日常/故事/问答），训练语序与语法。
   巧思：点词填到顶部句子条，错位温柔提示可重试；全对朗读奖励。难度=词数+句长。 */

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
  // 日常句
  { emoji: "🌅🥱", words: ["早上", "我", "起床"] },
  { emoji: "🪥🦷", words: ["我", "在", "刷牙"] },
  { emoji: "🍚👨‍👩‍👧", words: ["我们", "一起", "吃饭"] },
  { emoji: "🚪👋", words: ["我", "去", "上学"] },
  { emoji: "📚📖", words: ["姐姐", "在", "看书"] },
  // 动作句
  { emoji: "⚽🏃", words: ["哥哥", "在", "踢球"] },
  { emoji: "🎨🖼️", words: ["妹妹", "喜欢", "画画"] },
  { emoji: "🎵🎤", words: ["小鸟", "在", "唱歌"] },
  { emoji: "🐕🦴", words: ["小狗", "在", "啃骨头"] },
  // 状态/描述句
  { emoji: "🌸☀️", words: ["春天", "花", "开了"] },
  { emoji: "🍂🍁", words: ["秋天", "树叶", "落了"] },
  { emoji: "🌧️☔", words: ["外面", "在", "下雨"] },
  { emoji: "🌙😴", words: ["晚上", "宝宝", "睡觉"] },
  // 较长句（hard）
  { emoji: "🍎🧺", words: ["妈妈", "在", "洗", "苹果"] },
  { emoji: "🐰🥕", words: ["小白兔", "在", "吃", "萝卜"] },
  { emoji: "👧🏫", words: ["小女孩", "高兴地", "去", "上学"] },
  { emoji: "🐱🐟", words: ["小花猫", "在", "河边", "钓鱼"] },
  { emoji: "👨‍🌾🌻", words: ["爷爷", "在", "菜园", "种菜"] },
  { emoji: "🌧️🌈", words: ["下雨", "以后", "天上", "有彩虹"] },
];

/** 朗读句子。 */
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

export class SentenceOrderGame extends BaseGame {
  constructor() {
    super("sentence-order");
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

    // 选一句至少含 wordCount 个词的
    const candidates = SENTENCES.filter(
      (s) => s.words.length >= this.wordCount(),
    );
    const pool = candidates.length > 0 ? candidates : SENTENCES;
    const full = sample(pool);
    const n = Math.min(this.wordCount(), full.words.length);
    const correct = full.words.slice(0, n);
    const shuffled = shuffle(correct);
    const placed: string[] = [];

    const wrap = document.createElement("div");
    wrap.className = "sro-wrap";

    const task = document.createElement("div");
    task.className = "sro-task";
    task.innerHTML = `按顺序点词，拼出一句话<br><span class="sro-hint">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "sro-scene";
    scene.textContent = full.emoji;
    wrap.appendChild(scene);

    const bar = document.createElement("div");
    bar.className = "sro-bar";
    bar.innerHTML = `<span class="sro-bar__ph">点下面的词...</span>`;
    wrap.appendChild(bar);

    const poolEl = document.createElement("div");
    poolEl.className = "sro-pool";
    shuffled.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sro-word";
      b.textContent = w;
      b.addEventListener("click", () =>
        this.pickWord(w, b, placed, correct, bar),
      );
      poolEl.appendChild(b);
    });
    wrap.appendChild(poolEl);

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "sro-reset";
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
      chip.className = "sro-chip";
      if (i < correct.length && correct[i] === w) {
        chip.classList.add("sro-chip--ok");
      }
      chip.textContent = w;
      chip.addEventListener("click", () => {
        // 点击句子条上的词可撤销
        placed.splice(i, 1);
        this.renderBar(placed, correct, bar);
        const cards =
          this.root.querySelectorAll<HTMLButtonElement>(".sro-word");
        cards.forEach((c) => {
          if (c.textContent === w) {
            c.classList.remove("sro-word--used");
          }
        });
      });
      bar.appendChild(chip);
    });
    if (placed.length === 0) {
      bar.innerHTML = `<span class="sro-bar__ph">点下面的词...</span>`;
    }
  }

  private pickWord(
    w: string,
    btn: HTMLButtonElement,
    placed: string[],
    correct: string[],
    bar: HTMLElement,
  ): void {
    if (btn.classList.contains("sro-word--used")) return;
    placed.push(w);
    btn.classList.add("sro-word--used");
    sfxPop();
    this.renderBar(placed, correct, bar);

    if (placed.length >= correct.length) {
      const ok = placed.every((p, i) => p === correct[i]);
      if (ok) {
        bar.classList.add("sro-bar--done");
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
        const paused = this.onWrong();
        bar.classList.add("sro-bar--shake");
        this.trackTimeout(() => {
          bar.classList.remove("sro-bar--shake");
          placed.length = 0;
          this.renderBar(placed, correct, bar);
          this.root
            .querySelectorAll<HTMLButtonElement>(".sro-word")
            .forEach((c) => c.classList.remove("sro-word--used"));
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
    placed.length = 0;
    bar.classList.remove("sro-bar--done", "sro-bar--shake");
    bar.innerHTML = `<span class="sro-bar__ph">点下面的词...</span>`;
    poolEl
      .querySelectorAll<HTMLButtonElement>(".sro-word")
      .forEach((c) => c.classList.remove("sro-word--used"));
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想这句话<b>先说谁</b>、再<b>做啥</b>、最后<b>怎么样</b>～",
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
    if (document.getElementById("sro-style")) return;
    const st = document.createElement("style");
    st.id = "sro-style";
    st.textContent = SRO_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SRO_CSS(theme: string): string {
  return `
.sro-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.sro-task{font-size:1.15rem;font-weight:800;text-align:center;}
.sro-hint{font-size:.82rem;color:var(--ink-soft,#888);font-weight:600;display:block;margin-top:2px;}
.sro-scene{font-size:2.6rem;line-height:1;user-select:none;}
.sro-bar{min-height:64px;width:100%;max-width:440px;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 16px;background:#fff;border-radius:18px;box-shadow:var(--shadow);border:3px dashed ${theme}66;}
.sro-bar--done{background:#d4f4dd;border-color:#6bcf7f;animation:sro-pop .5s ease;}
.sro-bar--shake{animation:sro-shake .5s ease;}
.sro-bar__ph{color:var(--ink-soft,#888);font-weight:600;font-size:.95rem;}
.sro-chip{padding:8px 14px;border-radius:12px;background:#f0f0f5;font-weight:800;font-size:1.1rem;font-family:'KaiTi','STKaiti',serif;color:var(--ink,#333);cursor:pointer;}
.sro-chip--ok{background:#d4f4dd;color:#2d8a47;}
.sro-pool{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:14px;background:rgba(255,255,255,.5);border-radius:18px;}
.sro-word{padding:14px 20px;font-size:1.25rem;font-weight:800;font-family:'KaiTi','STKaiti',serif;background:#fff;color:var(--ink,#333);border-radius:14px;box-shadow:var(--shadow);transition:transform .15s;}
.sro-word:active{transform:scale(.94);}
.sro-word--used{opacity:.3;pointer-events:none;background:#eee;}
.sro-reset{margin-top:4px;padding:6px 16px;font-size:.9rem;font-weight:700;background:#fff;border-radius:999px;box-shadow:var(--shadow);color:var(--ink-soft,#888);cursor:pointer;}
.sro-reset:active{transform:scale(.95);}
@keyframes sro-pop{0%{transform:scale(.95)}50%{transform:scale(1.03)}100%{transform:scale(1)}}
@keyframes sro-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
`;
}

export function create(): SentenceOrderGame {
  return new SentenceOrderGame();
}
