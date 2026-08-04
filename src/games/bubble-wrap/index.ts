/* 捏泡泡纸 Bubble Wrap —— 把屏幕上的泡泡全部捏爆，解压 + 精细动作。
   独特点：纯粹的触觉解压反馈，每个泡泡捏爆有独特"啵"音效 + 缩放动画。
   视觉：圆形泡泡带高光渐变，捏爆时内陷变色。难度=泡泡数量。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar } from "../../lobby/util.ts";

const COLORS = [
  "#ff6b9d",
  "#4d96ff",
  "#6bcf7f",
  "#ffd93d",
  "#a55eea",
  "#ff9f43",
];

export class BubbleWrapGame extends BaseGame {
  constructor() {
    super("bubble-wrap");
  }
  private remaining = 0;
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
    return this.difficulty === "easy"
      ? 12
      : this.difficulty === "medium"
        ? 20
        : 30;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    const n = this.count();
    this.remaining = n;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "bw-wrap";
    const task = document.createElement("div");
    task.className = "bw-task";
    task.innerHTML = `把泡泡全捏爆！还剩 <b id="bw-left">${this.remaining}</b> 个`;
    wrap.appendChild(task);

    const grid = document.createElement("div");
    grid.className = "bw-grid";
    for (let i = 0; i < n; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bw-bubble";
      const color = COLORS[i % COLORS.length]!;
      b.style.setProperty("--bw-color", color);
      b.addEventListener("click", () => this.pop(b, task));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private pop(b: HTMLButtonElement, task: HTMLElement): void {
    if (b.classList.contains("bw-bubble--popped")) return;
    b.classList.add("bw-bubble--popped");
    b.disabled = true;
    sfxPop();
    this.remaining -= 1;
    this.resetWrongStreak();
    const left = this.root.querySelector("#bw-left");
    if (left) left.textContent = String(this.remaining);
    if (this.remaining <= 0) {
      this.roundsDone += 1;
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(3);
        } else {
          this.startRound();
        }
      }, 700);
    }
    void task;
  }

  private injectStyle(): void {
    if (document.getElementById("bw-style")) return;
    const st = document.createElement("style");
    st.id = "bw-style";
    st.textContent = BW_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function BW_CSS(theme: string): string {
  return `
.bw-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(440px,100%);}
.bw-task{font-size:1.15rem;font-weight:800;text-align:center;}
.bw-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:12px;background:rgba(255,255,255,.5);border-radius:20px;box-shadow:var(--shadow);max-width:380px;}
.bw-bubble{width:60px;height:60px;border-radius:50%;border:none;background:radial-gradient(circle at 35% 30%,#fff6,var(--bw-color,${theme}));box-shadow:inset 0 -4px 6px rgba(0,0,0,.15),var(--shadow);transition:transform .12s ease;cursor:pointer;}
.bw-bubble:active{transform:scale(.9);}
.bw-bubble--popped{background:radial-gradient(circle at 35% 30%,#e0e0e0,#bbb);box-shadow:inset 0 4px 8px rgba(0,0,0,.3);transform:scale(.82);pointer-events:none;animation:bw-pop .2s ease;}
@keyframes bw-pop{0%{transform:scale(1.1)}100%{transform:scale(.82)}}
@media (max-width:380px){.bw-bubble{width:50px;height:50px;}.bw-grid{grid-template-columns:repeat(4,1fr);}}
`;
}

export function create(): BubbleWrapGame {
  return new BubbleWrapGame();
}
