/* 蝴蝶翅膀 Butterfly Wing —— 左翅膀有彩色花纹，孩子在右翅膀对称位置放同色点。
   独特点：左右镜像对称认知。蝴蝶身体居中，左翅点已固定，右翅空位待填。
   玩法：下方颜色盘选一个颜色，再点右翅的空位放下；颜色对才放得上。
   解保证：右翅每个空位都有一个唯一的目标颜色，颜色盘提供这些颜色（+少量干扰）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

const COLORS = [
  "#ff6b9d",
  "#4d96ff",
  "#6bcf7f",
  "#ffd93d",
  "#a55eea",
  "#ff9f43",
];

interface Slot {
  /** 在翅膀内的百分比坐标 (0~1)。 */
  x: number;
  y: number;
  color: string;
}

/** 预定义的对称点组（左/右成对），数值是翅膀内的百分比坐标。
    右翅 x 取镜像（1-x）。这些组都经过人工挑选，保证不重叠且在翅膀内。 */
const SLOT_SETS: { lx: number; ly: number; color: string }[][] = [
  // 3 点
  [
    { lx: 0.32, ly: 0.28, color: "#ff6b9d" },
    { lx: 0.62, ly: 0.2, color: "#4d96ff" },
    { lx: 0.45, ly: 0.6, color: "#ffd93d" },
  ],
  [
    { lx: 0.3, ly: 0.35, color: "#6bcf7f" },
    { lx: 0.6, ly: 0.28, color: "#a55eea" },
    { lx: 0.5, ly: 0.68, color: "#ff9f43" },
  ],
  // 4 点
  [
    { lx: 0.28, ly: 0.22, color: "#ff6b9d" },
    { lx: 0.62, ly: 0.2, color: "#4d96ff" },
    { lx: 0.3, ly: 0.58, color: "#6bcf7f" },
    { lx: 0.62, ly: 0.62, color: "#ffd93d" },
  ],
  [
    { lx: 0.34, ly: 0.28, color: "#a55eea" },
    { lx: 0.62, ly: 0.34, color: "#ff9f43" },
    { lx: 0.3, ly: 0.66, color: "#ff6b9d" },
    { lx: 0.58, ly: 0.7, color: "#4d96ff" },
  ],
  // 5 点
  [
    { lx: 0.26, ly: 0.22, color: "#ff6b9d" },
    { lx: 0.58, ly: 0.18, color: "#4d96ff" },
    { lx: 0.42, ly: 0.45, color: "#6bcf7f" },
    { lx: 0.26, ly: 0.66, color: "#ffd93d" },
    { lx: 0.62, ly: 0.66, color: "#a55eea" },
  ],
];

function pickSet(diff: "easy" | "medium" | "hard"): (typeof SLOT_SETS)[number] {
  if (diff === "easy") {
    // 3 点
    const three = SLOT_SETS.filter((s) => s.length === 3);
    return sample(three);
  }
  if (diff === "medium") {
    // 4 点
    const four = SLOT_SETS.filter((s) => s.length === 4);
    return sample(four);
  }
  // hard：5 点
  return SLOT_SETS[4]!;
}

function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 4 : diff === "medium" ? 3 : 3;
}

export class ButterflyWingGame extends BaseGame {
  constructor() {
    super("butterfly-wing");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 右翅空位（待填），含目标颜色。 */
  private rightSlots: Slot[] = [];
  /** 已填颜色索引（-1 未填）。 */
  private filled: number[] = [];
  private curColor = "";
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
    const set = pickSet(this.difficulty);
    // 左翅固定显示这些点；右翅镜像位置为空位，目标颜色 = 该点颜色
    const leftSlots: Slot[] = set.map((s) => ({
      x: s.lx,
      y: s.ly,
      color: s.color,
    }));
    this.rightSlots = set.map((s) => ({
      x: 1 - s.lx,
      y: s.ly,
      color: s.color,
    }));
    this.filled = new Array<number>(this.rightSlots.length).fill(-1);
    this.remaining = this.rightSlots.length;
    this.curColor = "";

    const wrap = document.createElement("div");
    wrap.className = "bw2-wrap";

    const task = document.createElement("div");
    task.className = "bw2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 照着左翅膀，把右翅膀补一样 🦋`;
    wrap.appendChild(task);

    // 蝴蝶
    const butterfly = document.createElement("div");
    butterfly.className = "bw2-butterfly";

    // 左翅（固定点）
    const left = document.createElement("div");
    left.className = "bw2-wing bw2-wing--left";
    for (const s of leftSlots) {
      const d = document.createElement("div");
      d.className = "bw2-dot bw2-dot--fixed";
      d.style.left = `${s.x * 100}%`;
      d.style.top = `${s.y * 100}%`;
      d.style.setProperty("--bw2-color", s.color);
      left.appendChild(d);
    }
    butterfly.appendChild(left);

    // 身体
    const body = document.createElement("div");
    body.className = "bw2-body";
    body.innerHTML = `<div class="bw2-head">🦋</div><div class="bw2-line"></div>`;
    butterfly.appendChild(body);

    // 右翅（可填空位）
    const right = document.createElement("div");
    right.className = "bw2-wing bw2-wing--right";
    right.id = "bw2-right";
    this.rightSlots.forEach((s, i) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "bw2-slot";
      slot.dataset.idx = String(i);
      slot.style.left = `${s.x * 100}%`;
      slot.style.top = `${s.y * 100}%`;
      slot.addEventListener("click", () => this.fillSlot(i));
      right.appendChild(slot);
    });
    butterfly.appendChild(right);

    wrap.appendChild(butterfly);

