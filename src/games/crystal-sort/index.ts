/* 水晶 Crystal Sort —— 几颗 💎 从暗到亮（透明度递增）乱序，
   孩子按"从暗到亮"的顺序依次点击排列。
   独特点：亮度/明度序列感知。乱序后必须按亮度递增点击。
   视觉：💎 不同透明度 + 发光。难度=水晶数。通关=排对目标轮数。
   注意：CSS 前缀用 crs-（任务原写 cs2-，但 cs2- 已被 catch-star 占用，故改用安全的 crs-）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Crystal {
  /** 亮度等级 0..n-1（越小越暗） */
  level: number;
  el: HTMLElement;
  picked: boolean;
}

export class CrystalSortGame extends BaseGame {
  constructor() {
    super("crystal-sort");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private crystals: Crystal[] = [];
  /** 下一步该点亮的等级 */
  private nextLevel = 0;
  private busy = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* trackTimeout 自动清理 */
  }

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = false;
    this.nextLevel = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    const wrap = document.createElement("div");
    wrap.className = "crs-wrap";

    const task = document.createElement("div");
    task.className = "crs-task";
    task.innerHTML = `把水晶按 <b>从暗到亮</b> 的顺序点一遍！<br><span class="crs-sub">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "crs-stage";
    this.crystals = [];
    const order = shuffle([...Array(n).keys()]); // 乱序摆放 level
    order.forEach((level, pos) => {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "crs-crystal";
      // 透明度：level 越大越亮，从 0.25 到 1
      const alpha = 0.25 + (level / Math.max(1, n - 1)) * 0.75;
      c.style.setProperty("--alpha", String(alpha));
      // 发光强度随 level
      c.style.setProperty("--glow", `${level * 6 + 2}px`);
      c.dataset.level = String(level);
      c.dataset.pos = String(pos);
      c.innerHTML = `<span class="crs-gem">💎</span><span class="crs-num"></span>`;
      c.addEventListener("click", () => this.pick(level, c));
      stage.appendChild(c);
      this.crystals.push({ level, el: c, picked: false });
    });

    wrap.appendChild(stage);
    // 进度条：已点数
    const meter = document.createElement("div");
    meter.className = "crs-meter";
    meter.innerHTML = `已排 <b id="crs-done">0</b> / ${n}`;
    wrap.appendChild(meter);
    this.root.appendChild(wrap);
    this.highlightHint();
  }

  /** 轻微提示当前该从最暗的开始（不做强引导，仅首颗脉冲）。 */
  private highlightHint(): void {
    const darkest = this.crystals
      .filter((c) => !c.picked)
      .sort((a, b) => a.level - b.level)[0];
    this.crystals.forEach((c) => c.el.classList.remove("crs-crystal--hint"));
    // 仅当还没点过任何时给提示
    if (this.nextLevel === 0 && darkest) {
      darkest.el.classList.add("crs-crystal--hint");
    }
  }

  private pick(level: number, btn: HTMLElement): void {
    if (this.busy) return;
    if (level === this.nextLevel) {
      // 答对
      this.busy = true;
      const crystal = this.crystals.find((c) => c.el === btn);
      if (crystal) crystal.picked = true;
      btn.classList.add("crs-crystal--done");
      btn.classList.remove("crs-crystal--hint");
      // 显示序号
      const num = btn.querySelector(".crs-num");
      if (num) num.textContent = String(level + 1);
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top);
      this.resetWrongStreak();
      this.nextLevel += 1;
      const done = this.root.querySelector("#crs-done");
      if (done) done.textContent = String(this.nextLevel);
      this.trackTimeout(() => {
        this.busy = false;
        if (this.nextLevel >= this.count()) {
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
      }, 200);
    } else {
      // 顺序错
      btn.classList.add("crs-crystal--shake");
      this.trackTimeout(() => btn.classList.remove("crs-crystal--shake"), 400);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先找最暗（最不亮）的水晶，一个比一个亮地点～",
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
    if (document.getElementById("crs-style")) return;
    const st = document.createElement("style");
    st.id = "crs-style";
    st.textContent = CRS_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function CRS_CSS(theme: string): string {
  return `
.crs-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.crs-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.crs-sub{font-size:.85rem;font-weight:600;color:var(--ink-soft,#888);}
.crs-stage{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:14px;padding:24px 16px;width:100%;background:radial-gradient(ellipse at 50% 40%,#1a2440,#0b1024);border-radius:24px;box-shadow:var(--shadow);}
.crs-crystal{position:relative;width:84px;height:96px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .12s;}
.crs-gem{font-size:3rem;line-height:1;opacity:var(--alpha,.5);filter:drop-shadow(0 0 var(--glow,2px) ${theme}) drop-shadow(0 3px 4px rgba(0,0,0,.4));transition:all .2s;}
.crs-num{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);min-width:22px;height:22px;padding:0 4px;border-radius:999px;background:#fff;color:var(--ink);font-size:.8rem;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow);}
.crs-crystal:active{transform:scale(.9);}
.crs-crystal--hint{animation:crs-pulse 1s ease-in-out infinite;}
.crs-crystal--done .crs-gem{filter:drop-shadow(0 0 calc(var(--glow,2px) + 6px) #fff) drop-shadow(0 0 var(--glow,2px) ${theme});}
.crs-crystal--shake{animation:crs-shake .4s;}
@keyframes crs-pulse{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
@keyframes crs-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-6px);}75%{transform:translateX(6px);}}
.crs-meter{font-size:.95rem;font-weight:700;background:#fff;padding:6px 18px;border-radius:999px;box-shadow:var(--shadow);}
@media (max-width:380px){.crs-crystal{width:70px;height:82px;}.crs-gem{font-size:2.4rem;}}
`;
}

export function create(): CrystalSortGame {
  return new CrystalSortGame();
}
