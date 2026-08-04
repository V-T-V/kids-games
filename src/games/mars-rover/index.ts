/* 火星车 Mars Rover —— 火星车在火星表面自动前进，岩石从前方滚来，
   点左/右按钮变道避开。碰岩石重开本关。
   独特点：横向多车道 + 纵向滚动地形，岩石生成在火星车当前车道以外，
   留出反应窗口，每躲过一块岩石计数 +1。用 RAF 驱动。
   视觉：火星红土地形 + 火星车 + 岩石。难度 = 岩石频率。通关 = 避开目标数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { randInt, getCssVar } from "../../lobby/util.ts";

interface Rock {
  el: HTMLDivElement;
  x: number;
  lane: number;
  counted: boolean;
  rot: number;
}

export class MarsRoverGame extends BaseGame {
  constructor() {
    super("mars-rover");
  }

  private field!: HTMLDivElement;
  private rover!: HTMLDivElement;
  private rocks: Rock[] = [];
  private lane = 1; /* 当前车道（0..lanes-1） */
  private lanes = 3;
  private laneY: number[] = [];
  private score = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private speed = 0;
  private spawnGap = 0;
  private sinceSpawn = 0;
  private held = { left: false, right: false };
  private laneTarget = 1;
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
    this.rocks = [];
    this.sinceSpawn = 0;
    this.held = { left: false, right: false };
    this.cleanupBtns = [];

    this.lanes =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 3 : 4;
    this.lane = Math.floor(this.lanes / 2);
    this.laneTarget = this.lane;
    this.need =
      this.difficulty === "easy" ? 6 : this.difficulty === "medium" ? 8 : 10;
    this.speed =
      this.difficulty === "easy"
        ? 130
        : this.difficulty === "medium"
          ? 165
          : 200;
    this.spawnGap =
      this.difficulty === "easy"
        ? 1.5
        : this.difficulty === "medium"
          ? 1.2
          : 0.95;

    const wrap = document.createElement("div");
    wrap.className = "mrv-wrap";
    const task = document.createElement("div");
    task.className = "mrv-task";
    task.innerHTML = `点 ⬅️ ➡️ 变道躲开岩石！已躲 <b id="mrv-score">${this.score}</b> / ${this.need}`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "mrv-field";
    this.rover = document.createElement("div");
    this.rover.className = "mrv-rover";
    this.rover.textContent = "🚙";
    this.field.appendChild(this.rover);
    wrap.appendChild(this.field);

    const controls = document.createElement("div");
    controls.className = "mrv-controls";
    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "mrv-btn";
    leftBtn.textContent = "⬅️";
    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "mrv-btn";
    rightBtn.textContent = "➡️";
    controls.appendChild(leftBtn);
    controls.appendChild(rightBtn);
    wrap.appendChild(controls);
    this.root.appendChild(wrap);

    /* 点击即变道一格（比持续按住更适合幼儿） */
    const tap = (btn: HTMLElement, dir: -1 | 1) => {
      const onDown = (e: Event) => {
        e.preventDefault();
        this.laneTarget = Math.max(
          0,
          Math.min(this.lanes - 1, this.laneTarget + dir),
        );
        sfxPop();
      };
      btn.addEventListener("pointerdown", onDown);
      return () => btn.removeEventListener("pointerdown", onDown);
    };
    this.cleanupBtns.push(tap(leftBtn, -1));
    this.cleanupBtns.push(tap(rightBtn, 1));

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      /* 计算每条车道的 y（纵向分布在中下段） */
      const top = r.height * 0.45;
      const bottom = r.height - 40;
      this.laneY = [];
      for (let i = 0; i < this.lanes; i++) {
        const t = this.lanes === 1 ? 0.5 : i / (this.lanes - 1);
        this.laneY.push(top + (bottom - top) * t);
      }
      this.placeRover(true);
      this.last = performance.now();
      this.loop();
    });
  }

  private placeRover(instant = false): void {
    this.lane = this.laneTarget;
    const roverX = 50;
    this.rover.style.transition = instant ? "none" : "top .14s ease";
    this.rover.style.left = `${roverX}px`;
    this.rover.style.top = `${this.laneY[this.lane]!}px`;
  }

  private spawnRock(): void {
    const r = this.field.getBoundingClientRect();
    /* 在火星车当前车道以外的随机车道生成，保证留反应窗口 */
    const others: number[] = [];
    for (let i = 0; i < this.lanes; i++) if (i !== this.lane) others.push(i);
    /* 但偶尔也在同车道生成（孩子需变道躲），随机选一个车道 */
    const lane = randInt(0, this.lanes - 1);
    void others;
    const el = document.createElement("div");
    el.className = "mrv-rock";
    const kind = randInt(0, 2);
    el.textContent = kind === 0 ? "🪨" : kind === 1 ? "⛰️" : "🌑";
    this.field.appendChild(el);
    this.rocks.push({
      el,
      x: r.width + 30,
      lane,
      counted: false,
      rot: randInt(0, 360),
    });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // const r = this.field.getBoundingClientRect();
    // const fieldW = r.width;

    /* 平滑变道（即使 instant 也每帧贴合目标） */
    this.placeRover(false);

    /* 生成岩石 */
    this.sinceSpawn += dt;
    if (this.sinceSpawn >= this.spawnGap) {
      this.sinceSpawn = 0;
      this.spawnRock();
    }

    /* 岩石左移 */
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const rk = this.rocks[i]!;
      rk.x -= this.speed * dt;
      rk.rot += this.speed * dt * 0.4;
      rk.el.style.left = `${rk.x}px`;
      rk.el.style.top = `${this.laneY[rk.lane]!}px`;
      rk.el.style.transform = `translate(-50%,-50%) rotate(${rk.rot}deg)`;

      /* 碰撞：岩石进入火星车 x 且在同一车道 */
      const roverX = 50;
      const roverR = 26;
      const sameLane = rk.lane === this.lane;
      const overlapX = Math.abs(rk.x - roverX) < roverR;
      if (sameLane && overlapX) {
        this.hit(rk);
        return;
      }
      /* 已越过火星车且没撞 → 计入躲过 */
      if (!rk.counted && rk.x < roverX - roverR) {
        rk.counted = true;
        this.score += 1;
        const sc = this.root.querySelector("#mrv-score");
        if (sc) sc.textContent = String(this.score);
        if (this.score >= this.need) {
          this.win();
          return;
        }
      }
      /* 出场移除 */
      if (rk.x < -50) {
        rk.el.remove();
        this.rocks.splice(i, 1);
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

  private hit(rk: Rock): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    rk.el.classList.add("mrv-rock--hit");
    this.rover.classList.add("mrv-rover--hit");
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
      emoji: "🚙",
      variant: "rest",
      body: "撞到岩石啦，看准再变道躲开～",
      primary: {
        text: "再开一次",
        icon: "🚙",
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
    if (document.getElementById("mrv-style")) return;
    const st = document.createElement("style");
    st.id = "mrv-style";
    st.textContent = MRV_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function MRV_CSS(theme: string): string {
  return `
.mrv-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.mrv-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.mrv-field{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#3a1a0e 0%,#7a2e1a 40%,#c45a2e 75%,#e8762e 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
.mrv-field::before{content:"";position:absolute;inset:0;background-image:radial-gradient(2px 2px at 20% 10%,#ff8c5a,transparent),radial-gradient(3px 3px at 60% 18%,#ffaa6a,transparent),radial-gradient(2px 2px at 80% 8%,#ffd08a,transparent);opacity:.5;pointer-events:none;}
.mrv-field::after{content:"🏔️  🌋  🏔️";position:absolute;left:0;bottom:-6px;width:100%;font-size:2rem;letter-spacing:80px;opacity:.4;pointer-events:none;animation:mrv-scroll 6s linear infinite;}
@keyframes mrv-scroll{from{transform:translateX(0)}to{transform:translateX(-200px)}}
.mrv-rover{position:absolute;font-size:2.4rem;line-height:1;transform:translateY(-50%);z-index:5;filter:drop-shadow(0 4px 5px rgba(0,0,0,.4));will-change:top;animation:mrv-bob .3s ease-in-out infinite alternate;}
@keyframes mrv-bob{from{transform:translateY(-52%) rotate(-2deg)}to{transform:translateY(-48%) rotate(2deg)}}
.mrv-rover--hit{animation:mrv-shake .5s ease;}
@keyframes mrv-shake{0%,100%{transform:translateY(-50%) rotate(0)}25%{transform:translateY(-50%) rotate(-15deg)}75%{transform:translateY(-50%) rotate(15deg)}}
.mrv-rock{position:absolute;font-size:2rem;line-height:1;transform:translate(-50%,-50%);z-index:4;filter:drop-shadow(0 3px 3px rgba(0,0,0,.4));will-change:left;pointer-events:none;}
.mrv-rock--hit{animation:mrv-flash .4s ease;}
@keyframes mrv-flash{0%,100%{filter:none}50%{filter:brightness(1.6) drop-shadow(0 0 12px ${theme})}}
.mrv-controls{display:flex;gap:24px;width:100%;justify-content:center;}
.mrv-btn{font-size:1.8rem;font-weight:800;width:88px;height:64px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,#ffe8e0);box-shadow:var(--shadow);cursor:pointer;user-select:none;touch-action:none;color:${theme};transition:transform .08s;}
.mrv-btn:active{transform:scale(.92);background:linear-gradient(180deg,#ffe8e0,#ffd0c0);}
@media (max-width:380px){.mrv-rover{font-size:2rem;}.mrv-rock{font-size:1.7rem;}.mrv-btn{width:72px;height:56px;font-size:1.5rem;}}
`;
}

export function create(): MarsRoverGame {
  return new MarsRoverGame();
}
