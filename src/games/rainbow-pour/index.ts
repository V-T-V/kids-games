/* 彩虹水 Rainbow Pour —— 烧杯目标色（如橙色），下方有红/黄/蓝三原色滴管，
   孩子按比例加色，颜色混合到匹配目标即过关。红+黄=橙、黄+蓝=绿、红+蓝=紫。
   独特点：减色/加色混合直觉认知。把 RGB 累加做归一混合，比对目标色相似度。
   视觉：烧杯液体 + 三色滴管。难度=目标色复杂度。通关=调对目标轮数。
   保证有解：目标色都是可由三原色按某比例配出的颜色。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

/** 三原色（滴管可用） */
const PRIMARY = [
  { key: "r", color: "#ff5252", name: "红" },
  { key: "g", color: "#5ccc5c", name: "黄" }, // 黄（key 用 g 表示 yellow 通道）
  { key: "b", color: "#5278ff", name: "蓝" },
] as const;

/** 候选目标色：每个都是三原色按比例可配出（recipe 用 r/g/b 0..3 的份数） */
const TARGETS: {
  name: string;
  hex: string;
  recipe: { r: number; g: number; b: number };
}[] = [
  { name: "橙色", hex: "#ff9f43", recipe: { r: 2, g: 2, b: 0 } }, // 红+黄
  { name: "绿色", hex: "#5ccc5c", recipe: { r: 0, g: 2, b: 2 } }, // 黄+蓝
  { name: "紫色", hex: "#9b5cff", recipe: { r: 2, g: 0, b: 2 } }, // 红+蓝
  { name: "棕色", hex: "#a0673a", recipe: { r: 2, g: 2, b: 1 } }, // 三色
  { name: "橙红", hex: "#ff7043", recipe: { r: 3, g: 1, b: 0 } },
  { name: "蓝绿", hex: "#3fb6b0", recipe: { r: 0, g: 1, b: 3 } },
];

/** 把当前份数混合成展示色（RGB 均值混合） */
function mixColor(r: number, g: number, b: number): string {
  if (r + g + b === 0) return "#ffffff";
  // 各原色 RGB（与 PRIMARY 对齐）
  const R: [number, number, number] = [255, 82, 82];
  const Y: [number, number, number] = [92, 204, 92]; // 黄通道（key=g）
  const B: [number, number, number] = [82, 120, 255];
  let cr = 0,
    cg = 0,
    cb = 0;
  cr += r * R[0] + g * Y[0] + b * B[0];
  cg += r * R[1] + g * Y[1] + b * B[1];
  cb += r * R[2] + g * Y[2] + b * B[2];
  const total = r + g + b;
  cr /= total;
  cg /= total;
  cb /= total;
  return `rgb(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)})`;
}

/** 两个 rgb 颜色的相似度（0..1） */
function similarity(c1: string, c2: string): number {
  const p = (c: string): [number, number, number] => {
    if (c.startsWith("#")) {
      return [
        parseInt(c.slice(1, 3), 16),
        parseInt(c.slice(3, 5), 16),
        parseInt(c.slice(5, 7), 16),
      ];
    }
    const m = c.match(/\d+/g);
    return m ? [Number(m[0]!), Number(m[1]!), Number(m[2]!)] : [255, 255, 255];
  };
  const [r1, g1, b1] = p(c1);
  const [r2, g2, b2] = p(c2);
  const dist = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  // 442 是 RGB 最远距离
  return 1 - dist / 442;
}

export class RainbowPourGame extends BaseGame {
  constructor() {
    super("rainbow-pour");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private drops = { r: 0, g: 0, b: 0 };
  private target = TARGETS[0]!;
  private busy = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* trackTimeout 自动清理 */
  }

