/* 忍者跳 Ninja Jump —— 忍者自动向前跑（场景左滚），障碍有高有低：
   矮障碍点一下跳过去；高障碍需要双击/连点触发二段跳越过去。
   独特点：单跳/二段跳双动作判定，锻炼反应节奏。
   巧思：RAF 驱动场景滚动 + 抛物线跳跃；落地窗口宽松，孩子容易成功。
   难度 = 障碍速度 / 间距。通关 = 越过目标障碍数。碰障碍重开。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

interface Obstacle {
  x: number;
  /** 高障碍 = true 需二段跳；矮障碍 = false 单跳即可 */
  tall: boolean;
  cleared: boolean;
  el: HTMLDivElement;
}

export class NinjaJumpGame extends BaseGame {
  constructor() {
    super("ninja-jump");
  }

  private field!: HTMLDivElement;
  private ninja!: HTMLDivElement;
  private obstacles: Obstacle[] = [];
  private jumpY = 0;
  private jumpVy = 0;
  private jumpsLeft = 0; // 当前空中可用的跳跃次数（0=落地，2=起跳后还能二段）
  private onGround = true;
  private score = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private speed = 0;
  private gap = 0;
  private groundY = 0;
  private ninjaX = 0;
  private readonly gravity = 1500;
  private readonly jumpV0 = -560;
  private lastTap = 0;
  private unbind: (() => void) | null = null;

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
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.score = 0;
    this.over = false;
    this.obstacles = [];
    this.jumpY = 0;
    this.jumpVy = 0;
    this.jumpsLeft = 0;
    this.onGround = true;
    this.lastTap = 0;
    this.need =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 10;
    this.speed =
      this.difficulty === "easy"
        ? 150
        : this.difficulty === "medium"
          ? 185
          : 220;
    this.gap =
      this.difficulty === "easy"
        ? 280
        : this.difficulty === "medium"
          ? 240
          : 200;

