/* 接球 Ball Catch —— RAF 驱动：球从上方随机位置落下，移动底部接物器接住。
   接住目标数通关；漏掉太多重开本关。
   独特点：经典接物玩法，左右按钮持续移动；落下速度随难度。
   前缀 bcl2-（bcl- 已被别的接球类游戏占用）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

interface Ball {
  el: HTMLDivElement;
  x: number;
  y: number;
  vy: number;
  emoji: string;
}

const BALL_EMOJI = ["⚾", "🎾", "⚽", "🥎", "🍎", "🌟"];
const BOMB_EMOJI = "💣";

export class BallCatchGame extends BaseGame {
  constructor() {
    super("ball-catch");
  }

  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private won = false;
  private field!: HTMLDivElement;
  private catcher!: HTMLDivElement;
  private balls: Ball[] = [];
  private px = 0;
  private W = 0;
  private speed = 0;
  private spawnGap = 0;
  private sinceSpawn = 0;
  private moveSpeed = 320;
  private held = { left: false, right: false };
  private caught = 0;
  private need = 0;
  private missed = 0;
  private missLimit = 0;
  private cleanupBtns: (() => void)[] = [];

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cleanupBtns.forEach((fn) => fn());
    this.cleanupBtns = [];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.balls = [];
    this.over = false;
    this.won = false;
    this.caught = 0;
    this.missed = 0;
    this.sinceSpawn = 0;
    this.held = { left: false, right: false };
    this.cleanupBtns = [];

    this.need =
      this.difficulty === "easy" ? 8 : this.difficulty === "medium" ? 12 : 16;
    this.missLimit =
      this.difficulty === "easy" ? 6 : this.difficulty === "medium" ? 5 : 4;
    this.speed =
      this.difficulty === "easy" ? 1 : this.difficulty === "medium" ? 1.2 : 1.4;
    this.spawnGap =
      this.difficulty === "easy"
        ? 1.0
        : this.difficulty === "medium"
          ? 0.8
          : 0.62;

    const wrap = document.createElement("div");
    wrap.className = "bcl2-wrap";
    const task = document.createElement("div");
    task.className = "bcl2-task";
    task.innerHTML = `接住<b>球</b>！接到 <b id="bcl2-cnt">0 / ${this.need}</b> · 漏 <b id="bcl2-miss">0 / ${this.missLimit}</b>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "bcl2-field";
    this.catcher = document.createElement("div");
    this.catcher.className = "bcl2-catcher";
    this.catcher.innerHTML = `<div class="bcl2-catcher__basket">🧺</div><div class="bcl2-catcher__kid">🧒</div>`;
    this.field.appendChild(this.catcher);
    wrap.appendChild(this.field);

    const controls = document.createElement("div");
    controls.className = "bcl2-controls";
    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "bcl2-btn";
    leftBtn.textContent = "⬅️";
    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "bcl2-btn";
    rightBtn.textContent = "➡️";
    controls.appendChild(leftBtn);
    controls.appendChild(rightBtn);
    wrap.appendChild(controls);
    this.root.appendChild(wrap);

    const hold = (btn: HTMLElement, key: "left" | "right") => {
      const onDown = (e: Event) => {
        e.preventDefault();
        this.held[key] = true;
      };
      const onUp = (e: Event) => {
        e.preventDefault();
        this.held[key] = false;
      };
      btn.addEventListener("pointerdown", onDown);
      btn.addEventListener("pointerup", onUp);
      btn.addEventListener("pointercancel", onUp);
      btn.addEventListener("pointerleave", onUp);
      return () => {
        btn.removeEventListener("pointerdown", onDown);
        btn.removeEventListener("pointerup", onUp);
        btn.removeEventListener("pointercancel", onUp);
        btn.removeEventListener("pointerleave", onUp);
      };
    };
    this.cleanupBtns.push(hold(leftBtn, "left"));
    this.cleanupBtns.push(hold(rightBtn, "right"));

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.W = r.width;
      this.px = r.width / 2;
      this.placeCatcher();
      this.last = performance.now();
      this.loop();
    });
  }

  private placeCatcher(): void {
    this.catcher.style.left = `${this.px}px`;
  }

  private spawnBall(): void {
    const r = this.field.getBoundingClientRect();
    const isBomb = Math.random() < 0.12; // 偶尔出现炸弹（接了算漏）
    const emoji = isBomb ? BOMB_EMOJI : sample(BALL_EMOJI);
    const el = document.createElement("div");
    el.className = "bcl2-ball" + (isBomb ? " bcl2-ball--bomb" : "");
    el.textContent = emoji;
    this.field.appendChild(el);
    this.balls.push({
      el,
      x: randInt(r.width * 0.1, r.width * 0.9),
      y: -24,
      vy: 130 * this.speed,
      emoji,
    });
  }

  private loop = (): void => {
    if (this.over || this.won) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 移动接物器
    let d = 0;
    if (this.held.left) d -= 1;
    if (this.held.right) d += 1;
    this.px += d * this.moveSpeed * dt;
    this.px = Math.max(36, Math.min(this.W - 36, this.px));
    this.placeCatcher();

    // 生成
    this.sinceSpawn += dt;
    if (this.sinceSpawn >= this.spawnGap) {
      this.sinceSpawn = 0;
      this.spawnBall();
    }

    // 球下落 + 碰撞
    const fieldH = this.field.getBoundingClientRect().height;
    const catcherY = fieldH - 50;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i]!;
      b.vy += 200 * dt * this.speed;
      b.y += b.vy * dt;
      b.el.style.left = `${b.x}px`;
      b.el.style.top = `${b.y}px`;
      // 接住判定：接近接物器高度 + x 对齐
      if (
        b.y > catcherY - 18 &&
        b.y < catcherY + 18 &&
        Math.abs(b.x - this.px) < 38
      ) {
        b.el.remove();
        this.balls.splice(i, 1);
        if (b.emoji === BOMB_EMOJI) {
          this.missed++;
          this.updateMiss();
          this.afterMiss();
        } else {
          this.caught++;
          sfxPop();
          const rect = this.catcher.getBoundingClientRect();
          this.onCorrect(rect.left + rect.width / 2, rect.top);
          this.updateCnt();
          if (this.caught >= this.need) {
            this.win();
            return;
          }
        }
        continue;
      }
      if (b.y > fieldH + 40) {
        b.el.remove();
        this.balls.splice(i, 1);
        if (b.emoji !== BOMB_EMOJI) {
          this.missed++;
          this.updateMiss();
          this.afterMiss();
        }
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private updateCnt(): void {
    const c = this.root.querySelector("#bcl2-cnt");
    if (c) c.textContent = `${this.caught} / ${this.need}`;
  }
  private updateMiss(): void {
    const c = this.root.querySelector("#bcl2-miss");
    if (c) c.textContent = `${this.missed} / ${this.missLimit}`;
  }

  private afterMiss(): void {
    if (this.missed >= this.missLimit) {
      this.fail();
    }
  }

  private win(): void {
    if (this.over || this.won) return;
    this.won = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const rect = this.field.getBoundingClientRect();
    this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount, [0, 2]));
      } else {
        this.startRound();
      }
    }, 600);
  }

  private fail(): void {
    if (this.over || this.won) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const paused = this.onWrong();
    if (paused) this.showRest();
    else this.trackTimeout(() => this.startRound(), 800);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🧺",
      variant: "rest",
      body: "漏太多啦，看准再接！",
      primary: {
        text: "再试一次",
        icon: "⚾",
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
    if (document.getElementById("bcl2-style")) return;
    const st = document.createElement("style");
    st.id = "bcl2-style";
    st.textContent = BCL2_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function BCL2_CSS(theme: string): string {
  return `
.bcl2-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;width:min(460px,100%);}
.bcl2-task{font-size:1rem;font-weight:800;color:var(--ink);background:#fff;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
.bcl2-task b{color:${theme};}
.bcl2-field{position:relative;width:100%;height:60vh;min-height:340px;background:radial-gradient(circle at 50% 0%,#fff9e6 0%,#fff 40%,#e8f5e9 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
.bcl2-ball{position:absolute;font-size:1.8rem;line-height:1;transform:translate(-50%,-50%);will-change:top;pointer-events:none;}
.bcl2-ball--bomb{filter:hue-rotate(0deg);}
.bcl2-catcher{position:absolute;bottom:6px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;z-index:5;will-change:left;}
.bcl2-catcher__basket{font-size:2.4rem;line-height:1;filter:drop-shadow(0 3px 4px rgba(0,0,0,.25));}
.bcl2-catcher__kid{font-size:1.6rem;line-height:1;margin-top:-6px;}
.bcl2-controls{display:flex;gap:24px;}
.bcl2-btn{width:84px;height:64px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,#e0f7e9);color:${theme};font-size:1.8rem;font-weight:800;box-shadow:var(--shadow);cursor:pointer;user-select:none;touch-action:none;transition:transform .08s;}
.bcl2-btn:active{transform:scale(.92);}
@media (max-width:380px){.bcl2-btn{width:70px;height:54px;font-size:1.5rem;}.bcl2-catcher__basket{font-size:2rem;}}
`;
}

export function create(): BallCatchGame {
  return new BallCatchGame();
}
