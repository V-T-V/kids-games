/* 披萨师 Pizza Chef —— 显示一张参考披萨图（几种配料放在特定位置），
   孩子从配料盘拖对应配料到工作披萨的对应位置。
   独特点：参照样板复制摆放，训练空间对应 + 拖拽精细动作。
   视觉：参考披萨（小） + 工作披萨（大，空位） + 配料盘。
   难度=配料数。通关=做对目标轮数。前缀 pzc-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Topping {
  key: string;
  emoji: string;
  name: string;
  color: string;
}

const TOPPINGS: Topping[] = [
  { key: "mushroom", emoji: "🍄", name: "蘑菇", color: "#b08968" },
  { key: "pepper", emoji: "🫑", name: "青椒", color: "#6bcf7f" },
  { key: "shrimp", emoji: "🦐", name: "虾仁", color: "#ff9f43" },
  { key: "tomato", emoji: "🍅", name: "番茄", color: "#ff6348" },
  { key: "olive", emoji: "🫒", name: "橄榄", color: "#7a8c3a" },
  { key: "corn", emoji: "🌽", name: "玉米", color: "#ffd93d" },
  { key: "pineapple", emoji: "🍍", name: "菠萝", color: "#f6c453" },
  { key: "cheese", emoji: "🧀", name: "奶酪", color: "#ffb703" },
];

interface Slot {
  /** 披萨内百分比位置（中心 0~100） */
  x: number;
  y: number;
  topping: Topping;
  filled: boolean;
}

/** 预设位置组（百分比，相对披萨中心区）。每组都是不重叠的合理布局。 */
const POS_SETS: { x: number; y: number }[][] = [
  // 2 点
  [
    { x: 35, y: 35 },
    { x: 65, y: 65 },
  ],
  // 3 点
  [
    { x: 50, y: 30 },
    { x: 32, y: 60 },
    { x: 68, y: 60 },
  ],
  [
    { x: 40, y: 38 },
    { x: 62, y: 38 },
    { x: 50, y: 68 },
  ],
  // 4 点
  [
    { x: 36, y: 36 },
    { x: 64, y: 36 },
    { x: 36, y: 64 },
    { x: 64, y: 64 },
  ],
  // 5 点
  [
    { x: 50, y: 26 },
    { x: 30, y: 46 },
    { x: 70, y: 46 },
    { x: 38, y: 70 },
    { x: 62, y: 70 },
  ],
];

export class PizzaChefGame extends BaseGame {
  constructor() {
    super("pizza-chef");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private slots: Slot[] = [];
  private curTopping: Topping | null = null;
  private remaining = 0;
  private unbinds: (() => void)[] = [];
  private dragGhost: HTMLElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.dragGhost?.remove();
    this.dragGhost = null;
  }

