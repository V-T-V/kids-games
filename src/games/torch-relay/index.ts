/* 火炬接力 Torch Relay —— 几座城市排成一列，火炬从第一个城市出发，
   孩子按顺序点击下一座城市，把火炬传过去。视觉：城市 emoji + 火焰 +
   连线。独特点：传递时火焰沿连线滑动，到达后点亮下一座城市。
   难度=城市数。通关=传完目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";
import { starsByAccuracy } from "../../core/scoring.ts";

const CITIES = ["🏙️", "🏰", "🗼", "⛩️", "🏛️", "🏯", "🌃", "🌆"] as const;

export class TorchRelayGame extends BaseGame {
  constructor() {
    super("torch-relay");
  }

  private count = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private active = 0;
  private locked = false;

  protected mount(): void {
    this.count =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* 无定时器/动画需手动清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.active = 0;
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "trc-wrap";

    const task = document.createElement("div");
    task.className = "trc-task";
    task.innerHTML = `点 <b>亮着火炬的下一座城市</b>，把火炬传过去！<br><small>第 ${this.roundsDone + 1} / ${this.roundTotal} 棒</small>`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "trc-board";
    board.id = "trc-board";

    // 城市顺序（取前 count 个，打乱视觉顺序但接力顺序按 0..count-1）
    const order = shuffle(
      Array.from({ length: CITIES.length }, (_, i) => i),
    ).slice(0, this.count);
    // 接力顺序 = 数组下标顺序（视觉上沿水平排列）
    for (let i = 0; i < this.count; i++) {
      const city = document.createElement("button");
      city.type = "button";
      city.className = "trc-city";
      city.dataset.idx = String(i);
      const emoji = CITIES[order[i]!]!;
      city.innerHTML = `
        <span class="trc-city__emoji">${emoji}</span>
        <span class="trc-city__torch">🔥</span>
        <span class="trc-city__idx">${i + 1}</span>`;
      city.addEventListener("click", () => this.onCity(city, i));
      board.appendChild(city);
      if (i < this.count - 1) {
        const arrow = document.createElement("span");
        arrow.className = "trc-arrow";
        arrow.textContent = "➜";
        board.appendChild(arrow);
      }
    }
    wrap.appendChild(board);
    this.root.appendChild(wrap);

    // 点亮第一个城市
    requestAnimationFrame(() => this.setActive(0));
  }

  private setActive(idx: number): void {
    const cities = this.root.querySelectorAll<HTMLElement>(".trc-city");
    cities.forEach((c, i) => {
      c.classList.toggle("trc-city--lit", i <= idx);
      c.classList.toggle("trc-city--active", i === idx);
    });
    this.active = idx;
  }

  private onCity(city: HTMLElement, idx: number): void {
    if (this.locked) return;
    // 只接受「当前火炬所在城市的下一座」
    if (idx !== this.active + 1) {
      // 点错了（点了已点亮的、或跳着点）
      if (idx <= this.active) return; // 已点过的城市，静默
      const paused = this.onWrong();
      city.classList.add("trc-city--shake");
      this.trackTimeout(() => city.classList.remove("trc-city--shake"), 350);
      if (paused) this.showRest();
      return;
    }
    // 正确：传递火炬
    this.locked = true;
    sfxPop();
    const r = city.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    city.classList.add("trc-city--flash");
    this.setActive(idx);

    this.trackTimeout(() => {
      this.locked = false;
      // 到达终点？
      if (idx >= this.count - 1) {
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 700);
      }
    }, 360);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "歇一歇～",
      emoji: "🌙",
      variant: "rest",
      body: "看好现在亮着的火炬在哪座城市，点它<b>旁边下一座</b>就好啦～",
      primary: { text: "继续", icon: "🔥", onClick: () => ov.destroy() },
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
    if (document.getElementById("trc-style")) return;
    const st = document.createElement("style");
    st.id = "trc-style";
    st.textContent = TRC_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function TRC_CSS(theme: string): string {
  return `
.trc-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;}
.trc-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.trc-task b{color:${theme};}
.trc-task small{display:block;margin-top:4px;font-weight:700;color:#888;font-size:.85rem;}
.trc-board{display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;max-width:640px;padding:20px 12px;background:linear-gradient(180deg,#eaf6ff,#cfe8ff);border-radius:24px;box-shadow:var(--shadow-lg);}
.trc-city{position:relative;width:84px;height:96px;border:none;border-radius:16px;background:rgba(255,255,255,.85);box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transition:transform .18s ease,box-shadow .18s,background .25s;cursor:pointer;}
.trc-city__emoji{font-size:2.1rem;line-height:1;filter:grayscale(.55) opacity(.7);transition:filter .25s;}
.trc-city__torch{position:absolute;top:-22px;left:50%;transform:translateX(-50%) scale(0);font-size:1.7rem;transition:transform .25s ease;filter:drop-shadow(0 0 6px rgba(255,160,40,.9));}
.trc-city__idx{position:absolute;bottom:4px;right:6px;font-size:.7rem;font-weight:800;color:#aaa;background:#fff;border-radius:6px;padding:1px 5px;}
.trc-city--lit .trc-city__emoji{filter:grayscale(0) opacity(1);}
.trc-city--lit{background:linear-gradient(180deg,#fff,#ffe9c2);}
.trc-city--active{outline:4px solid ${theme};outline-offset:2px;transform:translateY(-4px);background:linear-gradient(180deg,#fff,#ffd58a);}
.trc-city--active .trc-city__torch{transform:translateX(-50%) scale(1);animation:trc-flick .6s ease-in-out infinite alternate;}
.trc-city--flash{animation:trc-flash .5s ease;}
.trc-city--shake{animation:trc-shake .35s ease;}
.trc-arrow{color:#9bc4e8;font-size:1.3rem;font-weight:900;padding:0 2px;}
@keyframes trc-flick{from{transform:translateX(-50%) scale(1) rotate(-4deg);opacity:.92}to{transform:translateX(-50%) scale(1.12) rotate(4deg);opacity:1}}
@keyframes trc-flash{0%{box-shadow:0 0 0 0 rgba(255,180,40,.9)}100%{box-shadow:0 0 0 24px rgba(255,180,40,0)}}
@keyframes trc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:420px){.trc-city{width:70px;height:82px;}.trc-city__emoji{font-size:1.7rem;}}
`;
}

export function create(): TorchRelayGame {
  return new TorchRelayGame();
}
