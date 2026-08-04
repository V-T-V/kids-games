/* 沙虫 Dune Bug —— 沙虫在沙地里有 3 条车道，自动向前跑（场景左滚），
   仙人掌从右侧出现，孩子点左/右按钮切换车道避开。
   独特点：三车道躲避 + 沙漠氛围，比连续移动更易上手。
   巧思：每条车道生成仙人掌时保证至少有一条相邻空车道，孩子总能躲开。
   难度 = 速度。通关 = 避开目标仙人掌数。碰仙人掌重开。
   注意：CSS 前缀 db2-（dino-bones 用 db-）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

const LANES = 3;

interface Cactus {
  x: number;
  lane: number;
  cleared: boolean;
  el: HTMLDivElement;
}

export class DuneBugGame extends BaseGame {
  constructor() {
    super("dune-bug");
  }

  private field!: HTMLDivElement;
  private bug!: HTMLDivElement;
  private cacti: Cactus[] = [];
  private lane = 1; // 0,1,2
  private score = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private speed = 0;
  private gap = 0;
  private sinceSpawn = 0;
  private laneY: number[] = [];
  private bugX = 0;
  private targetY = 0;
  private curY = 0;
  private W = 0;
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
    this.score = 0;
    this.over = false;
    this.cacti = [];
    this.sinceSpawn = 0;
    this.lane = 1;
    this.cleanupBtns = [];
    this.need =
      this.difficulty === "easy" ? 6 : this.difficulty === "medium" ? 9 : 13;
    this.speed =
      this.difficulty === "easy"
        ? 150
        : this.difficulty === "medium"
          ? 185
          : 225;
    this.gap =
      this.difficulty === "easy"
        ? 280
        : this.difficulty === "medium"
          ? 240
          : 200;

    const wrap = document.createElement("div");
    wrap.className = "db2-wrap";
    const task = document.createElement("div");
    task.className = "db2-task";
    task.innerHTML = `按 ⬅️ ➡️ 切换车道躲开仙人掌！躲过 <b>${this.need}</b> 个 · <span id="db2-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "db2-field";
    this.bug = document.createElement("div");
    this.bug.className = "db2-bug";
    this.bug.textContent = "🐛";
    this.field.appendChild(this.bug);
    wrap.appendChild(this.field);

    const controls = document.createElement("div");
    controls.className = "db2-controls";
    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "db2-btn";
    leftBtn.textContent = "⬅️ 左";
    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "db2-btn";
    rightBtn.textContent = "➡️ 右";
    controls.appendChild(leftBtn);
    controls.appendChild(rightBtn);
    wrap.appendChild(controls);
    this.root.appendChild(wrap);

    const clickLeft = () => this.moveLane(-1);
    const clickRight = () => this.moveLane(1);
    leftBtn.addEventListener("click", clickLeft);
    rightBtn.addEventListener("click", clickRight);
    this.cleanupBtns.push(() =>
      leftBtn.removeEventListener("click", clickLeft),
    );
    this.cleanupBtns.push(() =>
      rightBtn.removeEventListener("click", clickRight),
    );

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.W = r.width;
      this.bugX = r.width * 0.22;
      // 三条车道 y
      const top = r.height * 0.5;
      const bottom = r.height - 50;
      this.laneY = [top, (top + bottom) / 2, bottom];
      this.curY = this.laneY[this.lane]!;
      this.targetY = this.curY;
      this.placeBug();
      this.last = performance.now();
      this.loop();
    });
  }

  private placeBug(): void {
    this.bug.style.left = `${this.bugX}px`;
    this.bug.style.top = `${this.curY}px`;
  }

  private moveLane(d: number): void {
    if (this.over) return;
    const next = Math.max(0, Math.min(LANES - 1, this.lane + d));
    if (next !== this.lane) {
      this.lane = next;
      this.targetY = this.laneY[this.lane]!;
      sfxPop();
    }
  }

  private spawnCactus(): void {
    const r = this.field.getBoundingClientRect();
    // 生成车道：避开当前 1 行只占 1 条（保证有 2 条空车道），孩子总能躲
    const lane = randInt(0, LANES - 1);
    const el = document.createElement("div");
    el.className = "db2-cactus";
    el.textContent = "🌵";
    this.field.appendChild(el);
    const x = r.width + 30;
    const y = this.laneY[lane]!;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.cacti.push({ x, lane, cleared: false, el });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 平滑切换车道
    this.curY += (this.targetY - this.curY) * Math.min(1, dt * 14);
    this.placeBug();

    // 仙人掌滚动
    for (const c of this.cacti) {
      c.x -= this.speed * dt;
      c.el.style.left = `${c.x}px`;
    }
    // 生成
    this.sinceSpawn += dt;
    const last = this.cacti[this.cacti.length - 1];
    if (this.sinceSpawn >= 0 && (!last || this.W - last.x > this.gap)) {
      this.sinceSpawn = 0;
      this.spawnCactus();
    }
    // 移除离屏
    for (let i = this.cacti.length - 1; i >= 0; i--) {
      const c = this.cacti[i]!;
      if (c.x < -50) {
        c.el.remove();
        this.cacti.splice(i, 1);
      }
    }

    // 碰撞 / 计分：以沙虫所在 x 为判定线
    const bugRight = this.bugX + 22;
    const bugLeft = this.bugX - 22;
    for (const c of this.cacti) {
      const overlap = c.x + 22 > bugLeft && c.x - 22 < bugRight;
      if (overlap && c.lane === this.lane) {
        this.end(c);
        return;
      }
      if (!c.cleared && c.x < bugLeft - 22) {
        c.cleared = true;
        this.score += 1;
        sfxPop();
        const sc = this.root.querySelector("#db2-score");
        if (sc) sc.textContent = `${this.score} / ${this.need}`;
        const cr = c.el.getBoundingClientRect();
        this.onCorrect(cr.left, cr.top);
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

  private end(c: Cactus): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    c.el.classList.add("db2-cactus--hit");
    this.bug.classList.add("db2-bug--hit");
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
      emoji: "🌵",
      variant: "rest",
      body: "撞到仙人掌啦，提前切换车道哦～",
      primary: {
        text: "再钻一次",
        icon: "🐛",
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
    if (document.getElementById("db2-style")) return;
    const st = document.createElement("style");
    st.id = "db2-style";
    st.textContent = DB2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function DB2_CSS(theme: string): string {
  return `
.db2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.db2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.db2-field{position:relative;width:100%;height:58vh;min-height:340px;background:linear-gradient(180deg,#ffd89b 0%,#f5b56a 40%,#e0a050 80%,#c08030 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);}
.db2-field::before{content:"☀️";position:absolute;top:10px;right:20px;font-size:2.2rem;filter:drop-shadow(0 0 12px rgba(255,220,80,.6));z-index:1;}
.db2-field::after{content:"";position:absolute;left:0;right:0;bottom:0;height:40px;background:linear-gradient(180deg,#c08030,#9a6020);z-index:1;}
.db2-bug{position:absolute;font-size:2.4rem;line-height:1;transform:translate(-50%,-50%);z-index:5;filter:drop-shadow(0 4px 4px rgba(0,0,0,.3));will-change:top;animation:db2-wiggle .3s ease-in-out infinite alternate;}
@keyframes db2-wiggle{from{transform:translate(-50%,-50%) rotate(-5deg)}to{transform:translate(-50%,-50%) rotate(5deg)}}
.db2-bug--hit{animation:db2-hit .5s ease;}
@keyframes db2-hit{0%,100%{filter:none}50%{filter:brightness(1.5) drop-shadow(0 0 10px #ff3b30)}}
.db2-cactus{position:absolute;font-size:2.4rem;line-height:1;transform:translate(-50%,-50%);z-index:4;filter:drop-shadow(0 3px 3px rgba(0,0,0,.3));will-change:left;pointer-events:none;}
.db2-cactus--hit{animation:db2-flash .4s ease;}
@keyframes db2-flash{0%,100%{filter:none}50%{filter:brightness(1.6) drop-shadow(0 0 12px ${theme})}}
.db2-controls{display:flex;gap:24px;width:100%;justify-content:center;}
.db2-btn{font-size:1.3rem;font-weight:800;padding:16px 32px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,#e8e8e8);box-shadow:var(--shadow);cursor:pointer;user-select:none;touch-action:none;color:${theme};transition:transform .08s;}
.db2-btn:active{transform:scale(.94);background:linear-gradient(180deg,#e8e8e8,#d8d8d8);}
@media (max-width:380px){.db2-task{font-size:.95rem;}.db2-bug{font-size:2rem;}.db2-cactus{font-size:2rem;}.db2-btn{font-size:1.1rem;padding:14px 24px;}}
`;
}

export function create(): DuneBugGame {
  return new DuneBugGame();
}
