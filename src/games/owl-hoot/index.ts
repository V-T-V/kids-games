/* 猫头鹰 Owl Hoot —— 猫头鹰在夜晚叫 N 声"咕咕"，
   孩子听完后选"叫了几声"（代表几点）。
   独特点：用 Web Audio 合成柔和的猫头鹰"咕咕"声（双音节 + 低频共鸣），
   训练听觉计数。难度=叫声数范围（easy 1~5，medium 1~8，hard 1~12）。
   通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 独立 AudioContext（与 audio.ts 分离，避免互相影响）。
    静音时跳过。 */
let hootCtx: AudioContext | null = null;
function getHootCtx(): AudioContext | null {
  if (hootCtx) return hootCtx;
  try {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    hootCtx = new AC();
    return hootCtx;
  } catch {
    return null;
  }
}

function isMuted(): boolean {
  try {
    const raw = localStorage.getItem("kids-games-save-v1");
    if (raw) {
      const save = JSON.parse(raw) as { settings?: { muted?: boolean } };
      if (save.settings?.muted) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** 合成一声猫头鹰"咕咕"（两音节，低频圆柔）。
    @param when 相对 ctx.currentTime 的偏移秒 */
function playOneHoot(when: number): void {
  const c = getHootCtx();
  if (!c) return;
  if (isMuted()) return;
  if (c.state === "suspended") void c.resume();
  const master = c.createGain();
  master.gain.value = 0.7;
  master.connect(c.destination);
  // 两音节 goo-goo
  const syll = (start: number): void => {
    const t0 = c.currentTime + start;
    // 基音 + 共鸣（模拟口腔）
    const partials: {
      f: number;
      g: number;
      d: number;
      type: OscillatorType;
    }[] = [
      { f: 200, g: 0.9, d: 0.22, type: "sine" },
      { f: 300, g: 0.35, d: 0.18, type: "sine" },
      { f: 410, g: 0.18, d: 0.15, type: "triangle" },
    ];
    for (const p of partials) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = p.type;
      osc.frequency.setValueAtTime(p.f, t0);
      // 轻微下滑（咕的尾音）
      osc.frequency.exponentialRampToValueAtTime(p.f * 0.85, t0 + p.d);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(p.g, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.d);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + p.d + 0.03);
    }
  };
  syll(when);
  syll(when + 0.26); // 第二个 goo
}

function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 3 : diff === "medium" ? 4 : 5;
}
/** 叫声数最大值（含）。 */
function maxHoots(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 5 : diff === "medium" ? 8 : 12;
}

