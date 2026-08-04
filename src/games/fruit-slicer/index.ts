/* 切水果 Fruit Slicer —— 水果从底部抛起做抛物线下落，孩子划过/点击切开得分，
   避开炸弹💣。独特点：抛物线物理 + 切开瞬间的汁溅效果，锻炼手眼协调。
   巧思：用 RAF 驱动抛物线 + 拖拽轨迹切割判定；命中窗口宽松，孩子容易切到。
   难度 = 水果数 / 炸弹频率 / 速度。通关 = 切到目标水果数。碰炸弹重开本关。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, randInt } from "../../lobby/util.ts";

const FRUITS = ["🍉", "🍎", "🍊", "🍓", "🍇", "🍌", "🥝", "🍑"];
const HALF: Record<string, string> = {
  "🍉": "🍉",
  "🍎": "🍎",
  "🍊": "🍊",
  "🍓": "🍓",
  "🍇": "🍇",
  "🍌": "🍌",
  "🥝": "🥝",
  "🍑": "🍑",
};

interface Fly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  emoji: string;
  isBomb: boolean;
  sliced: boolean;
  el: HTMLDivElement;
  rot: number;
  vr: number;
}

export class FruitSlicerGame extends BaseGame {
  constructor() {
    super("fruit-slicer");
  }

  private field!: HTMLDivElement;
  private flies: Fly[] = [];
  private score = 0;
  private need = 0;
  private raf = 0;
  private last = 0;
  private over = false;
  private roundsDone = 0;
  private roundTotal = 0;
  private speed = 0;
  private bombRate = 0;
  private spawnGap = 0;
  private sinceSpawn = 0;
  private unbind: (() => void) | null = null;
  private W = 0;
  private H = 0;
  private pointerDown = false;
  private lastPX = 0;
  private lastPY = 0;

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
    this.flies = [];
    this.sinceSpawn = 0;
    this.need =
      this.difficulty === "easy" ? 6 : this.difficulty === "medium" ? 9 : 12;
    this.speed =
      this.difficulty === "easy"
        ? 0.85
        : this.difficulty === "medium"
          ? 1
          : 1.15;
    this.bombRate =
      this.difficulty === "easy"
        ? 0.08
        : this.difficulty === "medium"
          ? 0.14
          : 0.2;
    this.spawnGap =
      this.difficulty === "easy"
        ? 0.95
        : this.difficulty === "medium"
          ? 0.7
          : 0.55;

    const wrap = document.createElement("div");
    wrap.className = "fsl-wrap";
    const task = document.createElement("div");
    task.className = "fsl-task";
    task.innerHTML = `划过切开水果！别切💣 切到 <b>${this.need}</b> 个 · <span id="fsl-score">0 / ${this.need}</span>`;
    wrap.appendChild(task);

    this.field = document.createElement("div");
    this.field.className = "fsl-field";
    wrap.appendChild(this.field);
    this.root.appendChild(wrap);

    this.unbind = bindPointer(this.field, {
      down: (p) => {
        this.pointerDown = true;
        this.lastPX = p.x;
        this.lastPY = p.y;
        this.trySlice(p.x, p.y);
      },
      move: (p) => {
        if (this.pointerDown) this.trySlice(p.x, p.y);
        this.lastPX = p.x;
        this.lastPY = p.y;
      },
      up: () => {
        this.pointerDown = false;
      },
    });

    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect();
      this.W = r.width;
      this.H = r.height;
      this.last = performance.now();
      this.loop();
    });
  }

  /** 客户端坐标 → field 内坐标 */
  private toLocal(cx: number, cy: number): { x: number; y: number } {
    const r = this.field.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  }

  private trySlice(cx: number, cy: number): void {
    if (this.over) return;
    const { x, y } = this.toLocal(cx, cy);
    for (const f of this.flies) {
      if (f.sliced) continue;
      const dx = f.x - x;
      const dy = f.y - y;
      if (dx * dx + dy * dy < 42 * 42) {
        this.slice(f);
      }
    }
  }

  private slice(f: Fly): void {
    f.sliced = true;
    if (f.isBomb) {
      // 切到炸弹：失败
      f.el.classList.add("fsl-bomb--boom");
      this.end();
      return;
    }
    // 切开动画：分两半飞散
    f.el.textContent = HALF[f.emoji] ?? f.emoji;
    f.el.classList.add("fsl-fruit--cut");
    this.score += 1;
    sfxPop();
    this.resetWrongStreak();
    const sc = this.root.querySelector("#fsl-score");
    if (sc) sc.textContent = `${this.score} / ${this.need}`;
    const r = this.field.getBoundingClientRect();
    this.onCorrect(r.left + f.x, r.top + f.y);
    // 飞散后移除
    this.trackTimeout(() => {
      f.el.remove();
    }, 380);
    if (this.score >= this.need) {
      this.win();
    }
  }

  private spawnFly(): void {
    const isBomb = Math.random() < this.bombRate;
    const emoji = isBomb ? "💣" : sample(FRUITS);
    const el = document.createElement("div");
    el.className = isBomb ? "fsl-bomb" : "fsl-fruit";
    el.textContent = emoji;
    this.field.appendChild(el);
    // 从底部抛起，x 在屏幕宽度内随机
    const x = randInt(this.W * 0.2, this.W * 0.8);
    const y = this.H + 30;
    // 抛物线：vx 朝中心，vy 向上
    const towardCenter = x < this.W / 2 ? 1 : -1;
    const vx = towardCenter * randInt(20, 60) * this.speed;
    const vy = -randInt(560, 680) * this.speed;
    this.flies.push({
      x,
      y,
      vx,
      vy,
      emoji,
      isBomb,
      sliced: false,
      el,
      rot: randInt(0, 360),
      vr: randInt(-120, 120),
    });
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 生成
    this.sinceSpawn += dt;
    if (this.sinceSpawn >= this.spawnGap) {
      this.sinceSpawn = 0;
      this.spawnFly();
      // easy 时偶尔一次抛两个水果，提高趣味
      if (this.difficulty !== "easy" && Math.random() < 0.3) this.spawnFly();
    }

    // 物理 + 渲染
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i]!;
      if (f.sliced) {
        // 切开的水果继续按物理飞散（仅水果）
        if (!f.isBomb) {
          f.x += f.vx * dt * 0.6;
          f.y += f.vy * dt * 0.6;
          f.vy += 900 * dt;
          f.rot += f.vr * dt;
        }
      } else {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy += 950 * dt; // 重力
        f.rot += f.vr * dt;
      }
      f.el.style.left = `${f.x}px`;
      f.el.style.top = `${f.y}px`;
      f.el.style.transform = `translate(-50%,-50%) rotate(${f.rot}deg)`;

      // 跌出屏幕底部移除
      if (f.y > this.H + 60) {
        f.el.remove();
        this.flies.splice(i, 1);
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

  private end(): void {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const paused = this.onWrong();
    if (paused) {
      this.showRest();
    } else {
      // 重开本关，保证可通关
      this.trackTimeout(() => this.startRound(), 900);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "💣",
      variant: "rest",
      body: "切到炸弹啦，小心避开它～",
      primary: {
        text: "再切一次",
        icon: "🍉",
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
    if (document.getElementById("fsl-style")) return;
    const st = document.createElement("style");
    st.id = "fsl-style";
    st.textContent = FSL_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function FSL_CSS(theme: string): string {
  return `
.fsl-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.fsl-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.fsl-field{position:relative;width:100%;height:62vh;min-height:360px;background:linear-gradient(180deg,#3a1c5a 0%,#6a2d8f 45%,#c1487a 100%);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:crosshair;}
.fsl-field::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 90%,rgba(255,200,80,.25),transparent 60%);pointer-events:none;}
.fsl-fruit,.fsl-bomb{position:absolute;left:0;top:0;font-size:2.6rem;line-height:1;transform:translate(-50%,-50%);will-change:left,top,transform;filter:drop-shadow(0 4px 4px rgba(0,0,0,.35));user-select:none;pointer-events:none;}
.fsl-fruit--cut{animation:fsl-cut .38s ease forwards;}
@keyframes fsl-cut{0%{filter:brightness(1.6) drop-shadow(0 0 10px ${theme})}100%{opacity:0;transform:translate(-50%,-50%) scale(1.4) rotate(180deg)}}
.fsl-bomb--boom{animation:fsl-boom .4s ease forwards;}
@keyframes fsl-boom{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.8);filter:brightness(2) drop-shadow(0 0 20px #ff3b30)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.2)}}
@media (max-width:380px){.fsl-task{font-size:.95rem;}.fsl-fruit,.fsl-bomb{font-size:2.2rem;}}
`;
}

export function create(): FruitSlicerGame {
  return new FruitSlicerGame();
}
