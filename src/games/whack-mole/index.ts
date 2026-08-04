/* 打地鼠 Whack Mole —— 限时击中冒出的地鼠，避开炸弹。
   巧思：锤子跟随指针，击中有粒子；难度=地鼠速度/炸弹频率。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

export class WhackMoleGame extends BaseGame {
  constructor() {
    super("whack-mole");
  }

  private holes: HTMLDivElement[] = [];
  private score = 0;
  private timeLeft = 0;
  private timer: number | null = null;
  private spawner: number | null = null;
  private timeLabel!: HTMLDivElement;
  private scoreLabel!: HTMLDivElement;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.injectStyle();
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundsDone = 0;
    this.startGame();
  }
  protected unmount(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.timer) window.clearInterval(this.timer);
    if (this.spawner) window.clearInterval(this.spawner);
    this.timer = null;
    this.spawner = null;
  }

  private startGame(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.score = 0;
    this.over = false;
    const seconds =
      this.difficulty === "easy" ? 30 : this.difficulty === "medium" ? 25 : 20;
    this.timeLeft = seconds;

    const wrap = document.createElement("div");
    wrap.className = "wm-wrap";
    const bar = document.createElement("div");
    bar.className = "wm-bar";
    this.scoreLabel = document.createElement("div");
    this.scoreLabel.textContent = "🍅 0";
    this.timeLabel = document.createElement("div");
    this.timeLabel.textContent = `⏱️ ${this.timeLeft}`;
    bar.appendChild(this.scoreLabel);
    bar.appendChild(this.timeLabel);
    wrap.appendChild(bar);

    const field = document.createElement("div");
    field.className = "wm-field";
    field.style.setProperty(
      "--cols",
      String(this.difficulty === "easy" ? 3 : 4),
    );
    this.holes = [];
    for (let i = 0; i < (this.difficulty === "easy" ? 9 : 12); i++) {
      const h = document.createElement("div");
      h.className = "wm-hole";
      h.innerHTML = `<div class="wm-mound"></div><div class="wm-creature"></div>`;
      field.appendChild(h);
      this.holes.push(h);
    }
    wrap.appendChild(field);
    this.root.appendChild(wrap);

    // 计时
    this.timer = window.setInterval(() => {
      this.timeLeft -= 1;
      this.timeLabel.textContent = `⏱️ ${this.timeLeft}`;
      if (this.timeLeft <= 0) this.endGame();
    }, 1000);

    // 出怪间隔
    const interval =
      this.difficulty === "easy"
        ? 850
        : this.difficulty === "medium"
          ? 650
          : 480;
    this.spawner = window.setInterval(() => this.spawn(), interval);
  }

  private spawn(): void {
    if (this.over) return;
    const empty = this.holes.filter(
      (h) => !h.classList.contains("wm-hole--up"),
    );
    if (empty.length === 0) return;
    const hole = empty[randInt(0, empty.length - 1)]!;
    const isBomb = Math.random() < (this.difficulty === "hard" ? 0.28 : 0.15);
    const creature = hole.querySelector(".wm-creature")!;
    creature.textContent = isBomb ? "💣" : "🐹";
    hole.dataset.bomb = isBomb ? "1" : "0";
    hole.classList.add("wm-hole--up");

    const upMs =
      this.difficulty === "easy"
        ? 1100
        : this.difficulty === "medium"
          ? 850
          : 650;
    this.trackTimeout(() => {
      if (!hole.classList.contains("wm-hole--hit")) {
        hole.classList.remove("wm-hole--up");
        hole.classList.remove("wm-hole--hit");
      }
    }, upMs);

    // 点击处理
    const hit = () => {
      if (!hole.classList.contains("wm-hole--up") || this.over) return;
      hole.classList.add("wm-hole--hit");
      hole.classList.remove("wm-hole--up");
      if (hole.dataset.bomb === "1") {
        // 打到炸弹扣分
        this.score = Math.max(0, this.score - 2);
        this.onWrong();
      } else {
        this.score += 1;
        sfxPop();
        const r = hole.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top);
        this.resetWrongStreak();
      }
      this.scoreLabel.textContent = `🍅 ${this.score}`;
    };
    hole.onclick = hit;
  }

  private endGame(): void {
    this.over = true;
    this.cleanup();
    const stars = this.score >= 15 ? 3 : this.score >= 8 ? 2 : 1;
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        this.finishClear(stars);
      } else {
        this.startGame();
      }
    }, 600);
  }

  private injectStyle(): void {
    if (document.getElementById("wm-style")) return;
    const st = document.createElement("style");
    st.id = "wm-style";
    st.textContent = WM_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function WM_CSS(theme: string): string {
  return `
.wm-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.wm-bar{display:flex;gap:24px;font-size:1.4rem;font-weight:800;background:#fff;padding:8px 24px;border-radius:999px;box-shadow:var(--shadow);}
.wm-field{display:grid;grid-template-columns:repeat(var(--cols,3),1fr);gap:14px;padding:16px;}
.wm-hole{position:relative;width:100px;height:80px;overflow:hidden;}
.wm-mound{position:absolute;bottom:0;left:0;right:0;height:30px;background:${theme};border-radius:50% 50% 0 0;box-shadow:inset 0 -6px 0 rgba(0,0,0,.15);}
.wm-creature{position:absolute;bottom:-90px;left:50%;transform:translateX(-50%);font-size:2.6rem;transition:bottom .15s ease;width:70px;text-align:center;}
.wm-hole--up .wm-creature{bottom:8px;}
.wm-hole--hit .wm-creature{animation:wm-bonk .3s ease;}
@keyframes wm-bonk{0%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.3) rotate(20deg)}100%{transform:translateX(-50%) scale(0)}}
@media (max-width:380px){.wm-hole{width:78px;height:64px;}.wm-creature{font-size:2rem;}}
`;
}

export function create(): WhackMoleGame {
  return new WhackMoleGame();
}
