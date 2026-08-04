/* 水母光 Jellyfish Glow —— 几只水母按顺序发光（一只接一只闪），孩子记住
   顺序后按相同顺序点击。独特点：发光序列记忆 + 水母脉动发光动画 + 音高。
   视觉：水母 emoji + 发光环 + 海底背景。难度=序列长度/水母数。
   通关=复现对目标轮数。前缀 jfg-。本游戏无 canvas（c2d 不适用）。 */

import { BaseGame } from "../../core/engine.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";
import { starsByAccuracy } from "../../core/scoring.ts";

/** 5 只水母：颜色 + 音高（C 大调五声音阶）。 */
const JELLIES = [
  { color: "#ff6b9d", freq: 523.25 }, // C5
  { color: "#4d96ff", freq: 587.33 }, // D5
  { color: "#6bcf7f", freq: 659.25 }, // E5
  { color: "#ffd93d", freq: 783.99 }, // G5
  { color: "#a55eea", freq: 880.0 }, // A5
] as const;

export class JellyfishGlowGame extends BaseGame {
  constructor() {
    super("jellyfish-glow");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private jellyCount = 4;
  private seq: number[] = [];
  private step = 0;
  private jellies: HTMLButtonElement[] = [];
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
    // pending timer 由基类统一清理
  }

  /** 水母数量：easy 3，medium 4，hard 5 */
  private jellyCountForDifficulty(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }
  /** 序列长度 */
  private seqLen(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.step = 0;
    this.jellyCount = this.jellyCountForDifficulty();
    // 序列里每个位置随机指向当前关可用的一只水母（可重复，难度递增）
    this.seq = Array.from({ length: this.seqLen() }, () =>
      randInt(0, this.jellyCount - 1),
    );

    const wrap = document.createElement("div");
    wrap.className = "jfg-wrap";
    const task = document.createElement("div");
    task.className = "jfg-task";
    task.id = "jfg-task";
    task.textContent = "看水母发光，记住顺序…";
    wrap.appendChild(task);

    // 进度点
    const dots = document.createElement("div");
    dots.className = "jfg-dots";
    dots.id = "jfg-dots";
    for (let i = 0; i < this.seq.length; i++) {
      const d = document.createElement("span");
      d.className = "jfg-dot";
      dots.appendChild(d);
    }
    wrap.appendChild(dots);

    const kit = document.createElement("div");
    kit.className = "jfg-kit";
    this.jellies = [];
    for (let i = 0; i < this.jellyCount; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "jfg-jelly";
      b.style.setProperty("--jcolor", JELLIES[i]!.color);
      b.innerHTML = `<span class="jfg-jelly__glow"></span><span class="jfg-jelly__body">🪼</span>`;
      b.addEventListener("click", () => this.hit(i));
      kit.appendChild(b);
      this.jellies.push(b);
    }
    wrap.appendChild(kit);

    // 再看一遍
    const replay = document.createElement("button");
    replay.type = "button";
    replay.className = "jfg-replay";
    replay.textContent = "🔁 再看一遍";
    replay.addEventListener("click", () => {
      if (this.playing) return;
      this.step = 0;
      this.refreshDots();
      const t = this.root.querySelector("#jfg-task");
      if (t) t.textContent = "看水母发光，记住顺序…";
      this.playSeq();
    });
    wrap.appendChild(replay);

    this.root.appendChild(wrap);
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.playSeq();
  }

  private refreshDots(): void {
    const dots = this.root.querySelectorAll(".jfg-dot");
    dots.forEach((d, i) => {
      if (i < this.step) d.classList.add("jfg-dot--done");
      else d.classList.remove("jfg-dot--done");
    });
  }

  private playSeq(): void {
    this.playing = true;
    this.seq.forEach((ji, i) => {
      this.trackTimeout(
        () => {
          this.glow(ji);
          if (i === this.seq.length - 1) {
            this.trackTimeout(() => {
              this.playing = false;
              const t = this.root.querySelector("#jfg-task");
              if (t) t.textContent = "该你啦！按一样的顺序点水母～";
            }, 500);
          }
        },
        i * 700 + 600,
      );
    });
  }

  private hit(i: number): void {
    if (this.playing) return;
    this.glow(i);
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

  private glow(i: number): void {
    const b = this.jellies[i]!;
    b.classList.add("jfg-jelly--glow");
    this.trackTimeout(() => b.classList.remove("jfg-jelly--glow"), 420);
    this.tone(JELLIES[i]!.freq);
  }

  /** 复用单一 AudioContext，避免每次新建（浏览器有数量上限）。 */
  private tone(freq: number): void {
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
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "没看清没关系，再看一遍吧～",
      primary: {
        text: "再看一遍",
        icon: "🔁",
        onClick: () => {
          ov.destroy();
          this.step = 0;
          this.refreshDots();
          const t = this.root.querySelector("#jfg-task");
          if (t) t.textContent = "看水母发光，记住顺序…";
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
    if (document.getElementById("jfg-style")) return;
    const st = document.createElement("style");
    st.id = "jfg-style";
    st.textContent = JFG_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function JFG_CSS(theme: string): string {
  return `
.jfg-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(480px,100%);background:linear-gradient(180deg,#3a6fb0,#1a2f5a);border-radius:24px;padding:24px 16px;box-shadow:var(--shadow-lg);}
.jfg-task{font-size:1.15rem;font-weight:800;text-align:center;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.4);}
.jfg-dots{display:flex;gap:8px;}
.jfg-dot{width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.3);transition:background .2s ease,transform .2s ease;}
.jfg-dot--done{background:${theme};transform:scale(1.25);box-shadow:0 0 8px ${theme};}
.jfg-kit{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.jfg-jelly{position:relative;width:82px;height:100px;border:none;background:transparent;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;touch-action:none;}
.jfg-jelly__glow{position:absolute;inset:-10px;border-radius:50%;background:radial-gradient(circle,var(--jcolor) 0%,transparent 65%);opacity:0;transition:opacity .15s ease;}
.jfg-jelly__body{position:relative;font-size:3rem;filter:drop-shadow(0 4px 4px rgba(0,0,0,.3));transform-origin:top center;transition:transform .2s ease;animation:jfg-float 3s ease-in-out infinite;}
.jfg-jelly:hover .jfg-jelly__body,.jfg-jelly:active .jfg-jelly__body{transform:scale(1.12);}
.jfg-jelly--glow .jfg-jelly__glow{opacity:.9;animation:jfg-pulse .42s ease;}
.jfg-jelly--glow .jfg-jelly__body{transform:scale(1.25);filter:drop-shadow(0 0 12px var(--jcolor)) drop-shadow(0 4px 4px rgba(0,0,0,.3));}
.jfg-replay{min-height:48px;padding:0 22px;border-radius:999px;background:#fff;font-weight:700;font-size:1rem;box-shadow:var(--shadow);}
.jfg-replay:active{transform:scale(.94);}
@keyframes jfg-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes jfg-pulse{0%{transform:scale(.9)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
@media (max-width:380px){.jfg-kit{gap:10px;}.jfg-jelly{width:64px;height:84px;}.jfg-jelly__body{font-size:2.3rem;}}
`;
}

export function create(): JellyfishGlowGame {
  return new JellyfishGlowGame();
}
