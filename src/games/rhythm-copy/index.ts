/* 节奏模仿扩展 Rhythm Copy —— 4 个鼓，先播放更长的序列，孩子照敲复现。
   独特点：比 rhythm 更长的序列（5-7 击）+ 4 音色鼓面，纯听觉记忆挑战。
   巧思：前缀 rco-（区别于 rhythm 的 rh-），可"再听一遍"。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

const DRUM_FREQS = [180, 240, 320, 400];

export class RhythmCopyGame extends BaseGame {
  constructor() {
    super("rhythm-copy");
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
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    if (this.audioCtx) {
      try {
        void this.audioCtx.close();
      } catch {
        /* ignore */
      }
      this.audioCtx = null;
    }
  }

  /** 扩展版：序列更长。 */
  private len(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 6
        : 7;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.step = 0;
    this.seq = Array.from({ length: this.len() }, () => randInt(0, 3));

    const wrap = document.createElement("div");
    wrap.className = "rco-wrap";
    const task = document.createElement("div");
    task.className = "rco-task";
    task.id = "rco-task";
    task.textContent = "听这一长串鼓点，记住顺序…";
    wrap.appendChild(task);

    const kit = document.createElement("div");
    kit.className = "rco-kit";
    this.drums = [];
    for (let i = 0; i < 4; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `rco-drum rco-drum--${i}`;
      b.addEventListener("click", () => this.hit(i));
      kit.appendChild(b);
      this.drums.push(b);
    }
    wrap.appendChild(kit);

    const replay = document.createElement("button");
    replay.type = "button";
    replay.className = "rco-replay";
    replay.textContent = "🔁 再听一遍";
    replay.addEventListener("click", () => {
      if (this.playing) return;
      const t = this.root.querySelector("#rco-task");
      if (t) t.textContent = "听这一长串鼓点，记住顺序…";
      this.playSeq();
    });
    wrap.appendChild(replay);
    this.root.appendChild(wrap);

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
              const t = this.root.querySelector("#rco-task");
              if (t) t.textContent = "该你啦！照着敲～";
            }, 500);
          }
        },
        i * 480 + 500,
      );
    });
  }

  private hit(i: number): void {
    if (this.playing) return;
    this.flash(i);
    this.tone(i);
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
    d.classList.add("rco-drum--hit");
    this.trackTimeout(() => d.classList.remove("rco-drum--hit"), 200);
  }

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
      body: "序列有点长，再听一遍吧～",
      primary: {
        text: "再听一遍",
        icon: "🔁",
        onClick: () => {
          ov.destroy();
          this.step = 0;
          const t = this.root.querySelector("#rco-task");
          if (t) t.textContent = "听这一长串鼓点，记住顺序…";
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
    if (document.getElementById("rco-style")) return;
    const st = document.createElement("style");
    st.id = "rco-style";
    st.textContent = RCO_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function RCO_CSS(theme: string): string {
  return `
.rco-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(440px,100%);}
.rco-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.rco-replay{min-height:48px;padding:0 22px;border-radius:999px;background:#fff;font-weight:700;font-size:1rem;box-shadow:var(--shadow);}
.rco-replay:active{transform:scale(.94);}
.rco-kit{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
.rco-drum{width:110px;height:110px;border-radius:50%;border:none;box-shadow:var(--shadow);transition:transform .1s;}
.rco-drum--0{background:radial-gradient(circle at 35% 30%,#ff8a80,#ff5252);}
.rco-drum--1{background:radial-gradient(circle at 35% 30%,#ffd180,#ffab40);}
.rco-drum--2{background:radial-gradient(circle at 35% 30%,#80d8ff,#40c4ff);}
.rco-drum--3{background:radial-gradient(circle at 35% 30%,#b9f6ca,#69f0ae);}
.rco-drum:active{transform:scale(.92);}
.rco-drum--hit{transform:scale(1.1);filter:brightness(1.3);box-shadow:0 0 0 8px ${theme}55;}
`;
}

export function create(): RhythmCopyGame {
  return new RhythmCopyGame();
}
