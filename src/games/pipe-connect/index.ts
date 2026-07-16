/* 接水管 Pipe Connect —— 点击旋转管道，让水从起点流到终点。
   独特点：旋转机制（点击旋转 90°，区别于拖拽放置）。
   巧思：连通瞬间水流动画流过整条管道。为简化，用单行管道+旋转角度判定。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

export class PipeConnectGame extends BaseGame {
  constructor() {
    super("pipe-connect");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private rotations: number[] = [];
  private pipes: HTMLDivElement[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private len(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 5;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    const n = this.len();
    // 正确状态都是 0（横向直管）。初始随机旋转。
    this.rotations = Array.from({ length: n }, () => randInt(0, 3) * 90);
    this.pipes = [];

    const wrap = document.createElement("div");
    wrap.className = "pc-wrap";
    const task = document.createElement("div");
    task.className = "pc-task";
    task.textContent = `点击水管转方向，让水流过去～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const track = document.createElement("div");
    track.className = "pc-track";
    // 水龙头起点
    const start = document.createElement("div");
    start.className = "pc-end";
    start.textContent = "🚰";
    track.appendChild(start);
    // 管道
    this.rotations.forEach((_, i) => {
      const p = document.createElement("div");
      p.className = "pc-pipe";
      this.updatePipe(p, i);
      p.addEventListener("click", () => this.rotate(i));
      track.appendChild(p);
      this.pipes.push(p);
    });
    // 终点花
    const end = document.createElement("div");
    end.className = "pc-end";
    end.textContent = "🌻";
    track.appendChild(end);
    wrap.appendChild(track);
    this.root.appendChild(wrap);
  }

  private rotate(i: number): void {
    this.rotations[i] = (this.rotations[i]! + 90) % 360;
    sfxPop();
    this.updatePipe(this.pipes[i]!, i);
    this.resetWrongStreak();
    // 全部水平（0 或 180）即连通
    const ok = this.rotations.every((r) => r === 0 || r === 180);
    if (ok) {
      this.pipes.forEach((p) => p.classList.add("pc-pipe--flow"));
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) this.finishClear(3);
        else this.startRound();
      }, 1200);
    }
  }

  private updatePipe(p: HTMLDivElement, i: number): void {
    p.style.transform = `rotate(${this.rotations[i]}deg)`;
    p.innerHTML = '<div class="pc-pipe__inner"></div>';
  }

  private injectStyle(): void {
    if (document.getElementById("pc-style")) return;
    const st = document.createElement("style");
    st.id = "pc-style";
    st.textContent = PC_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function PC_CSS(theme: string): string {
  return `
.pc-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(520px,100%);}
.pc-task{font-size:1.1rem;font-weight:800;text-align:center;}
.pc-track{display:flex;align-items:center;gap:0;padding:10px;flex-wrap:wrap;justify-content:center;}
.pc-end{font-size:2.4rem;}
.pc-pipe{width:64px;height:64px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .2s ease;background:#fff;border-radius:8px;box-shadow:var(--shadow);margin:0 2px;}
.pc-pipe__inner{width:100%;height:18px;background:linear-gradient(90deg,#bdbdbd,#9e9e9e);border-radius:9px;}
.pc-pipe--flow .pc-pipe__inner{background:linear-gradient(90deg,#4fc3f7,${theme},#4fc3f7);animation:pc-flow 1s linear infinite;}
@keyframes pc-flow{0%{filter:brightness(1)}50%{filter:brightness(1.4)}100%{filter:brightness(1)}}
`;
}

export function create(): PipeConnectGame {
  return new PipeConnectGame();
}
