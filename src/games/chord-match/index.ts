/* 和弦配对 Chord Match —— 听两个音一起响，判断是"好听（和谐）"还是"刺耳（不和谐）"。
   独特点：和声听感（协和 vs 不协和）的二选一判断。
   巧思：同时奏响两个音（大三度=和谐 / 小二度=刺耳）；可重听；难度=轮数。
   前缀 chm2-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

// "和谐"=同时奏大三度（C+E），"刺耳"=同时奏小二度（C+C#）
const HARMONY = "好听（和谐）";
const HARSH = "刺耳（不和谐）";

// 用频率直接合成，避免引入额外音频模块
const FREQ_C4 = 261.63;
const FREQ_E4 = 329.63; // 大三度：和谐
const FREQ_CS4 = 277.18; // 小二度：刺耳

export class ChordMatchGame extends BaseGame {
  constructor() {
    super("chord-match");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private harmonious = true; // 本轮是否是和谐和弦

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空；定时器由基类清理 */
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.harmonious = sample([true, false]);
    this.render();
    // 自动先播放一次
    this.trackTimeout(() => this.playChord(), 500);
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "chm2-wrap";

    const task = document.createElement("div");
    task.className = "chm2-task";
    task.innerHTML = `听这两个音一起响，是<b>好听</b>还是<b>刺耳</b>？<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const speaker = document.createElement("button");
    speaker.type = "button";
    speaker.className = "chm2-speaker";
    speaker.textContent = "🔊 再听一遍";
    speaker.addEventListener("click", () => this.playChord());
    wrap.appendChild(speaker);

    const opts = document.createElement("div");
    opts.className = "chm2-opts";
    for (const c of shuffle([HARMONY, HARSH])) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chm2-opt";
      b.textContent = c;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  /** 同时奏响两个音。 */
  private playChord(): void {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    // 复用全局 ctx（与 audio.ts 一致，避免每局新建）
    let ctx = (window as unknown as { __chmCtx?: AudioContext }).__chmCtx;
    if (!ctx) {
      try {
        ctx = new AC();
        (window as unknown as { __chmCtx?: AudioContext }).__chmCtx = ctx;
      } catch {
        return;
      }
    }
    if (ctx.state === "suspended") void ctx.resume();
    const f2 = this.harmonious ? FREQ_E4 : FREQ_CS4;
    const t0 = ctx.currentTime;
    for (const f of [FREQ_C4, f2]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 1.2);
    }
  }

  private choose(c: string, btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    const ok =
      (this.harmonious && c === HARMONY) || (!this.harmonious && c === HARSH);
    if (ok) {
      btn.classList.add("chm2-opt--correct");
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
      }, 900);
    } else {
      btn.classList.add("chm2-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".chm2-opt--wrong")
          .forEach((el) => el.classList.remove("chm2-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("chm2-style")) return;
    const st = document.createElement("style");
    st.id = "chm2-style";
    st.textContent = CHM2_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function CHM2_CSS(theme: string): string {
  return `
.chm2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.chm2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.chm2-task b{color:${theme};}
.chm2-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.chm2-speaker{padding:18px 30px;border:none;border-radius:999px;background:linear-gradient(135deg,${theme},#7c5dcf);color:#fff;font-size:1.2rem;font-weight:900;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s ease;}
.chm2-speaker:active{transform:scale(.94);}
.chm2-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.chm2-opts{grid-template-columns:1fr;}}
.chm2-opt{padding:18px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#f1ecfb);box-shadow:var(--shadow);cursor:pointer;font-size:1.1rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:64px;}
.chm2-opt:active{transform:scale(.95);}
.chm2-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:chm2-yes .4s ease;}
@keyframes chm2-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.chm2-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:chm2-no .3s ease;}
@keyframes chm2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ChordMatchGame {
  return new ChordMatchGame();
}
