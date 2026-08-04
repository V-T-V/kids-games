/* 踩云跳 Cloud Hop —— 云朵从右向左飘移，角色站在一朵云上，
   点一下跳到下一朵云（向右前方跳）。掉下去就结束。
   独特点：踩着云朵横移天空，跳跃时机判定。
   巧思：角色 x 固定，云从右向左飘；点击时若有云在角色右侧的可达范围内，
   就跳过去；云朵大小宽松，孩子容易踩中。
   难度 = 云间距 / 速度。通关 = 跳目标次数。
   注意：CSS 前缀 ch2-（clock-chime 用 ck2-，确认 ch2- 无冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

interface Cloud {
  x: number;
  y: number;
  el: HTMLDivElement;
}

export class CloudHopGame extends BaseGame {
  constructor() {
    super("cloud-hop");
  }

  private field!: HTMLDivElement;
  private hero!: HTMLDivElement;
  private clouds: Cloud[] = [];
  /** 角色 x（固定） */
  private heroX = 0;
  /** 角色当前所在云的索引 */
  private onCloud = 0;
  /** 跳跃中的起止坐标 */
  private jumping = false;
  private jumpT = 0;
  private jumpFromX = 0;
  private jumpFromY = 0;
  private jumpToX = 0;
  private jumpToY = 0;
  private score = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private speed = 0;
  private cloudGap = 0;
  private cloudW = 110;
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
    this.clouds = [];
    this.jumping = false;
    this.jumpT = 0;
    this.onCloud = 0;
    this.need =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 8 : 11;
    this.speed =
      this.difficulty === "easy"
        ? 80
        : this.difficulty === "medium"
          ? 105
          : 135;
    this.cloudGap =
      this.difficulty === "easy"
        ? 150
        : this.difficulty === "medium"
          ? 185
          : 220;

    const wrap = document.createElement("div");
    wrap.className = "ch2-wrap";
    const task = document.createElement("div");
    task.className = "ch2-task";
    task.innerHTML = `看到云朵靠近就 <b>点一下</b> 跳过去！跳 <b>${this.need}</b> 次 · <span id="ch2-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "ch2-field";
    this.hero = document.createElement("div");
    this.hero.className = "ch2-hero";
    this.hero.textContent = "🐰";
    this.field.appendChild(this.hero);
    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    this.unbind = bindPointer(this.field, { down: () => this.hop() });

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.heroX = r.width * 0.25;
      // 初始云：角色脚下放一朵，右侧依次排列
      const baseY = r.height * 0.55;
      this.spawnInitialClouds(r.width, baseY);
      this.hero.style.left = `${this.heroX}px`;
      this.hero.style.top = `${this.clouds[0]!.y - 30}px`;
      this.last = performance.now();
      this.loop();
    });
  }

  private spawnInitialClouds(fieldW: number, baseY: number): void {
    // 第一朵：角色脚下
    for (let i = 0; i < 5; i++) {
      const x = i === 0 ? this.heroX : this.heroX + i * this.cloudGap;
      this.addCloud(x, baseY + randInt(-20, 20));
    }
    void fieldW;
  }

  private addCloud(x: number, y: number): void {
    const el = document.createElement("div");
    el.className = "ch2-cloud";
    el.textContent = "☁️";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.field.appendChild(el);
    this.clouds.push({ x, y, el });
  }

  private hop(): void {
    if (this.over || this.jumping) return;
    // 找到角色右侧最近且可达的云
    let target: Cloud | null = null;
    for (const c of this.clouds) {
      if (c.x > this.heroX + 20 && c.x < this.heroX + this.cloudGap + 60) {
        target = c;
        break;
      }
    }
    if (!target) {
      // 没有云在可达范围，跳了会掉下去：判定失败
      this.fall();
      return;
    }
    this.jumping = true;
    this.jumpT = 0;
    this.jumpFromX = this.heroX;
    this.jumpFromY = parseFloat(this.hero.style.top) || 0;
    this.jumpToX = this.heroX; // 角色 x 固定（相对屏幕）
    this.jumpToY = target.y - 30;
    this.onCloud = this.clouds.indexOf(target);
    sfxPop();
  }

  private fall(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.hero.classList.add("ch2-hero--fall");
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      this.trackTimeout(() => this.startRound(), 900);
    }
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 云朵左飘
    for (const c of this.clouds) {
      c.x -= this.speed * dt;
      c.el.style.left = `${c.x}px`;
    }
    // 角色跟随当前云的 y（站在云上时）
    if (!this.jumping) {
      const cur = this.clouds[this.onCloud];
      if (cur) {
        this.hero.style.top = `${cur.y - 30}px`;
        this.hero.style.left = `${cur.x}px`;
        this.heroX = cur.x;
        // 当前云飘出左边：失败（角色跟着掉下）
        if (cur.x < -this.cloudW / 2) {
          this.fall();
          return;
        }
      }
    } else {
      // 跳跃插值
      this.jumpT += dt * 2.4; // 跳跃速度
      if (this.jumpT >= 1) {
        this.jumpT = 1;
        this.jumping = false;
        // 落到目标云
        this.score += 1;
        sfxPop();
        const sc = this.root.querySelector("#ch2-score");
        if (sc) sc.textContent = `${this.score} / ${this.need}`;
        const r = this.field.getBoundingClientRect();
        this.onCorrect(r.left + this.heroX, r.top + this.jumpToY);
        if (this.score >= this.need) {
          this.win();
          return;
        }
      }
      const t = this.jumpT;
      // 抛物线
      const x = this.jumpFromX + (this.jumpToX - this.jumpFromX) * t;
      const arc = -50 * Math.sin(Math.PI * t); // 向上拱起
      const y = this.jumpFromY + (this.jumpToY - this.jumpFromY) * t + arc;
      this.hero.style.left = `${x}px`;
      this.hero.style.top = `${y}px`;
    }

    // 补充云：最右一朵离右边足够远时再加一朵
    const last = this.clouds[this.clouds.length - 1];
    const r = this.field.getBoundingClientRect();
    if (last && r.width - last.x > this.cloudGap) {
      this.addCloud(last.x + this.cloudGap, r.height * 0.55 + randInt(-25, 25));
    }
    // 移除离屏云
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i]!;
      if (c.x < -this.cloudW) {
        c.el.remove();
        this.clouds.splice(i, 1);
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

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "☁️",
      variant: "rest",
      body: "掉下去啦，等云朵靠近再跳～",
      primary: {
        text: "再跳一次",
        icon: "🐰",
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
    if (document.getElementById("ch2-style")) return;
    const st = document.createElement("style");
    st.id = "ch2-style";
    st.textContent = CH2_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function CH2_CSS(_theme: string): string {
  return `
