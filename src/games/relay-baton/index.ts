/* 接力棒 Relay Baton —— 几个跑步者站成一排，接力棒在第一个人手上。
   孩子按顺序点击下一位跑者，让接力棒传到他手上（1→2→3→…→N）。
   点对：接力棒飞到下一位；点错：抖动。传到最后一位即胜。
   独特点：顺序传递 + 跑者编号辨识。视觉：跑道 + 跑者（编号）+ 接力棒 + 起跑/终点。
   难度=人数（4~6）。通关=传完目标轮数。前缀 rlb-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

const RUNNERS = ["🏃", "🏃‍♀️", "🏃‍♂️", "🧗", "🚶", "🤸"];

export class RelayBatonGame extends BaseGame {
  constructor() {
    super("relay-baton");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  /** 跑者总数 */
  private n = 4;
  /** 当前接力棒所在跑者 index（0-based） */
  private batonAt = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private runnerCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 5
        : 6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.batonAt = 0;
    this.n = this.runnerCount();
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "rlb-wrap";

    const task = document.createElement("div");
    task.className = "rlb-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 按编号顺序，<b>点下一位跑者</b>传接力棒！`;
    wrap.appendChild(task);

    // 跑道
    const track = document.createElement("div");
    track.className = "rlb-track";

    // 起点旗
    const start = document.createElement("div");
    start.className = "rlb-flag rlb-flag--start";
    start.textContent = "🚩起点";
    track.appendChild(start);

    // 跑者
    const runners = document.createElement("div");
    runners.className = "rlb-runners";
    runners.id = "rlb-runners";
    for (let i = 0; i < this.n; i++) {
      const r = document.createElement("button");
      r.type = "button";
      r.className = "rlb-runner";
      r.dataset.index = String(i);
      r.setAttribute("aria-label", `跑者 ${i + 1}`);
      const emoji = RUNNERS[i % RUNNERS.length]!;
      r.innerHTML = `<span class="rlb-runner-num">${i + 1}</span><span class="rlb-runner-emoji">${emoji}</span>`;
      r.addEventListener("click", () => this.clickRunner(i, r));
      runners.appendChild(r);
    }
    track.appendChild(runners);

    // 终点旗
    const finish = document.createElement("div");
    finish.className = "rlb-flag rlb-flag--finish";
    finish.textContent = "🏁终点";
    track.appendChild(finish);

    wrap.appendChild(track);

    // 接力棒（绝对定位，飞到当前跑者上方）
    const batonHost = document.createElement("div");
    batonHost.className = "rlb-baton-host";
    batonHost.id = "rlb-baton-host";
    batonHost.textContent = "🥢";
    wrap.appendChild(batonHost);

    this.root.appendChild(wrap);

    // 把接力棒定位到第一个跑者上方
    requestAnimationFrame(() => this.placeBaton(0));
  }

  private placeBaton(index: number): void {
    const host = this.root.querySelector(
      "#rlb-baton-host",
    ) as HTMLElement | null;
    const runner = this.root.querySelector(
      `.rlb-runner[data-index="${index}"]`,
    ) as HTMLElement | null;
    if (!host || !runner) return;
    const hostRect = host.parentElement?.getBoundingClientRect();
    const rRect = runner.getBoundingClientRect();
    if (!hostRect) return;
    const x =
      rRect.left - hostRect.left + rRect.width / 2 - host.offsetWidth / 2;
    const y = rRect.top - hostRect.top - host.offsetHeight - 4;
    host.style.transform = `translate(${x}px, ${y}px)`;
  }

  private clickRunner(index: number, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (btn.classList.contains("rlb-runner--done")) return;
    const expected = this.batonAt + 1;
    if (index === expected) {
      // 正确传给下一位
      this.locked = true;
      btn.classList.add("rlb-runner--current");
      // 标记前一位为已完成
      const prev = this.root.querySelector(
        `.rlb-runner[data-index="${this.batonAt}"]`,
      );
      prev?.classList.add("rlb-runner--done");
      prev?.classList.remove("rlb-runner--current");
      sfxPop();
      this.batonAt = index;
      this.placeBaton(index);
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        btn.classList.remove("rlb-runner--current");
        btn.classList.add("rlb-runner--done");
        if (this.batonAt >= this.n - 1) {
          // 传完
          this.trackTimeout(() => {
            this.roundsDone += 1;
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 600);
        } else {
          this.locked = false;
        }
      }, 350);
    } else if (index <= this.batonAt) {
      // 已经传过的跑者：温和提示，不算错
      btn.classList.add("rlb-runner--shake");
      this.trackTimeout(() => btn.classList.remove("rlb-runner--shake"), 400);
    } else {
      // 跳号（点太靠后的跑者）：算错
      btn.classList.add("rlb-runner--shake");
      this.trackTimeout(() => btn.classList.remove("rlb-runner--shake"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🥢",
      variant: "rest",
      body: `接力棒要按 1→2→3→${this.n} 的顺序传，看清楚下一位的编号哦～`,
      primary: { text: "继续", icon: "🏃", onClick: () => ov.destroy() },
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
    if (document.getElementById("rlb-style")) return;
    const st = document.createElement("style");
    st.id = "rlb-style";
    st.textContent = RLB_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function RLB_CSS(theme: string): string {
  return `
.rlb-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(640px,100%);}
.rlb-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.rlb-track{display:flex;align-items:center;gap:0;width:100%;padding:30px 12px 50px;background:
    repeating-linear-gradient(90deg,#e8a878 0 40px,#f4c890 40px 80px);
  border-radius:20px;box-shadow:var(--shadow);position:relative;overflow:hidden;}
.rlb-track::before{content:"";position:absolute;left:0;right:0;top:0;height:8px;background:linear-gradient(180deg,rgba(255,255,255,.6),transparent);}
.rlb-flag{font-size:.85rem;font-weight:900;color:#5a3a1a;background:#fff;padding:6px 10px;border-radius:8px;box-shadow:var(--shadow);writing-mode:vertical-rl;text-orientation:upright;letter-spacing:2px;flex-shrink:0;}
.rlb-runners{flex:1;display:flex;justify-content:space-around;align-items:center;gap:4px;}
.rlb-runner{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:transparent;cursor:pointer;padding:4px;transition:transform .15s;}
.rlb-runner:active{transform:scale(.9);}
.rlb-runner-num{position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:${theme};color:#fff;font-size:.85rem;font-weight:900;width:22px;height:22px;line-height:22px;border-radius:50%;box-shadow:var(--shadow);z-index:2;}
.rlb-runner-emoji{font-size:2.2rem;line-height:1;filter:grayscale(.5) opacity(.7);transition:filter .2s,transform .2s;}
.rlb-runner--current .rlb-runner-emoji{filter:none;transform:scale(1.15);animation:rlb-run .4s ease-in-out infinite alternate;}
@keyframes rlb-run{0%{transform:scale(1.15) translateY(0);}100%{transform:scale(1.15) translateY(-4px);}}
.rlb-runner--done .rlb-runner-emoji{filter:none;opacity:.85;}
.rlb-runner--done .rlb-runner-num{background:#6bcf7f;}
.rlb-runner--shake{animation:rlb-shake .4s ease;}
@keyframes rlb-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-5px) rotate(-6deg);}75%{transform:translateX(5px) rotate(6deg);}}
.rlb-baton-host{position:absolute;left:0;top:0;font-size:1.6rem;transition:transform .3s cubic-bezier(.3,1.5,.5,1);z-index:5;filter:drop-shadow(0 3px 3px rgba(0,0,0,.3));pointer-events:none;height:0;width:0;}
@media (max-width:380px){.rlb-runner-emoji{font-size:1.7rem;}.rlb-runner-num{width:18px;height:18px;line-height:18px;font-size:.75rem;}.rlb-flag{font-size:.7rem;padding:4px 8px;}}
`;
}

export function create(): RelayBatonGame {
  return new RelayBatonGame();
}
