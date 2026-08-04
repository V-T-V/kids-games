/* 冰淇淋配对 Ice Cream Flavor —— 不同口味的冰淇淋球要放进对应的蛋筒。
   草莓配华夫筒、巧克力配脆皮筒、抹茶配甜筒、香草配糖筒……
   拖动冰淇淋球到对应蛋筒上方松手，匹配成功球落到筒上。
   独特点：物品-容器配对 + 拖拽精确投放。用 bindPointer 拖拽。
   视觉：冰淇淋球（圆形彩色）+ 蛋筒（梯形）。难度=口味数。通关=配对目标轮数。前缀 icf-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByMoves } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Flavor {
  id: string;
  name: string;
  color: string;
  coneName: string;
  coneColor: string;
}

const ALL_FLAVORS: Flavor[] = [
  {
    id: "strawberry",
    name: "草莓",
    color: "#ff8fab",
    coneName: "华夫筒",
    coneColor: "#d9a066",
  },
  {
    id: "chocolate",
    name: "巧克力",
    color: "#8d5a3c",
    coneName: "脆皮筒",
    coneColor: "#5a3a1a",
  },
  {
    id: "matcha",
    name: "抹茶",
    color: "#a3c770",
    coneName: "甜筒",
    coneColor: "#e8c890",
  },
  {
    id: "vanilla",
    name: "香草",
    color: "#fff0c0",
    coneName: "糖筒",
    coneColor: "#f0d090",
  },
  {
    id: "blueberry",
    name: "蓝莓",
    color: "#8a9bff",
    coneName: "星形筒",
    coneColor: "#c89aff",
  },
  {
    id: "mango",
    name: "芒果",
    color: "#ffc94a",
    coneName: "彩虹筒",
    coneColor: "#ff9fc8",
  },
];

export class IceCreamFlavorGame extends BaseGame {
  constructor() {
    super("ice-cream-flavor");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private moves = 0;
  private busy = false;
  private flavors: Flavor[] = [];
  private matched = 0;
  private cones: { flavor: Flavor; el: HTMLElement }[] = [];

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

  private flavorCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.moves = 0;
    this.busy = false;
    this.matched = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.flavorCount();
    this.flavors = shuffle(ALL_FLAVORS).slice(0, n);

    const wrap = document.createElement("div");
    wrap.className = "icf-wrap";

    const task = document.createElement("div");
    task.className = "icf-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 把冰淇淋球拖到对应口味的<b>蛋筒</b>上`;
    wrap.appendChild(task);

    // 上方：蛋筒（目标区）
    const coneArea = document.createElement("div");
    coneArea.className = "icf-cone-area";
    this.cones = [];
    const shuffledCones = shuffle(this.flavors);
    shuffledCones.forEach((f) => {
      const slot = document.createElement("div");
      slot.className = "icf-slot";
      slot.dataset.flavorId = f.id;
      // 蛋筒
      const cone = document.createElement("div");
      cone.className = "icf-cone";
      cone.style.setProperty("--cone-color", f.coneColor);
      cone.innerHTML = `<div class="icf-cone-body"></div><div class="icf-cone-tex"></div>`;
      // 蛋筒标签
      const label = document.createElement("div");
      label.className = "icf-label";
      label.textContent = f.coneName;
      slot.appendChild(cone);
      slot.appendChild(label);
      // 已放置球的容器
      const scoopHolder = document.createElement("div");
      scoopHolder.className = "icf-scoop-holder";
      slot.appendChild(scoopHolder);
      coneArea.appendChild(slot);
      this.cones.push({ flavor: f, el: slot });
    });
    wrap.appendChild(coneArea);

    // 下方：冰淇淋球（待拖）
    const scoopArea = document.createElement("div");
    scoopArea.className = "icf-scoop-area";
    const shuffledScoops = shuffle(this.flavors);
    shuffledScoops.forEach((f) => {
      const scoop = document.createElement("div");
      scoop.className = "icf-scoop";
      scoop.dataset.flavorId = f.id;
      scoop.style.setProperty("--scoop-color", f.color);
      scoop.innerHTML = `<div class="icf-scoop-ball"></div><div class="icf-scoop-label">${f.name}</div>`;
      scoopArea.appendChild(scoop);
      this.enableScoopDrag(scoop, f);
    });
    wrap.appendChild(scoopArea);

    this.root.appendChild(wrap);
  }

  private enableScoopDrag(scoop: HTMLElement, flavor: Flavor): void {
    let dragging = false;
    let offX = 0,
      offY = 0;
    const originParent = scoop.parentElement;
    let originNext: Node | null = null;
    let placeholder: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (this.busy) return;
      if (scoop.classList.contains("icf-scoop--done")) return;
      dragging = true;
      const r = scoop.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      // 占位防止其他球回弹
      placeholder = document.createElement("div");
      placeholder.className = "icf-scoop-ph";
      placeholder.style.width = `${r.width}px`;
      placeholder.style.height = `${r.height}px`;
      originNext = scoop.nextSibling;
      originParent?.insertBefore(placeholder, originNext);
      scoop.classList.add("icf-scoop--drag");
      scoop.style.position = "fixed";
      scoop.style.left = `${p.x - offX}px`;
      scoop.style.top = `${p.y - offY}px`;
      scoop.style.width = `${r.width}px`;
      document.body.appendChild(scoop);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      scoop.style.left = `${p.x - offX}px`;
      scoop.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      scoop.classList.remove("icf-scoop--drag");
      this.moves += 1;
      // 命中检测：找到指针下的蛋筒槽
      const hit = this.cones.find((c) => {
        if (c.el.classList.contains("icf-slot--done")) return false;
        const r = c.el.getBoundingClientRect();
        return (
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
        );
      });
      if (hit && hit.flavor.id === flavor.id) {
        // 匹配成功
        this.busy = true;
        hit.el.classList.add("icf-slot--done");
        // 把球落到蛋筒上的 scoop holder
        const holder = hit.el.querySelector(".icf-scoop-holder");
        scoop.style.position = "";
        scoop.style.left = "";
        scoop.style.top = "";
        scoop.style.width = "";
        scoop.classList.add("icf-scoop--done");
        holder?.appendChild(scoop);
        if (placeholder) placeholder.remove();
        const r = hit.el.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        this.matched += 1;
        if (this.matched >= this.flavors.length) {
          this.trackTimeout(() => {
            this.roundsDone += 1;
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(
                starsByMoves(this.moves, [
                  this.flavors.length,
                  this.flavors.length + 2,
                ]),
              );
            } else {
              this.startRound();
            }
          }, 700);
        } else {
          this.trackTimeout(() => {
            this.busy = false;
          }, 350);
        }
      } else {
        // 归位
        scoop.style.position = "";
        scoop.style.left = "";
        scoop.style.top = "";
        scoop.style.width = "";
        originParent?.insertBefore(scoop, placeholder);
        if (placeholder) placeholder.remove();
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(scoop, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🍦",
      variant: "rest",
      body: "看清楚冰淇淋球的颜色和名字，再找对应的蛋筒哦～",
      primary: { text: "继续", icon: "🍦", onClick: () => ov.destroy() },
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
    if (document.getElementById("icf-style")) return;
    const st = document.createElement("style");
    st.id = "icf-style";
    st.textContent = ICF_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function ICF_CSS(theme: string): string {
  void theme;
  return `
.icf-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.icf-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.icf-cone-area{display:flex;justify-content:center;flex-wrap:wrap;gap:18px;width:100%;padding:24px 12px 12px;background:linear-gradient(180deg,#fff5e0,#ffe5c0);border-radius:24px;box-shadow:var(--shadow);}
.icf-slot{display:flex;flex-direction:column;align-items:center;gap:6px;width:96px;position:relative;transition:transform .2s,filter .2s;}
.icf-slot--done{filter:saturate(1.05);}
.icf-scoop-holder{position:absolute;top:-44px;left:50%;transform:translateX(-50%);width:64px;height:36px;display:flex;justify-content:center;}
.icf-cone{position:relative;width:60px;height:108px;}
.icf-cone-body{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:0;height:0;border-left:30px solid transparent;border-right:30px solid transparent;border-bottom:96px solid var(--cone-color);filter:drop-shadow(0 4px 6px rgba(0,0,0,.2));}
.icf-cone-tex{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:52px;height:84px;background:repeating-linear-gradient(45deg,transparent 0 12px,rgba(0,0,0,.18) 12px 14px);clip-path:polygon(0 0,100% 0,80% 100%,20% 100%);}
.icf-label{font-size:.95rem;font-weight:800;color:#5a3a1a;background:#fff;padding:3px 10px;border-radius:999px;box-shadow:var(--shadow);}
.icf-slot--done .icf-label{background:linear-gradient(135deg,#6bcf7f,#4ed976);color:#fff;}
.icf-scoop-area{display:flex;justify-content:center;flex-wrap:wrap;gap:20px;width:100%;padding:18px;min-height:90px;}
.icf-scoop{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:grab;touch-action:none;user-select:none;transition:transform .15s;}
.icf-scoop:hover{transform:translateY(-4px);}
.icf-scoop-ball{width:64px;height:54px;border-radius:50% 50% 48% 48%;background:radial-gradient(circle at 38% 30%,#fff6,var(--scoop-color));box-shadow:inset 0 -6px 8px rgba(0,0,0,.18),0 4px 6px rgba(0,0,0,.2);position:relative;}
.icf-scoop-ball::before{content:"";position:absolute;top:8px;left:14px;width:14px;height:10px;background:rgba(255,255,255,.55);border-radius:50%;}
.icf-scoop-label{font-size:.9rem;font-weight:800;color:#fff;background:#5a3a1a;padding:2px 10px;border-radius:999px;}
.icf-scoop--drag{cursor:grabbing;transform:scale(1.1);z-index:1000;filter:drop-shadow(0 8px 12px rgba(0,0,0,.3));}
.icf-scoop--done{cursor:default;animation:icf-land .35s ease;}
@keyframes icf-land{0%{transform:translateY(-20px) scale(.7);opacity:.5;}60%{transform:translateY(4px) scale(1.1);}100%{transform:translateY(0) scale(1);opacity:1;}}
.icf-scoop--done .icf-scoop-label{display:none;}
.icf-scoop-ph{visibility:hidden;}
@media (max-width:380px){.icf-slot{width:78px;}.icf-cone{width:50px;height:90px;}.icf-cone-body{border-left-width:25px;border-right-width:25px;border-bottom-width:80px;}.icf-scoop-ball{width:54px;height:46px;}}
`;
}

export function create(): IceCreamFlavorGame {
  return new IceCreamFlavorGame();
}