    const wrap = document.createElement("div");
    wrap.className = "nj-wrap";
    const task = document.createElement("div");
    task.className = "nj-task";
    task.innerHTML = `矮障碍<b>点1下</b>，高障碍<b>连点2下</b>二段跳！越过 <b>${this.need}</b> 个 · <span id="nj-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "nj-field";
    const ground = document.createElement("div");
    ground.className = "nj-ground";
    this.field.appendChild(ground);
    this.ninja = document.createElement("div");
    this.ninja.className = "nj-ninja";
    this.ninja.textContent = "🥷";
    this.field.appendChild(this.ninja);
    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    this.unbind = bindPointer(this.field, { down: () => this.tap() });

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.groundY = r.height - 50;
      this.ninjaX = r.width * 0.28;
      this.placeNinja();
      this.last = performance.now();
      this.loop();
    });
  }

  private placeNinja(): void {
    this.ninja.style.left = `${this.ninjaX}px`;
    this.ninja.style.top = `${this.groundY - 44 - this.jumpY}px`;
  }

  /** 点击：地面起跳 / 空中二段跳。连续两下点（间隔<350ms）直接触发二段跳。 */
  private tap(): void {
    if (this.over) return;
    const now = performance.now();
    const double = now - this.lastTap < 350;
    this.lastTap = now;

    if (this.onGround) {
      this.onGround = false;
      this.jumpVy = this.jumpV0;
      this.jumpsLeft = 1; // 起跳后还能再跳一次
      sfxPop();
      // 如果是双击，立即二段跳（更强）
      if (double) {
        this.jumpVy = this.jumpV0 * 1.15;
        this.jumpsLeft = 0;
      }
    } else if (this.jumpsLeft > 0) {
      // 二段跳
      this.jumpsLeft -= 1;
      this.jumpVy = this.jumpV0 * 1.1;
      sfxPop();
      this.ninja.classList.add("nj-ninja--dbl");
      this.trackTimeout(
        () => this.ninja.classList.remove("nj-ninja--dbl"),
        250,
      );
    }
  }

  private spawnObstacle(): void {
    const tall = Math.random() < 0.5;
    const el = document.createElement("div");
    el.className = tall ? "nj-obs nj-obs--tall" : "nj-obs nj-obs--low";
    el.textContent = tall ? "🏯" : "🪵";
    this.field.appendChild(el);
    const r = this.field.getBoundingClientRect();
    const prev = this.obstacles[this.obstacles.length - 1];
    // 保证间距足够，避免连续障碍无法跳
    const startX = prev
      ? Math.max(r.width + 30, prev.x + this.gap)
      : r.width + 20;
    const h = tall ? 70 : 40;
    el.style.height = `${h}px`;
    this.obstacles.push({ x: startX, tall, cleared: false, el });
    this.layoutObstacle(this.obstacles[this.obstacles.length - 1]!);
  }

  private layoutObstacle(o: Obstacle): void {
    o.el.style.left = `${o.x}px`;
    o.el.style.bottom = `${50}px`;
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 跳跃物理
    if (!this.onGround) {
      this.jumpVy += this.gravity * dt;
      this.jumpY += this.jumpVy * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.jumpVy = 0;
        this.onGround = true;
        this.jumpsLeft = 0;
      }
      this.placeNinja();
    }

    // 障碍滚动
    for (const o of this.obstacles) {
      o.x -= this.speed * dt;
      o.el.style.left = `${o.x}px`;
    }
    const r = this.field.getBoundingClientRect();
    // 生成新障碍
    const last = this.obstacles[this.obstacles.length - 1];
    if (!last || r.width - last.x > this.gap) {
      this.spawnObstacle();
    }
    // 移除离屏
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i]!;
      if (o.x < -60) {
        o.el.remove();
        this.obstacles.splice(i, 1);
      }
    }

    // 碰撞 / 计分
    const ninjaFootX = this.ninjaX + 22;
    const ninjaW = 40;
    for (const o of this.obstacles) {
      const obsW = o.tall ? 56 : 56;
      const overlapX =
        ninjaFootX + ninjaW / 2 > o.x && ninjaFootX - ninjaW / 2 < o.x + obsW;
      // 障碍高度（从地面起）
      const obsH = o.tall ? 70 : 40;
      // 忍者脚的离地高度 = jumpY
      if (overlapX && this.jumpY < obsH - 6) {
        // 撞到障碍
        this.end(o);
        return;
      }
      // 计分：越过障碍
      if (!o.cleared && o.x + obsW < ninjaFootX - ninjaW / 2) {
        o.cleared = true;
        this.score += 1;
        sfxPop();
        const sc = this.root.querySelector("#nj-score");
        if (sc) sc.textContent = `${this.score} / ${this.need}`;
        const or = o.el.getBoundingClientRect();
        this.onCorrect(or.left + or.width / 2, or.top);
        if (this.score >= this.need) {
          this.win();
          return;
        }
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

  private end(o: Obstacle): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ninja.classList.add("nj-ninja--hit");
    o.el.classList.add("nj-obs--hit");
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
      emoji: "🥷",
      variant: "rest",
      body: "撞到障碍啦，高障碍记得连点两下哦～",
      primary: {
        text: "再跑一次",
        icon: "🥷",
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
    if (document.getElementById("nj-style")) return;
    const st = document.createElement("style");
    st.id = "nj-style";
    st.textContent = NJ_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function NJ_CSS(theme: string): string {
  return `
.nj-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.nj-task{font-size:1.08rem;font-weight:800;text-align:center;background:linear-gradient(180deg,#fff,#ffeef0);padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);border:2px solid #ffc4cc;}
.nj-task b{color:${theme};}
.nj-field{position:relative;width:100%;height:62vh;min-height:360px;background:linear-gradient(180deg,#2a1a3e 0%,#5a2a4a 25%,#9a4a7a 55%,#d8788a 80%,#f0b0a8 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow),inset 0 0 0 3px rgba(255,255,255,.35);touch-action:none;cursor:pointer;}
.nj-field::before{content:"🌙";position:absolute;top:18px;right:34px;font-size:2.4rem;filter:drop-shadow(0 0 12px rgba(255,255,255,.55));z-index:1;}
.nj-field::after{content:"🏯";position:absolute;top:26%;right:-10px;font-size:1.8rem;opacity:.45;z-index:1;filter:drop-shadow(0 0 4px rgba(0,0,0,.3));}
.nj-ground{position:absolute;left:0;right:0;bottom:0;height:54px;background:linear-gradient(180deg,#6a5a3a,#3a2a1a);box-shadow:inset 0 3px 0 rgba(255,255,255,.18);z-index:2;}
.nj-ground::before{content:"🌿🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿";position:absolute;top:-12px;left:0;right:0;font-size:1rem;letter-spacing:2px;opacity:.8;}
.nj-ninja{position:absolute;left:28%;font-size:3rem;line-height:1;z-index:5;filter:drop-shadow(0 5px 6px rgba(0,0,0,.5));will-change:top;animation:nj-run .25s ease-in-out infinite alternate;}
@keyframes nj-run{from{transform:translateY(0)}to{transform:translateY(-4px)}}
.nj-ninja--dbl{filter:drop-shadow(0 0 14px ${theme}) brightness(1.3);}
.nj-ninja--hit{animation:nj-hit .6s ease forwards;}
@keyframes nj-hit{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(30px) rotate(70deg);opacity:.5}}
.nj-obs{position:absolute;bottom:50px;font-size:2.6rem;line-height:1;display:flex;align-items:flex-end;justify-content:center;z-index:3;will-change:left;filter:drop-shadow(0 4px 5px rgba(0,0,0,.45));}
.nj-obs--tall{font-size:3rem;filter:drop-shadow(0 5px 7px rgba(0,0,0,.55));}
.nj-obs--hit{animation:nj-flash .4s ease;}
@keyframes nj-flash{0%,100%{filter:none}50%{filter:brightness(1.6) drop-shadow(0 0 12px #ff3b30)}}
@media (max-width:380px){.nj-task{font-size:.95rem;}.nj-ninja{font-size:2.4rem;}.nj-obs{font-size:2.1rem;}.nj-obs--tall{font-size:2.4rem;}}
`;
}

export function create(): NinjaJumpGame {
  return new NinjaJumpGame();
}
