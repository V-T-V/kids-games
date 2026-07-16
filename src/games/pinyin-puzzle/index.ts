/* 拼音拼图 Pinyin Puzzle —— 给汉字，从散落的声母韵母中拼出拼音。
   独特点：声母+韵母的组合拼装（区别于拼音首字母识别）。
   巧思：点两个片段即组合，正确组合亮起并填入答案槽，散落卡片带彩色。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Word {
  hanzi: string;
  initial: string;
  final: string;
}

// 难度从简到繁：声母韵母复杂度递增
const WORDS: Word[] = [
  { hanzi: "妈", initial: "m", final: "a" },
  { hanzi: "波", initial: "b", final: "o" },
  { hanzi: "婆", initial: "p", final: "o" },
  { hanzi: "马", initial: "m", final: "a" },
  { hanzi: "哥", initial: "g", final: "e" },
  { hanzi: "河", initial: "h", final: "e" },
  { hanzi: "鸡", initial: "j", final: "i" },
  { hanzi: "七", initial: "q", final: "i" },
  { hanzi: "花", initial: "h", final: "ua" },
  { hanzi: "瓜", initial: "g", final: "ua" },
  { hanzi: "火", initial: "h", final: "uo" },
  { hanzi: "多", initial: "d", final: "uo" },
  { hanzi: "鸟", initial: "n", final: "iao" },
  { hanzi: "桥", initial: "q", final: "iao" },
];

// 干扰片段池
const DISTRACTORS = [
  "b",
  "p",
  "d",
  "t",
  "n",
  "l",
  "a",
  "o",
  "e",
  "i",
  "u",
  "ai",
  "ei",
  "ao",
  "ou",
  "an",
  "en",
];

export class PinyinPuzzleGame extends BaseGame {
  constructor() {
    super("pinyin-puzzle");
  }
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    const word = sample(WORDS);
    // 干扰数随难度
    const distractN =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    const distract = shuffle(
      DISTRACTORS.filter((d) => d !== word.initial && d !== word.final),
    ).slice(0, distractN);
    const fragments = shuffle([word.initial, word.final, ...distract]);
    const picked: string[] = [];

    const wrap = document.createElement("div");
    wrap.className = "pp-wrap";

    const task = document.createElement("div");
    task.className = "pp-task";
    task.innerHTML = `把「<b>${word.hanzi}</b>」的拼音拼出来～<br><span class="pp-hint">点一个声母 + 一个韵母</span>`;
    wrap.appendChild(task);

    const hanziCard = document.createElement("div");
    hanziCard.className = "pp-hanzi";
    hanziCard.textContent = word.hanzi;
    wrap.appendChild(hanziCard);

    const slot = document.createElement("div");
    slot.className = "pp-slot";
    slot.innerHTML = `<span class="pp-slot__in">?</span><span class="pp-slot__add">+</span><span class="pp-slot__out">?</span>`;
    wrap.appendChild(slot);

    const tray = document.createElement("div");
    tray.className = "pp-tray";
    const fragEls: HTMLButtonElement[] = [];
    fragments.forEach((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pp-frag";
      b.textContent = f;
      b.addEventListener("click", () =>
        this.pick(f, b, picked, word, fragEls, slot, hanziCard),
      );
      tray.appendChild(b);
      fragEls.push(b);
    });
    wrap.appendChild(tray);
    this.root.appendChild(wrap);
  }

  private pick(
    frag: string,
    btn: HTMLButtonElement,
    pickedRef: string[],
    word: Word,
    allFrags: HTMLButtonElement[],
    slot: HTMLElement,
    hanziCard: HTMLElement,
  ): void {
    if (btn.classList.contains("pp-frag--used")) return;
    pickedRef.push(frag);
    btn.classList.add("pp-frag--used");
    sfxPop();
    // 更新槽位
    const inEl = slot.querySelector(".pp-slot__in");
    const outEl = slot.querySelector(".pp-slot__out");
    if (pickedRef.length === 1) {
      if (inEl) inEl.textContent = frag;
    } else if (pickedRef.length === 2) {
      if (outEl) outEl.textContent = frag;
      // 判定
      const [a, b] = pickedRef;
      const ok =
        (a === word.initial && b === word.final) ||
        (a === word.final && b === word.initial);
      this.trackTimeout(() => {
        if (ok) {
          slot.classList.add("pp-slot--ok");
          hanziCard.classList.add("pp-hanzi--ok");
          const r = hanziCard.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          this.roundsDone += 1;
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 950);
        } else {
          slot.classList.add("pp-slot--bad");
          const paused = this.onWrong();
          this.trackTimeout(() => {
            slot.classList.remove("pp-slot--bad");
            // 复位
            pickedRef.length = 0;
            if (inEl) inEl.textContent = "?";
            if (outEl) outEl.textContent = "?";
            allFrags.forEach((f) => f.classList.remove("pp-frag--used"));
          }, 500);
          if (paused) this.showRest();
        }
      }, 250);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先想想这个字的拼音怎么念～",
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
    if (document.getElementById("pp-style")) return;
    const st = document.createElement("style");
    st.id = "pp-style";
    st.textContent = PP_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function PP_CSS(theme: string): string {
  return `
.pp-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.pp-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.pp-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.pp-hanzi{width:120px;height:120px;border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:4rem;font-weight:800;color:#fff;background:linear-gradient(135deg,${theme},#7fb2ff);box-shadow:var(--shadow-lg);transition:transform .3s;}
.pp-hanzi--ok{animation:pp-pop .5s ease;background:linear-gradient(135deg,#6bcf7f,#4ba85f);}
.pp-slot{display:flex;align-items:center;gap:10px;font-size:2rem;font-weight:800;}
.pp-slot__in,.pp-slot__out{display:inline-flex;align-items:center;justify-content:center;min-width:64px;height:60px;padding:0 12px;border-radius:14px;background:#fff;box-shadow:var(--shadow);color:${theme};}
.pp-slot__add{color:var(--ink-soft);}
.pp-slot--ok .pp-slot__in,.pp-slot--ok .pp-slot__out{background:#d4f4dd;color:#4ba85f;animation:pp-pop .4s ease;}
.pp-slot--bad{animation:pp-shake .4s ease;}
.pp-tray{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding-top:8px;border-top:2px dashed #ddd;width:100%;max-width:380px;}
.pp-frag{min-width:72px;height:60px;padding:0 14px;border-radius:16px;font-size:1.5rem;font-weight:800;background:#fff;color:var(--ink);box-shadow:var(--shadow);transition:transform .15s,opacity .2s;}
.pp-frag:active{transform:scale(.92);}
.pp-frag--used{opacity:.3;pointer-events:none;}
@keyframes pp-pop{0%{transform:scale(.7)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes pp-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): PinyinPuzzleGame {
  return new PinyinPuzzleGame();
}
