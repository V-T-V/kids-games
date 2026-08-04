/* 词语泡 Word Bubble —— 屏幕上飘着几个泡泡，每个装一个词。
   这一轮要找某一类（如"水果"），孩子把属于这一类的泡泡都点出来归组。
   独特点：先给类别提示，再从混合泡泡里挑同类（区别于自由分类）。
   巧思：泡泡轻微浮动飘动；点对会发光被收集，点错弹一下；
   每轮保证该类至少有 2 个、干扰至少 1 个。难度=词语总数。
   注意 CSS 前缀 wb2-（避免和 word-bubble 之外的 wb- 冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface WordSet {
  cat: string;
  emoji: string;
  words: string[];
}

const SETS: WordSet[] = [
  { cat: "水果", emoji: "🍎", words: ["苹果", "香蕉", "葡萄", "草莓"] },
  { cat: "动物", emoji: "🐰", words: ["小猫", "小狗", "兔子", "小鸟"] },
  { cat: "衣服", emoji: "👕", words: ["上衣", "裤子", "袜子", "帽子"] },
  { cat: "交通", emoji: "🚗", words: ["汽车", "火车", "飞机", "轮船"] },
  { cat: "文具", emoji: "✏️", words: ["铅笔", "橡皮", "尺子", "书本"] },
];

/** 干扰词池：从其它类别里借词，确保不是本类。 */
interface Bubble {
  word: string;
  isTarget: boolean;
  el: HTMLButtonElement;
  popped: boolean;
}

export class WordBubbleGame extends BaseGame {
  constructor() {
    super("word-bubble");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private bubbles: Bubble[] = [];
  private targetCat = "";
  private targetEmoji = "";
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private config(): { target: number; distract: number } {
    if (this.difficulty === "easy") return { target: 2, distract: 2 };
    if (this.difficulty === "medium") return { target: 3, distract: 3 };
    return { target: 4, distract: 4 };
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const set = sample(SETS);
    this.targetCat = set.cat;
    this.targetEmoji = set.emoji;

    const { target, distract } = this.config();
    const targetWords = shuffle(set.words).slice(0, target);
    // 干扰词：来自其它类别
    const otherPool = SETS.filter((s) => s.cat !== set.cat).flatMap(
      (s) => s.words,
    );
    const distractWords = shuffle(otherPool).slice(0, distract);

    const all = shuffle([
      ...targetWords.map((w) => ({ word: w, isTarget: true })),
      ...distractWords.map((w) => ({ word: w, isTarget: false })),
    ]);
    this.remaining = targetWords.length;
    this.bubbles = [];

    const wrap = document.createElement("div");
    wrap.className = "wb2-wrap";

    const task = document.createElement("div");
    task.className = "wb2-task";
    task.innerHTML = `${this.targetEmoji} 把所有 <b>${this.targetCat}</b> 的泡泡点出来（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const pond = document.createElement("div");
    pond.className = "wb2-pond";
    all.forEach((item, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wb2-bubble";
      // 错落分布：给每个泡泡一个浮动相位/位置
      b.style.setProperty("--d", `${(i % 4) * 0.7}s`);
      b.style.setProperty("--x", `${(i % 3) - 1}`);
      b.textContent = item.word;
      b.addEventListener("click", () => this.pop(i));
      pond.appendChild(b);
      this.bubbles.push({
        word: item.word,
        isTarget: item.isTarget,
        el: b,
        popped: false,
      });
    });
    wrap.appendChild(pond);

    const remain = document.createElement("div");
    remain.className = "wb2-remain";
    remain.id = "wb2-remain";
    remain.textContent = `还差 ${this.remaining} 个`;
    wrap.appendChild(remain);

    this.root.appendChild(wrap);
  }

  private pop(i: number): void {
    const b = this.bubbles[i];
    if (!b || b.popped) return;
    if (b.isTarget) {
      b.popped = true;
      b.el.classList.add("wb2-bubble--good");
      b.el.disabled = true;
      sfxPop();
      const r = b.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.remaining -= 1;
      const remain = this.root.querySelector("#wb2-remain");
      if (remain) remain.textContent = `还差 ${Math.max(0, this.remaining)} 个`;
      if (this.remaining <= 0) {
        this.roundsDone += 1;
        // 让剩余干扰泡泡渐隐
        this.bubbles.forEach((bb) => {
          if (!bb.popped) bb.el.classList.add("wb2-bubble--fade");
        });
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1100);
      }
    } else {
      // 点错
      b.el.classList.add("wb2-bubble--shake");
      this.trackTimeout(() => b.el.classList.remove("wb2-bubble--shake"), 400);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `想一想：哪些是${this.targetCat}？`,
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
    if (document.getElementById("wb2-style")) return;
    const st = document.createElement("style");
    st.id = "wb2-style";
    st.textContent = WB2_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function WB2_CSS(theme: string): string {
  return `
.wb2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.wb2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.wb2-pond{display:flex;flex-wrap:wrap;gap:14px 12px;justify-content:center;padding:20px;background:linear-gradient(180deg,rgba(174,229,255,.6),rgba(124,199,245,.5));border-radius:24px;box-shadow:var(--shadow);width:100%;max-width:460px;min-height:180px;}
.wb2-bubble{
  position:relative;min-width:74px;height:74px;border-radius:50%;border:none;cursor:pointer;
  background:radial-gradient(circle at 32% 28%,#fff8,var(--c,#fff)),var(--bc,${theme});
  color:#fff;font-weight:900;font-size:1.05rem;font-family:'KaiTi','STKaiti',serif;
  box-shadow:inset 0 -6px 8px rgba(0,0,0,.15),0 6px 12px rgba(0,0,0,.15);
  display:flex;align-items:center;justify-content:center;text-shadow:0 1px 2px rgba(0,0,0,.25);
  animation:wb2-float 3s ease-in-out infinite;animation-delay:var(--d,0s);
  transition:transform .12s ease;user-select:none;
}
.wb2-bubble:nth-child(3n){--bc:#ff6b9d;}
.wb2-bubble:nth-child(3n+1){--bc:#4d96ff;}
.wb2-bubble:nth-child(3n+2){--bc:#6bcf7f;}
.wb2-bubble:active{transform:scale(.92);}
@keyframes wb2-float{0%,100%{transform:translateY(0) rotate(calc(var(--x,0) * 1deg));}50%{transform:translateY(-6px) rotate(calc(var(--x,0) * 1deg));}}
.wb2-bubble--good{animation:wb2-pop .4s ease forwards;}
@keyframes wb2-pop{0%{transform:scale(1);}40%{transform:scale(1.3);filter:brightness(1.4);}100%{transform:scale(0);opacity:0;}}
.wb2-bubble--shake{animation:wb2-shake .4s ease;}
@keyframes wb2-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-5px) rotate(-4deg);}75%{transform:translateX(5px) rotate(4deg);}}
.wb2-bubble--fade{opacity:.35;filter:grayscale(.6);animation:none;transition:opacity .5s ease;}
.wb2-remain{font-size:1rem;font-weight:800;color:var(--ink-soft);}
@media (max-width:380px){.wb2-bubble{min-width:62px;height:62px;font-size:.95rem;}}
`;
}

export function create(): WordBubbleGame {
  return new WordBubbleGame();
}
