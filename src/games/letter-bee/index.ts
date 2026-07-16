/* 蜜蜂找字母 Letter Bee —— 拖动蜜蜂采"对应首字母"的花。
   巧思：蜜蜂跟随手指飞 + 采对跳采蜜舞 + 采错蜜蜂眩晕。
   教育内核：字母识别 + 首音对应（中文模式用拼音首字母 + 词语）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** 题目：一个字母 + 一组以该字母开头的英文单词（配中文）。 */
interface WordItem {
  en: string;
  zh: string;
  emoji: string;
}

/** 字母库（按字母聚合，便于出题与干扰）。 */
const LETTERS: { letter: string; words: WordItem[] }[] = [
  {
    letter: "A",
    words: [
      { en: "Apple", zh: "苹果", emoji: "🍎" },
      { en: "Ant", zh: "蚂蚁", emoji: "🐜" },
    ],
  },
  {
    letter: "B",
    words: [
      { en: "Ball", zh: "球", emoji: "⚽" },
      { en: "Banana", zh: "香蕉", emoji: "🍌" },
    ],
  },
  {
    letter: "C",
    words: [
      { en: "Cat", zh: "猫", emoji: "🐱" },
      { en: "Car", zh: "汽车", emoji: "🚗" },
    ],
  },
  {
    letter: "D",
    words: [
      { en: "Dog", zh: "狗", emoji: "🐶" },
      { en: "Duck", zh: "鸭子", emoji: "🦆" },
    ],
  },
  {
    letter: "E",
    words: [
      { en: "Egg", zh: "鸡蛋", emoji: "🥚" },
      { en: "Elephant", zh: "大象", emoji: "🐘" },
    ],
  },
  {
    letter: "F",
    words: [
      { en: "Fish", zh: "鱼", emoji: "🐟" },
      { en: "Flower", zh: "花", emoji: "🌸" },
    ],
  },
  {
    letter: "G",
    words: [
      { en: "Grape", zh: "葡萄", emoji: "🍇" },
      { en: "Gift", zh: "礼物", emoji: "🎁" },
    ],
  },
  {
    letter: "H",
    words: [
      { en: "Hat", zh: "帽子", emoji: "🎩" },
      { en: "House", zh: "房子", emoji: "🏠" },
    ],
  },
  {
    letter: "M",
    words: [
      { en: "Moon", zh: "月亮", emoji: "🌙" },
      { en: "Monkey", zh: "猴子", emoji: "🐵" },
    ],
  },
  {
    letter: "S",
    words: [
      { en: "Sun", zh: "太阳", emoji: "☀️" },
      { en: "Star", zh: "星星", emoji: "⭐" },
    ],
  },
];

