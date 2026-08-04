/* 沙漏 Sand Timer —— 2-3 个沙漏，沙量不同，问"哪个先漏完"或"哪个漏得更快"。
   巧思：沙少的先漏完（同样流速下时间短）。CSS 沙漏 + 沙量动画。
   难度=沙漏数。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

interface Timer {
  sand: number; // 沙量（相对值，越小越快漏完）
  el: HTMLDivElement;
  topSand: HTMLDivElement;
  botSand: HTMLDivElement;
}

export class SandTimerGame extends BaseGame {
  constructor() {
    super("sand-timer");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private raf = 0;
  private last = 0;
  private over = false;
  /** 沙漏开始时刻 & 持续时长（毫秒） */
  private timers: { start: number; durMs: number }[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** 沙漏数量 */
  private count(): number {
    return this.difficulty === "easy" ? 4: this.difficulty === "medium"
        ? 5
        : 6;
  }

  private startRound(): void {
    this.over = false;
    this.locked = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    // 生成不重复的沙量（越小越快漏完），范围按难度
    const sandSet = new Set<number>();
    const lo = this.difficulty === "easy" ? 2 : 3;
    const hi = this.difficulty === "easy" ? 8 : 12;
    while (sandSet.size < n) sandSet.add(randInt(lo, hi));
    const sands = shuffle([...sandSet]);
    // 正确答案 = 沙量最少（最快漏完 / 先漏完）
    const answerSand = Math.min(...sands);

    const wrap = document.createElement("div");
    wrap.className = "sti-wrap";

    const task = document.createElement("div");
    task.className = "sti-task";
    task.textContent = `哪个沙漏漏得最快？（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const row = document.createElement("div");
    row.className = "sti-row";
    const timers: Timer[] = [];
    sands.forEach((sand) => {
      const t = this.buildTimer(sand);
      timers.push(t);
      row.appendChild(t.el);
    });
    wrap.appendChild(row);

    const hint = document.createElement("div");
    hint.className = "sti-hint";
    hint.textContent = "沙越少，漏完越快哦～";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);

    // 启动沙流动画
    this.last = performance.now();
    this.timers = sands.map((s) => ({
      start: this.last,
      // 沙量正比于时长（沙量 1 = 1 秒，便于孩子观察）
      durMs: s * 1000,
    }));
    this.animate(timers);

    // 点击判定
    timers.forEach((t, i) => {
      t.el.addEventListener("click", () => {
        if (this.locked) return;
        if (sands[i] === answerSand) {
          this.locked = true;
          this.over = true;
          cancelAnimationFrame(this.raf);
          this.raf = 0;
          sfxPop();
          t.el.classList.add("sti-timer--done");
          const r = t.el.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top);
          this.resetWrongStreak();
          this.roundsDone += 1;
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 1000);
        } else {
          t.el.classList.add("sti-timer--wrong");
          const paused = this.onWrong();
          this.trackTimeout(
            () => t.el.classList.remove("sti-timer--wrong"),
            400,
          );
          if (paused) this.showRest();
        }
      });
    });
  }

  /** 构建一个沙漏 DOM */
  private buildTimer(sand: number): Timer {
    const el = document.createElement("div");
    el.className = "sti-timer";

    const glass = document.createElement("div");
    glass.className = "sti-glass";

    const top = document.createElement("div");
    top.className = "sti-bulb sti-bulb--top";
    const topSand = document.createElement("div");
    topSand.className = "sti-sand sti-sand--top";
    // 沙量映射到顶部沙的初始高度（百分比）
    const sandPct = Math.min(100, sand * 8 + 30);
    topSand.style.height = `${sandPct}%`;
    top.appendChild(topSand);
    glass.appendChild(top);

    const neck = document.createElement("div");
    neck.className = "sti-neck";
    glass.appendChild(neck);

    const bot = document.createElement("div");
    bot.className = "sti-bulb sti-bulb--bot";
    const botSand = document.createElement("div");
    botSand.className = "sti-sand sti-sand--bot";
    botSand.style.height = "4%";
    bot.appendChild(botSand);
    glass.appendChild(bot);

    el.appendChild(glass);

    const cap = document.createElement("div");
    cap.className = "sti-cap";
    cap.textContent = `${sand} 格沙`;
    el.appendChild(cap);

    return { sand, el, topSand, botSand };
  }

  /** 沙流动画：top 减少、bot 增加，按各自时长 */
  private animate = (timers: Timer[]): void => {
    if (this.over) return;
    const now = performance.now();
    this.last = now;
    timers.forEach((t, i) => {
      const info = this.timers[i];
      if (!info) return;
      const elapsed = now - info.start;
      const ratio = Math.min(1, elapsed / info.durMs);
      const startPct = Math.min(100, t.sand * 8 + 30);
      const topPct = startPct * (1 - ratio);
      const botPct = 4 + startPct * ratio * 0.7;
      t.topSand.style.height = `${topPct}%`;
      t.botSand.style.height = `${botPct}%`;
      // 漏完后保持满，循环不重置（仅一轮判定）
    });
    this.raf = requestAnimationFrame(() => this.animate(timers));
  };

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "沙少的漏得快，沙多的漏得慢～",
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
    if (document.getElementById("sti-style")) return;
    const st = document.createElement("style");
    st.id = "sti-style";
    st.textContent = STI_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function STI_CSS(theme: string): string {
  return `
.sti-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.sti-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.sti-row{display:flex;gap:28px;flex-wrap:wrap;justify-content:center;}
.sti-timer{display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;padding:6px;border-radius:16px;transition:transform .1s,box-shadow .2s;}
.sti-timer:hover{transform:translateY(-2px);}
.sti-timer:active{transform:scale(.97);}
.sti-timer--done{box-shadow:0 0 0 4px ${theme},0 6px 14px rgba(0,0,0,.18);animation:sti-pop .4s ease;}
.sti-timer--wrong{animation:sti-shake .4s ease;}
@keyframes sti-pop{0%{transform:scale(.8)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes sti-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.sti-glass{position:relative;width:80px;height:130px;display:flex;flex-direction:column;align-items:center;}
.sti-bulb{position:relative;width:80px;height:56px;background:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,.2));border:3px solid rgba(255,255,255,.85);overflow:hidden;}
.sti-bulb--top{border-radius:8px 8px 50% 50%/8px 8px 60% 60%;box-shadow:var(--shadow);}
.sti-bulb--bot{border-radius:50% 50% 8px 8px/60% 60% 8px 8px;box-shadow:var(--shadow);margin-top:-2px;}
.sti-neck{position:relative;width:14px;height:8px;background:rgba(255,255,255,.6);border-left:3px solid rgba(255,255,255,.85);border-right:3px solid rgba(255,255,255,.85);margin-top:-2px;z-index:2;}
.sti-sand{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,#ffe4a3,${theme});transition:none;}
.sti-sand--top{border-radius:0 0 50% 50%/0 0 60% 60%;}
.sti-sand--bot{border-radius:0;}
.sti-cap{font-size:.9rem;font-weight:800;color:var(--ink-soft);background:#fff;padding:2px 10px;border-radius:999px;box-shadow:var(--shadow);}
.sti-hint{font-size:.95rem;font-weight:700;color:var(--ink-soft);}
@media (max-width:400px){.sti-glass{width:64px;height:108px;}.sti-bulb{width:64px;height:46px;}.sti-row{gap:16px;}}
`;
}

export function create(): SandTimerGame {
  return new SandTimerGame();
}
