/* 捡落叶 Leaf Sort —— 地上散落不同颜色和形状的叶子，几个篮子，
   孩子把叶子拖到正确篮子。可按颜色分，也可按形状分。
   独特点：自然主题 + 双维度分类（颜色 / 形状），区别于 color-sort（仅颜色）。
   视觉：落叶 emoji + 彩色编织篮子。难度 = 叶子数 / 分类维度。
   通关 = 分完目标轮数。用 bindPointer 拖拽。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Leaf {
  emoji: string;
  /** 颜色键 */
  color: string;
  /** 形状键 */
  shape: string;
  el: HTMLElement;
  placed: boolean;
}

const LEAVES = [
  { emoji: "🍁", color: "red", shape: "maple" },
  { emoji: "🍂", color: "brown", shape: "oak" },
  { emoji: "🍃", color: "green", shape: "oval" },
  { emoji: "🌿", color: "green", shape: "fern" },
] as const;

const COLOR_STYLE: Record<string, { hex: string; name: string }> = {
  red: { hex: "#ff6348", name: "红" },
  brown: { hex: "#b08968", name: "棕" },
  green: { hex: "#6bcf7f", name: "绿" },
};

const SHAPE_STYLE: Record<string, { emoji: string; name: string }> = {
  maple: { emoji: "🍁", name: "枫叶" },
  oak: { emoji: "🍂", name: "橡叶" },
  oval: { emoji: "🍃", name: "椭圆" },
  fern: { emoji: "🌿", name: "蕨叶" },
};

export class LeafSortGame extends BaseGame {
  constructor() {
    super("leaf-sort");
  }
  private unbinds: (() => void)[] = [];
  private baskets: HTMLDivElement[] = [];
  private leaves: Leaf[] = [];
  private remaining = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  /** 当前轮按什么维度分：'color' | 'shape' */
  private by: "color" | "shape" = "color";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
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
    this.leaves = [];

    // 维度：easy/medium 按颜色，hard 按形状
    this.by = this.difficulty === "hard" ? "shape" : "color";
    const groupCount =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    const perGroup =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 2 : 3;

    // 选 groupCount 个不同的组键
    const keys =
      this.by === "color"
        ? shuffle(Object.keys(COLOR_STYLE)).slice(0, groupCount)
        : shuffle(Object.keys(SHAPE_STYLE)).slice(0, groupCount);

    const wrap = document.createElement("div");
    wrap.className = "lf-wrap";
    const task = document.createElement("div");
    task.className = "lf-task";
    task.id = "lf-task";
    task.textContent =
      this.by === "color"
        ? "把叶子拖到相同颜色的篮子里～"
        : "把叶子拖到相同形状的篮子里～";
    wrap.appendChild(task);

    // 叶子区（地上）
    const ground = document.createElement("div");
    ground.className = "lf-ground";
    const allLeaves: { emoji: string; color: string; shape: string }[] = [];
    keys.forEach((k) => {
      for (let i = 0; i < perGroup; i++) {
        // 找一个该 key 的叶子模板
        const tpl = LEAVES.find(
          (l) => (this.by === "color" ? l.color : l.shape) === k,
        );
        if (tpl)
          allLeaves.push({
            emoji: tpl.emoji,
            color: tpl.color,
            shape: tpl.shape,
          });
      }
    });
    this.remaining = allLeaves.length;

    shuffle(allLeaves).forEach((it) => {
      const el = document.createElement("div");
      el.className = "lf-leaf";
      el.textContent = it.emoji;
      // 随机轻微旋转，模拟散落
      el.style.setProperty(
        "--rot",
        `${Math.floor(Math.random() * 60 - 30)}deg`,
      );
      ground.appendChild(el);
      const leaf: Leaf = { ...it, el, placed: false };
      this.leaves.push(leaf);
      this.enableDrag(leaf);
    });

    wrap.appendChild(ground);

    // 篮子区
    const basketRow = document.createElement("div");
    basketRow.className = "lf-baskets";
    this.baskets = [];
    const fill = new Map<string, number>();
    keys.forEach((k) => fill.set(k, 0));

