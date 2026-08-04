/* 声音花园 Sound Garden —— 花园里每朵花点击后发出不同音高（Web Audio playNote）。
   孩子自由"弹花"创造旋律。每轮给一个简单的目标旋律（如 do-re-mi 3 个音），
   孩子按顺序点对应的花完成。与 music-stairs 不同的是强调"自由探索+创造"
   而非固定旋律——可随时点任意花听音，再尝试弹目标旋律。
   独特点：自由弹奏探索 + 目标旋律挑战结合，花朵绽放 + 音符飘出动画。 */

import { BaseGame } from "../../core/engine.ts";
import { playNote, sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

/** 花朵对应的音符（C 大调五声音阶，听起来永远悦耳）。 */
interface Bloom {
  note: string;
  emoji: string;
  color: string;
}

const BLOOMS: Bloom[] = [
  { note: "C4", emoji: "🌹", color: "#ff6b9d" },
  { note: "D4", emoji: "🌼", color: "#ffd93d" },
  { note: "E4", emoji: "🌷", color: "#ff9f43" },
  { note: "G4", emoji: "🌸", color: "#a55eea" },
  { note: "A4", emoji: "🌻", color: "#ff6348" },
  { note: "C5", emoji: "🌺", color: "#4d96ff" },
];

/** 目标旋律库（全在花朵音符范围内）。 */
const MELODIES: { notes: string[]; name: string }[] = [
  { notes: ["C4", "D4", "E4"], name: "do-re-mi" },
  { notes: ["E4", "D4", "C4"], name: "mi-re-do" },
  { notes: ["C4", "E4", "G4"], name: "do-mi-sol" },
  { notes: ["G4", "E4", "C4"], name: "sol-mi-do" },
  { notes: ["C4", "D4", "E4", "C4"], name: "do-re-mi-do" },
  { notes: ["E4", "G4", "A4", "G4"], name: "mi-sol-la-sol" },
  { notes: ["C4", "E4", "G4", "C5"], name: "do-mi-sol-do" },
  { notes: ["A4", "G4", "E4", "D4", "C4"], name: "la-sol-mi-re-do" },
];

export class SoundGardenGame extends BaseGame {
  constructor() {
    super("sound-garden");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 本轮目标旋律。 */
  private targetMelody: string[] = [];
  /** 孩子正在弹的序列。 */
  private playing: string[] = [];
  private busy = false;
  /** 花朵元素映射（note -> button）。 */
  private flowers: Map<string, HTMLButtonElement> = new Map();
  /** 本轮旋律展示元素。 */
  private melodyEls: HTMLElement[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 + trackTimeout 自动清理 */
  }

  private pickMelody(): { notes: string[]; name: string } {
    if (this.difficulty === "easy") {
      return sample(MELODIES.filter((m) => m.notes.length <= 3));
    }
    if (this.difficulty === "medium") {
      return sample(MELODIES.filter((m) => m.notes.length <= 4));
    }
    return sample(MELODIES);
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = false;
    this.playing = [];
    this.flowers = new Map();
    this.reportProgress(this.roundsDone, this.roundTotal);

    const mel = this.pickMelody();
    this.targetMelody = mel.notes;

    const wrap = document.createElement("div");
    wrap.className = "sgn-wrap";

    const task = document.createElement("div");
    task.className = "sgn-task";
    task.innerHTML = `按顺序弹花朵，弹出 <b>${mel.name}</b><br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    /* 目标旋律展示 + 试听 */
    const melodyBar = document.createElement("div");
    melodyBar.className = "sgn-melody";
    melodyBar.id = "sgn-melody";
    this.melodyEls = [];
    for (const n of this.targetMelody) {
      const dot = document.createElement("span");
      dot.className = "sgn-melody__dot";
      const b = BLOOMS.find((x) => x.note === n);
      dot.style.background = b?.color ?? "#ccc";
      dot.textContent = b?.emoji ?? "🎵";
      melodyBar.appendChild(dot);
      this.melodyEls.push(dot);
    }
    wrap.appendChild(melodyBar);

    const listenBtn = document.createElement("button");
    listenBtn.type = "button";
    listenBtn.className = "sgn-listen";
    listenBtn.textContent = "🔊 听一听";
    listenBtn.addEventListener("click", () => this.playTarget());
    wrap.appendChild(listenBtn);

    /* 花园 */
    const garden = document.createElement("div");
    garden.className = "sgn-garden";
    garden.id = "sgn-garden";
    /* 花朵顺序打乱，增加探索感 */
    const arranged = shuffle(BLOOMS);
    for (const b of arranged) {
      const f = document.createElement("button");
      f.type = "button";
      f.className = "sgn-flower";
      f.setAttribute("aria-label", `花朵 ${b.note}`);
      f.style.setProperty("--sgn-c", b.color);
      f.style.setProperty("--sgn-dur", `${randInt(3, 5)}s`);
      f.style.setProperty("--sgn-delay", `${randInt(0, 30) / 10}s`);
      f.innerHTML = `<span class="sgn-flower__petal"></span><span class="sgn-flower__petal"></span><span class="sgn-flower__petal"></span><span class="sgn-flower__emoji">${b.emoji}</span><span class="sgn-flower__stem"></span>`;
      f.addEventListener("pointerdown", () => this.pluck(b, f));
      this.flowers.set(b.note, f);
      garden.appendChild(f);
    }
    wrap.appendChild(garden);

    /* 重置按钮 */
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "sgn-reset";
    reset.textContent = "🔄 重新弹";
    reset.addEventListener("click", () => this.resetPlaying());
    wrap.appendChild(reset);

    this.root.appendChild(wrap);

    /* 自动播放一次目标旋律作为示范 */
    this.trackTimeout(() => this.playTarget(true), 600);
  }

  private pluck(b: Bloom, f: HTMLButtonElement): void {
    if (this.busy) return;
    /* 自由探索：点任意花都发声 + 绽放动画 */
    playNote(b.note, 0.4);
    sfxPop();
    f.classList.add("sgn-flower--bloom");
    this.trackTimeout(() => f.classList.remove("sgn-flower--bloom"), 600);

    /* 飘出音符 */
    const note = document.createElement("span");
    note.className = "sgn-note";
    note.textContent = ["♪", "♫", "♩"][randInt(0, 2)]!;
    note.style.color = b.color;
    const r = f.getBoundingClientRect();
    const gr = (this.root.querySelector("#sgn-garden") as HTMLElement).getBoundingClientRect();
    note.style.left = `${r.left - gr.left + r.width / 2}px`;
    note.style.top = `${r.top - gr.top}px`;
    (this.root.querySelector("#sgn-garden") as HTMLElement).appendChild(note);
    this.trackTimeout(() => note.remove(), 1500);

    /* 记入弹奏序列 */
    this.playing.push(b.note);
    const idx = this.playing.length - 1;
    /* 高亮旋律对应位置 */
    if (this.melodyEls[idx]) {
      this.melodyEls[idx]!.classList.add("sgn-melody__dot--hit");
    }
    /* 判断是否匹配 */
    const expected = this.targetMelody[idx];
    if (b.note !== expected) {
      /* 弹错了：序列重来（探索游戏，不扣分） */
      this.trackTimeout(() => this.resetPlaying(), 500);
      const f0 = this.flowers.get(b.note);
      f0?.classList.add("sgn-flower--miss");
      this.trackTimeout(() => f0?.classList.remove("sgn-flower--miss"), 500);
      /* 累计护盾计数（用 onWrong，但纯探索触发休息概率低） */
      const paused = this.onWrong();
      if (paused) {
        this.busy = true;
        this.trackTimeout(() => this.showRest(), 600);
      }
    } else if (this.playing.length >= this.targetMelody.length) {
      /* 全部弹对 */
      this.busy = true;
      const r2 = f.getBoundingClientRect();
      this.onCorrect(r2.left + r2.width / 2, r2.top + r2.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    }
  }

  private resetPlaying(): void {
    if (this.busy) return;
    this.playing = [];
    this.melodyEls.forEach((el) =>
      el.classList.remove("sgn-melody__dot--hit"),
    );
  }

  private playTarget(silent = false): void {
    if (this.busy && !silent) return;
    this.resetPlaying();
    this.targetMelody.forEach((n, i) => {
      this.trackTimeout(() => {
        playNote(n, 0.4);
        const f = this.flowers.get(n);
        f?.classList.add("sgn-flower--bloom");
        if (this.melodyEls[i]) {
          this.melodyEls[i]!.classList.add("sgn-melody__dot--demo");
        }
        this.trackTimeout(() => {
          f?.classList.remove("sgn-flower--bloom");
          this.melodyEls[i]?.classList.remove("sgn-melody__dot--demo");
        }, 400);
      }, i * 420);
    });
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先听听旋律，再慢慢弹～",
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
    if (document.getElementById("sgn-style")) return;
    const st = document.createElement("style");
    st.id = "sgn-style";
    st.textContent = SGN_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SGN_CSS(theme: string): string {
  return `
.sgn-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(560px,100%);}
.sgn-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.sgn-melody{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;background:#fff;padding:10px 18px;border-radius:16px;box-shadow:var(--shadow);min-height:48px;}
.sgn-melody__dot{width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;font-size:1.3rem;border-radius:50%;box-shadow:var(--shadow);opacity:.7;transition:all .3s;}
.sgn-melody__dot--hit{opacity:1;transform:scale(1.2);box-shadow:0 0 0 4px rgba(107,207,127,.4);}
.sgn-melody__dot--demo{opacity:1;transform:scale(1.3);animation:sgn-blink .4s ease;}
@keyframes sgn-blink{0%,100%{filter:brightness(1)}50%{filter:brightness(1.5)}}
.sgn-listen{padding:8px 18px;font-size:1rem;font-weight:700;border-radius:999px;border:3px solid ${theme};background:#fff;color:${theme};cursor:pointer;transition:transform .12s;}
.sgn-listen:hover{transform:translateY(-2px);}
.sgn-listen:active{transform:scale(.95);}
.sgn-garden{position:relative;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:10px;width:min(480px,100%);min-height:220px;padding:20px 14px;background:linear-gradient(180deg,#e8f5e9,#c8e6c9 60%,#a5d6a7);border-radius:24px;box-shadow:var(--shadow);}
.sgn-flower{position:relative;width:72px;height:96px;background:transparent;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:0;transition:transform .15s;}
.sgn-flower:hover{transform:translateY(-4px);}
.sgn-flower:active{transform:scale(.9);}
.sgn-flower__petal{position:absolute;width:32px;height:32px;border-radius:50% 50% 50% 0;background:var(--sgn-c);top:6px;left:50%;transform-origin:bottom right;opacity:.85;animation:sgn-sway var(--sgn-dur,4s) ease-in-out infinite;animation-delay:var(--sgn-delay,0s);}
.sgn-flower__petal:nth-child(1){transform:translateX(-100%) rotate(0deg);}
.sgn-flower__petal:nth-child(2){transform:translateX(0%) rotate(90deg);animation-delay:calc(var(--sgn-delay,0s) + .3s);}
.sgn-flower__petal:nth-child(3){transform:translateX(-50%) rotate(180deg);animation-delay:calc(var(--sgn-delay,0s) + .6s);}
@keyframes sgn-sway{0%,100%{rotate:-3deg}50%{rotate:3deg}}
.sgn-flower__emoji{position:relative;font-size:1.8rem;z-index:2;margin-top:6px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));}
.sgn-flower__stem{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:6px;height:30px;background:linear-gradient(180deg,#6bcf7f,#3a9d4a);border-radius:3px;}
.sgn-flower--bloom .sgn-flower__petal{animation:sgn-bloom .5s ease;}
.sgn-flower--bloom .sgn-flower__emoji{animation:sgn-pop .5s cubic-bezier(.3,1.6,.4,1);}
@keyframes sgn-bloom{0%{transform:scale(1)}50%{transform:scale(1.3)}100%{transform:scale(1)}}
@keyframes sgn-pop{0%{transform:scale(1)}50%{transform:scale(1.5)}100%{transform:scale(1)}}
.sgn-flower--miss{filter:grayscale(.5);animation:sgn-miss .4s ease;}
@keyframes sgn-miss{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.sgn-note{position:absolute;font-size:1.8rem;font-weight:900;pointer-events:none;animation:sgn-float 1.4s ease-out forwards;z-index:5;transform:translateX(-50%);}
@keyframes sgn-float{0%{transform:translate(-50%,0) scale(.6);opacity:0}20%{transform:translate(-50%,-10px) scale(1.2);opacity:1}100%{transform:translate(-50%,-80px) scale(1) rotate(20deg);opacity:0}}
.sgn-reset{margin-top:2px;padding:10px 22px;font-size:1rem;font-weight:700;border-radius:999px;border:none;background:${theme};color:#fff;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s;}
.sgn-reset:hover{transform:translateY(-2px);}
.sgn-reset:active{transform:scale(.95);}
@media (max-width:380px){.sgn-flower{width:60px;height:84px;}.sgn-flower__petal{width:26px;height:26px;}.sgn-melody__dot{width:32px;height:32px;font-size:1.1rem;}}
`;
}

export function create(): SoundGardenGame {
  return new SoundGardenGame();
}
