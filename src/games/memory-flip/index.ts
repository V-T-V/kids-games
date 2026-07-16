/* 记忆翻翻乐 Memory Flip —— 翻开两张相同卡片配对，难度递增。
   巧思：连击有连击特效；困难无错通关解锁"记忆大师"。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const ICONS = [
  "🍎",
  "🍌",
  "🍇",
  "🍓",
  "🐶",
  "🐱",
  "🚗",
  "⚽",
  "🌟",
  "🌈",
  "🦋",
  "🐝",
] as const;

interface Card {
  icon: string;
  el: HTMLButtonElement;
  flipped: boolean;
  matched: boolean;
}

export class MemoryFlipGame extends BaseGame {
  constructor() {
    super("memory-flip");
  }

  private cards: Card[] = [];
  private firstPick: Card | null = null;
  private lock = false;
  private moves = 0;
  private wrongMoves = 0;
  private combo = 0;
  private pairs = 0;
  private matchedPairs = 0;

  protected mount(): void {
    this.injectStyle();
    this.startGame();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private pairsForDifficulty(): number {
    if (this.difficulty === "easy") return 3; // 6 张
    if (this.difficulty === "medium") return 5; // 10 张
    return 6; // 12 张
  }

  private startGame(): void {
    this.root.innerHTML = "";
    this.pairs = this.pairsForDifficulty();
    this.matchedPairs = 0;
    this.moves = 0;
    this.wrongMoves = 0;
    this.combo = 0;
    this.firstPick = null;
    this.lock = false;

    const wrap = document.createElement("div");
    wrap.className = "mf-wrap";

    const task = document.createElement("div");
    task.className = "mf-task";
    task.innerHTML = `找出相同的卡片对～ <span class="mf-stat" id="mf-pairs">0/${this.pairs}</span>
      <span class="mf-combo" id="mf-combo"></span>`;
    wrap.appendChild(task);

    const grid = document.createElement("div");
    grid.className = "mf-grid";
    grid.style.setProperty("--cols", String(Math.ceil((this.pairs * 2) / 2)));

    const chosen = shuffle([...ICONS]).slice(0, this.pairs);
    const deck = shuffle([...chosen, ...chosen]);

    this.cards = deck.map((icon) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mf-card";
      btn.innerHTML = `<span class="mf-card__back">❓</span><span class="mf-card__face">${icon}</span>`;
      const card: Card = { icon, el: btn, flipped: false, matched: false };
      btn.addEventListener("click", () => this.flip(card));
      grid.appendChild(btn);
      return card;
    });

    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private flip(card: Card): void {
    if (this.lock || card.flipped || card.matched) return;
    card.flipped = true;
    card.el.classList.add("mf-card--flipped");
    sfxPop();

    if (!this.firstPick) {
      this.firstPick = card;
      return;
    }
    // 第二张
    this.moves += 1;
    const first = this.firstPick;
    this.firstPick = null;
    this.lock = true;

    if (first.icon === card.icon) {
      // 配对成功
      this.trackTimeout(() => {
        first.matched = true;
        card.matched = true;
        first.el.classList.add("mf-card--matched");
        card.el.classList.add("mf-card--matched");
        this.matchedPairs += 1;
        this.combo += 1;
        this.updateStat();
        const r = card.el.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        if (this.combo >= 2) {
          burst(r.left + r.width / 2, r.top + r.height / 2, 12);
        }
        this.resetWrongStreak();
        this.lock = false;
        if (this.matchedPairs >= this.pairs) {
          this.onAllMatched();
        }
      }, 400);
    } else {
      // 不配对，翻回
      this.combo = 0;
      this.wrongMoves += 1;
      this.updateStat();
      const paused = this.onWrong();
      this.trackTimeout(() => {
        first.flipped = false;
        card.flipped = false;
        first.el.classList.remove("mf-card--flipped");
        card.el.classList.remove("mf-card--flipped");
        this.lock = false;
      }, 900);
      if (paused) this.showRest();
    }
  }

  private updateStat(): void {
    const p = this.root.querySelector("#mf-pairs");
    if (p) p.textContent = `${this.matchedPairs}/${this.pairs}`;
    const c = this.root.querySelector("#mf-combo") as HTMLElement | null;
    if (c) {
      c.textContent = this.combo >= 2 ? `🔥 连击 x${this.combo}` : "";
    }
  }

  private onAllMatched(): void {
    // 星数：错误次数越少星越多
    const stars = this.wrongMoves === 0 ? 3 : this.wrongMoves <= 2 ? 2 : 1;
    // 困难无错 → 记忆大师成就
    if (this.difficulty === "hard" && this.wrongMoves === 0) {
      this.unlock("perfect-memory");
    }
    this.trackTimeout(() => this.finishClear(stars), 600);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "记不住没关系，再看一眼～",
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
    if (document.getElementById("mf-style")) return;
    const st = document.createElement("style");
    st.id = "mf-style";
    st.textContent = MF_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function MF_CSS(theme: string): string {
  return `
.mf-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.mf-task{font-size:1.15rem;font-weight:800;text-align:center;}
.mf-stat{color:${theme};}
.mf-combo{display:inline-block;margin-left:10px;color:#ff6348;font-size:.95rem;}
.mf-grid{display:grid;grid-template-columns:repeat(var(--cols,3),1fr);gap:10px;justify-content:center;}
.mf-card{width:88px;height:104px;border-radius:16px;border:none;perspective:600px;background:transparent;cursor:pointer;padding:0;}
.mf-card__back,.mf-card__face{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  border-radius:16px;backface-visibility:hidden;transition:transform .4s ease;font-size:2.4rem;
}
.mf-card__back{background:linear-gradient(135deg,${theme},color-mix(in srgb,${theme} 60%,#000));box-shadow:var(--shadow);}
.mf-card__face{background:#fff;transform:rotateY(180deg);box-shadow:var(--shadow);}
.mf-card{position:relative;transform-style:preserve-3d;transition:transform .4s ease;}
.mf-card--flipped{transform:rotateY(180deg);}
.mf-card--matched .mf-card__face{background:#d4f4dd;animation:mf-bounce .5s ease;}
.mf-card--matched{pointer-events:none;}
@keyframes mf-bounce{0%{transform:scale(1) rotateY(180deg)}50%{transform:scale(1.15) rotateY(180deg)}100%{transform:scale(1) rotateY(180deg)}}
@media (max-width:380px){.mf-card{width:72px;height:88px;}.mf-card__back,.mf-card__face{font-size:2rem;}}
`;
}

export function create(): MemoryFlipGame {
  return new MemoryFlipGame();
}
