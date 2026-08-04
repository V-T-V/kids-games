/* 回声洞 Echo Cave —— 3-4 个洞穴入口，播放一段合成音（不同方向用不同音调），
   孩子判断声音是从哪个洞传来并点击对应洞口。
   独特点：纯听觉辨别方向感，左/右/前/后用不同音高 + 立体声 panning。
   视觉：洞穴入口 + 声波扩散动画。难度=洞穴数。通关=答对目标轮数。
   巧思：用 Web Audio 的 StereoPannerNode 给每个洞分配声像位置。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

/** 每个洞穴的方向属性：音高、声像、视觉方位标签 */
interface Cave {
  /** 方向 emoji：左← 右→ 前↑ 后↓ */
  dir: string;
  /** 主频率 Hz（左低右高，前后中间） */
  freq: number;
  /** 立体声声像 -1（左）~ 1（右） */
  pan: number;
  /** 第二泛音，制造回声层次 */
  overtone: number;
}

const CAVE_BANK: Cave[] = [
  { dir: "⬅️", freq: 294, pan: -0.85, overtone: 440 }, // 左：低 D4
  { dir: "➡️", freq: 587, pan: 0.85, overtone: 880 }, // 右：高 D5
  { dir: "⬆️", freq: 392, pan: 0, overtone: 587 }, // 前：中 G4
  { dir: "⬇️", freq: 220, pan: -0.3, overtone: 330 }, // 后：更低 A3
];

export class EchoCaveGame extends BaseGame {
  constructor() {
    super("echo-cave");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 当前关的洞穴列表（按渲染顺序） */
  private caves: Cave[] = [];
  /** 当前播放的"正确"洞穴在 caves 里的索引 */
  private answerIdx = 0;
  private locked = false;
  private audioCtx: AudioContext | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* trackTimeout 自动清理；AudioContext 由浏览器 GC */
    if (this.audioCtx) {
      try {
        void this.audioCtx.close();
      } catch {
        /* ignore */
      }
      this.audioCtx = null;
    }
  }

  private caveCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 4;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    /* 选 caveCount 个不同方向，随机排列渲染顺序 */
    const n = Math.min(this.caveCount(), CAVE_BANK.length);
    this.caves = shuffle(CAVE_BANK).slice(0, n);
    this.answerIdx = randInt(0, n - 1);

    const wrap = document.createElement("div");
    wrap.className = "ecv-wrap";

