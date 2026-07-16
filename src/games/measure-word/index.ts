/* 量词搭配 Measure Word —— 给名词选正确的量词填空。
   独特点：名量搭配的语法填空（区别于成语的结构补全）。
   巧思：填空式句子卡片，选对量词嵌入空格并整句变绿庆祝。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface MwItem {
  noun: string;
  emoji: string;
  measure: string;
}

const DATA: MwItem[] = [
  { noun: "猫", emoji: "🐱", measure: "只" },
  { noun: "鱼", emoji: "🐟", measure: "条" },
  { noun: "书", emoji: "📖", measure: "本" },
  { noun: "花", emoji: "🌸", measure: "朵" },
  { noun: "树", emoji: "🌳", measure: "棵" },
  { noun: "车", emoji: "🚗", measure: "辆" },
  { noun: "水", emoji: "💧", measure: "杯" },
  { noun: "纸", emoji: "📄", measure: "张" },
];

const ALL_MEASURES = DATA.map((d) => d.measure);
const UNIQUE_MEASURES = [...new Set(ALL_MEASURES)];

export class MeasureWordGame extends BaseGame {
  constructor() {
    super("measure-word");
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
    const item = sample(DATA);
    const distractN =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    const distract = shuffle(
      UNIQUE_MEASURES.filter((m) => m !== item.measure),
    ).slice(0, distractN);
    const options = shuffle([item.measure, ...distract]);
    let answered = false;

    const wrap = document.createElement("div");
    wrap.className = "mw-wrap";

    const task = document.createElement("div");
    task.className = "mw-task";
    task.innerHTML = `选一个正确的量词<span class="mw-hint">（第 ${this.roundsDone + 1}/${this.roundTotal} 题）</span>`;
    wrap.appendChild(task);

    // 填空句子卡片
    const sentence = document.createElement("div");
    sentence.className = "mw-sentence";
    sentence.innerHTML = `
      <span class="mw-num">一</span>
      <span class="mw-blank" id="mw-blank">？</span>
      <span class="mw-emoji">${item.emoji}</span>
      <span class="mw-noun">${item.noun}</span>`;
    wrap.appendChild(sentence);

    const tray = document.createElement("div");
    tray.className = "mw-tray";
    options.forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mw-opt";
      b.textContent = opt;
      b.addEventListener("click", () => {
        if (answered) return;
        if (opt === item.measure) {
          answered = true;
          b.classList.add("mw-opt--done");
          const blank = document.getElementById("mw-blank");
          if (blank) {
            blank.textContent = opt;
            blank.classList.add("mw-blank--fill");
            const r = blank.getBoundingClientRect();
            this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          }
          sentence.classList.add("mw-sentence--ok");
          this.resetWrongStreak();
          this.roundsDone += 1;
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 1000);
        } else {
          b.classList.add("mw-opt--miss");
          const paused = this.onWrong();
          this.trackTimeout(() => b.classList.remove("mw-opt--miss"), 450);
          if (paused) this.showRest();
        }
      });
      tray.appendChild(b);
    });
    wrap.appendChild(tray);
    this.root.appendChild(wrap);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "我们平时是怎么说这个的呀？",
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
    if (document.getElementById("mw-style")) return;
    const st = document.createElement("style");
    st.id = "mw-style";
    st.textContent = MW_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function MW_CSS(theme: string): string {
  return `
.mw-wrap{display:flex;flex-direction:column;align-items:center;gap:26px;width:min(460px,100%);}
.mw-task{font-size:1.1rem;font-weight:800;text-align:center;}
.mw-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;margin-left:4px;}
.mw-sentence{display:flex;align-items:center;gap:12px;padding:24px 28px;border-radius:24px;background:linear-gradient(135deg,#fff,${theme}22);box-shadow:var(--shadow-lg);font-size:2.4rem;font-weight:800;}
.mw-num{color:var(--ink);}
.mw-blank{display:inline-flex;align-items:center;justify-content:center;min-width:72px;height:74px;border-radius:14px;background:color-mix(in srgb,${theme} 18%,#fff);color:${theme};animation:mw-blink 1s ease-in-out infinite;}
.mw-blank--fill{background:#d4f4dd;color:#4ba85f;animation:mw-pop .5s ease;}
.mw-emoji{font-size:2.8rem;}
.mw-noun{font-family:'KaiTi','STKaiti',serif;}
.mw-sentence--ok{animation:mw-cheer .5s ease;}
.mw-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding-top:10px;border-top:2px dashed #ddd;width:100%;max-width:380px;}
.mw-opt{width:70px;height:70px;border-radius:16px;font-size:2.2rem;font-weight:800;background:${theme};color:#fff;box-shadow:var(--shadow);font-family:'KaiTi','STKaiti',serif;transition:transform .15s;}
.mw-opt:active{transform:scale(.92);}
.mw-opt--done{opacity:.35;pointer-events:none;}
.mw-opt--miss{animation:mw-shake .4s ease;background:#ff6348;}
@keyframes mw-blink{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes mw-pop{0%{transform:scale(.5)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes mw-cheer{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}
@keyframes mw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): MeasureWordGame {
  return new MeasureWordGame();
}
