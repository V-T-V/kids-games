/* 拉霸机 Slot Machine —— 3 个轮子滚动图案，孩子依次按「停」按钮停每个轮，
   停后看是否 3 个相同。视觉：3 列垂直滚动 + 独立停止按钮。用 RAF 驱动滚动
   （unmount 必须 cancelAnimationFrame）。难度=图案种类（越多越难凑齐三连）。
   通关=转到目标轮数（每轮出图，相同+1，不同也+1推进，星按相同次数算）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

const POOL: string[] = ["🍎", "🍇", "🍓", "🍒", "🍋", "⭐", "🔔", "💎"];

interface ReelState {
  el: HTMLElement; // 列容器
  strip: HTMLElement; // 滚动条
  stopBtn: HTMLButtonElement;
  velocity: number; // px/frame
  offset: number;
  stopped: boolean;
  finalSymbol: string;
}

export class SlotMachineGame extends BaseGame {
  constructor() {
    super("slot-machine");
  }

  private kinds = 4;
  private roundsDone = 0;
  private roundTotal = 0;
  private hits = 0; // 三连成功次数（用于算星）
  private raf = 0;
  private over = false;
  private reels: ReelState[] = [];
  private itemH = 88;

  protected mount(): void {
    this.kinds =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.hits = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  /** 本轮用到的图案子集（kinds 种）。 */
  private symbols(): string[] {
    return POOL.slice(0, this.kinds);
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.over = false;
    this.reels = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "slm-wrap";

    const task = document.createElement("div");
    task.className = "slm-task";
    task.innerHTML = `按 <b>停</b> 让每个轮子停下，三个一样就赢！<br><small>第 ${this.roundsDone + 1} / ${this.roundTotal} 轮</small>`;
    wrap.appendChild(task);

    const machine = document.createElement("div");
    machine.className = "slm-machine";
    for (let i = 0; i < 3; i++) {
      const reel = document.createElement("div");
      reel.className = "slm-reel";
      const strip = document.createElement("div");
      strip.className = "slm-strip";
      reel.appendChild(strip);

      const stopBtn = document.createElement("button");
      stopBtn.type = "button";
      stopBtn.className = "slm-stop";
      stopBtn.textContent = "停";
      reel.appendChild(stopBtn);

      machine.appendChild(reel);
    }
    wrap.appendChild(machine);

    const hint = document.createElement("div");
    hint.className = "slm-hint";
    hint.id = "slm-hint";
    hint.textContent = "三个一样 ⭐⭐⭐";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);

    // 初始化每个轮子
    const reels = this.root.querySelectorAll<HTMLElement>(".slm-reel");
    const syms = this.symbols();
    reels.forEach((reel) => {
      const strip = reel.querySelector<HTMLElement>(".slm-strip")!;
      const stopBtn = reel.querySelector<HTMLButtonElement>(".slm-stop")!;
      // 填充一段随机图案串（足够长以看起来在滚动）
      const items: string[] = [];
      for (let i = 0; i < 40; i++) items.push(sample(syms));
      items.forEach((s) => {
        const cell = document.createElement("div");
        cell.className = "slm-item";
        cell.textContent = s;
        strip.appendChild(cell);
      });
      const st: ReelState = {
        el: reel,
        strip,
        stopBtn,
        velocity: 16 + Math.random() * 6,
        offset: 0,
        stopped: false,
        finalSymbol: "",
      };
      this.reels.push(st);
      stopBtn.addEventListener("click", () => this.stopReel(st));
    });

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private last = 0;

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 16.67; // 归一化到 ~60fps
    this.last = now;
    if (dt > 3) dt = 3;
    for (const r of this.reels) {
      if (!r.stopped) {
        r.offset += r.velocity * dt;
        // 循环：超过 strip 高度一半就回退（我们填了 40 项）
        const half = (40 / 2) * this.itemH;
        if (r.offset > half) r.offset -= half;
        r.strip.style.transform = `translateY(${-r.offset}px)`;
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private stopReel(r: ReelState): void {
    if (r.stopped) return;
    r.stopped = true;
    r.stopBtn.disabled = true;
    r.stopBtn.classList.add("slm-stop--done");
    // 把当前显示的图案（顶部第一格中心）锁定
    const idx = Math.round(r.offset / this.itemH) % 40;
    const items = r.strip.children;
    const node = items[(idx + 40) % 40] as HTMLElement | undefined;
    r.finalSymbol = node?.textContent ?? "";
    sfxPop();
    // 吸附到整格
    r.offset = Math.round(r.offset / this.itemH) * this.itemH;
    r.strip.style.transform = `translateY(${-r.offset}px)`;

    if (this.reels.every((x) => x.stopped)) {
      this.settle();
    }
  }

  private settle(): void {
    const [a, b, c] = this.reels;
    const win =
      !!a &&
      !!b &&
      !!c &&
      a.finalSymbol === b.finalSymbol &&
      b.finalSymbol === c.finalSymbol;
    const hint = this.root.querySelector<HTMLElement>("#slm-hint");
    if (win) {
      this.hits += 1;
      if (hint) hint.innerHTML = `🎉 三连 ${a!.finalSymbol} 太棒了！`;
      const rect = this.root
        .querySelector<HTMLElement>(".slm-machine")!
        .getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.resetWrongStreak();
    } else {
      if (hint) hint.innerHTML = `差一点～再拉一次！`;
      this.onWrong();
    }
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    // 停 RAF
    this.over = true;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(
          starsByScore(this.hits, [
            this.roundTotal,
            Math.max(1, Math.ceil(this.roundTotal / 2)),
          ]),
        );
      } else {
        this.startRound();
      }
    }, 1300);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "歇一歇～",
      emoji: "🎰",
      variant: "rest",
      body: "一个一个按「停」，让三个轮子显示一样的图案～",
      primary: { text: "继续", icon: "🎰", onClick: () => ov.destroy() },
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
    if (document.getElementById("slm-style")) return;
    const st = document.createElement("style");
    st.id = "slm-style";
    st.textContent = SLM_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function SLM_CSS(theme: string): string {
  return `
.slm-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:100%;}
.slm-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.slm-task b{color:${theme};}
.slm-task small{display:block;margin-top:3px;font-weight:700;color:#888;font-size:.82rem;}
.slm-machine{display:flex;gap:12px;padding:18px 18px 14px;background:linear-gradient(160deg,#5b2a86,${theme});border:8px solid #ffd93d;border-radius:24px;box-shadow:var(--shadow-lg);}
.slm-reel{display:flex;flex-direction:column;align-items:center;gap:8px;background:rgba(0,0,0,.18);padding:8px;border-radius:14px;}
.slm-strip{width:78px;height:88px;overflow:hidden;background:#fff;border-radius:10px;box-shadow:inset 0 0 0 2px rgba(0,0,0,.1);position:relative;}
.slm-strip::before,.slm-strip::after{content:"";position:absolute;left:0;right:0;height:14px;z-index:2;pointer-events:none;}
.slm-strip::before{top:0;background:linear-gradient(180deg,rgba(0,0,0,.18),transparent);}
.slm-strip::after{bottom:0;background:linear-gradient(0deg,rgba(0,0,0,.18),transparent);}
.slm-item{height:88px;display:flex;align-items:center;justify-content:center;font-size:3rem;line-height:88px;}
.slm-stop{width:64px;height:48px;font-size:1.2rem;font-weight:900;color:#fff;background:linear-gradient(160deg,#ff6b6b,#c92a2a);border:none;border-radius:12px;box-shadow:0 4px 0 #8a1d1d;cursor:pointer;transition:transform .1s;}
.slm-stop:active{transform:translateY(2px);}
.slm-stop--done{background:linear-gradient(160deg,#9aa0a6,#6c757d);box-shadow:0 4px 0 #495057;}
.slm-stop:disabled{opacity:.7;}
.slm-hint{font-size:1.15rem;font-weight:800;color:#444;min-height:1.5rem;text-align:center;}
@media (max-width:380px){.slm-strip{width:64px;}.slm-item{width:64px;font-size:2.4rem;}.slm-stop{width:54px;}}
`;
}

export function create(): SlotMachineGame {
  return new SlotMachineGame();
}
