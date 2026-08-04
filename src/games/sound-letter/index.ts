/* 字母发音 Sound-Letter —— 用语音合成读一个字母的发音（如 "b"），
   孩子从选项里选出对应的字母。
   独特点：训练"听音辨字"的语音意识，是识字/拼音的前置能力。
   巧思：用 SpeechSynthesis 朗读字母音素（"b"读作/bee/），有"再听一遍"按钮可重复听。
         选项为形近/音近字母，提高辨别难度。
   视觉：大喇叭按钮 + 音波动画 + 字母选项卡。难度=选项数。通关=答对目标轮数。
   前缀 sld-（sound-letter）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

/** 朗读字母发音（英语字母名）。 */
function speakLetter(letter: string): void {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(letter);
    u.lang = "en-US";
    u.rate = 0.7;
    u.pitch = 1.1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* 浏览器不支持则静默 */
  }
}

/** 字母池：选常用、形近/音近易混的字母对作为干扰。
    每个目标字母配 2-3 个干扰字母（音近或形近）。 */
const LETTERS: { target: string; distract: string[] }[] = [
  { target: "b", distract: ["d", "p", "e"] },
  { target: "d", distract: ["b", "p", "q"] },
  { target: "p", distract: ["b", "q", "d"] },
  { target: "q", distract: ["p", "g", "b"] },
  { target: "m", distract: ["n", "w", "l"] },
  { target: "n", distract: ["m", "h", "u"] },
  { target: "s", distract: ["z", "c", "x"] },
  { target: "c", distract: ["s", "k", "g"] },
  { target: "t", distract: ["f", "l", "i"] },
  { target: "h", distract: ["n", "m", "b"] },
  { target: "g", distract: ["j", "q", "c"] },
  { target: "e", distract: ["i", "b", "l"] },
];

export class SoundLetterGame extends BaseGame {
  constructor() {
    super("sound-letter");
  }
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* 取消未完成的朗读，避免切关后还在念 */
    try {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const item = sample(LETTERS);
    const n = Math.min(this.optCount(), item.distract.length + 1);
    const distract = shuffle(item.distract).slice(0, n - 1);
    const options = shuffle([item.target, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "sld-wrap";

    const task = document.createElement("div");
    task.className = "sld-task";
    task.innerHTML = `听字母的<b>发音</b>，选出你听到的字母<br><span class="sld-hint">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const player = document.createElement("div");
    player.className = "sld-player";
    player.innerHTML = `<div class="sld-wave"><span></span><span></span><span></span><span></span><span></span></div>`;
    const playBtn = createButton({
      text: "听发音",
      icon: "🔊",
      variant: "primary",
      onClick: () => {
        speakLetter(item.target);
        this.animateWave();
      },
    });
    player.appendChild(playBtn);

    const replayBtn = createButton({
      text: "再听一遍",
      icon: "🔁",
      variant: "secondary",
      onClick: () => {
        speakLetter(item.target);
        this.animateWave();
      },
    });
    player.appendChild(replayBtn);
    wrap.appendChild(player);

    const opts = document.createElement("div");
    opts.className = "sld-opts";
    options.forEach((letter) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sld-opt";
      b.textContent = letter.toUpperCase();
      b.addEventListener("click", () => this.choose(letter, item.target, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);

    // 自动播放一次发音
    this.trackTimeout(() => {
      speakLetter(item.target);
      this.animateWave();
    }, 400);
  }

  private animateWave(): void {
    const wave = this.root.querySelector(".sld-wave");
    if (wave) {
      wave.classList.remove("sld-wave--active");
      void (wave as HTMLElement).offsetWidth;
      wave.classList.add("sld-wave--active");
    }
  }

  private choose(letter: string, target: string, btn: HTMLButtonElement): void {
    if (btn.classList.contains("sld-opt--lock")) return;
    if (letter === target) {
      btn.classList.add("sld-opt--right");
      this.lockAll();
      sfxPop();
      // 再朗读一次正确字母，强化记忆
      speakLetter(target);
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1200);
    } else {
      btn.classList.add("sld-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("sld-opt--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private lockAll(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>(".sld-opt")
      .forEach((b) => b.classList.add("sld-opt--lock"));
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "点喇叭再听一遍字母的发音～",
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
    if (document.getElementById("sld-style")) return;
    const st = document.createElement("style");
    st.id = "sld-style";
    st.textContent = SLD_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function SLD_CSS(theme: string): string {
  return `
.sld-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.sld-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.sld-hint{font-size:.8rem;color:var(--ink-soft,#888);font-weight:600;}
.sld-player{display:flex;flex-direction:column;align-items:center;gap:12px;background:linear-gradient(135deg,#fff,${theme}22);border-radius:24px;padding:20px 28px;box-shadow:var(--shadow);}
.sld-wave{display:flex;align-items:center;gap:5px;height:46px;}
.sld-wave span{display:inline-block;width:8px;height:12px;background:${theme};border-radius:4px;}
.sld-wave--active span{animation:sld-bounce .9s ease-in-out infinite;}
.sld-wave--active span:nth-child(2){animation-delay:.12s;}
.sld-wave--active span:nth-child(3){animation-delay:.24s;}
.sld-wave--active span:nth-child(4){animation-delay:.36s;}
.sld-wave--active span:nth-child(5){animation-delay:.48s;}
@keyframes sld-bounce{0%,100%{height:10px;}50%{height:42px;}}
.sld-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:12px;width:min(460px,100%);}
.sld-opt{font-size:2.4rem;font-weight:900;color:var(--ink,#333);background:#fff;border:3px solid #e6e6ee;border-radius:18px;padding:16px 8px;cursor:pointer;transition:transform .12s,background .2s,border-color .2s;box-shadow:var(--shadow);font-family:"Comic Sans MS","Segoe UI",sans-serif;}
.sld-opt:active{transform:scale(.93);}
.sld-opt--right{background:#d4f4dd;border-color:#6bcf7f;animation:sld-pop .35s ease;}
.sld-opt--wrong{background:#ffe0db;border-color:#ff6348;color:#c0392b;animation:sld-shake .4s ease;}
.sld-opt--lock{pointer-events:none;}
@keyframes sld-pop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes sld-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.sld-opt{font-size:2rem;padding:12px 6px;}}
`;
}

export function create(): SoundLetterGame {
  return new SoundLetterGame();
}
