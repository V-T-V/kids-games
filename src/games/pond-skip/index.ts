/* 跳荷叶 Pond Skip —— 河面上有编号的荷叶(1,2,3...)，按数字顺序点跳过河。
   独特点：必须按顺序点击，点错会摇晃提示；青蛙随正确点击逐片前进，最终到达对岸。
   视觉：圆形荷叶带数字 + 小青蛙跳跃动画 + 河面水波。难度=荷叶数。通关=跳过目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar } from "../../lobby/util.ts";

export class PondSkipGame extends BaseGame {
  constructor() {
    super("pond-skip");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private next = 1; // 下一个该点的数字
  private pads: HTMLButtonElement[] = [];
  private frogAt = 0; // 青蛙当前在第几个荷叶（0=起点）
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private padCount(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 7
        : 9;
  }

  private startRound(): void {
    this.locked = false;
    this.next = 1;
    this.frogAt = 0;
    this.pads = [];
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "ps-wrap";

    const task = document.createElement("div");
    task.className = "ps-task";
    task.innerHTML = `按 <b>1, 2, 3…</b> 的顺序点荷叶，帮青蛙过河！`;
    wrap.appendChild(task);

    const river = document.createElement("div");
    river.className = "ps-river";
    river.id = "ps-river";

    // 起点（左岸）
    const start = document.createElement("div");
    start.className = "ps-bank ps-bank--start";
    start.textContent = "岸";
    river.appendChild(start);

    // 青蛙
    const frog = document.createElement("div");
    frog.className = "ps-frog";
    frog.id = "ps-frog";
    frog.textContent = "🐸";
    river.appendChild(frog);

    // 荷叶
    const padRow = document.createElement("div");
    padRow.className = "ps-pads";
    padRow.id = "ps-pads";
    const n = this.padCount();
    for (let i = 1; i <= n; i++) {
      const pad = document.createElement("button");
      pad.type = "button";
      pad.className = "ps-pad";
      pad.dataset.num = String(i);
      pad.innerHTML = `<span class="ps-pad__num">${i}</span>`;
      pad.style.setProperty("--ps-i", String(i));
      pad.addEventListener("click", () => this.hop(i, pad));
      padRow.appendChild(pad);
      this.pads.push(pad);
    }
    river.appendChild(padRow);

    // 终点（右岸）
    const end = document.createElement("div");
    end.className = "ps-bank ps-bank--end";
    end.textContent = "家";
    river.appendChild(end);

    wrap.appendChild(river);
    this.root.appendChild(wrap);

    // 把青蛙放到起点
    this.placeFrog(0);
  }

  /** 青蛙定位到第 idx 个位置（0=起点，1..n=荷叶，n+1=终点）。 */
  private placeFrog(idx: number): void {
    const frog = this.root.querySelector("#ps-frog") as HTMLElement | null;
    if (!frog) return;
    const river = this.root.querySelector("#ps-river") as HTMLElement | null;
    if (!river) return;
    const rr = river.getBoundingClientRect();
    let targetX = 20; // 起点
    if (idx === 0) targetX = 24;
    else if (idx > this.pads.length)
      targetX = rr.width - 24; // 终点
    else {
      const pad = this.pads[idx - 1];
      if (pad) {
        const pr = pad.getBoundingClientRect();
        targetX = pr.left + pr.width / 2 - rr.left;
      }
    }
    frog.style.left = `${targetX}px`;
  }

  private hop(num: number, pad: HTMLButtonElement): void {
    if (this.locked) return;
    if (num === this.next) {
      this.locked = true;
      pad.classList.add("ps-pad--done");
      const frog = this.root.querySelector("#ps-frog");
      frog?.classList.add("ps-frog--jump");
      sfxPop();
      this.resetWrongStreak();
      const r = pad.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.frogAt = num;
      this.placeFrog(num);
      this.next += 1;
      this.trackTimeout(() => {
        frog?.classList.remove("ps-frog--jump");
        if (this.next > this.pads.length) {
          // 到终点
          this.placeFrog(this.pads.length + 1);
          this.trackTimeout(() => {
            this.roundsDone += 1;
            this.reportProgress(this.roundsDone, this.roundTotal);
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 600);
        } else {
          this.locked = false;
        }
      }, 380);
    } else {
      pad.classList.add("ps-pad--shake");
      this.onWrong();
      this.trackTimeout(() => pad.classList.remove("ps-pad--shake"), 400);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("ps-style")) return;
    const st = document.createElement("style");
    st.id = "ps-style";
    st.textContent = PS_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function PS_CSS(theme: string): string {
  return `
.ps-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.ps-task{font-size:1.1rem;font-weight:800;text-align:center;}
.ps-river{position:relative;width:100%;height:200px;background:linear-gradient(180deg,#4fc3f7,#0288d1);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;display:flex;align-items:center;justify-content:space-between;padding:0 8px;}
.ps-river::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 18px,transparent 18px 36px);animation:ps-wave 4s linear infinite;}
@keyframes ps-wave{0%{transform:translateX(0)}100%{transform:translateX(-36px)}}
.ps-bank{position:relative;z-index:2;width:44px;height:90px;border-radius:14px;background:linear-gradient(180deg,#8d6e63,#5d4037);color:#fff;font-weight:900;font-size:1rem;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow);}
.ps-pads{position:relative;z-index:2;display:flex;gap:6px;align-items:center;flex:1;justify-content:space-around;padding:0 6px;}
.ps-pad{width:54px;height:54px;border-radius:50%;border:none;background:radial-gradient(circle at 40% 35%,#a5d6a7,${theme});box-shadow:inset 0 -4px 6px rgba(0,0,0,.15),var(--shadow);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .12s;}
.ps-pad:active{transform:scale(.9);}
.ps-pad__num{font-size:1.5rem;font-weight:900;color:#1b5e20;text-shadow:0 1px 0 rgba(255,255,255,.6);}
.ps-pad--done{background:radial-gradient(circle at 40% 35%,#c8e6c9,#66bb6a);opacity:.7;}
.ps-pad--shake{animation:ps-shake .4s ease;}
@keyframes ps-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px) rotate(-5deg)}75%{transform:translateX(6px) rotate(5deg)}}
.ps-frog{position:absolute;left:24px;top:50%;transform:translate(-50%,-50%);font-size:2.2rem;z-index:3;transition:left .38s cubic-bezier(.4,1.5,.5,1);filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));}
.ps-frog--jump{animation:ps-hop .38s ease;}
@keyframes ps-hop{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-90%) scale(1.2)}100%{transform:translate(-50%,-50%) scale(1)}}
@media (max-width:380px){.ps-pad{width:44px;height:44px;}.ps-pad__num{font-size:1.2rem;}.ps-frog{font-size:1.8rem;}}
`;
}

export function create(): PondSkipGame {
  return new PondSkipGame();
}
