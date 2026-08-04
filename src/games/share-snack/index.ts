/* 分零食 Share-Snack —— 把零食公平分给几个好朋友（每人分一样多）。
   社交启蒙：分享 + 公平 + 简单除法。独特点：屏幕上一堆零食和朋友，
   孩子点击零食把它分给下一个朋友（按顺序轮流），分对了每人数量相等。
   数据生成保证总数能被朋友数整除，永远有解。前缀 shsn-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

const SNACKS = ["🍪", "🧁", "🍩", "🥨", "🍫", "🍬"];

interface Round {
  friends: number;
  perFriend: number;
  emoji: string;
}

export class ShareSnackGame extends BaseGame {
  constructor() {
    super("share-snack");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  /** 当前轮：每个朋友已分到的数量。 */
  private plates: number[] = [];
  /** 当前轮：当前轮到的朋友索引（轮流分发）。 */
  private turn = 0;
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 生成保证有解的一轮：朋友数 × 每人数量 = 总数（整除）。
   *  easy: 2 朋友 ×2-3；medium: 3 朋友 ×2-3；hard: 4 朋友 ×2-3。 */
  private genRound(): Round {
    const friends =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const perFriend = this.difficulty === "easy" ? 2 : sample([2, 3]);
    return { friends, perFriend, emoji: sample(SNACKS) };
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const r = this.genRound();
    this.plates = new Array(r.friends).fill(0);
    this.turn = 0;
    this.remaining = r.friends * r.perFriend;

    const wrap = document.createElement("div");
    wrap.className = "shsn-wrap";

    const task = document.createElement("div");
    task.className = "shsn-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把零食<b>公平</b>分给 ${r.friends} 个好朋友，每人一样多！`;
    wrap.appendChild(task);

    // 朋友盘
    const plates = document.createElement("div");
    plates.className = "shsn-plates";
    for (let i = 0; i < r.friends; i++) {
      const p = document.createElement("div");
      p.className = "shsn-plate";
      p.dataset.idx = String(i);
      p.innerHTML =
        `<div class="shsn-plate__friend">🧒</div>` +
        `<div class="shsn-plate__slot" id="shsn-slot-${i}"></div>` +
        `<div class="shsn-plate__count" id="shsn-count-${i}">0</div>`;
      plates.appendChild(p);
    }
    wrap.appendChild(plates);

    // 提示当前轮到谁
    const hint = document.createElement("div");
    hint.className = "shsn-hint";
    hint.id = "shsn-hint";
    hint.textContent = `点零食分给第 1 个朋友～`;
    wrap.appendChild(hint);

    // 零食堆：剩余可点的数量
    const pile = document.createElement("div");
    pile.className = "shsn-pile";
    pile.id = "shsn-pile";
    for (let i = 0; i < this.remaining; i++) {
      const s = document.createElement("button");
      s.type = "button";
      s.className = "shsn-snack";
      s.textContent = r.emoji;
      s.addEventListener("click", () => this.give(s, r, hint, pile));
      pile.appendChild(s);
    }
    wrap.appendChild(pile);
    this.root.appendChild(wrap);
  }

  private give(
    btn: HTMLButtonElement,
    r: Round,
    hint: HTMLElement,
    pile: HTMLElement,
  ): void {
    if (this.locked || this.remaining <= 0) return;
    sfxPop();
    btn.classList.add("shsn-snack--used");
    btn.disabled = true;

    // 分给当前轮到的朋友
    const idx = this.turn;
    if (this.plates[idx] == null) this.plates[idx] = 0;
    this.plates[idx] = this.plates[idx]! + 1;
    const slot = this.root.querySelector<HTMLElement>(`#shsn-slot-${idx}`);
    if (slot) {
      const e = document.createElement("span");
      e.className = "shsn-got";
      e.textContent = r.emoji;
      slot.appendChild(e);
    }
    const cnt = this.root.querySelector<HTMLElement>(`#shsn-count-${idx}`);
    if (cnt) cnt.textContent = String(this.plates[idx]);

    this.remaining -= 1;
    this.resetWrongStreak();

    // 高亮当前朋友
    this.root.querySelectorAll(".shsn-plate").forEach((el, i) => {
      el.classList.toggle("shsn-plate--active", i === idx);
    });
    const rect = btn.getBoundingClientRect();
    this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);

    if (this.remaining <= 0) {
      this.locked = true;
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      // 下一个朋友（轮流）
      this.turn = (this.turn + 1) % r.friends;
      hint.textContent = `点零食分给第 ${this.turn + 1} 个朋友～`;
    }
    void pile;
  }

  private injectStyle(): void {
    if (document.getElementById("shsn-style")) return;
    const st = document.createElement("style");
    st.id = "shsn-style";
    st.textContent = SHN2_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function SHN2_CSS(theme: string): string {
  void theme;
  return `
.shsn-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.shsn-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.shsn-task b{color:#b08968;}
.shsn-plates{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;width:100%;}
.shsn-plate{width:104px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;transition:transform .15s,box-shadow .15s;}
.shsn-plate--active{transform:translateY(-6px) scale(1.05);box-shadow:0 10px 20px rgba(176,137,104,.4);}
.shsn-plate__friend{font-size:2.2rem;}
.shsn-plate__slot{min-height:38px;display:flex;flex-wrap:wrap;gap:2px;justify-content:center;align-items:center;}
.shsn-got{font-size:1.3rem;animation:shsn-drop .35s ease;}
@keyframes shsn-drop{0%{transform:translateY(-16px) scale(.4);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
.shsn-plate__count{font-size:.95rem;font-weight:900;color:#b08968;background:#f5e9df;border-radius:999px;padding:1px 12px;}
.shsn-hint{font-size:.95rem;font-weight:800;color:#7a5a44;background:#fff7f0;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
.shsn-pile{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:20px;box-shadow:var(--shadow);max-width:440px;}
.shsn-snack{width:52px;height:52px;border-radius:50%;border:none;background:#fff;box-shadow:var(--shadow);font-size:1.8rem;cursor:pointer;transition:transform .12s;}
.shsn-snack:active{transform:scale(.85);}
.shsn-snack--used{opacity:.2;pointer-events:none;}
`;
}

export function create(): ShareSnackGame {
  return new ShareSnackGame();
}