export class OwlHootGame extends BaseGame {
  constructor() {
    super("owl-hoot");
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
    /* trackTimeout 统一清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.answered = false;
    this.playing = false;
    const maxN = maxHoots(this.difficulty);
    this.answer = Math.floor(Math.random() * maxN) + 1;

    const wrap = document.createElement("div");
    wrap.className = "oh-wrap";

    const task = document.createElement("div");
    task.className = "oh-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 听猫头鹰叫几声，选对了就知道几点啦 🌙`;
    wrap.appendChild(task);

    // 夜晚 + 猫头鹰
    const scene = document.createElement("div");
    scene.className = "oh-scene";
    scene.innerHTML = `
      <div class="oh-moon"></div>
      <div class="oh-stars"></div>
      <div class="oh-tree"></div>
      <div class="oh-owl" id="oh-owl">🦉</div>
    `;
    wrap.appendChild(scene);

    const listen = document.createElement("button");
    listen.type = "button";
    listen.className = "oh-listen";
    listen.id = "oh-listen";
    listen.innerHTML = "🔊 听猫头鹰叫";
    listen.addEventListener("click", () => this.playHoots());
    wrap.appendChild(listen);

    // 答案选项
    const choices = document.createElement("div");
    choices.className = "oh-choices";
    const opts = new Set<number>([this.answer]);
    while (opts.size < Math.min(5, maxN)) {
      opts.add(Math.floor(Math.random() * maxN) + 1);
    }
    for (const v of shuffle([...opts])) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "oh-opt";
      b.dataset.v = String(v);
      b.textContent = `${v} 声`;
      b.addEventListener("click", () => this.choose(v, b));
      choices.appendChild(b);
    }
    wrap.appendChild(choices);

    this.root.appendChild(wrap);

    this.trackTimeout(() => this.playHoots(), 500);
  }

  private playHoots(): void {
    if (this.playing || this.answered) return;
    this.playing = true;
    const btn = this.root.querySelector<HTMLButtonElement>("#oh-listen");
    if (btn) {
      btn.disabled = true;
      btn.classList.add("oh-listen--playing");
      btn.innerHTML = "🦉 咕…咕…";
    }
    const owl = this.root.querySelector<HTMLElement>("#oh-owl");
    const interval = 1.1; // 每声间隔
    for (let i = 0; i < this.answer; i++) {
      playOneHoot(i * interval);
      // 猫头鹰每次叫声时眨眼/摆动
      this.trackTimeout(
        () => {
          if (owl) {
            owl.classList.remove("oh-owl--hoot");
            void owl.offsetWidth;
            owl.classList.add("oh-owl--hoot");
          }
        },
        i * interval * 1000,
      );
    }
    const totalMs = this.answer * interval * 1000 + 500;
    this.trackTimeout(() => {
      this.playing = false;
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("oh-listen--playing");
        btn.innerHTML = "🔊 再听一次";
      }
    }, totalMs);
  }

  private choose(v: number, btn: HTMLButtonElement): void {
    if (this.answered || this.playing) return;
    if (v === this.answer) {
      this.answered = true;
      btn.classList.add("oh-opt--right");
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
      btn.classList.add("oh-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("oh-opt--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再听一次：跟着数，咕一次是 1，咕两次是 2……",
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
    if (document.getElementById("oh-style")) return;
    const st = document.createElement("style");
    st.id = "oh-style";
    st.textContent = OH_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function OH_CSS(theme: string): string {
  return `
.oh-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.oh-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.oh-task b{color:${theme};}
.oh-scene{position:relative;width:100%;height:38vh;min-height:220px;background:linear-gradient(180deg,#1a1a4e 0%,#2d2a6e 70%,#3b3a8c 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
.oh-moon{position:absolute;top:18px;right:28px;width:48px;height:48px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fffef0,#f5e7a0);box-shadow:0 0 24px rgba(255,245,160,.6);}
.oh-stars{position:absolute;inset:0;background-image:radial-gradient(1px 1px at 15% 20%,#fff,transparent),radial-gradient(1px 1px at 35% 40%,#fff,transparent),radial-gradient(1.5px 1.5px at 60% 25%,#fff,transparent),radial-gradient(1px 1px at 80% 45%,#fff,transparent),radial-gradient(1px 1px at 25% 55%,#fff,transparent),radial-gradient(1.5px 1.5px at 70% 60%,#fff,transparent),radial-gradient(1px 1px at 50% 15%,#fff,transparent);opacity:.85;animation:oh-twinkle 3s ease-in-out infinite;}
@keyframes oh-twinkle{0%,100%{opacity:.5}50%{opacity:.95}}
.oh-tree{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:60px;height:100%;background:linear-gradient(180deg,transparent 30%,#3d2b1f 30%);border-radius:8px 8px 0 0;}
.oh-tree::before{content:"";position:absolute;left:50%;bottom:60px;transform:translateX(-50%);width:120px;height:60px;background:#2d4520;border-radius:50% 50% 40% 40%;}
.oh-owl{position:absolute;left:50%;bottom:54px;transform:translateX(-50%);font-size:3rem;line-height:1;z-index:3;filter:drop-shadow(0 4px 6px rgba(0,0,0,.4));}
.oh-owl--hoot{animation:oh-hoot .5s ease;}
@keyframes oh-hoot{0%{transform:translateX(-50%) scale(1)}30%{transform:translateX(-50%) scale(1.12) translateY(-4px)}100%{transform:translateX(-50%) scale(1)}}
.oh-listen{font-family:inherit;font-size:1.2rem;font-weight:900;color:#fff;background:linear-gradient(160deg,${theme},#4f46e5);border:none;padding:12px 28px;border-radius:999px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;}
.oh-listen:active{transform:scale(.94);}
.oh-listen--playing{opacity:.7;}
.oh-listen:disabled{cursor:default;}
.oh-choices{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.65);border-radius:20px;box-shadow:var(--shadow);width:min(380px,94%);}
.oh-opt{font-family:inherit;font-size:1.1rem;font-weight:900;color:var(--ink);background:#fff;border:none;width:84px;height:54px;border-radius:14px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s,background .15s;}
.oh-opt:hover{transform:translateY(-3px);}
.oh-opt:active{transform:scale(.93);}
.oh-opt--right{background:linear-gradient(160deg,#6bcf7f,#4ba85f);color:#fff;animation:oh-pop .3s ease;}
.oh-opt--wrong{background:linear-gradient(160deg,#ff8a8a,#ff6348);color:#fff;animation:oh-shake .4s ease;}
@keyframes oh-pop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes oh-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.oh-task{font-size:.95rem;}.oh-owl{font-size:2.4rem;}.oh-opt{width:68px;height:46px;font-size:1rem;}}
`;
}

export function create(): OwlHootGame {
  return new OwlHootGame();
}