    const task = document.createElement("div");
    task.className = "ecv-task";
    task.innerHTML = `仔细听声音，<b>点那个传出声音的洞口</b><br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const replayBtn = document.createElement("button");
    replayBtn.type = "button";
    replayBtn.className = "ecv-replay";
    replayBtn.textContent = "🔊 再听一次";
    replayBtn.addEventListener("click", () => this.playEcho(this.answerIdx));
    wrap.appendChild(replayBtn);

    const stage = document.createElement("div");
    stage.className = "ecv-stage";
    this.caves.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ecv-cave";
      btn.setAttribute("aria-label", `洞口 ${i + 1}`);
      btn.innerHTML = `<span class="ecv-cave__arch"></span><span class="ecv-cave__dir">${c.dir}</span><span class="ecv-wave"></span>`;
      btn.addEventListener("click", (e) => this.guess(i, e));
      stage.appendChild(btn);
    });
    wrap.appendChild(stage);

    this.root.appendChild(wrap);

    /* 自动播放一次 */
    this.trackTimeout(() => this.playEcho(this.answerIdx), 450);
  }

  /** 用 Web Audio 合成"回声"：主音 + 泛音 + 立体声 panning + 回声衰减 */
  private playEcho(idx: number): void {
    const c = this.caves[idx];
    if (!c) return;
    const ac = this.getAudio();
    if (!ac) return;
    const now = ac.currentTime;

    /* 主音 + 三段回声，逐段衰减、延时 */
    const seq = [
      { t: 0, freq: c.freq, peak: 0.32 },
      { t: 0.16, freq: c.overtone, peak: 0.22 },
      { t: 0.34, freq: c.freq, peak: 0.16 },
    ];
    for (const s of seq) {
      const t0 = now + s.t;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const pan = ac.createStereoPanner();
      osc.type = "sine";
      osc.frequency.setValueAtTime(s.freq, t0);
      /* 略微下滑模拟回声衰减 */
      osc.frequency.exponentialRampToValueAtTime(s.freq * 0.95, t0 + 0.25);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(s.peak, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      pan.pan.setValueAtTime(c.pan, t0);
      osc.connect(g);
      g.connect(pan);
      pan.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.35);
    }

    /* 视觉：给被听到的洞口加波纹动画 */
    const caves = this.root.querySelectorAll(".ecv-cave");
    caves.forEach((el) => el.classList.remove("ecv-cave--echo"));
    const target = caves[idx];
    if (target) {
      target.classList.add("ecv-cave--echo");
      this.trackTimeout(() => target.classList.remove("ecv-cave--echo"), 900);
    }
  }

  private getAudio(): AudioContext | null {
    if (this.audioCtx) {
      if (this.audioCtx.state === "suspended") void this.audioCtx.resume();
      return this.audioCtx;
    }
    try {
      const AC: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      this.audioCtx = new AC();
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  private guess(idx: number, e: MouseEvent): void {
    if (this.locked) return;
    this.locked = true;
    const caves = this.root.querySelectorAll(".ecv-cave");
    if (idx === this.answerIdx) {
      caves[idx]?.classList.add("ecv-cave--right");
      sfxPop();
      this.onCorrect(e.clientX, e.clientY);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 850);
    } else {
      caves[idx]?.classList.add("ecv-cave--wrong");
      caves[this.answerIdx]?.classList.add("ecv-cave--right");
      this.onWrong();
      /* 重放一次帮孩子校准 */
      this.trackTimeout(() => this.playEcho(this.answerIdx), 500);
      this.trackTimeout(() => this.startRound(), 1700);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("ecv-style")) return;
    const st = document.createElement("style");
    st.id = "ecv-style";
    st.textContent = ECV_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function ECV_CSS(theme: string): string {
  return `
.ecv-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.ecv-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.ecv-replay{font-size:1rem;font-weight:700;padding:10px 22px;border:none;border-radius:999px;background:${theme};color:#fff;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s ease;}
.ecv-replay:active{transform:scale(.94);}
.ecv-stage{display:flex;flex-wrap:wrap;justify-content:center;gap:16px;padding:24px;background:linear-gradient(180deg,#3a2a5a,#1d1430);border-radius:24px;box-shadow:var(--shadow);}
.ecv-cave{position:relative;width:120px;height:140px;border:none;cursor:pointer;background:transparent;padding:0;}
.ecv-cave__arch{position:absolute;left:0;right:0;bottom:0;height:120px;border-radius:60px 60px 0 0;background:radial-gradient(ellipse at 50% 100%,#0a0612,#241640 70%);box-shadow:inset 0 -10px 30px rgba(0,0,0,.6),0 6px 14px rgba(0,0,0,.4);transition:filter .2s ease,transform .2s ease;}
.ecv-cave__dir{position:absolute;top:6px;left:50%;transform:translateX(-50%);font-size:1.6rem;z-index:2;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));}
.ecv-wave{position:absolute;top:70px;left:50%;width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,.4);transform:translate(-50%,-50%) scale(0);opacity:0;pointer-events:none;}
.ecv-cave--echo .ecv-wave{animation:ecv-wave .9s ease-out;}
@keyframes ecv-wave{0%{transform:translate(-50%,-50%) scale(.4);opacity:.9;}100%{transform:translate(-50%,-50%) scale(4);opacity:0;}}
.ecv-cave--echo .ecv-cave__arch{filter:brightness(1.4);}
.ecv-cave--right .ecv-cave__arch{filter:brightness(1.3) drop-shadow(0 0 12px #6bcf7f);}
.ecv-cave--wrong .ecv-cave__arch{filter:brightness(.7) drop-shadow(0 0 12px #ff6348);}
@media (max-width:380px){.ecv-cave{width:100px;height:120px;}.ecv-cave__arch{height:100px;}}
`;
}

export function create(): EchoCaveGame {
  return new EchoCaveGame();
}
