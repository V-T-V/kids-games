/* 南瓜排 Pumpkin Sort —— 几个大小不同的南瓜乱序，按从小到大点击排列。
   独特点：大小排序 + 序列认知。
   视觉：渐变秋日田地 + 南瓜 emoji（CSS scale 控制大小）+ 排序进度。
   巧思：玩家从小到大依次点击；点错则抖动提示。排对后南瓜发光排成一行。
   难度 = 南瓜数。通关 = 排对目标轮数。
   前缀 pk2-（pk- 已被 piano-keys 占用）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

export class PumpkinSortGame extends BaseGame {
  constructor() {
    super("pumpkin-sort");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 当前已点中的下一个目标序号（0=最小，期望先点它）。 */
  private next = 0;
  /** 各槽位上南瓜的 rank id（0 最小）。 */
  private slots: number[] = [];
  private slotEls: HTMLButtonElement[] = [];
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 与 timer 由基类清理 */
  }

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.next = 0;
    this.locked = false;
    this.root.innerHTML = "";
    const n = this.count();
    const ids = Array.from({ length: n }, (_, i) => i);
    // 保证乱序（不恰好已排好）
    let order = shuffle(ids);
    let guard = 0;
    while (order.every((v, i) => v === i) && guard++ < 8) {
      order = shuffle(ids);
    }
    this.slots = order;

    const wrap = document.createElement("div");
    wrap.className = "pk2-wrap";

    const task = document.createElement("div");
    task.className = "pk2-task";
    task.innerHTML = `先点最小的 🎃，一个个排好～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "pk2-hint";
    hint.innerHTML = `<span class="pk2-hint__s">小</span><span class="pk2-hint__arrow">➜</span><span class="pk2-hint__l">大</span>`;
    wrap.appendChild(hint);

    const row = document.createElement("div");
    row.className = "pk2-row";
    this.slotEls = [];
    // scale 从 0.7 到 1.3 等分
    const minS = 0.7;
    const maxS = 1.35;
    this.slots.forEach((rank, slotIdx) => {
      const scale = minS + (rank / Math.max(1, n - 1)) * (maxS - minS);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pk2-pumpkin";
      b.dataset.slot = String(slotIdx);
      b.dataset.rank = String(rank);
      b.style.setProperty("--pk2-scale", scale.toFixed(2));
      b.innerHTML = `<span class="pk2-pumpkin__emoji">🎃</span>`;
      b.addEventListener("click", () => this.clickSlot(slotIdx));
      row.appendChild(b);
      this.slotEls.push(b);
    });
    wrap.appendChild(row);

    const progress = document.createElement("div");
    progress.className = "pk2-progress";
    progress.id = "pk2-progress";
    progress.textContent = `下一个：第 ${this.next + 1} 小`;
    wrap.appendChild(progress);

    this.root.appendChild(wrap);
    this.reportProgress(this.roundsDone, this.roundTotal);
  }

  private clickSlot(slotIdx: number): void {
    if (this.locked) return;
    const rank = this.slots[slotIdx]!;
    const el = this.slotEls[slotIdx]!;
    if (rank === this.next) {
      // 点对
      el.classList.add("pk2-pumpkin--done");
      el.disabled = true;
      sfxPop();
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.next += 1;
      const pg = this.root.querySelector("#pk2-progress");
      if (pg) {
        pg.textContent =
          this.next < this.slots.length
            ? `下一个：第 ${this.next + 1} 小`
            : "全部排好啦！";
      }
      if (this.next >= this.slots.length) {
        this.win();
      }
    } else {
      // 点错：抖动
      el.classList.add("pk2-pumpkin--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => el.classList.remove("pk2-pumpkin--wrong"), 600);
      if (paused) this.showRest();
    }
  }

  private win(): void {
    this.locked = true;
    this.slotEls.forEach((el) => el.classList.add("pk2-pumpkin--win"));
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 1200);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🎃",
      variant: "rest",
      body: "找一找最小的南瓜，从最小的开始点～",
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
    if (document.getElementById("pk2-style")) return;
    const st = document.createElement("style");
    st.id = "pk2-style";
    st.textContent = PK2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function PK2_CSS(theme: string): string {
  return `
.pk2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.pk2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.pk2-hint{display:flex;align-items:center;gap:10px;font-size:1rem;font-weight:800;}
.pk2-hint__s{color:${theme};}
.pk2-hint__l{color:#a04a10;}
.pk2-hint__arrow{font-size:1.3rem;}
.pk2-row{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;justify-content:center;background:linear-gradient(180deg,rgba(255,236,200,.7),rgba(220,180,120,.5));padding:24px 18px;border-radius:22px;box-shadow:var(--shadow);width:100%;max-width:480px;min-height:150px;}
.pk2-pumpkin{border:none;background:transparent;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;transition:transform .15s,filter .2s;}
.pk2-pumpkin__emoji{font-size:54px;line-height:1;transform:scale(var(--pk2-scale,1));transform-origin:center bottom;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));transition:transform .2s,filter .2s;}
.pk2-pumpkin:active{transform:translateY(3px);}
.pk2-pumpkin--done .pk2-pumpkin__emoji{filter:drop-shadow(0 0 8px #6bcf7f);opacity:.55;}
.pk2-pumpkin--done{cursor:default;}
.pk2-pumpkin--wrong{animation:pk2-shake .5s ease;}
.pk2-pumpkin--win .pk2-pumpkin__emoji{filter:drop-shadow(0 0 12px #ffd93d);animation:pk2-bounce .6s ease;}
@keyframes pk2-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-6px) rotate(-5deg);}75%{transform:translateX(6px) rotate(5deg);}}
@keyframes pk2-bounce{0%{transform:scale(var(--pk2-scale,1));}50%{transform:scale(calc(var(--pk2-scale,1) * 1.25));}100%{transform:scale(var(--pk2-scale,1));}}
.pk2-progress{font-size:1rem;font-weight:800;color:#7a4a1a;background:#fff;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
@media (max-width:380px){.pk2-pumpkin__emoji{font-size:42px;}.pk2-row{gap:6px;padding:16px 10px;}}
`;
}

export function create(): PumpkinSortGame {
  return new PumpkinSortGame();
}
