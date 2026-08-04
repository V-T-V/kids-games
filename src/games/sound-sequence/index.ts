/* 声音记忆 Sound Sequence —— 4 个不同颜色/音高的铃铛，先按顺序响一遍，
   孩子按相同顺序点铃铛。独特点：听觉 + 顺序双重记忆。
   视觉：彩色铃铛，响时摇摆发光。难度 = 序列长度。通关 = 敲对目标轮数。
   用 Web Audio API 合成音调（参考 rhythm/index.ts 的 tone 实现）。
   本游戏无 canvas（c2d 不适用）。 */

import { BaseGame } from "../../core/engine.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";
import { starsByAccuracy } from "../../core/scoring.ts";

/** 4 个铃铛：颜色 + 音高（C 大调五声音阶，悦耳）。 */
const BELLS = [
  { color: "#ff6b9d", freq: 523.25 }, // C5
  { color: "#4d96ff", freq: 587.33 }, // D5
  { color: "#6bcf7f", freq: 659.25 }, // E5
  { color: "#ffd93d", freq: 783.99 }, // G5
] as const;

export class SoundSequenceGame extends BaseGame {
  constructor() {
    super("sound-sequence");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private seq: number[] = [];
  private step = 0;
  private bells: HTMLButtonElement[] = [];
  private playing = false;
  private audioCtx: AudioContext | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    // 关闭复用的 AudioContext，释放音频资源
    if (this.audioCtx) {
      try {
        void this.audioCtx.close();
      } catch {
        /* ignore */
      }
      this.audioCtx = null;
    }
    // pending timer 由基类 destroy→trackTimeout 机制统一清理
  }

  private len(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.step = 0;
    this.seq = Array.from({ length: this.len() }, () =>
      randInt(0, BELLS.length - 1),
    );

    const wrap = document.createElement("div");
    wrap.className = "ssq-wrap";
    const task = document.createElement("div");
    task.className = "ssq-task";
    task.id = "ssq-task";
    task.textContent = "听铃铛响，记住顺序…";
    wrap.appendChild(task);

    // 进度点：显示当前敲到第几个
    const dots = document.createElement("div");
    dots.className = "ssq-dots";
    dots.id = "ssq-dots";
    for (let i = 0; i < this.seq.length; i++) {
      const d = document.createElement("span");
      d.className = "ssq-dot";
      d.dataset.idx = String(i);
      dots.appendChild(d);
    }
    wrap.appendChild(dots);

    const kit = document.createElement("div");
    kit.className = "ssq-kit";
    this.bells = [];
    for (let i = 0; i < BELLS.length; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ssq-bell";
      b.style.setProperty("--bell", BELLS[i]!.color);
      b.innerHTML = `<span class="ssq-bell__cap"></span><span class="ssq-bell__body">🔔</span>`;
      b.addEventListener("click", () => this.hit(i));
      kit.appendChild(b);
      this.bells.push(b);
    }
    wrap.appendChild(kit);

    // 再听一遍
    const replay = document.createElement("button");
    replay.type = "button";
    replay.className = "ssq-replay";
    replay.textContent = "🔁 再听一遍";
    replay.addEventListener("click", () => {
      if (this.playing) return;
      this.step = 0;
      this.refreshDots();
      const t = this.root.querySelector("#ssq-task");
      if (t) t.textContent = "听铃铛响，记住顺序…";
      this.playSeq();
    });
    wrap.appendChild(replay);

    this.root.appendChild(wrap);

    this.playSeq();
  }

  private refreshDots(): void {
    const dots = this.root.querySelectorAll(".ssq-dot");
    dots.forEach((d, i) => {
      if (i < this.step) d.classList.add("ssq-dot--done");
      else d.classList.remove("ssq-dot--done");
    });
  }

  private playSeq(): void {
    this.playing = true;
    this.seq.forEach((b, i) => {
      this.trackTimeout(
        () => {
          this.ring(b);
          if (i === this.seq.length - 1) {
            this.trackTimeout(() => {
              this.playing = false;
              const t = this.root.querySelector("#ssq-task");
              if (t) t.textContent = "该你啦！按一样的顺序敲～";
            }, 500);
          }
        },
        i * 650 + 600,
      );
    });
  }

  private hit(i: number): void {
    if (this.playing) return;
    this.ring(i);
    if (this.step >= this.seq.length) return; // 守卫，防越界
    if (i === this.seq[this.step]) {
      this.step += 1;
      this.refreshDots();
      if (this.step >= this.seq.length) {
        this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
        this.resetWrongStreak();
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 900);
      }
    } else {
      this.step = 0;
      this.refreshDots();
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private ring(i: number): void {
    const b = this.bells[i]!;
    b.classList.add("ssq-bell--ring");
    this.trackTimeout(() => b.classList.remove("ssq-bell--ring"), 280);
    this.tone(BELLS[i]!.freq);
  }

  /** 复用单一 AudioContext，避免每次敲击新建（浏览器有数量上限）。 */
  private tone(freq: number): void {
    // 静音判断：尊重家长设置（复用 audio.ts 的 master，这里独立 ctx 仅为节奏控制）
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    if (!this.audioCtx) this.audioCtx = new AC();
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    // 钟铃感：快速衰减
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "没听清没关系，再听一遍吧～",
      primary: {
        text: "再听一遍",
        icon: "🔁",
        onClick: () => {
          ov.destroy();
          this.step = 0;
          this.refreshDots();
          const t = this.root.querySelector("#ssq-task");
          if (t) t.textContent = "听铃铛响，记住顺序…";
          this.playSeq();
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
    if (document.getElementById("ssq-style")) return;
    const st = document.createElement("style");
    st.id = "ssq-style";
    st.textContent = SS_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function SS_CSS(theme: string): string {
  return `
.ssq-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(440px,100%);}
.ssq-task{font-size:1.2rem;font-weight:800;text-align:center;}
.ssq-dots{display:flex;gap:8px;}
.ssq-dot{width:12px;height:12px;border-radius:50%;background:#d8d8e0;transition:background .2s ease,transform .2s ease;}
.ssq-dot--done{background:${theme};transform:scale(1.25);}
.ssq-kit{display:flex;gap:18px;}
.ssq-bell{position:relative;width:78px;height:96px;border:none;background:transparent;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;touch-action:none;}
.ssq-bell__cap{width:14px;height:14px;border-radius:50%;background:var(--bell);box-shadow:0 2px 4px rgba(0,0,0,.2);}
.ssq-bell__body{font-size:2.8rem;filter:drop-shadow(0 4px 4px rgba(0,0,0,.2));transform-origin:top center;transition:transform .15s ease;}
.ssq-bell:active .ssq-bell__body{transform:scale(.92);}
.ssq-bell--ring .ssq-bell__body{animation:ssq-swing .4s ease;}
.ssq-bell--ring .ssq-bell__cap{box-shadow:0 0 12px 4px var(--bell);}
@keyframes ssq-swing{0%{transform:rotate(0)}25%{transform:rotate(-18deg)}55%{transform:rotate(14deg)}80%{transform:rotate(-8deg)}100%{transform:rotate(0)}}
.ssq-replay{min-height:48px;padding:0 22px;border-radius:999px;background:#fff;font-weight:700;font-size:1rem;box-shadow:var(--shadow);}
.ssq-replay:active{transform:scale(.94);}
@media (max-width:380px){.ssq-kit{gap:10px;}.ssq-bell{width:64px;height:84px;}.ssq-bell__body{font-size:2.2rem;}}
`;
}

export function create(): SoundSequenceGame {
  return new SoundSequenceGame();
}
