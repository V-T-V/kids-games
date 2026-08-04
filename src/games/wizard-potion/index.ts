/* 巫师药水 Wizard Potion —— 按配方（如"2 滴蓝 + 1 滴红"）用滴管往烧杯里滴药水。
   独特点：奇幻风巫师坩埚，魔药会冒泡发光；配方有目标颜色提示。
   巧思：滴管按一次掉一滴并累计；多滴/错色判错；难度=配方复杂度。
   数据保证：每个配方都从池子里挑，必然有解。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

const PIPETTES = [
  { color: "#5dbeff", name: "蓝" },
  { color: "#ff5b6e", name: "红" },
  { color: "#9be84a", name: "绿" },
  { color: "#ffd93d", name: "黄" },
];

interface RecipePart {
  color: string;
  name: string;
  count: number;
}

/** 配方池：每个配方包含各色滴数 + 目标颜色 + 奇幻名。 */
const RECIPES: {
  name: string;
  emoji: string;
  parts: { name: string; count: number }[];
  result: string;
}[] = [
  {
    name: "月光药水",
    emoji: "🌙",
    parts: [
      { name: "蓝", count: 2 },
      { name: "黄", count: 1 },
    ],
    result: "#7fb8e8",
  },
  {
    name: "火焰药水",
    emoji: "🔥",
    parts: [
      { name: "红", count: 2 },
      { name: "黄", count: 1 },
    ],
    result: "#ff7a3c",
  },
  {
    name: "森林药水",
    emoji: "🌿",
    parts: [
      { name: "绿", count: 2 },
      { name: "蓝", count: 1 },
    ],
    result: "#5ec48a",
  },
  {
    name: "玫瑰药水",
    emoji: "🌹",
    parts: [
      { name: "红", count: 1 },
      { name: "黄", count: 2 },
    ],
    result: "#ffb04a",
  },
  {
    name: "龙血药水",
    emoji: "🐉",
    parts: [
      { name: "红", count: 2 },
      { name: "绿", count: 1 },
    ],
    result: "#a85a3a",
  },
  {
    name: "彩虹药水",
    emoji: "🌈",
    parts: [
      { name: "蓝", count: 1 },
      { name: "红", count: 1 },
      { name: "黄", count: 1 },
    ],
    result: "#b08a6a",
  },
];

export class WizardPotionGame extends BaseGame {
  constructor() {
    super("wizard-potion");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private recipe!: RecipePart[];
  private recipeName = "";
  private recipeEmoji = "";
  private targetHex = "#7fb8e8";
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
    this.recipeEmoji = r.emoji;
    this.targetHex = r.result;
    const colorMap = new Map(PIPETTES.map((p) => [p.name, p]));
    this.recipe = shuffle(r.parts).map((p) => {
      const drop = colorMap.get(p.name)!;
      return { color: drop.color, name: drop.name, count: p.count };
    });
  }

