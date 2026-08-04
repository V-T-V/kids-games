/* 拖竿钓鱼 Fishing Rod —— 水池里有鱼游动，孩子拖动鱼竿（拖拽）到鱼上方，鱼上钩。
   独特点：拖拽玩法（区别于 fishing 的点击），鱼竿跟随指针，鱼线垂直下钩，需精准对位。
   视觉：水池 + 可拖拽鱼竿 + 游动的鱼 + 鱼线。难度=鱼速。通关=钓到目标数。
   使用 bindPointer 实现拖拽鱼竿。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { bindPointer } from "../../core/input.ts";
import { createRafLoop } from "../../core/loop.ts";
import { randInt, sample, getCssVar } from "../../lobby/util.ts";

interface Fish {
  emoji: string;
  x: number;
  y: number;
  vx: number;
  el: HTMLElement;
  caught: boolean;
}

const FISH_EMOJI = ["🐠", "🐡", "🐟"] as const;

export class FishingRodGame extends BaseGame {
  constructor() {
    super("fishing-rod");
  }

  private pool!: HTMLDivElement;
  private rod!: HTMLDivElement;
  private line!: HTMLElement;
  private hook!: HTMLElement;
  private fishes: Fish[] = [];
  private score = 0;
  private need = 0;
  private stop?: () => void;
  private unbind: (() => void) | null = null;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private dragging = false;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startRound();
  }
  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
    this.unbind?.();
    this.unbind = null;
  }

  private fishSpeed(): number {
    return this.difficulty === "easy"
      ? 0.8
      : this.difficulty === "medium"
        ? 1.4
        : 2.2;
  }

  private startRound(): void {
    this.over = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.score = 0;
    this.need =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.fishes = [];
    this.root.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "fr-wrap";

    const task = document.createElement("div");
    task.className = "fr-task";
    task.innerHTML = `拖动鱼竿到鱼上方，钓起 <b>${this.need}</b> 条鱼！<br><span id="fr-score" class="fr-score">🎣 0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.pool = document.createElement("div");
    this.pool.className = "fr-pool";
    this.pool.id = "fr-pool";

    // 鱼竿（在水面之上）
    this.rod = document.createElement("div");
    this.rod.className = "fr-rod";
    this.rod.id = "fr-rod";
    this.rod.textContent = "🎣";
    this.pool.appendChild(this.rod);

    // 鱼线
    this.line = document.createElement("div");
    this.line.className = "fr-line";
    this.line.id = "fr-line";
    this.pool.appendChild(this.line);

    // 鱼钩
    this.hook = document.createElement("div");
    this.hook.className = "fr-hook";
    this.hook.id = "fr-hook";
    this.hook.textContent = "🪝";
    this.pool.appendChild(this.hook);

    wrap.appendChild(this.pool);
    this.root.appendChild(wrap);

    // 生成鱼
    const count =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    // 等池子布局完成
    requestAnimationFrame(() => {
      for (let i = 0; i < count; i++) {
        this.spawnFish();
      }
      // 初始化鱼竿位置（居中）
      const r = this.pool.getBoundingClientRect();
      this.setRod(r.width / 2);
    });

    // 拖拽鱼竿：在整个池子区域拖动
    this.unbind = bindPointer(this.pool, {
      down: (p) => {
        this.dragging = true;
        this.moveRod(p);
      },
      move: (p) => {
        if (this.dragging) this.moveRod(p);
      },
      up: () => {
        this.dragging = false;
      },
    });

    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  private moveRod(p: { x: number; y: number }): void {
    if (this.over) return;
    const r = this.pool.getBoundingClientRect();
    const x = Math.max(20, Math.min(r.width - 20, p.x - r.left));
    this.setRod(x);
  }

  private setRod(x: number): void {
    this.rod.style.left = `${x}px`;
    this.line.style.left = `${x}px`;
    this.hook.style.left = `${x}px`;
  }

  private spawnFish(): void {
    const el = document.createElement("div");
    el.className = "fr-fish";
    const emoji = sample(FISH_EMOJI);
    el.textContent = emoji;
    const r = this.pool.getBoundingClientRect();
    const w = r.width || 360;
    const h = r.height || 280;
    const x = randInt(0, w - 40);
    const y = randInt(h * 0.45, h - 50);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const vx = (Math.random() < 0.5 ? -1 : 1) * this.fishSpeed();
    this.pool.appendChild(el);
    this.fishes.push({ emoji, x, y, vx, el, caught: false });
  }

  private tick = (dt: number): void => {
    if (this.over) {
      this.stop?.();
      this.stop = undefined;
      return;
    }
    void dt;
    const r = this.pool.getBoundingClientRect();
    const w = r.width;
    const hookRect = this.hook.getBoundingClientRect();
    const hx = hookRect.left + hookRect.width / 2;
    const hy = hookRect.top + hookRect.height / 2;

    for (const f of this.fishes) {
      if (f.caught) continue;
      f.x += f.vx;
      if (f.x < 0) {
        f.x = 0;
        f.vx *= -1;
        f.el.style.transform = "scaleX(1)";
      }
      if (f.x > w - 40) {
        f.x = w - 40;
        f.vx *= -1;
        f.el.style.transform = "scaleX(-1)";
      }
      f.el.style.left = `${f.x}px`;
      // 检测鱼钩与鱼碰撞
      const fx = r.left + f.x + 20;
      const fy = r.top + f.y + 20;
      if (Math.abs(fx - hx) < 26 && Math.abs(fy - hy) < 24) {
        this.catch(f);
      }
    }
  };

  private catch(f: Fish): void {
    if (this.over || f.caught) return;
    f.caught = true;
    this.score += 1;
    sfxPop();
    burst(
      f.el.getBoundingClientRect().left + 20,
      f.el.getBoundingClientRect().top + 20,
      10,
    );
    this.resetWrongStreak();
    // 鱼被钓出水面动画
    f.el.classList.add("fr-fish--caught");
    this.trackTimeout(() => {
      f.el.remove();
      this.fishes = this.fishes.filter((x) => x !== f);
      // 补充一条鱼，保持池子里始终有目标
      if (!this.over) this.spawnFish();
    }, 600);

    const sc = this.root.querySelector("#fr-score");
    if (sc) sc.textContent = `🎣 ${this.score} / ${this.need}`;

    if (this.score >= this.need) {
      this.over = true;
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(
            this.wrongCount === 0 ? 3 : this.wrongCount <= 2 ? 2 : 1,
          );
        } else {
          this.startRound();
        }
      }, 700);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("fr-style")) return;
    const st = document.createElement("style");
    st.id = "fr-style";
    st.textContent = FR_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function FR_CSS(theme: string): string {
  return `
.fr-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.fr-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;}
.fr-score{display:inline-block;margin-top:4px;padding:2px 14px;border-radius:999px;background:#fff;color:${theme};box-shadow:var(--shadow);font-size:.95rem;}
.fr-pool{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#b3e5fc 0%,#4fc3f7 30%,#0288d1 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:grab;}
.fr-pool:active{cursor:grabbing;}
.fr-pool::before{content:"";position:absolute;top:28%;left:0;right:0;height:4px;background:rgba(255,255,255,.5);box-shadow:0 -2px 6px rgba(255,255,255,.3);z-index:1;}
.fr-rod{position:absolute;top:6px;left:50%;font-size:2.4rem;z-index:5;transform:translateX(-50%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));pointer-events:none;}
.fr-line{position:absolute;top:30px;left:50%;width:2px;height:0;background:rgba(255,255,255,.7);z-index:4;transform:translateX(-50%);pointer-events:none;}
.fr-hook{position:absolute;top:140px;left:50%;font-size:1.4rem;z-index:4;transform:translateX(-50%);pointer-events:none;}
.fr-fish{position:absolute;font-size:2rem;transition:transform .2s;will-change:left;pointer-events:none;}
.fr-fish--caught{animation:fr-up .6s ease forwards;}
@keyframes fr-up{0%{transform:translateY(0)}100%{transform:translateY(-260px) rotate(-30deg);opacity:0}}
`;
}

export function create(): FishingRodGame {
  return new FishingRodGame();
}
