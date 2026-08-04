/* 时钟报时 Clock Chime —— 听钟声响几下，选出现在是几点。
   独特点：用 Web Audio 合成真实的钟声（多谐波 + 衰减包络），训练听觉计数。
   玩法：点"听钟声"播放 N 下叮咚，孩子从 1~12 里选对的数字。
   解保证：钟声次数 N 即正确答案，N 由随机生成（1~12）且唯一。
   注意：CSS 前缀用 ck2-，避免与已有 clock 游戏的 ck- 冲突。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 共享一个 AudioContext 用于钟声合成（与 audio.ts 独立，避免互相影响音量/静音判断）。
    静音时跳过播放。 */
let chimeCtx: AudioContext | null = null;
function getChimeCtx(): AudioContext | null {
  if (chimeCtx) return chimeCtx;
  try {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    chimeCtx = new AC();
    return chimeCtx;
  } catch {
    return null;
  }
}

/** 合成一声"叮咚"（教堂钟样：基频 + 多个非谐波近似 + 指数衰减）。 */
function playOneChime(when: number): void {
  const c = getChimeCtx();
  if (!c) return;
  // 家长静音判断：复用 audio.ts 的 muted 状态。
  // 通过 localStorage 直接读取（避免引入 audio.ts 造成循环依赖）。
  try {
    const raw = localStorage.getItem("kids-games-save-v1");
    if (raw) {
      const save = JSON.parse(raw) as { settings?: { muted?: boolean } };
      if (save.settings?.muted) return;
    }
  } catch {
    /* ignore */
  }
  if (c.state === "suspended") void c.resume();
  // 钟声：一组近似谐波（含嗡音 hum、音叉音 prime、上层 partials）
  const partials: { f: number; g: number; d: number }[] = [
    { f: 220, g: 0.5, d: 1.6 }, // hum
    { f: 440, g: 0.9, d: 1.4 }, // prime
    { f: 660, g: 0.45, d: 1.0 }, // minor third 上层
    { f: 880, g: 0.3, d: 0.8 },
    { f: 1320, g: 0.18, d: 0.5 },
  ];
  const t0 = c.currentTime + when;
  const master = c.createGain();
  master.gain.value = 0.6;
  master.connect(c.destination);
  for (const p of partials) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(p.f, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(p.g, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.d);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + p.d + 0.05);
  }
  // 起音的金属"铛"——短促噪声扫频感，用方波快速衰减
  const hit = c.createOscillator();
  const hg = c.createGain();
  hit.type = "triangle";
  hit.frequency.setValueAtTime(1760, t0);
  hg.gain.setValueAtTime(0.25, t0);
  hg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  hit.connect(hg);
  hg.connect(master);
  hit.start(t0);
  hit.stop(t0 + 0.16);
}

function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 3 : diff === "medium" ? 4 : 5;
}
/** 钟声数范围（含两端）。easy：1~6；medium：1~9；hard：1~12。 */
function maxChimes(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 6 : diff === "medium" ? 9 : 12;
}

