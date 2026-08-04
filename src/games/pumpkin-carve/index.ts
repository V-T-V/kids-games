/* 南瓜雕刻 Pumpkin Carve —— 南瓜左半边已刻好几个几何孔（三角形/方形/圆形/星形），
   孩子要在右半边的对称位置刻出形状一样的孔。
   独特点：左右镜像对称 + 形状识别。左半固定显示已刻孔，右半对应位置是空轮廓，
   孩子先在形状盘选形状，再点右半空位刻下去；形状对才刻得上。
   视觉：大南瓜 + 发光雕刻孔 + 中线。难度=孔数。通关=刻完目标轮数。
   解保证：右半每个空位都有唯一目标形状，形状盘提供这些形状（+1 干扰）。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

/** 雕刻形状：emoji + 颜色，孩子靠形状（而非颜色）匹配。 */
const SHAPES = [
  { glyph: "▲", color: "#ffd93d", name: "三角" },
  { glyph: "■", color: "#4d96ff", name: "方块" },
  { glyph: "●", color: "#ff6b9d", name: "圆形" },
  { glyph: "★", color: "#6bcf7f", name: "星星" },
  { glyph: "◆", color: "#a55eea", name: "菱形" },
] as const;

interface Hole {
  /** 南瓜内部的百分比坐标（左半）。 */
  x: number;
  y: number;
  shape: number;
}

/** 预定义的孔组（左半坐标，y 取 0.18~0.78 范围）。人工挑选不重叠。 */
const HOLE_SETS: Hole[][] = [
  // 3 孔
  [
    { x: 0.28, y: 0.32, shape: 0 },
    { x: 0.18, y: 0.55, shape: 2 },
    { x: 0.36, y: 0.62, shape: 3 },
  ],
  [
    { x: 0.32, y: 0.26, shape: 1 },
    { x: 0.22, y: 0.5, shape: 0 },
    { x: 0.36, y: 0.68, shape: 2 },
  ],
  // 4 孔
  [
    { x: 0.26, y: 0.24, shape: 3 },
    { x: 0.36, y: 0.34, shape: 0 },
    { x: 0.2, y: 0.52, shape: 2 },
    { x: 0.34, y: 0.66, shape: 1 },
  ],
  // 5 孔
  [
    { x: 0.28, y: 0.2, shape: 0 },
    { x: 0.38, y: 0.32, shape: 3 },
    { x: 0.18, y: 0.42, shape: 2 },
    { x: 0.34, y: 0.56, shape: 1 },
    { x: 0.24, y: 0.72, shape: 4 },
  ],
];

function pickSet(diff: "easy" | "medium" | "hard"): Hole[] {
  if (diff === "easy") return sample(HOLE_SETS.filter((s) => s.length === 3));
  if (diff === "medium") return HOLE_SETS[2]!;
  return HOLE_SETS[3]!;
}

function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 4 : diff === "medium" ? 3 : 3;
}

