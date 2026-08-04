/* 摩斯密码 Morse Code —— 播放一段长短声（滴=短 ·=短促音；嗒=长 —=长音），
   代表一个字母。孩子从选项里选出对应字母。
   独特点：听觉编码——把长短节奏转成符号。
   巧思：用国际摩斯码映射（简化为 A–H 等短码），Web Audio 合成"滴嗒"声；
         先播放再答题，提供"重听"按钮。难度=码长（点划数）。
   视觉：声波图标 + 播放动画 + 字母选项。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** 字母 → 摩斯码（. = 滴/短，- = 嗒/长）。选取短码便于幼儿。 */
const MORSE: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  K: "-.-",
  M: "--",
  N: "-.",
  O: "---",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
};

/** 难度对应的字母池（按码长从小到大）。 */
function poolFor(diff: "easy" | "medium" | "hard"): string[] {
  if (diff === "easy") return ["E", "T", "I", "A", "N", "M"]; // 1-2 码
  if (diff === "medium")
    return ["E", "T", "I", "A", "N", "M", "S", "O", "D", "U"]; // 1-3 码
  return ["E", "T", "I", "A", "N", "M", "S", "O", "D", "U", "K", "C", "V", "W"]; // 含 4 码
}

export class MorseCodeGame extends BaseGame {
  constructor() {
    super("morse-code");
  }

