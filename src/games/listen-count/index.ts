/* 听音数数 Listen Count —— Web Audio 播放 N 声"叮"，孩子听完后选听到了几声。
   独特点：训练听觉持续注意力。播放时显示动画音波。难度=声音数 + 间隔不规则度。
   巧思：用 audio.ts 的 sfxPop() 逐声播放，间隔随机（hard 更不规则易漏数），
   选项含正确答案 + 干扰；点对粒子，点错再听一次。前缀 lct-（listen count）。
   说明：依需求使用 src/core/audio.ts，不另起 AudioContext。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

/** 各难度：[声音数范围, 单声间隔基准ms, 不规则幅度ms]。
    easy: 3~6 声、间隔规则；hard: 5~10 声、间隔很不规则。 */
function config(
  diff: "easy" | "medium" | "hard",
): { min: number; max: number; baseGap: number; jitter: number } {
  if (diff === "easy") return { min: 3, max: 6, baseGap: 750, jitter: 60 };
  if (diff === "medium") return { min: 4, max: 8, baseGap: 700, jitter: 220 };
  return { min: 5, max: 10, baseGap: 650, jitter: 380 };
}

export class ListenCountGame extends BaseGame {
  constructor() {
    super("listen-count");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answer = 0;
  private playing = false;
  private answered = false;
  private waveBars: HTMLElement[] = [];

  protected mount(): void {
    this.roundTotal = this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    this.playing = false;
    /* 定时器由基类清理；音效由 audio.ts 内部节点自行结束 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.answered = false;
    this.playing = false;
    const cfg = config(this.difficulty);
    this.answer = randInt(cfg.min, cfg.max);

    const wrap = document.createElement("div");
    wrap.className = "lct-wrap";

    const task = document.createElement("div");
    task.className = "lct-task";
    task.innerHTML = `听"叮"声响几下，选对数字 👂（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 音波可视化
    const wave = document.createElement("div");
    wave.className = "lct-wave";
    wave.id = "lct-wave";
    this.waveBars = [];
    for (let i = 0; i < 7; i++) {
      const bar = document.createElement("span");
      bar.className = "lct-bar";
      wave.appendChild(bar);
      this.waveBars.push(bar);
    }
    wrap.appendChild(wave);

    const listen = document.createElement("button");
    listen.type = "button";
    listen.className = "lct-listen";
    listen.id = "lct-listen";
    listen.innerHTML = "🔔 听一听";
    listen.addEventListener("click", () => this.playSounds());
    wrap.appendChild(listen);

    // 答案选项
    const choices = document.createElement("div");
    choices.className = "lct-choices";
    const opts = new Set<number>([this.answer]);
    while (opts.size < Math.min(5, cfg.max)) {
      opts.add(randInt(cfg.min, cfg.max));
    }
    for (const v of shuffle([...opts])) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lct-opt";
      b.dataset.v = String(v);
      b.textContent = String(v);
      b.addEventListener("click", () => this.choose(v, b));
      choices.appendChild(b);
    }
    wrap.appendChild(choices);
    this.root.appendChild(wrap);

    // 自动播放一次
    this.trackTimeout(() => this.playSounds(), 500);
  }

  private playSounds(): void {
    if (this.playing || this.answered) return;
    this.playing = true;
    const btn = this.root.querySelector<HTMLButtonElement>("#lct-listen");
    if (btn) {
      btn.disabled = true;
      btn.classList.add("lct-listen--playing");
      btn.innerHTML = "🔔 叮…";
    }
    const cfg = config(this.difficulty);
    let elapsed = 0;
    for (let i = 0; i < this.answer; i++) {
      // 每声间隔 = 基准 ± jitter，模拟不规则节拍
      elapsed += cfg.baseGap + randInt(-cfg.jitter, cfg.jitter);
      this.trackTimeout(() => {
        sfxPop();
        this.flashWave();
      }, elapsed);
    }
    const totalMs = elapsed + 400;
    this.trackTimeout(() => {
      this.playing = false;
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("lct-listen--playing");
        btn.innerHTML = "🔔 再听一次";
      }
    }, totalMs);
  }

  private flashWave(): void {
    for (const bar of this.waveBars) {
      bar.classList.remove("lct-bar--active");
      // 触发重排以重启动画
      void bar.offsetWidth;
      bar.classList.add("lct-bar--active");
    }
  }

  private choose(v: number, btn: HTMLButtonElement): void {
    if (this.answered || this.playing) return;
    if (v === this.answer) {
      this.answered = true;
      btn.classList.add("lct-opt--right");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("lct-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("lct-opt--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "专心听，跟着数：叮一下是 1，叮两下是 2……可以再听一次哦～",
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
    if (document.getElementById("lct-style")) return;
    const st = document.createElement("style");
    st.id = "lct-style";
    st.textContent = LCT_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function LCT_CSS(theme: string): string {
  return `
.lct-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(440px,100%);}
.lct-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.lct-wave{display:flex;align-items:center;justify-content:center;gap:7px;height:90px;padding:10px 18px;background:linear-gradient(180deg,#f3e8ff,#fff);border-radius:20px;box-shadow:var(--shadow);width:min(280px,90%);}
.lct-bar{display:block;width:12px;height:18px;border-radius:6px;background:${theme}66;transition:none;}
.lct-bar--active{animation:lct-jump .35s ease;}
@keyframes lct-jump{0%{height:18px}40%{height:70px}100%{height:18px}}
.lct-listen{font-family:inherit;font-size:1.2rem;font-weight:900;color:#fff;background:linear-gradient(160deg,${theme},#7c3aed);border:none;padding:12px 30px;border-radius:999px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;min-height:48px;}
.lct-listen:active{transform:scale(.94);}
.lct-listen--playing{opacity:.7;}
.lct-listen:disabled{cursor:default;}
.lct-choices{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:14px;background:rgba(255,255,255,.7);border-radius:20px;box-shadow:var(--shadow);width:min(380px,94%);}
.lct-opt{font-family:inherit;font-size:1.4rem;font-weight:900;color:var(--ink);background:#fff;border:none;width:64px;height:64px;min-width:48px;min-height:48px;border-radius:16px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s,background .15s;}
.lct-opt:hover{transform:translateY(-3px);}
.lct-opt:active{transform:scale(.93);}
.lct-opt--right{background:linear-gradient(160deg,#6bcf7f,#4ba85f);color:#fff;animation:lct-pop .3s ease;}
.lct-opt--wrong{background:linear-gradient(160deg,#ff8a8a,#ff6348);color:#fff;animation:lct-shake .4s ease;}
@keyframes lct-pop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes lct-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.lct-opt{width:54px;height:54px;font-size:1.2rem;}.lct-bar{width:9px;}}
`;
}

export function create(): ListenCountGame {
  return new ListenCountGame();
}
