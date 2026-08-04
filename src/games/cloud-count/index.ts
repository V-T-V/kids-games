/* 数云朵 Cloud Count —— 天空有若干云朵飘动，短暂展示后问"有几朵云"，
   从数字选项里选。
   独特点：瞬时计数（subitizing）训练 + 短时记忆。
   视觉：渐变蓝天 + 漂浮云朵 emoji，选项为彩色数字按钮。
   难度 = 云朵数（easy 3-5 / medium 4-7 / hard 5-10）。
   通关 = 答对目标轮数。前缀 clc-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, randInt, sample } from "../../lobby/util.ts";

const CLOUD_EMOJIS = ["☁️", "⛅", "🌥️"];

type Phase = "show" | "ask";

export class CloudCountGame extends BaseGame {
  constructor() {
    super("cloud-count");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private phase: Phase = "show";
  private answer = 0;
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

  private range(): [number, number] {
    if (this.difficulty === "easy") return [3, 5];
    if (this.difficulty === "medium") return [4, 7];
    return [5, 10];
  }

  private showMs(): number {
    return this.difficulty === "easy"
      ? 2600
      : this.difficulty === "medium"
        ? 2200
        : 1800;
  }

  private startRound(): void {
    this.phase = "show";
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const [min, max] = this.range();
    const n = randInt(min, max);
    this.answer = n;

    const wrap = document.createElement("div");
    wrap.className = "clc-wrap";

    const task = document.createElement("div");
    task.className = "clc-task";
    task.id = "clc-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · <b>数一数</b>天上有几朵云！`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "clc-hint";
    hint.id = "clc-hint";
    hint.textContent = "仔细看，云会飘走哦…";
    wrap.appendChild(hint);

    const sky = document.createElement("div");
    sky.className = "clc-sky";
    sky.id = "clc-sky";
    for (let i = 0; i < n; i++) {
      const c = document.createElement("div");
      c.className = "clc-cloud";
      c.textContent = sample(CLOUD_EMOJIS);
      c.style.left = `${randInt(4, 80)}%`;
      c.style.top = `${randInt(10, 70)}%`;
      c.style.animationDelay = `${(i * 0.3).toFixed(2)}s`;
      c.style.fontSize = `${randInt(34, 52)}px`;
      sky.appendChild(c);
    }
    wrap.appendChild(sky);

    const opts = document.createElement("div");
    opts.className = "clc-opts";
    opts.id = "clc-opts";
    wrap.appendChild(opts);

    this.root.appendChild(wrap);

    // 展示 showMs 后隐藏云朵并出选项
    this.trackTimeout(() => {
      if (this.phase !== "show") return;
      this.phase = "ask";
      const skyEl = this.root.querySelector("#clc-sky");
      skyEl?.classList.add("clc-sky--hidden");
      const ht = this.root.querySelector("#clc-hint");
      if (ht) ht.innerHTML = `刚才天上有<b>几朵云</b>？`;
      this.buildOptions(opts);
    }, this.showMs());
  }

  private buildOptions(host: HTMLElement): void {
    const correct = this.answer;
    const set = new Set<number>([correct]);
    while (set.size < Math.min(4, 9)) {
      const d = correct + randInt(-2, 2);
      if (d >= 1 && d <= 10) set.add(d);
    }
    const opts = shuffle([...set]);
    opts.forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "clc-opt";
      b.textContent = String(v);
      b.addEventListener("click", () => this.choose(b, v, correct));
      host.appendChild(b);
    });
  }

  private choose(btn: HTMLButtonElement, v: number, correct: number): void {
    if (this.locked) return;
    if (v === correct) {
      this.locked = true;
      btn.classList.add("clc-opt--right");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 揭开云朵庆祝
      const skyEl = this.root.querySelector("#clc-sky");
      skyEl?.classList.remove("clc-sky--hidden");
      const ht = this.root.querySelector("#clc-hint");
      if (ht) ht.innerHTML = `答对啦！就是 <b>${correct}</b> 朵云～`;
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    } else {
      btn.classList.add("clc-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("clc-opt--wrong"), 600);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "☁️",
      variant: "rest",
      body: "再仔细数一遍，一朵一朵点着数。",
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
    if (document.getElementById("clc-style")) return;
    const st = document.createElement("style");
    st.id = "clc-style";
    st.textContent = CLC_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function CLC_CSS(theme: string): string {
  return `
.clc-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(540px,100%);}
.clc-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.clc-hint{font-size:.95rem;font-weight:700;color:#4a6a8a;text-align:center;min-height:1.4em;}
.clc-sky{position:relative;width:100%;height:46vh;min-height:280px;background:linear-gradient(180deg,#aee3ff,#d8f3ff);border-radius:22px;box-shadow:var(--shadow);overflow:hidden;transition:filter .4s;}
.clc-sky--hidden{filter:blur(6px) brightness(1.05);}
.clc-sky--hidden .clc-cloud{opacity:0;}
.clc-cloud{position:absolute;font-size:40px;line-height:1;animation:clc-float 4s ease-in-out infinite;transition:opacity .4s;filter:drop-shadow(0 3px 4px rgba(0,0,0,.1));}
@keyframes clc-float{0%,100%{transform:translateY(0) translateX(0);}50%{transform:translateY(-10px) translateX(8px);}}
.clc-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;min-height:76px;}
.clc-opt{width:72px;height:72px;font-size:1.9rem;font-weight:900;border:none;border-radius:18px;background:#fff;color:${theme};box-shadow:0 4px 0 rgba(0,0,0,.12),var(--shadow);cursor:pointer;transition:transform .12s;}
.clc-opt:active{transform:translateY(2px);}
.clc-opt--right{background:linear-gradient(180deg,#bff0c1,#7ed884);color:#fff;animation:clc-pop .4s ease;}
.clc-opt--wrong{background:linear-gradient(180deg,#ffd0c4,#ff9f8a);color:#fff;animation:clc-shake .5s ease;}
@keyframes clc-pop{0%{transform:scale(1);}50%{transform:scale(1.18);}100%{transform:scale(1);}}
@keyframes clc-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-5px);}75%{transform:translateX(5px);}}
@media (max-width:380px){.clc-opt{width:60px;height:60px;font-size:1.6rem;}.clc-cloud{font-size:32px;}}
`;
}

export function create(): CloudCountGame {
  return new CloudCountGame();
}