  private answer = "E";
  private code = ".";
  private choices: string[] = [];
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private audioCtx: AudioContext | null = null;
  private playing = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
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
    /* pending timer 由基类 destroy→trackTimeout 机制统一清理 */
  }

  /** 生成保证可解的题：从字母池随机一个，干扰项互不相同且码也不同。 */
  private genRound(): { answer: string; code: string; choices: string[] } {
    const pool = poolFor(this.difficulty);
    const answer = sample(pool);
    const code = MORSE[answer] ?? ".";
    const choiceN =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    // 干扰项：码与答案不同
    const distractors = shuffle(pool.filter((l) => MORSE[l] !== code)).slice(
      0,
      choiceN - 1,
    );
    const choices = shuffle([answer, ...distractors]);
    return { answer, code, choices };
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const { answer, code, choices } = this.genRound();
    this.answer = answer;
    this.code = code;
    this.choices = choices;
    this.render();
    // 自动播放一次
    this.trackTimeout(() => this.play(), 500);
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "msc-wrap";

    const task = document.createElement("div");
    task.className = "msc-task";
    task.innerHTML = `听滴嗒声，猜是<b>哪个字母</b>？<br><span class="msc-hint">「滴」短 ·「嗒」长</span> ${this.roundsDone + 1} / ${this.roundTotal}`;
    wrap.appendChild(task);

    // 声波图标 + 播放显示区
    const wave = document.createElement("div");
    wave.className = "msc-wave";
    wave.id = "msc-wave";
    const icon = document.createElement("div");
    icon.className = "msc-icon";
    icon.innerHTML = "📢";
    wave.appendChild(icon);
    const dots = document.createElement("div");
    dots.className = "msc-dots";
    dots.id = "msc-dots";
    // 渲染码符号占位（播放时点亮）
    for (const ch of this.code) {
      const d = document.createElement("span");
      d.className = `msc-dot msc-dot--${ch === "." ? "dit" : "dah"}`;
      d.textContent = ch === "." ? "·" : "—";
      dots.appendChild(d);
    }
    wave.appendChild(dots);
    wrap.appendChild(wave);

    // 播放/重听按钮
    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "msc-play";
    playBtn.id = "msc-play";
    playBtn.textContent = "🔊 再听一遍";
    playBtn.addEventListener("click", () => {
      if (!this.playing) this.play();
    });
    wrap.appendChild(playBtn);

    // 字母选项
    const opts = document.createElement("div");
    opts.className = "msc-opts";
    for (const l of this.choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "msc-opt";
      b.textContent = l;
      b.addEventListener("click", () => this.choose(l, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  /** 播放摩斯码：滴=200Hz 短音 0.12s，嗒=200Hz 长音 0.36s，间隔 0.16s。 */
  private play(): void {
    this.playing = true;
    const dots = this.root.querySelectorAll(".msc-dot");
    dots.forEach((d) => d.classList.remove("msc-dot--active"));
    const unit = 0.16; // 一个时间单位（秒）
    let t = 0;
    for (let i = 0; i < this.code.length; i++) {
      const ch = this.code[i]!;
      const isDit = ch === ".";
      const dur = isDit ? unit : unit * 3;
      const idx = i;
      this.trackTimeout(() => {
        this.beep(dur);
        const d = this.root.querySelector(`.msc-dot:nth-child(${idx + 1})`);
        if (d) d.classList.add("msc-dot--active");
      }, t * 1000);
      t += dur + unit; // 音 + 符号间隔
    }
    this.trackTimeout(
      () => {
        this.playing = false;
      },
      t * 1000 + 100,
    );
  }

  /** 合成单个滴/嗒音。复用单一 AudioContext。 */
  private beep(dur: number): void {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    if (!this.audioCtx) this.audioCtx = new AC();
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660; // 清脆"嘀"音
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private choose(l: string, btn: HTMLButtonElement): void {
    if (this.answered || this.playing) return;
    this.answered = true;
    const ok = l === this.answer;
    if (ok) {
      btn.classList.add("msc-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      sfxPop();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 850);
    } else {
      btn.classList.add("msc-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".msc-opt--wrong")
          .forEach((el) => el.classList.remove("msc-opt--wrong"));
      }, 800);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("msc-style")) return;
    const st = document.createElement("style");
    st.id = "msc-style";
    st.textContent = MSC_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function MSC_CSS(theme: string): string {
  return `
.msc-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.msc-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;}
.msc-task b{color:${theme};}
.msc-hint{font-size:.8rem;color:var(--ink-soft);font-weight:700;}
.msc-wave{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;padding:24px 16px;background:linear-gradient(180deg,#e8eaf6,#fff);border-radius:24px;box-shadow:var(--shadow);}
.msc-icon{font-size:3rem;animation:msc-float 2.4s ease-in-out infinite;}
@keyframes msc-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.msc-dots{display:flex;gap:14px;align-items:center;min-height:48px;}
.msc-dot{font-size:2.2rem;font-weight:900;color:#90a4ae;opacity:.4;transition:transform .12s ease,color .12s ease,opacity .12s ease;}
.msc-dot--dah{font-size:2.6rem;}
.msc-dot--active{color:${theme};opacity:1;transform:scale(1.25);text-shadow:0 0 10px ${theme}88;}
.msc-play{min-height:52px;padding:0 24px;border:none;border-radius:999px;background:#fff;font-weight:800;font-size:1rem;color:${theme};box-shadow:var(--shadow);cursor:pointer;transition:transform .1s ease;}
.msc-play:active{transform:scale(.95);}
.msc-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:380px;}
.msc-opt{min-width:64px;min-height:64px;padding:8px 18px;border:3px solid transparent;border-radius:18px;background:linear-gradient(160deg,#fff,#f0f0f5);box-shadow:var(--shadow);cursor:pointer;font-size:1.8rem;font-weight:900;color:${theme};transition:transform .12s ease,border-color .2s ease,background .2s ease;}
.msc-opt:active{transform:scale(.94);}
.msc-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:msc-yes .4s ease;}
@keyframes msc-yes{0%{transform:scale(1)}50%{transform:scale(1.14)}100%{transform:scale(1)}}
.msc-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:msc-no .3s ease;}
@keyframes msc-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.msc-icon{font-size:2.4rem;}.msc-opt{min-width:52px;min-height:52px;font-size:1.5rem;}}
`;
}

export function create(): MorseCodeGame {
  return new MorseCodeGame();
}
