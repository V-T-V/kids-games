/* 鼓点花样 Drum Pattern —— 4 个鼓，先播放一段鼓点序列，孩子照着敲出来。
   独特点：听觉记忆 + 复现（序列较短，3-6 岁友好）。
   巧思：每个鼓不同音色与颜色；播放时鼓面高亮；复现时按顺序匹配，错则温柔重来；
   可"再听一遍"；难度=序列长度。前缀 drp2-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

const DRUM_FREQS = [180, 250, 340, 440]; // 4 个鼓的音高
const DRUM_COLORS = ["#ff6b9d", "#ffd93d", "#6bcf7f", "#4d96ff"];

export class DrumPatternGame extends BaseGame {
  constructor() {
    super("drum-pattern");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private seq: number[] = [];
  private step = 0;
  private drums: HTMLButtonElement[] = [];
  private playing = false;
  private audioCtx: AudioContext | null = null;
  private rafId: number | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    // RAF 游戏必须取消动画帧
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.audioCtx) {
      try {
        void this.audioCtx.close();
      } catch {
        /* ignore */
      }
      this.audioCtx = null;
    }
  }

  private len(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.step = 0;
    this.seq = Array.from({ length: this.len() }, () => randInt(0, 3));

    const wrap = document.createElement("div");
    wrap.className = "drp2-wrap";

    const task = document.createElement("div");
    task.className = "drp2-task";
    task.innerHTML = `听这段鼓点，记住顺序，再敲一遍！<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "drp2-hint";
    hint.id = "drp2-hint";
    hint.textContent = "仔细听…";
    wrap.appendChild(hint);

    // 进度灯
    const lamps = document.createElement("div");
    lamps.className = "drp2-lamps";
    lamps.id = "drp2-lamps";
    for (let i = 0; i < this.seq.length; i++) {
      const d = document.createElement("div");
      d.className = "drp2-lamp";
      lamps.appendChild(d);
    }
    wrap.appendChild(lamps);

    const kit = document.createElement("div");
    kit.className = "drp2-kit";
    this.drums = [];
    for (let i = 0; i < 4; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "drp2-drum";
      b.style.setProperty("--dc", DRUM_COLORS[i]!);
      b.addEventListener("click", () => this.hit(i));
      kit.appendChild(b);
      this.drums.push(b);
    }
    wrap.appendChild(kit);

    const replay = document.createElement("button");
    replay.type = "button";
    replay.className = "drp2-replay";
    replay.textContent = "🔁 再听一遍";
    replay.addEventListener("click", () => {
      if (!this.playing) this.playSeq();
    });
    wrap.appendChild(replay);

    this.root.appendChild(wrap);

    // 用 RAF 驱动提示心跳（确保 unmount 取消）
    const beat = () => {
      this.rafId = requestAnimationFrame(beat);
    };
    this.rafId = requestAnimationFrame(beat);

    this.playSeq();
  }

  private playSeq(): void {
    this.playing = true;
    this.step = 0;
    const hint = this.root.querySelector("#drp2-hint");
    if (hint) hint.textContent = "仔细听…";
    // 重置进度灯
    this.root.querySelectorAll(".drp2-lamp").forEach((el) => {
      (el as HTMLElement).classList.remove("drp2-lamp--on");
    });
    this.seq.forEach((d, i) => {
      this.trackTimeout(
        () => {
          this.flash(d);
          this.tone(d);
          if (i === this.seq.length - 1) {
            this.trackTimeout(() => {
              this.playing = false;
              const h = this.root.querySelector("#drp2-hint");
              if (h) h.textContent = "该你啦！照着敲～";
            }, 450);
          }
        },
        i * 460 + 500,
      );
    });
  }

  private hit(i: number): void {
    if (this.playing) return;
    this.flash(i);
    this.tone(i);
    if (this.step >= this.seq.length) return;
    if (i === this.seq[this.step]) {
      // 点对：点亮下一盏灯
      const lamps = this.root.querySelectorAll(".drp2-lamp");
      const lamp = lamps[this.step] as HTMLElement | undefined;
      if (lamp) lamp.classList.add("drp2-lamp--on");
      this.step += 1;
      if (this.step >= this.seq.length) {
        this.resetWrongStreak();
        const rect = this.drums[i]!.getBoundingClientRect();
        this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 900);
      }
    } else {
      // 点错：温柔重来
      this.step = 0;
      const paused = this.onWrong();
      this.root.querySelectorAll(".drp2-lamp").forEach((el) => {
        (el as HTMLElement).classList.remove("drp2-lamp--on");
      });
      const hint = this.root.querySelector("#drp2-hint");
      if (hint) hint.textContent = "顺序错啦，从头再敲～";
      if (paused) this.showRest();
    }
  }

  private flash(i: number): void {
    const d = this.drums[i]!;
    d.classList.add("drp2-drum--hit");
    this.trackTimeout(() => d.classList.remove("drp2-drum--hit"), 200);
  }

  private tone(i: number): void {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    if (!this.audioCtx) this.audioCtx = new AC();
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(DRUM_FREQS[i]!, t0);
    osc.frequency.exponentialRampToValueAtTime(DRUM_FREQS[i]! * 0.5, t0 + 0.18);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.26);
  }

  private showRest(): void {
    /* 休息护盾：简单遮罩提示，1.5s 后自动消失 */
    const mask = document.createElement("div");
    mask.className = "drp2-rest";
    mask.textContent = "歇一歇再继续～ 😌";
    document.body.appendChild(mask);
    this.trackTimeout(() => mask.remove(), 1500, true);
  }

  private injectStyle(): void {
    if (document.getElementById("drp2-style")) return;
    const st = document.createElement("style");
    st.id = "drp2-style";
    st.textContent = DRP2_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function DRP2_CSS(theme: string): string {
  return `
.drp2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.drp2-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.drp2-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.drp2-hint{font-size:1rem;font-weight:800;color:${theme};background:rgba(255,255,255,.7);padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.drp2-lamps{display:flex;gap:8px;}
.drp2-lamp{width:16px;height:16px;border-radius:50%;background:#e0e0e0;box-shadow:inset 0 -2px 3px rgba(0,0,0,.1);transition:background .2s ease,transform .2s ease;}
.drp2-lamp--on{background:#6bcf7f;transform:scale(1.2);box-shadow:0 0 8px #6bcf7f;}
.drp2-kit{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;padding:18px;background:linear-gradient(#6a5a4a,#4a3e34);border-radius:22px;box-shadow:var(--shadow);}
@media (min-width:480px){.drp2-kit{grid-template-columns:repeat(4,1fr);}}
.drp2-drum{width:96px;height:96px;border:none;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff6,var(--dc,#eee));box-shadow:inset 0 -6px 10px rgba(0,0,0,.25),inset 0 4px 6px rgba(255,255,255,.3);cursor:pointer;transition:transform .08s ease;}
.drp2-drum:active{transform:scale(.93);}
.drp2-drum--hit{transform:scale(.88);filter:brightness(1.3);box-shadow:inset 0 -2px 6px rgba(0,0,0,.25),0 0 20px var(--dc);}
@media (max-width:380px){.drp2-drum{width:78px;height:78px;}}
.drp2-replay{margin-top:4px;padding:10px 22px;border:none;border-radius:999px;background:rgba(255,255,255,.85);color:var(--ink);font-size:.95rem;font-weight:800;cursor:pointer;box-shadow:var(--shadow);}
.drp2-replay:active{transform:scale(.94);}
.drp2-rest{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9998;background:linear-gradient(135deg,#4d96ff,#6bcf7f);color:#fff;font-size:1.4rem;font-weight:900;padding:18px 36px;border-radius:20px;box-shadow:0 8px 24px rgba(0,0,0,.3);}
`;
}

export function create(): DrumPatternGame {
  return new DrumPatternGame();
}
