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

  protected mount(): void {
    this.injectStyle();
    this.startGame();
  }
  protected unmount(): void {
    cancelAnimationFrame(this.raf);
    if (this.timer) clearInterval(this.timer);
  }

  private startGame(): void {
    this.root.innerHTML = "";
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
    this.finishClear(stars);
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
.cs-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(440px,100%);}
.cs-bar{display:flex;gap:24px;font-size:1.3rem;font-weight:800;background:#fff;padding:8px 24px;border-radius:999px;box-shadow:var(--shadow);}
.cs-field{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#1a1a2e,#16213e);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);}
.cs-star{position:absolute;font-size:2rem;cursor:pointer;user-select:none;animation:cs-twinkle 1s ease-in-out infinite;}
.cs-star--burst{animation:cs-burst .3s ease forwards;}
@keyframes cs-twinkle{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.15) rotate(15deg)}}
@keyframes cs-burst{to{transform:scale(2);opacity:0}}
`;
}

export function create(): CatchStarGame {
  return new CatchStarGame();
}
