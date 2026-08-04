/* 躲陨石 Asteroid Dodge —— 飞船在屏幕底部，陨石从上方落下，
   按 ⬅️ ➡️ 移动飞船躲开。碰陨石重开本关。
   独特点：陨石下落 + 左右按钮持续移动；生成位置避开飞船当前 x 留反应窗口；
   每躲过若干个陨石/坚持目标秒数即通关。用 RAF 驱动。
   视觉：星空 + 飞船 + 陨石（带尾焰旋转）。难度 = 陨石频率。通关 = 坚持目标秒数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { randInt, getCssVar } from "../../lobby/util.ts";

interface Asteroid {
  el: HTMLDivElement;
  x: number;
  y: number;
  vy: number;
  rot: number;
}

export class AsteroidDodgeGame extends BaseGame {
  constructor() {
    super("asteroid-dodge");
  }

  private field!: HTMLDivElement;
  private ship!: HTMLDivElement;
  private asteroids: Asteroid[] = [];
  private px = 0;
  private shipY = 0;
  private W = 0;
  private held = { left: false, right: false };
  private cleanupBtns: (() => void)[] = [];
  private elapsed = 0;
  private need = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private speed = 0;
  private spawnGap = 0;
  private sinceSpawn = 0;
  private moveSpeed = 260;
  private raf = 0;
  private last = 0;
  private over = false;

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
    this.elapsed = 0;
    this.over = false;
    this.asteroids = [];
    this.sinceSpawn = 0;
    this.held = { left: false, right: false };
    this.cleanupBtns = [];

    this.need =
      this.difficulty === "easy" ? 12 : this.difficulty === "medium" ? 16 : 22;
    this.speed =
      this.difficulty === "easy"
        ? 1
        : this.difficulty === "medium"
          ? 1.2
          : 1.45;
    this.spawnGap =
      this.difficulty === "easy"
        ? 1.1
        : this.difficulty === "medium"
          ? 0.85
          : 0.62;

    const wrap = document.createElement("div");
    wrap.className = "asd-wrap";
    const task = document.createElement("div");
    task.className = "asd-task";
    task.innerHTML = `按 ⬅️ ➡️ 躲开陨石！坚持 <b>${this.need}</b> 秒（第 ${this.roundsDone + 1}/${this.roundTotal} 关）· <span id="asd-time">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "asd-field";
    this.ship = document.createElement("div");
    this.ship.className = "asd-ship";
    this.ship.textContent = "🚀";
    this.field.appendChild(this.ship);
    wrap.appendChild(this.field);

    const controls = document.createElement("div");
    controls.className = "asd-controls";
    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "asd-btn";
    leftBtn.textContent = "⬅️";
    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "asd-btn";
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
      this.shipY = r.height - 46;
      this.placeShip();
      this.last = performance.now();
      this.loop();
    });
  }

  private placeShip(): void {
    this.ship.style.left = `${this.px}px`;
    this.ship.style.top = `${this.shipY}px`;
  }

  private spawnAsteroid(): void {
    const r = this.field.getBoundingClientRect();
    /* 生成 x：避开飞船当前位置 ±60 */
    let x: number;
    let tries = 0;
    do {
      x = randInt(r.width * 0.1, r.width * 0.9);
      tries++;
    } while (Math.abs(x - this.px) < 60 && tries < 6);
    const el = document.createElement("div");
    el.className = "asd-rock";
    const kind = randInt(0, 2);
    el.textContent = kind === 0 ? "☄️" : kind === 1 ? "🪨" : "🌑";
    this.field.appendChild(el);
    this.asteroids.push({
      el,
      x,
      y: -24,
      vy: 130 * this.speed,
      rot: randInt(0, 360),
    });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    /* 计时 */
    this.elapsed += dt;
    const t = this.root.querySelector("#asd-time");
    if (t) t.textContent = `${Math.floor(this.elapsed)} / ${this.need}`;
    if (this.elapsed >= this.need) {
      this.win();
      return;
    }

    /* 飞船移动 */
    let d = 0;
    if (this.held.left) d -= 1;
    if (this.held.right) d += 1;
    this.px += d * this.moveSpeed * dt;
    this.px = Math.max(26, Math.min(this.W - 26, this.px));
    this.placeShip();

    /* 生成陨石 */
    this.sinceSpawn += dt;
    if (this.sinceSpawn >= this.spawnGap) {
      this.sinceSpawn = 0;
      this.spawnAsteroid();
    }

    /* 陨石下落 */
    const fieldH = this.field.getBoundingClientRect().height;
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const a = this.asteroids[i]!;
      a.vy += 300 * dt * this.speed;
      a.y += a.vy * dt;
      a.rot += a.vy * dt * 0.4;
      a.el.style.left = `${a.x}px`;
      a.el.style.top = `${a.y}px`;
      a.el.style.transform = `translate(-50%,-50%) rotate(${a.rot}deg)`;

      /* 碰撞 */
      const collideY = a.y > this.shipY - 20 && a.y < this.shipY + 20;
      const collideX = Math.abs(a.x - this.px) < 28;
      if (collideY && collideX) {
        this.hit(a);
        return;
      }
      if (a.y > fieldH + 40) {
        a.el.remove();
        this.asteroids.splice(i, 1);
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const r = this.field.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
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

  private hit(a: Asteroid): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    a.el.classList.add("asd-rock--hit");
    this.ship.classList.add("asd-ship--hit");
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      this.trackTimeout(() => this.startRound(), 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🚀",
      variant: "rest",
      body: "被陨石撞到啦，看准再躲开～",
      primary: {
        text: "再躲一次",
        icon: "🚀",
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
    if (document.getElementById("asd-style")) return;
    const st = document.createElement("style");
    st.id = "asd-style";
    st.textContent = ASD_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function ASD_CSS(theme: string): string {
  return `
.asd-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.asd-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.asd-field{position:relative;width:100%;height:62vh;min-height:360px;background:radial-gradient(circle at 50% 0%,#1a1a4a 0%,#0a0a2e 50%,#050518 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
.asd-field::before{content:"";position:absolute;inset:0;background-image:radial-gradient(1px 1px at 10% 15%,#fff,transparent),radial-gradient(1px 1px at 25% 40%,#fff,transparent),radial-gradient(2px 2px at 60% 20%,#fff,transparent),radial-gradient(1px 1px at 80% 50%,#fff,transparent),radial-gradient(1px 1px at 45% 65%,#fff,transparent),radial-gradient(1px 1px at 90% 25%,#fff,transparent),radial-gradient(1px 1px at 15% 80%,#fff,transparent);opacity:.7;pointer-events:none;}
.asd-ship{position:absolute;font-size:2.4rem;line-height:1;transform:translateX(-50%);z-index:5;filter:drop-shadow(0 4px 5px rgba(0,0,0,.4));will-change:left;animation:asd-thrust .2s ease-in-out infinite alternate;}
@keyframes asd-thrust{from{transform:translateX(-50%) translateY(0)}to{transform:translateX(-50%) translateY(-2px)}}
.asd-ship--hit{animation:asd-shake .5s ease;}
@keyframes asd-shake{0%,100%{transform:translateX(-50%) rotate(0)}25%{transform:translateX(-50%) rotate(-18deg)}75%{transform:translateX(-50%) rotate(18deg)}}
.asd-rock{position:absolute;font-size:2.2rem;line-height:1;transform:translate(-50%,-50%);z-index:4;filter:drop-shadow(0 3px 4px rgba(0,0,0,.5));will-change:top,transform;pointer-events:none;}
.asd-rock--hit{animation:asd-flash .4s ease;}
@keyframes asd-flash{0%,100%{filter:none}50%{filter:brightness(1.7) drop-shadow(0 0 14px ${theme})}}
.asd-controls{display:flex;gap:24px;width:100%;justify-content:center;}
.asd-btn{font-size:1.8rem;font-weight:800;width:88px;height:64px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,#ffe8e0);box-shadow:var(--shadow);cursor:pointer;user-select:none;touch-action:none;color:${theme};transition:transform .08s;}
.asd-btn:active{transform:scale(.92);background:linear-gradient(180deg,#ffe8e0,#ffd0c0);}
@media (max-width:380px){.asd-ship{font-size:2rem;}.asd-rock{font-size:1.8rem;}.asd-btn{width:72px;height:56px;font-size:1.5rem;}}
`;
}

export function create(): AsteroidDodgeGame {
  return new AsteroidDodgeGame();
}
