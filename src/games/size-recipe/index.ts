/* 按量分 Size-Recipe —— 把食物拖到对应大小的碗里（大份→大碗…）。
   独特点：大中小三档大小匹配，训练「按大小分类」的量感认知。
   视觉：不同大小的碗 + 食物 emoji。难度=碗数（食物数）。
   通关=分对目标轮数。用 bindPointer 拖拽。前缀 sr3- 避免冲突。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

type Size = "big" | "mid" | "small";

interface FoodItem {
  emoji: string;
  name: string;
  size: Size;
  el: HTMLElement;
  placed: boolean;
}

const FOODS: Record<Size, { emoji: string; name: string }[]> = {
  big: [
    { emoji: "🍉", name: "大西瓜" },
    { emoji: "🍕", name: "大披萨" },
    { emoji: "🍍", name: "大菠萝" },
    { emoji: "🍰", name: "大蛋糕" },
  ],
  mid: [
    { emoji: "🍎", name: "中苹果" },
    { emoji: "🍩", name: "中甜甜圈" },
    { emoji: "🥖", name: "中面包" },
    { emoji: "🥭", name: "中芒果" },
  ],
  small: [
    { emoji: "🍇", name: "小葡萄" },
    { emoji: "🍓", name: "小草莓" },
    { emoji: "🍬", name: "小糖果" },
    { emoji: "🍒", name: "小樱桃" },
  ],
};

const SIZE_META: Record<Size, { name: string; scale: number; color: string }> =
  {
    big: { name: "大碗", scale: 1.35, color: "#ff6348" },
    mid: { name: "中碗", scale: 1.0, color: "#ff9f43" },
    small: { name: "小碗", scale: 0.72, color: "#6bcf7f" },
  };

const ENCOURAGE = ["分得真整齐！", "想想哪个更大～", "真棒！", "差一点点！"];

export class SizeRecipeGame extends BaseGame {
  constructor() {
    super("size-recipe");
  }

  private unbinds: (() => void)[] = [];
  private bowls: Partial<Record<Size, HTMLElement>> = {};
  private items: FoodItem[] = [];
  private remaining = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

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

  /** 每种大小的食物数量：easy 各 1（共3），medium 大2其余1（共4），hard 各 2（共6） */
  private perSize(): Record<Size, number> {
    if (this.difficulty === "easy") return { big: 1, mid: 1, small: 1 };
    if (this.difficulty === "medium") return { big: 2, mid: 1, small: 1 };
    return { big: 2, mid: 2, small: 2 };
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.items = [];
    this.bowls = {};
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const per = this.perSize();
    const sizes: Size[] = ["big", "mid", "small"];
    const list: { emoji: string; name: string; size: Size }[] = [];
    sizes.forEach((s) => {
      const pool = shuffle(FOODS[s]);
      for (let i = 0; i < per[s]; i++) {
        const f = pool[i % pool.length]!;
        list.push({ emoji: f.emoji, name: f.name, size: s });
      }
    });
    const foods = shuffle(list);
    this.remaining = foods.length;

    const wrap = document.createElement("div");
    wrap.className = "sr3-wrap";

    const task = document.createElement("div");
    task.className = "sr3-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把食物拖到<b>大小相同</b>的碗里`;
    wrap.appendChild(task);

    /* 碗区 */
    const bowlRow = document.createElement("div");
    bowlRow.className = "sr3-bowls";
    sizes.forEach((s) => {
      const m = SIZE_META[s];
      const bowl = document.createElement("div");
      bowl.className = "sr3-bowl";
      bowl.dataset.size = s;
      bowl.style.setProperty("--sr3-scale", String(m.scale));
      bowl.style.setProperty("--sr3-color", m.color);
      bowl.innerHTML = `
        <div class="sr3-bowl-shape">🥣</div>
        <div class="sr3-bowl-name">${m.name}</div>
        <div class="sr3-bowl-drop" id="sr3-drop-${s}"></div>
      `;
      bowlRow.appendChild(bowl);
      this.bowls[s] = bowl;
    });
    wrap.appendChild(bowlRow);

    /* 食物托盘 */
    const tray = document.createElement("div");
    tray.className = "sr3-tray";
    foods.forEach((f) => {
      const el = document.createElement("div");
      el.className = "sr3-food";
      el.style.setProperty("--sr3-fscale", String(SIZE_META[f.size].scale));
      el.innerHTML = `<span class="sr3-food-emoji">${f.emoji}</span>`;
      el.dataset.size = f.size;
      tray.appendChild(el);
      const it: FoodItem = {
        emoji: f.emoji,
        name: f.name,
        size: f.size,
        el,
        placed: false,
      };
      this.items.push(it);
      this.enableDrag(it);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private enableDrag(it: FoodItem): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (it.placed || this.locked) return;
      dragging = true;
      const r = it.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = it.el.parentElement;
      it.el.classList.add("sr3-food--drag");
      it.el.style.position = "fixed";
      it.el.style.left = `${p.x - offX}px`;
      it.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(it.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      it.el.style.left = `${p.x - offX}px`;
      it.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      it.el.classList.remove("sr3-food--drag");
      let hit: Size | null = null;
      for (const s of ["big", "mid", "small"] as Size[]) {
        const bowl = this.bowls[s]!;
        const r = bowl.getBoundingClientRect();
        if (
          p.x >= r.left &&
          p.x <= r.right &&
          p.y >= r.top &&
          p.y <= r.bottom
        ) {
          hit = s;
          break;
        }
      }
      if (hit === it.size) {
        it.placed = true;
        it.el.style.position = "";
        it.el.style.left = "";
        it.el.style.top = "";
        it.el.classList.add("sr3-food--in");
        const drop = this.root.querySelector(`#sr3-drop-${hit}`);
        if (drop) drop.appendChild(it.el);
        this.remaining -= 1;
        const r = this.bowls[hit]!.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        if (this.remaining <= 0) {
          this.locked = true;
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
        it.el.style.position = "";
        it.el.style.left = "";
        it.el.style.top = "";
        origin?.appendChild(it.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(it.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🥣",
      variant: "rest",
      body: `看看食物有多大，再找一样大的碗。 ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("sr3-style")) return;
    const st = document.createElement("style");
    st.id = "sr3-style";
    st.textContent = SR3_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function SR3_CSS(theme: string): string {
  return `
.sr3-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.sr3-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.sr3-bowls{display:flex;gap:14px;justify-content:center;align-items:flex-end;width:100%;}
.sr3-bowl{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.85),var(--sr3-color,${theme})22);border:3px solid var(--sr3-color,${theme});box-shadow:var(--shadow);transform:scale(var(--sr3-scale,1));transform-origin:bottom;}
.sr3-bowl-shape{font-size:3rem;line-height:1;filter:drop-shadow(0 3px 4px rgba(0,0,0,.2));}
.sr3-bowl-name{font-size:.8rem;font-weight:900;color:var(--sr3-color,${theme});background:#fff;border-radius:999px;padding:2px 8px;}
.sr3-bowl-drop{min-height:34px;width:100%;border-radius:10px;background:rgba(255,255,255,.4);display:flex;flex-wrap:wrap;gap:2px;align-items:center;justify-content:center;padding:3px;}
.sr3-tray{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:520px;min-height:72px;align-items:center;}
.sr3-food{cursor:grab;touch-action:none;user-select:none;transition:transform .12s;display:flex;align-items:center;justify-content:center;}
.sr3-food-emoji{font-size:calc(2.2rem * var(--sr3-fscale,1));line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.2));}
.sr3-food:active{transform:scale(1.1);}
.sr3-food--drag{cursor:grabbing;z-index:100;}
.sr3-food--drag .sr3-food-emoji{transform:scale(1.18);}
.sr3-food--in{animation:sr3-pop .4s ease;cursor:default;}
.sr3-food--in .sr3-food-emoji{font-size:calc(1.5rem * var(--sr3-fscale,1));}
@keyframes sr3-pop{0%{transform:scale(.6)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@media (max-width:380px){.sr3-bowl-shape{font-size:2.4rem;}.sr3-bowl{padding:8px 6px;}}
`;
}

export function create(): SizeRecipeGame {
  return new SizeRecipeGame();
}
