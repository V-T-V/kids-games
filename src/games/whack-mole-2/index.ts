/* 打地鼠进阶 Whack Mole 2 —— Go/No-Go 反应抑制任务。
   独特点：地鼠冒出来要打（+1），但炸弹💣冒出来绝对不能打（-1）！
   训练反应抑制（控制冲动）。难度=出现速度 + 炸弹频率。
   巧思：地鼠和炸弹从洞里冒出，限时内累计得分达标过关；
   打地鼠加 sfxPop 粒子，打炸弹红闪扣分。前缀 wm2-（区别原打地鼠 wm-）。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByScore } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

const MOLES = ["🐭", "🐹", "🐰"] as const;

interface Spawn {
  idx: number;
  isBomb: boolean;
  el: HTMLButtonElement;
  hit: boolean;
}

/** 各难度：[出现间隔ms, 显示时长ms, 炸弹概率, 目标分] */
function config(
  diff: "easy" | "medium" | "hard",
): { interval: number; showMs: number; bombRate: number; goal: number; seconds: number } {
  if (diff === "easy")
    return { interval: 1100, showMs: 1500, bombRate: 0.25, goal: 8, seconds: 30 };
  if (diff === "medium")
    return { interval: 850, showMs: 1200, bombRate: 0.35, goal: 12, seconds: 30 };
  return { interval: 650, showMs: 950, bombRate: 0.45, goal: 16, seconds: 30 };
}

export class WhackMole2Game extends BaseGame {
  constructor() {
    super("whack-mole-2");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private holes: HTMLDivElement[] = [];
  private spawns: Spawn[] = [];
  private score = 0;
  private timeLeft = 0;
  private goal = 0;
  private timerId: number | null = null;
  private spawnerId: number | null = null;
  private scoreLabel!: HTMLDivElement;
  private timeLabel!: HTMLDivElement;
  private roundOver = true;

  protected mount(): void {
    this.roundTotal = this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.spawnerId !== null) {
      window.clearTimeout(this.spawnerId);
      this.spawnerId = null;
    }
  }

  private startRound(): void {
    this.cleanup();
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.roundOver = false;
    const cfg = config(this.difficulty);
    this.score = 0;
    this.goal = cfg.goal;
    this.timeLeft = cfg.seconds;
    this.spawns = [];

    const wrap = document.createElement("div");
    wrap.className = "wm2-wrap";

    const bar = document.createElement("div");
    bar.className = "wm2-bar";
    this.scoreLabel = document.createElement("div");
    this.scoreLabel.className = "wm2-score";
    this.scoreLabel.textContent = `🎯 0 / ${this.goal}`;
    this.timeLabel = document.createElement("div");
    this.timeLabel.className = "wm2-time";
    this.timeLabel.textContent = `⏱️ ${this.timeLeft}s`;
    bar.appendChild(this.scoreLabel);
    bar.appendChild(this.timeLabel);
    wrap.appendChild(bar);

    const warn = document.createElement("div");
    warn.className = "wm2-warn";
    warn.innerHTML = `打地鼠 <b>${sample([...MOLES])}</b> +1 &nbsp;·&nbsp; <b>💣炸弹别打！</b> -1`;
    wrap.appendChild(warn);

    const field = document.createElement("div");
    field.className = "wm2-field";
    const cols = 4;
    const rows = 3;
    this.holes = [];
    for (let i = 0; i < cols * rows; i++) {
      const hole = document.createElement("div");
      hole.className = "wm2-hole";
      field.appendChild(hole);
      this.holes.push(hole);
    }
    wrap.appendChild(field);
    this.root.appendChild(wrap);

    // 生成器：按间隔冒出地鼠或炸弹
    const spawn = (): void => {
      if (this.roundOver) return;
      this.spawnOne(cfg.showMs, cfg.bombRate);
      this.spawnerId = window.setTimeout(spawn, cfg.interval);
    };
    this.spawnerId = window.setTimeout(spawn, 600);

    // 倒计时
    this.timerId = window.setInterval(() => {
      if (this.roundOver) return;
      this.timeLeft -= 1;
      this.timeLabel.textContent = `⏱️ ${this.timeLeft}s`;
      if (this.timeLeft <= 5) this.timeLabel.classList.add("wm2-time--low");
      if (this.timeLeft <= 0) {
        this.timeUp();
      }
    }, 1000);
  }

  private spawnOne(showMs: number, bombRate: number): void {
    // 选一个空洞
    const free = this.holes
      .map((h, i) => (h.childElementCount === 0 ? i : -1))
      .filter((i) => i >= 0);
    if (free.length === 0) return;
    const idx = sample(free);
    const isBomb = Math.random() < bombRate;
    const hole = this.holes[idx]!;

    const b = document.createElement("button");
    b.type = "button";
    b.className = `wm2-pop ${isBomb ? "wm2-pop--bomb" : "wm2-pop--mole"}`;
    b.textContent = isBomb ? "💣" : sample([...MOLES]);
    const spawn: Spawn = { idx, isBomb, el: b, hit: false };
    b.addEventListener("click", () => this.hit(spawn));
    hole.appendChild(b);
    this.spawns.push(spawn);

    // 自动消失
    this.trackTimeout(() => {
      if (!spawn.hit && spawn.el.isConnected) {
        spawn.el.classList.add("wm2-pop--hide");
        this.trackTimeout(() => spawn.el.remove(), 250);
      }
    }, showMs);
  }

