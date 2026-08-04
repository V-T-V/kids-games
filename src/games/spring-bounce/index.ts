/* 弹簧跳跃 Spring Bounce —— 按住按钮压缩弹簧（越久压缩越深、弹得越高），
   松开后球向上弹出，要落在目标高度区间内。
   独特点：蓄力控制——"按多久"决定"弹多高"，训练力度估测。
   巧思：高度 ∝ 蓄力时长；目标是一条带高度的区间带，落在区间内即成功。
   视觉：底座 + 弹簧（圈数随压缩变密）+ 球 + 右侧高度标尺与目标带。
   难度=目标区间精度（越窄越难）。通关=弹对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

export class SpringBounceGame extends BaseGame {
  constructor() {
    super("spring-bounce");
  }

  private chargeBtn!: HTMLButtonElement;
  private spring!: HTMLDivElement;
  private ball!: HTMLDivElement;
  private needle!: HTMLDivElement; // 指针随蓄力上升

  private targetLo = 0; // 目标高度区间下限（% 0..100）
  private targetHi = 0; // 上限
  private charging = false;
  private chargeStart = 0;
  private maxChargeMs = 0; // 最大蓄力时长
  private bouncing = false;
  private over = false;

  private roundsDone = 0;
  private roundTotal = 0;
  private unbindBtn: (() => void) | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.maxChargeMs =
      this.difficulty === "easy"
        ? 1400
        : this.difficulty === "medium"
          ? 1200
          : 1100;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    this.unbindBtn?.();
    this.unbindBtn = null;
  }

  /** 生成保证可解的目标区间：宽度由难度决定，位置在 30~80% 间。 */
  private genTarget(): { lo: number; hi: number } {
    const width =
      this.difficulty === "easy" ? 28 : this.difficulty === "medium" ? 20 : 14;
    const lo = randInt(28, 80 - width);
    return { lo, hi: lo + width };
  }

  private startRound(): void {
    this.over = false;
    this.charging = false;
    this.bouncing = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const t = this.genTarget();
    this.targetLo = t.lo;
    this.targetHi = t.hi;
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "spb-wrap";

    const task = document.createElement("div");
    task.className = "spb-task";
    task.innerHTML = `<b>按住</b>按钮蓄力，松手让球弹进<b>绿色目标区</b>！ ${this.roundsDone + 1} / ${this.roundTotal}`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "spb-stage";

    // 右侧高度标尺 + 目标带
    const ruler = document.createElement("div");
    ruler.className = "spb-ruler";
    const target = document.createElement("div");
    target.className = "spb-target";
    target.style.bottom = `${this.targetLo}%`;
    target.style.height = `${this.targetHi - this.targetLo}%`;
    target.innerHTML = `<span>目标</span>`;
    ruler.appendChild(target);
    // 蓄力指针（随按住上升）
    this.needle = document.createElement("div");
    this.needle.className = "spb-needle";
    ruler.appendChild(this.needle);
    stage.appendChild(ruler);

    // 弹簧主体容器
    const tower = document.createElement("div");
    tower.className = "spb-tower";
    this.ball = document.createElement("div");
    this.ball.className = "spb-ball";
    this.ball.id = "spb-ball";
    tower.appendChild(this.ball);
    this.spring = document.createElement("div");
    this.spring.className = "spb-spring";
    this.spring.id = "spb-spring";
    tower.appendChild(this.spring);
    const base = document.createElement("div");
    base.className = "spb-base";
    tower.appendChild(base);
    stage.appendChild(tower);

    wrap.appendChild(stage);

    // 蓄力按钮（按住=蓄力，松开=弹）
    this.chargeBtn = document.createElement("button");
    this.chargeBtn.type = "button";
    this.chargeBtn.className = "spb-btn";
    this.chargeBtn.id = "spb-btn";
    this.chargeBtn.innerHTML = `<span class="spb-btn-main">按住蓄力</span><span class="spb-btn-hint">松手弹球</span>`;
    wrap.appendChild(this.chargeBtn);

    this.unbindBtn = bindPointer(this.chargeBtn, {
      down: () => this.startCharge(),
      up: () => this.release(),
    });
    // 兼容键盘：空格按住
    this.chargeBtn.addEventListener("click", () => {
      /* 单击不触发，靠 pointer 按住 */
    });

    this.root.appendChild(wrap);
  }

  private startCharge(): void {
    if (this.over || this.bouncing || this.charging) return;
    this.charging = true;
    this.chargeStart = performance.now();
    this.chargeBtn.classList.add("spb-btn--charging");
    this.tickCharge();
  }

  private tickCharge = (): void => {
    if (this.over) return;
    if (!this.charging) return;
    const elapsed = performance.now() - this.chargeStart;
    const ratio = Math.min(1, elapsed / this.maxChargeMs);
    // 弹簧压缩（高度变小）+ 指针上升
    const compress = ratio;
    this.spring.style.transform = `scaleY(${1 - compress * 0.55})`;
    this.needle.style.bottom = `${ratio * 100}%`;
    if (ratio >= 1) {
      // 到达最大蓄力自动释放
      this.release();
      return;
    }
    requestAnimationFrame(this.tickCharge);
  };

  private release(): void {
    if (this.over || this.bouncing || !this.charging) return;
    this.charging = false;
    this.chargeBtn.classList.remove("spb-btn--charging");
    const elapsed = performance.now() - this.chargeStart;
    const ratio = Math.min(1, elapsed / this.maxChargeMs);
    // 弹起高度 = 蓄力比例（0..1 → 0..100%）
    this.bounce(ratio);
  }

  /** 球向上弹到 ratio*100% 高度，判断是否落入目标区间。 */
  private bounce(ratio: number): void {
    this.bouncing = true;
    const peak = ratio * 100; // 0..100
    // 弹簧回弹
    this.spring.style.transform = `scaleY(1)`;
    const start = performance.now();
    const dur = 600;
    const animate = (now: number): void => {
      if (this.over) return;
      const t = Math.min(1, (now - start) / dur);
      // 先升到 peak 再落下：用三角波
      const upDown = t < 0.5 ? t * 2 : (1 - t) * 2;
      const eased = upDown; // 线性即可，先升后降
      const h = peak * eased;
      this.ball.style.bottom = `calc(60px + ${h * 3}px)`; // 基座高度 + 弹起
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.ball.style.bottom = "60px";
        this.judge(peak);
      }
    };
    requestAnimationFrame(animate);
  }

  private judge(peak: number): void {
    const hit = peak >= this.targetLo && peak <= this.targetHi;
    if (hit) {
      sfxPop();
      this.resetWrongStreak();
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.chargeBtn.classList.add("spb-btn--good");
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      this.onWrong();
      this.chargeBtn.classList.add("spb-btn--bad");
      // 落点提示
      const hint = this.root.querySelector(
        ".spb-hint",
      ) as HTMLDivElement | null;
      if (!hint) {
        const h = document.createElement("div");
        h.className = "spb-hint";
        h.textContent =
          peak < this.targetLo
            ? "弹矮啦，再按久一点～"
            : "弹高啦，少按一会儿～";
        this.root.querySelector(".spb-wrap")?.appendChild(h);
      }
      this.trackTimeout(() => {
        this.chargeBtn.classList.remove("spb-btn--bad");
        this.bouncing = false;
        const h = this.root.querySelector(".spb-hint");
        if (h) h.remove();
      }, 900);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("spb-style")) return;
    const st = document.createElement("style");
    st.id = "spb-style";
    st.textContent = SPB_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SPB_CSS(theme: string): string {
  return `
.spb-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;}
.spb-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;max-width:420px;}
.spb-task b{color:${theme};}
.spb-stage{position:relative;display:flex;gap:10px;width:100%;max-width:360px;height:360px;background:linear-gradient(180deg,#e3f2fd,#fff);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;padding:12px;}
.spb-ruler{position:relative;width:38px;height:100%;background:linear-gradient(180deg,transparent,#f5f5f5);border-right:2px dashed #ccc;}
.spb-target{position:absolute;left:0;right:0;background:repeating-linear-gradient(45deg,${theme}55 0 8px,${theme}33 8px 16px);border:2px solid ${theme};border-radius:4px;display:flex;align-items:center;justify-content:center;}
.spb-target span{font-size:.6rem;font-weight:900;color:#1b5e20;writing-mode:vertical-rl;letter-spacing:2px;}
.spb-needle{position:absolute;left:-4px;width:46px;height:4px;background:#ff6348;border-radius:2px;bottom:0;box-shadow:0 0 4px rgba(255,99,72,.6);z-index:3;transition:none;}
.spb-tower{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;}
.spb-ball{position:absolute;bottom:60px;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff6,${theme} 65%,color-mix(in srgb,${theme} 65%,#000));box-shadow:inset 0 -4px 6px rgba(0,0,0,.2),0 4px 6px rgba(0,0,0,.2);z-index:4;will-change:bottom;}
.spb-spring{width:50px;height:110px;margin-bottom:0;background:repeating-linear-gradient(0deg,transparent 0 6px,#90a4ae 6px 12px);border-left:3px solid #607d8b;border-right:3px solid #607d8b;transform-origin:bottom center;transition:none;will-change:transform;}
.spb-base{width:90px;height:18px;background:linear-gradient(180deg,#455a64,#263238);border-radius:8px;box-shadow:var(--shadow);}
.spb-btn{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:200px;min-height:64px;border:none;border-radius:20px;background:linear-gradient(160deg,${theme},color-mix(in srgb,${theme} 70%,#000));color:#fff;box-shadow:0 6px 0 color-mix(in srgb,${theme} 50%,#000),var(--shadow);cursor:pointer;transition:transform .1s ease;user-select:none;touch-action:none;}
.spb-btn-main{font-size:1.5rem;font-weight:900;}
.spb-btn-hint{font-size:.75rem;font-weight:700;opacity:.85;}
.spb-btn:active,.spb-btn--charging{transform:translateY(4px);box-shadow:0 2px 0 color-mix(in srgb,${theme} 50%,#000),var(--shadow);}
.spb-btn--good{animation:spb-good .4s ease;}
@keyframes spb-good{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
.spb-btn--bad{animation:spb-bad .3s ease;}
@keyframes spb-bad{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.spb-hint{font-size:.95rem;font-weight:800;color:#ff6348;background:#fff;padding:6px 18px;border-radius:999px;box-shadow:var(--shadow);}
@media (max-width:380px){.spb-stage{height:300px;}.spb-spring{height:90px;}.spb-btn{min-width:170px;}}
`;
}

export function create(): SpringBounceGame {
  return new SpringBounceGame();
}
