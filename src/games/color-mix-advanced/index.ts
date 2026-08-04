/* 进阶调色 Color Mix Advanced —— 目标是一个混合色（橙/绿/紫），
   烧杯里要加对应的两种原色。孩子点两种原色滴管，凑出目标色。
   巧思：橙=红+黄 / 绿=蓝+黄 / 紫=红+蓝。选满两滴自动判定。
   视觉：目标色块 + 烧杯 + 滴管。难度=混合色复杂度。通关=调对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface Primary {
  id: string;
  name: string;
  hex: string;
}

const PRIMARIES: Primary[] = [
  { id: "red", name: "红", hex: "#ff5252" },
  { id: "yellow", name: "黄", hex: "#ffd93d" },
  { id: "blue", name: "蓝", hex: "#4d96ff" },
];

/** 混合色：由哪两种原色构成 */
interface MixTarget {
  name: string;
  hex: string;
  parts: string[]; // 两种 primary id
}

const TARGETS: MixTarget[] = [
  { name: "橙色", hex: "#ff8c1a", parts: ["red", "yellow"] },
  { name: "草绿", hex: "#5ec46a", parts: ["yellow", "blue"] },
  { name: "紫色", hex: "#8a4fd6", parts: ["red", "blue"] },
  { name: "橘黄", hex: "#ffc24a", parts: ["red", "yellow"] },
  { name: "青绿", hex: "#3fbfa0", parts: ["yellow", "blue"] },
];

