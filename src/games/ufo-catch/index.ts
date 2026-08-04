/* UFO吸物 UFO Catch —— UFO 在上方，题目给出颜色要求，
   拖动 UFO 到对应颜色的物品上方即可吸起。
   独特点：拖拽玩法 + 颜色匹配判定，每关换一个目标色；
   物品颜色保证目标色至少存在一个，避免无解。
   视觉：星空夜空 + UFO 光束 + 地面彩色物品。用 bindPointer 拖拽。
   难度 = 物品数。通关 = 吸对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { createRafLoop } from "../../core/loop.ts";
import { shuffle, sample, getCssVar } from "../../lobby/util.ts";

interface Item {
  el: HTMLDivElement;
  color: string;
  emoji: string;
  x: number;
  y: number;
  taken: boolean;
}

const COLORS: Array<{ name: string; hex: string }> = [
  { name: "红色", hex: "#ff6348" },
  { name: "黄色", hex: "#ffd93d" },
  { name: "蓝色", hex: "#4d96ff" },
  { name: "绿色", hex: "#6bcf7f" },
  { name: "紫色", hex: "#a55eea" },
  { name: "橙色", hex: "#ff9f43" },
];

const ITEM_EMOJI = ["🎁", "🧸", "📦", "🎈", "🪀", "🧩", "⚽", "🍎"] as const;

export class UfoCatchGame extends BaseGame {
  constructor() {
    super("ufo-catch");
  }

  private sceneEl!: HTMLDivElement;
  private ufoEl!: HTMLDivElement;
  private beamEl!: HTMLDivElement;
  private items: Item[] = [];
  private targetColor = "";
  private targetName = "";
  private roundsDone = 0;
  private roundTotal = 0;
  private over = false;
  private dragging = false;
  private ux = 0;
  private uy = 0;
  private stop?: () => void;
  private unbind: (() => void) | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    this.stop?.();
    this.stop = undefined;
    this.unbind?.();
    this.unbind = null;
  }

  private itemCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 5
        : 6;
  }

  private startRound(): void {
    this.over = false;
    this.items = [];
    this.root.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "ufo-wrap";

    /* 选目标色 */
    const target = sample(COLORS);
    this.targetColor = target.hex;
    this.targetName = target.name;

    const task = document.createElement("div");
    task.className = "ufo-task";
    task.innerHTML = `拖动 🛸 吸起 <span class="ufo-chip" style="background:${target.hex}">${target.name}</span> 的物品！<span class="ufo-prog">${this.roundsDone + 1}/${this.roundTotal}</span>`;
    wrap.appendChild(task);

    this.sceneEl = document.createElement("div");
    this.sceneEl.className = "ufo-scene";
    this.ufoEl = document.createElement("div");
    this.ufoEl.className = "ufo-ship";
    this.ufoEl.textContent = "🛸";
    this.beamEl = document.createElement("div");
    this.beamEl.className = "ufo-beam";
    this.beamEl.style.display = "none";
    this.sceneEl.appendChild(this.beamEl);
    this.sceneEl.appendChild(this.ufoEl);
    wrap.appendChild(this.sceneEl);
    this.root.appendChild(wrap);

    requestAnimationFrame(() => {
      const r = this.sceneEl.getBoundingClientRect();
      const n = this.itemCount();
      /* 颜色集合：必含目标色，其余从池中随机取 */
      const otherColors = shuffle(COLORS.filter((c) => c.hex !== target.hex));
      const palette = [target, ...otherColors.slice(0, n - 1)];
      const colors = shuffle(palette);

      const margin = 36;
      const usable = r.width - margin * 2;
      const yBase = r.height - 46;
      const emojiShuffled = shuffle([...ITEM_EMOJI]);
      for (let i = 0; i < n; i++) {
        const c = colors[i] ?? target;
        const el = document.createElement("div");
        el.className = "ufo-item";
        const emoji = emojiShuffled[i % emojiShuffled.length] ?? "🎁";
        el.textContent = emoji;
        el.style.setProperty("--ufo-c", c.hex);
        const x = margin + (usable * i) / Math.max(1, n - 1);
        el.style.left = `${x}px`;
        el.style.top = `${yBase}px`;
        this.sceneEl.appendChild(el);
        this.items.push({ el, color: c.hex, emoji, x, y: yBase, taken: false });
      }
      /* UFO 起始位置：顶部居中 */
      this.ux = r.width / 2;
      this.uy = 40;
      this.placeUfo();
    });

    this.unbind = bindPointer(this.sceneEl, {
      down: (p) => {
        this.dragging = true;
        this.moveUfo(p);
      },
      move: (p) => {
        if (this.dragging) this.moveUfo(p);
      },
      up: () => {
        this.dragging = false;
      },
    });

    this.stop = createRafLoop(() => this.tick());
  }

  private moveUfo(p: { x: number; y: number }): void {
    if (this.over) return;
    const r = this.sceneEl.getBoundingClientRect();
    const x = Math.max(34, Math.min(r.width - 34, p.x - r.left));
    const y = Math.max(34, Math.min(r.height - 60, p.y - r.top));
    this.ux = x;
    this.uy = y;
    this.placeUfo();
  }

  private placeUfo(): void {
    this.ufoEl.style.left = `${this.ux}px`;
    this.ufoEl.style.top = `${this.uy}px`;
    /* 光束跟随，从 UFO 向下延伸到地面 */
    this.beamEl.style.left = `${this.ux}px`;
    this.beamEl.style.top = `${this.uy + 18}px`;
  }

  private tick = (): void => {
    if (this.over) {
      this.stop?.();
      this.stop = undefined;
      return;
    }
    /* UFO 低空且接近物品 → 吸起判定 */
    let hovering = false;
    for (const it of this.items) {
      if (it.taken) continue;
      const dx = Math.abs(this.ux - it.x);
      const dy = this.uy - it.y;
      const near = dx < 30 && dy < 90 && dy > -10;
      if (near) {
        hovering = true;
        if (dx < 28 && dy < 60) {
          if (it.color === this.targetColor) {
            this.suck(it);
          } else if (this.dragging) {
            /* 错色：闪一下提示，不吸 */
            it.el.classList.remove("ufo-item--bad");
            void it.el.offsetWidth;
            it.el.classList.add("ufo-item--bad");
          }
        }
      }
    }
    /* 拖动中显示光束 */
    this.beamEl.style.display = this.dragging || hovering ? "block" : "none";
  };

  private suck(it: Item): void {
    if (this.over || it.taken) return;
    it.taken = true;
    sfxPop();
    const ir = it.el.getBoundingClientRect();
    this.onCorrect(ir.left + ir.width / 2, ir.top + ir.height / 2);
    this.resetWrongStreak();
    it.el.classList.add("ufo-item--up");
    /* 飞向 UFO */
    const dx = this.ux - it.x;
    const dy = this.uy - it.y;
    it.el.style.setProperty("--ufo-dx", `${dx}px`);
    it.el.style.setProperty("--ufo-dy", `${dy}px`);
    this.trackTimeout(() => it.el.remove(), 600);

    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    if (this.roundsDone >= this.roundTotal) {
      this.over = true;
      this.trackTimeout(() => {
        this.finishClear(starsByAccuracy(this.wrongCount));
      }, 700);
    } else {
      /* 下一轮换目标色 */
      this.trackTimeout(() => this.startRound(), 700);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("ufo-style")) return;
    const st = document.createElement("style");
    st.id = "ufo-style";
    st.textContent = UFO_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function UFO_CSS(theme: string): string {
  return `
.ufo-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(460px,100%);}
.ufo-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;}
.ufo-chip{color:#fff;padding:3px 12px;border-radius:999px;font-size:.95rem;box-shadow:0 2px 4px rgba(0,0,0,.2);}
.ufo-prog{background:${theme};color:#fff;padding:2px 10px;border-radius:999px;font-size:.85rem;}
.ufo-scene{position:relative;width:100%;height:62vh;min-height:360px;background:linear-gradient(180deg,#0a0a2e 0%,#1a1a4a 50%,#2a2a5a 80%,#3a3a1a 100%);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);touch-action:none;cursor:grab;}
.ufo-scene:active{cursor:grabbing;}
.ufo-scene::before{content:"";position:absolute;inset:0;background-image:radial-gradient(1px 1px at 15% 20%,#fff,transparent),radial-gradient(1px 1px at 70% 15%,#fff,transparent),radial-gradient(1px 1px at 40% 35%,#fff,transparent),radial-gradient(2px 2px at 85% 30%,#fff,transparent),radial-gradient(1px 1px at 25% 45%,#fff,transparent);opacity:.6;pointer-events:none;}
.ufo-scene::after{content:"";position:absolute;left:0;right:0;bottom:0;height:36px;background:linear-gradient(180deg,#5a4a2a,#3a2a1a);box-shadow:inset 0 3px 0 rgba(255,255,255,.1);}
.ufo-ship{position:absolute;font-size:2.6rem;line-height:1;transform:translate(-50%,-50%);z-index:6;filter:drop-shadow(0 4px 6px rgba(0,0,0,.4));will-change:left,top;pointer-events:none;animation:ufo-wob .6s ease-in-out infinite alternate;}
@keyframes ufo-wob{from{transform:translate(-50%,-50%) rotate(-4deg)}to{transform:translate(-50%,-50%) rotate(4deg)}}
.ufo-beam{position:absolute;width:60px;height:120px;transform:translateX(-50%);z-index:5;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,150,.55),rgba(255,255,150,0));clip-path:polygon(30% 0,70% 0,100% 100%,0 100%);animation:ufo-beam-pulse .4s ease-in-out infinite alternate;}
@keyframes ufo-beam-pulse{from{opacity:.6}to{opacity:1}}
.ufo-item{position:absolute;font-size:2rem;line-height:1;transform:translate(-50%,-50%);z-index:3;background:var(--ufo-c);width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px;box-shadow:0 4px 8px rgba(0,0,0,.4),0 0 0 3px rgba(255,255,255,.4) inset;pointer-events:none;animation:ufo-bob 1.2s ease-in-out infinite alternate;}
@keyframes ufo-bob{from{transform:translate(-50%,-50%) translateY(0)}to{transform:translate(-50%,-50%) translateY(-5px)}}
.ufo-item--bad{animation:ufo-shake .4s ease;}
@keyframes ufo-shake{0%,100%{transform:translate(-50%,-50%) rotate(0)}25%{transform:translate(-50%,-50%) rotate(-12deg)}75%{transform:translate(-50%,-50%) rotate(12deg)}}
.ufo-item--up{animation:ufo-up .55s ease forwards;}
@keyframes ufo-up{0%{transform:translate(-50%,-50%) scale(1)}100%{transform:translate(calc(-50% + var(--ufo-dx,0)),calc(-50% + var(--ufo-dy,0))) scale(.3);opacity:0}}
@media (max-width:380px){.ufo-ship{font-size:2.2rem;}.ufo-item{font-size:1.6rem;width:38px;height:38px;}}
`;
}

export function create(): UfoCatchGame {
  return new UfoCatchGame();
}
