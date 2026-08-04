/* 节奏拍打 Rhythm-Tap —— 听一段鼓点节奏，模仿拍出来（小脑·节奏与协调）。
   独特点：单一鼓面 + 节拍序列模仿（区别于 rhythm 的"4 鼓多音色序列"、
           music-stairs 的"音高旋律"，这里专注拍数和间隔，训练听觉节奏感+手眼协调）。
   巧思：用 sfxPop 模拟鼓声，拍鼓时鼓面震动+音符飞出；
         难度=节拍数(2-4) + 速度(间隔)；答对整段才算对。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

export class RhythmTapGame extends BaseGame {
  constructor() {
    super("rhythm-tap");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  /** 节拍序列：每拍之间的间隔（毫秒），长度=拍数。第一拍是基准时刻。 */
  private beats: number[] = [];
  private step = 0;
  private playing = false;
  private drum: HTMLButtonElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空，定时器由基类清理 */
  }

  /** 拍数：easy 2-3，medium 3，hard 4。 */
  private beatCount(): number {
    if (this.difficulty === "easy") return randInt(2, 3);
    if (this.difficulty === "medium") return 3;
    return 4;
  }

  /** 拍间距：easy 较慢，hard 较快。 */
  private interval(): number {
    if (this.difficulty === "easy") return 700;
    if (this.difficulty === "medium") return 550;
    return 430;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.step = 0;
    const n = this.beatCount();
    const gap = this.interval();
    this.beats = Array.from({ length: n }, () => gap);

    const wrap = document.createElement("div");
    wrap.className = "rtp-wrap";

    const task = document.createElement("div");
    task.className = "rtp-task";
    task.id = "rtp-task";
    task.textContent = "听一听鼓点…";
    wrap.appendChild(task);

    const dots = document.createElement("div");
    dots.className = "rtp-dots";
    dots.id = "rtp-dots";
    for (let i = 0; i < n; i++) {
      const d = document.createElement("div");
      d.className = "rtp-dot";
      d.dataset.idx = String(i);
      dots.appendChild(d);
    }
    wrap.appendChild(dots);

    const drum = document.createElement("button");
    drum.type = "button";
    drum.className = "rtp-drum";
    drum.innerHTML = `<span class="rtp-drum__face">🥁</span>`;
    drum.addEventListener("click", () => this.tap());
    wrap.appendChild(drum);
    this.drum = drum;

    const replay = document.createElement("button");
    replay.type = "button";
    replay.className = "rtp-replay";
    replay.textContent = "🔁 再听一遍";
    replay.addEventListener("click", () => {
      if (this.playing) return;
      this.step = 0;
      this.resetDots();
      const t = this.root.querySelector("#rtp-task");
      if (t) t.textContent = "听一听鼓点…";
      this.playSeq();
    });
    wrap.appendChild(replay);

    this.root.appendChild(wrap);

    // 鼓默认禁用，播放完才可点
    drum.disabled = true;
    this.playSeq();
  }

  private resetDots(): void {
    this.root.querySelectorAll(".rtp-dot").forEach((d) => {
      d.classList.remove("rtp-dot--hit", "rtp-dot--done");
    });
  }

  private markDot(idx: number, done: boolean): void {
    const dots = this.root.querySelectorAll<HTMLElement>(".rtp-dot");
    const dot = dots[idx];
    if (!dot) return;
    dot.classList.add("rtp-dot--hit");
    if (done) dot.classList.add("rtp-dot--done");
    this.trackTimeout(() => dot.classList.remove("rtp-dot--hit"), 250);
  }

  private playSeq(): void {
    this.playing = true;
    let elapsed = 600;
    this.beats.forEach((_, i) => {
      this.trackTimeout(() => {
        this.shake();
        sfxPop();
        this.markDot(i, false);
        if (i === this.beats.length - 1) {
          this.trackTimeout(() => {
            this.playing = false;
            const t = this.root.querySelector("#rtp-task");
            if (t) t.textContent = "该你啦！拍出一样的～";
            if (this.drum) this.drum.disabled = false;
          }, 500);
        }
      }, elapsed);
      elapsed += this.beats[i]!;
    });
  }

  /** 拍鼓：震动 + 音符飞出 + 音效。 */
  private tap(): void {
    if (this.playing) return;
    this.shake();
    this.flyNote();
    sfxPop();
    if (this.step >= this.beats.length) return;
    this.markDot(this.step, true);
    this.step += 1;
    if (this.step >= this.beats.length) {
      // 整段拍完，判定为答对
      if (this.drum) this.drum.disabled = true;
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 900);
    }
  }

  private shake(): void {
    if (!this.drum) return;
    this.drum.classList.add("rtp-drum--shake");
    this.trackTimeout(() => this.drum?.classList.remove("rtp-drum--shake"), 180);
  }

  /** 飞出音符粒子（纯 DOM，unmount 时随 root 清空）。 */
  private flyNote(): void {
    if (!this.drum) return;
    const note = document.createElement("span");
    note.className = "rtp-note";
    note.textContent = "🎵";
    const r = this.drum.getBoundingClientRect();
    note.style.left = `${r.left + r.width / 2}px`;
    note.style.top = `${r.top + r.height / 3}px`;
    document.body.appendChild(note);
    this.trackTimeout(() => note.remove(), 800);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "没听清没关系，再听一遍～",
      primary: {
        text: "再听一遍",
        icon: "🔁",
        onClick: () => {
          ov.destroy();
          this.step = 0;
          this.resetDots();
          const t = this.root.querySelector("#rtp-task");
          if (t) t.textContent = "听一听鼓点…";
          if (this.drum) this.drum.disabled = true;
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
    if (document.getElementById("rtp-style")) return;
    const st = document.createElement("style");
    st.id = "rtp-style";
    st.textContent = RTP_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function RTP_CSS(theme: string): string {
  return `
.rtp-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(440px,100%);}
.rtp-task{font-size:1.2rem;font-weight:800;}
.rtp-dots{display:flex;gap:12px;}
.rtp-dot{width:18px;height:18px;border-radius:50%;background:#d8d8e0;transition:background .15s,transform .15s;}
.rtp-dot--hit{background:${theme};transform:scale(1.4);}
.rtp-dot--done{background:#6bcf7f;}
.rtp-drum{width:160px;height:160px;border-radius:50%;border:none;background:radial-gradient(circle at 35% 30%,#ff8a80,#ff5252);box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .12s ease;touch-action:manipulation;}
.rtp-drum:active{transform:scale(.92);}
.rtp-drum:disabled{opacity:.6;cursor:default;}
.rtp-drum--shake{animation:rtp-shake .18s ease;}
.rtp-drum__face{font-size:4rem;line-height:1;}
@keyframes rtp-shake{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.rtp-replay{min-height:48px;padding:0 22px;border-radius:999px;background:#fff;font-weight:700;font-size:1rem;box-shadow:var(--shadow);}
.rtp-replay:active{transform:scale(.94);}
.rtp-note{position:fixed;font-size:1.8rem;pointer-events:none;transform:translate(-50%,-50%);animation:rtp-fly .8s ease-out forwards;z-index:9999;}
@keyframes rtp-fly{0%{opacity:1;transform:translate(-50%,-50%) scale(1);}100%{opacity:0;transform:translate(-50%,-150%) scale(1.4);}}
`;
}

export function create(): RhythmTapGame {
  return new RhythmTapGame();
}
