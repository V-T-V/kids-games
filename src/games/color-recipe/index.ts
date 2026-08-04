/* 调色配方 Color Recipe —— 烧杯里要调出目标色，屏幕上写着配方
   （如"2 滴红 + 1 滴蓝"）。孩子按配方点对应颜色滴管对应的次数。
   独特点：不是自由配色，而是"照着配方做"——培养读规则、点数能力。
   巧思：滴管按一次掉一滴进烧杯并累计计数；多滴/少滴都判错；
   颜色用三原色配方（红黄蓝），混合结果可预测。难度=配方滴数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Drop {
  color: string; // hex
  name: string;
}

const PIPETTES: Drop[] = [
  { color: "#ff5252", name: "红" },
  { color: "#ffd93d", name: "黄" },
  { color: "#4d96ff", name: "蓝" },
];

interface RecipeItem extends Drop {
  count: number;
}

/** 预设配方池：每个配方有名称、各色滴数、混合后的目标色。 */
const RECIPES: {
  name: string;
  parts: { name: string; count: number }[];
  result: string;
}[] = [
  {
    name: "橙色",
    parts: [
      { name: "红", count: 2 },
      { name: "黄", count: 1 },
    ],
    result: "#ff8c1a",
  },
  {
    name: "绿色",
    parts: [
      { name: "黄", count: 2 },
      { name: "蓝", count: 1 },
    ],
    result: "#5ec46a",
  },
  {
    name: "紫色",
    parts: [
      { name: "红", count: 1 },
      { name: "蓝", count: 2 },
    ],
    result: "#8a4fd6",
  },
  {
    name: "草青",
    parts: [
      { name: "蓝", count: 1 },
      { name: "黄", count: 1 },
      { name: "红", count: 1 },
    ],
    result: "#7a6a4a",
  },
  {
    name: "蜜橘",
    parts: [
      { name: "红", count: 1 },
      { name: "黄", count: 2 },
    ],
    result: "#ffc24a",
  },
];

export class ColorRecipeGame extends BaseGame {
  constructor() {
    super("color-recipe");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private recipe!: RecipeItem[];
  private recipeName = "";
  private targetHex = "#ff8c1a";
  /** 当前每种颜色已滴入的次数。 */
  private dropped: Record<string, number> = {};

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.pickRecipe();
    this.dropped = {};
    this.render();
  }

  /** 按难度选配方：easy 用 2 色配方，medium/hard 用 3 色或更多滴。 */
  private pickRecipe(): void {
    const pool =
      this.difficulty === "easy"
        ? RECIPES.filter(
            (r) => r.parts.length === 2 && r.parts.every((p) => p.count <= 2),
          )
        : this.difficulty === "medium"
          ? RECIPES.filter((r) => r.parts.reduce((s, p) => s + p.count, 0) <= 4)
          : RECIPES;
    const r = sample(pool.length > 0 ? pool : RECIPES);
    this.recipeName = r.name;
    this.targetHex = r.result;
    // 把配方映射成带颜色的 RecipeItem；顺序打乱避免总是"红在前"
    const colorMap = new Map(PIPETTES.map((p) => [p.name, p]));
    this.recipe = shuffle(r.parts).map((p) => {
      const drop = colorMap.get(p.name)!;
      return { color: drop.color, name: drop.name, count: p.count };
    });
  }

