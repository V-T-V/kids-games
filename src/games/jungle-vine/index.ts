/* 藤蔓摆 Jungle Vine —— 角色抓住悬挂的藤蔓左右摆动，孩子要在藤蔓摆到
   对面平台正上方的瞬间松手，让角色落到平台上。
   独特点：时机判断——松手瞬间决定落点（区别于普通跳跃）。
   视觉：丛林背景 + 顶部支点 + 摆动藤蔓（带角色）+ 两侧平台。
   难度=平台距离（藤蔓摆幅够不够到）。通关=跳到目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

export class JungleVineGame extends BaseGame {
  constructor() {
    super("jungle-vine");
  }

  private raf = 0;
  private over = false;
  private last = 0;

  private phase = 0; // 摆动相位
  private omega = 0; // 角速度 rad/s
  private amp = 0; // 振幅 deg
  private swinging = true; // 是否在摆动（松手后停止）
  private releaseDeg = 0; // 松手时角度
  private releaseDir = 1; // 松手时运动方向（+1/-1）
  private flyer: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    active: boolean;
  } = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    active: false,
  };

  /** 平台位置（相对舞台百分比中心 x） */
  private targetX = 0.8; // 0..1 的水平中心
  private landRange = 0.12; // 落点容差（占舞台宽度）

  private roundsDone = 0;
  private roundTotal = 0;

  private arm!: HTMLDivElement;
  private bob!: HTMLDivElement;
  private flyerEl!: HTMLDivElement;
  private stage!: HTMLDivElement;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private startRound(): void {
    this.over = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root.innerHTML = "";

    this.omega =
      this.difficulty === "easy"
        ? 1.5
        : this.difficulty === "medium"
          ? 2.0
          : 2.7;
    this.amp = this.difficulty === "hard" ? 56 : 64;
    this.phase = -0.5;
    this.swinging = true;
    this.flyer.active = false;
    // 目标平台位置与容差（难度越高越小）
    this.targetX =
      this.difficulty === "easy"
        ? 0.78
        : this.difficulty === "medium"
          ? 0.82
          : 0.86;
    this.landRange =
      this.difficulty === "easy"
        ? 0.14
        : this.difficulty === "medium"
          ? 0.1
          : 0.07;

    const wrap = document.createElement("div");
    wrap.className = "jv-wrap";
    const task = document.createElement("div");
    task.className = "jv-task";
    task.id = "jv-task";
    task.innerHTML = `藤蔓荡到<b>对面平台</b>上方时，快点点 <b>松手！</b><br><span class="jv-hint">第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "jv-stage";
    stage.id = "jv-stage";

    // 起点（左侧平台）
    const start = document.createElement("div");
    start.className = "jv-platform jv-platform--start";
    start.textContent = "🌿";
    stage.appendChild(start);
    // 目标平台
    const goal = document.createElement("div");
    goal.className = "jv-platform jv-platform--goal";
    goal.id = "jv-goal";
    goal.style.left = `${this.targetX * 100}%`;
    goal.textContent = "🌳";
    stage.appendChild(goal);

    // 顶部支点（在舞台中央上方）
    const pivot = document.createElement("div");
    pivot.className = "jv-pivot";
    stage.appendChild(pivot);

    // 藤蔓（摆杆 + 角色摆锤）
    this.arm = document.createElement("div");
    this.arm.className = "jv-arm";
    this.arm.id = "jv-arm";
    this.bob = document.createElement("div");
    this.bob.className = "jv-bob";
    this.bob.textContent = "🧒";
    this.arm.appendChild(this.bob);
    stage.appendChild(this.arm);

    // 飞行角色（松手后抛物线）
    this.flyerEl = document.createElement("div");
    this.flyerEl.className = "jv-flyer";
    this.flyerEl.id = "jv-flyer";
    this.flyerEl.textContent = "🧒";
    this.flyerEl.style.display = "none";
    stage.appendChild(this.flyerEl);

    this.stage = stage;
    wrap.appendChild(stage);

    // 松手大按钮
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "jv-drop";
    btn.id = "jv-drop";
    btn.textContent = "✋ 松手！";
    btn.addEventListener("click", () => this.release());
    wrap.appendChild(btn);

    this.root.appendChild(wrap);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    if (this.swinging) {
      this.phase += this.omega * dt;
      const s = Math.sin(this.phase);
      const deg = s * this.amp;
      this.arm.style.transform = `rotate(${deg}deg)`;
      this.releaseDir = Math.cos(this.phase) >= 0 ? 1 : -1; // 角速度方向
    } else if (this.flyer.active) {
      // 简单抛物线（像素单位近似）
      this.flyer.vy += 1400 * dt; // 重力
      this.flyer.x += this.flyer.vx * dt;
      this.flyer.y += this.flyer.vy * dt;
      this.flyerEl.style.left = `${this.flyer.x}px`;
      this.flyerEl.style.top = `${this.flyer.y}px`;
      // 落地判定（到达平台高度附近）
      const goal = this.root.querySelector("#jv-goal") as HTMLElement | null;
      if (goal && this.flyer.y > this.goalTopPx()) {
        this.flyer.active = false;
        this.judgeLand();
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  /** 目标平台顶部 y 像素（相对舞台） */
  private goalTopPx(): number {
    const h = this.stage.getBoundingClientRect().height || 320;
    return h - 70; // 平台高度
  }

  /** 把当前藤蔓角度对应的水平位置算出（松手点） */
  private release(): void {
    if (this.over || !this.swinging) return;
    this.swinging = false;
    // 计算松手时摆锤的世界坐标
    const s = Math.sin(this.phase);
    const deg = s * this.amp;
    this.releaseDeg = deg;
    const sr = (deg * Math.PI) / 180;
    const armLen = this.armLenPx();
    const stageRect = this.stage.getBoundingClientRect();
    const cx = stageRect.width / 2;
    const cy = 26; // 支点高度（约）
    const px = cx + Math.sin(sr) * armLen;
    const py = cy + Math.cos(sr) * armLen;
    this.flyer.x = px;
    this.flyer.y = py;
    // 切向速度方向：沿摆动方向
    const tang = this.omega * armLen * Math.cos(this.phase) * this.releaseDir;
    // 速度分量（x = -cos*?, 经验：松手向当前摆动方向水平飞）
    this.flyer.vx =
      s === 0 ? 0 : this.releaseDir * Math.abs(tang) * Math.sign(s) * 0.9;
    // 保证朝目标方向飞（让游戏可解：松手时给一个朝运动方向的初速度）
    if (s > 0) this.flyer.vx = Math.abs(this.flyer.vx) + 120;
    else this.flyer.vx = -Math.abs(this.flyer.vx) - 120;
    this.flyer.vy = -180; // 略向上，模拟松手时的离心
    this.flyer.active = true;
    this.bob.style.opacity = "0";
    this.flyerEl.style.display = "flex";
    sfxPop();
  }

  private armLenPx(): number {
    // arm 高度（CSS 里设置）；getBoundingClientRect 受 rotate 影响不大，取 height
    const r = this.arm.getBoundingClientRect();
    return Math.max(120, r.height || 180);
  }

  private judgeLand(): void {
    // 判断落点 x 是否在目标平台范围内（百分比）
    const stageRect = this.stage.getBoundingClientRect();
    const xpct = stageRect.width > 0 ? this.flyer.x / stageRect.width : 0.5;
    const dist = Math.abs(xpct - this.targetX);
    if (dist <= this.landRange) {
      // 成功落到目标
      this.flyerEl.style.left = `${this.targetX * stageRect.width}px`;
      this.flyerEl.style.top = `${stageRect.height - 80}px`;
      this.over = true;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.resetWrongStreak();
      const r = this.flyerEl.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 800);
    } else {
      // 没跳准：本关重来
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
      } else {
        this.trackTimeout(() => this.startRound(), 700);
      }
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "等藤蔓荡到对面平台正上方再松手哦～",
      primary: {
        text: "再试一次",
        icon: "🌿",
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
    if (document.getElementById("jv-style")) return;
    const st = document.createElement("style");
    st.id = "jv-style";
    st.textContent = JV_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function JV_CSS(theme: string): string {
  return `
.jv-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.jv-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);max-width:440px;}
.jv-task b{color:${theme};}
.jv-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.jv-stage{position:relative;width:min(440px,94vw);height:340px;border-radius:24px;background:linear-gradient(180deg,#a8e6a3 0%,#66bb6a 55%,#33691e 100%);box-shadow:var(--shadow-lg);overflow:hidden;}
.jv-stage::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 10%,rgba(255,255,255,.4),transparent 40%);}
.jv-platform{position:absolute;bottom:0;width:64px;height:60px;display:flex;align-items:flex-end;justify-content:center;font-size:2.6rem;transform:translateX(-50%);filter:drop-shadow(0 3px 4px rgba(0,0,0,.3));}
.jv-platform--start{left:22%;}
.jv-platform--goal{left:80%;animation:jv-bob 1.6s ease-in-out infinite alternate;}
@keyframes jv-bob{from{transform:translateX(-50%) translateY(0)}to{transform:translateX(-50%) translateY(-4px)}}
.jv-pivot{position:absolute;top:18px;left:50%;transform:translateX(-50%);width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#4e342e);box-shadow:var(--shadow);z-index:5;}
.jv-arm{position:absolute;top:24px;left:50%;width:6px;height:200px;margin-left:-3px;background:repeating-linear-gradient(180deg,#558b2f 0 10px,transparent 10px 14px);transform-origin:top center;transform:rotate(0deg);z-index:4;will-change:transform;}
.jv-bob{position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;background:radial-gradient(circle at 32% 30%,#fff6,${theme} 70%,color-mix(in srgb,${theme} 60%,#000));box-shadow:inset 0 -3px 5px rgba(0,0,0,.25),0 3px 5px rgba(0,0,0,.25);}
.jv-flyer{position:absolute;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;z-index:6;filter:drop-shadow(0 0 6px #fff6);will-change:left,top;}
.jv-drop{min-width:200px;min-height:64px;border:none;border-radius:20px;background:linear-gradient(160deg,${theme},color-mix(in srgb,${theme} 70%,#000));color:#fff;font-size:1.5rem;font-weight:900;box-shadow:0 6px 0 color-mix(in srgb,${theme} 50%,#000),var(--shadow);cursor:pointer;transition:transform .1s ease,box-shadow .1s ease;}
.jv-drop:active{transform:translateY(4px);box-shadow:0 2px 0 color-mix(in srgb,${theme} 50%,#000),var(--shadow);}
@media (max-width:380px){.jv-stage{height:300px;}.jv-arm{height:170px;}.jv-drop{min-width:170px;font-size:1.3rem;}}
`;
}

export function create(): JungleVineGame {
  return new JungleVineGame();
}
