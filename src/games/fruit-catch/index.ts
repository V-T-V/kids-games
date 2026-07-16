/* 接水果 Fruit Catch —— 移动篮子接下落水果，避开炸弹。
   独特点：实时物理下落 + 篮子跟随指针，是持续动作游戏（区别于点击/拖拽型）。
   巧思：果实有重力加速度，接住有粒子；难度=下落速度+炸弹频率。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

const FRUITS = ["🍎", "🍌", "🍇", "🍓", "🍒", "🥝", "🍑"] as const;

interface Falling {
  emoji: string;
  x: number;
  y: number;
  vy: number;
  bomb: boolean;
  el: HTMLElement;
}

export class FruitCatchGame extends BaseGame {
  constructor() {
    super("fruit-catch");
  }
  private field!: HTMLDivElement;
  private basket!: HTMLDivElement;
  private items: Falling[] = [];
  private score = 0;
  private lives = 3;
  private raf = 0;
  private lastSpawn = 0;
  private spawnGap = 900;
  private over = false;
  private unbind: (() => void) | null = null;

  protected mount(): void {
    this.injectStyle();
    this.startGame();
  }
  protected unmount(): void {
    cancelAnimationFrame(this.raf);
    this.unbind?.();
    this.unbind = null;
  }

  private startGame(): void {
    this.root.innerHTML = "";
    this.score = 0;
    this.lives = 3;
    this.over = false;
    this.items = [];
    this.spawnGap =
      this.difficulty === "easy"
        ? 1000
        : this.difficulty === "medium"
          ? 750
          : 550;

    const wrap = document.createElement("div");
    wrap.className = "fc-wrap";
    const bar = document.createElement("div");
    bar.className = "fc-bar";
    bar.innerHTML = `<div id="fc-score">🍎 0</div><div id="fc-lives">❤️❤️❤️</div>`;
    wrap.appendChild(bar);

    this.field = document.createElement("div");
    this.field.className = "fc-field";
    this.basket = document.createElement("div");
    this.basket.className = "fc-basket";
    this.basket.textContent = "🧺";
    this.field.appendChild(this.basket);
    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    this.unbind = bindPointer(this.field, {
      move: (p) => this.moveBasket(p),
      down: (p) => this.moveBasket(p),
    });

    this.lastSpawn = performance.now();
    this.loop();
  }

  private moveBasket(p: { x: number; y: number }): void {
    const r = this.field.getBoundingClientRect();
    const x = Math.max(30, Math.min(r.width - 30, p.x - r.left));
    this.basket.style.left = `${x}px`;
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    if (now - this.lastSpawn > this.spawnGap) {
      this.spawn();
      this.lastSpawn = now;
    }
    const r = this.field.getBoundingClientRect();
    const basketRect = this.basket.getBoundingClientRect();
    const bx = basketRect.left + basketRect.width / 2;
    const by = basketRect.top + 12;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]!;
      it.vy += 0.15;
      it.y += it.vy;
      it.el.style.top = `${it.y}px`;
      // 碰篮子
      const ix = r.left + it.x;
      const iy = r.top + it.y;
      if (iy > by - 10 && iy < by + 30 && Math.abs(ix - bx) < 38) {
        this.catch(it);
        it.el.remove();
        this.items.splice(i, 1);
        continue;
      }
      if (it.y > r.height) {
        if (!it.bomb) this.loseLife();
        it.el.remove();
        this.items.splice(i, 1);
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private spawn(): void {
    const r = this.field.getBoundingClientRect();
    const bomb = Math.random() < (this.difficulty === "hard" ? 0.25 : 0.12);
    const emoji = bomb ? "💣" : sample(FRUITS);
    const el = document.createElement("div");
    el.className = "fc-fruit";
    el.textContent = emoji;
    const x = randInt(20, r.width - 40);
    el.style.left = `${x}px`;
    el.style.top = "-40px";
    this.field.appendChild(el);
    this.items.push({
      emoji,
      x,
      y: -40,
      vy: this.difficulty === "easy" ? 1.5 : 2.5,
      bomb,
      el,
    });
  }

  private catch(it: Falling): void {
    if (it.bomb) {
      this.loseLife();
      return;
    }
    this.score += 1;
    sfxPop();
    const r = this.basket.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top, 8);
    this.resetWrongStreak();
    const sc = this.root.querySelector("#fc-score");
    if (sc) sc.textContent = `🍎 ${this.score}`;
  }

  private loseLife(): void {
    this.lives -= 1;
    const lv = this.root.querySelector("#fc-lives");
    if (lv) lv.textContent = "❤️".repeat(Math.max(0, this.lives)) || "💔";
    if (this.lives <= 0) this.end();
  }

  private end(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    const stars = this.score >= 20 ? 3 : this.score >= 10 ? 2 : 1;
    this.finishClear(stars);
  }

  private injectStyle(): void {
    if (document.getElementById("fc-style")) return;
    const st = document.createElement("style");
    st.id = "fc-style";
    st.textContent = FC_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function FC_CSS(_theme: string): string {
  return `
.fc-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(440px,100%);}
.fc-bar{display:flex;gap:24px;font-size:1.3rem;font-weight:800;background:#fff;padding:8px 24px;border-radius:999px;box-shadow:var(--shadow);}
.fc-field{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#b3e5fc,#e8f5e9);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:none;}
.fc-basket{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:2.8rem;transition:left .08s linear;z-index:5;}
.fc-fruit{position:absolute;font-size:2rem;will-change:top;}
`;
}

export function create(): FruitCatchGame {
  return new FruitCatchGame();
}
