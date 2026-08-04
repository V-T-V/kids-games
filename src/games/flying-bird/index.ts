/* 飞翔的小鸟 Flying Bird —— 点击让小鸟向上飞，重力下拉，躲避上下管道缝隙。
   独特点：经典 Flappy 玩法 + 童趣视觉（小鸟 emoji + 绿色管道），锻炼节奏点击。
   巧思：场景左滚（管道右→左移动），缝隙大小随难度收窄，速度随难度加快。
   通关 = 穿过目标管道数。RAF 驱动，unmount 必须 cancelAnimationFrame。
   前缀 fbird-（避免与 feedback 系统的 fb- 冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

interface Pipe {
  x: number;
  /** 缝隙中心 y（相对 field 高度比例） */
  gapCenter: number;
  passed: boolean;
  top: HTMLDivElement;
  bot: HTMLDivElement;
}

export class FlyingBirdGame extends BaseGame {
  constructor() {
    super("flying-bird");
  }

  private field!: HTMLDivElement;
  private bird!: HTMLDivElement;
  private pipes: Pipe[] = [];
  /** 小鸟 y（px，相对 field 顶部） */
  private by = 0;
  /** 小鸟竖直速度（px/s，正向下） */
  private vy = 0;
  private score = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private spawnX = 0;
  private gapSize = 0;
  private speed = 0;
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
    this.pipes = [];
    this.need =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    // 难度：缝隙越大越简单，速度越慢越简单
    this.gapSize =
      this.difficulty === "easy"
        ? 0.42
        : this.difficulty === "medium"
          ? 0.34
          : 0.28;
    this.speed =
      this.difficulty === "easy"
        ? 150
        : this.difficulty === "medium"
          ? 185
          : 220;