export class ColorMixAdvancedGame extends BaseGame {
  constructor() {
    super("color-mix-advanced");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private target: MixTarget | null = null;
  private picked: Primary[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private startRound(): void {
    this.picked = [];
    // 难度越高池子越复杂
    const pool = this.difficulty === "easy" ? TARGETS.slice(0, 3) : TARGETS;
    this.target = sample(pool);
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.render();
  }

  private render(): void {
    const t = this.target!;
    const wrap = document.createElement("div");
    wrap.className = "cma-wrap";

    const task = document.createElement("div");
    task.className = "cma-task";
    task.innerHTML = `调出 <b>${t.name}</b>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "cma-stage";

    // 目标色块
    const targetBox = document.createElement("div");
    targetBox.className = "cma-target";
    targetBox.innerHTML = `<div class="cma-target__swatch" style="background:${t.hex}"></div><div class="cma-target__label">目标色</div>`;
    stage.appendChild(targetBox);

    // 烧杯（显示已选两色的混合）
    const beaker = document.createElement("div");
    beaker.className = "cma-beaker";
    const liquid = document.createElement("div");
    liquid.className = "cma-beaker__liquid";
    liquid.id = "cma-liquid";
    liquid.style.background = this.currentMix();
    beaker.appendChild(liquid);
    stage.appendChild(beaker);

    wrap.appendChild(stage);

    const hint = document.createElement("div");
    hint.className = "cma-hint";
    hint.id = "cma-hint";
    hint.textContent =
      this.picked.length === 0
        ? "点两种原色滴管，调出目标色～"
        : "再点一种原色～";
    wrap.appendChild(hint);

    // 滴管（顺序固定，便于孩子认）
    const palette = document.createElement("div");
    palette.className = "cma-palette";
    PRIMARIES.forEach((p) => {
      const used = this.picked.some((x) => x.id === p.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cma-drop";
      if (used) btn.classList.add("cma-drop--used");
      btn.style.setProperty("--cma-ink", p.hex);
      btn.innerHTML = `<span class="cma-drop__pip"></span><span class="cma-drop__label">${p.name}</span>`;
      btn.addEventListener("click", () => this.addDrop(p, btn));
      palette.appendChild(btn);
    });
    wrap.appendChild(palette);

    this.root.appendChild(wrap);
  }

  /** 两色等量混合（加权平均），仅视觉反馈 */
  private currentMix(): string {
    if (this.picked.length === 0) return "rgba(255,255,255,.85)";
    const [r1, g1, b1] = hexToRgb(this.picked[0]!.hex);
    if (this.picked.length === 1) {
      return `rgb(${r1},${g1},${b1})`;
    }
    const [r2, g2, b2] = hexToRgb(this.picked[1]!.hex);
    return `rgb(${(r1 + r2) >> 1},${(g1 + g2) >> 1},${(b1 + b2) >> 1})`;
  }

  private addDrop(p: Primary, btn: HTMLButtonElement): void {
    if (this.picked.length >= 2) return;
    if (this.picked.some((x) => x.id === p.id)) {
      // 重复选同一种
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    this.picked.push(p);
    btn.classList.add("cma-drop--used");
    sfxPop();
    this.resetWrongStreak();
    // 刷新液体
    const liquid = this.root.querySelector("#cma-liquid") as HTMLElement | null;
    if (liquid) {
      liquid.style.background = this.currentMix();
      liquid.style.height = `${20 + this.picked.length * 32}%`;
    }
    const hint = this.root.querySelector("#cma-hint");
    if (this.picked.length === 2) {
      this.trackTimeout(() => this.judge(), 360);
    } else if (hint) {
      hint.textContent = "再点一种原色～";
    }
  }

  private judge(): void {
    const t = this.target!;
    const ids = this.picked.map((p) => p.id).sort();
    const need = [...t.parts].sort();
    const ok = ids.length === 2 && ids[0] === need[0] && ids[1] === need[1];
    const hint = this.root.querySelector("#cma-hint") as HTMLElement | null;
    if (ok) {
      if (hint) hint.textContent = `调对啦！这就是${t.name}～ 🌟`;
      const beaker = this.root.querySelector(".cma-beaker")!;
      const r = beaker.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      if (hint) hint.textContent = "颜色不对，再想想～";
      const paused = this.onWrong();
      // 清空重选
      this.trackTimeout(() => {
        this.picked = [];
        const liquid = this.root.querySelector(
          "#cma-liquid",
        ) as HTMLElement | null;
        if (liquid) {
          liquid.style.background = this.currentMix();
          liquid.style.height = "20%";
        }
        this.root
          .querySelectorAll<HTMLButtonElement>(".cma-drop--used")
          .forEach((b) => b.classList.remove("cma-drop--used"));
        if (hint) hint.textContent = "点两种原色滴管，调出目标色～";
      }, 700);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "橙=红+黄 / 绿=蓝+黄 / 紫=红+蓝～",
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
    if (document.getElementById("cma-style")) return;
    const st = document.createElement("style");
    st.id = "cma-style";
    st.textContent = CMA_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function CMA_CSS(theme: string): string {
  return `
.cma-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.cma-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.cma-task b{color:${theme};}
.cma-stage{display:flex;align-items:center;gap:30px;flex-wrap:wrap;justify-content:center;}
.cma-target{display:flex;flex-direction:column;align-items:center;gap:6px;}
.cma-target__swatch{width:96px;height:96px;border-radius:20px;border:5px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.2);}
.cma-target__label{font-size:.85rem;font-weight:800;color:var(--ink-soft);}
.cma-beaker{width:96px;height:128px;border:6px solid ${theme};border-top:none;border-radius:0 0 26px 26px;position:relative;overflow:hidden;background:rgba(255,255,255,.5);box-shadow:var(--shadow);}
.cma-beaker__liquid{position:absolute;bottom:0;left:0;right:0;height:20%;transition:height .35s ease,background .35s ease;}
.cma-beaker__liquid::after{content:'';position:absolute;top:-4px;left:0;right:0;height:8px;background:inherit;border-radius:50%;opacity:.7;}
.cma-hint{font-size:1rem;font-weight:700;color:var(--ink-soft);min-height:1.4em;text-align:center;}
.cma-palette{display:flex;gap:24px;flex-wrap:wrap;justify-content:center;}
.cma-drop{display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:none;cursor:pointer;}
.cma-drop__pip{width:48px;height:62px;border-radius:14px 14px 22px 22px;background:linear-gradient(160deg,var(--cma-ink),color-mix(in srgb,var(--cma-ink) 60%,#000));box-shadow:inset -4px -4px 0 rgba(0,0,0,.15),0 3px 6px rgba(0,0,0,.18);position:relative;transition:opacity .2s;}
.cma-drop__pip::before{content:'';position:absolute;top:-10px;left:50%;transform:translateX(-50%);width:16px;height:14px;background:var(--cma-ink);border-radius:8px 8px 2px 2px;}
.cma-drop__pip::after{content:'';position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:8px;height:8px;background:var(--cma-ink);border-radius:50%;}
.cma-drop:active .cma-drop__pip{transform:translateY(3px);}
.cma-drop__label{font-size:1rem;font-weight:800;}
.cma-drop--used .cma-drop__pip{opacity:.4;}
.cma-drop--used .cma-drop__label{color:${theme};}
@media (max-width:380px){.cma-target__swatch{width:72px;height:72px;}.cma-beaker{width:80px;height:108px;}.cma-stage{gap:18px;}}
`;
}

export function create(): ColorMixAdvancedGame {
  return new ColorMixAdvancedGame();
}
