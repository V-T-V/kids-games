/* 企鹅滑冰 Penguin Slide —— 企鹅在冰面上滑行（自下而上视觉），
   前方（上方）有冰缝，点 左/右 按钮在三条冰道间变向避开。
   独特点：三车道躲避，反应训练。视觉：冰面 + 企鹅 + 冰缝向下卷动。
   难度=冰缝频率（生成间隔）。通关=避开目标数。掉进冰缝重开本关。
   RAF 驱动，unmount 必须 cancelAnimationFrame。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Crack {
  lane: number;
  y: number;
  el: HTMLDivElement;
  dodged: boolean;
}

const LANES = 3;

export class PenguinSlideGame extends BaseGame {
  constructor() {
    super("penguin-slide");
  }

  private field!: HTMLDivElement;
  private penguin!: HTMLDivElement;
  private cracks: Crack[] = [];
  private lane = 1; // 0,1,2
  private laneTarget = 1;
  private dodged = 0;
  private need = 0;
  private speed = 0;
  private spawnEvery = 0;
  private spawnAcc = 0;
  private fieldH = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private cleared = false;
  private scrollY = 0;

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
    this.cracks = [];
    this.dodged = 0;
    this.spawnAcc = 0;
    this.over = false;
    this.cleared = false;
    this.lane = 1;
    this.laneTarget = 1;
    this.need =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 9;
    this.speed =
      this.difficulty === "easy"
        ? 150
        : this.difficulty === "medium"
          ? 190
          : 235;
    this.spawnEvery =
      this.difficulty === "easy"
        ? 1300
        : this.difficulty === "medium"
          ? 1050
          : 820;

    const wrap = document.createElement("div");
    wrap.className = "pg-wrap";

    const task = document.createElement("div");
    task.className = "pg-task";
    task.innerHTML = `点 <b>◀</b> <b>▶</b> 换道躲开冰缝！避开 <b>${this.need}</b> 个 · <span id="pg-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "pg-field";

    // 三车道分隔线
    for (let i = 0; i < LANES; i++) {
      const lane = document.createElement("div");
      lane.className = "pg-lane";
      lane.style.setProperty("--lane", String(i));
      this.field.appendChild(lane);
    }

    // 冰面卷动纹理（::before 由 field 自身实现），这里加雪花
    const snow = document.createElement("div");
    snow.className = "pg-snow";
    this.field.appendChild(snow);

    this.penguin = document.createElement("div");
    this.penguin.className = "pg-penguin";
    this.penguin.textContent = "🐧";
    this.field.appendChild(this.penguin);

    wrap.appendChild(this.field);

    const ctrls = document.createElement("div");
    ctrls.className = "pg-ctrls";
    const left = document.createElement("button");
    left.type = "button";
    left.className = "pg-btn pg-btn--left";
    left.innerHTML = "◀ 左";
    const right = document.createElement("button");
    right.type = "button";
    right.className = "pg-btn pg-btn--right";
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
      this.fieldH = r.height;
      this.applyLane();
      this.last = performance.now();
      this.loop();
    });
  }

  private move(dir: number): void {
    if (this.over || this.cleared) return;
    this.laneTarget = Math.max(0, Math.min(LANES - 1, this.laneTarget + dir));
    this.resetWrongStreak();
  }

  private applyLane(): void {
    this.field.style.setProperty("--pg-lane", String(this.lane));
    const pct = (this.lane + 0.5) * (100 / LANES);
    this.penguin.style.left = `${pct}%`;
  }

  private spawnCrack(): void {
    // 选 1 条冰缝所在车道（永远只堵一条 → 总有两条可走 → 必可解）
    const lane = randInt(0, LANES - 1);
    const el = document.createElement("div");
    el.className = "pg-crack";
    el.style.setProperty("--lane", String(lane));
    el.style.top = `-50px`;
    this.field.appendChild(el);
    this.cracks.push({ lane, y: -50, el, dodged: false });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 平滑换道
    this.lane += (this.laneTarget - this.lane) * Math.min(1, dt * 14);
    this.applyLane();

    // 冰面卷动
    this.scrollY = (this.scrollY + this.speed * dt) % 80;
    this.field.style.setProperty("--pg-scroll", `${this.scrollY}px`);

    // 生成
    this.spawnAcc += dt * 1000;
    if (this.spawnAcc >= this.spawnEvery) {
      this.spawnAcc = 0;
      this.spawnCrack();
    }

    // 企鹅在画面下方 ~78% 处
    const penguinY = this.fieldH * 0.78;
    const penguinSize = 42;

    for (const c of this.cracks) {
      c.y += this.speed * dt;
      c.el.style.top = `${c.y}px`;
      // 避开计分：冰缝已越过企鹅所在 y 且不在同车道
      if (!c.dodged && c.y > penguinY + penguinSize / 2) {
        c.dodged = true;
        this.dodged += 1;
        sfxPop();
        const sc = this.root.querySelector("#pg-score");
        if (sc) sc.textContent = `${this.dodged} / ${this.need}`;
        if (this.dodged >= this.need) {
          this.win();
          return;
        }
      }
      // 碰撞：冰缝与企鹅 y 重叠且同车道
      const crackH = 46;
      const overlapY =
        c.y + crackH > penguinY - penguinSize / 2 &&
        c.y < penguinY + penguinSize / 2;
      const sameLaneApprox = Math.abs(c.lane - this.lane) < 0.45;
      if (overlapY && sameLaneApprox) {
        this.fall();
        return;
      }
    }
    // 清理
    for (let i = this.cracks.length - 1; i >= 0; i--) {
      const c = this.cracks[i]!;
      if (c.y > this.fieldH + 40) {
        c.el.remove();
        this.cracks.splice(i, 1);
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private win(): void {
    this.cleared = true;
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

  private fall(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.penguin.classList.add("pg-penguin--fall");
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
      body: "掉进冰缝啦，看清楚冰缝在哪条道再换～",
      primary: {
        text: "再滑一次",
        icon: "🐧",
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
    if (document.getElementById("pg-style")) return;
    const st = document.createElement("style");
    st.id = "pg-style";
    st.textContent = PG_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function PG_CSS(theme: string): string {
  return `
.pg-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.pg-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.pg-task b{color:${theme};}
.pg-field{position:relative;width:100%;height:60vh;min-height:360px;background:linear-gradient(180deg,#d4f1ff 0%,#a8d8f0 60%,#7cc0e8 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
/* 冰面卷动纹理 */
.pg-field::before{content:"";position:absolute;left:0;top:var(--pg-scroll,0);right:0;height:calc(100% + 160px);background:repeating-linear-gradient(180deg,rgba(255,255,255,.25) 0 20px,transparent 20px 80px);z-index:1;pointer-events:none;}
.pg-lane{position:absolute;top:0;bottom:0;left:calc(var(--lane,0) * (100% / 3));width:calc(100% / 3);border-right:2px dashed rgba(255,255,255,.45);z-index:1;}
.pg-lane:last-child{border-right:none;}
.pg-snow{position:absolute;inset:0;background-image:radial-gradient(circle at 20% 10%,#fff 0 2px,transparent 3px),radial-gradient(circle at 70% 30%,#fff 0 2px,transparent 3px),radial-gradient(circle at 40% 60%,#fff 0 2px,transparent 3px);opacity:.7;z-index:2;pointer-events:none;}
.pg-penguin{position:absolute;top:78%;transform:translate(-50%,-50%);font-size:2.6rem;line-height:1;z-index:5;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));will-change:left;transition:none;}
.pg-penguin--fall{animation:pg-fall .8s ease forwards;}
@keyframes pg-fall{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(.7) translateY(10px)}100%{transform:translate(-50%,-50%) scale(.3) translateY(30px);opacity:.3;}}
.pg-crack{position:absolute;left:calc(var(--lane,0) * (100% / 3));width:calc(100% / 3);height:46px;background:linear-gradient(180deg,#1a3a5c,#0d2540);z-index:4;will-change:top;border-top:3px solid #5a8fb8;border-bottom:3px solid #5a8fb8;}
.pg-crack::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent 0 6px,rgba(255,255,255,.15) 6px 8px);}
.pg-ctrls{display:flex;gap:16px;justify-content:center;width:100%;}
.pg-btn{font-family:inherit;font-size:1.3rem;font-weight:900;color:#fff;background:linear-gradient(160deg,${theme},#0ea5b8);border:none;width:120px;height:64px;border-radius:18px;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;user-select:none;touch-action:manipulation;}
.pg-btn:active{transform:scale(.94);}
@media (max-width:380px){.pg-task{font-size:.95rem;}.pg-penguin{font-size:2.2rem;}.pg-btn{width:96px;height:56px;font-size:1.1rem;}}
`;
}

export function create(): PenguinSlideGame {
  return new PenguinSlideGame();
}
