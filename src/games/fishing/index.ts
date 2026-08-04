/* 钓鱼 Fishing —— 鱼在水下游动，点击鱼竿下钩，钓起指定颜色的鱼。
   独特点：等待时机+移动目标（鱼在游动，区别于即时点击的 catch-star）。
   巧思：钓到对的鱼加分，钓错放回；难度=鱼速+目标颜色。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

interface Fish {
  color: string;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  el: HTMLElement;
}

const FISH_TYPES = [
  { color: "red", emoji: "🐠" },
  { color: "yellow", emoji: "🐡" },
  { color: "blue", emoji: "🐟" },
  { color: "green", emoji: "🐠" },
];

export class FishingGame extends BaseGame {
  constructor() {
    super("fishing");
  }
  private pool!: HTMLDivElement;
  private fishes: Fish[] = [];
  private target = "";
  private score = 0;
  private need = 0;
  private raf = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startRound();
  }
  protected unmount(): void {
    cancelAnimationFrame(this.raf);
  }

  private startRound(): void {
    this.over = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root.innerHTML = "";
    const types = shuffle(FISH_TYPES);
    this.target = types[0]!.color;
    this.score = 0;
    this.need =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.fishes = [];

    const wrap = document.createElement("div");
    wrap.className = "fi-wrap";
    const task = document.createElement("div");
    task.className = "fi-task";
    task.innerHTML = `钓 <span class="fi-target">${types[0]!.emoji}</span> ${this.target === "red" ? "红" : this.target === "yellow" ? "黄" : this.target === "blue" ? "蓝" : "绿"}鱼！<span id="fi-score">${this.score}/${this.need}</span>`;
    wrap.appendChild(task);

    this.pool = document.createElement("div");
    this.pool.className = "fi-pool";
    wrap.appendChild(this.pool);
    this.root.appendChild(wrap);

    // 生成鱼
    const count = this.difficulty === "easy" ? 5 : 7;
    for (let i = 0; i < count; i++) {
      const t = types[i % types.length]!;
      this.spawnFish(t.color, t.emoji);
    }
    this.loop();
  }

  private spawnFish(color: string, emoji: string): void {
    const el = document.createElement("div");
    el.className = "fi-fish";
    el.textContent = emoji;
    const r = this.pool.getBoundingClientRect();
    const w = r.width || 360;
    const h = r.height || 240;
    const x = randInt(10, w - 50);
    const y = randInt(20, h - 50);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const vx =
      (Math.random() < 0.5 ? -1 : 1) * (this.difficulty === "easy" ? 1 : 1.6);
    // 垂直缓慢游动，让鱼自然分散、不互相遮挡
    const vy = (Math.random() - 0.5) * 0.6;
    this.pool.appendChild(el);
    const f: Fish = { color, emoji, x, y, vx, vy, el };
    el.addEventListener("click", () => this.catchFish(f));
    this.fishes.push(f);
  }

  private loop = (): void => {
    const r = this.pool.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    for (const f of this.fishes) {
      f.x += f.vx;
      if (f.x < 0) {
        f.x = 0;
        f.vx *= -1;
        f.el.style.transform = "scaleX(-1)";
      }
      if (f.x > w - 40) {
        f.x = w - 40;
        f.vx *= -1;
        f.el.style.transform = "scaleX(1)";
      }
      // 垂直游动 + 边界反弹（确保鱼始终在可见范围内）
      f.y += f.vy;
      if (f.y < 15 || f.y > h - 45) f.vy *= -1;
      f.el.style.left = `${f.x}px`;
      f.el.style.top = `${f.y}px`;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private catchFish(f: Fish): void {
    // over 守卫：已达标则忽略后续点击，防重复结算
    if (this.over) return;
    const r = f.el.getBoundingClientRect();
    if (f.color === this.target) {
      this.score += 1;
      sfxPop();
      burst(r.left + r.width / 2, r.top + r.height / 2, 10);
      this.resetWrongStreak();
      f.el.remove();
      this.fishes = this.fishes.filter((x) => x !== f);
      const sc = this.root.querySelector("#fi-score");
      if (sc) sc.textContent = `${this.score}/${this.need}`;
      if (this.score >= this.need) {
        this.over = true;
        this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
        this.resetWrongStreak();
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(this.calcStars());
          } else {
            this.startRound();
          }
        }, 700);
      }
    } else {
      f.el.classList.add("fi-fish--escape");
      const paused = this.onWrong();
      this.trackTimeout(() => f.el.classList.remove("fi-fish--escape"), 400);
      if (paused) this.showRest();
    }
  }

  /** 按错钓次数算星：错钓越多星越少。 */
  private calcStars(): number {
    if (this.wrongCount === 0) return 3;
    if (this.wrongCount <= 2) return 2;
    return 1;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看清楚颜色再钓～",
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
    if (document.getElementById("fi-style")) return;
    const st = document.createElement("style");
    st.id = "fi-style";
    st.textContent = FI_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function FI_CSS(_theme: string): string {
  return `
.fi-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.fi-task{font-size:1.1rem;font-weight:800;}
.fi-target{font-size:1.4em;}
.fi-pool{position:relative;width:100%;height:55vh;min-height:300px;background:linear-gradient(180deg,#4fc3f7,#0288d1);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);}
.fi-fish{position:absolute;font-size:2rem;cursor:pointer;user-select:none;transition:transform .3s;}
.fi-fish--escape{animation:fi-shake .4s ease;}
@keyframes fi-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
`;
}

export function create(): FishingGame {
  return new FishingGame();
}
