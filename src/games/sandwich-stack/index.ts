/* 三明治叠 Sandwich Stack —— 显示一个目标三明治的层次顺序（面包→生菜→番茄→奶酪→面包），
   然后把配料打乱摆在下方，孩子按从下到上的顺序点击配料叠到盘子上。
   点对：配料飞到盘子上叠好；点错：抖动提示。叠完与目标一致即通关。
   独特点：序列记忆 + 顺序点击。视觉：层次卡片（目标）+ 配料 + 盘子上的累积层。
   难度=层数。通关=叠对目标轮数。前缀 sst2-（shape-shadow-trace 用 sst-）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Layer {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** 视觉层在盘子里的高度比例（窄层 vs 厚层） */
  h: number;
}

const INGREDIENTS: Layer[] = [
  { id: "bread-bottom", name: "面包底", emoji: "🍞", color: "#e8b878", h: 26 },
  { id: "lettuce", name: "生菜", emoji: "🥬", color: "#8fd36a", h: 14 },
  { id: "tomato", name: "番茄", emoji: "🍅", color: "#ff6348", h: 14 },
  { id: "cheese", name: "奶酪", emoji: "🧀", color: "#ffd93d", h: 12 },
  { id: "egg", name: "鸡蛋", emoji: "🍳", color: "#ffe080", h: 14 },
  { id: "ham", name: "火腿", emoji: "🥓", color: "#e88a8a", h: 12 },
  { id: "cucumber", name: "黄瓜", emoji: "🥒", color: "#a8d98a", h: 12 },
  { id: "bread-top", name: "面包顶", emoji: "🍞", color: "#e8b878", h: 26 },
];

export class SandwichStackGame extends BaseGame {
  constructor() {
    super("sandwich-stack");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  /** 目标顺序（从下到上） */
  private target: Layer[] = [];
  /** 当前已叠的索引 */
  private stacked = 0;
  private plate: HTMLElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private layerCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.stacked = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 生成目标：面包底开头，面包顶结尾，中间随机选
    const n = this.layerCount();
    const middles = shuffle(
      INGREDIENTS.filter((i) => !i.id.startsWith("bread")),
    ).slice(0, Math.max(1, n - 2));
    const breadBottom = INGREDIENTS.find((i) => i.id === "bread-bottom")!;
    const breadTop = INGREDIENTS.find((i) => i.id === "bread-top")!;
    this.target = [breadBottom, ...middles, breadTop];

    const wrap = document.createElement("div");
    wrap.className = "sst2-wrap";

    const task = document.createElement("div");
    task.className = "sst2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 照着目标三明治，<b>从下往上</b>按顺序点配料`;
    wrap.appendChild(task);

    const row = document.createElement("div");
    row.className = "sst2-row";

    // 左：目标三明治（层数卡片，从下到上）
    const targetBox = document.createElement("div");
    targetBox.className = "sst2-target";
    const targetTitle = document.createElement("div");
    targetTitle.className = "sst2-box-title";
    targetTitle.textContent = "🎯 目标";
    targetBox.appendChild(targetTitle);
    const targetList = document.createElement("div");
    targetList.className = "sst2-target-list";
    // 显示从下到上：数组第 0 个在最底，倒序渲染
    for (let i = this.target.length - 1; i >= 0; i--) {
      const layer = this.target[i]!;
      const card = document.createElement("div");
      card.className = "sst2-target-card";
      card.innerHTML = `<span class="sst2-card-emoji">${layer.emoji}</span><span class="sst2-card-name">${layer.name}</span>`;
      card.style.setProperty("--layer-color", layer.color);
      targetList.appendChild(card);
    }
    targetBox.appendChild(targetList);
    row.appendChild(targetBox);

    // 右：盘子（实际叠放区）
    const plateBox = document.createElement("div");
    plateBox.className = "sst2-plate-box";
    const plateTitle = document.createElement("div");
    plateTitle.className = "sst2-box-title";
    plateTitle.textContent = "🍽️ 盘子";
    plateBox.appendChild(plateTitle);
    const stackArea = document.createElement("div");
    stackArea.className = "sst2-stack-area";
    const plate = document.createElement("div");
    plate.className = "sst2-plate";
    plate.id = "sst2-plate";
    stackArea.appendChild(plate);
    plateBox.appendChild(stackArea);
    row.appendChild(plateBox);

    wrap.appendChild(row);

    // 下方：乱序配料
    const pantry = document.createElement("div");
    pantry.className = "sst2-pantry";
    const pantryTitle = document.createElement("div");
    pantryTitle.className = "sst2-pantry-title";
    pantryTitle.textContent = "点下方配料按顺序叠 →";
    pantry.appendChild(pantryTitle);
    const pantryGrid = document.createElement("div");
    pantryGrid.className = "sst2-pantry-grid";
    // 配料打乱，但确保每个目标层都有对应按钮
    const pantryItems = shuffle(this.target.map((l) => l));
    pantryItems.forEach((layer) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sst2-pantry-btn";
      b.dataset.layerId = layer.id;
      b.innerHTML = `<span class="sst2-card-emoji">${layer.emoji}</span><span class="sst2-card-name">${layer.name}</span>`;
      b.style.setProperty("--layer-color", layer.color);
      b.addEventListener("click", () => this.pickLayer(layer, b));
      pantryGrid.appendChild(b);
    });
    pantry.appendChild(pantryGrid);
    wrap.appendChild(pantry);

