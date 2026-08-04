/* 刺猬滚 Hedgehog Roll —— 刺猬在地面自动向右滚动前进，路上有果子（加分/收集）
   和障碍（刺/荆棘，碰了要重开本关）。点击屏幕让刺猬跳起来，收集果子、跳过刺。
   独特点：节奏点击 + 收集。视觉：草地滚动 + 刺猬翻滚 + 果子 + 刺丛。
   难度 = 速度。通关 = 收集目标果子数。碰刺重开。RAF 驱动。前缀 hg-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface Item {
  x: number;
  /** kind: fruit 要收集，thorn 要跳过 */
  kind: "fruit" | "thorn";
  el: HTMLDivElement;
  done: boolean;
}

const FRUITS = ["🍎", "🍓", "🍒", "🍎", "🍐"] as const;

export class HedgehogRollGame extends BaseGame {
  constructor() {
    super("hedgehog-roll");
  }

  private field!: HTMLDivElement;
  private hedgehog!: HTMLDivElement;
  private items: Item[] = [];
  private py = 0; // 刺猬 y（相对 field 顶部）
  private vy = 0;
  private groundY = 0;
  private speed = 0;
  private need = 0;
  private got = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private scrollX = 0;
  private sinceSpawn = 0;
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
    this.items = [];
    this.got = 0;
    this.over = false;
    this.sinceSpawn = 0;
    this.need =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 9;
    this.speed =
      this.difficulty === "easy"
        ? 150
        : this.difficulty === "medium"
          ? 195
          : 240;

