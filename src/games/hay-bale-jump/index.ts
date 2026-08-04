/* 干草跳 Hay Bale Jump —— 角色在田野上向右跑，干草垛从右边滑来，
   点屏幕/按按钮跳过草垛。碰到草垛重开本轮。
   独特点：RAF 驱动的横向卷轴 + 单键跳跃（带重力），锻炼时机判断。
   视觉：天空+田野远景 + 角色 + 干草垛 + 滚动地面纹理。
   难度=滚动速度。通关=累计跳过目标数量。前缀 hbj-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByScore } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Bale {
  x: number;
  el: HTMLDivElement;
  passed: boolean;
}

export class HayBaleJumpGame extends BaseGame {
  constructor() {
    super("hay-bale-jump");
  }

  private field!: HTMLDivElement;
  private player!: HTMLDivElement;
  private bales: Bale[] = [];
  /** 角色 x（固定） */
  private px = 0;
  /** 角色 y（地面=0，向上为正） */
  private py = 0;
  /** 垂直速度 */
  private vy = 0;
  private onGround = true;
  private scrolling = 0;
  private speed = 0;
  private sinceSpawn = 0;
  private spawnGap = 0;
  private jumped = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private W = 0;
  private groundY = 0;
  private readonly gravity = 2200;
  private readonly jumpV = 720;
  private cleanups: (() => void)[] = [];

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
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.bales = [];
    this.py = 0;
    this.vy = 0;
    this.onGround = true;
    this.scrolling = 0;
    this.sinceSpawn = 0;
    this.jumped = 0;
    this.over = false;
    this.need =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 10;
    this.speed =
      this.difficulty === "easy"
        ? 180
        : this.difficulty === "medium"
          ? 230
          : 290;
    this.spawnGap =
      this.difficulty === "easy"
        ? 1.7
        : this.difficulty === "medium"
          ? 1.4
          : 1.15;

    const wrap = document.createElement("div");
    wrap.className = "hbj-wrap";
    const task = document.createElement("div");
    task.className = "hbj-task";
    task.innerHTML = `点屏幕或按 <b>跳</b> 跳过草垛！跳过 <b>${this.need}</b> 个 · <span id="hbj-count">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "hbj-field";
    // 远景云朵装饰
    for (let i = 0; i < 3; i++) {
      const c = document.createElement("div");
      c.className = "hbj-cloud";
      c.textContent = "☁️";
      c.style.left = `${randInt(10, 80)}%`;
      c.style.top = `${randInt(8, 30)}%`;
      c.style.fontSize = `${randInt(18, 30)}px`;
      this.field.appendChild(c);
    }
    // 地面（草地 + 滚动条纹）
    const ground = document.createElement("div");
    ground.className = "hbj-ground";
    ground.innerHTML = `<div class="hbj-ground-line"></div>`;
    this.field.appendChild(ground);

    this.player = document.createElement("div");
    this.player.className = "hbj-player";
    this.player.textContent = "🐰";
    this.field.appendChild(this.player);
    wrap.appendChild(this.field);

    const jumpBtn = document.createElement("button");
    jumpBtn.type = "button";
    jumpBtn.className = "hbj-jump-btn";
    jumpBtn.textContent = "⬆️ 跳";
    wrap.appendChild(jumpBtn);
    this.root.appendChild(wrap);

    // 跳跃绑定：按钮 + 整个 field
    const doJump = (e: Event) => {
      e.preventDefault();
      this.jump();
    };
    jumpBtn.addEventListener("pointerdown", doJump);
    this.field.addEventListener("pointerdown", doJump);
    this.cleanups.push(() => {
      jumpBtn.removeEventListener("pointerdown", doJump);
      this.field.removeEventListener("pointerdown", doJump);
    });

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.W = r.width;
      this.groundY = r.height - 48;
      this.px = Math.max(60, r.width * 0.22);
      this.placePlayer();
      this.last = performance.now();
      this.loop();
    });
  }

  private jump(): void {
    if (this.over) return;
    if (this.onGround) {
      this.vy = this.jumpV;
      this.onGround = false;
    }
  }

  private placePlayer(): void {
    this.player.style.left = `${this.px}px`;
    this.player.style.bottom = `${48 + this.py}px`;
  }

  private spawnBale(): void {
    const el = document.createElement("div");
    el.className = "hbj-bale";
    el.textContent = "🌾";
    this.field.appendChild(el);
    this.bales.push({ x: this.W + 30, el, passed: false });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 重力 + 跳跃
    if (!this.onGround) {
      this.vy -= this.gravity * dt;
      this.py += this.vy * dt;
      if (this.py <= 0) {
        this.py = 0;
        this.vy = 0;
        this.onGround = true;
      }
    }
    this.placePlayer();

    // 生成草垛
    this.sinceSpawn += dt;
    if (this.sinceSpawn >= this.spawnGap) {
      this.sinceSpawn = 0;
      this.spawnBale();
    }

    // 移动草垛
    for (let i = this.bales.length - 1; i >= 0; i--) {
      const b = this.bales[i]!;
      b.x -= this.speed * dt;
      b.el.style.left = `${b.x}px`;
      // 跳过判定：草垛越过角色 x 且未被记
      if (!b.passed && b.x < this.px - 30) {
        b.passed = true;
        this.jumped += 1;
        this.resetWrongStreak();
        const cnt = this.root.querySelector("#hbj-count");
        if (cnt) cnt.textContent = `${this.jumped} / ${this.need}`;
        if (this.jumped >= this.need) {
          this.win();
          return;
        }
      }
      // 碰撞：草垛在角色脚下区域且未跳起
      const inX = b.x > this.px - 36 && b.x < this.px + 30;
      const hit = inX && this.py < 30;
      if (hit) {
        this.crash(b);
        return;
      }
      // 移除越界
      if (b.x < -60) {
        b.el.remove();
        this.bales.splice(i, 1);
      }
    }

    // 滚动地面纹理
    this.scrolling = (this.scrolling + this.speed * dt) % 40;
    const line = this.field.querySelector(
      ".hbj-ground-line",
    ) as HTMLDivElement | null;
    if (line) line.style.backgroundPositionX = `${-this.scrolling}px`;

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
        this.finishClear(starsByScore(this.jumped, [this.need, Math.ceil(this.need / 2)]),);
      } else {
        this.startRound();
      }
    }, 600);
  }

  private crash(b: Bale): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    b.el.classList.add("hbj-bale--hit");
    this.player.classList.add("hbj-player--hit");
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
      emoji: "🌾",
      variant: "rest",
      body: "看到草垛靠近就早点跳起来～",
      primary: {
        text: "再跳一次",
        icon: "🐰",
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
    if (document.getElementById("hbj-style")) return;
    const st = document.createElement("style");
    st.id = "hbj-style";
    st.textContent = HBJ_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function HBJ_CSS(theme: string): string {
  return `
