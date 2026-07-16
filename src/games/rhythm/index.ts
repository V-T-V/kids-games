/* 节奏模仿 Rhythm —— 听一段鼓点，然后按相同顺序敲出来。
   独特点：听觉节奏记忆+重复（鼓点，区别于 feed-order 视觉序列、music-stairs 音高旋律）。
   巧思：4 个鼓面（不同音色），先播放序列，孩子照敲；难度=序列长度。 */

import { BaseGame } from "../../core/engine.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";
import { starsByAccuracy } from "../../core/scoring.ts";

const DRUM_FREQS = [180, 240, 320, 400];

export class RhythmGame extends BaseGame {
  constructor() {
    super("rhythm");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private seq: number[] = [];
  private step = 0;
  private drums: HTMLButtonElement[] = [];
  private playing = false;
  private audioCtx: AudioContext | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
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
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 5;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.step = 0;
    this.seq = Array.from({ length: this.len() }, () => randInt(0, 3));

    const wrap = document.createElement("div");
    wrap.className = "rh-wrap";
    const task = document.createElement("div");
    task.className = "rh-task";
    task.id = "rh-task";
    task.textContent = "听鼓点，记住顺序…";
    wrap.appendChild(task);

    const kit = document.createElement("div");
    kit.className = "rh-kit";
    this.drums = [];
    for (let i = 0; i < 4; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `rh-drum rh-drum--${i}`;
      b.addEventListener("click", () => this.hit(i));
      kit.appendChild(b);
      this.drums.push(b);
    }
    wrap.appendChild(kit);
    this.root.appendChild(wrap);

    // 播放序列
    this.playSeq();
  }

  private playSeq(): void {
    this.playing = true;
    this.seq.forEach((d, i) => {
      this.trackTimeout(
        () => {
          this.flash(d);
          this.tone(d);
          if (i === this.seq.length - 1) {
            this.trackTimeout(() => {
              this.playing = false;
              const t = this.root.querySelector("#rh-task");
              if (t) t.textContent = "该你啦！照着敲～";
            }, 500);
          }
        },
        i * 600 + 600,
      );
    });
  }

  private hit(i: number): void {
    if (this.playing) return;
    this.flash(i);
    this.tone(i);
    // 守卫：已完成本回合则忽略后续点击，避免 step 越界
    if (this.step >= this.seq.length) return;
    if (i === this.seq[this.step]) {
      this.step += 1;
      if (this.step >= this.seq.length) {
        this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
        this.resetWrongStreak();
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 900);
      }
    } else {
      this.step = 0;
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private flash(i: number): void {
    const d = this.drums[i]!;
    d.classList.add("rh-drum--hit");
    this.trackTimeout(() => d.classList.remove("rh-drum--hit"), 200);
  }

  /** 复用单一 AudioContext，避免每次敲击新建（浏览器有数量上限）。 */
  private tone(i: number): void {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    if (!this.audioCtx) this.audioCtx = new AC();
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = DRUM_FREQS[i]!;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再听一遍鼓点～",
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
    if (document.getElementById("rh-style")) return;
    const st = document.createElement("style");
    st.id = "rh-style";
    st.textContent = RH_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function RH_CSS(theme: string): string {
  return `
.rh-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(440px,100%);}
.rh-task{font-size:1.2rem;font-weight:800;}
.rh-kit{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
.rh-drum{width:110px;height:110px;border-radius:50%;border:none;box-shadow:var(--shadow);transition:transform .1s;}
.rh-drum--0{background:radial-gradient(circle at 35% 30%,#ff8a80,#ff5252);}
.rh-drum--1{background:radial-gradient(circle at 35% 30%,#ffd180,#ffab40);}
.rh-drum--2{background:radial-gradient(circle at 35% 30%,#80d8ff,#40c4ff);}
.rh-drum--3{background:radial-gradient(circle at 35% 30%,#b9f6ca,#69f0ae);}
.rh-drum:active{transform:scale(.92);}
.rh-drum--hit{transform:scale(1.1);filter:brightness(1.3);box-shadow:0 0 0 8px ${theme}55;}
`;
}

export function create(): RhythmGame {
  return new RhythmGame();
}
