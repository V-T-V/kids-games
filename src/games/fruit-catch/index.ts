/* 接水果 Fruit Catch —— 移动篮子接下落水果，避开炸弹。
   独特点：实时物理下落 + 篮子跟随指针，是持续动作游戏（区别于点击/拖拽型）。
   巧思：果实有重力加速度，接住有粒子；难度=下落速度+炸弹频率。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { bindPointer } from "../../core/input.ts";
import { createRafLoop } from "../../core/loop.ts";
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
  private stop?: () => void;
  private lastSpawn = 0;
  private spawnGap = 900;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private unbind: (() => void) | null = null;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startGame();
  }
  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
    this.unbind?.();
    this.unbind = null;
  }

  private startGame(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
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
    this.stop = createRafLoop(() => this.tick());
  }

  private moveBasket(p: { x: number; y: number }): void {
    const r = this.field.getBoundingClientRect();
    const x = Math.max(30, Math.min(r.width - 30, p.x - r.left));
    this.basket.style.left = `${x}px`;
  }

  private tick = (): void => {
    if (this.over) {
      this.stop?.();
      this.stop = undefined;
      return;
    }
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
    this.stop?.();
    this.stop = undefined;
    const stars = this.score >= 20 ? 3 : this.score >= 10 ? 2 : 1;
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
    if (document.getElementById("fc-style")) return;
    const st = document.createElement("style");
    st.id = "fc-style";
    st.textContent = FC_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function FC_CSS(_theme: string): string {
  return `
.fc-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.fc-bar{display:flex;gap:28px;font-size:1.4rem;font-weight:800;background:linear-gradient(180deg,#fff,#eaf6e8);padding:10px 28px;border-radius:999px;box-shadow:var(--shadow);border:2px solid #bce0b0;}
.fc-field{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#7ec8f0 0%,#aee4ff 22%,#cfe8a8 42%,#a6d57a 68%,#88b058 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow),inset 0 0 0 3px rgba(255,255,255,.4);touch-action:none;cursor:none;}
.fc-field::before{content:"🌳🍎🌳🍊🌳";position:absolute;top:8px;left:0;right:0;font-size:1.6rem;letter-spacing:6px;opacity:.5;z-index:1;pointer-events:none;}
.fc-field::after{content:"🌳🍒🌳🍇🌳";position:absolute;top:30px;left:0;right:0;font-size:1.4rem;letter-spacing:6px;opacity:.4;z-index:1;pointer-events:none;}
.fc-basket{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);font-size:3.6rem;transition:left .08s linear;z-index:5;filter:drop-shadow(0 4px 5px rgba(0,0,0,.35));}
.fc-fruit{position:absolute;font-size:2.4rem;will-change:top;filter:drop-shadow(0 3px 4px rgba(0,0,0,.3));}
.fc-fruit::after{content:"";position:absolute;left:50%;top:-120px;width:2px;height:116px;transform:translateX(-50%);background:repeating-linear-gradient(180deg,rgba(255,255,255,.55) 0 6px,transparent 6px 12px);pointer-events:none;}
`;
}

export function create(): FruitCatchGame {
  return new FruitCatchGame();
}