export class PumpkinCarveGame extends BaseGame {
  constructor() {
    super("pumpkin-carve");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private rightHoles: Hole[] = [];
  private carved: boolean[] = [];
  private curShape = -1;
  private remaining = 0;

  protected mount(): void {
    this.roundTotal = roundTotal(this.difficulty);
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const left = pickSet(this.difficulty);
    this.rightHoles = left.map((h) => ({ x: 1 - h.x, y: h.y, shape: h.shape }));
    this.carved = new Array<boolean>(this.rightHoles.length).fill(false);
    this.remaining = this.rightHoles.length;
    this.curShape = -1;

    const wrap = document.createElement("div");
    wrap.className = "pkr-wrap";

    const task = document.createElement("div");
    task.className = "pkr-task";
    task.innerHTML = `照着左半边，在右半边刻一样的形状！（第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const pumpkin = document.createElement("div");
    pumpkin.className = "pkr-pumpkin";
    pumpkin.innerHTML = `<div class="pkr-stem">🌿</div><div class="pkr-mid"></div>`;

    // 左半已刻孔
    for (const h of left) {
      const s = SHAPES[h.shape]!;
      const d = document.createElement("div");
      d.className = "pkr-hole pkr-hole--done";
      d.style.left = `${h.x * 100}%`;
      d.style.top = `${h.y * 100}%`;
      d.style.setProperty("--pkr-color", s.color);
      d.textContent = s.glyph;
      pumpkin.appendChild(d);
    }
    // 右半空位
    this.rightHoles.forEach((h, i) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "pkr-slot";
      slot.dataset.idx = String(i);
      slot.style.left = `${h.x * 100}%`;
      slot.style.top = `${h.y * 100}%`;
      slot.textContent = "?";
      slot.addEventListener("click", () => this.carve(i));
      pumpkin.appendChild(slot);
    });
    wrap.appendChild(pumpkin);

    // 形状盘
    const palette = document.createElement("div");
    palette.className = "pkr-palette";
    const targets = Array.from(new Set(this.rightHoles.map((h) => h.shape)));
    const distract = shuffle(
      SHAPES.map((_, i) => i).filter((i) => !targets.includes(i)),
    ).slice(0, 1);
    for (const idx of shuffle([...targets, ...distract])) {
      const s = SHAPES[idx]!;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pkr-shape";
      b.dataset.shape = String(idx);
      b.style.setProperty("--pkr-color", s.color);
      b.textContent = s.glyph;
      b.addEventListener("click", () => this.pickShape(idx));
      palette.appendChild(b);
    }
    wrap.appendChild(palette);
    this.root.appendChild(wrap);
  }

  private pickShape(idx: number): void {
    this.curShape = idx;
    sfxPop();
    this.root
      .querySelectorAll<HTMLButtonElement>(".pkr-shape")
      .forEach((b) =>
        b.classList.toggle("pkr-shape--sel", b.dataset.shape === String(idx)),
      );
  }

  private carve(i: number): void {
    if (this.carved[i]) return;
    if (this.curShape < 0) return;
    const slot = this.rightHoles[i]!;
    if (this.curShape !== slot.shape) {
      const el = this.root.querySelector<HTMLElement>(
        `.pkr-slot[data-idx="${i}"]`,
      );
      el?.classList.remove("pkr-shake");
      void el?.offsetWidth;
      el?.classList.add("pkr-shake");
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    this.carved[i] = true;
    this.remaining -= 1;
    const el = this.root.querySelector<HTMLElement>(
      `.pkr-slot[data-idx="${i}"]`,
    );
    const s = SHAPES[slot.shape]!;
    if (el) {
      el.classList.add("pkr-slot--done");
      el.style.setProperty("--pkr-color", s.color);
      el.textContent = s.glyph;
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    }
    this.resetWrongStreak();
    if (this.remaining <= 0) {
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 800);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看左半边那个位置是什么形状，挑一样的刻下去～",
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
    if (document.getElementById("pkr-style")) return;
    const st = document.createElement("style");
    st.id = "pkr-style";
    st.textContent = PKR_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function PKR_CSS(theme: string): string {
  return `
.pkr-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(460px,100%);}
.pkr-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.pkr-pumpkin{position:relative;width:min(360px,92%);height:320px;background:radial-gradient(circle at 40% 35%,#ff9f43,#e8731a 70%,#b85410);border-radius:50% 50% 46% 46%/55% 55% 45% 45%;box-shadow:inset -16px -20px 40px rgba(120,40,0,.4),var(--shadow);overflow:hidden;}
.pkr-stem{position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:1.6rem;z-index:3;}
.pkr-mid{position:absolute;top:0;bottom:0;left:50%;width:2px;background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 6px,transparent 6px 12px);transform:translateX(-50%);z-index:2;}
.pkr-hole,.pkr-slot{position:absolute;width:40px;height:40px;transform:translate(-50%,-50%);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.3rem;color:#fff;}
.pkr-hole--done{background:#1a0f00;box-shadow:0 0 14px 3px var(--pkr-color),inset 0 0 8px rgba(0,0,0,.6);text-shadow:0 0 8px var(--pkr-color);}
.pkr-slot{background:rgba(255,255,255,.18);border:2px dashed rgba(255,255,255,.7);font-size:1rem;color:rgba(255,255,255,.85);cursor:pointer;padding:0;transition:transform .12s;}
.pkr-slot:hover{transform:translate(-50%,-50%) scale(1.1);}
.pkr-slot--done{background:#1a0f00;border:2px solid transparent;box-shadow:0 0 14px 3px var(--pkr-color),inset 0 0 8px rgba(0,0,0,.6);text-shadow:0 0 8px var(--pkr-color);font-size:1.3rem;pointer-events:none;animation:pkr-pop .3s ease;}
@keyframes pkr-pop{0%{transform:translate(-50%,-50%) scale(0)}70%{transform:translate(-50%,-50%) scale(1.3)}100%{transform:translate(-50%,-50%) scale(1)}}
.pkr-shake{animation:pkr-shake .4s ease;}
@keyframes pkr-shake{0%,100%{transform:translate(-50%,-50%) rotate(0)}25%{transform:translate(-50%,-50%) rotate(-12deg)}75%{transform:translate(-50%,-50%) rotate(12deg)}}
.pkr-palette{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:14px;background:rgba(255,255,255,.65);border-radius:20px;box-shadow:var(--shadow);}
.pkr-shape{width:54px;height:54px;border-radius:14px;border:none;background:#fff;color:var(--pkr-color);box-shadow:var(--shadow);font-size:1.8rem;font-weight:900;cursor:pointer;transition:transform .12s;display:flex;align-items:center;justify-content:center;}
.pkr-shape:active{transform:scale(.88);}
.pkr-shape--sel{transform:translateY(-5px) scale(1.14);box-shadow:0 8px 12px rgba(0,0,0,.25),0 0 0 3px #fff,0 0 0 6px ${theme};}
`;
}

export function create(): PumpkinCarveGame {
  return new PumpkinCarveGame();
}
