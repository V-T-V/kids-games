/* 健康饮食 Healthy Eat —— 把食物分成健康（水果/蔬菜/牛奶）和不健康
   （薯片/糖果/可乐）两类，拖到对应区。独特点：健康认知 + 拖拽分类。
   视觉：两个篮子（健康✅/不健康⚠️）+ 食物 emoji。
   巧思：拖错弹回并提示；拖对的食物"落"进篮子。难度=食物数。前缀 hye-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Food {
  emoji: string;
  name: string;
  healthy: boolean;
}

const ALL_FOODS: Food[] = [
  { emoji: "🍎", name: "苹果", healthy: true },
  { emoji: "🥕", name: "胡萝卜", healthy: true },
  { emoji: "🥛", name: "牛奶", healthy: true },
  { emoji: "🍌", name: "香蕉", healthy: true },
  { emoji: "🥦", name: "西兰花", healthy: true },
  { emoji: "🥚", name: "鸡蛋", healthy: true },
  { emoji: "🍟", name: "薯条", healthy: false },
  { emoji: "🍬", name: "糖果", healthy: false },
  { emoji: "🥤", name: "可乐", healthy: false },
  { emoji: "🍩", name: "甜甜圈", healthy: false },
  { emoji: "🍫", name: "巧克力", healthy: false },
  { emoji: "🍰", name: "蛋糕", healthy: false },
];

export class HealthyEatGame extends BaseGame {
  constructor() {
    super("healthy-eat");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private foods: {
    food: Food;
    el: HTMLDivElement;
    placed: boolean;
    origin: HTMLElement;
  }[] = [];
  private healthyBin!: HTMLDivElement;
  private junkBin!: HTMLDivElement;
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
    this.foods = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    this.remaining = n;
    // 保证至少 2 个健康 + 2 个不健康
    const halfH = Math.max(2, Math.ceil(n / 2));
    const halfJ = n - halfH;
    const healthy = shuffle(ALL_FOODS.filter((f) => f.healthy)).slice(0, halfH);
    const junk = shuffle(ALL_FOODS.filter((f) => !f.healthy)).slice(0, halfJ);
    const picks = shuffle([...healthy, ...junk]);

    const wrap = document.createElement("div");
    wrap.className = "hye-wrap";
    const task = document.createElement("div");
    task.className = "hye-task";
    task.innerHTML = `把食物分一分：<b>健康</b>的拖到绿篮，<b>不健康</b>的拖到黄篮～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 篮子区
    const bins = document.createElement("div");
    bins.className = "hye-bins";
    this.healthyBin = document.createElement("div");
    this.healthyBin.className = "hye-bin hye-bin--good";
    this.healthyBin.innerHTML = `<div class="hye-bin__label">✅ 健康</div><div class="hye-bin__items"></div>`;
    this.junkBin = document.createElement("div");
    this.junkBin.className = "hye-bin hye-bin--bad";
    this.junkBin.innerHTML = `<div class="hye-bin__label">⚠️ 少吃</div><div class="hye-bin__items"></div>`;
    bins.appendChild(this.healthyBin);
    bins.appendChild(this.junkBin);
    wrap.appendChild(bins);

    // 食物托盘
    const tray = document.createElement("div");
    tray.className = "hye-tray";
    picks.forEach((f) => {
      const el = document.createElement("div");
      el.className = "hye-food";
      el.textContent = f.emoji;
      el.title = f.name;
      tray.appendChild(el);
      this.foods.push({ food: f, el, placed: false, origin: tray });
    });
    wrap.appendChild(tray);
    this.root.appendChild(wrap);

    this.foods.forEach((item) => this.enableDrag(item));
  }

  private enableDrag(item: {
    food: Food;
    el: HTMLDivElement;
    placed: boolean;
    origin: HTMLElement;
  }): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    const u = bindPointer(item.el, {
      down: (p) => {
        if (item.placed) return;
        dragging = true;
        const r = item.el.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        item.el.classList.add("hye-food--drag");
        item.el.style.position = "fixed";
        item.el.style.left = `${p.x - ox}px`;
        item.el.style.top = `${p.y - oy}px`;
        item.el.style.width = `${r.width}px`;
        item.el.style.height = `${r.height}px`;
        document.body.appendChild(item.el);
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        item.el.style.left = `${p.x - ox}px`;
        item.el.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        item.el.classList.remove("hye-food--drag");
        const goodR = this.healthyBin.getBoundingClientRect();
        const badR = this.junkBin.getBoundingClientRect();
        const inGood =
          p.x >= goodR.left &&
          p.x <= goodR.right &&
          p.y >= goodR.top &&
          p.y <= goodR.bottom;
        const inBad =
          p.x >= badR.left &&
          p.x <= badR.right &&
          p.y >= badR.top &&
          p.y <= badR.bottom;
        const targetBin =
          (item.food.healthy && inGood) || (!item.food.healthy && inBad);
        if (targetBin) {
          // 分对
          item.placed = true;
          const itemsEl = (
            inGood ? this.healthyBin : this.junkBin
          ).querySelector(".hye-bin__items");
          if (itemsEl) {
            itemsEl.appendChild(item.el);
            item.el.style.position = "";
            item.el.style.left = "";
            item.el.style.top = "";
            item.el.style.width = "";
            item.el.style.height = "";
            item.el.classList.add("hye-food--in");
          }
          const r = (
            inGood ? this.healthyBin : this.junkBin
          ).getBoundingClientRect();
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
            }, 900);
          }
        } else {
          // 分错或没放篮子：弹回托盘
          item.origin.appendChild(item.el);
          item.el.style.position = "";
          item.el.style.left = "";
          item.el.style.top = "";
          item.el.style.width = "";
          item.el.style.height = "";
          if (inGood || inBad) {
            const paused = this.onWrong();
            if (paused) this.showRest();
          }
        }
      },
    });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🥗",
      variant: "rest",
      body: "水果、蔬菜、牛奶是<b>健康</b>的；薯条、糖果、可乐要<b>少吃</b>～",
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
    if (document.getElementById("hye-style")) return;
    const st = document.createElement("style");
    st.id = "hye-style";
    st.textContent = HYE_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function HYE_CSS(_theme: string): string {
  return `
.hye-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.hye-task{font-size:1rem;font-weight:800;text-align:center;line-height:1.4;}
.hye-bins{display:flex;gap:16px;width:100%;justify-content:center;}
.hye-bin{flex:1;max-width:200px;min-height:120px;border-radius:18px;padding:10px;display:flex;flex-direction:column;gap:8px;box-shadow:var(--shadow);}
.hye-bin--good{background:linear-gradient(180deg,#e8f7ec,#c8ebd2);border:3px solid #6bcf7f;}
.hye-bin--bad{background:linear-gradient(180deg,#fff7e0,#ffe8b8);border:3px solid #ffb74d;}
.hye-bin__label{font-size:.9rem;font-weight:800;text-align:center;}
.hye-bin__items{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;min-height:50px;}
.hye-tray{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:14px 16px;background:rgba(255,255,255,.55);border-radius:18px;min-height:72px;width:100%;max-width:440px;}
.hye-food{font-size:2.2rem;line-height:1;cursor:grab;touch-action:none;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));}
.hye-food--drag{cursor:grabbing;transform:scale(1.25);z-index:100;}
.hye-food--in{animation:hye-drop .4s ease;}
@keyframes hye-drop{0%{transform:scale(1.3) translateY(-8px)}60%{transform:scale(.85)}100%{transform:scale(1)}}
@media (max-width:380px){.hye-food{font-size:1.8rem;}.hye-bin{min-height:100px;}}
`;
}

export function create(): HealthyEatGame {
  return new HealthyEatGame();
}
