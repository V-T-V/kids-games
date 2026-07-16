/* 词语分类 Word Classify —— 把词语拖到对应的类别篮子。
   独特点：按语义类别归类（区别于反义词/形近字的一对一配对）。
   巧思：4 个彩色分类篮，拖词卡进正确篮子，词卡在篮中堆叠。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Category {
  id: string;
  name: string;
  emoji: string;
  words: string[];
}

const CATEGORIES: Category[] = [
  { id: "fruit", name: "水果", emoji: "🍎", words: ["苹果", "香蕉", "葡萄"] },
  { id: "animal", name: "动物", emoji: "🐰", words: ["猫", "狗", "兔"] },
  { id: "stationery", name: "文具", emoji: "✏️", words: ["铅笔", "橡皮"] },
  { id: "furniture", name: "家具", emoji: "🪑", words: ["桌子", "椅子"] },
];

interface Token {
  word: string;
  cat: string;
  el: HTMLElement;
  placed: boolean;
}

export class WordClassifyGame extends BaseGame {
  constructor() {
    super("word-classify");
  }
  private unbinds: (() => void)[] = [];
  private remaining = 0;

  protected mount(): void {
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds = [];
    // 难度决定类别数与每类词数
    const catN =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    const per =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 2 : 3;
    const cats = shuffle(CATEGORIES).slice(0, catN);
    const allTokens: { word: string; cat: string }[] = [];
    cats.forEach((c) => {
      shuffle(c.words)
        .slice(0, Math.min(per, c.words.length))
        .forEach((w) => allTokens.push({ word: w, cat: c.id }));
    });
    this.remaining = allTokens.length;

    const wrap = document.createElement("div");
    wrap.className = "wc-wrap";

    const task = document.createElement("div");
    task.className = "wc-task";
    task.textContent = "把词拖进对应的篮子里～";
    wrap.appendChild(task);

    // 词语区
    const tray = document.createElement("div");
    tray.className = "wc-tray";
    tray.id = "wc-tray";
    const tokens: Token[] = [];
    shuffle(allTokens).forEach((t) => {
      const el = document.createElement("div");
      el.className = "wc-token";
      el.textContent = t.word;
      tray.appendChild(el);
      tokens.push({ ...t, el, placed: false });
    });
    wrap.appendChild(tray);

    // 类别篮子
    const bins = document.createElement("div");
    bins.className = "wc-bins";
    const binEls: HTMLDivElement[] = [];
    cats.forEach((c) => {
      const el = document.createElement("div");
      el.className = "wc-bin";
      el.dataset.id = c.id;
      el.innerHTML = `<div class="wc-bin__emoji">${c.emoji}</div><div class="wc-bin__name">${c.name}</div>`;
      bins.appendChild(el);
      binEls.push(el);
    });
    wrap.appendChild(bins);
    this.root.appendChild(wrap);

    tokens.forEach((t) => this.enableDrag(t, binEls));
  }

  private enableDrag(t: Token, bins: HTMLDivElement[]): void {
    let dragging = false,
      ox = 0,
      oy = 0,
      origin: HTMLElement | null = null;
    const u = bindPointer(t.el, {
      down: (p) => {
        if (t.placed) return;
        dragging = true;
        const r = t.el.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        origin = t.el.parentElement;
        t.el.classList.add("wc-token--drag");
        t.el.style.position = "fixed";
        t.el.style.left = `${p.x - ox}px`;
        t.el.style.top = `${p.y - oy}px`;
        document.body.appendChild(t.el);
        sfxPop();
      },
      move: (p) => {
        if (dragging) {
          t.el.style.left = `${p.x - ox}px`;
          t.el.style.top = `${p.y - oy}px`;
        }
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        t.el.classList.remove("wc-token--drag");
        const bin = bins.find((b) => {
          const r = b.getBoundingClientRect();
          return (
            p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
          );
        });
        if (bin && bin.dataset.id === t.cat) {
          t.placed = true;
          t.el.style.position = "";
          t.el.style.left = "";
          t.el.style.top = "";
          t.el.classList.add("wc-token--in");
          // 放入篮子内（移除 grid 大小，缩小堆叠）
          const inner = document.createElement("div");
          inner.className = "wc-bin__token";
          inner.textContent = t.word;
          t.el.remove();
          bin.appendChild(inner);
          this.remaining -= 1;
          const r = bin.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top);
          this.resetWrongStreak();
          if (this.remaining <= 0) {
            this.trackTimeout(
              () => this.finishClear(starsByAccuracy(this.wrongCount)),
              900,
            );
          }
        } else {
          t.el.style.position = "";
          t.el.style.left = "";
          t.el.style.top = "";
          origin?.appendChild(t.el);
          const paused = this.onWrong();
          if (paused) this.showRest();
        }
      },
    });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想这个词属于哪一类～",
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
    st.textContent = WC_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function WC_CSS(theme: string): string {
  return `
.wc-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(520px,100%);}
.wc-task{font-size:1.1rem;font-weight:800;text-align:center;}
.wc-tray{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;min-height:64px;padding:14px;background:rgba(255,255,255,.5);border-radius:16px;width:100%;max-width:420px;}
.wc-token{min-width:64px;height:54px;padding:0 14px;border-radius:14px;background:${theme};color:#fff;font-size:1.3rem;font-weight:800;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;font-family:'KaiTi','STKaiti',serif;user-select:none;}
.wc-token--drag{cursor:grabbing;transform:scale(1.12);z-index:100;}
.wc-token--in{opacity:0;}
.wc-bins{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.wc-bin{width:120px;min-height:130px;padding:10px 8px;border-radius:20px;background:color-mix(in srgb,${theme} 16%,#fff);border:3px solid ${theme};display:flex;flex-direction:column;align-items:center;gap:6px;}
.wc-bin__emoji{font-size:2.2rem;}
.wc-bin__name{font-size:.9rem;font-weight:800;color:${theme};}
.wc-bin__token{font-size:1rem;font-weight:700;background:#fff;color:var(--ink);padding:3px 10px;border-radius:10px;box-shadow:var(--shadow);animation:wc-drop .4s ease;font-family:'KaiTi','STKaiti',serif;}
@keyframes wc-drop{0%{transform:translateY(-12px) scale(.7);opacity:0}60%{transform:translateY(2px) scale(1.1);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}
`;
}

export function create(): WordClassifyGame {
  return new WordClassifyGame();
}