  private render(): void {
    const wrap = document.createElement("div");
    wrap.className = "crp-wrap";

    const task = document.createElement("div");
    task.className = "crp-task";
    task.innerHTML = `照配方调出 <b>${this.recipeName}</b>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    /* —— 配方卡 —— */
    const card = document.createElement("div");
    card.className = "crp-recipe";
    this.recipe.forEach((r) => {
      const chip = document.createElement("div");
      chip.className = "crp-chip";
      chip.innerHTML = `<span class="crp-chip__dot" style="background:${r.color}"></span><span class="crp-chip__text"><b>${r.count}</b> 滴 ${r.name}</span>`;
      card.appendChild(chip);
    });
    wrap.appendChild(card);

    /* —— 烧杯（目标色） —— */
    const beakerWrap = document.createElement("div");
    beakerWrap.className = "crp-beaker-wrap";
    const beaker = document.createElement("div");
    beaker.className = "crp-beaker";
    const liquid = document.createElement("div");
    liquid.className = "crp-beaker__liquid";
    liquid.id = "crp-liquid";
    liquid.style.background = this.currentColor();
    beaker.appendChild(liquid);
    beakerWrap.appendChild(beaker);
    const hint = document.createElement("div");
    hint.className = "crp-hint";
    hint.id = "crp-hint";
    hint.textContent = "点下面的滴管，按配方滴颜色～";
    beakerWrap.appendChild(hint);
    wrap.appendChild(beakerWrap);

    /* —— 滴管 —— */
    const palette = document.createElement("div");
    palette.className = "crp-palette";
    PIPETTES.forEach((p) => {
      const used = this.dropped[p.name] ?? 0;
      const need = this.recipe
        .filter((r) => r.name === p.name)
        .reduce((s, r) => s + r.count, 0);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "crp-drop";
      btn.style.setProperty("--ink", p.color);
      btn.innerHTML = `<span class="crp-drop__pip"></span><span class="crp-drop__label">${p.name}</span><span class="crp-drop__count">${used}/${need}</span>`;
      btn.addEventListener("click", () => this.addDrop(p));
      palette.appendChild(btn);
    });
    wrap.appendChild(palette);

    this.root.appendChild(wrap);
  }

  /** 按当前已滴颜色简单混合（均匀加权平均），仅做视觉反馈。 */
  private currentColor(): string {
    let rs = 0,
      gs = 0,
      bs = 0,
      n = 0;
    this.recipe.forEach((r) => {
      const got = Math.min(this.dropped[r.name] ?? 0, r.count);
      const [rr, gg, bb] = hexToRgb(r.color);
      rs += rr * got;
      gs += gg * got;
      bs += bb * got;
      n += got;
    });
    if (n === 0) return "rgba(255,255,255,.9)";
    return `rgb(${Math.round(rs / n)},${Math.round(gs / n)},${Math.round(bs / n)})`;
  }

  private addDrop(p: Drop): void {
    const need = this.recipe
      .filter((r) => r.name === p.name)
      .reduce((s, r) => s + r.count, 0);
    if ((this.dropped[p.name] ?? 0) >= need) {
      // 已经滴够了这种颜色，再多滴视为错误
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    this.dropped[p.name] = (this.dropped[p.name] ?? 0) + 1;
    sfxPop();
    this.resetWrongStreak();
    // 动画 + 刷新
    const r = this.root.querySelector(".crp-beaker")!.getBoundingClientRect();
    this.flyDrop(p.color, r);
    this.trackTimeout(() => this.refresh(), 120);
    // 全部滴够 → 判定
    const done = this.recipe.every(
      (it) => (this.dropped[it.name] ?? 0) === it.count,
    );
    if (done) {
      this.trackTimeout(() => this.judge(), 360);
    }
  }

  private flyDrop(color: string, beakerRect: DOMRect): void {
    const drop = document.createElement("div");
    drop.className = "crp-fly";
    drop.style.background = color;
    drop.style.left = `${beakerRect.left + beakerRect.width / 2}px`;
    drop.style.top = `${beakerRect.top - 8}px`;
    document.body.appendChild(drop);
    this.trackTimeout(() => drop.remove(), 600);
    void color;
  }

  private refresh(): void {
    const liquid = this.root.querySelector("#crp-liquid") as HTMLElement | null;
    if (liquid) {
      liquid.style.background = this.currentColor();
      const total = this.recipe.reduce((s, r) => s + r.count, 0);
      const got = this.recipe.reduce(
        (s, r) => s + Math.min(this.dropped[r.name] ?? 0, r.count),
        0,
      );
      liquid.style.height = `${18 + (got / total) * 60}%`;
    }
    // 刷新滴管计数
    const btns = this.root.querySelectorAll<HTMLButtonElement>(".crp-drop");
    PIPETTES.forEach((p, i) => {
      const btn = btns[i];
      if (!btn) return;
      const used = this.dropped[p.name] ?? 0;
      const need = this.recipe
        .filter((r) => r.name === p.name)
        .reduce((s, r) => s + r.count, 0);
      const countEl = btn.querySelector(".crp-drop__count");
      if (countEl) countEl.textContent = `${used}/${need}`;
      btn.classList.toggle("crp-drop--done", used >= need && need > 0);
    });
  }

  private judge(): void {
    const ok = this.recipe.every(
      (it) => (this.dropped[it.name] ?? 0) === it.count,
    );
    const hint = this.root.querySelector("#crp-hint") as HTMLElement | null;
    if (ok) {
      if (hint) hint.textContent = `调好啦！这就是${this.recipeName}～ 🌟`;
      const beaker = this.root.querySelector(".crp-beaker")!;
      const r = beaker.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    } else {
      // 理论上 addDrop 已经挡住了多滴，这里兜底
      if (hint) hint.textContent = "还差一点点，照配方再滴～";
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看配方：每种颜色要滴几滴？数一数～",
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
    if (document.getElementById("crp-style")) return;
    const st = document.createElement("style");
    st.id = "crp-style";
    st.textContent = CRP_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function CRP_CSS(theme: string): string {
  return `
.crp-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(460px,100%);}
.crp-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.crp-recipe{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.crp-chip{display:flex;align-items:center;gap:8px;background:#fff;padding:8px 14px;border-radius:14px;box-shadow:var(--shadow);font-weight:700;}
.crp-chip__dot{width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.2);}
.crp-chip__text b{color:${theme};font-size:1.2rem;}
.crp-beaker-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;}
.crp-beaker{width:120px;height:150px;border:6px solid ${theme};border-top:none;border-radius:0 0 28px 28px;position:relative;overflow:hidden;background:rgba(255,255,255,.5);box-shadow:var(--shadow);}
.crp-beaker__liquid{position:absolute;bottom:0;left:0;right:0;height:18%;transition:height .3s ease,background .3s ease;background:rgba(255,255,255,.9);}
.crp-beaker__liquid::after{content:'';position:absolute;top:-4px;left:0;right:0;height:8px;background:inherit;border-radius:50%;opacity:.7;}
.crp-hint{font-size:1rem;font-weight:700;color:var(--ink-soft);min-height:1.4em;text-align:center;}
.crp-palette{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;}
.crp-drop{display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:none;cursor:pointer;}
.crp-drop__pip{width:46px;height:60px;border-radius:14px 14px 20px 20px;background:linear-gradient(160deg,var(--ink),color-mix(in srgb,var(--ink) 65%,#000));box-shadow:inset -4px -4px 0 rgba(0,0,0,.15),var(--shadow);position:relative;}
.crp-drop__pip::before{content:'';position:absolute;top:-10px;left:50%;transform:translateX(-50%);width:16px;height:14px;background:var(--ink);border-radius:8px 8px 2px 2px;}
.crp-drop__pip::after{content:'';position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:8px;height:8px;background:var(--ink);border-radius:50%;}
.crp-drop:active .crp-drop__pip{transform:translateY(3px);}
.crp-drop__label{font-size:1rem;font-weight:800;}
.crp-drop__count{font-size:.8rem;font-weight:700;color:var(--ink-soft);background:#fff;padding:1px 8px;border-radius:8px;}
.crp-drop--done .crp-drop__count{background:${theme};color:#fff;}
.crp-fly{position:fixed;width:14px;height:18px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;pointer-events:none;z-index:200;animation:crp-fall .5s ease-in forwards;}
@keyframes crp-fall{0%{transform:translateY(-30px) scale(1);opacity:1}80%{opacity:1}100%{transform:translateY(60px) scale(.6);opacity:0}}
@media (max-width:380px){.crp-drop__pip{width:38px;height:52px;}.crp-palette{gap:12px;}}
`;
}

export function create(): ColorRecipeGame {
  return new ColorRecipeGame();
}
