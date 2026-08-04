/* 翻转重力 Gravity Flip —— 角色在水平走廊里前进，点屏幕翻转重力（上↔下），
   让角色吸附到对面地板，躲避障碍到达终点。
   独特点：单键操作 + 重力即时切换，节奏感强（类似 Gravity Guy）。
   视觉：横向走廊 + 角色 + 上下障碍。用 RAF。难度=障碍数+速度。
   通关=到达目标轮数。碰障碍重开本关。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { createRafLoop } from "../../core/loop.ts";
import { getCssVar } from "../../lobby/util.ts";

interface Obstacle {
  /** 距离起点的 x（世界坐标，向右递增） */
  x: number;
  /** 顶部障碍的宽度（向下伸出），0 表示只在底部 */
  topH: number;
  /** 底部障碍的高度（向上伸出），0 表示只在顶部 */
  botH: number;
  /** 缝隙宽度 */
  gap: number;
}

export class GravityFlipGame extends BaseGame {
  constructor() {
    super("gravity-flip");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private stop?: () => void;
  private unbind: (() => void) | null = null;
  private field!: HTMLDivElement;
  private player!: HTMLDivElement;
  private track!: HTMLDivElement;

  /** 世界坐标：玩家前进距离 */
  private scroll = 0;
  /** 玩家在走廊高度（0=顶 1=底，吸附式） */
  private floor = 1; // 当前在哪一面（1=底 0=顶）
  private floorT = 1; // 渲染插值
  /** 移动速度（世界像素/秒） */
  private speed = 180;
  /** 障碍列表 */
  private obstacles: Obstacle[] = [];
  /** 总长度（达到即过关） */
  private goal = 0;
  private over = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.over = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    /* 难度：障碍数与速度 */
    const obN =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.speed =
      this.difficulty === "easy"
        ? 160
        : this.difficulty === "medium"
          ? 200
          : 250;

    /* 生成障碍：保证每个缝隙足够大，可解 */
    const spacing = 320;
    this.obstacles = [];
    let x = 480;
    for (let i = 0; i < obN; i++) {
      const gap = this.difficulty === "hard" ? 130 : 160;
      /* 简化：只在顶或底出障碍，留对面整条路（一定可解，单面躲） */
      const onTop = Math.random() < 0.5;
      this.obstacles.push({
        x,
        topH: onTop ? 90 + Math.random() * 30 : 0,
        botH: onTop ? 0 : 90 + Math.random() * 30,
        gap,
      });
      x += spacing;
    }
    this.goal = x + 200;

    this.scroll = 0;
    this.floor = 1;
    this.floorT = 1;

    const wrap = document.createElement("div");
    wrap.className = "gf-wrap";

    const bar = document.createElement("div");
    bar.className = "gf-bar";
    bar.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · <span id="gf-hint">点屏幕翻转重力，躲过尖刺！</span>`;
    wrap.appendChild(bar);

    this.field = document.createElement("div");
    this.field.className = "gf-field";

    this.track = document.createElement("div");
    this.track.className = "gf-track";

    /* 终点旗 */
    const flag = document.createElement("div");
    flag.className = "gf-flag";
    flag.style.left = `${this.goal}px`;
    flag.textContent = "🏁";
    this.track.appendChild(flag);

    /* 障碍 DOM */
    this.obstacles.forEach((o) => {
      if (o.topH > 0) {
        const e = document.createElement("div");
        e.className = "gf-spike gf-spike--top";
        e.style.left = `${o.x}px`;
        e.style.height = `${o.topH}px`;
        this.track.appendChild(e);
      }
      if (o.botH > 0) {
        const e = document.createElement("div");
        e.className = "gf-spike gf-spike--bot";
        e.style.left = `${o.x}px`;
        e.style.height = `${o.botH}px`;
        this.track.appendChild(e);
      }
    });

    this.player = document.createElement("div");
    this.player.className = "gf-player";
    this.player.textContent = "🦔";
    this.track.appendChild(this.player);

    this.field.appendChild(this.track);
    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    /* 单击翻转 */
    this.unbind = bindPointer(this.field, {
      down: () => this.flip(),
    });

    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  private flip(): void {
    if (this.over) return;
    this.floor = this.floor === 1 ? 0 : 1;
    sfxPop();
  }

  private tick = (dt: number): void => {
    if (this.over) return;
    this.scroll += this.speed * dt;
    /* 翻转插值（快速吸附，但有一帧动画感） */
    const target = this.floor;
    this.floorT += (target - this.floorT) * Math.min(1, dt * 16);
    if (Math.abs(this.floorT - target) < 0.02) this.floorT = target;

    this.track.style.transform = `translateX(${-this.scroll}px)`;

    /* 玩家垂直位置：顶=14px，底=字段高-44 */
    const fieldH = this.field.clientHeight;
    const topY = 14;
    const botY = fieldH - 44;
    const py = topY + (botY - topY) * this.floorT;
    this.player.style.top = `${py}px`;
    /* 翻转视觉：上下颠倒 */
    this.player.style.transform = `rotate(${this.floorT === 0 ? 180 : 0}deg)`;

    /* 进度条 */
    const hint = this.root.querySelector("#gf-hint");
    if (hint) {
      hint.textContent = `前进 ${Math.round((this.scroll / this.goal) * 100)}%`;
    }

    /* 碰撞：玩家世界 x 固定在视口左侧 ~ 90px */
    const pxWorld = this.scroll + 90;
    const playerH = 36;
    for (const o of this.obstacles) {
      if (pxWorld + playerH > o.x && pxWorld < o.x + 36 /* 障碍宽度 */) {
        /* 检查纵向是否撞：玩家在顶/底，对应障碍顶/底 */
        if (this.floor === 0 && o.topH > 0 && py < o.topH) {
          this.hit();
          return;
        }
        if (this.floor === 1 && o.botH > 0 && py + playerH > fieldH - o.botH) {
          this.hit();
          return;
        }
      }
    }

    /* 到终点 */
    if (this.scroll >= this.goal) {
      this.win();
    }
  };

  private hit(): void {
    if (this.over) return;
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    this.player.classList.add("gf-player--hit");
    this.onWrong();
    this.trackTimeout(() => this.startRound(), 800);
  }

  private win(): void {
    if (this.over) return;
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    const r = this.player.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(starsByAccuracy(this.wrongCount));
      } else {
        this.startRound();
      }
    }, 900);
  }

  private injectStyle(): void {
    if (document.getElementById("gf-style")) return;
    const st = document.createElement("style");
    st.id = "gf-style";
    st.textContent = GF_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function GF_CSS(theme: string): string {
  return `
.gf-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.gf-bar{font-size:1.08rem;font-weight:800;background:linear-gradient(180deg,#fff,#eeeaff);padding:10px 24px;border-radius:999px;box-shadow:var(--shadow);text-align:center;border:2px solid #c9c4f0;}
.gf-bar span{color:${theme};font-weight:900;}
.gf-field{position:relative;width:100%;height:60vh;min-height:320px;background:radial-gradient(ellipse at 50% 50%,#3a3a6e 0%,#23234e 55%,#141433 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow),inset 0 0 40px rgba(0,0,0,.5);touch-action:none;cursor:pointer;}
.gf-field::before,.gf-field::after{content:"";position:absolute;left:0;right:0;height:10px;background:repeating-linear-gradient(90deg,${theme},${theme} 14px,transparent 14px,transparent 28px);box-shadow:0 0 12px ${theme}88;}
.gf-field::before{top:0;}
.gf-field::after{bottom:0;}
.gf-track{position:absolute;left:0;top:0;height:100%;will-change:transform;}
.gf-track::before{content:"";position:absolute;left:0;right:0;top:50%;height:2px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 24px,transparent 24px 56px);transform:translateY(-50%);}
.gf-player{position:absolute;left:90px;width:48px;height:48px;font-size:2.6rem;line-height:48px;text-align:center;transform-origin:50% 50%;transition:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,.6)) drop-shadow(0 0 10px ${theme}aa);z-index:5;}
.gf-player--hit{animation:gf-flash .3s ease 2;}
@keyframes gf-flash{50%{filter:brightness(2) drop-shadow(0 0 14px #ff6348);}}
.gf-spike{position:absolute;width:40px;background:linear-gradient(180deg,#ff7e6b,#ff6348,#c0392b);box-shadow:0 0 14px rgba(255,99,72,.85),0 0 4px #fff inset;}
.gf-spike--top{top:10px;background-image:linear-gradient(180deg,#ff7e6b,#ff6348,#c0392b);clip-path:polygon(0 0,100% 0,75% 100%,50% 80%,25% 100%);}
.gf-spike--bot{bottom:10px;clip-path:polygon(25% 0,50% 20%,75% 0,100% 100%,0 100%);}
.gf-flag{position:absolute;bottom:10px;font-size:2.4rem;line-height:1;filter:drop-shadow(0 3px 5px rgba(0,0,0,.5));animation:gf-flag-wave 1.2s ease-in-out infinite;}
@keyframes gf-flag-wave{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
`;
}

export function create(): GravityFlipGame {
  return new GravityFlipGame();
}
