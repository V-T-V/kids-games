/* 龙焰 Dragon Breath —— 龙在左侧，右侧有若干蜡烛排成一排，
   蜡烛离龙有不同距离。点一下龙，龙喷出一团火焰向右飞，
   火焰飞的距离由「长按蓄力」决定（按住越久喷得越远）。
   松开时火焰出发，正好吹到某根蜡烛的距离就熄灭它。
   独特点：蓄力时机判定，火焰飞行动画。
   巧思：蜡烛距离分级（近/中/远），蓄力进度条对应距离，孩子按住到合适长度松开即可。
   难度 = 蜡烛数。通关 = 吹灭目标轮数。
   视觉：龙 emoji + 蜡烛 emoji + 火焰飞行动画 + 蓄力进度条。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Candle {
  /** 距离等级 1-3（近-中-远） */
  dist: number;
  lit: boolean;
  el: HTMLDivElement;
}

export class DragonBreathGame extends BaseGame {
  constructor() {
    super("dragon-breath");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private candles: Candle[] = [];
  private dragon!: HTMLDivElement;
  private breathBar!: HTMLDivElement;
  private breathFill!: HTMLDivElement;
  /** 蓄力开始时间 */
  private chargeStart = 0;
  /** 当前蓄力距离（0-3，连续） */
  private charge = 0;
  private charging = false;
  /** 火焰在飞 */
  private flying = false;
  private flyT = 0;
  private flyTarget = 0;
  private flyFlame!: HTMLDivElement;
  private field!: HTMLDivElement;
  private dragonX = 0;
  private candleX = new Map<number, number>(); // dist -> x
  private unbind: (() => void) | null = null;
  private raf = 0;
  private last = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.candles = [];
    this.charging = false;
    this.flying = false;
    this.charge = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "drb-wrap";
    const task = document.createElement("div");
    task.className = "drb-task";
    task.innerHTML = `<b>按住龙</b>蓄力，松开喷火吹灭蜡烛！看准距离松手`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "drb-field";

    this.dragon = document.createElement("div");
    this.dragon.className = "drb-dragon";
    this.dragon.textContent = "🐉";
    this.field.appendChild(this.dragon);

    // 蓄力条
    this.breathBar = document.createElement("div");
    this.breathBar.className = "drb-bar";
    this.breathFill = document.createElement("div");
    this.breathFill.className = "drb-bar-fill";
    this.breathBar.appendChild(this.breathFill);
    this.field.appendChild(this.breathBar);

    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    // 蜡烛距离数
    const n =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const dists = shuffle([1, 2, 3]).slice(0, Math.min(3, n));
    // 补充到 n 个，重复距离
    let k = 0;
    while (dists.length < n) {
      dists.push((k % 3) + 1);
      k++;
    }

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.dragonX = 70;
      this.dragon.style.left = `${this.dragonX}px`;
      this.dragon.style.top = `${r.height / 2}px`;
      // 三个距离对应的 x 位置
      this.candleX.set(1, r.width * 0.38);
      this.candleX.set(2, r.width * 0.62);
      this.candleX.set(3, r.width * 0.86);
      this.breathBar.style.left = `${this.dragonX + 50}px`;
      this.breathBar.style.top = `${r.height / 2 + 50}px`;

      // 渲染蜡烛，按距离从近到远排
      const sorted = [...dists].sort((a, b) => a - b);
      const perDistCount = new Map<number, number>();
      for (const d of sorted) {
        perDistCount.set(d, (perDistCount.get(d) ?? 0) + 1);
      }
      const placed: { dist: number; idx: number; total: number }[] = [];
      const countSoFar = new Map<number, number>();
      for (const d of sorted) {
        const sofar = countSoFar.get(d) ?? 0;
        const total = perDistCount.get(d) ?? 1;
        placed.push({ dist: d, idx: sofar, total });
        countSoFar.set(d, sofar + 1);
      }
      for (const p of placed) {
        this.addCandle(p.dist, p.idx, p.total, r.height);
      }

      // 绑定龙上的按住
      this.unbind = bindPointer(this.dragon, {
        down: () => this.startCharge(),
        up: () => this.release(),
      });

      this.last = performance.now();
      this.loop();
    });
  }

  private addCandle(
    dist: number,
    idx: number,
    total: number,
    fieldH: number,
  ): void {
    const el = document.createElement("div");
    el.className = "drb-candle";
    el.textContent = "🕯️";
    const baseX = this.candleX.get(dist)!;
    // 同距离多根时垂直错开
    const spread = total > 1 ? (idx - (total - 1) / 2) * 50 : 0;
    el.style.left = `${baseX}px`;
    el.style.top = `${fieldH / 2 + spread}px`;
    el.dataset.dist = String(dist);
    this.field.appendChild(el);
    this.candles.push({ dist, lit: true, el });
  }

  private startCharge(): void {
    if (this.charging || this.flying) return;
    this.charging = true;
    this.chargeStart = performance.now();
    this.charge = 0;
  }

  private release(): void {
    if (!this.charging || this.flying) return;
    this.charging = false;
    // 发射火焰
    this.flying = true;
    this.flyT = 0;
    this.flyTarget = this.charge; // 0-3 连续
    this.charge = 0;
    this.breathFill.style.width = `0%`;
    // 创建火焰
    this.flyFlame = document.createElement("div");
    this.flyFlame.className = "drb-flame";
    this.flyFlame.textContent = "🔥";
    const r = this.field.getBoundingClientRect();
    this.flyFlame.style.left = `${this.dragonX + 40}px`;
    this.flyFlame.style.top = `${r.height / 2}px`;
    this.field.appendChild(this.flyFlame);
    sfxPop();
  }

  private loop = (): void => {
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 蓄力：0-3 在 ~1.2s 内来回（脉冲），方便孩子瞄准三个距离
    if (this.charging) {
      const elapsed = (now - this.chargeStart) / 1000;
      // 用 sin 在 0-3 之间往复
      this.charge = 1.5 + 1.5 * Math.sin(elapsed * 2.2 - Math.PI / 2);
      if (this.charge < 0) this.charge = 0;
      if (this.charge > 3) this.charge = 3;
      this.breathFill.style.width = `${(this.charge / 3) * 100}%`;
    }

    // 火焰飞行：从龙口飞到目标距离对应的 x，约 0.5s
    if (this.flying) {
      this.flyT += dt * 2;
      const t = Math.min(1, this.flyT);
      const startX = this.dragonX + 40;
      const targetX =
        this.candleX.get(Math.round(this.flyTarget)) ?? this.dragonX + 100;
      const x = startX + (targetX - startX) * t;
      this.flyFlame.style.left = `${x}px`;
      if (t >= 1) {
        this.flying = false;
        // 判定：吹灭与目标距离最接近且未灭的蜡烛
        const targetDist = Math.round(this.flyTarget);
        // 找该距离上仍点燃的蜡烛
        let hit: Candle | null = null;
        let bestErr = Infinity;
        for (const c of this.candles) {
          if (!c.lit) continue;
          const err = Math.abs(c.dist - targetDist);
          if (err < bestErr) {
            bestErr = err;
            hit = c;
          }
        }
        if (hit && bestErr <= 0) {
          // 正好吹灭
          hit.lit = false;
          hit.el.classList.add("drb-candle--out");
          hit.el.textContent = "💨";
          sfxPop();
          this.resetWrongStreak();
          const r = this.field.getBoundingClientRect();
          this.onCorrect(
            r.left + parseFloat(hit.el.style.left),
            r.top + parseFloat(hit.el.style.top),
          );
        } else {
          // 没吹灭（距离不对）：温柔提示
          this.onWrong();
        }
        this.trackTimeout(() => {
          this.flyFlame.remove();
        }, 200);
        // 检查是否全灭
        if (this.candles.every((c) => !c.lit)) {
          this.roundsDone += 1;
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 700);
        }
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private injectStyle(): void {
    if (document.getElementById("drb-style")) return;
    const st = document.createElement("style");
    st.id = "drb-style";
    st.textContent = DRB_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function DRB_CSS(theme: string): string {
  return `
.drb-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.drb-task{font-size:1.02rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.drb-field{position:relative;width:100%;height:58vh;min-height:340px;background:linear-gradient(180deg,#2a0a0a 0%,#4a1a1a 50%,#6a2a2a 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;}
.drb-field::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 100%,rgba(255,80,0,.15),transparent 60%);pointer-events:none;}
.drb-dragon{position:absolute;font-size:3rem;line-height:1;transform:translate(-50%,-50%);z-index:5;cursor:pointer;filter:drop-shadow(0 0 10px ${theme});user-select:none;transition:transform .1s;}
.drb-dragon:active{transform:translate(-50%,-50%) scale(1.1);}
.drb-bar{position:absolute;width:120px;height:14px;border-radius:8px;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.4);overflow:hidden;transform:translateX(-50%);z-index:4;}
.drb-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,#ffd93d,#ff6348,#ff3b30);transition:width .05s linear;box-shadow:0 0 8px ${theme};}
.drb-candle{position:absolute;font-size:2.6rem;line-height:1;transform:translate(-50%,-50%);z-index:3;filter:drop-shadow(0 0 8px rgba(255,200,0,.5));pointer-events:none;animation:drb-flicker 1.2s ease-in-out infinite alternate;}
@keyframes drb-flicker{from{filter:drop-shadow(0 0 6px rgba(255,200,0,.4))}to{filter:drop-shadow(0 0 12px rgba(255,200,0,.7))}}
.drb-candle--out{animation:none;filter:grayscale(.6) opacity(.6);}
.drb-flame{position:absolute;font-size:2rem;line-height:1;transform:translate(-50%,-50%);z-index:4;filter:drop-shadow(0 0 10px ${theme});pointer-events:none;}
@media (max-width:380px){.drb-task{font-size:.9rem;}.drb-dragon{font-size:2.4rem;}.drb-candle{font-size:2rem;}.drb-bar{width:90px;}}
`;
}

export function create(): DragonBreathGame {
  return new DragonBreathGame();
}