.ch2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.ch2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ch2-field{position:relative;width:100%;height:62vh;min-height:360px;background:linear-gradient(180deg,#6ec6ff 0%,#a8d8ff 50%,#d4f0ff 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:pointer;}
.ch2-field::before{content:"☀️";position:absolute;top:12px;right:24px;font-size:2.4rem;filter:drop-shadow(0 0 12px rgba(255,220,80,.6));z-index:1;}
.ch2-field::after{content:"🐦";position:absolute;top:35%;left:-30px;font-size:1.4rem;opacity:.5;animation:ch2-bird 16s linear infinite;z-index:1;}
@keyframes ch2-bird{from{transform:translateX(0)}to{transform:translateX(120vw)}}
.ch2-cloud{position:absolute;font-size:3rem;line-height:1;transform:translateX(-50%);z-index:3;filter:drop-shadow(0 4px 4px rgba(0,0,0,.15));will-change:left;pointer-events:none;user-select:none;}
.ch2-hero{position:absolute;font-size:2.2rem;line-height:1;transform:translateX(-50%);z-index:5;filter:drop-shadow(0 4px 4px rgba(0,0,0,.3));will-change:left,top;}
.ch2-hero--fall{animation:ch2-fall .7s ease forwards;}
@keyframes ch2-fall{0%{transform:translateX(-50%) translateY(0)}100%{transform:translateX(-50%) translateY(80px) rotate(60deg);opacity:.4}}
@media (max-width:380px){.ch2-task{font-size:.95rem;}.ch2-cloud{font-size:2.4rem;}.ch2-hero{font-size:1.8rem;}}
`;
}

export function create(): CloudHopGame {
  return new CloudHopGame();
}
