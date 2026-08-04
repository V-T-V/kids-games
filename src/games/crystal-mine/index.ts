/* 水晶矿 Crystal Mine —— 矿洞里有不同颜色的水晶，孩子拖到对应颜色的分类筐。
   独特点：水晶用菱形几何 + 高光渐变绘制，比普通圆点更有"宝石感"。
   巧思：筐装满会发光；每关颜色种类=难度；通关=分对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const GROUPS = [
  { color: "#ff6b9d", name: "粉" },
  { color: "#ffd93d", name: "黄" },
  { color: "#4d96ff", name: "蓝" },
  { color: "#6bcf7f", name: "绿" },
  { color: "#a55eea", name: "紫" },
  { color: "#ff9f43", name: "橙" },
  { color: "#ff5252", name: "红" },
  { color: "#00d2d3", name: "青" },
  { color: "#f368e0", name: "粉紫" },
  { color: "#feca57", name: "金黄" },
  { color: "#54a0ff", name: "天蓝" },
  { color: "#1dd1a1", name: "翠绿" },
  { color: "#8d6e63", name: "棕" },
];

interface Crystal {
  color: string;
  el: HTMLElement;
  placed: boolean;
}

export class CrystalMineGame extends BaseGame {
  constructor() {
    super("crystal-mine");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private baskets: HTMLDivElement[] = [];
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const groupCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const perGroup =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    const groups = shuffle(GROUPS).slice(0, groupCount);

    const wrap = document.createElement("div");
    wrap.className = "crm-wrap";

    const task = document.createElement("div");
    task.className = "crm-task";
    task.innerHTML = `把水晶拖到<span style="color:${getCssVar("--c-cyan")}">同色</span>的筐里～<span class="crm-prog">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    // 矿洞（水晶散落区）
    const mine = document.createElement("div");
    mine.className = "crm-mine";

    const all: { color: string }[] = [];
    groups.forEach((g) => {
      for (let i = 0; i < perGroup; i++) all.push({ color: g.color });
    });
    this.remaining = all.length;

    // 筐区
    const basketRow = document.createElement("div");
    basketRow.className = "crm-baskets";
    this.baskets = [];
    const fill = new Map<string, number>();
    groups.forEach((g) => fill.set(g.color, 0));

    shuffle(all).forEach((c) => {
      const el = document.createElement("div");
      el.className = "crm-crystal";
      el.style.setProperty("--cc", c.color);
      mine.appendChild(el);
      const item: Crystal = { color: c.color, el, placed: false };
      this.enableDrag(item, fill, perGroup);
    });

    groups.forEach((g) => {
      const b = document.createElement("div");
      b.className = "crm-basket";
      b.style.setProperty("--bc", g.color);
      b.dataset.color = g.color;
      b.dataset.need = String(perGroup);
      b.innerHTML = `<div class="crm-basket__shape"></div><div class="crm-basket__count">0/${perGroup}</div><div class="crm-basket__name">${g.name}</div>`;
      basketRow.appendChild(b);
      this.baskets.push(b);
    });

    wrap.appendChild(mine);
    wrap.appendChild(basketRow);
    this.root.appendChild(wrap);
  }

  private enableDrag(
    item: Crystal,
    fill: Map<string, number>,
    perGroup: number,
  ): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (item.placed) return;
      dragging = true;
      const r = item.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = item.el.parentElement;
      item.el.classList.add("crm-crystal--drag");
      item.el.style.position = "fixed";
      item.el.style.left = `${p.x - offX}px`;
      item.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(item.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      item.el.style.left = `${p.x - offX}px`;
      item.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      item.el.classList.remove("crm-crystal--drag");
      const basket = this.baskets.find((b) => {
        const r = b.getBoundingClientRect();
        return (
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
        );
      });
      if (basket && basket.dataset.color === item.color) {
        item.placed = true;
        item.el.remove();
        this.remaining -= 1;
        const cur = (fill.get(item.color) ?? 0) + 1;
        fill.set(item.color, cur);
        const cnt = basket.querySelector(".crm-basket__count")!;
        cnt.textContent = `${cur}/${basket.dataset.need}`;
        if (cur >= perGroup) basket.classList.add("crm-basket--full");
        const r = basket.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top);
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
          }, 900);
        }
      } else {
        // 归位
        item.el.style.position = "";
        item.el.style.left = "";
        item.el.style.top = "";
        origin?.appendChild(item.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(item.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先看看水晶是什么颜色，再找同色的筐～",
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
    if (document.getElementById("crm-style")) return;
    const st = document.createElement("style");
    st.id = "crm-style";
    st.textContent = CRM_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function CRM_CSS(theme: string): string {
  void theme;
  return `
.crm-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.crm-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.crm-prog{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.crm-mine{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;min-height:90px;padding:14px;background:linear-gradient(180deg,#3d2c1e,#5a4030);border-radius:18px;box-shadow:var(--shadow);width:100%;}
/* 水晶：菱形 + 高光 */
.crm-crystal{width:42px;height:54px;cursor:grab;touch-action:none;position:relative;transform:rotate(0deg);transition:transform .12s ease;}
.crm-crystal::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,#fff6 0%,var(--cc) 40%,color-mix(in srgb,var(--cc) 60%,#000) 100%);clip-path:polygon(50% 0,100% 35%,80% 100%,20% 100%,0 35%);box-shadow:0 4px 8px rgba(0,0,0,.3);filter:drop-shadow(0 0 6px var(--cc));}
.crm-crystal::after{content:'';position:absolute;top:8px;left:14px;width:8px;height:14px;background:rgba(255,255,255,.7);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);transform:rotate(-20deg);}
.crm-crystal--drag{cursor:grabbing;transform:scale(1.25);z-index:100;filter:brightness(1.2);}
.crm-baskets{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.crm-basket{width:96px;height:108px;border-radius:14px 14px 10px 10px;background:color-mix(in srgb,var(--bc) 18%,#fff);border:4px solid var(--bc);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;transition:transform .2s ease,box-shadow .2s ease;}
.crm-basket__shape{width:34px;height:44px;background:linear-gradient(135deg,var(--bc),color-mix(in srgb,var(--bc) 50%,#000));clip-path:polygon(50% 0,100% 35%,80% 100%,20% 100%,0 35%);opacity:.7;}
.crm-basket__count{font-size:.85rem;font-weight:800;color:var(--ink);}
.crm-basket__name{font-size:.75rem;color:var(--ink-soft);font-weight:700;}
.crm-basket--full{animation:crm-glow .6s ease;background:color-mix(in srgb,var(--bc) 45%,#fff);box-shadow:0 0 16px var(--bc);}
@keyframes crm-glow{0%{transform:scale(1)}50%{transform:scale(1.12) rotate(-4deg)}100%{transform:scale(1)}}
@media (max-width:380px){.crm-basket{width:80px;height:94px;}.crm-crystal{width:36px;height:46px;}}
`;
}

export function create(): CrystalMineGame {
  return new CrystalMineGame();
}
