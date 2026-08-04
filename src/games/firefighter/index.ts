/* 消防员 Firefighter —— 限时内点掉所有随机出现的火苗，灭火守护家园。
   独特点：限时反应点击，火苗会闪烁抖动（区别于 whack-mole 的"露头"节奏）。
   视觉：火苗 emoji + 灭火水花动画 + 倒计时。难度=火苗数/时限。通关=灭火目标轮数。
   巧思：火苗位置随机但不重叠，点到即灭；时限内全灭过关，超时算失败重做本轮。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle, sample } from "../../lobby/util.ts";

interface Flame {
  el: HTMLElement;
  out: boolean;
}

const ENCOURAGE = [
  "灭火成功！",
  "动作真快！",
  "勇敢的消防员！",
  "快点把火都灭掉～",
];

export class FirefighterGame extends BaseGame {
  constructor() {
    super("firefighter");
  }

  private scene!: HTMLDivElement;
  private flames: Flame[] = [];
  private remaining = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private timeLeft = 0;
  private timer = 0;
  private raf = 0;
  private over = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    cancelAnimationFrame(this.raf);
    if (this.timer) clearInterval(this.timer);
  }

  private fireCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }
  private totalTime(): number {
    return this.difficulty === "easy"
      ? 20
      : this.difficulty === "medium"
        ? 18
        : 15;
  }

  private startRound(): void {
    this.over = false;
    cancelAnimationFrame(this.raf);
    if (this.timer) clearInterval(this.timer);
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.flames = [];

    const n = this.fireCount();
    this.remaining = n;
    this.timeLeft = this.totalTime();

    const wrap = document.createElement("div");
    wrap.className = "ff-wrap";

    const bar = document.createElement("div");
    bar.className = "ff-bar";
    bar.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · <span id="ff-left">🔥 ${n}</span> · <span id="ff-time">⏱️ ${this.timeLeft}</span>`;
    wrap.appendChild(bar);

    this.scene = document.createElement("div");
    this.scene.className = "ff-scene";
    wrap.appendChild(this.scene);
    this.root.appendChild(wrap);

    // 等布局完成后放置火苗（保证不重叠）
    requestAnimationFrame(() => {
      const r = this.scene.getBoundingClientRect();
      const w = r.width || 320;
      const h = r.height || 320;
      const placed: { x: number; y: number }[] = [];
      let tries = 0;
      while (placed.length < n && tries < 400) {
        tries += 1;
        const x = randInt(10, Math.max(12, w - 56));
        const y = randInt(10, Math.max(12, h - 56));
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > 64)) {
          placed.push({ x, y });
        }
      }
      // 兜底：若因场景太小未放够，按网格补齐
      let gi = 0;
      while (placed.length < n) {
        const x = 20 + (gi % 4) * 70;
        const y = 20 + Math.floor(gi / 4) * 70;
        placed.push({ x, y });
        gi += 1;
      }
      shuffle(placed).forEach((p) => this.spawnFlame(p.x, p.y));
    });

    // 倒计时
    this.timer = window.setInterval(() => {
      this.timeLeft -= 1;
      const t = this.root.querySelector("#ff-time");
      if (t) t.textContent = `⏱️ ${this.timeLeft}`;
      if (this.timeLeft <= 0) this.timeout();
    }, 1000);

    this.raf = requestAnimationFrame(this.flicker);
  }

  private flicker = (): void => {
    if (this.over) return;
    for (const f of this.flames) {
      if (f.out) continue;
      // 抖动幅度（CSS 也动画，这里做轻微随机偏移增强生动）
      f.el.style.setProperty("--ff-jit", `${randInt(-3, 3)}px`);
    }
    this.raf = requestAnimationFrame(this.flicker);
  };

  private spawnFlame(x: number, y: number): void {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "ff-flame";
    el.textContent = "🔥";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const f: Flame = { el, out: false };
    el.addEventListener("click", () => this.extinguish(f));
    this.scene.appendChild(el);
    this.flames.push(f);
  }

  private extinguish(f: Flame): void {
    if (this.over || f.out) return;
    f.out = true;
    sfxPop();
    this.resetWrongStreak();
    const r = f.el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 12);
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    f.el.classList.add("ff-flame--out");
    this.trackTimeout(() => f.el.remove(), 450);
    this.remaining -= 1;
    const left = this.root.querySelector("#ff-left");
    if (left) left.textContent = `🔥 ${Math.max(0, this.remaining)}`;
    if (this.remaining <= 0) {
      this.over = true;
      cancelAnimationFrame(this.raf);
      if (this.timer) clearInterval(this.timer);
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 800);
    }
  }

  private timeout(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    if (this.timer) clearInterval(this.timer);
    this.onWrong();
    this.showRest(true);
  }

  private showRest(retry = false): void {
    const ov = new Overlay({
      title: retry ? "火还没灭完！" : "休息一下～",
      emoji: "🧯",
      variant: "rest",
      body: retry
        ? `没赶上，再试一次吧！手要快哦～ ${sample(ENCOURAGE)}`
        : `快速点掉每一个火苗🔥 ${sample(ENCOURAGE)}`,
      primary: {
        text: retry ? "再来一次" : "继续",
        icon: "🎈",
        onClick: () => {
          ov.destroy();
          this.startRound();
        },
      },
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
    if (document.getElementById("ff-style")) return;
    const st = document.createElement("style");
    st.id = "ff-style";
    st.textContent = FF_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function FF_CSS(theme: string): string {
  return `
.ff-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.ff-bar{font-size:1.1rem;font-weight:900;background:#fff;padding:8px 22px;border-radius:999px;box-shadow:var(--shadow);}
.ff-scene{position:relative;width:100%;height:56vh;min-height:320px;background:linear-gradient(180deg,#ffe9d6,#ffd9b3);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
.ff-scene::after{content:"🏠";position:absolute;bottom:6px;left:50%;transform:translateX(-50%);font-size:4rem;opacity:.5;filter:drop-shadow(0 3px 3px rgba(0,0,0,.15));}
.ff-flame{position:absolute;width:56px;height:56px;border:none;background:transparent;font-size:2.6rem;line-height:1;cursor:pointer;user-select:none;animation:ff-flick .5s ease-in-out infinite alternate;filter:drop-shadow(0 2px 4px rgba(255,80,0,.5));padding:0;}
.ff-flame::after{content:"";position:absolute;inset:auto 4px -4px 4px;height:8px;background:radial-gradient(ellipse,${theme}88,transparent);border-radius:50%;}
@keyframes ff-flick{0%{transform:translateY(var(--ff-jit,0)) scale(1) rotate(-4deg)}100%{transform:translateY(calc(var(--ff-jit,0) - 3px)) scale(1.12) rotate(4deg)}}
.ff-flame--out{animation:ff-out .45s ease forwards;pointer-events:none;}
@keyframes ff-out{0%{transform:scale(1);opacity:1}40%{transform:scale(1.5);opacity:.8;filter:blur(2px) hue-rotate(60deg)}100%{transform:scale(.3);opacity:0}}
`;
}

export function create(): FirefighterGame {
  return new FirefighterGame();
}
