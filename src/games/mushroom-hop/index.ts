/* 蘑菇跳 Mushroom Hop —— 一排蘑菇：好的（红伞白点🍄）自动踩过去，
   毒的（紫色）要点屏幕跳过。踩到毒蘑菇结束本关重开。
   独特点：节奏判断 + 反应。角色自动前进，玩家只需在毒蘑菇前起跳。
   视觉：横向滚动蘑菇排 + 🐸 角色。用 RAF。难度=蘑菇数/速度。通关=过目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { createRafLoop } from "../../core/loop.ts";
import { getCssVar } from "../../lobby/util.ts";

interface Shroom {
  el: HTMLElement;
  poison: boolean;
  /** 蘑菇中心在赛道上的横向位置（px，相对赛道左） */
  x: number;
  crossed: boolean;
}

export class MushroomHopGame extends BaseGame {
  constructor() {
    super("mushroom-hop");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private stop?: () => void;
  private shrooms: Shroom[] = [];
  /** 角色当前所在赛道 x（角色固定在屏幕左，赛道向左滚等效于角色 x 增加） */
  private heroX = 0;
  /** 速度 px/s */
  private speed = 110;
  /** 起跳：>0 时角色在空中（剩余空中时间秒） */
  private jumpT = 0;
  /** 起跳总时长 */
  private jumpDur = 0.62;
  /** 本关蘑菇总长（赛道终点 x） */
  private finishX = 0;
  private over = false;
  private busy = false;
  /** 一次性点击监听解绑 */
  private unbindClick: (() => void) | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
    this.unbindClick?.();
    this.unbindClick = null;
  }

