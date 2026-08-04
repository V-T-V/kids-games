/* 乐器辨听 Instrument —— 听一段声音，选出对应的乐器（钢琴/鼓/吉他/小提琴）。
   艺术启蒙：音色识别。独特点：用 Web Audio 合成不同乐器的近似音色
   （钢琴=谐波三角、鼓=低频噪声衰减、吉他=拨弦衰减、小提琴=持续锯齿），
   不依赖音频文件。前缀 ins-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Instrument {
  id: string;
  emoji: string;
  name: string;
  /** 播放合成音色 */
  play: () => void;
}

let sharedCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (sharedCtx) return sharedCtx;
  try {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    sharedCtx = new AC();
    return sharedCtx;
  } catch {
    return null;
  }
}

function playPiano(): void {
  const c = ctx();
  if (!c) return;
  // 三角谐波：基频+倍频，快速衰减
  const freqs = [261.63, 392.0, 523.25];
  freqs.forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.3 / (i + 1), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + 0.75);
  });
}

function playDrum(): void {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime;
  // 低频正弦快速下滑模拟鼓
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(160, t0);
  o.frequency.exponentialRampToValueAtTime(50, t0 + 0.18);
  g.gain.setValueAtTime(0.6, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + 0.3);
  // 加点噪声"啪"
  const buf = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const ng = c.createGain();
  ng.gain.value = 0.35;
  src.connect(ng);
  ng.connect(c.destination);
  src.start(t0);
}

function playGuitar(): void {
  const c = ctx();
  if (!c) return;
  // 拨弦：锯齿快速起、慢衰减
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.value = 196.0; // G3
  const t0 = c.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + 0.95);
}

function playViolin(): void {
  const c = ctx();
  if (!c) return;
  // 持续拉奏：锯齿 + 颤音
  const o = c.createOscillator();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.value = 440.0; // A4
  lfo.type = "sine";
  lfo.frequency.value = 6;
  lfoGain.gain.value = 6;
  lfo.connect(lfoGain);
  lfoGain.connect(o.frequency);
  const t0 = c.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.12);
  g.gain.setValueAtTime(0.25, t0 + 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  lfo.start(t0);
  o.stop(t0 + 0.95);
  lfo.stop(t0 + 0.95);
}

const INSTRUMENTS: Instrument[] = [
  { id: "piano", emoji: "🎹", name: "钢琴", play: playPiano },
  { id: "drum", emoji: "🥁", name: "鼓", play: playDrum },
  { id: "guitar", emoji: "🎸", name: "吉他", play: playGuitar },
  { id: "violin", emoji: "🎻", name: "小提琴", play: playViolin },
];

export class InstrumentGame extends BaseGame {
  constructor() {
    super("instrument");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private target: Instrument | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    if (sharedCtx) {
      try {
        void sharedCtx.close();
      } catch {
        /* ignore */
      }
      sharedCtx = null;
    }
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.target = sample(INSTRUMENTS);
    const choices = shuffle([...INSTRUMENTS]);

    const wrap = document.createElement("div");
    wrap.className = "ins-wrap";

    const task = document.createElement("div");
    task.className = "ins-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 听声音，这是<b>哪种乐器</b>？`;
    wrap.appendChild(task);

    const play = document.createElement("button");
    play.type = "button";
    play.className = "ins-play";
    play.innerHTML = `🔊 点这里<b>听声音</b>`;
    play.addEventListener("click", () => {
      if (this.target) this.target.play();
      sfxPop();
    });
    wrap.appendChild(play);

    const opts = document.createElement("div");
    opts.className = "ins-opts";
    choices.forEach((it) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ins-opt";
      b.innerHTML = `<div class="ins-opt__emoji">${it.emoji}</div><div class="ins-opt__name">${it.name}</div>`;
      b.addEventListener("click", () => this.choose(it, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
    // 自动播放一次
    this.trackTimeout(() => this.target?.play(), 350);
  }

  private choose(it: Instrument, btn: HTMLButtonElement): void {
    if (this.locked || !this.target) return;
    if (it.id === this.target.id) {
      this.locked = true;
      sfxPop();
      btn.classList.add("ins-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("ins-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ins-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "再听一次～",
      emoji: "🎧",
      variant: "rest",
      body: "每种乐器的声音都不一样，仔细听声音再点重复播放多听几遍～",
      primary: { text: "继续", icon: "🔊", onClick: () => ov.destroy() },
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
    if (document.getElementById("ins-style")) return;
    const st = document.createElement("style");
    st.id = "ins-style";
    st.textContent = INS_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function INS_CSS(theme: string): string {
  return `
.ins-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(460px,100%);}
.ins-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.ins-task b{color:${theme};}
.ins-play{padding:18px 36px;font-size:1.3rem;font-weight:900;color:#fff;background:linear-gradient(135deg,${theme},#d8a37a);border-radius:999px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;animation:ins-pulse 1.6s ease-in-out infinite;}
.ins-play:active{transform:scale(.94);}
.ins-play b{color:#fff;}
@keyframes ins-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.ins-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;width:100%;max-width:380px;}
.ins-opt{display:flex;flex-direction:column;align-items:center;gap:6px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:18px 14px;cursor:pointer;transition:transform .12s;}
.ins-opt:active{transform:scale(.95);}
.ins-opt__emoji{font-size:3rem;}
.ins-opt__name{font-size:1.1rem;font-weight:900;color:#555;}
.ins-opt--done{background:#d4f4dd;animation:ins-pop .4s ease;}
.ins-opt--wrong{background:#ffe0e0;animation:ins-shake .4s ease;}
@keyframes ins-pop{0%{transform:scale(.7)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes ins-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): InstrumentGame {
  return new InstrumentGame();
}