    this.root.appendChild(wrap);
    this.plate = plate;
  }

  private pickLayer(layer: Layer, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (btn.classList.contains("sst2-pantry-btn--used")) return;
    const expected = this.target[this.stacked];
    if (expected && layer.id === expected.id) {
      // 正确
      btn.classList.add("sst2-pantry-btn--used");
      btn.disabled = true;
      sfxPop();
      this.stackOnPlate(layer);
      this.stacked += 1;
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      if (this.stacked >= this.target.length) {
        // 全部叠完
        this.locked = true;
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 800);
      }
    } else {
      // 错误
      btn.classList.add("sst2-pantry-btn--shake");
      this.trackTimeout(
        () => btn.classList.remove("sst2-pantry-btn--shake"),
        500,
      );
      this.onWrong();
    }
  }

  private stackOnPlate(layer: Layer): void {
    if (!this.plate) return;
    const layerEl = document.createElement("div");
    layerEl.className = "sst2-stack-layer";
    layerEl.style.setProperty("--layer-color", layer.color);
    layerEl.style.setProperty("--layer-h", `${layer.h}px`);
    layerEl.innerHTML = `<span class="sst2-stack-emoji">${layer.emoji}</span>`;
    // 插入到 plate 之前（即在已叠层之上）。stack-area 是 plate 的父级。
    const stackArea = this.plate.parentElement;
    if (stackArea) {
      stackArea.insertBefore(layerEl, this.plate);
      // 强制重绘动画
      layerEl.classList.add("sst2-stack-layer--in");
    }
  }

  private injectStyle(): void {
    if (document.getElementById("sst2-style")) return;
    const st = document.createElement("style");
    st.id = "sst2-style";
    st.textContent = SST2_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function SST2_CSS(theme: string): string {
  void theme;
  return `
.sst2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(620px,100%);}
.sst2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:9px 20px;border-radius:999px;box-shadow:var(--shadow);}
.sst2-row{display:flex;gap:18px;width:100%;justify-content:center;flex-wrap:wrap;}
.sst2-target,.sst2-plate-box{flex:1;min-width:200px;max-width:280px;background:#fff5e0;border-radius:18px;padding:12px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px;}
.sst2-box-title{font-size:1rem;font-weight:900;text-align:center;color:#5a3a1a;}
.sst2-target-list{display:flex;flex-direction:column;align-items:center;gap:3px;}
.sst2-target-card{display:flex;align-items:center;gap:8px;width:170px;padding:6px 12px;border-radius:10px;background:var(--layer-color);box-shadow:0 2px 4px rgba(0,0,0,.15);font-size:.9rem;font-weight:800;color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.3);}
.sst2-card-emoji{font-size:1.2rem;line-height:1;}
.sst2-stack-area{position:relative;display:flex;flex-direction:column-reverse;align-items:center;justify-content:flex-start;gap:2px;min-height:220px;padding:8px;}
.sst2-plate{width:170px;height:24px;background:linear-gradient(180deg,#fff,#dcdcdc);border-radius:50%;box-shadow:0 6px 12px rgba(0,0,0,.25),inset 0 -3px 6px rgba(0,0,0,.2);position:relative;z-index:1;}
.sst2-stack-layer{position:relative;width:150px;height:var(--layer-h,18px);background:var(--layer-color);border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,.2),inset 0 -2px 4px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;}
.sst2-stack-emoji{font-size:1rem;filter:drop-shadow(0 1px 1px rgba(0,0,0,.3));}
.sst2-stack-layer--in{animation:sst2-drop .3s ease;}
@keyframes sst2-drop{0%{transform:translateY(-40px) scale(.8);opacity:0;}60%{transform:translateY(4px) scale(1.05);}100%{transform:translateY(0) scale(1);opacity:1;}}
.sst2-pantry{width:100%;background:#fff;border-radius:18px;padding:12px;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;gap:8px;}
.sst2-pantry-title{font-size:.95rem;font-weight:800;color:#5a3a1a;}
.sst2-pantry-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;}
.sst2-pantry-btn{display:flex;flex-direction:column;align-items:center;gap:2px;width:78px;padding:8px 4px;border:none;border-radius:12px;background:var(--layer-color);box-shadow:0 3px 6px rgba(0,0,0,.2);cursor:pointer;transition:transform .1s;}
.sst2-pantry-btn:active{transform:scale(.92);}
.sst2-pantry-btn .sst2-card-emoji{font-size:1.5rem;}
.sst2-pantry-btn .sst2-card-name{font-size:.8rem;font-weight:800;color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.3);}
.sst2-pantry-btn--used{opacity:.35;filter:grayscale(.7);pointer-events:none;}
.sst2-pantry-btn--shake{animation:sst2-shake .4s ease;}
@keyframes sst2-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-6px) rotate(-4deg);}75%{transform:translateX(6px) rotate(4deg);}}
@media (max-width:380px){.sst2-target,.sst2-plate-box{min-width:150px;}.sst2-pantry-btn{width:66px;}}
`;
}

export function create(): SandwichStackGame {
  return new SandwichStackGame();
}
