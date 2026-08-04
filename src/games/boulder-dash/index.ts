/* 躲滚石 Boulder Dash —— 山坡上不断滚下石头，孩子在底部左右移动躲开。
   独特点：斜坡滚动视角 + 左右按钮控制，锻炼方向判断与反应。
   巧思：RAF 驱动石头下落（带加速度），左右按钮持续按住可平滑移动；
   石头生成位置避开角色当前位置留出反应窗口。
   难度 = 石头速度 / 频率。通关 = 坚持目标秒数。碰石头重开。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Boulder {
  x: number;
  y: number;
  vy: number;
  el: HTMLDivElement;
  rot: number;
}

export class BoulderDashGame extends BaseGame {
  constructor() {
    super("boulder-dash");
  }

  private field!: HTMLDivElement;
  private player!: HTMLDivElement;
  private boulders: Boulder[] = [];
  /** 角色 x（field 内 px） */
  private px = 0;
  /** 移动方向：-1 左 / 1 右 / 0 停 */
  private dir = 0;
  private elapsed = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private speed = 0;
  private spawnGap = 0;
  private sinceSpawn = 0;
  private playerY = 0;
  private W = 0;
  private moveSpeed = 0;
  private held = { left: false, right: false };
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
    this.elapsed = 0;
    this.over = false;
    this.boulders = [];
    this.sinceSpawn = 0;
    this.dir = 0;
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
          : 0.65;
    this.moveSpeed = 240;

    const wrap = document.createElement("div");
    wrap.className = "bd-wrap";
    const task = document.createElement("div");
    task.className = "bd-task";
    task.innerHTML = `按 ⬅️ ➡️ 躲开滚石！坚持 <b>${this.need}</b> 秒 · <span id="bd-time">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "bd-field";
    this.player = document.createElement("div");
    this.player.className = "bd-player";
    this.player.textContent = "🧒";
    this.field.appendChild(this.player);
    wrap.appendChild(this.field);

    // 控制按钮
    const controls = document.createElement("div");
    controls.className = "bd-controls";
    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "bd-btn bd-btn--left";
    leftBtn.textContent = "⬅️ 左";
    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "bd-btn bd-btn--right";
    rightBtn.textContent = "➡️ 右";
    controls.appendChild(leftBtn);
    controls.appendChild(rightBtn);
    wrap.appendChild(controls);
    this.root.appendChild(wrap);

    // 按住持续移动
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
      this.playerY = r.height - 46;
      this.placePlayer();
      this.last = performance.now();
      this.loop();
    });
  }

  private placePlayer(): void {
    this.player.style.left = `${this.px}px`;
    this.player.style.top = `${this.playerY}px`;
  }

  private spawnBoulder(): void {
    const r = this.field.getBoundingClientRect();
    // 生成 x：避开角色当前位置 ±60，留出反应窗口
    let x: number;
    let tries = 0;
    do {
      x = randInt(r.width * 0.1, r.width * 0.9);
      tries++;
    } while (Math.abs(x - this.px) < 60 && tries < 6);
    const el = document.createElement("div");
    el.className = "bd-boulder";
    el.textContent = "🪨";
    this.field.appendChild(el);
    this.boulders.push({
      x,
      y: -20,
      vy: 120 * this.speed,
      el,
      rot: randInt(0, 360),
    });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 计时
    this.elapsed += dt;
    const t = this.root.querySelector("#bd-time");
    if (t) t.textContent = `${Math.floor(this.elapsed)} / ${this.need}`;
    if (this.elapsed >= this.need) {
      this.win();
      return;
    }

    // 角色移动
    let d = 0;
    if (this.held.left) d -= 1;
    if (this.held.right) d += 1;
    this.px += d * this.moveSpeed * dt;
    this.px = Math.max(24, Math.min(this.W - 24, this.px));
    this.placePlayer();

    // 生成石头
    this.sinceSpawn += dt;
    if (this.sinceSpawn >= this.spawnGap) {
      this.sinceSpawn = 0;
      this.spawnBoulder();
    }

    // 石头下落（带加速度，模拟滚下坡）
    const fieldH = this.field.getBoundingClientRect().height;
    for (let i = this.boulders.length - 1; i >= 0; i--) {
      const b = this.boulders[i]!;
      b.vy += 380 * dt * this.speed;
      b.y += b.vy * dt;
      b.rot += b.vy * dt * 0.5;
      b.el.style.left = `${b.x}px`;
      b.el.style.top = `${b.y}px`;
      b.el.style.transform = `translate(-50%,-50%) rotate(${b.rot}deg)`;

      // 碰撞：石头接近角色高度时 x 重合
      const collideY = b.y > this.playerY - 18 && b.y < this.playerY + 18;
      const collideX = Math.abs(b.x - this.px) < 28;
      if (collideY && collideX) {
        this.end(b);
        return;
      }

      // 出底部移除
      if (b.y > fieldH + 40) {
        b.el.remove();
        this.boulders.splice(i, 1);
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
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

  private end(b: Boulder): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    b.el.classList.add("bd-boulder--hit");
    this.player.classList.add("bd-player--hit");
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
      emoji: "🪨",
      variant: "rest",
      body: "被石头撞到啦，看准再躲开～",
      primary: {
        text: "再躲一次",
        icon: "🧒",
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
    if (document.getElementById("bd-style")) return;
    const st = document.createElement("style");
    st.id = "bd-style";
    st.textContent = BD_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function BD_CSS(theme: string): string {
  return `
