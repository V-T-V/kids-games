/* 蛙鸣 Frog Croak —— 青蛙按节奏叫（Web Audio 合成 N 次"呱"声），
   孩子记住次数后按相同次数点击青蛙复现。
   独特点：纯 Web Audio 合成的蛙鸣（低频方波 + 共振），训练听觉计数。
   玩法：先听青蛙叫几声，再点青蛙相同次数。
   视觉：青蛙（CSS）+ 节奏气泡 + 计数。难度 = 叫声数(2-6)。
   通关 = 复现对目标轮数。前缀 fcr- 不冲突。
   保证有解：只需孩子按对次数，不判节奏。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

type Phase = "listen" | "echo" | "done";

/** 合成一声"呱"（低频方波 + 快速衰减 + 轻微弯音，听起来像蛙鸣）。 */
function croak(): void {
  try {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) {
      sfxPop();
      return;
    }
    const ctx = new AC();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    // 弯音：从 ~180Hz 滑到 ~120Hz，模仿"呱"的下行
    osc.frequency.setValueAtTime(190, t0);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.16);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.26);
    // 自动释放
    window.setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch {
    sfxPop();
  }
}

export class FrogCroakGame extends BaseGame {
  constructor() {
    super("frog-croak");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private sequence = 0; // 这一关要叫的次数
  private echoed = 0; // 孩子已点的次数
  private phase: Phase = "listen";
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM/trackTimeout 由基类清理 */
  }

  private croakRange(): [number, number] {
    return this.difficulty === "easy"
      ? [2, 3]
      : this.difficulty === "medium"
        ? [3, 4]
        : [4, 6];
  }

