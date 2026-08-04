/* 空间记忆 Spatial-Memory —— 几个格子短暂亮起再熄灭，记住并点出位置（海马体·空间工作记忆）。
   独特点：记忆而非搜索（区别于 schulte-grid 的"按序搜索"、memory-flip 的"翻牌配对"，
           这里是瞬时空间位置记忆，训练海马体空间工作记忆，难度=格子数+网格大小+显示时间）。
   巧思：亮起用 sfxPop 同步提示，熄灭后孩子凭记忆点击；点对高亮、点错抖动，全点对通关一关。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

export class SpatialMemoryGame extends BaseGame {
  constructor() {
    super("spatial-memory");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private size = 3;
  private litCells: number[] = [];
  private foundCount = 0;
  private accepting = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空，定时器由基类清理 */
  }

  /** 网格大小：easy 3x3，medium 3x3（亮更多），hard 4x4。 */
  private gridSize(): number {
    return this.difficulty === "hard" ? 4 : 3;
  }

  /** 亮起格子数：随轮次渐进增加，封顶在网格容量的一半。 */
  private litCount(): number {
    const base = this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 3;
    const extra = Math.floor(this.roundsDone / 3);
    const max = Math.floor((this.size * this.size) / 2);
    return Math.min(base + extra, max);
  }

  /** 显示时长（毫秒）：easy 长，hard 短。 */
  private showDuration(): number {
    if (this.difficulty === "easy") return 1800;
    if (this.difficulty === "medium") return 1400;
    return 1000;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.size = this.gridSize();
    this.foundCount = 0;
    this.accepting = false;
    const total = this.size * this.size;
    const n = this.litCount();
    // 随机选 n 个亮起的位置
    this.litCells = shuffle(Array.from({ length: total }, (_, i) => i)).slice(0, n);

    const wrap = document.createElement("div");
    wrap.className = "spm-wrap";

    const task = document.createElement("div");
    task.className = "spm-task";
    task.id = "spm-task";
    task.textContent = "记住亮起来的格子…";
    wrap.appendChild(task);

    const status = document.createElement("div");
    status.className = "spm-status";
    status.id = "spm-status";
    status.textContent = `还要找 ${n} 个`;
    wrap.appendChild(status);

    const grid = document.createElement("div");
    grid.className = "spm-grid";
    grid.style.setProperty("--size", String(this.size));
    for (let i = 0; i < total; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "spm-cell";
      b.dataset.idx = String(i);
      b.addEventListener("click", () => this.tap(i, b));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);

    this.root.appendChild(wrap);

    // 播放亮起序列
    this.playLit();
  }

  private playLit(): void {
    // 逐个亮起并播放音效
    this.litCells.forEach((idx, i) => {
      this.trackTimeout(() => {
        const cell = this.root.querySelector<HTMLElement>(
          `.spm-cell[data-idx="${idx}"]`,
        );
        if (cell) {
          cell.classList.add("spm-cell--lit");
          sfxPop();
        }
      }, i * 250);
    });
    // 显示时长后全部熄灭，进入作答
    const litDone = this.litCells.length * 250 + 200;
    this.trackTimeout(() => {
      this.root.querySelectorAll(".spm-cell--lit").forEach((c) => {
        c.classList.remove("spm-cell--lit");
        c.classList.add("spm-cell--dim");
      });
      this.accepting = true;
      const t = this.root.querySelector("#spm-task");
      if (t) t.textContent = "点出刚才亮过的格子！";
    }, litDone + this.showDuration());
  }

  private tap(idx: number, btn: HTMLButtonElement): void {
    if (!this.accepting) return;
    if (btn.classList.contains("spm-cell--done")) return;
    if (this.litCells.includes(idx)) {
      btn.classList.add("spm-cell--done");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.foundCount += 1;
      const left = this.litCells.length - this.foundCount;
      const status = this.root.querySelector<HTMLElement>("#spm-status");
      if (status) status.textContent = `还要找 ${left} 个`;
      if (this.foundCount >= this.litCells.length) {
        this.accepting = false;
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 800);
      }
    } else {
      btn.classList.add("spm-cell--shake");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("spm-cell--shake"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "仔细看格子亮的位置，记住再点～",
      primary: {
        text: "再看一次",
        icon: "🔁",
        onClick: () => {
          ov.destroy();
          this.foundCount = 0;
          this.accepting = false;
          // 重置网格状态后重播
          this.root.querySelectorAll(".spm-cell").forEach((c) => {
            c.classList.remove(
              "spm-cell--done",
              "spm-cell--lit",
              "spm-cell--dim",
              "spm-cell--shake",
            );
          });
          const status = this.root.querySelector<HTMLElement>("#spm-status");
          if (status) status.textContent = `还要找 ${this.litCells.length} 个`;
          const t = this.root.querySelector("#spm-task");
          if (t) t.textContent = "记住亮起来的格子…";
          this.playLit();
        },
      },
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
    if (document.getElementById("spm-style")) return;
    const st = document.createElement("style");
    st.id = "spm-style";
    st.textContent = SPM_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SPM_CSS(theme: string): string {
  return `
.spm-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.spm-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.spm-status{font-size:1.25rem;font-weight:900;color:${theme};min-height:1.6rem;text-align:center;}
.spm-grid{display:grid;grid-template-columns:repeat(var(--size,3),1fr);gap:10px;padding:18px;background:linear-gradient(#eef9f0,#fff);border-radius:22px;box-shadow:var(--shadow);border:3px solid ${theme}44;width:min(440px,94%);}
.spm-cell{aspect-ratio:1;min-width:48px;min-height:48px;border-radius:14px;border:none;background:#fff;box-shadow:0 3px 0 rgba(0,0,0,.08);cursor:pointer;transition:transform .1s,background .2s;display:flex;align-items:center;justify-content:center;touch-action:manipulation;}
.spm-cell:active{transform:scale(.94);}
.spm-cell--lit{background:linear-gradient(160deg,#a7f3c5,#34d399);box-shadow:0 0 0 6px ${theme}55;animation:spm-flash .3s ease;}
.spm-cell--dim{background:#eef2f0;}
.spm-cell--done{background:linear-gradient(160deg,#bfe3c1,#6bcf7f);color:#fff;animation:spm-pop .3s ease;}
.spm-cell--done::after{content:"✓";font-size:1.6rem;font-weight:900;color:#fff;}
.spm-cell--shake{animation:spm-shake .4s ease;}
@keyframes spm-flash{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes spm-pop{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes spm-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.spm-grid{gap:7px;padding:12px;}}
`;
}

export function create(): SpatialMemoryGame {
  return new SpatialMemoryGame();
}
