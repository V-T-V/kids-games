/* 找目标 Find Target —— 在一堆干扰物里找出所有目标物，训练选择性注意力。
   独特点：限定时间内找出混在干扰物中的少量目标（如一堆 🍎 里找 🍊）。
   难度=干扰物数量 + 目标数量 + 时间。easy: 8干扰3目标10s，hard: 20干扰5目标15s。
   巧思：点对目标消失并粒子，点错干扰物轻抖；时间到未找全算本关未过。
   CSS 前缀用 ftg-（find-target grid）。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

/** 干扰物 emoji 池（一个池里选一种做干扰，另一种做目标，保证视觉差异）。 */
const PAIRS: { decoy: string; target: string }[] = [
  { decoy: "🍎", target: "🍊" },
  { decoy: "🍅", target: "🍓" },
  { decoy: "⭐", target: "🌟" },
  { decoy: "🌸", target: "🌺" },
  { decoy: "❄️", target: "⛄" },
  { decoy: "🐝", target: "🐞" },
  { decoy: "💧", target: "🔥" },
  { decoy: "🍃", target: "🍀" },
];

interface Item {
  emoji: string;
  el: HTMLButtonElement;
  isTarget: boolean;
  found: boolean;
}

/** 各难度的（干扰数、目标数、时限秒）。 */
function config(
  diff: "easy" | "medium" | "hard",
): { decoy: number; target: number; seconds: number } {
  if (diff === "easy") return { decoy: 8, target: 3, seconds: 10 };
  if (diff === "medium") return { decoy: 14, target: 4, seconds: 12 };
  return { decoy: 20, target: 5, seconds: 15 };
}

