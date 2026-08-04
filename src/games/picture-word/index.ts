/* 看图认字 Picture-Word —— 给一个 emoji 图，从汉字选项里选出对应的字。
   独特点：象形识字入门——把"图画"和"汉字"建立连接，是识字的第一步。
   巧思：emoji 大图直观；选对后朗读该字并显示一个用到它的小词。难度=选项数 + 形近干扰。
   前缀 pw-（picture-word）。3-4 岁友好：大图、少选项、明显不同的干扰。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface PicWord {
  emoji: string;
  word: string;
  /** 一个用到该字的常用小词，答对后展示，帮助记忆 */
  phrase: string;
}

const DATA: PicWord[] = [
  { emoji: "☀️", word: "日", phrase: "太阳" },
  { emoji: "🌙", word: "月", phrase: "月亮" },
  { emoji: "💧", word: "水", phrase: "喝水" },
  { emoji: "🔥", word: "火", phrase: "火苗" },
  { emoji: "🌳", word: "木", phrase: "树木" },
  { emoji: "🪨", word: "石", phrase: "石头" },
  { emoji: "⛰️", word: "山", phrase: "高山" },
  { emoji: "🌾", word: "田", phrase: "田地" },
  { emoji: "👄", word: "口", phrase: "张口" },
  { emoji: "🧍", word: "人", phrase: "大人" },
  { emoji: "✋", word: "手", phrase: "小手" },
  { emoji: "👁️", word: "目", phrase: "目光" },
  { emoji: "🌧️", word: "雨", phrase: "下雨" },
  { emoji: "🚪", word: "门", phrase: "开门" },
  { emoji: "🐎", word: "马", phrase: "小马" },
  { emoji: "🐟", word: "鱼", phrase: "小鱼" },
  { emoji: "🐦", word: "鸟", phrase: "小鸟" },
  { emoji: "🌸", word: "花", phrase: "花朵" },
];

/** 朗读。 */
function speak(text: string): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.8;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export class PictureWordGame extends BaseGame {
  constructor() {
    super("picture-word");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

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

  /** 选项数。easy=2 少选项明显不同，hard=4 含形近干扰。 */
  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const target = sample(DATA);
    // easy：从所有字里随机取明显不同的；hard：优先取形近字（日/目、木/本、口/中…）
    const others = DATA.filter((d) => d.word !== target.word);
    let distractors: PicWord[];
    if (this.difficulty === "hard") {
      // 找形近字：共享相同部首/笔画的优先
      const similar = others.filter((d) => isSimilar(d.word, target.word));
      distractors = shuffle(similar.length >= 3 ? similar : others);
    } else {
      distractors = shuffle(others);
    }
    const opts = shuffle([target, ...distractors.slice(0, this.optCount() - 1)]);

    const wrap = document.createElement("div");
    wrap.className = "pw-wrap";

    const task = document.createElement("div");
    task.className = "pw-task";
    task.innerHTML = `这是什么？<span class="pw-hint">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const pic = document.createElement("div");
    pic.className = "pw-pic";
    pic.textContent = target.emoji;
    wrap.appendChild(pic);

    const grid = document.createElement("div");
    grid.className = "pw-grid";
    for (const opt of opts) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pw-opt";
      b.textContent = opt.word;
      b.addEventListener("click", () =>
        this.choose(opt, target, b, grid),
      );
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private choose(
    opt: PicWord,
    target: PicWord,
    btn: HTMLButtonElement,
    grid: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (opt.word === target.word) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".pw-opt").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      btn.classList.add("pw-opt--right");
      // 朗读字 + 显示词组
      this.trackTimeout(() => speak(target.word), 100);
      const phraseEl = document.createElement("div");
      phraseEl.className = "pw-phrase";
      phraseEl.textContent = `${target.word} · ${target.phrase}`;
      grid.parentElement!.appendChild(phraseEl);
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("pw-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("pw-opt--wrong"), 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "仔细看看图，想一想这个字长什么样～",
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
    if (document.getElementById("pw-style")) return;
    const st = document.createElement("style");
    st.id = "pw-style";
    st.textContent = PW_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

/** 判断两个字是否形近（共享某个笔画部件）。 */
function isSimilar(a: string, b: string): boolean {
  const SIMILAR_GROUPS = [
    ["日", "目", "白", "田"],
    ["木", "本", "禾", "术"],
    ["口", "中", "日"],
    ["人", "入", "大"],
    ["大", "太", "犬"],
    ["手", "毛"],
    ["山", "出"],
    ["石", "右"],
    ["水", "冰"],
    ["火", "灭"],
    ["月", "目"],
    ["田", "由"],
  ];
  return SIMILAR_GROUPS.some((g) => g.includes(a) && g.includes(b));
}

function PW_CSS(theme: string): string {
  return `
.pw-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(440px,100%);}
.pw-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.pw-hint{font-size:.78rem;color:var(--ink-soft,#888);font-weight:600;margin-left:8px;}
.pw-pic{font-size:6.5rem;line-height:1;user-select:none;filter:drop-shadow(0 8px 14px rgba(0,0,0,.15));animation:pw-bounce 2.2s ease-in-out infinite;}
@keyframes pw-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.pw-grid{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;}
.pw-opt{min-width:90px;min-height:84px;padding:0 20px;border-radius:20px;background:#fff;font-weight:900;font-size:2.6rem;color:${theme};box-shadow:var(--shadow);font-family:'KaiTi','STKaiti',serif;transition:transform .15s;}
.pw-opt:active{transform:scale(.93);}
.pw-opt--right{background:#d4f4dd;outline:5px solid #34c759;color:#2e8b57;animation:pw-pop .4s ease;}
.pw-opt--wrong{background:#ffe0e0;outline:5px solid #ff3b30;animation:pw-shake .45s ease;}
.pw-phrase{margin-top:6px;font-size:1.5rem;font-weight:800;color:${theme};font-family:'KaiTi','STKaiti',serif;animation:pw-pop .4s ease;}
@keyframes pw-pop{0%{transform:scale(.6)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes pw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.pw-pic{font-size:5rem;}.pw-opt{min-width:78px;min-height:74px;font-size:2.1rem;}}
`;
}

export function create(): PictureWordGame {
  return new PictureWordGame();
}
