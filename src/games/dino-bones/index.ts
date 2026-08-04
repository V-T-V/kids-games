/* 恐龙骨头 Dino Bones —— 几根长短不同的骨头乱序，孩子按从短到长排列。
   独特点：长度排序 + 拼成恐龙骨架的成就感。区别于 length（比较单根）、size-sort（整体大小）。
   视觉：骨头 emoji 横排，可点击交换到目标槽位；排对后组成完整骨架发光。
   难度 = 骨头数量。通关 = 排对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

export class DinoBonesGame extends BaseGame {
  constructor() {
    super("dino-bones");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  /** 当前选中的源槽位（点击第一根），点第二根交换 */
  private picked: number | null = null;
  /** 当前各槽位上骨头的 id（长度顺序），目标是 [0,1,2,...] */
  private slots: number[] = [];
  private slotEls: HTMLButtonElement[] = [];

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
    this.picked = null;
    this.root.innerHTML = "";
    const n = this.count();
    // 骨头宽度从 60 起递增，间距 26
    const ids = Array.from({ length: n }, (_, i) => i);
    this.slots = shuffle(ids);

    const wrap = document.createElement("div");
    wrap.className = "db-wrap";
    const task = document.createElement("div");
    task.className = "db-task";
    task.textContent = `把骨头从短到长排好～点两根交换位置（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 目标提示行：从短到长的箭头
    const hint = document.createElement("div");
    hint.className = "db-hint";
    hint.innerHTML = `<span class="db-hint__s">短</span><span class="db-hint__arrow">➜</span><span class="db-hint__l">长</span>`;
    wrap.appendChild(hint);

    const row = document.createElement("div");
    row.className = "db-row";
    this.slotEls = [];
    const widths = ids.map((i) => 60 + i * 26);
    this.slots.forEach((boneId, slotIdx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "db-bone";
      b.style.width = `${widths[boneId]!}px`;
      b.innerHTML = `<span class="db-bone__emoji">🦴</span>`;
      b.dataset.slot = String(slotIdx);
      b.addEventListener("click", () => this.clickSlot(slotIdx));
      row.appendChild(b);
      this.slotEls.push(b);
    });
    wrap.appendChild(row);

    // 骨架（排对后点亮）
    const skeleton = document.createElement("div");
    skeleton.className = "db-skeleton";
    skeleton.id = "db-skeleton";
    skeleton.innerHTML = "🦖";
    wrap.appendChild(skeleton);

    this.root.appendChild(wrap);
  }

  private clickSlot(slotIdx: number): void {
    if (this.picked === null) {
      this.picked = slotIdx;
      this.slotEls[slotIdx]!.classList.add("db-bone--picked");
      sfxPop();
      return;
    }
    if (this.picked === slotIdx) {
      // 再次点同一根取消
      this.slotEls[slotIdx]!.classList.remove("db-bone--picked");
      this.picked = null;
      return;
    }
    // 交换 picked 与 slotIdx 的骨头
    const a = this.picked;
    const b = slotIdx;
    const tmp = this.slots[a]!;
    this.slots[a] = this.slots[b]!;
    this.slots[b] = tmp;
    // 更新 DOM 宽度
    const widths = Array.from(
      { length: this.slots.length },
      (_, i) => 60 + i * 26,
    );
    this.slots.forEach((boneId, i) => {
      this.slotEls[i]!.style.width = `${widths[boneId]!}px`;
      this.slotEls[i]!.classList.remove("db-bone--picked");
    });
    this.picked = null;
    sfxPop();
    this.checkWin();
  }

  private checkWin(): void {
    const sorted = this.slots.every((v, i) => v === i);
    if (!sorted) return;
    // 排对了
    this.slotEls.forEach((el) => el.classList.add("db-bone--done"));
    const sk = this.root.querySelector("#db-skeleton");
    if (sk) sk.classList.add("db-skeleton--win");
    const r = this.slotEls[this.slotEls.length - 1]!.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal)
        this.finishClear(starsByAccuracy(this.wrongCount));
      else this.startRound();
    }, 1300);
  }

  private injectStyle(): void {
    if (document.getElementById("db-style")) return;
    const st = document.createElement("style");
    st.id = "db-style";
    st.textContent = DB_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function DB_CSS(theme: string): string {
  return `
.db-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(560px,100%);}
.db-task{font-size:1.1rem;font-weight:800;text-align:center;}
.db-hint{display:flex;align-items:center;gap:10px;font-size:1rem;font-weight:700;color:var(--ink-soft);}
.db-hint__s{color:${theme};}.db-hint__l{color:${theme};}
.db-hint__arrow{font-size:1.2rem;}
.db-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;background:rgba(255,255,255,.55);padding:14px;border-radius:18px;box-shadow:var(--shadow);}
.db-bone{height:46px;border:none;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:width .25s ease,transform .12s ease;padding:0;}
.db-bone__emoji{font-size:1.6rem;filter:drop-shadow(0 2px 2px rgba(0,0,0,.18));display:inline-block;}
.db-bone:active{transform:scale(.95);}
.db-bone--picked{filter:drop-shadow(0 0 8px ${theme});transform:translateY(-6px);}
.db-bone--picked .db-bone__emoji{animation:db-bob .5s ease infinite alternate;}
.db-bone--done .db-bone__emoji{filter:drop-shadow(0 0 6px #6bcf7f);}
.db-skeleton{font-size:3.2rem;opacity:.3;transition:opacity .5s ease,transform .5s ease;transform:scale(.8);}
.db-skeleton--win{opacity:1;transform:scale(1.05);animation:db-roar .6s ease;}
@keyframes db-bob{0%{transform:translateY(0)}100%{transform:translateY(-4px)}}
@keyframes db-roar{0%{transform:scale(.8) rotate(-5deg)}50%{transform:scale(1.2) rotate(5deg)}100%{transform:scale(1.05) rotate(0)}}
@media (max-width:380px){.db-row{gap:4px;padding:10px;}.db-bone__emoji{font-size:1.4rem;}}
`;
}

export function create(): DinoBonesGame {
  return new DinoBonesGame();
}
