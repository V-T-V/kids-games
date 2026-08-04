/* 音乐快慢 Music Speed —— 听两段旋律，判断哪段更快。
   独特点：用 Web Audio 程序合成旋律，纯听觉分辨速度，区别于节奏记忆类。
   巧思：两段音符相同，仅 note 间隔不同；难度=速度差异度。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

const MELODIES: number[][] = [
  [523.25, 587.33, 659.25, 783.99],
  [392.0, 440.0, 523.25, 659.25],
  [659.25, 587.33, 523.25, 440.0],
  [440.0, 523.25, 659.25, 880.0],
];

export class MusicSpeedGame extends BaseGame {
  constructor() {
    super("music-speed");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private audioCtx: AudioContext | null = null;
  private locked = false;
  private fasterFirst = false;

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

  /** 难度=速度差异：easy 差异大（好分辨），hard 差异小。 */
  private gap(): number {
    return this.difficulty === "easy"
      ? randInt(280, 380)
      : this.difficulty === "medium"
        ? randInt(170, 240)
        : randInt(110, 150);
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const melody = sample(MELODIES);
    const fastStep = randInt(120, 160);
    const slowStep = fastStep + this.gap();
    this.fasterFirst = Math.random() < 0.5;

    const wrap = document.createElement("div");
    wrap.className = "msp-wrap";

    const task = document.createElement("div");
    task.className = "msp-task";
    task.textContent = "听两段音乐，哪一段更快？";
    wrap.appendChild(task);

    const buttons = document.createElement("div");
    buttons.className = "msp-buttons";

    const bA = this.makePlayButton("🎵 第一段", () =>
      this.play(melody, this.fasterFirst ? fastStep : slowStep),
    );
    const bB = this.makePlayButton("🎶 第二段", () =>
      this.play(melody, this.fasterFirst ? slowStep : fastStep),
    );
    buttons.appendChild(bA);
    buttons.appendChild(bB);
    wrap.appendChild(buttons);

    const choose = document.createElement("div");
    choose.className = "msp-choose";
    const cA = document.createElement("button");
    cA.type = "button";
    cA.className = "msp-pick";
    cA.textContent = "第一段更快";
    cA.addEventListener("click", () => this.answer(true, cA, choose));
    const cB = document.createElement("button");
    cB.type = "button";
    cB.className = "msp-pick";
    cB.textContent = "第二段更快";
    cB.addEventListener("click", () => this.answer(false, cB, choose));
    choose.appendChild(cA);
    choose.appendChild(cB);
    wrap.appendChild(choose);

    this.root.appendChild(wrap);
    // 进入即自动播放第一段，便于孩子直接对比
    this.trackTimeout(() => bA.click(), 300);
  }

  private makePlayButton(label: string, onPlay: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "msp-play";
    b.textContent = label;
    b.addEventListener("click", onPlay);
    return b;
  }

  private play(freqs: number[], step: number): void {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    if (!this.audioCtx) this.audioCtx = new AC();
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    freqs.forEach((f, i) => {
      const t0 = ctx.currentTime + i * (step / 1000);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (step / 1000) * 0.9);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + step / 1000);
    });
  }

  private answer(
    pickFirst: boolean,
    btn: HTMLButtonElement,
    chooseEl: HTMLElement,
  ): void {
    if (this.locked) return;
    const correct = pickFirst === this.fasterFirst;
    const r = btn.getBoundingClientRect();
    if (correct) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      chooseEl.querySelectorAll(".msp-pick").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      btn.classList.add("msp-pick--right");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 800);
    } else {
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再仔细听一听两段的快慢～",
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
    if (document.getElementById("msp-style")) return;
    const st = document.createElement("style");
    st.id = "msp-style";
    st.textContent = MSP_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function MSP_CSS(theme: string): string {
  return `
.msp-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(440px,100%);}
.msp-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.msp-buttons{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.msp-play{min-height:56px;padding:0 26px;border-radius:18px;background:linear-gradient(135deg,${theme},#a55eea);color:#fff;font-weight:800;font-size:1.05rem;box-shadow:var(--shadow);}
.msp-play:active{transform:scale(.94);}
.msp-choose{display:flex;gap:14px;}
.msp-pick{min-width:120px;min-height:64px;border-radius:18px;background:#fff;font-weight:800;font-size:1.05rem;box-shadow:var(--shadow);}
.msp-pick:active{transform:scale(.94);}
.msp-pick--right{background:#d4f4dd;outline:4px solid #34c759;}
`;
}

export function create(): MusicSpeedGame {
  return new MusicSpeedGame();
}