    const wrap = document.createElement("div");
    wrap.className = "fbird-wrap";
    const task = document.createElement("div");
    task.className = "fbird-task";
    task.innerHTML = `点击让小鸟飞起来！穿过 <b>${this.need}</b> 根管道 · <span id="fbird-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "fbird-field";
    this.field.id = "fbird-field";

    this.bird = document.createElement("div");
    this.bird.className = "fbird-bird";
    this.bird.id = "fbird-bird";
    this.bird.textContent = "🐤";
    this.field.appendChild(this.bird);

    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    this.unbind = bindPointer(this.field, {
      down: () => this.flap(),
    });

    // 等布局完成再初始化位置
    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.by = r.height * 0.45;
      this.spawnX = r.width + 40;
      this.vy = 0;
      this.last = performance.now();
      this.loop();
    });
  }

  /** 点击：给一个向上的速度。 */
  private flap(): void {
    if (this.over) return;
    this.vy = -320; // 向上
    sfxPop();
  }

  private spawnPipe(): void {
    const r = this.field.getBoundingClientRect();
    const gapCenter = (0.25 + Math.random() * 0.5) * r.height; // 缝隙中心避开极端
    const top = document.createElement("div");
    top.className = "fbird-pipe fbird-pipe--top";
    const bot = document.createElement("div");
    bot.className = "fbird-pipe fbird-pipe--bot";
    this.field.appendChild(top);
    this.field.appendChild(bot);
    this.pipes.push({ x: this.spawnX, gapCenter, passed: false, top, bot });
    this.layoutPipe(this.pipes[this.pipes.length - 1]!, r);
  }

  private layoutPipe(p: Pipe, r: { height: number }): void {
    const gapPx = r.height * this.gapSize;
    const topH = p.gapCenter - gapPx / 2;
    const botH = r.height - (p.gapCenter + gapPx / 2);
    p.top.style.height = `${Math.max(0, topH)}px`;
    p.bot.style.height = `${Math.max(0, botH)}px`;
    p.top.style.left = `${p.x}px`;
    p.bot.style.left = `${p.x}px`;
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05; // 钳制

    const r = this.field.getBoundingClientRect();
    const W = r.width;
    const H = r.height;

    // 物理：重力
    this.vy += 950 * dt;
    this.by += this.vy * dt;
    // 小鸟左右固定 x
    const birdX = 60;
    const birdSize = 38;

    // 碰天花板/地面
    if (this.by < birdSize / 2 || this.by > H - birdSize / 2) {
      this.bird.style.top = `${Math.max(birdSize / 2, Math.min(H - birdSize / 2, this.by))}px`;
      this.end();
      return;
    }
    this.bird.style.top = `${this.by}px`;
    // 旋转：根据速度做轻微俯仰
    const rot = Math.max(-25, Math.min(70, (this.vy / 600) * 45));
    this.bird.style.transform = `translateX(-50%) rotate(${rot}deg)`;

    // 管道移动 + 生成
    for (const p of this.pipes) {
      p.x -= this.speed * dt;
      p.top.style.left = `${p.x}px`;
      p.bot.style.left = `${p.x}px`;
      // 计分：管道中心越过小鸟 x
      if (!p.passed && p.x + 50 < birdX) {
        p.passed = true;
        this.score += 1;
        sfxPop();
        const sc = this.root.querySelector("#fbird-score");
        if (sc) sc.textContent = `${this.score} / ${this.need}`;
        if (this.score >= this.need) {
          this.win();
          return;
        }
      }
    }
    // 移除离开屏幕的管道
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const p = this.pipes[i]!;
      if (p.x < -70) {
        p.top.remove();
        p.bot.remove();
        this.pipes.splice(i, 1);
      }
    }
    // 生成新管道：屏幕无管道或最后一个走够距离
    const lastPipe = this.pipes[this.pipes.length - 1];
    const gapDist = this.difficulty === "hard" ? 210 : 260;
    if (!lastPipe || W - (lastPipe.x + 50) > gapDist) {
      this.spawnPipe();
    }

    // 碰撞检测：小鸟与每根管道
    const gapPx = H * this.gapSize;
    for (const p of this.pipes) {
      const pipeW = 56;
      if (birdX + birdSize / 2 > p.x && birdX - birdSize / 2 < p.x + pipeW) {
        const topH = p.gapCenter - gapPx / 2;
        const botTop = p.gapCenter + gapPx / 2;
        if (this.by - birdSize / 2 < topH || this.by + birdSize / 2 > botTop) {
          this.end();
          return;
        }
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

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
    this.bird.classList.add("fbird-bird--hit");
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      // 短暂提示后重开本关（startGame 会把 over 重置为 false），保证可通关
      this.trackTimeout(() => this.startGame(), 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "小鸟撞到啦，再来一次吧～",
      primary: {
        text: "再飞一次",
        icon: "🐤",
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
    if (document.getElementById("fbird-style")) return;
    const st = document.createElement("style");
    st.id = "fbird-style";
    st.textContent = FBIRD_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function FBIRD_CSS(theme: string): string {
  return `
.fbird-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.fbird-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.fbird-field{position:relative;width:100%;height:62vh;min-height:360px;background:linear-gradient(180deg,#7ec8f5 0%,#a8e6ff 60%,#d4f5c2 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:pointer;}
.fbird-field::before{content:"";position:absolute;bottom:0;left:0;right:0;height:34px;background:linear-gradient(180deg,#8bc34a,#6ba23e);box-shadow:inset 0 3px 0 rgba(255,255,255,.3);z-index:3;}
.fbird-field::after{content:"☁️ ☁️";position:absolute;top:18px;left:0;font-size:2rem;letter-spacing:120px;opacity:.7;z-index:1;animation:fbird-cloud 22s linear infinite;}
@keyframes fbird-cloud{from{transform:translateX(0)}to{transform:translateX(-200px)}}
.fbird-bird{position:absolute;left:60px;top:40%;transform:translateX(-50%);font-size:2.4rem;line-height:1;z-index:5;filter:drop-shadow(0 4px 4px rgba(0,0,0,.2));will-change:top,transform;animation:fbird-wing .4s ease-in-out infinite alternate;}
@keyframes fbird-wing{from{transform:translateX(-50%) translateY(0)}to{transform:translateX(-50%) translateY(-3px)}}
.fbird-pipe{position:absolute;width:56px;background:linear-gradient(90deg,#4caf50,#8bc34a 50%,#2e7d32);box-shadow:inset 0 0 0 3px rgba(255,255,255,.18),inset -4px 0 0 rgba(0,0,0,.15);z-index:4;}
.fbird-pipe--top{top:0;border-radius:0 0 10px 10px;}
.fbird-pipe--bot{bottom:34px;border-radius:10px 10px 0 0;}
.fbird-bird--hit{animation:fbird-fall .6s ease forwards;}
@keyframes fbird-fall{to{transform:translateX(-50%) rotate(80deg) translateY(40px);opacity:.6}}
@media (max-width:380px){.fbird-task{font-size:.95rem;}.fbird-bird{font-size:2rem;}}
${/* 主题色占位，便于未来调色 */ ""}
.fbird-theme{color:${theme};}
`;
}

export function create(): FlyingBirdGame {
  return new FlyingBirdGame();
}
