/* 大小排队 Size Sort —— 按从小到大顺序点击物品。
   巧思：排序正确后物品手拉手跳舞；难度递增物品数量。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

const ITEMS = ["🍎", "🐻", "⭐", "🎈", "🌼", "🐳"] as const;

interface Piece {
  emoji: string;
  size: number; // 1..N
  el: HTMLButtonElement;
}

export class SizeSortGame extends BaseGame {
  constructor() {
    super("size-sort");
  }

  private expected = 1;
  private pieces: Piece[] = [];
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.expected = 1;
    const n = this.count();
    const emoji = sample(ITEMS);
    const sizes = shuffle(Array.from({ length: n }, (_, i) => i + 1));

    const wrap = document.createElement("div");
    wrap.className = "ssz-wrap";
    const task = document.createElement("div");
    task.className = "ssz-task";
    task.textContent = `先点最小的 ${emoji}，一个个排好～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "ssz-stage";
    this.pieces = sizes.map((sz) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ssz-piece";
      btn.textContent = emoji;
      btn.style.fontSize = `${1.6 + sz * 0.9}rem`;
      stage.appendChild(btn);
      const p: Piece = { emoji, size: sz, el: btn };
      btn.addEventListener("click", () => this.onClick(p));
      return p;
    });
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
  }

  private onClick(p: Piece): void {
    if (p.el.classList.contains("ssz-piece--done")) return;
    if (p.size === this.expected) {
      p.el.classList.add("ssz-piece--done");
      sfxPop();
      const r = p.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.expected += 1;
      if (this.expected > this.count()) {
        this.roundsDone += 1;
        // 全部跳舞
        this.pieces.forEach((pc) => pc.el.classList.add("ssz-piece--dance"));
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1300);
      }
    } else {
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先找最小的那个哦～",
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
    if (document.getElementById("ssz-style")) return;
    const st = document.createElement("style");
    st.id = "ssz-style";
    st.textContent = SS_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function SS_CSS(_theme: string): string {
  return `
.ssz-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(520px,100%);}
.ssz-task{font-size:1.2rem;font-weight:800;text-align:center;}
.ssz-stage{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;align-items:flex-end;padding:20px;min-height:160px;}
.ssz-piece{background:transparent;line-height:1.2;filter:drop-shadow(0 4px 4px rgba(0,0,0,.15));transition:transform .2s;}
.ssz-piece:active{transform:scale(.9);}
.ssz-piece--done{opacity:.35;pointer-events:none;}
.ssz-piece--dance{animation:ssz-dance .6s ease infinite;opacity:1!important;}
@keyframes ssz-dance{0%,100%{transform:translateY(0) rotate(-8deg)}50%{transform:translateY(-14px) rotate(8deg)}}
`;
}

export function create(): SizeSortGame {
  return new SizeSortGame();
}
