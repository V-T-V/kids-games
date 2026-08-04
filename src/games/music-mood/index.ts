/* 音乐情绪 Music Mood —— 听一段音乐，判断是欢快（大调）还是悲伤（小调）。
   艺术启蒙：调性情感联想。独特点：用 Web Audio 合成两段同节奏但不同调性的旋律
   （大调全用自然音阶明亮音、小调用降半音的暗淡音），让孩子听辨情绪。
   前缀 mmd-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

// 频率表（C4 起点）
const F: Record<string, number> = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  Eb4: 311.13, // 小三度
  Bb4: 466.16, // 小七
  Ab4: 415.3,
};

// 大调旋律（全自然音，明亮上行）= 欢快
const MAJOR: string[] = ["C4", "E4", "G4", "C5", "G4", "E4", "C4"];
// 小调旋律（含降音，下行收尾）= 悲伤
const MINOR: string[] = ["C4", "Eb4", "G4", "C5", "Bb4", "Ab4", "G4"];

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

function playMelody(notes: string[], happy: boolean): void {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime;
  notes.forEach((n, i) => {
    const freq = F[n];
    if (!freq) return;
    const start = t0 + i * 0.3;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = happy ? "triangle" : "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.32, start + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
    o.connect(g);
    g.connect(c.destination);
    o.start(start);
    o.stop(start + 0.36);
  });
}

const MOODS = [
  {
    id: "happy",
    emoji: "😄",
    text: "欢快",
    play: () => playMelody(MAJOR, true),
  },
  {
    id: "sad",
    emoji: "😢",
    text: "悲伤",
    play: () => playMelody(MINOR, false),
  },
];

export class MusicMoodGame extends BaseGame {
  constructor() {
    super("music-mood");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private target: (typeof MOODS)[number] | null = null;

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
    this.target = sample(MOODS);
    const choices = shuffle([...MOODS]);

    const wrap = document.createElement("div");
    wrap.className = "mmd-wrap";

    const task = document.createElement("div");
    task.className = "mmd-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 听这段音乐，感觉<b>怎么样</b>？`;
    wrap.appendChild(task);

    const play = document.createElement("button");
    play.type = "button";
    play.className = "mmd-play";
    play.innerHTML = `🎵 点这里<b>听音乐</b>`;
    play.addEventListener("click", () => {
      if (this.target) this.target.play();
      sfxPop();
    });
    wrap.appendChild(play);

    const opts = document.createElement("div");
    opts.className = "mmd-opts";
    choices.forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mmd-opt";
      b.innerHTML = `<div class="mmd-opt__emoji">${m.emoji}</div><div class="mmd-opt__text">${m.text}</div>`;
      b.addEventListener("click", () => this.choose(m, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
    this.trackTimeout(() => this.target?.play(), 350);
  }

  private choose(m: (typeof MOODS)[number], btn: HTMLButtonElement): void {
    if (this.locked || !this.target) return;
    if (m.id === this.target.id) {
      this.locked = true;
      sfxPop();
      btn.classList.add("mmd-opt--done");
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
      btn.classList.add("mmd-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("mmd-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "再听一次～",
      emoji: "🎶",
      variant: "rest",
      body: "听起来亮亮的、想跳舞的是欢快；听起来低低的、想哭的是悲伤～",
      primary: { text: "继续", icon: "🎵", onClick: () => ov.destroy() },
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
    if (document.getElementById("mmd-style")) return;
    const st = document.createElement("style");
    st.id = "mmd-style";
    st.textContent = MMD_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function MMD_CSS(theme: string): string {
  return `
.mmd-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(460px,100%);}
.mmd-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.mmd-task b{color:${theme};}
.mmd-play{padding:18px 36px;font-size:1.3rem;font-weight:900;color:#fff;background:linear-gradient(135deg,${theme},#8b5cf6);border-radius:999px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;animation:mmd-pulse 1.6s ease-in-out infinite;}
.mmd-play:active{transform:scale(.94);}
.mmd-play b{color:#fff;}
@keyframes mmd-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.mmd-opts{display:flex;gap:22px;}
.mmd-opt{display:flex;flex-direction:column;align-items:center;gap:6px;background:#fff;border-radius:22px;box-shadow:var(--shadow);padding:22px 30px;cursor:pointer;transition:transform .12s;}
.mmd-opt:active{transform:scale(.95);}
.mmd-opt__emoji{font-size:3.4rem;}
.mmd-opt__text{font-size:1.2rem;font-weight:900;color:#555;}
.mmd-opt--done{background:#d4f4dd;animation:mmd-pop .4s ease;}
.mmd-opt--wrong{background:#ffe0e0;animation:mmd-shake .4s ease;}
@keyframes mmd-pop{0%{transform:scale(.7)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes mmd-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): MusicMoodGame {
  return new MusicMoodGame();
}