export class FindTargetGame extends BaseGame {
  constructor() {
    super("find-target");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private items: Item[] = [];
  private foundCount = 0;
  private targetCount = 0;
  private timeLeft = 0;
  private timeLabel!: HTMLDivElement;
  private checklist!: HTMLDivElement;
  private timerId: number | null = null;
  private roundOver = false;

  protected mount(): void {
    this.roundTotal = this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private startRound(): void {
    this.stopTimer();
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.roundOver = false;
    const cfg = config(this.difficulty);
    this.targetCount = cfg.target;
    this.foundCount = 0;
    this.timeLeft = cfg.seconds;

    const pair = sample(PAIRS);

    const wrap = document.createElement("div");
    wrap.className = "ftg-wrap";

    const bar = document.createElement("div");
    bar.className = "ftg-bar";
    const task = document.createElement("div");
    task.className = "ftg-task";
    task.innerHTML = `找出所有 <b>${pair.target}</b>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    this.timeLabel = document.createElement("div");
    this.timeLabel.className = "ftg-time";
    this.timeLabel.textContent = `⏱️ ${this.timeLeft}s`;
    bar.appendChild(task);
    bar.appendChild(this.timeLabel);
    wrap.appendChild(bar);

    this.checklist = document.createElement("div");
    this.checklist.className = "ftg-checklist";
    this.renderChecklist(pair.target);
    wrap.appendChild(this.checklist);

    const scene = document.createElement("div");
    scene.className = "ftg-scene";
    // 构造 items：target 个目标 + decoy 个干扰
    const list: { emoji: string; isTarget: boolean }[] = [];
    for (let i = 0; i < cfg.target; i++)
      list.push({ emoji: pair.target, isTarget: true });
    for (let i = 0; i < cfg.decoy; i++)
      list.push({ emoji: pair.decoy, isTarget: false });
    const placed = shuffle(list);
    this.items = [];
    for (const it of placed) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ftg-item";
      b.textContent = it.emoji;
      b.style.left = `${randInt(3, 90)}%`;
      b.style.top = `${randInt(5, 88)}%`;
      b.style.fontSize = `${randInt(24, 34)}px`;
      b.style.transform = `rotate(${randInt(-12, 12)}deg)`;
      scene.appendChild(b);
      const item: Item = { emoji: it.emoji, el: b, isTarget: it.isTarget, found: false };
      b.addEventListener("click", () => this.onClick(item));
      this.items.push(item);
    }
    wrap.appendChild(scene);
    this.root.appendChild(wrap);

    // 倒计时
    this.timerId = window.setInterval(() => {
      if (this.roundOver) return;
      this.timeLeft -= 1;
      this.timeLabel.textContent = `⏱️ ${this.timeLeft}s`;
      if (this.timeLeft <= 5) this.timeLabel.classList.add("ftg-time--low");
      if (this.timeLeft <= 0) {
        this.stopTimer();
        this.timeUp();
      }
    }, 1000);
  }

  private onClick(item: Item): void {
    if (this.roundOver) return;
    if (item.isTarget && !item.found) {
      item.found = true;
      item.el.classList.add("ftg-item--found");
      const r = item.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.foundCount += 1;
      this.resetWrongStreak();
      this.renderChecklist(item.emoji);
      this.trackTimeout(() => item.el.remove(), 500);
      if (this.foundCount >= this.targetCount) {
        this.roundOver = true;
        this.stopTimer();
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 800);
      }
    } else if (!item.isTarget) {
      item.el.classList.add("ftg-item--shake");
      this.trackTimeout(() => item.el.classList.remove("ftg-item--shake"), 400);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private renderChecklist(targetEmoji: string): void {
    this.checklist.innerHTML = "";
    for (let i = 0; i < this.targetCount; i++) {
      const dot = document.createElement("span");
      dot.className = "ftg-dot";
      if (i < this.foundCount) {
        dot.classList.add("ftg-dot--done");
        dot.textContent = "✅";
      } else {
        dot.textContent = targetEmoji;
      }
      this.checklist.appendChild(dot);
    }
  }

  private timeUp(): void {
    this.roundOver = true;
    // 时间到未找全：算答错一次，进入休息
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      // 不触发休息时，直接重开本关
      this.trackTimeout(() => this.startRound(), 800);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "慢慢找，先认准目标长什么样，再一个个点哦～",
      primary: {
        text: "继续",
        icon: "🎈",
        onClick: () => {
          ov.destroy();
          this.startRound();
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
    if (document.getElementById("ftg-style")) return;
    const st = document.createElement("style");
    st.id = "ftg-style";
    st.textContent = FTG_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function FTG_CSS(theme: string): string {
  return `
.ftg-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(560px,100%);}
.ftg-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;width:min(500px,94%);background:#fff;padding:8px 16px;border-radius:999px;box-shadow:var(--shadow);}
.ftg-task{font-size:1.05rem;font-weight:800;}
.ftg-task b{color:${theme};font-size:1.3rem;}
.ftg-time{font-size:1.1rem;font-weight:900;color:#444;white-space:nowrap;}
.ftg-time--low{color:${theme};animation:ftg-blink .6s ease-in-out infinite;}
@keyframes ftg-blink{0%,100%{opacity:1}50%{opacity:.5}}
.ftg-checklist{display:flex;gap:6px;align-items:center;padding:4px 10px;background:rgba(255,255,255,.7);border-radius:999px;}
.ftg-dot{font-size:1.3rem;transition:transform .2s;}
.ftg-dot--done{filter:grayscale(.3);}
.ftg-scene{position:relative;width:100%;height:58vh;min-height:320px;background:linear-gradient(180deg,#fff5f0,#fff);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;border:3px solid ${theme}44;}
.ftg-item{position:absolute;background:transparent;border:none;font-size:28px;line-height:1;cursor:pointer;touch-action:manipulation;transition:transform .25s ease;}
.ftg-item:active{transform:scale(1.2);}
.ftg-item--found{animation:ftg-pop .5s ease forwards;}
.ftg-item--shake{animation:ftg-shake .4s ease;}
@keyframes ftg-pop{0%{transform:scale(1)}50%{transform:scale(1.6) rotate(15deg);filter:drop-shadow(0 0 8px ${theme})}100%{transform:scale(0);opacity:0}}
@keyframes ftg-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): FindTargetGame {
  return new FindTargetGame();
}
