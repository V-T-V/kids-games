/* 谁的声音 Animal Sound —— 听声音猜动物。
   巧思：用 Web Audio 合成不同音高/波形近似动物叫声，配波形动画。
   选项为动物 emoji，答对动物"叫一声"庆祝。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Animal {
  emoji: string;
  name: string;
  sound: "bird" | "cow" | "cat" | "dog" | "bee" | "frog";
}
const ANIMALS: Animal[] = [
  { emoji: "🐦", name: "小鸟", sound: "bird" },
  { emoji: "🐮", name: "牛", sound: "cow" },
  { emoji: "🐱", name: "小猫", sound: "cat" },
  { emoji: "🐶", name: "小狗", sound: "dog" },
  { emoji: "🐝", name: "蜜蜂", sound: "bee" },
  { emoji: "🐸", name: "青蛙", sound: "frog" },
];

export class AnimalSoundGame extends BaseGame {
  constructor() {
    super("animal-sound");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const picked = shuffle(ANIMALS).slice(0, n);
    const target = sample(picked);

    const wrap = document.createElement("div");
    wrap.className = "as-wrap";
    const task = document.createElement("div");
    task.className = "as-task";
    task.textContent = `仔细听，是谁在叫？（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 喇叭按钮 + 波形
    const player = document.createElement("div");
    player.className = "as-player";
    player.innerHTML = `<div class="as-wave"><span></span><span></span><span></span><span></span><span></span></div>`;
    const playBtn = createButton({
      text: "听声音",
      icon: "🔊",
      variant: "primary",
      onClick: () => {
        this.playSound(target.sound);
        this.animateWave();
      },
    });
    player.appendChild(playBtn);
    wrap.appendChild(player);

    const opts = document.createElement("div");
    opts.className = "as-opts";
    picked.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "as-choice";
      b.innerHTML = `<div class="as-choice__emoji">${a.emoji}</div><div class="as-choice__name">${a.name}</div>`;
      b.addEventListener("click", () => this.choose(a, target, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);

    // 自动播放一次
    this.trackTimeout(() => {
      this.playSound(target.sound);
      this.animateWave();
    }, 400);
  }

  private choose(a: Animal, target: Animal, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (a.sound === target.sound) {
      this.answered = true;
      sfxPop();
      btn.classList.add("as-choice--done");
      this.playSound(target.sound);
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1300);
    } else {
      btn.classList.add("as-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("as-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private animateWave(): void {
    const wave = this.root.querySelector(".as-wave");
    if (wave) {
      wave.classList.remove("as-wave--active");
      void (wave as HTMLElement).offsetWidth;
      wave.classList.add("as-wave--active");
    }
  }

  /** 合成近似动物叫声。 */
  private playSound(kind: Animal["sound"]): void {
    // 复用 audio 模块的合成能力：直接构造简易音色
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(ctx.destination);

    const presets: Record<
      Animal["sound"],
      { freq: number[]; type: OscillatorType; dur: number }
    > = {
      bird: { freq: [1200, 1600, 1200, 1800], type: "sine", dur: 0.12 },
      cow: { freq: [180, 150, 180], type: "sawtooth", dur: 0.3 },
      cat: { freq: [600, 700, 600], type: "triangle", dur: 0.25 },
      dog: { freq: [300, 260, 300], type: "square", dur: 0.18 },
      bee: {
        freq: [200, 200, 200, 200, 200, 200],
        type: "sawtooth",
        dur: 0.08,
      },
      frog: { freq: [220, 180, 220], type: "sine", dur: 0.2 },
    };
    const p = presets[kind];
    let t = now;
    p.freq.forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.value = f;
      osc.connect(g);
      osc.start(t);
      osc.stop(t + p.dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.dur);
      t += p.dur;
    });
    this.trackTimeout(() => ctx.close(), (t - now) * 1000 + 200);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再点喇叭听一遍～",
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
    if (document.getElementById("as-style")) return;
    const st = document.createElement("style");
    st.id = "as-style";
    st.textContent = AS_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function AS_CSS(theme: string): string {
  return `
.as-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(460px,100%);}
.as-task{font-size:1.2rem;font-weight:800;text-align:center;}
.as-player{display:flex;flex-direction:column;align-items:center;gap:14px;}
.as-wave{display:flex;gap:4px;align-items:center;height:40px;}
.as-wave span{width:8px;height:12px;background:${theme};border-radius:4px;}
.as-wave--active span{animation:as-bounce .5s ease infinite;}
.as-wave--active span:nth-child(2){animation-delay:.1s}.as-wave--active span:nth-child(3){animation-delay:.2s}
.as-wave--active span:nth-child(4){animation-delay:.3s}.as-wave--active span:nth-child(5){animation-delay:.4s}
@keyframes as-bounce{0%,100%{height:12px}50%{height:36px}}
.as-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.as-choice{width:92px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;}
.as-choice:active{transform:scale(.93);}
.as-choice__emoji{font-size:2.6rem;}
.as-choice__name{font-size:.9rem;font-weight:700;}
.as-choice--done{background:#d4f4dd;animation:as-pop .4s ease;}
.as-choice--wrong{animation:as-shake .4s ease;}
@keyframes as-pop{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes as-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): AnimalSoundGame {
  return new AnimalSoundGame();
}