  private render(): void {
    const wrap = document.createElement("div");
    wrap.className = "wzp-wrap";

    const task = document.createElement("div");
    task.className = "wzp-task";
    task.innerHTML = `${this.recipeEmoji} 调出 <b>${this.recipeName}</b><span class="wzp-prog">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    // 配方卡
    const card = document.createElement("div");
    card.className = "wzp-recipe";
    this.recipe.forEach((rp) => {
      const chip = document.createElement("div");
      chip.className = "wzp-chip";
      chip.innerHTML = `<span class="wzp-chip__dot" style="background:${rp.color}"></span><b>${rp.count}</b> 滴 ${rp.name}`;
      card.appendChild(chip);
    });
    wrap.appendChild(card);

    // 目标色提示 + 坩埚
    const cauldronWrap = document.createElement("div");
    cauldronWrap.className = "wzp-cauldron-wrap";
    const target = document.createElement("div");
    target.className = "wzp-target";
    target.innerHTML = `<span class="wzp-target__label">目标色</span><span class="wzp-target__swatch" style="background:${this.targetHex}"></span>`;
    cauldronWrap.appendChild(target);

    const cauldron = document.createElement("div");
    cauldron.className = "wzp-cauldron";
    const liquid = document.createElement("div");
    liquid.className = "wzp-cauldron__liquid";
    liquid.id = "wzp-liquid";
    liquid.style.background = this.currentColor();
    const bubbleLayer = document.createElement("div");
    bubbleLayer.className = "wzp-cauldron__bubbles";
    bubbleLayer.id = "wzp-bubbles";
    cauldron.appendChild(liquid);
    cauldron.appendChild(bubbleLayer);
    cauldronWrap.appendChild(cauldron);

    const hint = document.createElement("div");
    hint.className = "wzp-hint";
    hint.id = "wzp-hint";
    hint.textContent = "点下面的魔药滴管，照配方滴～";
    cauldronWrap.appendChild(hint);
    wrap.appendChild(cauldronWrap);

    // 滴管
    const palette = document.createElement("div");
    palette.className = "wzp-palette";
    // 只显示配方用到的颜色 + 1 个干扰色（medium/hard）
    const usedNames = new Set(this.recipe.map((r) => r.name));
    const showPips = PIPETTES.filter((p) => usedNames.has(p.name));
    if (this.difficulty !== "easy") {
      const distractor = shuffle(
        PIPETTES.filter((p) => !usedNames.has(p.name)),
      )[0];
      if (distractor) showPips.push(distractor);
    }
    shuffle(showPips).forEach((p) => {
      const used = this.dropped[p.name] ?? 0;
      const need = this.recipe
        .filter((r) => r.name === p.name)
        .reduce((s, r) => s + r.count, 0);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wzp-drop";
      btn.style.setProperty("--ink", p.color);
      btn.innerHTML = `<span class="wzp-drop__pip"></span><span class="wzp-drop__label">${p.name}</span><span class="wzp-drop__count">${used}/${need}</span>`;
      btn.addEventListener("click", () => this.addDrop(p));
      palette.appendChild(btn);
    });
    wrap.appendChild(palette);

    this.root.appendChild(wrap);
  }

  private currentColor(): string {
    let rs = 0;
    let gs = 0;
    let bs = 0;
    let n = 0;
    this.recipe.forEach((r) => {
      const got = Math.min(this.dropped[r.name] ?? 0, r.count);
      const [rr, gg, bb] = hexToRgb(r.color);
      rs += rr * got;
      gs += gg * got;
      bs += bb * got;
      n += got;
    });
    if (n === 0) return "rgba(120,90,160,.4)";
    return `rgb(${Math.round(rs / n)},${Math.round(gs / n)},${Math.round(bs / n)})`;
  }

  private addDrop(p: { color: string; name: string }): void {
    const need = this.recipe
      .filter((r) => r.name === p.name)
      .reduce((s, r) => s + r.count, 0);
    if (need === 0) {
      // 配方里没这种颜色，滴错了
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    if ((this.dropped[p.name] ?? 0) >= need) {
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    this.dropped[p.name] = (this.dropped[p.name] ?? 0) + 1;
    sfxPop();
    this.resetWrongStreak();
    const cauldron = this.root.querySelector(".wzp-cauldron")!;
    const r = cauldron.getBoundingClientRect();
    this.flyDrop(p.color, r);
    this.addBubble();
    this.trackTimeout(() => this.refresh(), 120);
    const done = this.recipe.every(
      (it) => (this.dropped[it.name] ?? 0) === it.count,
    );
    if (done) {
      this.trackTimeout(() => this.judge(), 380);
    }
  }

  private flyDrop(color: string, rect: DOMRect): void {
    const drop = document.createElement("div");
    drop.className = "wzp-fly";
    drop.style.background = color;
    drop.style.left = `${rect.left + rect.width / 2}px`;
    drop.style.top = `${rect.top - 10}px`;
    document.body.appendChild(drop);
    this.trackTimeout(() => drop.remove(), 600);
  }

  private addBubble(): void {
    const layer = this.root.querySelector("#wzp-bubbles");
    if (!layer) return;
    const b = document.createElement("span");
    b.className = "wzp-bubble";
    b.style.left = `${10 + Math.random() * 70}%`;
    b.style.animationDuration = `${1.4 + Math.random() * 0.8}s`;
    layer.appendChild(b);
    this.trackTimeout(() => b.remove(), 2400);
  }

  private refresh(): void {
    const liquid = this.root.querySelector("#wzp-liquid") as HTMLElement | null;
    if (liquid) {
      liquid.style.background = this.currentColor();
      const total = this.recipe.reduce((s, r) => s + r.count, 0);
      const got = this.recipe.reduce(
        (s, r) => s + Math.min(this.dropped[r.name] ?? 0, r.count),
        0,
      );
      liquid.style.height = `${30 + (got / total) * 55}%`;
    }
    const btns = this.root.querySelectorAll<HTMLButtonElement>(".wzp-drop");
    btns.forEach((btn) => {
      const label = btn.querySelector(".wzp-drop__label")?.textContent ?? "";
      const need = this.recipe
        .filter((r) => r.name === label)
        .reduce((s, r) => s + r.count, 0);
      const used = this.dropped[label] ?? 0;
      const countEl = btn.querySelector(".wzp-drop__count");
      if (countEl) countEl.textContent = `${used}/${need}`;
      btn.classList.toggle("wzp-drop--done", need > 0 && used >= need);
    });
  }

  private judge(): void {
    const ok = this.recipe.every(
      (it) => (this.dropped[it.name] ?? 0) === it.count,
    );
    const hint = this.root.querySelector("#wzp-hint") as HTMLElement | null;
    if (ok) {
      if (hint)
        hint.textContent = `${this.recipeEmoji} 调好啦！这就是${this.recipeName}～ 🌟`;
      const cauldron = this.root.querySelector(".wzp-cauldron")!;
      const r = cauldron.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    } else {
      if (hint) hint.textContent = "还差一点，照配方再滴～";
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
    if (document.getElementById("wzp-style")) return;
    const st = document.createElement("style");
    st.id = "wzp-style";
    st.textContent = WZP_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function WZP_CSS(theme: string): string {
  void theme;
  return `
.wzp-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.wzp-task{font-size:1.15rem;font-weight:800;text-align:center;background:linear-gradient(90deg,#fff,#f3e8ff);padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.wzp-prog{font-size:.85rem;color:var(--ink-soft);font-weight:700;margin-left:6px;}
.wzp-recipe{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.wzp-chip{display:flex;align-items:center;gap:6px;background:#fff;padding:8px 14px;border-radius:14px;box-shadow:var(--shadow);font-weight:700;font-size:.95rem;}
.wzp-chip b{color:var(--c-purple);font-size:1.15rem;}
.wzp-chip__dot{width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.2);}
.wzp-cauldron-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;}
.wzp-target{display:flex;align-items:center;gap:8px;background:#fff;padding:4px 12px;border-radius:999px;box-shadow:var(--shadow);}
.wzp-target__label{font-size:.85rem;font-weight:700;color:var(--ink-soft);}
.wzp-target__swatch{width:30px;height:30px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.3);}
.wzp-cauldron{width:160px;height:120px;border-radius:0 0 80px 80px / 0 0 70px 70px;background:linear-gradient(180deg,#444,#222);position:relative;overflow:hidden;box-shadow:var(--shadow);border:4px solid #333;}
.wzp-cauldron::before{content:'';position:absolute;top:-6px;left:-8px;right:-8px;height:14px;background:#333;border-radius:14px;}
.wzp-cauldron__liquid{position:absolute;bottom:0;left:0;right:0;height:30%;transition:height .3s ease,background .3s ease;background:rgba(120,90,160,.4);}
.wzp-cauldron__liquid::after{content:'';position:absolute;top:-5px;left:0;right:0;height:10px;background:inherit;border-radius:50%;opacity:.6;}
.wzp-cauldron__bubbles{position:absolute;inset:0;pointer-events:none;}
.wzp-bubble{position:absolute;bottom:10%;width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.5);animation:wzp-rise 1.6s ease-out forwards;}
@keyframes wzp-rise{0%{transform:translateY(0) scale(.5);opacity:0}20%{opacity:1}100%{transform:translateY(-60px) scale(1.2);opacity:0}}
.wzp-hint{font-size:1rem;font-weight:700;color:var(--ink-soft);min-height:1.4em;text-align:center;}
.wzp-palette{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.wzp-drop{display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:none;cursor:pointer;}
.wzp-drop__pip{width:40px;height:54px;border-radius:12px 12px 18px 18px;background:linear-gradient(160deg,var(--ink),color-mix(in srgb,var(--ink) 60%,#000));box-shadow:inset -3px -3px 0 rgba(0,0,0,.2),var(--shadow);position:relative;}
.wzp-drop__pip::before{content:'';position:absolute;top:-9px;left:50%;transform:translateX(-50%);width:14px;height:12px;background:var(--ink);border-radius:7px 7px 2px 2px;}
.wzp-drop__pip::after{content:'';position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);width:7px;height:7px;background:var(--ink);border-radius:50%;}
.wzp-drop:active .wzp-drop__pip{transform:translateY(3px);}
.wzp-drop__label{font-size:.95rem;font-weight:800;}
.wzp-drop__count{font-size:.78rem;font-weight:700;color:var(--ink-soft);background:#fff;padding:1px 8px;border-radius:8px;}
.wzp-drop--done .wzp-drop__count{background:var(--c-green);color:#fff;}
.wzp-fly{position:fixed;width:12px;height:16px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;pointer-events:none;z-index:200;animation:wzp-fall .5s ease-in forwards;}
@keyframes wzp-fall{0%{transform:translateY(-30px) scale(1);opacity:1}80%{opacity:1}100%{transform:translateY(50px) scale(.6);opacity:0}}
@media (max-width:380px){.wzp-drop__pip{width:34px;height:46px;}.wzp-palette{gap:10px;}.wzp-cauldron{width:130px;height:100px;}}
`;
}

export function create(): WizardPotionGame {
  return new WizardPotionGame();
}