export class LetterBeeGame extends BaseGame {
  constructor() {
    super("letter-bee");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private beeEl!: HTMLDivElement;
  private beeDragging = false;

  protected mount(): void {
    this.roundTotal = this.roundsPerClear();
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private roundsPerClear(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 5;
  }

  private flowerCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 5;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const count = this.flowerCount();

    // 选目标字母 + 干扰字母
    const picked = shuffle(LETTERS).slice(0, count);
    const target = sample(picked);
    const targetWord = sample(target.words);

    // 每朵花显示一个单词（目标字母的花显示 targetWord）
    const flowers = picked.map((l) => {
      if (l.letter === target.letter) return targetWord;
      return sample(l.words);
    });
    const shuffled = shuffle(flowers);

    const wrap = document.createElement("div");
    wrap.className = "lb-wrap";

    const task = document.createElement("div");
    task.className = "lb-task";
    task.innerHTML = `把蜜蜂 🐝 拖到 <span class="lb-letter">${target.letter}</span> 开头的花上<br>
      <span class="lb-hint">找「${target.letter} for ${targetWord.en}」</span>`;
    wrap.appendChild(task);

    /* —— 花朵 —— */
    const garden = document.createElement("div");
    garden.className = "lb-garden";
    const flowerEls: HTMLDivElement[] = [];
    shuffled.forEach((w) => {
      const f = document.createElement("div");
      f.className = "lb-flower";
      f.dataset.letter = w.en[0]!.toUpperCase();
      f.innerHTML = `<div class="lb-flower__emoji">${w.emoji}</div>
        <div class="lb-flower__word">${w.en}</div>`;
      garden.appendChild(f);
      flowerEls.push(f);
    });
    wrap.appendChild(garden);

    /* —— 蜜蜂 —— */
    this.beeEl = document.createElement("div");
    this.beeEl.className = "lb-bee";
    this.beeEl.textContent = "🐝";
    wrap.appendChild(this.beeEl);

    this.root.appendChild(wrap);

    // 蜜蜂拖拽：松手时检测在哪朵花上
    const checkDrop = (p: { x: number; y: number }) => {
      for (const f of flowerEls) {
        const r = f.getBoundingClientRect();
        if (
          p.x >= r.left &&
          p.x <= r.right &&
          p.y >= r.top &&
          p.y <= r.bottom
        ) {
          return f;
        }
      }
      return null;
    };

    const onDown = (p: { x: number; y: number }) => {
      this.beeDragging = true;
      sfxPop();
      this.moveBee(p);
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!this.beeDragging) return;
      this.moveBee(p);
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!this.beeDragging) return;
      this.beeDragging = false;
      const hit = checkDrop(p);
      if (!hit) return;
      if (hit.dataset.letter === target.letter) {
        this.onCorrect(p.x, p.y);
        hit.classList.add("lb-flower--correct");
        this.beeEl.classList.add("lb-bee--dance");
        this.resetWrongStreak();
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1200);
      } else {
        this.beeEl.classList.add("lb-bee--dizzy");
        const paused = this.onWrong();
        this.trackTimeout(
          () => this.beeEl.classList.remove("lb-bee--dizzy"),
          800,
        );
        if (paused) this.showRest();
      }
    };

    // 在整个 wrap 上监听拖拽，蜜蜂才能到处飞
    const unbind = bindPointer(wrap, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(unbind);

    // 初始蜜蜂位置居中下方
    requestAnimationFrame(() => {
      const wr = wrap.getBoundingClientRect();
      this.beeEl.style.left = `${wr.width / 2 - 24}px`;
      this.beeEl.style.top = `${wr.height - 60}px`;
    });
  }

  private moveBee(p: { x: number; y: number }): void {
    const wrap = this.beeEl.parentElement;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    this.beeEl.style.left = `${p.x - wr.left - 24}px`;
    this.beeEl.style.top = `${p.y - wr.top - 24}px`;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "让小蜜蜂也歇歇翅膀～",
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
    if (document.getElementById("lb-style")) return;
    const st = document.createElement("style");
    st.id = "lb-style";
    st.textContent = LB_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function LB_CSS(theme: string): string {
  return `
.lb-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(460px,100%);position:relative;min-height:420px;}
.lb-task{text-align:center;font-size:1.2rem;font-weight:800;line-height:1.5;}
.lb-letter{display:inline-block;color:${theme};background:#fff;padding:2px 14px;border-radius:12px;font-size:1.3em;box-shadow:var(--shadow);}
.lb-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.lb-garden{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:10px;}
.lb-flower{width:96px;height:118px;background:linear-gradient(180deg,#fff,#fff5dc);border-radius:20px;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;transition:transform .2s;}
.lb-flower__emoji{font-size:2.8rem;}
.lb-flower__word{font-size:1rem;font-weight:700;}
.lb-flower--correct{animation:lb-bloom .5s ease;background:linear-gradient(180deg,#d4f4dd,#b8e8c8);}
.lb-bee{position:absolute;width:48px;height:48px;font-size:2.6rem;touch-action:none;z-index:5;transition:none;filter:drop-shadow(0 4px 4px rgba(0,0,0,.2));}
.lb-bee--dance{animation:lb-dance .5s ease;}
.lb-bee--dizzy{animation:lb-dizzy .8s ease;}
@keyframes lb-bloom{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes lb-dance{0%,100%{transform:rotate(0)}25%{transform:rotate(-15deg) translateY(-6px)}75%{transform:rotate(15deg) translateY(-6px)}}
@keyframes lb-dizzy{0%,100%{transform:rotate(0)}20%{transform:rotate(20deg) translateX(-10px)}40%{transform:rotate(-20deg) translateX(10px)}60%{transform:rotate(20deg)}80%{transform:rotate(-15deg)}}
`;
}

export function create(): LetterBeeGame {
  return new LetterBeeGame();
}