  /** 选目标：easy 只用双色（2 种原色），medium 三色，hard 引入棕色等 */
  private pickTarget(): (typeof TARGETS)[number] {
    const pool =
      this.difficulty === "easy"
        ? TARGETS.filter(
            (t) =>
              t.recipe.r + t.recipe.g + t.recipe.b === 4 &&
              (t.recipe.r === 0 || t.recipe.g === 0 || t.recipe.b === 0),
          )
        : this.difficulty === "medium"
          ? TARGETS.filter((t) => t.recipe.r + t.recipe.g + t.recipe.b <= 4)
          : TARGETS;
    return sample(pool);
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = false;
    this.drops = { r: 0, g: 0, b: 0 };
    this.target = this.pickTarget();
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "rwp-wrap";

    const task = document.createElement("div");
    task.className = "rwp-task";
    task.innerHTML = `用下面的颜色滴管，把水调成 <b style="color:${this.target.hex}">${this.target.name}</b>！<br><span class="rwp-sub">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "rwp-stage";

    // 目标色样
    const targetChip = document.createElement("div");
    targetChip.className = "rwp-target";
    targetChip.innerHTML = `<div class="rwp-target__chip" style="background:${this.target.hex}"></div><div class="rwp-target__label">目标色</div>`;
    stage.appendChild(targetChip);

    // 烧杯
    const beaker = document.createElement("div");
    beaker.className = "rwp-beaker";
    beaker.innerHTML = `
      <div class="rwp-beaker__liquid" id="rwp-liquid"></div>
      <div class="rwp-beaker__glass"></div>
      <div class="rwp-beaker__hint" id="rwp-hint">加点颜色试试～</div>
    `;
    stage.appendChild(beaker);

    wrap.appendChild(stage);

    // 滴管
    const droppers = document.createElement("div");
    droppers.className = "rwp-droppers";
    shuffle([...PRIMARY]).forEach((p) => {
      const d = document.createElement("button");
      d.type = "button";
      d.className = "rwp-dropper";
      d.style.setProperty("--dc", p.color);
      d.innerHTML = `<div class="rwp-dropper__cap"></div><div class="rwp-dropper__body">➕</div><div class="rwp-dropper__label">${p.name}</div>`;
      d.addEventListener("click", () => this.pour(p.key));
      droppers.appendChild(d);
    });

    // 重置按钮
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "rwp-reset";
    reset.textContent = "🧹 清空重调";
    reset.addEventListener("click", () => {
      this.drops = { r: 0, g: 0, b: 0 };
      this.renderLiquid();
    });

    wrap.appendChild(droppers);
    wrap.appendChild(reset);
    this.root.appendChild(wrap);
    this.renderLiquid();
  }

  private pour(key: "r" | "g" | "b"): void {
    if (this.busy) return;
    this.drops[key] += 1;
    sfxPop();
    this.renderLiquid();
    // 检查是否匹配
    const mixed = mixColor(this.drops.r, this.drops.g, this.drops.b);
    const sim = similarity(mixed, this.target.hex);
    const hint = this.root.querySelector<HTMLElement>("#rwp-hint");
    if (sim >= 0.92) {
      // 调对
      this.busy = true;
      if (hint) hint.textContent = "太棒了，颜色一样啦！🎉";
      this.resetWrongStreak();
      const liquid = this.root.querySelector<HTMLElement>("#rwp-liquid");
      const r = liquid?.getBoundingClientRect();
      if (r) this.onCorrect(r.left + r.width / 2, r.top);
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 950);
    } else {
      // 给温和提示，但不计为答错（孩子可以继续加/重置）
      if (hint) {
        if (sim >= 0.75) hint.textContent = "快啦！再加一点点～";
        else if (sim >= 0.5) hint.textContent = "颜色有点像了，继续～";
        else hint.textContent = "再想想红黄蓝能变出什么～";
      }
    }
  }

  private renderLiquid(): void {
    const liquid = this.root.querySelector<HTMLElement>("#rwp-liquid");
    if (!liquid) return;
    const total = this.drops.r + this.drops.g + this.drops.b;
    const color =
      total === 0
        ? "rgba(255,255,255,.5)"
        : mixColor(this.drops.r, this.drops.g, this.drops.b);
    liquid.style.background = color;
    // 液面高度随总滴数（封顶）
    const hPct = Math.min(85, 18 + total * 12);
    liquid.style.height = `${hPct}%`;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "红+黄=橙，黄+蓝=绿，红+蓝=紫～",
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
    if (document.getElementById("rwp-style")) return;
    const st = document.createElement("style");
    st.id = "rwp-style";
    st.textContent = RWP_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function RWP_CSS(theme: string): string {
  return `
.rwp-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.rwp-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.rwp-sub{font-size:.85rem;font-weight:600;color:var(--ink-soft,#888);}
.rwp-stage{position:relative;width:100%;display:flex;justify-content:center;align-items:flex-end;gap:30px;padding:18px 10px 8px;background:linear-gradient(180deg,#f0eaff,#fff);border-radius:24px;box-shadow:var(--shadow);}
.rwp-target{display:flex;flex-direction:column;align-items:center;gap:6px;}
.rwp-target__chip{width:60px;height:60px;border-radius:14px;box-shadow:0 4px 8px rgba(0,0,0,.2),inset 0 2px 3px rgba(255,255,255,.6);}
.rwp-target__label{font-size:.8rem;font-weight:700;}
.rwp-beaker{position:relative;width:96px;height:160px;}
.rwp-beaker__glass{position:absolute;inset:0;border:5px solid rgba(180,200,230,.85);border-top:none;border-radius:0 0 26px 26px;background:linear-gradient(90deg,rgba(255,255,255,.25),rgba(255,255,255,.05));box-shadow:inset 0 0 12px rgba(255,255,255,.3);}
/* 液体 */
.rwp-beaker__liquid{position:absolute;left:5px;right:5px;bottom:5px;height:18%;background:rgba(255,255,255,.5);border-radius:0 0 22px 22px;transition:height .35s cubic-bezier(.4,1.6,.5,1),background .35s;box-shadow:inset 0 4px 6px rgba(255,255,255,.4);}
.rwp-beaker__hint{position:absolute;left:50%;top:-26px;transform:translateX(-50%);font-size:.78rem;font-weight:700;color:${theme};white-space:nowrap;}
.rwp-droppers{display:flex;gap:14px;}
.rwp-dropper{display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:transparent;cursor:pointer;padding:0;}
.rwp-dropper__cap{width:24px;height:8px;background:${theme};border-radius:3px 3px 0 0;}
.rwp-dropper__body{width:54px;height:64px;border-radius:0 0 30px 30px;background:var(--dc);box-shadow:var(--shadow),inset 0 -6px 8px rgba(0,0,0,.15);color:#fff;font-size:1.6rem;font-weight:800;display:flex;align-items:center;justify-content:center;transition:transform .12s;}
.rwp-dropper:active .rwp-dropper__body{transform:translateY(4px) scale(.96);}
.rwp-dropper__label{font-size:.85rem;font-weight:700;color:var(--ink);}
.rwp-reset{padding:8px 18px;border:none;border-radius:999px;font-weight:700;font-size:.9rem;color:#fff;background:${theme};box-shadow:var(--shadow);cursor:pointer;}
@media (max-width:380px){.rwp-stage{gap:18px;}.rwp-beaker{width:84px;height:140px;}.rwp-dropper__body{width:48px;height:56px;font-size:1.4rem;}}
`;
}

export function create(): RainbowPourGame {
  return new RainbowPourGame();
}