  private shroomCount(): number {
    return this.difficulty === "easy"
      ? 6
      : this.difficulty === "medium"
        ? 9
        : 12;
  }
  private speedFor(): number {
    return this.difficulty === "easy"
      ? 100
      : this.difficulty === "medium"
        ? 130
        : 165;
  }
  /** 毒蘑菇占比 */
  private poisonRate(): number {
    return this.difficulty === "easy"
      ? 0.3
      : this.difficulty === "medium"
        ? 0.4
        : 0.5;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.over = false;
    this.busy = false;
    this.heroX = 0;
    this.jumpT = 0;
    this.speed = this.speedFor();
    this.shrooms = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "mh2-wrap";

    const task = document.createElement("div");
    task.className = "mh2-task";
    task.innerHTML = `点屏幕 <b>跳过紫色毒蘑菇</b>，红蘑菇可以踩！<br><span class="mh2-sub">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "mh2-stage";
    stage.id = "mh2-stage";

    // 地面
    const ground = document.createElement("div");
    ground.className = "mh2-ground";
    stage.appendChild(ground);

    // 起点旗
    const start = document.createElement("div");
    start.className = "mh2-mark mh2-mark--start";
    start.textContent = "起";
    stage.appendChild(start);

    // 蘑菇（保证第 1 个不是毒的，让孩子有缓冲；并保证不会连续 2 个毒的卡死）
    const n = this.shroomCount();
    const gap = 150;
    const positions: number[] = [];
    let x = 240;
    for (let i = 0; i < n; i++) {
      positions.push(x);
      x += gap + (i % 2 === 0 ? 0 : 40);
    }
    this.finishX = x + 120;

    const poisons = this.makePoisonPlan(n);
    for (let i = 0; i < n; i++) {
      const s = document.createElement("div");
      s.className = `mh2-shroom ${poisons[i] ? "mh2-shroom--poison" : "mh2-shroom--good"}`;
      s.style.left = `${positions[i]}px`;
      s.innerHTML = poisons[i]
        ? `<div class="mh2-cap mh2-cap--poison"></div><div class="mh2-stem"></div>`
        : `<div class="mh2-cap mh2-cap--good"></div><div class="mh2-stem"></div>`;
      stage.appendChild(s);
      this.shrooms.push({
        el: s,
        poison: poisons[i]!,
        x: positions[i]! + 30,
        crossed: false,
      });
    }

    // 终点旗
    const finish = document.createElement("div");
    finish.className = "mh2-mark mh2-mark--finish";
    finish.style.left = `${this.finishX}px`;
    finish.textContent = "🏁";
    stage.appendChild(finish);

    // 角色
    const hero = document.createElement("div");
    hero.className = "mh2-hero";
    hero.id = "mh2-hero";
    hero.textContent = "🐸";
    stage.appendChild(hero);

    wrap.appendChild(stage);
    this.root.appendChild(wrap);

    // 点击/按键 = 起跳
    const onAct = (): void => this.jump();
    stage.addEventListener("pointerdown", onAct);
    this.unbindClick = () => stage.removeEventListener("pointerdown", onAct);

    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  /** 生成毒蘑菇布阵：第 1 个安全，且不连续 3 个毒的，保证有解可过。 */
  private makePoisonPlan(n: number): boolean[] {
    const rate = this.poisonRate();
    const plan: boolean[] = [];
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        plan.push(false);
        continue;
      }
      // 不连续 3 个毒
      const last2 = plan.slice(-2);
      const twoPoison = last2.length === 2 && last2.every(Boolean);
      const isPoison = !twoPoison && Math.random() < rate;
      plan.push(isPoison);
    }
    // 保证至少 1 个毒的让玩法成立
    if (!plan.some(Boolean) && n > 1) plan[1] = true;
    return plan;
  }

  private jump(): void {
    if (this.over) return;
    if (this.jumpT <= 0) {
      this.jumpT = this.jumpDur;
      sfxPop();
    }
  }

  private tick(dt: number): void {
    if (this.over || this.busy) return;
    // 前进
    this.heroX += this.speed * dt;
    if (this.jumpT > 0) this.jumpT -= dt;

    // 渲染：舞台用 translateX 让世界向左移
    const stageEl = this.root.querySelector<HTMLElement>("#mh2-stage");
    const heroEl = this.root.querySelector<HTMLElement>("#mh2-hero");
    if (!stageEl || !heroEl) return;
    // 角色固定在屏幕 x=90，所以世界偏移 = heroX - 90
    const offset = this.heroX - 90;
    // 把所有"世界元素"（蘑菇/旗/地面）整体偏移；用 CSS 变量驱动
    stageEl.style.setProperty("--world", `${-offset}px`);

    // 角色起跳高度（抛物线）
    let lift = 0;
    if (this.jumpT > 0) {
      const t = 1 - this.jumpT / this.jumpDur; // 0..1
      lift = 4 * t * (1 - t) * 70; // 峰值 70px
    }
    heroEl.style.transform = `translateY(${-lift}px) rotate(${this.jumpT > 0 ? -8 : 0}deg)`;

    // 碰撞：对每个未 crossed 的蘑菇，判断角色是否在其位置范围
    for (const s of this.shrooms) {
      if (s.crossed) continue;
      // 角色当前覆盖 [heroX-20, heroX+20]
      const heroLeft = this.heroX - 18;
      const heroRight = this.heroX + 18;
      if (heroRight > s.x - 22 && heroLeft < s.x + 22) {
        // 在蘑菇上方：如果起跳足够高就算跳过；否则踩到
        const airborne = lift > 28;
        if (s.poison && !airborne) {
          // 踩到毒蘑菇 —— 结束本关重开
          this.hitPoison(s);
          return;
        }
        if (!s.poison && !airborne) {
          // 踩好蘑菇（反馈一次）
          if (!s.el.classList.contains("mh2-shroom--bonk")) {
            s.el.classList.add("mh2-shroom--bonk");
            sfxPop();
          }
        }
      }
      if (heroLeft > s.x + 22) {
        s.crossed = true;
      }
    }

    // 到达终点
    if (this.heroX >= this.finishX) {
      this.finishRound();
    }
  }

  private hitPoison(s: Shroom): void {
    this.over = true;
    this.busy = true;
    s.el.classList.add("mh2-shroom--burst");
    this.onWrong();
    this.trackTimeout(() => {
      // 重开本关
      this.startRound();
    }, 900);
  }

  private finishRound(): void {
    if (this.busy) return;
    this.busy = true;
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    const hero = this.root.querySelector<HTMLElement>("#mh2-hero");
    if (hero) {
      const r = hero.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top);
    }
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount, [0, 1]));
      } else {
        this.startRound();
      }
    }, 700);
  }

  private injectStyle(): void {
    if (document.getElementById("mh2-style")) return;
    const st = document.createElement("style");
    st.id = "mh2-style";
    st.textContent = MH2_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function MH2_CSS(_theme: string): string {
  return `
.mh2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;}
.mh2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.mh2-sub{font-size:.85rem;font-weight:600;color:var(--ink-soft,#888);}
.mh2-stage{position:relative;width:100%;height:60vh;min-height:340px;background:linear-gradient(180deg,#bfe3ff 0%,#d8f0c8 60%,#a8d878 100%);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;cursor:pointer;touch-action:none;user-select:none;}
/* 地面 + 起跑线随世界左移 */
.mh2-ground{position:absolute;left:0;right:0;bottom:0;height:74px;background:linear-gradient(180deg,#8acb5a,#6cae44);box-shadow:inset 0 4px 0 rgba(255,255,255,.2);transform:translateX(var(--world,0px));background-image:linear-gradient(180deg,#8acb5a,#6cae44),repeating-linear-gradient(90deg,transparent 0 40px,rgba(255,255,255,.15) 40px 42px);}
.mh2-mark{position:absolute;bottom:74px;font-size:1rem;font-weight:800;color:#fff;background:rgba(0,0,0,.35);padding:2px 8px;border-radius:8px;transform:translateX(var(--world,0px));z-index:2;}
.mh2-mark--start{left:80px;}
.mh2-hero{position:absolute;left:80px;bottom:74px;font-size:2.4rem;line-height:1;z-index:5;transform-origin:50% 100%;filter:drop-shadow(0 4px 4px rgba(0,0,0,.3));}
.mh2-shroom{position:absolute;bottom:74px;width:60px;height:70px;transform:translateX(var(--world,0px));transform-origin:50% 100%;transition:none;z-index:3;}
.mh2-cap{position:absolute;left:0;top:0;width:60px;height:38px;border-radius:50% 50% 30% 30%/70% 70% 30% 30%;box-shadow:inset 0 -4px 6px rgba(0,0,0,.18),0 3px 4px rgba(0,0,0,.2);}
.mh2-cap--good{background:radial-gradient(circle at 40% 35%,#ff7a6a,#d63031);}
.mh2-cap--good::before{content:"";position:absolute;inset:0;background:radial-gradient(circle 5px at 25% 55%,#fff,transparent),radial-gradient(circle 5px at 55% 45%,#fff,transparent),radial-gradient(circle 5px at 78% 60%,#fff,transparent);border-radius:inherit;}
.mh2-cap--poison{background:radial-gradient(circle at 40% 35%,#b06bf0,#6c2bb8);}
.mh2-cap--poison::before{content:"☠";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;font-weight:800;}
.mh2-stem{position:absolute;left:50%;bottom:0;width:20px;height:38px;transform:translateX(-50%);background:linear-gradient(90deg,#f4e4c1,#d9c49a);border-radius:6px;}
.mh2-shroom--bonk{animation:mh2-bonk .3s;}
.mh2-shroom--burst{animation:mh2-burst .5s forwards;}
@keyframes mh2-bonk{0%{transform:translateX(var(--world,0px)) scaleY(1);}50%{transform:translateX(var(--world,0px)) scaleY(.78);}100%{transform:translateX(var(--world,0px)) scaleY(1);}}
@keyframes mh2-burst{0%{transform:translateX(var(--world,0px)) scale(1);opacity:1;}100%{transform:translateX(var(--world,0px)) scale(1.6);opacity:0;filter:hue-rotate(40deg);}}
`;
}

export function create(): MushroomHopGame {
  return new MushroomHopGame();
}