.hbj-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(520px,100%);}
.hbj-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.hbj-field{position:relative;width:100%;height:58vh;min-height:320px;background:linear-gradient(180deg,#87ceeb 0%,#b8e0f5 40%,#a8d98a 60%,#7ab058 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);cursor:pointer;touch-action:manipulation;}
.hbj-cloud{position:absolute;color:#fff;opacity:.9;z-index:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.1));pointer-events:none;}
.hbj-ground{position:absolute;left:0;right:0;bottom:0;height:48px;background:linear-gradient(180deg,#7ab058,#5a8a3a);z-index:2;}
.hbj-ground-line{position:absolute;left:0;right:0;top:6px;height:4px;background:repeating-linear-gradient(90deg,#3a6a2a 0 14px,transparent 14px 40px);}
.hbj-player{position:absolute;font-size:2.6rem;line-height:1;z-index:5;filter:drop-shadow(0 4px 4px rgba(0,0,0,.3));will-change:bottom;}
.hbj-player--hit{animation:hbj-hit .5s ease;}
@keyframes hbj-hit{0%,100%{filter:none}50%{filter:brightness(1.5) drop-shadow(0 0 10px #ff3b30)}}
.hbj-bale{position:absolute;bottom:48px;font-size:2.6rem;line-height:1;z-index:4;filter:drop-shadow(0 3px 3px rgba(0,0,0,.3));will-change:left;pointer-events:none;}
.hbj-bale--hit{animation:hbj-flash .4s ease;}
@keyframes hbj-flash{0%,100%{filter:none}50%{filter:brightness(1.6) drop-shadow(0 0 12px ${theme})}}
.hbj-jump-btn{font-size:1.3rem;font-weight:800;padding:18px 48px;border:none;border-radius:22px;background:linear-gradient(180deg,#fff,${theme}44);color:#5a4a10;box-shadow:0 5px 0 rgba(0,0,0,.12),0 8px 12px rgba(0,0,0,.12);cursor:pointer;user-select:none;touch-action:none;transition:transform .08s;}
.hbj-jump-btn:active{transform:translateY(4px);}
@media (max-width:380px){.hbj-task{font-size:.95rem;}.hbj-player{font-size:2.2rem;}.hbj-bale{font-size:2.2rem;}.hbj-jump-btn{font-size:1.1rem;padding:14px 32px;}}
`;
}

export function create(): HayBaleJumpGame {
  return new HayBaleJumpGame();
}