.bd-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.bd-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.bd-field{position:relative;width:100%;height:58vh;min-height:340px;background:linear-gradient(180deg,#87ceeb 0%,#b8e0a8 45%,#7a6a4a 75%,#5a4a2a 100%);border-radius:20px 20px 8px 8px;overflow:hidden;box-shadow:var(--shadow);}
.bd-field::before{content:"⛰️";position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:3rem;filter:drop-shadow(0 4px 4px rgba(0,0,0,.2));z-index:1;}
.bd-field::after{content:"";position:absolute;left:0;right:0;bottom:0;height:40px;background:linear-gradient(180deg,#6a5a3a,#4a3a1a);z-index:1;}
.bd-player{position:absolute;left:50%;font-size:2.4rem;line-height:1;transform:translateX(-50%);z-index:5;filter:drop-shadow(0 4px 4px rgba(0,0,0,.3));will-change:left;}
.bd-player--hit{animation:bd-hit .5s ease;}
@keyframes bd-hit{0%,100%{filter:none}50%{filter:brightness(1.5) drop-shadow(0 0 10px #ff3b30)}}
.bd-boulder{position:absolute;left:0;top:0;font-size:2.2rem;line-height:1;transform:translate(-50%,-50%);z-index:4;filter:drop-shadow(0 3px 3px rgba(0,0,0,.35));will-change:top,transform;pointer-events:none;}
.bd-boulder--hit{animation:bd-flash .4s ease;}
@keyframes bd-flash{0%,100%{filter:none}50%{filter:brightness(1.6) drop-shadow(0 0 12px ${theme})}}
.bd-controls{display:flex;gap:24px;width:100%;justify-content:center;}
.bd-btn{font-size:1.3rem;font-weight:800;padding:16px 32px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,#e8e8e8);box-shadow:var(--shadow);cursor:pointer;user-select:none;touch-action:none;color:${theme};transition:transform .08s;}
.bd-btn:active{transform:scale(.94);background:linear-gradient(180deg,#e8e8e8,#d8d8d8);}
@media (max-width:380px){.bd-task{font-size:.95rem;}.bd-player{font-size:2rem;}.bd-boulder{font-size:1.8rem;}.bd-btn{font-size:1.1rem;padding:14px 24px;}}
`;
}

export function create(): BoulderDashGame {
  return new BoulderDashGame();
}
