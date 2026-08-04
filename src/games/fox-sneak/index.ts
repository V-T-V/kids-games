/* 狐狸潜行 Fox Sneak —— 狐狸要悄悄靠近前方的猎物（🐰），
   猎物会不时回头看：当红色警报亮起（猎物回头）时必须停下（不按按钮），
   否则被发现。绿色时按"走"按钮前进。
   独特点：抑制冲动训练 —— 需要在"危险"信号下停止动作。
   难度=警报频率（间隔越短越难）。通关=到达目标轮数（每轮靠近一步）。
   RAF 驱动（驱动警报灯闪烁与计时），unmount 必须 cancelAnimationFrame。
   注意：CSS 前缀 fs3-（fruit-slicer 用 fsl-，farm-harvest 用 fh-，无冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

type AlertState = "safe" | "danger";

export class FoxSneakGame extends BaseGame {
  constructor() {
    super("fox-sneak");
  }

  private field!: HTMLDivElement;
  private fox!: HTMLDivElement;
  private alertLamp!: HTMLDivElement;
  /** 狐狸已前进距离 0..1（1 = 抵达猎物） */
  private progress = 0;
  private stepTotal = 0;
  private stepsDone = 0;
  private state: AlertState = "safe";
  /** 本状态剩余时间（秒） */
  private stateT = 0;
  private safeDur = 0;
  private dangerDur = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private roundEnded = false;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.progress = 0;
    this.stepsDone = 0;
    this.over = false;
    this.roundEnded = false;
    this.stepTotal =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 6 : 7;
    // safe 段长 / danger 段长（秒）。难度越高 danger 越长、safe 越短
    this.safeDur =
      this.difficulty === "easy"
        ? 2.0
        : this.difficulty === "medium"
          ? 1.6
          : 1.3;
    this.dangerDur =
      this.difficulty === "easy"
        ? 1.0
        : this.difficulty === "medium"
          ? 1.4
          : 1.8;
    this.state = "safe";
    this.stateT = this.safeDur;

    const wrap = document.createElement("div");
    wrap.className = "fs3-wrap";

    const task = document.createElement("div");
    task.className = "fs3-task";
    task.innerHTML = `绿灯走、<b style="color:#ff6348">红灯停</b>！悄悄靠近小兔 · <span id="fs3-prog">0 / ${this.stepTotal}</span> 步`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "fs3-field";

    // 警报灯（顶部）
    this.alertLamp = document.createElement("div");
    this.alertLamp.className = "fs3-lamp fs3-lamp--safe";
    this.alertLamp.textContent = "走";
    this.field.appendChild(this.alertLamp);

    // 猎物（右上）
    const prey = document.createElement("div");
    prey.className = "fs3-prey";
    prey.id = "fs3-prey";
    prey.textContent = "🐰";
    this.field.appendChild(prey);

    // 狐狸（左侧，随 progress 右移）
    this.fox = document.createElement("div");
    this.fox.className = "fs3-fox";
    this.fox.textContent = "🦊";
    this.fox.style.setProperty("--fs3-x", "0");
    this.field.appendChild(this.fox);

    wrap.appendChild(this.field);

    const ctrls = document.createElement("div");
    ctrls.className = "fs3-ctrls";
    const go = document.createElement("button");
    go.type = "button";
    go.className = "fs3-go";
    go.innerHTML = "🐾 悄悄走一步";
    go.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.step();
    });
    ctrls.appendChild(go);
    wrap.appendChild(ctrls);

    this.root.appendChild(wrap);

    requestAnimationFrame(() => {
      this.last = performance.now();
      this.loop();
    });
  }

  private step(): void {
    if (this.over || this.roundEnded) return;
    if (this.state === "danger") {
      // 危险时移动 → 被发现
      this.caught();
      return;
    }
    if (this.stepsDone >= this.stepTotal) return;
    this.stepsDone += 1;
    this.progress = this.stepsDone / this.stepTotal;
    this.fox.style.setProperty("--fs3-x", String(this.progress));
    sfxPop();
    this.resetWrongStreak();
    const pEl = this.root.querySelector("#fs3-prog");
    if (pEl) pEl.textContent = `${this.stepsDone} / ${this.stepTotal}`;
    const r = this.fox.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    if (this.stepsDone >= this.stepTotal) {
      this.roundEnded = true;
      this.trackTimeout(() => this.win(), 600);
    }
  }

  private setState(s: AlertState): void {
    this.state = s;
    this.alertLamp.classList.toggle("fs3-lamp--safe", s === "safe");
    this.alertLamp.classList.toggle("fs3-lamp--danger", s === "danger");
    this.alertLamp.textContent = s === "safe" ? "走" : "停";
    const prey = this.root.querySelector<HTMLElement>("#fs3-prey");
    if (prey) prey.classList.toggle("fs3-prey--look", s === "danger");
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    this.stateT -= dt;
    if (this.stateT <= 0) {
      // 状态切换
      if (this.state === "safe") {
        this.setState("danger");
        this.stateT = this.dangerDur;
      } else {
        this.setState("safe");
        this.stateT = this.safeDur;
      }
    }
    // 进度条样式（倒计时光环）
    this.alertLamp.style.setProperty(
      "--fs3-frac",
      String(
        1 -
          this.stateT / (this.state === "safe" ? this.safeDur : this.dangerDur),
      ),
    );

    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(
          starsByScore(this.stepTotal, [this.stepTotal, this.stepTotal]),
        );
      } else {
        this.startRound();
      }
    }, 400);
  }

  private caught(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.fox.classList.add("fs3-fox--caught");
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      // 重开本关（保证可通关）
      this.trackTimeout(() => this.startRound(), 1000);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "红灯时被发现啦，等绿灯再走哦～",
      primary: {
        text: "再试一次",
        icon: "🦊",
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
    if (document.getElementById("fs3-style")) return;
    const st = document.createElement("style");
    st.id = "fs3-style";
    st.textContent = FS3_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function FS3_CSS(theme: string): string {
  return `
.fs3-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.fs3-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.fs3-task b{color:${theme};}
.fs3-field{position:relative;width:100%;height:50vh;min-height:300px;background:linear-gradient(180deg,#cfe8ff 0%,#a8d5a0 70%,#8fc281 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
.fs3-lamp{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:900;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.25),inset 0 0 0 4px rgba(255,255,255,.4);z-index:5;background:conic-gradient(var(--ring) calc(var(--fs3-frac,0)*360deg),rgba(255,255,255,.25) 0);}
.fs3-lamp--safe{--ring:#6bcf7f;background-color:#6bcf7f;animation:fs3-glow-safe 1s ease-in-out infinite;}
.fs3-lamp--danger{--ring:#ff6348;background-color:#ff6348;animation:fs3-glow-danger .5s ease-in-out infinite;}
@keyframes fs3-glow-safe{0%,100%{box-shadow:0 4px 12px rgba(0,0,0,.25),0 0 12px rgba(107,207,127,.6)}50%{box-shadow:0 4px 12px rgba(0,0,0,.25),0 0 24px rgba(107,207,127,.9)}}
@keyframes fs3-glow-danger{0%,100%{box-shadow:0 4px 12px rgba(0,0,0,.25),0 0 14px rgba(255,99,72,.8)}50%{box-shadow:0 4px 12px rgba(0,0,0,.25),0 0 30px rgba(255,99,72,1)}}
.fs3-prey{position:absolute;right:24px;bottom:60px;font-size:2.6rem;line-height:1;z-index:4;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));}
.fs3-prey--look{transform:scaleX(-1);animation:fs3-look .3s ease;}
@keyframes fs3-look{0%{transform:scaleX(1)}100%{transform:scaleX(-1)}}
.fs3-fox{position:absolute;left:calc(8% + var(--fs3-x,0) * 64%);bottom:54px;font-size:2.6rem;line-height:1;z-index:5;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));transition:left .35s cubic-bezier(.4,1.4,.5,1);will-change:left;}
.fs3-fox--caught{animation:fs3-jump .8s ease forwards;}
@keyframes fs3-jump{0%{transform:translateY(0) rotate(0)}40%{transform:translateY(-30px) rotate(-15deg)}100%{transform:translateY(10px) rotate(20deg);opacity:.4;}}
.fs3-ctrls{display:flex;gap:12px;justify-content:center;width:100%;}
.fs3-go{font-family:inherit;font-size:1.25rem;font-weight:900;color:#fff;background:linear-gradient(160deg,${theme},#e07f1f);border:none;padding:14px 40px;border-radius:18px;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;user-select:none;touch-action:manipulation;}
.fs3-go:active{transform:scale(.94);}
@media (max-width:380px){.fs3-task{font-size:.95rem;}.fs3-fox,.fs3-prey{font-size:2.2rem;}.fs3-lamp{width:54px;height:54px;font-size:.95rem;}}
`;
}

export function create(): FoxSneakGame {
  return new FoxSneakGame();
}