    // 颜色盘：包含目标颜色 + 干扰
    const palette = document.createElement("div");
    palette.className = "bw2-palette";
    const targetColors = Array.from(
      new Set(this.rightSlots.map((s) => s.color)),
    );
    const distractCount =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    const distractors = shuffle(COLORS.filter((c) => !targetColors.includes(c)))
      .slice(0, distractCount)
      .map((c) => ({ c, target: false }));
    const items = [
      ...targetColors.map((c) => ({ c, target: true })),
      ...distractors,
    ];
    for (const it of shuffle(items)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bw2-paint";
      b.dataset.color = it.c;
      b.style.setProperty("--bw2-color", it.c);
      b.addEventListener("click", () => this.pickColor(it.c));
      palette.appendChild(b);
    }
    wrap.appendChild(palette);

    this.root.appendChild(wrap);
  }

  private pickColor(c: string): void {
    this.curColor = c;
    sfxPop();
    this.root.querySelectorAll<HTMLButtonElement>(".bw2-paint").forEach((p) => {
      p.classList.toggle("bw2-paint--sel", p.dataset.color === c);
    });
  }

  private fillSlot(i: number): void {
    if (this.filled[i] !== -1) return; // 已填
    if (!this.curColor) return;
    const slot = this.rightSlots[i]!;
    if (this.curColor !== slot.color) {
      // 颜色不对：温柔提示
      const el = this.root.querySelector<HTMLElement>(
        `.bw2-slot[data-idx="${i}"]`,
      );
      el?.classList.remove("bw2-shake");
      void el?.offsetWidth;
      el?.classList.add("bw2-shake");
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    // 放对
    this.filled[i] = 1;
    this.remaining -= 1;
    const el = this.root.querySelector<HTMLElement>(
      `.bw2-slot[data-idx="${i}"]`,
    );
    if (el) {
      el.classList.add("bw2-slot--filled");
      el.style.setProperty("--bw2-color", slot.color);
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    }
    this.resetWrongStreak();
    if (this.remaining <= 0) {
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 700);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看左翅膀那个位置是什么颜色，挑一样的吧～",
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
    if (document.getElementById("bw2-style")) return;
    const st = document.createElement("style");
    st.id = "bw2-style";
    st.textContent = BW2_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function BW2_CSS(theme: string): string {
  return `
.bw2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(460px,100%);}
.bw2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.bw2-butterfly{position:relative;width:min(380px,92%);height:280px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 60%,#fff8,#fef0ff 70%);border-radius:24px;box-shadow:var(--shadow);}
.bw2-wing{position:relative;width:44%;height:88%;background:linear-gradient(160deg,#fff,#fce7ff 60%,#f3d4ff);box-shadow:inset 0 0 18px rgba(165,94,234,.18),var(--shadow);}
.bw2-wing--left{border-radius:100% 30% 100% 30%/60% 30% 60% 30%;}
.bw2-wing--right{border-radius:30% 100% 30% 100%/30% 60% 30% 60%;}
.bw2-body{display:flex;flex-direction:column;align-items:center;justify-content:center;width:6%;}
.bw2-head{font-size:1.4rem;filter:hue-rotate(0deg);}
.bw2-line{width:6px;height:90px;background:linear-gradient(#5a3d6e,#3a2747);border-radius:3px;margin-top:-4px;}
.bw2-dot{position:absolute;width:30px;height:30px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle at 35% 30%,#fff8,var(--bw2-color));box-shadow:0 0 10px var(--bw2-color),inset 0 -3px 4px rgba(0,0,0,.2);pointer-events:none;}
.bw2-slot{position:absolute;width:40px;height:40px;border-radius:50%;transform:translate(-50%,-50%);border:2px dashed ${theme}aa;background:rgba(255,255,255,.4);cursor:pointer;padding:0;transition:transform .12s;}
.bw2-slot:hover{transform:translate(-50%,-50%) scale(1.1);}
.bw2-slot--filled{border:2px solid #fff;background:radial-gradient(circle at 35% 30%,#fff8,var(--bw2-color));box-shadow:0 0 12px var(--bw2-color),inset 0 -3px 4px rgba(0,0,0,.2);pointer-events:none;animation:bw2-pop .25s ease;}
@keyframes bw2-pop{0%{transform:translate(-50%,-50%) scale(0)}70%{transform:translate(-50%,-50%) scale(1.25)}100%{transform:translate(-50%,-50%) scale(1)}}
.bw2-shake{animation:bw2-shake .4s ease;}
@keyframes bw2-shake{0%,100%{transform:translate(-50%,-50%) rotate(0)}25%{transform:translate(-50%,-50%) rotate(-12deg)}75%{transform:translate(-50%,-50%) rotate(12deg)}}
.bw2-palette{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:20px;box-shadow:var(--shadow);}
.bw2-paint{width:48px;height:48px;border-radius:50%;border:none;background:radial-gradient(circle at 35% 30%,#fff8,var(--bw2-color));box-shadow:inset 0 -4px 6px rgba(0,0,0,.2),0 3px 6px rgba(0,0,0,.18);cursor:pointer;transition:transform .12s,box-shadow .12s;}
.bw2-paint:active{transform:scale(.88);}
.bw2-paint--sel{transform:translateY(-5px) scale(1.12);box-shadow:inset 0 -4px 6px rgba(0,0,0,.2),0 8px 12px rgba(0,0,0,.25),0 0 0 3px #fff,0 0 0 6px ${theme};}
@media (max-width:380px){.bw2-butterfly{height:240px;}.bw2-dot{width:26px;height:26px;}.bw2-slot{width:34px;height:34px;}.bw2-paint{width:42px;height:42px;}}
`;
}

export function create(): ButterflyWingGame {
  return new ButterflyWingGame();
}
