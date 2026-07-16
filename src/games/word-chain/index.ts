/* 词语接龙 Word Chain —— 把首尾字相接的词语排成一条链。
   独特点：首尾字相接的语言规则（区别于反义词/拼音的配对）。
   巧思：给若干词卡，排出接龙链；答对链条连成彩虹。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Card {
  word: string;
  head: string;
  tail: string;
}
// 预设接龙链（头尾字相接）
const CHAINS: Card[][] = [
  [
    { word: "牛奶", head: "牛", tail: "奶" },
    { word: "奶糖", head: "奶", tail: "糖" },
    { word: "糖果", head: "糖", tail: "果" },
  ],
  [
    { word: "上楼", head: "上", tail: "楼" },
    { word: "楼上", head: "楼", tail: "上" },
    { word: "上学", head: "上", tail: "学" },
  ],
  [
    { word: "山水", head: "山", tail: "水" },
    { word: "水果", head: "水", tail: "果" },
    { word: "果树", head: "果", tail: "树" },
  ],
];

export class WordChainGame extends BaseGame {
  constructor() {
    super("word-chain");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private chain: Card[] = [];
  private placed: Card[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.chain = shuffle(CHAINS)[0]!;
    this.placed = [];
    const cards = shuffle(this.chain);

    const wrap = document.createElement("div");
    wrap.className = "wc-wrap";
    const task = document.createElement("div");
    task.className = "wc-task";
    task.innerHTML = `从「<span class="wc-start">${this.chain[0]!.word}</span>」开始，排接龙～<br><span class="wc-hint">后一个词的开头要和前一个的结尾一样</span>`;
    wrap.appendChild(task);

    const slots = document.createElement("div");
    slots.className = "wc-slots";
    slots.id = "wc-slots";
    for (let i = 0; i < this.chain.length; i++) {
      const s = document.createElement("div");
      s.className = "wc-slot";
      s.dataset.idx = String(i);
      s.textContent = i === 0 ? this.chain[0]!.word : "？";
      if (i === 0) s.classList.add("wc-slot--filled");
      slots.appendChild(s);
    }
    wrap.appendChild(slots);

    const tray = document.createElement("div");
    tray.className = "wc-tray";
    cards
      .filter((c) => c !== this.chain[0])
      .forEach((c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "wc-card";
        b.textContent = c.word;
        b.addEventListener("click", () => this.place(c, b));
        tray.appendChild(b);
      });
    wrap.appendChild(tray);
    this.root.appendChild(wrap);
  }

  private place(c: Card, btn: HTMLButtonElement): void {
    const nextIdx = this.placed.length + 1; // 0 已放，下一个是 1
    const prev =
      nextIdx === 0
        ? this.chain[0]
        : (this.placed[nextIdx - 1] ?? this.chain[0]);
    void prev;
    // 正确的下一个是 chain[nextIdx]
    const expected = this.chain[nextIdx];
    if (c === expected) {
      this.placed.push(c);
      btn.classList.add("wc-card--gone");
      const slots = this.root.querySelectorAll(".wc-slot");
      const s = slots[nextIdx] as HTMLElement;
      s.textContent = c.word;
      s.classList.add("wc-slot--filled");
      sfxPop();
      const r = s.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      if (this.placed.length >= this.chain.length - 1) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1000);
      }
    } else {
      btn.classList.add("wc-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("wc-card--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看哪个词的开头接得上～",
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
    if (document.getElementById("wc-style")) return;
    const st = document.createElement("style");
    st.id = "wc-style";
    st.textContent = WC_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function WC_CSS(theme: string): string {
  return `
.wc-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.wc-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.wc-start{color:${theme};font-size:1.2em;}
.wc-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.wc-slots{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.wc-slot{min-width:72px;height:56px;padding:0 10px;border-radius:14px;background:#fff;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:800;color:var(--ink-soft);}
.wc-slot--filled{background:#d4f4dd;color:var(--ink);animation:wc-pop .4s ease;}
.wc-tray{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding-top:8px;border-top:2px dashed #ddd;width:100%;max-width:380px;}
.wc-card{min-width:72px;height:56px;padding:0 12px;border-radius:14px;background:${theme};color:#fff;font-size:1.3rem;font-weight:800;box-shadow:var(--shadow);}
.wc-card:active{transform:scale(.93);}
.wc-card--gone{opacity:.3;pointer-events:none;}
.wc-card--wrong{animation:wc-shake .4s ease;}
@keyframes wc-pop{0%{transform:scale(.7)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes wc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): WordChainGame {
  return new WordChainGame();
}