    keys.forEach((k) => {
      const b = document.createElement("div");
      b.className = "lf-basket";
      b.dataset.key = k;
      b.dataset.need = String(perGroup);
      if (this.by === "color") {
        const cs = COLOR_STYLE[k]!;
        b.style.setProperty("--bcolor", cs.hex);
        b.innerHTML = `<div class="lf-basket__emoji">🧺</div><div class="lf-basket__label">${cs.name}</div><div class="lf-basket__count">0/${perGroup}</div>`;
      } else {
        const ss = SHAPE_STYLE[k]!;
        b.style.setProperty("--bcolor", "#b08968");
        b.innerHTML = `<div class="lf-basket__emoji">🧺</div><div class="lf-basket__label">${ss.emoji} ${ss.name}</div><div class="lf-basket__count">0/${perGroup}</div>`;
      }
      basketRow.appendChild(b);
      this.baskets.push(b);
    });
    wrap.appendChild(basketRow);

    this.root.appendChild(wrap);
  }

  private enableDrag(leaf: Leaf): void {
    let dragging = false;
    let offX = 0,
      offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (leaf.placed) return;
      dragging = true;
      const r = leaf.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = leaf.el.parentElement;
      leaf.el.classList.add("lf-leaf--drag");
      leaf.el.style.position = "fixed";
      leaf.el.style.left = `${p.x - offX}px`;
      leaf.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(leaf.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      leaf.el.style.left = `${p.x - offX}px`;
      leaf.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      leaf.el.classList.remove("lf-leaf--drag");
      const basket = this.baskets.find((b) => {
        const r = b.getBoundingClientRect();
        return (
          p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
        );
      });
      const leafKey = this.by === "color" ? leaf.color : leaf.shape;
      if (basket && basket.dataset.key === leafKey) {
        leaf.placed = true;
        leaf.el.remove();
        this.remaining -= 1;
        const cnt = basket.querySelector(".lf-basket__count")!;
        const placed = Number(basket.dataset.placed ?? "0") + 1;
        basket.dataset.placed = String(placed);
        cnt.textContent = `${placed}/${basket.dataset.need}`;
        if (placed >= Number(basket.dataset.need))
          basket.classList.add("lf-basket--full");
        const r = basket.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top);
        this.resetWrongStreak();
        if (this.remaining <= 0) {
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 900);
        }
      } else {
        // 归位
        leaf.el.style.position = "";
        leaf.el.style.left = "";
        leaf.el.style.top = "";
        origin?.appendChild(leaf.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(leaf.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body:
        this.by === "color"
          ? "看看叶子和篮子是不是同一个颜色～"
          : "看看叶子的形状像哪只篮子～",
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
    if (document.getElementById("lf-style")) return;
    const st = document.createElement("style");
    st.id = "lf-style";
    st.textContent = LF_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function LF_CSS(theme: string): string {
  return `
.lf-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(540px,100%);}
.lf-task{font-size:1.1rem;font-weight:800;text-align:center;}
.lf-ground{position:relative;width:100%;min-height:120px;background:linear-gradient(180deg,rgba(255,255,255,.4),rgba(176,137,104,.18));border-radius:18px;padding:14px;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center;box-shadow:var(--shadow);}
.lf-leaf{font-size:2.4rem;cursor:grab;touch-action:none;filter:drop-shadow(0 3px 3px rgba(0,0,0,.2));transform:rotate(var(--rot,0deg));transition:transform .12s ease;}
.lf-leaf--drag{cursor:grabbing;transform:rotate(0deg) scale(1.25);z-index:100;}
.lf-baskets{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.lf-basket{width:104px;min-height:120px;border-radius:14px 14px 10px 10px;background:color-mix(in srgb,var(--bcolor,${theme}) 22%,#fff);border:4px solid var(--bcolor,${theme});display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px;box-shadow:var(--shadow);}
.lf-basket__emoji{font-size:2.4rem;}
.lf-basket__label{font-size:.9rem;font-weight:800;color:var(--ink);}
.lf-basket__count{font-size:.8rem;font-weight:700;color:var(--ink-soft);}
.lf-basket--full{animation:lf-happy .5s ease;background:color-mix(in srgb,var(--bcolor,${theme}) 45%,#fff);}
.lf-basket--full .lf-basket__emoji::after{content:'😊';}
@keyframes lf-happy{0%{transform:scale(1)}50%{transform:scale(1.12) rotate(-4deg)}100%{transform:scale(1)}}
`;
}

export function create(): LeafSortGame {
  return new LeafSortGame();
}