  private hit(spawn: Spawn): void {
    if (this.roundOver || spawn.hit) return;
    spawn.hit = true;
    const r = spawn.el.getBoundingClientRect();
    if (spawn.isBomb) {
      // 打了炸弹：扣分
      this.score = Math.max(0, this.score - 1);
      spawn.el.classList.add("wm2-pop--boom");
      this.trackTimeout(() => spawn.el.remove(), 300);
      const paused = this.onWrong();
      this.updateScore();
      if (paused) {
        this.roundOver = true;
        this.showRest();
      }
    } else {
      // 打中地鼠：加分
      this.score += 1;
      spawn.el.classList.add("wm2-pop--hit");
      this.trackTimeout(() => spawn.el.remove(), 300);
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      sfxPop();
      this.resetWrongStreak();
      this.updateScore();
      if (this.score >= this.goal) {
        this.roundDone(true);
      }
    }
  }

  private updateScore(): void {
    this.scoreLabel.textContent = `🎯 ${this.score} / ${this.goal}`;
  }

  private timeUp(): void {
    this.roundDone(this.score >= this.goal);
  }

  private roundDone(passed: boolean): void {
    if (this.roundOver) return;
    this.roundOver = true;
    this.cleanup();
    if (passed) {
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          // 综合得分与炸弹惩罚算星
          const stars = starsByScore(this.score, [this.goal, Math.ceil(this.goal * 0.7)]);
          this.finishClear(stars);
        } else {
          this.startRound();
        }
      }, 800);
    } else {
      // 未达标：算答错一次，进休息或重开
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
      } else {
        this.trackTimeout(() => this.startRound(), 900);
      }
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "记住：炸弹💣绝对不能打！只打小动物就好啦～",
      primary: {
        text: "继续",
        icon: "🎈",
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
    if (document.getElementById("wm2-style")) return;
    const st = document.createElement("style");
    st.id = "wm2-style";
    st.textContent = WM2_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function WM2_CSS(theme: string): string {
  return `
.wm2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(520px,100%);}
.wm2-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;width:min(460px,94%);background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.wm2-score{font-size:1.15rem;font-weight:900;color:${theme};}
.wm2-time{font-size:1.1rem;font-weight:900;color:#555;}
.wm2-time--low{color:#ff6348;animation:wm2-blink .6s ease-in-out infinite;}
@keyframes wm2-blink{0%,100%{opacity:1}50%{opacity:.5}}
.wm2-warn{font-size:1rem;font-weight:800;text-align:center;background:#fff8e1;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
.wm2-warn b{color:#ff6348;}
.wm2-field{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;padding:30px 24px;background:linear-gradient(#c8a06a,#a87a48);border-radius:26px;box-shadow:var(--shadow);width:min(460px,96%);}
.wm2-hole{position:relative;width:100%;aspect-ratio:1;min-width:56px;min-height:56px;background:radial-gradient(ellipse at center 70%,#5a3a1a 0%,#3a2208 60%,transparent 75%);border-radius:50%;overflow:hidden;display:flex;align-items:flex-end;justify-content:center;}
.wm2-pop{position:relative;font-size:clamp(1.8rem,7vw,2.6rem);background:transparent;border:none;line-height:1;cursor:pointer;transform:translateY(120%);animation:wm2-rise .25s ease forwards;touch-action:manipulation;padding:0 0 6px;}
@keyframes wm2-rise{to{transform:translateY(10%);}}
.wm2-pop--hide{animation:wm2-sink .25s ease forwards;}
@keyframes wm2-sink{to{transform:translateY(120%);opacity:0;}}
.wm2-pop--mole{filter:drop-shadow(0 2px 3px rgba(0,0,0,.3));}
.wm2-pop--bomb{filter:drop-shadow(0 2px 3px rgba(0,0,0,.3));}
.wm2-pop--hit{animation:wm2-hit .3s ease forwards;}
@keyframes wm2-hit{0%{transform:scale(1)}50%{transform:scale(1.5) rotate(20deg)}100%{transform:scale(0);opacity:0;}}
.wm2-pop--boom{animation:wm2-boom .3s ease forwards;}
@keyframes wm2-boom{0%{transform:scale(1)}50%{transform:scale(1.8);filter:brightness(2) drop-shadow(0 0 12px #ff6348)}100%{transform:scale(0);opacity:0;}}
@media (max-width:380px){.wm2-field{gap:10px;padding:18px 12px;}}
`;
}

export function create(): WhackMole2Game {
  return new WhackMole2Game();
}
