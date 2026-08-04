/* 蝙蝠洞 Bat Cave —— 洞顶倒挂着几只不同颜色的蝙蝠，题目指定一只，
   孩子点对应颜色的蝙蝠。独特点：蝙蝠都"倒挂"（旋转180°），
   错误的蝙蝠会飞走，正确的会开心。视觉：深洞+倒挂蝙蝠+月光。
   难度=蝙蝠数量。通关=找对目标轮数。前缀 bcv-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

const BAT_COLORS = [
  { color: "#ff6b9d", name: "红色" },
  { color: "#4d96ff", name: "蓝色" },
  { color: "#6bcf7f", name: "绿色" },
  { color: "#ffd93d", name: "黄色" },
  { color: "#a55eea", name: "紫色" },
  { color: "#ff9f43", name: "橙色" },
];

interface Bat {
  color: string;
  name: string;
  el: HTMLButtonElement;
}

export class BatCaveGame extends BaseGame {
  constructor() {
    super("bat-cave");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private bats: Bat[] = [];
  private targetColor = "";
  private targetName = "";
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private count(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.bats = [];

    const n = this.count();
    // 选 n 种不重复颜色，保证每轮目标唯一（颜色不重复，避免歧义）
    const pool = shuffle(BAT_COLORS).slice(0, n);
    const target = sample(pool);
    this.targetColor = target.color;
    this.targetName = target.name;

    const wrap = document.createElement("div");
    wrap.className = "bcv-wrap";

    const task = document.createElement("div");
    task.className = "bcv-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 点倒挂的 <span style="color:${this.targetColor}">${this.targetName}</span> 蝙蝠`;
    wrap.appendChild(task);

    // 洞顶吊挂区
    const cave = document.createElement("div");
    cave.className = "bcv-cave";

    // 打乱位置
    const placed = shuffle(pool);
    placed.forEach((b, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "bcv-bat";
      el.style.setProperty("--bat-color", b.color);
      el.style.setProperty("--bat-pos", String(i));
      el.innerHTML = `<span class="bcv-bat__body">🦇</span>`;
      el.addEventListener("click", () => this.pick(b.color, el));
      cave.appendChild(el);
      this.bats.push({ color: b.color, name: b.name, el });
    });

    wrap.appendChild(cave);
    this.root.appendChild(wrap);
  }

  private pick(color: string, el: HTMLButtonElement): void {
    if (this.answered) return;
    if (color === this.targetColor) {
      this.answered = true;
      el.classList.add("bcv-bat--happy");
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 700);
    } else {
      el.classList.add("bcv-bat--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => el.classList.remove("bcv-bat--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看清楚颜色再点哦～",
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
    if (document.getElementById("bcv-style")) return;
    const st = document.createElement("style");
    st.id = "bcv-style";
    st.textContent = BCV_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function BCV_CSS(_theme: string): string {
  return `
.bcv-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(520px,100%);}
.bcv-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.bcv-cave{position:relative;width:100%;max-width:480px;min-height:280px;background:radial-gradient(ellipse at top,#3a2a5a 0%,#1a1430 60%,#0c0820 100%);border-radius:24px 24px 60px 60px;box-shadow:var(--shadow-lg),inset 0 8px 24px rgba(0,0,0,.5);display:flex;justify-content:space-around;align-items:flex-start;padding:0 10px;overflow:hidden;}
.bcv-cave::before{content:"🌙";position:absolute;top:12px;right:20px;font-size:1.6rem;opacity:.8;filter:drop-shadow(0 0 8px rgba(255,240,180,.5));}
.bcv-bat{position:relative;margin-top:0;border:none;background:transparent;cursor:pointer;display:flex;align-items:flex-start;justify-content:center;touch-action:manipulation;animation:bcv-sway 3s ease-in-out infinite;animation-delay:calc(var(--bat-pos) * 0.3s);}
.bcv-bat::before{content:"";position:absolute;top:0;left:50%;width:2px;height:24px;background:rgba(255,255,255,.25);transform:translateX(-50%);}
.bcv-bat__body{font-size:3rem;display:inline-block;transform:rotate(180deg);color:var(--bat-color);filter:drop-shadow(0 0 6px var(--bat-color)) drop-shadow(0 2px 3px rgba(0,0,0,.4));transition:transform .25s ease;}
.bcv-bat:hover .bcv-bat__body,.bcv-bat:active .bcv-bat__body{transform:rotate(180deg) scale(1.15);}
.bcv-bat--happy .bcv-bat__body{animation:bcv-cheer .5s ease;filter:drop-shadow(0 0 16px var(--bat-color)) drop-shadow(0 2px 3px rgba(0,0,0,.4));}
.bcv-bat--wrong{animation:bcv-shake .4s ease;}
@keyframes bcv-sway{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(6px) rotate(2deg)}}
@keyframes bcv-cheer{0%{transform:rotate(180deg) scale(1)}50%{transform:rotate(180deg) scale(1.35)}100%{transform:rotate(180deg) scale(1.15)}}
@keyframes bcv-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
@media (max-width:380px){.bcv-bat__body{font-size:2.4rem;}.bcv-cave{min-height:230px;}}
`;
}

export function create(): BatCaveGame {
  return new BatCaveGame();
}
