/* 蚂蚁排队 Ant March —— 几只大小不同的蚂蚁乱序排列，按从小到大点它们。
   独特点：蚂蚁 emoji 大小不同，点对后整队前进，点错队伍混乱抖动。
   巧思：蚂蚁数随难度增加，体型差异缩小（hard 更难分辨）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Ant {
  /** 排名（0=最小） */
  rank: number;
  /** 字号 px */
  size: number;
  el: HTMLButtonElement;
}

export class AntMarchGame extends BaseGame {
  constructor() {
    super("ant-march");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private ants: Ant[] = [];
  private nextRank = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private antCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.ants = [];
    this.nextRank = 0;

    const count = this.antCount();
    // 字号区间随难度收窄
    const baseMin = this.difficulty === "hard" ? 34 : 28;
    const baseMax = this.difficulty === "hard" ? 60 : 70;
    const step = (baseMax - baseMin) / Math.max(1, count - 1);
    const ranks = shuffle(Array.from({ length: count }, (_, i) => i));

    const wrap = document.createElement("div");
    wrap.className = "am-wrap";

    const task = document.createElement("div");
    task.className = "am-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 按<b>从小到大</b>点小蚂蚁`;
    wrap.appendChild(task);

    // 地面 + 蚂蚁队列
    const ground = document.createElement("div");
    ground.className = "am-ground";
    const line = document.createElement("div");
    line.className = "am-line";
    line.innerHTML = `<span class="am-flag">🏁</span>`;

    for (let i = 0; i < count; i++) {
      const rank = ranks[i]!;
      const size = Math.round(baseMin + step * rank);
      const a = document.createElement("button");
      a.type = "button";
      a.className = "am-ant";
      a.style.fontSize = `${size}px`;
      a.dataset.rank = String(rank);
      a.textContent = "🐜";
      a.addEventListener("click", () => this.tap(a, rank));
      line.appendChild(a);
      this.ants.push({ rank, size, el: a });
    }
    ground.appendChild(line);
    wrap.appendChild(ground);

    // 进度提示
    const hint = document.createElement("div");
    hint.className = "am-hint";
    hint.innerHTML = `已排好 <b id="am-done">0</b>/${count}`;
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
  }

  private tap(el: HTMLButtonElement, rank: number): void {
    if (el.classList.contains("am-ant--done")) return;
    if (rank === this.nextRank) {
      sfxPop();
      el.classList.add("am-ant--done");
      // 已排好的蚂蚁重新按顺序靠左排列
      this.relOrder();
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.nextRank += 1;
      const doneEl = this.root.querySelector("#am-done");
      if (doneEl) doneEl.textContent = String(this.nextRank);
      if (this.nextRank >= this.ants.length) {
        // 整队前进
        this.root.querySelector(".am-line")?.classList.add("am-line--march");
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1100);
      }
    } else {
      // 整队抖动
      this.root.querySelector(".am-line")?.classList.add("am-shake");
      this.trackTimeout(
        () => this.root.querySelector(".am-line")?.classList.remove("am-shake"),
        500,
      );
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  /** 把已 done 的蚂蚁按点选顺序排到左侧（order 自增）。 */
  private relOrder(): void {
    let order = 1; // 0 是终点旗
    for (const ant of this.ants) {
      if (ant.el.classList.contains("am-ant--done")) {
        ant.el.style.order = String(order);
        order += 1;
      }
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先找最小的蚂蚁，再慢慢找大一点的～",
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
    if (document.getElementById("am-style")) return;
    const st = document.createElement("style");
    st.id = "am-style";
    st.textContent = AM_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function AM_CSS(theme: string): string {
  return `
.am-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.am-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.am-ground{width:100%;background:linear-gradient(180deg,#a8e6a3,#7cc77a);border-radius:20px;padding:18px 10px;box-shadow:var(--shadow);}
.am-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;}
.am-line--march{animation:am-march 1.1s ease forwards;}
@keyframes am-march{0%{transform:translateX(0)}100%{transform:translateX(40px)}}
.am-flag{font-size:2.2rem;order:0;}
.am-ant{border:none;cursor:pointer;background:transparent;padding:0 4px;line-height:1;transition:transform .2s,opacity .3s;order:99;}
.am-ant:active{transform:scale(.9);}
.am-ant--done{filter:drop-shadow(0 0 6px ${theme});animation:am-hop .4s ease;}
@keyframes am-hop{0%{transform:scale(1)}50%{transform:scale(1.2) translateY(-6px)}100%{transform:scale(1)}}
.am-shake{animation:am-shake .5s ease;}
@keyframes am-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.am-hint{font-size:1rem;font-weight:700;color:#555;background:rgba(255,255,255,.7);padding:6px 16px;border-radius:999px;}
@media (max-width:380px){.am-flag{font-size:1.8rem;}.am-ground{padding:14px 8px;}}
`;
}

export function create(): AntMarchGame {
  return new AntMarchGame();
}
