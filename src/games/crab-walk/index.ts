/* 螃蟹横走 Crab Walk —— 螃蟹只能左右横走（贴着底部），
   障碍（贝壳/海胆/水母）从上方落下，按 左/右 按钮移动螃蟹躲避。
   独特点：横走是螃蟹的天性，只能左右不能上下，方向控制训练。
   通关 = 坚持目标秒数。碰障碍重开本关。
   RAF 驱动，unmount 必须 cancelAnimationFrame。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface Fall {
  x: number;
  y: number;
  el: HTMLDivElement;
  hit: boolean;
}

const OBSTACLES = ["🐚", "🪸", "🦑", "🐡", "🪼"] as const;

export class CrabWalkGame extends BaseGame {
  constructor() {
    super("crab-walk");
  }

  private field!: HTMLDivElement;
  private crab!: HTMLDivElement;
  private falls: Fall[] = [];
  private crabX = 0.5; // 0..1
  private crabTarget = 0.5;
  private fieldW = 0;
  private survivedMs = 0;
  private goalMs = 0;
  private speed = 0;
  private spawnEvery = 0;
  private spawnAcc = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private cleared = false;
  private waveOff = 0;

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
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.falls = [];
    this.survivedMs = 0;
    this.spawnAcc = 0;
    this.over = false;
    this.cleared = false;
    this.crabX = 0.5;
    this.crabTarget = 0.5;
    this.goalMs =
      this.difficulty === "easy"
        ? 18000
        : this.difficulty === "medium"
          ? 24000
          : 30000;
    this.speed =
      this.difficulty === "easy"
        ? 120
        : this.difficulty === "medium"
          ? 165
          : 210;
    this.spawnEvery =
      this.difficulty === "easy"
        ? 900
        : this.difficulty === "medium"
          ? 700
          : 520;

    const wrap = document.createElement("div");
    wrap.className = "cw-wrap";

    const task = document.createElement("div");
    task.className = "cw-task";
    task.innerHTML = `按 <b>←</b> <b>→</b> 让螃蟹横走，躲开掉下来的东西！<br><span id="cw-time">还剩 ${Math.ceil(this.goalMs / 1000)} 秒</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "cw-field";

    const sand = document.createElement("div");
    sand.className = "cw-sand";
    this.field.appendChild(sand);

    this.crab = document.createElement("div");
    this.crab.className = "cw-crab";
    this.crab.textContent = "🦀";
    this.field.appendChild(this.crab);

    wrap.appendChild(this.field);

    const ctrls = document.createElement("div");
    ctrls.className = "cw-ctrls";
    const left = document.createElement("button");
    left.type = "button";
    left.className = "cw-btn cw-btn--left";
    left.innerHTML = "◀ 左";
    const right = document.createElement("button");
    right.type = "button";
    right.className = "cw-btn cw-btn--right";
    right.innerHTML = "右 ▶";
    left.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.move(-1);
    });
    right.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.move(1);
    });
    ctrls.appendChild(left);
    ctrls.appendChild(right);
    wrap.appendChild(ctrls);

    this.root.appendChild(wrap);

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.fieldW = r.width;
      this.crab.style.left = `${this.crabX * this.fieldW}px`;
      this.last = performance.now();
      this.loop();
    });
  }

  private move(dir: number): void {
    if (this.over || this.cleared) return;
    this.crabTarget = Math.max(
      0.1,
      Math.min(0.9, this.crabTarget + dir * 0.22),
    );
    this.resetWrongStreak();
  }

  private spawnFall(): void {
    const el = document.createElement("div");
    el.className = "cw-fall";
    el.textContent = sample(OBSTACLES);
    const x = 30 + Math.random() * (this.fieldW - 60);
    el.style.left = `${x}px`;
    el.style.top = `-40px`;
    this.field.appendChild(el);
    this.falls.push({ x, y: -40, el, hit: false });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    this.survivedMs += dt * 1000;
    // 螃蟹平滑跟随目标
    this.crabX += (this.crabTarget - this.crabX) * Math.min(1, dt * 12);
    this.crab.style.left = `${this.crabX * this.fieldW}px`;

    // 水波动画偏移
    this.waveOff = (this.waveOff + dt * 30) % 80;
    this.field.style.setProperty("--cw-wave", `${this.waveOff}px`);

    // 生成
    this.spawnAcc += dt * 1000;
    if (this.spawnAcc >= this.spawnEvery) {
      this.spawnAcc = 0;
      this.spawnFall();
      // 困难度更高时偶尔双连发，但保证两障碍不在同一列（可解）
      if (this.difficulty !== "easy" && Math.random() < 0.3) {
        const f = this.falls[this.falls.length - 1]!;
        this.spawnFall();
        const f2 = this.falls[this.falls.length - 1]!;
        // 若两障碍 x 太近，把后一个挪开，保证可通过
        if (Math.abs(f2.x - f.x) < 90) {
          f2.x = (f.x + this.fieldW / 2) % this.fieldW;
          f2.el.style.left = `${f2.x}px`;
        }
      }
    }

    const fieldH = this.field.getBoundingClientRect().height;
    const groundLine = fieldH - 70;
    const crabSize = 40;

    // 下落 + 碰撞
    for (const f of this.falls) {
      f.y += this.speed * dt;
      f.el.style.top = `${f.y}px`;
      if (!f.hit) {
        const dx = Math.abs(f.x - this.crabX * this.fieldW);
        // 碰撞：障碍接近地面且与螃蟹重叠
        if (f.y > groundLine - crabSize && dx < crabSize) {
          f.hit = true;
          this.hit();
          return;
        }
      }
    }
    // 清理已落地的（穿过沙地）
    for (let i = this.falls.length - 1; i >= 0; i--) {
      const f = this.falls[i]!;
      if (f.y > fieldH + 20) {
        f.el.remove();
        this.falls.splice(i, 1);
      }
    }

    // 倒计时显示
    const leftSec = Math.max(
      0,
      Math.ceil((this.goalMs - this.survivedMs) / 1000),
    );
    const tEl = this.root.querySelector("#cw-time");
    if (tEl) tEl.textContent = `还剩 ${leftSec} 秒`;

    if (this.survivedMs >= this.goalMs) {
      this.win();
      return;
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    this.cleared = true;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    sfxPop();
    this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(
          starsByScore(Math.round(this.goalMs / 1000), [
            Math.round(this.goalMs / 1000),
            Math.round(this.goalMs / 1000),
          ]),
        );
      } else {
        this.startRound();
      }
    }, 600);
  }

  private hit(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.crab.classList.add("cw-crab--hit");
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
      emoji: "🌙",
      variant: "rest",
      body: "螃蟹被砸到啦，左右横走躲开哦～",
      primary: {
        text: "再来一次",
        icon: "🦀",
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
    if (document.getElementById("cw-style")) return;
    const st = document.createElement("style");
    st.id = "cw-style";
    st.textContent = CW_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function CW_CSS(theme: string): string {
  return `
.cw-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.cw-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.cw-task b{color:${theme};}
.cw-field{position:relative;width:100%;height:58vh;min-height:340px;background:linear-gradient(180deg,#7ec8f0 0%,#3aa7d6 60%,#2a86b8 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
.cw-field::before{content:"";position:absolute;left:var(--cw-wave,0);top:0;height:6px;width:calc(100% + 160px);background:repeating-linear-gradient(90deg,rgba(255,255,255,.5) 0 40px,transparent 40px 80px);z-index:2;pointer-events:none;}
.cw-sand{position:absolute;left:0;right:0;bottom:0;height:70px;background:linear-gradient(180deg,#ffe4a8,#f0c46a);box-shadow:inset 0 4px 0 rgba(255,255,255,.4);z-index:1;}
.cw-crab{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);font-size:2.6rem;line-height:1;z-index:5;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));will-change:left;transition:none;}
.cw-crab--hit{animation:cw-hit .8s ease forwards;}
@keyframes cw-hit{0%{transform:translateX(-50%) rotate(0)}30%{transform:translateX(-50%) rotate(-25deg) translateY(-6px)}100%{transform:translateX(-50%) rotate(0) translateY(0);opacity:.4;}}
.cw-fall{position:absolute;font-size:2rem;line-height:1;z-index:4;will-change:top;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));}
.cw-ctrls{display:flex;gap:16px;justify-content:center;width:100%;}
.cw-btn{font-family:inherit;font-size:1.3rem;font-weight:900;color:#fff;background:linear-gradient(160deg,${theme},#e07f1f);border:none;width:120px;height:64px;border-radius:18px;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;user-select:none;touch-action:manipulation;}
.cw-btn:active{transform:scale(.94);}
@media (max-width:380px){.cw-task{font-size:.95rem;}.cw-crab{font-size:2.2rem;}.cw-btn{width:96px;height:56px;font-size:1.1rem;}}
`;
}

export function create(): CrabWalkGame {
  return new CrabWalkGame();
}