export class ClockChimeGame extends BaseGame {
  constructor() {
    super("clock-chime");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answer = 0;
  private answered = false;
  private playing = false;

  protected mount(): void {
    this.roundTotal = roundTotal(this.difficulty);
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.playing = false;
    /* 定时器由 trackTimeout 统一清理；AudioContext 节点自行结束，无需手动停 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.answered = false;
    this.playing = false;
    const maxN = maxChimes(this.difficulty);
    this.answer = Math.floor(Math.random() * maxN) + 1; // 1..maxN

    const wrap = document.createElement("div");
    wrap.className = "ck2-wrap";

    const task = document.createElement("div");
    task.className = "ck2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 听钟声响几下，选几点 🕐`;
    wrap.appendChild(task);

    // 时钟（指针动画跟随钟声）
    const clock = document.createElement("div");
    clock.className = "ck2-clock";
    clock.innerHTML = `
      <div class="ck2-face">
        <div class="ck2-hand ck2-hour" id="ck2-hour"></div>
        <div class="ck2-hand ck2-min"></div>
        <div class="ck2-center"></div>
        ${Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 - 90) * (Math.PI / 180);
          const x = 50 + 42 * Math.cos(a);
          const y = 50 + 42 * Math.sin(a);
          const num = i === 0 ? 12 : i;
          return `<span class="ck2-num" style="left:${x}%;top:${y}%">${num}</span>`;
        }).join("")}
      </div>
    `;
    // 默认时针指向答案（让视觉与答案对应，但孩子靠听来判断）
    const hourEl = clock.querySelector<HTMLElement>("#ck2-hour");
    if (hourEl) hourEl.style.transform = `rotate(${this.answer * 30}deg)`;
    wrap.appendChild(clock);

    // 听钟声按钮
    const listen = document.createElement("button");
    listen.type = "button";
    listen.className = "ck2-listen";
    listen.id = "ck2-listen";
    listen.innerHTML = "🔔 听钟声";
    listen.addEventListener("click", () => this.playChimes());
    wrap.appendChild(listen);

    // 答案选项：包含正确答案 + 若干干扰，打乱
    const choices = document.createElement("div");
    choices.className = "ck2-choices";
    const opts = new Set<number>([this.answer]);
    while (opts.size < Math.min(5, maxN)) {
      opts.add(Math.floor(Math.random() * maxN) + 1);
    }
    for (const v of shuffle([...opts])) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ck2-opt";
      b.dataset.v = String(v);
      b.textContent = `${v} 点`;
      b.addEventListener("click", () => this.choose(v, b));
      choices.appendChild(b);
    }
    wrap.appendChild(choices);

    this.root.appendChild(wrap);

    // 自动播放一次
    this.trackTimeout(() => this.playChimes(), 500);
  }

  private playChimes(): void {
    if (this.playing || this.answered) return;
    this.playing = true;
    const btn = this.root.querySelector<HTMLButtonElement>("#ck2-listen");
    if (btn) {
      btn.disabled = true;
      btn.classList.add("ck2-listen--playing");
      btn.innerHTML = "🔔 叮…";
    }
    const hourEl = this.root.querySelector<HTMLElement>("#ck2-hour");
    // 每下间隔 0.7s
    const interval = 0.7;
    for (let i = 0; i < this.answer; i++) {
      playOneChime(i * interval);
      // 时钟在每次敲击时同步动画（指针轻摆）
      this.trackTimeout(
        () => {
          if (hourEl) {
            hourEl.style.transition = "transform .15s ease";
            hourEl.style.transform = `rotate(${this.answer * 30 + 6}deg)`;
            this.trackTimeout(() => {
              if (hourEl)
                hourEl.style.transform = `rotate(${this.answer * 30}deg)`;
            }, 180);
          }
        },
        i * interval * 1000,
      );
    }
    const totalMs = this.answer * interval * 1000 + 400;
    this.trackTimeout(() => {
      this.playing = false;
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("ck2-listen--playing");
        btn.innerHTML = "🔔 再听一次";
      }
    }, totalMs);
  }

  private choose(v: number, btn: HTMLButtonElement): void {
    if (this.answered || this.playing) return;
    if (v === this.answer) {
      this.answered = true;
      btn.classList.add("ck2-opt--right");
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
      btn.classList.add("ck2-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ck2-opt--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再听一次钟声，跟着数：叮一下是 1 点，叮两下是 2 点……",
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
    if (document.getElementById("ck2-style")) return;
    const st = document.createElement("style");
    st.id = "ck2-style";
    st.textContent = CK2_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function CK2_CSS(theme: string): string {
  return `
.ck2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(440px,100%);}
.ck2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.ck2-clock{width:220px;height:220px;}
.ck2-face{position:relative;width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#ffe9a8 70%,${theme});box-shadow:inset 0 -6px 10px rgba(0,0,0,.12),0 8px 18px rgba(0,0,0,.2);border:6px solid #fff;}
.ck2-num{position:absolute;transform:translate(-50%,-50%);font-size:.95rem;font-weight:900;color:var(--ink);}
.ck2-hand{position:absolute;left:50%;top:50%;transform-origin:bottom center;border-radius:4px;}
.ck2-hour{width:6px;height:26%;margin-left:-3px;background:var(--ink);transform:translateY(-100%) rotate(0deg);}
.ck2-min{width:4px;height:36%;margin-left:-2px;background:var(--ink-soft);transform:translateY(-100%) rotate(90deg);}
.ck2-center{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 3px #fff;}
.ck2-listen{font-family:inherit;font-size:1.2rem;font-weight:900;color:#fff;background:linear-gradient(160deg,${theme},#e0a800);border:none;padding:12px 28px;border-radius:999px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;}
.ck2-listen:active{transform:scale(.94);}
.ck2-listen--playing{opacity:.7;}
.ck2-listen:disabled{cursor:default;}
.ck2-choices{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:20px;box-shadow:var(--shadow);width:min(380px,94%);}
.ck2-opt{font-family:inherit;font-size:1.1rem;font-weight:900;color:var(--ink);background:#fff;border:none;width:78px;height:54px;border-radius:14px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s,background .15s;}
.ck2-opt:hover{transform:translateY(-3px);}
.ck2-opt:active{transform:scale(.93);}
.ck2-opt--right{background:linear-gradient(160deg,#6bcf7f,#4ba85f);color:#fff;animation:ck2-pop .3s ease;}
.ck2-opt--wrong{background:linear-gradient(160deg,#ff8a8a,#ff6348);color:#fff;animation:ck2-shake .4s ease;}
@keyframes ck2-pop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes ck2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.ck2-clock{width:180px;height:180px;}.ck2-opt{width:64px;height:46px;font-size:1rem;}}
`;
}

export function create(): ClockChimeGame {
  return new ClockChimeGame();
}
