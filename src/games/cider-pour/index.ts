/* 果汁量 Cider Pour —— 杯子上有一条目标刻度线，按住"倒果汁"按钮持续倒，
   松手停。倒到刻度线范围内即成功；超了要"倒掉"重来。
   独特点：长按控制倒入量，可视化液面上升 + 目标带，训练估量与时机。
   视觉：玻璃杯 + 刻度 + 上升的果汁液面 + 目标带。
   难度=目标带宽度（越窄越难）。通关=倒对目标轮数。前缀 cp3-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

export class CiderPourGame extends BaseGame {
  constructor() {
    super("cider-pour");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 当前液面高度百分比 0-100 */
  private level = 0;
  /** 目标区间 [lo, hi]（百分比） */
  private target: [number, number] = [50, 60];
  /** 是否正在倒（按住按钮） */
  private pouring = false;
  /** 锁定（结算中） */
  private locked = false;
  private raf = 0;
  private last = 0;
  /** 倒入速度（百分比/秒） */
  private speed = 0;
  /** DOM 引用 */
  private fillEl: HTMLDivElement | null = null;
  private levelEl: HTMLSpanElement | null = null;
  private cleanups: (() => void)[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.stopPour();
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** 目标带宽度（容差），按难度 */
  private tolerance(): number {
    return this.difficulty === "easy"
      ? 14
      : this.difficulty === "medium"
        ? 9
        : 6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.stopPour();
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    this.level = 0;

    // 目标居中 30-70 之间，避免贴底或贴顶
    const tol = this.tolerance();
    const center = randInt(35, 70);
    this.target = [center - tol, center + tol];
    // 倒入速度：hard 更快更难控制
    this.speed =
      this.difficulty === "easy" ? 32 : this.difficulty === "medium" ? 42 : 55;

    const wrap = document.createElement("div");
    wrap.className = "cp3-wrap";

    const task = document.createElement("div");
    task.className = "cp3-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 把果汁倒到<b>绿色目标带</b>，超了要倒掉！`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "cp3-stage";
    const glass = document.createElement("div");
    glass.className = "cp3-glass";

    // 目标带（绿色半透明带）
    const band = document.createElement("div");
    band.className = "cp3-target";
    band.style.setProperty("--cp3-lo", `${this.target[0]}%`);
    band.style.setProperty("--cp3-hi", `${this.target[1]}%`);
    glass.appendChild(band);

    // 刻度线
    const ticks = document.createElement("div");
    ticks.className = "cp3-ticks";
    for (let i = 0; i <= 4; i++) {
      const t = document.createElement("div");
      t.className = "cp3-tick";
      t.style.bottom = `${(i / 4) * 100}%`;
      ticks.appendChild(t);
    }
    glass.appendChild(ticks);

    // 液体填充
    const fill = document.createElement("div");
    fill.className = "cp3-fill";
    fill.style.height = "0%";
    glass.appendChild(fill);
    this.fillEl = fill;

    // 杯口倒入流（仅倒时显示）
    const stream = document.createElement("div");
    stream.className = "cp3-stream";
    glass.appendChild(stream);

    stage.appendChild(glass);
    wrap.appendChild(stage);

    // 数值显示
    const readout = document.createElement("div");
    readout.className = "cp3-readout";
    readout.innerHTML = `液面：<span id="cp3-level">0</span>%`;
    wrap.appendChild(readout);
    this.levelEl = readout.querySelector("#cp3-level");

    // 控制按钮
    const controls = document.createElement("div");
    controls.className = "cp3-controls";
    const pourBtn = document.createElement("button");
    pourBtn.type = "button";
    pourBtn.className = "cp3-btn cp3-btn--pour";
    pourBtn.textContent = "🚰 按住倒果汁";
    const dumpBtn = document.createElement("button");
    dumpBtn.type = "button";
    dumpBtn.className = "cp3-btn cp3-btn--dump";
    dumpBtn.textContent = "🚽 倒掉重来";
    controls.appendChild(pourBtn);
    controls.appendChild(dumpBtn);
    wrap.appendChild(controls);
    this.root.appendChild(wrap);

    // 按住倒
    const down = (e: Event) => {
      e.preventDefault();
      if (this.locked) return;
      this.startPour();
    };
    const up = (e: Event) => {
      e.preventDefault();
      this.stopPour();
      // 松开按钮时评估当前液面是否在目标范围内
      if (!this.locked && this.level > 0) {
        this.judge(false);
      }
    };
    pourBtn.addEventListener("pointerdown", down);
    pourBtn.addEventListener("pointerup", up);
    pourBtn.addEventListener("pointercancel", up);
    pourBtn.addEventListener("pointerleave", up);
    this.cleanups.push(() => {
      pourBtn.removeEventListener("pointerdown", down);
      pourBtn.removeEventListener("pointerup", up);
      pourBtn.removeEventListener("pointercancel", up);
      pourBtn.removeEventListener("pointerleave", up);
    });

    dumpBtn.addEventListener("click", () => this.dump());
  }

  private startPour(): void {
    if (this.pouring) return;
    this.pouring = true;
    this.last = performance.now();
    this.root.querySelector(".cp3-glass")?.classList.add("cp3-glass--pouring");
    this.loop();
  }

  private stopPour(): void {
    this.pouring = false;
    this.root
      .querySelector(".cp3-glass")
      ?.classList.remove("cp3-glass--pouring");
  }

  private loop = (): void => {
    if (!this.pouring || this.locked) {
      this.raf = 0;
      return;
    }
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    this.level = Math.min(100, this.level + this.speed * dt);
    this.renderLevel();

    if (this.level >= 100) {
      // 满了，视为超出
      this.stopPour();
      this.judge(true);
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private renderLevel(): void {
    if (this.fillEl) this.fillEl.style.height = `${this.level}%`;
    if (this.levelEl) this.levelEl.textContent = String(Math.round(this.level));
    // 高亮目标带命中
    const inBand = this.level >= this.target[0] && this.level <= this.target[1];
    this.fillEl?.classList.toggle("cp3-fill--good", inBand);
  }

  /** 松手结算 */
  private judge(overflow: boolean): void {
    if (this.locked) return;
    this.locked = true;
    const inBand = this.level >= this.target[0] && this.level <= this.target[1];
    if (!overflow && inBand) {
      // 命中
      sfxPop();
      const r = this.fillEl?.getBoundingClientRect();
      this.onCorrect(
        r ? r.left + r.width / 2 : window.innerWidth / 2,
        r ? r.top : window.innerHeight / 2,
      );
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 800);
    } else {
      // 超出或未到（松手时未到不算错，仅超出算错并要求倒掉）
      if (!overflow) {
        // 没倒够：允许继续倒（不锁）
        this.locked = false;
        return;
      }
      const paused = this.onWrong();
      this.fillEl?.classList.add("cp3-fill--bad");
      this.trackTimeout(
        () => this.fillEl?.classList.remove("cp3-fill--bad"),
        600,
      );
      if (paused) this.showRest();
      else this.trackTimeout(() => this.dump(), 700);
    }
  }

  private dump(): void {
    this.stopPour();
    this.level = 0;
    this.locked = false;
    this.renderLevel();
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🧃",
      variant: "rest",
      body: "果汁倒到目标带就要松手哦，倒太满会溢出来～",
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
    if (document.getElementById("cp3-style")) return;
    const st = document.createElement("style");
    st.id = "cp3-style";
    st.textContent = CP3_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function CP3_CSS(theme: string): string {
  return `
.cp3-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(420px,100%);}
.cp3-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.cp3-stage{display:flex;justify-content:center;padding:10px 0;}
.cp3-glass{position:relative;width:140px;height:280px;background:linear-gradient(180deg,rgba(255,255,255,.45),rgba(255,255,255,.15));border:4px solid rgba(255,255,255,.85);border-top:none;border-radius:0 0 30px 30px;backdrop-filter:blur(2px);box-shadow:var(--shadow),inset 0 0 20px rgba(255,255,255,.25);overflow:hidden;}
.cp3-target{position:absolute;left:-8px;right:-8px;bottom:var(--cp3-lo);height:calc(var(--cp3-hi) - var(--cp3-lo));background:repeating-linear-gradient(45deg,rgba(107,207,127,.35),rgba(107,207,127,.35) 8px,rgba(107,207,127,.55) 8px,rgba(107,207,127,.55) 16px);border-top:3px dashed #3a8a30;border-bottom:3px dashed #3a8a30;z-index:2;}
.cp3-ticks{position:absolute;inset:0;pointer-events:none;z-index:1;}
.cp3-tick{position:absolute;left:0;width:14px;height:2px;background:rgba(0,0,0,.2);}
.cp3-fill{position:absolute;left:0;right:0;bottom:0;height:0%;background:linear-gradient(180deg,#ffd07a,#ff9f43);transition:background .2s;z-index:1;}
.cp3-fill::before{content:"";position:absolute;top:-6px;left:0;right:0;height:8px;background:rgba(255,255,255,.5);border-radius:50%;}
.cp3-fill--good{background:linear-gradient(180deg,#9be36b,#5fc04a);}
.cp3-fill--bad{background:linear-gradient(180deg,#ff8a72,#ff5a3c);animation:cp3-shake .4s ease;}
@keyframes cp3-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.cp3-stream{position:absolute;top:-2px;left:50%;transform:translateX(-50%);width:8px;height:0;background:linear-gradient(180deg,#ffd07a,#ff9f43);border-radius:4px;opacity:0;transition:opacity .1s;z-index:3;}
.cp3-glass--pouring .cp3-stream{height:32px;opacity:1;}
.cp3-readout{font-size:1rem;font-weight:800;color:#555;background:#fff;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
.cp3-controls{display:flex;gap:14px;justify-content:center;width:100%;}
.cp3-btn{font-size:1.05rem;font-weight:800;padding:16px 22px;border:none;border-radius:18px;cursor:pointer;user-select:none;touch-action:none;transition:transform .08s;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.1);}
.cp3-btn--pour{background:linear-gradient(180deg,#ffd07a,${theme});color:#5a3a10;}
.cp3-btn--pour:active{transform:translateY(3px);}
.cp3-btn--dump{background:linear-gradient(180deg,#fff,#e8e8e8);color:#666;}
.cp3-btn--dump:active{transform:translateY(3px);}
@media (max-width:380px){.cp3-glass{width:120px;height:240px;}.cp3-btn{font-size:.95rem;padding:14px 16px;}}
`;
}

export function create(): CiderPourGame {
  return new CiderPourGame();
}
