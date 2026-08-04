/* 潜水艇 Submarine —— 潜水艇在水下，按住上浮、松开下沉，躲避水雷和礁石，收集珍珠。
   独特点：垂直控制 + 障碍区分（水雷漂动 / 礁石固定），点击节奏感强。
   视觉：水下渐变场景 + 潜水艇 + 上升气泡 + 水雷/礁石。难度=障碍速度与密度。
   通关 = 收集到目标珍珠数。RAF 驱动，unmount 必须 cancelAnimationFrame。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { randInt, getCssVar } from "../../lobby/util.ts";

interface Obstacle {
  x: number;
  y: number;
  kind: "mine" | "rock";
  el: HTMLDivElement;
  passed: boolean;
}

interface Pearl {
  x: number;
  y: number;
  el: HTMLDivElement;
  taken: boolean;
}

export class SubmarineGame extends BaseGame {
  constructor() {
    super("submarine");
  }

  private field!: HTMLDivElement;
  private sub!: HTMLDivElement;
  private obstacles: Obstacle[] = [];
  private pearls: Pearl[] = [];
  /** 潜水艇 y（px，相对 field 顶部，中心） */
  private sy = 0;
  /** 潜水艇竖直速度（px/s，正向下） */
  private vy = 0;
  private score = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private thrusting = false;
  private speed = 0;
  private spawnX = 0;
  private unbind: (() => void) | null = null;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startGame();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unbind?.();
    this.unbind = null;
  }

  private startGame(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.score = 0;
    this.over = false;
    this.obstacles = [];
    this.pearls = [];
    this.thrusting = false;
    this.need =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 9;
    // 难度：速度越快越难
    this.speed =
      this.difficulty === "easy"
        ? 130
        : this.difficulty === "medium"
          ? 165
          : 205;

    const wrap = document.createElement("div");
    wrap.className = "sub-wrap";
    const task = document.createElement("div");
    task.className = "sub-task";
    task.innerHTML = `按住上浮、松开下潜，收集珍珠 🦪，躲开水雷💣 和礁石🪨！<br><span id="sub-score" class="sub-score">🦪 0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "sub-field";
    this.field.id = "sub-field";

    this.sub = document.createElement("div");
    this.sub.className = "sub-boat";
    this.sub.id = "sub-boat";
    this.sub.textContent = "🚤";
    this.field.appendChild(this.sub);

    // 海底沙地
    const sand = document.createElement("div");
    sand.className = "sub-sand";
    this.field.appendChild(sand);

    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    // 按住上浮 / 松开下潜（pointerdown/up 都绑定在 field 上）
    this.unbind = bindPointer(this.field, {
      down: () => {
        this.thrusting = true;
      },
      up: () => {
        this.thrusting = false;
      },
    });

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.sy = r.height * 0.5;
      this.spawnX = r.width + 40;
      this.vy = 0;
      this.last = performance.now();
      this.loop();
    });
  }

  private spawnObstacle(): void {
    const r = this.field.getBoundingClientRect();
    const kind: "mine" | "rock" = Math.random() < 0.6 ? "mine" : "rock";
    const el = document.createElement("div");
    el.className = `sub-obs sub-obs--${kind}`;
    el.textContent = kind === "mine" ? "💣" : "🪨";
    // 水雷在水面附近、礁石在海底附近，但留出可穿越的中段
    const y =
      kind === "mine"
        ? randInt(r.height * 0.1, r.height * 0.55)
        : randInt(r.height * 0.55, r.height - 60);
    el.style.top = `${y}px`;
    this.field.appendChild(el);
    this.obstacles.push({ x: this.spawnX, y, kind, el, passed: false });
  }

  private spawnPearl(): void {
    const r = this.field.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "sub-pearl";
    el.textContent = "🦪";
    const y = randInt(r.height * 0.2, r.height - 70);
    el.style.top = `${y}px`;
    this.field.appendChild(el);
    this.pearls.push({ x: this.spawnX, y, el, taken: false });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    const r = this.field.getBoundingClientRect();
    const H = r.height;

    // 物理：按住给向上推力，松开重力下沉
    const thrust = this.thrusting ? -560 : 0;
    this.vy += (560 + thrust) * dt; // 重力 560，按住时合力为 0（轻微上浮由负速累积）
    if (this.thrusting) this.vy = Math.min(this.vy, -120); // 按住时至少上浮
    this.vy = Math.max(-380, Math.min(420, this.vy));
    this.sy += this.vy * dt;

    const boatX = 64;
    const boatR = 22;

    // 撞顶/撞底
    if (this.sy < boatR || this.sy > H - boatR - 18) {
      this.sy = Math.max(boatR, Math.min(H - boatR - 18, this.sy));
      this.end();
      return;
    }
    this.sub.style.top = `${this.sy}px`;
    // 俯仰角
    const rot = Math.max(-30, Math.min(45, (this.vy / 480) * 40));
    this.sub.style.transform = `translateY(-50%) rotate(${rot}deg)`;

    // 障碍移动
    for (const o of this.obstacles) {
      o.x -= this.speed * dt;
      o.el.style.left = `${o.x}px`;
    }
    // 珍珠移动
    for (const p of this.pearls) {
      p.x -= this.speed * dt;
      p.el.style.left = `${p.x}px`;
    }

    // 移除离屏的障碍/珍珠
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i]!;
      if (o.x < -50) {
        o.el.remove();
        this.obstacles.splice(i, 1);
      }
    }
    for (let i = this.pearls.length - 1; i >= 0; i--) {
      const p = this.pearls[i]!;
      if (p.x < -50) {
        p.el.remove();
        this.pearls.splice(i, 1);
      }
    }

    // 碰撞：障碍
    for (const o of this.obstacles) {
      const ow = 40;
      const oh = 40;
      if (
        Math.abs(boatX - o.x) < ow / 2 + boatR - 4 &&
        Math.abs(this.sy - (o.y + oh / 2)) < oh / 2 + boatR - 6
      ) {
        this.end();
        return;
      }
    }
    // 碰撞：珍珠（收集）
    for (const p of this.pearls) {
      if (p.taken) continue;
      if (Math.abs(boatX - p.x) < 26 && Math.abs(this.sy - (p.y + 20)) < 26) {
        p.taken = true;
        this.collect(p);
      }
    }

    // 生成：保证珍珠与障碍交替且不重叠在 boatX
    const lastObs = this.obstacles[this.obstacles.length - 1];
    const lastPearl = this.pearls[this.pearls.length - 1];
    const obsGap = this.difficulty === "hard" ? 240 : 300;
    const pearlGap = this.difficulty === "hard" ? 200 : 240;
    if (!lastObs || r.width - lastObs.x > obsGap) {
      // 不要生成得太密
      if (Math.random() < 0.7) this.spawnObstacle();
    }
    if (!lastPearl || r.width - lastPearl.x > pearlGap) {
      this.spawnPearl();
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private collect(p: Pearl): void {
    this.score += 1;
    sfxPop();
    const pr = p.el.getBoundingClientRect();
    this.onCorrect(pr.left + pr.width / 2, pr.top + pr.height / 2);
    this.resetWrongStreak();
    p.el.classList.add("sub-pearl--take");
    this.trackTimeout(() => p.el.remove(), 500);

    const sc = this.root.querySelector("#sub-score");
    if (sc) sc.textContent = `🦪 ${this.score} / ${this.need}`;

    if (this.score >= this.need) {
      this.win();
    }
  }

  private win(): void {
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
        this.startGame();
      }
    }, 600);
  }

  private end(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.sub.classList.add("sub-boat--hit");
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      // 短暂提示后重开本关，保证可通关
      this.trackTimeout(() => this.startGame(), 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌊",
      variant: "rest",
      body: "撞到障碍啦，再潜一次吧～",
      primary: {
        text: "再潜一次",
        icon: "🚤",
        onClick: () => {
          ov.destroy();
          this.startGame();
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
    if (document.getElementById("sub-style")) return;
    const st = document.createElement("style");
    st.id = "sub-style";
    st.textContent = SUB_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function SUB_CSS(theme: string): string {
  return `
.sub-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.sub-task{font-size:1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.sub-score{display:inline-block;margin-top:4px;padding:2px 14px;border-radius:999px;background:#fff;color:${theme};box-shadow:var(--shadow);font-size:.95rem;}
.sub-field{position:relative;width:100%;height:62vh;min-height:360px;background:linear-gradient(180deg,#b3e5fc 0%,#4fc3f7 25%,#0288d1 70%,#01579b 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:pointer;user-select:none;}
.sub-field::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 30%,rgba(255,255,255,.15),transparent 40%);pointer-events:none;z-index:1;}
.sub-boat{position:absolute;left:64px;top:50%;transform:translateY(-50%);font-size:2.4rem;line-height:1;z-index:6;filter:drop-shadow(0 4px 6px rgba(0,0,0,.3));will-change:top,transform;animation:sub-bob .5s ease-in-out infinite alternate;}
@keyframes sub-bob{from{filter:drop-shadow(0 4px 6px rgba(0,0,0,.3))}to{filter:drop-shadow(0 6px 8px rgba(0,0,0,.35))}}
.sub-boat--hit{animation:sub-shake .5s ease;}
@keyframes sub-shake{0%,100%{transform:translateY(-50%) rotate(0)}25%{transform:translateY(-50%) rotate(-12deg)}75%{transform:translateY(-50%) rotate(12deg)}}
.sub-sand{position:absolute;bottom:0;left:0;right:0;height:30px;background:linear-gradient(180deg,#d2b48c,#b8946a);box-shadow:inset 0 3px 0 rgba(255,255,255,.2);z-index:2;}
.sub-obs{position:absolute;font-size:2rem;z-index:4;transform:translateY(0);will-change:left;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3));}
.sub-obs--mine{animation:sub-buoy 1.8s ease-in-out infinite alternate;}
@keyframes sub-buoy{from{transform:translateY(0)}to{transform:translateY(-6px)}}
.sub-pearl{position:absolute;font-size:1.6rem;z-index:3;will-change:left;animation:sub-glow 1.2s ease-in-out infinite alternate;filter:drop-shadow(0 0 4px rgba(255,255,255,.6));}
@keyframes sub-glow{from{transform:scale(1)}to{transform:scale(1.15)}}
.sub-pearl--take{animation:sub-take .5s ease forwards;}
@keyframes sub-take{0%{transform:scale(1)}100%{transform:scale(0) translateY(-20px);opacity:0}}
@media (max-width:380px){.sub-task{font-size:.9rem;}.sub-boat{font-size:2rem;}}
.sub-theme{color:${theme};}
`;
}

export function create(): SubmarineGame {
  return new SubmarineGame();
}
