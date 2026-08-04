/* 障碍跑 Obstacle Run —— RAF 驱动：三个车道，角色在底部，障碍从上方随机出现，
   按 ⬅️ ➡️ 切换车道躲避。撞到重开本关；坚持目标秒数通关。
   独特点：经典三车道躲避；障碍生成保证总有空车道可走（不会三车道同时堵死）。
   前缀 obr-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

interface Obstacle {
  el: HTMLDivElement;
  lane: number;
  y: number;
}

const OBSTACLES = ["🚧", "🪨", "🛢️", "🌵", "🧱"];
const COINS = ["🪙", "⭐"];

export class ObstacleRunGame extends BaseGame {
  constructor() {
    super("obstacle-run");
  }

  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private won = false;
  private field!: HTMLDivElement;
  private runner!: HTMLDivElement;
  private lane = 1; // 0,1,2
  private obstacles: Obstacle[] = [];
  private scrollY = 0;
  private elapsed = 0;
  private need = 0;
  private speed = 0;
  private spawnGap = 0;
  private sinceSpawn = 0;
  private coins = 0;
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
    this.obstacles = [];
    this.over = false;
    this.won = false;
    this.lane = 1;
    this.elapsed = 0;
    this.sinceSpawn = 0;
    this.scrollY = 0;
    this.coins = 0;
    this.cleanupBtns = [];

    this.need =
      this.difficulty === "easy" ? 12 : this.difficulty === "medium" ? 16 : 22;
    this.speed =
      this.difficulty === "easy" ? 1 : this.difficulty === "medium" ? 1.2 : 1.4;
    this.spawnGap =
      this.difficulty === "easy"
        ? 1.0
        : this.difficulty === "medium"
          ? 0.8
          : 0.6;

    const wrap = document.createElement("div");
    wrap.className = "obr-wrap";
    const task = document.createElement("div");
    task.className = "obr-task";
    task.innerHTML = `躲开障碍！坚持 <b id="obr-t">0 / ${this.need}</b> 秒 · 🪙 <b id="obr-c">0</b>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "obr-field";
    // 三条车道线
    for (let i = 0; i < 3; i++) {
      const ln = document.createElement("div");
      ln.className = "obr-lane";
      this.field.appendChild(ln);
    }
    this.runner = document.createElement("div");
    this.runner.className = "obr-runner";
    this.runner.textContent = "🏃";
    this.field.appendChild(this.runner);
    wrap.appendChild(this.field);

    const controls = document.createElement("div");
    controls.className = "obr-controls";
    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "obr-btn";
    leftBtn.textContent = "⬅️ 左";
    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "obr-btn";
    rightBtn.textContent = "右 ➡️";
    controls.appendChild(leftBtn);
    controls.appendChild(rightBtn);
    wrap.appendChild(controls);
    this.root.appendChild(wrap);

    leftBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.move(-1);
    });
    rightBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.move(1);
    });

    requestAnimationFrame(() => {
      this.placeRunner();
      this.last = performance.now();
      this.loop();
    });
  }

  private move(dir: number): void {
    if (this.over || this.won) return;
    this.lane = Math.max(0, Math.min(2, this.lane + dir));
    this.placeRunner();
  }

  private placeRunner(): void {
    const w = this.field.getBoundingClientRect().width;
    const laneW = w / 3;
    this.runner.style.left = `${this.lane * laneW + laneW / 2}px`;
  }

  private spawnRow(): void {
    const w = this.field.getBoundingClientRect().width;
    const laneW = w / 3;
    // 保证至少一条车道空：随机选 0-2 个车道放障碍
    const blockedLanes = new Set<number>();
    const numBlocked = randInt(0, 2);
    while (blockedLanes.size < numBlocked) {
      blockedLanes.add(randInt(0, 2));
    }
    for (const ln of blockedLanes) {
      const el = document.createElement("div");
      el.className = "obr-obstacle";
      el.textContent = sample(OBSTACLES);
      el.style.left = `${ln * laneW + laneW / 2}px`;
      el.style.top = `-40px`;
      this.field.appendChild(el);
      this.obstacles.push({ el, lane: ln, y: -40 });
    }
    // 偶尔在空车道放金币
    if (Math.random() < 0.5) {
      const empty = [0, 1, 2].filter((l) => !blockedLanes.has(l));
      if (empty.length) {
        const ln = sample(empty);
        const el = document.createElement("div");
        el.className = "obr-coin";
        el.textContent = sample(COINS);
        el.style.left = `${ln * laneW + laneW / 2}px`;
        el.style.top = `-40px`;
        el.dataset.coin = "1";
        this.field.appendChild(el);
        this.obstacles.push({ el, lane: ln, y: -40 });
      }
    }
  }

  private loop = (): void => {
    if (this.over || this.won) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 计时
    this.elapsed += dt;
    const t = this.root.querySelector("#obr-t");
    if (t) t.textContent = `${Math.floor(this.elapsed)} / ${this.need}`;
    if (this.elapsed >= this.need) {
      this.win();
      return;
    }

    // 滚动背景
    this.scrollY += 200 * this.speed * dt;

    // 生成
    this.sinceSpawn += dt;
    if (this.sinceSpawn >= this.spawnGap) {
      this.sinceSpawn = 0;
      this.spawnRow();
    }

    // 障碍移动 + 碰撞
    const fieldH = this.field.getBoundingClientRect().height;
    const runnerY = fieldH - 50;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i]!;
      o.y += 240 * this.speed * dt;
      o.el.style.top = `${o.y}px`;
      // 碰撞判定
      if (o.y > runnerY - 30 && o.y < runnerY + 30 && o.lane === this.lane) {
        if (o.el.dataset.coin === "1") {
          // 金币
          o.el.remove();
          this.obstacles.splice(i, 1);
          this.coins++;
          const c = this.root.querySelector("#obr-c");
          if (c) c.textContent = String(this.coins);
          continue;
        } else {
          this.hit();
          return;
        }
      }
      if (o.y > fieldH + 40) {
        o.el.remove();
        this.obstacles.splice(i, 1);
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

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

  private hit(): void {
    if (this.over || this.won) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.runner.classList.add("obr-runner--hit");
    const paused = this.onWrong();
    if (paused) this.showRest();
    else this.trackTimeout(() => this.startRound(), 900);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🏃",
      variant: "rest",
      body: "撞到障碍啦，看准空车道再躲！",
      primary: {
        text: "再跑一次",
        icon: "🏃",
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
    if (document.getElementById("obr-style")) return;
    const st = document.createElement("style");
    st.id = "obr-style";
    st.textContent = OBR_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function OBR_CSS(theme: string): string {
  return `
.obr-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;width:min(460px,100%);}
.obr-task{font-size:1rem;font-weight:800;color:var(--ink);background:#fff;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
.obr-task b{color:${theme};}
.obr-field{position:relative;width:100%;max-width:420px;height:60vh;min-height:340px;background:repeating-linear-gradient(180deg,#7ec47a 0,#7ec47a 40px,#8fd488 40px,#8fd488 80px);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);display:flex;}
.obr-lane{flex:1;border-right:2px dashed rgba(255,255,255,.5);}
.obr-lane:last-child{border-right:none;}
.obr-runner{position:absolute;bottom:6px;font-size:2.6rem;line-height:1;transform:translateX(-50%);z-index:5;filter:drop-shadow(0 3px 4px rgba(0,0,0,.25));will-change:left;animation:obr-run .25s ease-in-out infinite alternate;}
@keyframes obr-run{from{transform:translateX(-50%) translateY(0)}to{transform:translateX(-50%) translateY(-4px)}}
.obr-runner--hit{animation:obr-hit .5s ease;}
@keyframes obr-hit{0%,100%{transform:translateX(-50%) rotate(0)}50%{transform:translateX(-50%) rotate(-20deg) translateY(8px)}}
.obr-obstacle{position:absolute;font-size:2rem;line-height:1;transform:translateX(-50%);z-index:4;will-change:top;}
.obr-coin{position:absolute;font-size:1.6rem;line-height:1;transform:translateX(-50%);z-index:4;will-change:top;animation:obr-spin 1s linear infinite;}
@keyframes obr-spin{from{transform:translateX(-50%) rotateY(0)}to{transform:translateX(-50%) rotateY(360deg)}}
.obr-controls{display:flex;gap:24px;}
.obr-btn{width:120px;height:64px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,#ffe0d8);color:${theme};font-size:1.4rem;font-weight:900;box-shadow:var(--shadow);cursor:pointer;user-select:none;touch-action:none;transition:transform .08s;}
.obr-btn:active{transform:scale(.92);}
@media (max-width:380px){.obr-btn{width:96px;height:54px;font-size:1.2rem;}.obr-runner{font-size:2.2rem;}}
`;
}

export function create(): ObstacleRunGame {
  return new ObstacleRunGame();
}
