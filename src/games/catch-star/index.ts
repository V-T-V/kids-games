/* 接星星 Catch Star —— 限时点击下落的星星，避开炸弹。
   独特点：点击（而非移动接）下落物，锻炼点击精度（区别于 fruit-catch 的移动接）。
   巧思：星星有重力下落，点中爆开；难度=下落速度+数量。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Star {
  x: number;
  y: number;
  vy: number;
  el: HTMLElement;
  bomb: boolean;
  gone: boolean;
}

export class CatchStarGame extends BaseGame {
  constructor() {
    super("catch-star");
  }
  private field!: HTMLDivElement;
  private stars: Star[] = [];
  private score = 0;
  private raf = 0;
  private timer = 0;
  private timeLeft = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startGame();
  }
  protected unmount(): void {
    cancelAnimationFrame(this.raf);
    if (this.timer) clearInterval(this.timer);
  }

  private startGame(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.score = 0;
    this.over = false;
    this.stars = [];
    this.timeLeft =
      this.difficulty === "easy" ? 25 : this.difficulty === "medium" ? 20 : 15;

    const wrap = document.createElement("div");
    wrap.className = "cs-wrap";
    const bar = document.createElement("div");
    bar.className = "cs-bar";
    bar.innerHTML = `<div id="cs-score">⭐ 0</div><div id="cs-time">⏱️ ${this.timeLeft}</div>`;
    wrap.appendChild(bar);

    this.field = document.createElement("div");
    this.field.className = "cs-field";
    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    this.timer = window.setInterval(() => {
      this.timeLeft -= 1;
      const t = this.root.querySelector("#cs-time");
      if (t) t.textContent = `⏱️ ${this.timeLeft}`;
      if (this.timeLeft <= 0) this.end();
    }, 1000);

    this.loop();
  }

  private loop = (): void => {
    if (this.over) return;
    // 随机生成
    if (Math.random() < (this.difficulty === "easy" ? 0.04 : 0.06))
      this.spawn();
    const r = this.field.getBoundingClientRect();
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i]!;
      s.y += s.vy;
      s.el.style.top = `${s.y}px`;
      if (s.y > r.height) {
        s.el.remove();
        this.stars.splice(i, 1);
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private spawn(): void {
    const r = this.field.getBoundingClientRect();
    const bomb = Math.random() < 0.15;
    const el = document.createElement("div");
    el.className = "cs-star";
    el.textContent = bomb ? "💣" : "⭐";
    const x = randInt(10, r.width - 50);
    el.style.left = `${x}px`;
    el.style.top = "-40px";
    this.field.appendChild(el);
    const s: Star = {
      x,
      y: -40,
      vy: this.difficulty === "easy" ? 1.8 : 2.6,
      el,
      bomb,
      gone: false,
    };
    el.addEventListener("click", () => this.hit(s));
    this.stars.push(s);
  }

  private hit(s: Star): void {
    if (s.gone) return;
    s.gone = true;
    const r = s.el.getBoundingClientRect();
    if (s.bomb) {
      this.score = Math.max(0, this.score - 2);
      this.onWrong();
    } else {
      this.score += 1;
      sfxPop();
      burst(r.left + r.width / 2, r.top + r.height / 2, 8);
      this.resetWrongStreak();
    }
    s.el.classList.add("cs-star--burst");
    this.trackTimeout(() => s.el.remove(), 300);
    const sc = this.root.querySelector("#cs-score");
    if (sc) sc.textContent = `⭐ ${this.score}`;
  }

  private end(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    if (this.timer) clearInterval(this.timer);
    const stars = this.score >= 15 ? 3 : this.score >= 8 ? 2 : 1;
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(stars);
      } else {
        this.startGame();
      }
    }, 600);
  }

  private injectStyle(): void {
    if (document.getElementById("cs2-style")) return;
    const st = document.createElement("style");
    st.id = "cs2-style";
    st.textContent = CS2_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function CS2_CSS(_theme: string): string {
  return `
.cs-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.cs-bar{display:flex;gap:28px;font-size:1.5rem;font-weight:900;background:linear-gradient(180deg,#fff,#fff6d8);padding:10px 28px;border-radius:999px;box-shadow:var(--shadow);border:2px solid #ffd84d;}
.cs-bar #cs-score{color:#e8a800;text-shadow:0 1px 2px rgba(0,0,0,.18);}
.cs-bar #cs-time{color:#3a6ab8;}
.cs-field{position:relative;width:100%;height:60vh;min-height:340px;background:radial-gradient(ellipse at 50% 30%,#2a2a5e 0%,#1a1a3e 45%,#0d0d22 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow),inset 0 0 50px rgba(0,0,0,.5);}
/* 背景闪烁星点 */
.cs-field::before{content:"";position:absolute;inset:0;background-image:radial-gradient(2px 2px at 20px 30px,#fff,transparent),radial-gradient(1px 1px at 80px 70px,#fff,transparent),radial-gradient(1.5px 1.5px at 140px 120px,#fff,transparent),radial-gradient(1px 1px at 210px 50px,#cde,transparent),radial-gradient(2px 2px at 280px 150px,#fff,transparent),radial-gradient(1px 1px at 350px 90px,#fff,transparent),radial-gradient(1.5px 1.5px at 60px 200px,#def,transparent),radial-gradient(1px 1px at 180px 240px,#fff,transparent),radial-gradient(2px 2px at 320px 220px,#fff,transparent),radial-gradient(1px 1px at 400px 180px,#cde,transparent);background-repeat:repeat;background-size:420px 280px;opacity:.7;animation:cs-twinkle-bg 3s ease-in-out infinite;pointer-events:none;}
@keyframes cs-twinkle-bg{0%,100%{opacity:.45}50%{opacity:.85}}
/* 月亮装饰 */
.cs-field::after{content:"🌙";position:absolute;top:16px;right:24px;font-size:2.2rem;filter:drop-shadow(0 0 12px rgba(255,235,150,.6));opacity:.8;z-index:1;animation:cs-glow 4s ease-in-out infinite;}
@keyframes cs-glow{0%,100%{filter:drop-shadow(0 0 12px rgba(255,235,150,.6))}50%{filter:drop-shadow(0 0 20px rgba(255,235,150,.9))}}
.cs-star{position:absolute;font-size:2.6rem;cursor:pointer;user-select:none;animation:cs-twinkle 1s ease-in-out infinite;filter:drop-shadow(0 0 8px rgba(255,220,80,.85));transition:transform .15s;z-index:3;}
.cs-star:hover{transform:scale(1.2);}
.cs-star--burst{animation:cs-burst .3s ease forwards;}
@keyframes cs-twinkle{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.15) rotate(15deg)}}
@keyframes cs-burst{to{transform:scale(2.4);opacity:0}}
`;
}

export function create(): CatchStarGame {
  return new CatchStarGame();
}