    const wrap = document.createElement("div");
    wrap.className = "hg-wrap";
    const task = document.createElement("div");
    task.className = "hg-task";
    task.innerHTML = `点击让刺猬跳！收果子躲刺 · <span id="hg-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "hg-field";

    this.hedgehog = document.createElement("div");
    this.hedgehog.className = "hg-hog";
    this.hedgehog.textContent = "🦔";
    this.field.appendChild(this.hedgehog);

    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    this.unbind = bindPointer(this.field, {
      down: () => this.jump(),
    });

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.groundY = r.height - 50;
      this.py = this.groundY;
      this.vy = 0;
      this.last = performance.now();
      this.loop();
    });
  }

  private jump(): void {
    if (this.over) return;
    if (this.py >= this.groundY - 1) {
      this.vy = -380;
      sfxPop();
    }
  }

  private spawn(): void {
    // 保证可解：交替出现，刺前面必有足够反应空间
    const isThorn = Math.random() < 0.45;
    const el = document.createElement("div");
    el.className = isThorn ? "hg-thorn" : "hg-fruit";
    el.textContent = isThorn ? sample(["🌵", "🌿"]) : sample(FRUITS);
    const r = this.field.getBoundingClientRect();
    const x = r.width + 30;
    el.style.left = `${x}px`;
    this.field.appendChild(el);
    this.items.push({ x, kind: isThorn ? "thorn" : "fruit", el, done: false });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    const r = this.field.getBoundingClientRect();
    const W = r.width;
    const hogX = 64;
    const hogSize = 38;

    // 重力
    this.vy += 1200 * dt;
    this.py += this.vy * dt;
    if (this.py > this.groundY) {
      this.py = this.groundY;
      this.vy = 0;
    }
    this.hedgehog.style.top = `${this.py - hogSize}px`;

    // 地面滚动
    this.scrollX = (this.scrollX - this.speed * dt) % 64;
    this.field.style.setProperty("--hg-scroll", `${this.scrollX}px`);

    // 生成（间隔随速度，保证至少有跳跃反应时间）
    this.sinceSpawn += dt;
    const spawnGap = this.difficulty === "hard" ? 0.95 : 1.15;
    if (this.sinceSpawn >= spawnGap) {
      this.sinceSpawn = 0;
      this.spawn();
    }

    // 物品移动 + 碰撞
    for (const it of this.items) {
      if (it.done) continue;
      it.x -= this.speed * dt;
      it.el.style.left = `${it.x}px`;
      // AABB 碰撞（物品大小 ~34）
      const itemSize = 34;
      const overlapX =
        hogX + hogSize / 2 > it.x && hogX - hogSize / 2 < it.x + itemSize;
      const itemTopY = this.groundY - itemSize;
      const overlapY = this.py > itemTopY - 6;
      if (overlapX && overlapY) {
        if (it.kind === "fruit") {
          it.done = true;
          it.el.classList.add("hg-got");
          this.got += 1;
          sfxPop();
          this.resetWrongStreak();
          const sc = this.root.querySelector("#hg-score");
          if (sc) sc.textContent = `${this.got} / ${this.need}`;
          this.trackTimeout(() => it.el.remove(), 300);
          if (this.got >= this.need) {
            this.win();
            return;
          }
        } else {
          // 撞刺
          this.hit();
          return;
        }
      }
    }
    // 清理离场
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]!;
      if (it.x < -60) {
        it.el.remove();
        this.items.splice(i, 1);
      }
    }
    void W;
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
        this.finishClear(starsByScore(this.need, [this.need, Math.ceil(this.need / 2)]),);
      } else {
        this.startRound();
      }
    }, 600);
  }

  private hit(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.hedgehog.classList.add("hg-hog--hit");
    const paused = this.onWrong();
    if (paused) {
      this.showRest(false);
    } else {
      // 短暂提示后重开本关（保证可通关）
      this.trackTimeout(() => this.startRound(), 900);
    }
  }

  private showRest(_won: boolean): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🦔",
      variant: "rest",
      body: "刺猬碰到刺啦～看到前面的刺就提前点一下跳过去！",
      primary: {
        text: "再来一次",
        icon: "🦔",
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
    if (document.getElementById("hg-style")) return;
    const st = document.createElement("style");
    st.id = "hg-style";
    st.textContent = HG_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function HG_CSS(theme: string): string {
  return `
.hg-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.hg-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.hg-task span{color:${theme};font-weight:900;}
.hg-field{position:relative;width:100%;height:58vh;min-height:340px;background:linear-gradient(180deg,#b3e5fc 0%,#c8e6a0 55%,#8bc34a 56%,#7cb342 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:pointer;}
.hg-field::before{content:"";position:absolute;left:var(--hg-scroll,0);bottom:0;height:50px;width:calc(100% + 128px);background:repeating-linear-gradient(90deg,#7cb342 0 32px,#689f38 32px 64px);box-shadow:inset 0 4px 0 rgba(255,255,255,.2);z-index:1;}
.hg-hog{position:absolute;left:64px;top:0;transform:translateX(-50%);font-size:2.4rem;line-height:1;z-index:5;filter:drop-shadow(0 3px 3px rgba(0,0,0,.2));will-change:top;animation:hg-roll .3s linear infinite;}
@keyframes hg-roll{from{transform:translateX(-50%) rotate(0)}to{transform:translateX(-50%) rotate(360deg)}}
.hg-fruit,.hg-thorn{position:absolute;bottom:32px;font-size:1.9rem;line-height:1;z-index:4;will-change:left;filter:drop-shadow(0 3px 2px rgba(0,0,0,.2));}
.hg-got{animation:hg-fly .3s ease forwards;}
@keyframes hg-fly{0%{transform:scale(1)}100%{transform:translateY(-30px) scale(1.6);opacity:0}}
.hg-hog--hit{animation:hg-fall .7s ease forwards;}
@keyframes hg-fall{0%{transform:translateX(-50%) rotate(0)}100%{transform:translateX(-50%) rotate(-80deg) translateY(18px);opacity:.5}}
@media (max-width:380px){.hg-hog{font-size:2rem;}.hg-fruit,.hg-thorn{font-size:1.6rem;}}
`;
}

export function create(): HedgehogRollGame {
  return new HedgehogRollGame();
}
