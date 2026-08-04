/* 潮汐池 Tide Pool —— 海陆生物混在一起，拖到水里或陆地区域。
   独特点：水生/陆生分类 + 拖拽精细动作。
   视觉：左侧蓝色水池（水生）+ 右侧绿色陆地（陆生）+ 散落生物。
   巧思：放对后生物钻进对应区域冒泡/长草；放错弹回。
   难度 = 生物数。通关 = 分类目标轮数。前缀 tp2- 避免与其他 t- 前缀冲突。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Critter {
  id: string;
  emoji: string;
  name: string;
  zone: "water" | "land";
}

const POOL: Critter[] = [
  { id: "fish", emoji: "🐟", name: "鱼", zone: "water" },
  { id: "crab", emoji: "🦀", name: "螃蟹", zone: "water" },
  { id: "starfish", emoji: "⭐", name: "海星", zone: "water" },
  { id: "shell", emoji: "🐚", name: "贝壳", zone: "water" },
  { id: "jelly", emoji: "🪼", name: "水母", zone: "water" },
  { id: "snail", emoji: "🐌", name: "蜗牛", zone: "land" },
  { id: "lizard", emoji: "🦎", name: "蜥蜴", zone: "land" },
  { id: "snake", emoji: "🐍", name: "蛇", zone: "land" },
  { id: "frog", emoji: "🐸", name: "青蛙", zone: "land" },
  { id: "butterfly", emoji: "🦋", name: "蝴蝶", zone: "land" },
];

interface Token {
  critter: Critter;
  el: HTMLElement;
  placed: boolean;
}

export class TidePoolGame extends BaseGame {
  constructor() {
    super("tide-pool");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private remaining = 0;
  private waterEl: HTMLElement | null = null;
  private landEl: HTMLElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.waterEl = null;
    this.landEl = null;
  }

  private count(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];

    const n = this.count();
    const halfWater = Math.ceil(n / 2);
    const water = shuffle(POOL.filter((c) => c.zone === "water")).slice(
      0,
      halfWater,
    );
    const land = shuffle(POOL.filter((c) => c.zone === "land")).slice(
      0,
      n - halfWater,
    );
    // 保证两侧都至少一个生物
    if (water.length === 0 || land.length === 0) {
      // 数据兜底：直接取前 n
      const all = shuffle(POOL).slice(0, n);
      this.buildTokens(all);
      return;
    }
    this.buildTokens([...water, ...land]);
  }

  private buildTokens(list: Critter[]): void {
    this.remaining = list.length;

    const wrap = document.createElement("div");
    wrap.className = "tp2-wrap";

    const task = document.createElement("div");
    task.className = "tp2-task";
    task.innerHTML = `把小生物拖到<b>水里</b>或<b>陆地</b>～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const zones = document.createElement("div");
    zones.className = "tp2-zones";
    const water = document.createElement("div");
    water.className = "tp2-water";
    water.dataset.zone = "water";
    water.innerHTML = `<div class="tp2-zone__label">🌊 水里</div>`;
    const land = document.createElement("div");
    land.className = "tp2-land";
    land.dataset.zone = "land";
    land.innerHTML = `<div class="tp2-zone__label">🌿 陆地</div>`;
    this.waterEl = water;
    this.landEl = land;
    zones.appendChild(water);
    zones.appendChild(land);
    wrap.appendChild(zones);

    const tray = document.createElement("div");
    tray.className = "tp2-tray";
    const tokens: Token[] = list.map((c) => {
      const el = document.createElement("div");
      el.className = "tp2-critter";
      el.textContent = c.emoji;
      el.setAttribute("aria-label", c.name);
      return { critter: c, el, placed: false };
    });
    shuffle(tokens).forEach((t) => tray.appendChild(t.el));
    wrap.appendChild(tray);
    this.root.appendChild(wrap);

    tokens.forEach((tok) => this.enableDrag(tok));
    this.reportProgress(this.roundsDone, this.roundTotal);
  }

  private enableDrag(tok: Token): void {
    let dragging = false,
      ox = 0,
      oy = 0,
      origin: HTMLElement | null = null;
    const u = bindPointer(tok.el, {
      down: (p) => {
        if (tok.placed) return;
        dragging = true;
        const r = tok.el.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        origin = tok.el.parentElement;
        tok.el.classList.add("tp2-critter--drag");
        tok.el.style.position = "fixed";
        tok.el.style.left = `${p.x - ox}px`;
        tok.el.style.top = `${p.y - oy}px`;
        tok.el.style.width = `${r.width}px`;
        tok.el.style.height = `${r.height}px`;
        document.body.appendChild(tok.el);
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        tok.el.style.left = `${p.x - ox}px`;
        tok.el.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        tok.el.classList.remove("tp2-critter--drag");
        const target = this.zoneHit(p);
        if (target && target.dataset.zone === tok.critter.zone) {
          tok.placed = true;
          tok.el.remove();
          target.classList.add("tp2-zone--happy");
          const pop = document.createElement("span");
          pop.className =
            tok.critter.zone === "water"
              ? "tp2-zone__bubble"
              : "tp2-zone__leaf";
          pop.textContent = tok.critter.zone === "water" ? "🫧" : "🍃";
          target.appendChild(pop);
          const r = target.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          this.remaining -= 1;
          if (this.remaining <= 0) {
            this.roundsDone += 1;
            this.reportProgress(this.roundsDone, this.roundTotal);
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal) {
                this.finishClear(starsByAccuracy(this.wrongCount));
              } else {
                this.startRound();
              }
            }, 1000);
          }
        } else {
          tok.el.style.position = "";
          tok.el.style.left = "";
          tok.el.style.top = "";
          tok.el.style.width = "";
          tok.el.style.height = "";
          origin?.appendChild(tok.el);
          const paused = this.onWrong();
          if (paused) this.showRest();
        }
      },
    });
    this.unbinds.push(u);
  }

  private zoneHit(p: { x: number; y: number }): HTMLElement | null {
    for (const el of [this.waterEl, this.landEl]) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) {
        return el;
      }
    }
    return null;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌊",
      variant: "rest",
      body: "想想它住在哪里：水里游的，还是地上爬的？",
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
    if (document.getElementById("tp2-style")) return;
    const st = document.createElement("style");
    st.id = "tp2-style";
    st.textContent = TP2_CSS(getCssVar("--c-cyan"), getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function TP2_CSS(water: string, land: string): string {
  return `
.tp2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.tp2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.tp2-zones{display:flex;gap:14px;width:100%;max-width:480px;}
.tp2-water,.tp2-land{flex:1;min-height:160px;border-radius:20px;position:relative;display:flex;align-items:flex-end;justify-content:center;padding-bottom:12px;box-shadow:var(--shadow);transition:transform .2s;overflow:hidden;}
.tp2-water{background:linear-gradient(180deg,#bdeaff,${water});border:3px solid #36b6d6;}
.tp2-land{background:linear-gradient(180deg,#e6f7d8,${land}88);border:3px solid #5fa843;}
.tp2-zone__label{position:absolute;top:8px;left:50%;transform:translateX(-50%);font-size:.9rem;font-weight:900;color:#fff;background:rgba(0,0,0,.25);padding:2px 10px;border-radius:999px;}
.tp2-zone--happy{animation:tp2-bounce .4s ease;}
@keyframes tp2-bounce{0%{transform:scale(1);}45%{transform:scale(1.04);}100%{transform:scale(1);}}
.tp2-zone__bubble,.tp2-zone__leaf{position:absolute;font-size:1.6rem;animation:tp2-in .5s ease;}
@keyframes tp2-in{0%{transform:scale(.2);opacity:0;}60%{transform:scale(1.3);opacity:1;}100%{transform:scale(1);}}
.tp2-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:16px 18px;background:rgba(255,255,255,.6);border-radius:18px;min-height:80px;width:100%;max-width:480px;}
.tp2-critter{font-size:2.6rem;cursor:grab;touch-action:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.2));transition:transform .1s;line-height:1;}
.tp2-critter--drag{cursor:grabbing;transform:scale(1.2);z-index:100;}
@media (max-width:380px){.tp2-zones{flex-direction:column;}.tp2-water,.tp2-land{min-height:110px;}.tp2-critter{font-size:2.2rem;}}
`;
}

export function create(): TidePoolGame {
  return new TidePoolGame();
}