  private count(): number {
    return this.difficulty === "easy"
      ? 2
      : this.difficulty === "medium"
        ? 3
        : 5;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.dragGhost?.remove();
    this.dragGhost = null;
    this.curTopping = null;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    // 选 n 种配料
    const picked = shuffle([...TOPPINGS]).slice(0, n);
    // 选位置组
    const posCandidates = POS_SETS.filter((s) => s.length === n);
    const poses = sample(posCandidates.length > 0 ? posCandidates : POS_SETS)!;
    // 配料随机分配到位置（保证每种配料位置在参考图里固定）
    const shuffledTops = shuffle(picked);
    this.slots = poses.map((p, i) => ({
      x: p.x,
      y: p.y,
      topping: shuffledTops[i]!,
      filled: false,
    }));
    this.remaining = this.slots.length;

    const wrap = document.createElement("div");
    wrap.className = "pzc-wrap";

    const task = document.createElement("div");
    task.className = "pzc-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 照左边的样子，把配料拖到一样的位置 🍕`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "pzc-stage";

    // 参考披萨（小）
    const ref = document.createElement("div");
    ref.className = "pzc-ref";
    ref.innerHTML = `<div class="pzc-ref__title">📋 样子</div>`;
    const refPizza = document.createElement("div");
    refPizza.className = "pzc-pizza pzc-pizza--ref";
    for (const s of this.slots) {
      const c = document.createElement("span");
      c.className = "pzc-chip pzc-chip--fixed";
      c.textContent = s.topping.emoji;
      c.style.left = `${s.x}%`;
      c.style.top = `${s.y}%`;
      refPizza.appendChild(c);
    }
    ref.appendChild(refPizza);
    stage.appendChild(ref);

    // 工作披萨（大，空位）
    const work = document.createElement("div");
    work.className = "pzc-work";
    const workPizza = document.createElement("div");
    workPizza.className = "pzc-pizza pzc-pizza--work";
    workPizza.id = "pzc-pizza";
    this.slots.forEach((s, i) => {
      const slot = document.createElement("div");
      slot.className = "pzc-slot";
      slot.dataset.idx = String(i);
      slot.style.left = `${s.x}%`;
      slot.style.top = `${s.y}%`;
      slot.style.setProperty("--pzc-c", s.topping.color);
      workPizza.appendChild(slot);
    });
    work.appendChild(workPizza);
    stage.appendChild(work);

    wrap.appendChild(stage);

    // 配料盘（拖拽源）
    const tray = document.createElement("div");
    tray.className = "pzc-tray";
    for (const t of picked) {
      const src = document.createElement("div");
      src.className = "pzc-src";
      src.dataset.key = t.key;
      src.style.setProperty("--pzc-c", t.color);
      src.innerHTML = `<span class="pzc-src__emoji">${t.emoji}</span><span class="pzc-src__name">${t.name}</span>`;
      this.enableDrag(src, t);
      tray.appendChild(src);
    }
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private enableDrag(src: HTMLElement, t: Topping): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    const unbind = bindPointer(src, {
      down: (p) => {
        dragging = true;
        this.curTopping = t;
        sfxPop();
        const r = src.getBoundingClientRect();
        ox = r.width / 2;
        oy = r.height / 2;
        const ghost = document.createElement("div");
        ghost.className = "pzc-ghost";
        ghost.textContent = t.emoji;
        ghost.style.left = `${p.x - ox}px`;
        ghost.style.top = `${p.y - oy}px`;
        document.body.appendChild(ghost);
        this.dragGhost = ghost;
        src.classList.add("pzc-src--active");
      },
      move: (p) => {
        if (!dragging || !this.dragGhost) return;
        this.dragGhost.style.left = `${p.x - ox}px`;
        this.dragGhost.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        src.classList.remove("pzc-src--active");
        const ghost = this.dragGhost;
        this.dragGhost = null;
        // 命中检测：找重叠的 slot
        const pizza = this.root.querySelector("#pzc-pizza");
        let hitIdx = -1;
        this.root.querySelectorAll<HTMLElement>(".pzc-slot").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (
            p.x >= r.left &&
            p.x <= r.right &&
            p.y >= r.top &&
            p.y <= r.bottom
          ) {
            const idx = Number(el.dataset.idx);
            if (!Number.isNaN(idx)) hitIdx = idx;
          }
        });
        void pizza;
        if (hitIdx >= 0) {
          this.tryDrop(hitIdx, t, ghost);
        } else {
          ghost?.classList.add("pzc-ghost--fade");
          this.trackTimeout(() => ghost?.remove(), 200);
          // 落空不算错
        }
      },
    });
    this.unbinds.push(unbind);
  }

  private tryDrop(idx: number, t: Topping, ghost: HTMLElement | null): void {
    const slot = this.slots[idx];
    if (!slot || slot.filled) {
      ghost?.classList.add("pzc-ghost--fade");
      this.trackTimeout(() => ghost?.remove(), 200);
      return;
    }
    if (slot.topping.key !== t.key) {
      // 配料类型不对
      ghost?.classList.add("pzc-ghost--fade");
      this.trackTimeout(() => ghost?.remove(), 200);
      const el = this.root.querySelector<HTMLElement>(
        `.pzc-slot[data-idx="${idx}"]`,
      );
      el?.classList.add("pzc-slot--shake");
      this.trackTimeout(() => el?.classList.remove("pzc-slot--shake"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    // 放对
    slot.filled = true;
    this.remaining -= 1;
    ghost?.remove();
    const el = this.root.querySelector<HTMLElement>(
      `.pzc-slot[data-idx="${idx}"]`,
    );
    if (el) {
      el.classList.add("pzc-slot--filled");
      const chip = document.createElement("span");
      chip.className = "pzc-chip pzc-chip--drop";
      chip.textContent = t.emoji;
      el.appendChild(chip);
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    }
    this.resetWrongStreak();
    if (this.remaining <= 0) {
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 850);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🍕",
      variant: "rest",
      body: "看看左边的样子，配料的种类和位置都要一样哦～",
      primary: { text: "继续", icon: "🎈", onClick: () => ov.destroy() },
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
    if (document.getElementById("pzc-style")) return;
    const st = document.createElement("style");
    st.id = "pzc-style";
    st.textContent = PZC_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function PZC_CSS(theme: string): string {
  return `
.pzc-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.pzc-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.pzc-stage{display:flex;gap:18px;align-items:center;justify-content:center;flex-wrap:wrap;width:100%;}
.pzc-ref{display:flex;flex-direction:column;align-items:center;gap:6px;}
.pzc-ref__title{font-size:.85rem;font-weight:900;color:${theme};}
.pzc-work{display:flex;justify-content:center;}
.pzc-pizza{position:relative;border-radius:50%;background:radial-gradient(circle,#f0c279,#e8a04a);box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;}
.pzc-pizza::after{content:"";position:absolute;inset:8%;border-radius:50%;background:radial-gradient(circle,#ffe0a3,#ffd066);box-shadow:inset 0 0 0 6px #f0c279, inset 0 0 22px rgba(255,180,80,.4);}
.pzc-pizza--ref{width:130px;height:130px;}
.pzc-pizza--work{width:240px;height:240px;}
.pzc-chip{position:absolute;font-size:1.6rem;line-height:1;transform:translate(-50%,-50%);z-index:2;filter:drop-shadow(0 2px 2px rgba(120,72,20,.35));}
.pzc-pizza--ref .pzc-chip{font-size:1.1rem;}
.pzc-chip--drop{animation:pzc-drop .35s ease;}
@keyframes pzc-drop{0%{transform:translate(-50%,-160%) scale(.5);opacity:0}70%{transform:translate(-50%,-40%) scale(1.25);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
.pzc-slot{position:absolute;width:38px;height:38px;border-radius:50%;transform:translate(-50%,-50%);border:2.5px dashed var(--pzc-c,#888);background:rgba(255,255,255,.55);z-index:3;transition:transform .12s;}
.pzc-slot--filled{border:none;background:transparent;}
.pzc-slot--shake{animation:pzc-shake .4s ease;}
@keyframes pzc-shake{0%,100%{transform:translate(-50%,-50%) rotate(0)}25%{transform:translate(-50%,-50%) rotate(-12deg)}75%{transform:translate(-50%,-50%) rotate(12deg)}}
.pzc-tray{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:460px;}
.pzc-src{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:72px;padding:8px 6px;border-radius:18px;background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--pzc-c,#eee) 28%,#fff));box-shadow:0 4px 0 rgba(0,0,0,.1),0 6px 10px rgba(0,0,0,.12);cursor:grab;touch-action:none;transition:transform .1s;}
.pzc-src:active{transform:translateY(3px);}
.pzc-src--active{opacity:.5;}
.pzc-src__emoji{font-size:1.7rem;}
.pzc-src__name{font-size:.78rem;font-weight:800;color:#555;}
.pzc-ghost{position:fixed;font-size:2rem;z-index:1000;pointer-events:none;transform:translate(-50%,-50%);filter:drop-shadow(0 4px 6px rgba(0,0,0,.3));transition:opacity .2s;}
.pzc-ghost--fade{opacity:0;}
@media (max-width:380px){.pzc-pizza--work{width:200px;height:200px;}.pzc-pizza--ref{width:110px;height:110px;}.pzc-slot{width:32px;height:32px;}.pzc-src{min-width:62px;}}
`;
}

export function create(): PizzaChefGame {
  return new PizzaChefGame();
}