  private startRound(): void {
    this.phase = "listen";
    this.locked = true;
    this.echoed = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const [lo, hi] = this.croakRange();
    this.sequence = randInt(lo, hi);

    const wrap = document.createElement("div");
    wrap.className = "fcr-wrap";

    const task = document.createElement("div");
    task.className = "fcr-task";
    task.id = "fcr-task";
    task.innerHTML = `听青蛙叫<b>几声</b>，再点它<b>同样次数</b>！<br><span class="fcr-sub">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    // 青蛙（可点）
    const stage = document.createElement("div");
    stage.className = "fcr-stage";
    const frog = document.createElement("button");
    frog.type = "button";
    frog.className = "fcr-frog";
    frog.setAttribute("aria-label", "青蛙");
    frog.disabled = true;
    frog.innerHTML = `
      <div class="fcr-body">
        <div class="fcr-eye fcr-eye--l"></div>
        <div class="fcr-eye fcr-eye--r"></div>
        <div class="fcr-mouth"></div>
        <div class="fcr-belly"></div>
      </div>
    `;
    frog.addEventListener("click", () => this.tap(frog));
    stage.appendChild(frog);
    wrap.appendChild(stage);

    const hint = document.createElement("div");
    hint.className = "fcr-hint";
    hint.id = "fcr-hint";
    hint.textContent = "仔细听…";
    wrap.appendChild(hint);

    const countRow = document.createElement("div");
    countRow.className = "fcr-count";
    countRow.id = "fcr-count";
    wrap.appendChild(countRow);

    // 重听按钮（仅 echo 阶段可用前才需要——这里听完后不再重听，简化）
    const replayBtn = document.createElement("button");
    replayBtn.type = "button";
    replayBtn.className = "fcr-replay";
    replayBtn.id = "fcr-replay";
    replayBtn.textContent = "🔁 再听一遍";
    replayBtn.style.display = "none";
    replayBtn.addEventListener("click", () => this.playSequence());
    wrap.appendChild(replayBtn);

    this.root.appendChild(wrap);

    // 0.8s 后开始播放
    this.trackTimeout(() => this.playSequence(), 800);
  }

  private playSequence(): void {
    if (this.phase !== "listen") return;
    this.locked = true;
    const frog = this.root.querySelector(
      ".fcr-frog",
    ) as HTMLButtonElement | null;
    if (frog) frog.disabled = true;
    const replay = this.root.querySelector(
      "#fcr-replay",
    ) as HTMLButtonElement | null;
    if (replay) replay.style.display = "none";
    const hint = this.root.querySelector("#fcr-hint");
    if (hint) hint.textContent = "听…🐸";
    this.renderCount(0, true);
    let done = 0;
    const step = (): void => {
      if (done >= this.sequence) {
        // 播完进入回声阶段
        this.phase = "echo";
        this.echoed = 0;
        this.locked = false;
        if (frog) frog.disabled = false;
        if (replay) replay.style.display = "";
        const ht = this.root.querySelector("#fcr-hint");
        if (ht) ht.textContent = `现在点青蛙相同次数！（${this.sequence} 声）`;
        this.renderCount(0, false);
        return;
      }
      croak();
      this.bounceFrog();
      done += 1;
      this.renderCount(done, true);
      this.trackTimeout(step, 620);
    };
    step();
  }

  private bounceFrog(): void {
    const frog = this.root.querySelector(".fcr-frog") as HTMLElement | null;
    frog?.classList.remove("fcr-frog--croak");
    // 触发重排以重启动画
    if (frog) void frog.offsetWidth;
    frog?.classList.add("fcr-frog--croak");
  }

  private tap(frog: HTMLButtonElement): void {
    if (this.locked || this.phase !== "echo") return;
    this.echoed += 1;
    croak();
    this.bounceFrog();
    this.renderCount(this.echoed, false);
    if (this.echoed >= this.sequence) {
      // 判定：只看次数是否对（必然对，因为达到 sequence 才进来）
      this.locked = true;
      this.phase = "done";
      const r = frog.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 800);
    }
  }

  private renderCount(n: number, listening: boolean): void {
    const box = this.root.querySelector("#fcr-count");
    if (!box) return;
    box.innerHTML = "";
    const total = listening ? this.sequence : this.sequence;
    for (let i = 0; i < total; i++) {
      const dot = document.createElement("span");
      dot.className = "fcr-dot";
      if (i < n) dot.classList.add("fcr-dot--on");
      box.appendChild(dot);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("fcr-style")) return;
    const st = document.createElement("style");
    st.id = "fcr-style";
    st.textContent = FCR_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function FCR_CSS(theme: string): string {
  return `
.fcr-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.fcr-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.fcr-task b{color:${theme};}
.fcr-sub{font-size:.85rem;font-weight:700;color:#888;}
.fcr-stage{display:flex;align-items:center;justify-content:center;width:280px;height:240px;background:radial-gradient(ellipse at 50% 40%,rgba(107,207,127,.3),transparent 70%),linear-gradient(180deg,#dff5e1,#bfe8c4);border-radius:28px;box-shadow:var(--shadow);}
.fcr-frog{background:none;border:none;cursor:pointer;padding:0;filter:drop-shadow(0 6px 6px rgba(0,0,0,.2));transition:transform .15s;}
.fcr-frog:disabled{cursor:default;}
.fcr-frog--croak{animation:fcr-bounce .4s ease;}
@keyframes fcr-bounce{0%{transform:scale(1)}30%{transform:scale(1.12) translateY(-6px)}60%{transform:scale(.96) translateY(2px)}100%{transform:scale(1)}}
.fcr-body{position:relative;width:150px;height:130px;background:radial-gradient(circle at 40% 30%,#8fe39a,#5fb870 70%,#3f9550);border-radius:50% 50% 46% 46%;box-shadow:inset 0 -10px 16px rgba(0,0,0,.2);}
.fcr-eye{position:absolute;top:-14px;width:38px;height:38px;background:radial-gradient(circle at 50% 40%,#8fe39a,#5fb870);border-radius:50%;box-shadow:inset 0 -4px 6px rgba(0,0,0,.2);}
.fcr-eye::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:16px;height:16px;background:#111;border-radius:50%;box-shadow:inset 2px -2px 0 rgba(255,255,255,.5);}
.fcr-eye--l{left:18px;}
.fcr-eye--r{right:18px;}
.fcr-mouth{position:absolute;left:50%;top:62%;transform:translateX(-50%);width:60px;height:18px;background:#3a7a45;border-radius:0 0 30px 30px;box-shadow:inset 0 2px 4px rgba(0,0,0,.3);}
.fcr-belly{position:absolute;left:50%;bottom:8%;transform:translateX(-50%);width:90px;height:40px;background:rgba(255,255,255,.25);border-radius:50%;}
.fcr-hint{font-size:1.05rem;font-weight:800;color:#3a7a45;text-align:center;min-height:1.6rem;}
.fcr-count{display:flex;gap:10px;justify-content:center;min-height:22px;flex-wrap:wrap;max-width:300px;}
.fcr-dot{width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:inset 0 -3px 4px rgba(0,0,0,.15),0 2px 3px rgba(0,0,0,.15);transition:background .2s,transform .2s;}
.fcr-dot--on{background:${theme};transform:scale(1.15);box-shadow:0 0 0 3px rgba(107,207,127,.4);}
.fcr-replay{border:none;background:#fff;color:#555;font-weight:700;font-size:.95rem;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);cursor:pointer;}
.fcr-replay:active{transform:scale(.95);}
@media (max-width:380px){.fcr-stage{width:240px;height:210px;}.fcr-body{width:130px;height:114px;}}
`;
}

export function create(): FrogCroakGame {
  return new FrogCroakGame();
}
