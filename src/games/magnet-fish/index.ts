/* 磁铁钓鱼 Magnet Fish —— 水里有不同颜色的鱼游动，
   每关指定一种颜色（"只吸红色的"），孩子拖动磁铁到对应颜色的鱼上把它吸走。
   独特点：颜色匹配 + 拖拽（磁铁碰到目标色鱼才生效，碰到别的鱼会弹开）。
   视觉：水池 + 游动鱼 + 可拖磁铁（带绳）。难度=鱼数/颜色数。
   通关=钓对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

interface Fish {
  el: HTMLDivElement;
  color: string;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  caught: boolean;
}

const FISH_KINDS = [
  { color: "red", emoji: "🐠" },
  { color: "yellow", emoji: "🐡" },
  { color: "blue", emoji: "🐟" },
  { color: "green", emoji: "🐠" },
];

export class MagnetFishGame extends BaseGame {
  constructor() {
    super("magnet-fish");
  }

  private raf = 0;
  private over = false;
  private fishes: Fish[] = [];
  private target = "";
  private need = 0;
  private caught = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private pool!: HTMLDivElement;
  private magnet!: HTMLDivElement;

  private dragging = false;
  private dragOffX = 0;
  private dragOffY = 0;
  private unbindMagnet: (() => void) | null = null;

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
    if (this.unbindMagnet) this.unbindMagnet();
    this.unbindMagnet = null;
  }

  private startRound(): void {
    this.over = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.unbindMagnet) this.unbindMagnet();
    this.unbindMagnet = null;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root.innerHTML = "";

    const kinds = shuffle(FISH_KINDS);
    const colorCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const fishCount =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 9;
    const palette = kinds.slice(0, colorCount);
    this.target = palette[0]!.color;
    this.need =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.caught = 0;
    this.fishes = [];

    const wrap = document.createElement("div");
    wrap.className = "mfs-wrap";
    const colorName =
      this.target === "red"
        ? "红"
        : this.target === "yellow"
          ? "黄"
          : this.target === "blue"
            ? "蓝"
            : "绿";
    const task = document.createElement("div");
    task.className = "mfs-task";
    task.innerHTML = `把<b>🧲磁铁</b>拖到 <span style="color:${this.targetColor()}">${colorName}</span>${palette[0]!.emoji} 鱼上！<br><span class="mfs-hint">磁铁只会吸${colorName}鱼～ 已钓 <b id="mfs-done">0</b> / ${this.need} · 第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const pool = document.createElement("div");
    pool.className = "mfs-pool";
    pool.id = "mfs-pool";
    this.pool = pool;

    // 生成鱼（保证至少 need 条目标色）
    const seq: typeof palette = [];
    for (let i = 0; i < this.need; i++) seq.push(palette[0]!);
    while (seq.length < fishCount)
      seq.push(palette[Math.floor(Math.random() * palette.length)]!);
    const fishRect = { w: 340, h: 240 };
    for (const k of shuffle(seq)) {
      this.spawnFish(k.color, k.emoji, fishRect);
    }

    wrap.appendChild(pool);
    this.root.appendChild(wrap);

    // 磁铁（绑在 pool 上，绝对定位）—— 等 pool 渲染后再放
    this.trackTimeout(() => this.spawnMagnet(), 50);

    this.loop();
  }

  private targetColor(): string {
    return this.target === "red"
      ? "#e53935"
      : this.target === "yellow"
        ? "#fdd835"
        : this.target === "blue"
          ? "#1e88e5"
          : "#43a047";
  }

  private spawnFish(
    color: string,
    emoji: string,
    r: { w: number; h: number },
  ): void {
    const el = document.createElement("div");
    el.className = "mfs-fish";
    el.textContent = emoji;
    el.dataset.color = color;
    const x = randInt(10, Math.max(40, r.w - 50));
    const y = randInt(20, Math.max(40, r.h - 50));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const sp =
      this.difficulty === "easy"
        ? 0.5
        : this.difficulty === "medium"
          ? 0.8
          : 1.1;
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.pool.appendChild(el);
    const f: Fish = { el, color, emoji, x, y, vx: dir * sp, caught: false };
    el.style.transform = dir < 0 ? "scaleX(-1)" : "scaleX(1)";
    this.fishes.push(f);
  }

  private spawnMagnet(): void {
    if (this.over) return;
    const magnet = document.createElement("div");
    magnet.className = "mfs-magnet";
    magnet.id = "mfs-magnet";
    magnet.textContent = "🧲";
    // 初始位置：水池顶部中央
    const r = this.pool.getBoundingClientRect();
    magnet.style.left = `${(r.width || 340) / 2 - 26}px`;
    magnet.style.top = `6px`;
    this.pool.appendChild(magnet);
    this.magnet = magnet;

    // 绑定拖拽（磁铁跟随指针）
    const onDown = (p: { x: number; y: number }) => {
      this.dragging = true;
      const pr = this.pool.getBoundingClientRect();
      const mr = magnet.getBoundingClientRect();
      this.dragOffX = p.x - (mr.left + mr.width / 2);
      this.dragOffY = p.y - (mr.top + mr.height / 2);
      magnet.classList.add("mfs-magnet--grab");
      void pr;
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!this.dragging) return;
      const pr = this.pool.getBoundingClientRect();
      const x = p.x - pr.left - this.dragOffX;
      const y = p.y - pr.top - this.dragOffY;
      magnet.style.left = `${x}px`;
      magnet.style.top = `${y}px`;
      this.checkCatch(x + 26, y + 26);
    };
    const onUp = () => {
      this.dragging = false;
      magnet.classList.remove("mfs-magnet--grab");
    };
    this.unbindMagnet = bindPointer(magnet, {
      down: onDown,
      move: onMove,
      up: onUp,
    });
    // 让整个 pool 都能响应 move（拖出磁铁也能跟随）
    const onMovePool = (p: { x: number; y: number }) => onMove(p);
    const u2 = bindPointer(this.pool, { move: onMovePool, up: onUp });
    const prev = this.unbindMagnet;
    this.unbindMagnet = () => {
      prev();
      u2();
    };
  }

  /** 检测磁铁中心是否碰到鱼 */
  private checkCatch(cx: number, cy: number): void {
    if (this.over) return;
    for (const f of this.fishes) {
      if (f.caught) continue;
      const fx = f.x + 22;
      const fy = f.y + 20;
      if (Math.hypot(cx - fx, cy - fy) < 30) {
        if (f.color === this.target) {
          // 吸走！
          f.caught = true;
          f.el.classList.add("mfs-fish--caught");
          this.trackTimeout(() => f.el.remove(), 400);
          this.caught += 1;
          this.resetWrongStreak();
          sfxPop();
          const r = f.el.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          const doneEl = this.root.querySelector("#mfs-done");
          if (doneEl) doneEl.textContent = String(this.caught);
          if (this.caught >= this.need) {
            this.over = true;
            cancelAnimationFrame(this.raf);
            this.raf = 0;
            this.trackTimeout(() => {
              this.roundsDone += 1;
              if (this.roundsDone >= this.roundTotal) {
                this.finishClear(starsByAccuracy(this.wrongCount));
              } else {
                this.startRound();
              }
            }, 600);
          }
        } else {
          // 不是目标色：磁铁被弹开一点（视觉反馈），算一次错误
          f.el.classList.add("mfs-fish--shake");
          this.trackTimeout(
            () => f.el.classList.remove("mfs-fish--shake"),
            300,
          );
          const paused = this.onWrong();
          if (paused) this.showRest();
          // 把磁铁推开避免连续触发
          this.dragging = false;
        }
        return;
      }
    }
  }

  private loop = (): void => {
    if (this.over) return;
    const r = this.pool.getBoundingClientRect();
    const w = r.width || 340;
    const h = r.height || 240;
    for (const f of this.fishes) {
      if (f.caught) continue;
      f.x += f.vx;
      if (f.x < 4) {
        f.x = 4;
        f.vx = Math.abs(f.vx);
        f.el.style.transform = "scaleX(1)";
      } else if (f.x > w - 48) {
        f.x = w - 48;
        f.vx = -Math.abs(f.vx);
        f.el.style.transform = "scaleX(-1)";
      }
      // 轻微纵向摆动
      f.y += Math.sin(Date.now() / 600 + f.x) * 0.15;
      if (f.y < 10) f.y = 10;
      if (f.y > h - 40) f.y = h - 40;
      f.el.style.left = `${f.x}px`;
      f.el.style.top = `${f.y}px`;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🧲",
      variant: "rest",
      body: "磁铁只会吸目标颜色的鱼哦，看清颜色再吸～",
      primary: { text: "继续", icon: "🎣", onClick: () => ov.destroy() },
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
    if (document.getElementById("mfs-style")) return;
    const st = document.createElement("style");
    st.id = "mfs-style";
    st.textContent = MFS_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function MFS_CSS(theme: string): string {
  return `
.mfs-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.mfs-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);max-width:440px;}
.mfs-task b{color:${theme};}
.mfs-hint{font-size:.82rem;color:var(--ink-soft);font-weight:700;}
.mfs-pool{position:relative;width:min(420px,94vw);height:340px;border-radius:24px;background:linear-gradient(180deg,#4fc3f7,#0277bd 80%);box-shadow:var(--shadow-lg);overflow:hidden;touch-action:none;}
.mfs-pool::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(255,255,255,.08) 0 8px,transparent 8px 20px);animation:mfs-wave 3.4s linear infinite;pointer-events:none;}
@keyframes mfs-wave{from{transform:translateY(0)}to{transform:translateY(20px)}}
.mfs-fish{position:absolute;font-size:2rem;cursor:default;user-select:none;transition:transform .2s;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));will-change:left,top;}
.mfs-fish--caught{animation:mfs-pull .4s ease forwards;}
@keyframes mfs-pull{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:translateY(-50px) scale(.6)}}
.mfs-fish--shake{animation:mfs-shake .3s ease;}
@keyframes mfs-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.mfs-magnet{position:absolute;width:52px;height:52px;font-size:2.2rem;display:flex;align-items:center;justify-content:center;cursor:grab;z-index:8;touch-action:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.4));}
.mfs-magnet::before{content:"";position:absolute;top:-40px;left:50%;width:3px;height:40px;background:repeating-linear-gradient(180deg,#6d4c41 0 6px,transparent 6px 10px);transform:translateX(-50%);}
.mfs-magnet--grab{cursor:grabbing;transform:scale(1.1);}
@media (max-width:380px){.mfs-pool{height:300px;}.mfs-magnet{width:46px;height:46px;font-size:1.9rem;}}
`;
}

export function create(): MagnetFishGame {
  return new MagnetFishGame();
}
