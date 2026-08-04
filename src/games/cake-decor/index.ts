/* 蛋糕装饰 Cake Decor —— 蛋糕左半边已装饰（草莓/蜡烛/花），
   孩子在右半边的对称位置放上对应的装饰。
   独特点：左右镜像对称认知（区别于蝴蝶翅膀的"颜色点"，这里要匹配装饰种类）。
   视觉：蛋糕（分层）+ 左半固定装饰 + 右半空位 + 装饰盘。
   难度=装饰数。通关=装饰完目标轮数。前缀 ckd-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Deco {
  key: string;
  emoji: string;
  name: string;
  color: string;
}

const DECOS: Deco[] = [
  { key: "strawberry", emoji: "🍓", name: "草莓", color: "#ff6b9d" },
  { key: "candle", emoji: "🕯️", name: "蜡烛", color: "#ffd93d" },
  { key: "flower", emoji: "🌸", name: "花", color: "#ff9ff3" },
  { key: "cherry", emoji: "🍒", name: "樱桃", color: "#ff6348" },
  { key: "star", emoji: "⭐", name: "星星", color: "#feca57" },
  { key: "heart", emoji: "💖", name: "爱心", color: "#ee5a6f" },
  { key: "blueberry", emoji: "🫐", name: "蓝莓", color: "#5f27cd" },
];

interface Slot {
  /** 装饰（种类固定） */
  deco: Deco;
  /** 左半百分比坐标（中心轴 50%）。右半 = 镜像 (100 - lx) */
  lx: number;
  ly: number;
  filled: boolean;
}

/** 预设位置组：lx 是左半内 x（10~46），ly 是 y。每组互不重叠。 */
const SLOT_SETS: { lx: number; ly: number }[][] = [
  // 2 点
  [
    { lx: 22, ly: 30 },
    { lx: 30, ly: 70 },
  ],
  // 3 点
  [
    { lx: 18, ly: 28 },
    { lx: 30, ly: 50 },
    { lx: 22, ly: 72 },
  ],
  [
    { lx: 24, ly: 24 },
    { lx: 16, ly: 55 },
    { lx: 28, ly: 76 },
  ],
  // 4 点
  [
    { lx: 16, ly: 22 },
    { lx: 32, ly: 28 },
    { lx: 18, ly: 60 },
    { lx: 32, ly: 72 },
  ],
  // 5 点
  [
    { lx: 14, ly: 20 },
    { lx: 30, ly: 24 },
    { lx: 20, ly: 48 },
    { lx: 32, ly: 62 },
    { lx: 16, ly: 78 },
  ],
];

export class CakeDecorGame extends BaseGame {
  constructor() {
    super("cake-decor");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private slots: Slot[] = [];
  private curDeco: Deco | null = null;
  private remaining = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private count(): number {
    return this.difficulty === "easy"
      ? 2
      : this.difficulty === "medium"
        ? 3
        : 5;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.curDeco = null;

    const n = this.count();
    const decos = shuffle([...DECOS]).slice(0, n);
    const candidates = SLOT_SETS.filter((s) => s.length === n);
    const poses = sample(candidates.length > 0 ? candidates : SLOT_SETS)!;
    const shuffledDecos = shuffle(decos);
    this.slots = poses.map((p, i) => ({
      deco: shuffledDecos[i]!,
      lx: p.lx,
      ly: p.ly,
      filled: false,
    }));
    this.remaining = this.slots.length;

    const wrap = document.createElement("div");
    wrap.className = "ckd-wrap";

    const task = document.createElement("div");
    task.className = "ckd-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 照左边，在右边对称位置放上一样的装饰 🎂`;
    wrap.appendChild(task);

    // 蛋糕
    const cake = document.createElement("div");
    cake.className = "ckd-cake";

    // 左半（固定装饰）
    const left = document.createElement("div");
    left.className = "ckd-half ckd-half--left";
    for (const s of this.slots) {
      const d = document.createElement("span");
      d.className = "ckd-deco ckd-deco--fixed";
      d.textContent = s.deco.emoji;
      d.style.left = `${s.lx}%`;
      d.style.top = `${s.ly}%`;
      left.appendChild(d);
    }
    cake.appendChild(left);

    // 中轴
    const axis = document.createElement("div");
    axis.className = "ckd-axis";
    axis.innerHTML = `<span class="ckd-axis__label">↔</span>`;
    cake.appendChild(axis);

    // 右半（空位）
    const right = document.createElement("div");
    right.className = "ckd-half ckd-half--right";
    right.id = "ckd-right";
    this.slots.forEach((s, i) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "ckd-slot";
      slot.dataset.idx = String(i);
      // 镜像 x
      slot.style.left = `${100 - s.lx}%`;
      slot.style.top = `${s.ly}%`;
      slot.style.setProperty("--ckd-c", s.deco.color);
      slot.addEventListener("click", () => this.place(i));
      right.appendChild(slot);
    });
    cake.appendChild(right);

    wrap.appendChild(cake);

    // 装饰盘：所有出现的装饰种类（+少量干扰）
    const palette = document.createElement("div");
    palette.className = "ckd-palette";
    const targets = Array.from(
      new Map(this.slots.map((s) => [s.deco.key, s.deco])).values(),
    );
    const distractCount =
      this.difficulty === "easy" ? 1 : this.difficulty === "medium" ? 2 : 2;
    const distract = shuffle(
      DECOS.filter((d) => !targets.some((t) => t.key === d.key)),
    ).slice(0, distractCount);
    const items = shuffle([...targets, ...distract]);
    for (const d of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ckd-pick";
      b.dataset.key = d.key;
      b.style.setProperty("--ckd-c", d.color);
      b.innerHTML = `<span class="ckd-pick__emoji">${d.emoji}</span><span class="ckd-pick__name">${d.name}</span>`;
      b.addEventListener("click", () => this.selectDeco(d));
      palette.appendChild(b);
    }
    wrap.appendChild(palette);

    this.root.appendChild(wrap);
  }

  private selectDeco(d: Deco): void {
    this.curDeco = d;
    sfxPop();
    this.root.querySelectorAll<HTMLButtonElement>(".ckd-pick").forEach((p) => {
      p.classList.toggle("ckd-pick--sel", p.dataset.key === d.key);
    });
  }

  private place(i: number): void {
    const slot = this.slots[i]!;
    if (slot.filled) return;
    if (!this.curDeco) return;
    if (this.curDeco.key !== slot.deco.key) {
      // 种类不对
      const el = this.root.querySelector<HTMLElement>(
        `.ckd-slot[data-idx="${i}"]`,
      );
      el?.classList.remove("ckd-shake");
      void el?.offsetWidth;
      el?.classList.add("ckd-shake");
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    // 放对
    slot.filled = true;
    this.remaining -= 1;
    const el = this.root.querySelector<HTMLElement>(
      `.ckd-slot[data-idx="${i}"]`,
    );
    if (el) {
      el.classList.add("ckd-slot--filled");
      const d = document.createElement("span");
      d.className = "ckd-deco ckd-deco--drop";
      d.textContent = slot.deco.emoji;
      el.appendChild(d);
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
      }, 850);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🎂",
      variant: "rest",
      body: "看看左边那个位置是什么装饰，在右边对称的位置放一样的～",
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
    if (document.getElementById("ckd-style")) return;
    const st = document.createElement("style");
    st.id = "ckd-style";
    st.textContent = CKD_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function CKD_CSS(theme: string): string {
  return `
.ckd-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.ckd-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ckd-cake{position:relative;width:min(420px,94%);height:300px;background:linear-gradient(180deg,#fff0f5 0%,#ffe4ef 50%,#ffd0e0 100%);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;}
.ckd-half{position:absolute;top:0;bottom:0;width:50%;}
.ckd-half--left{left:0;background:linear-gradient(135deg,rgba(255,255,255,.5),rgba(255,200,220,.3));}
.ckd-half--right{right:0;background:linear-gradient(225deg,rgba(255,255,255,.5),rgba(255,220,230,.3));}
.ckd-axis{position:absolute;left:50%;top:0;bottom:0;width:2px;background:repeating-linear-gradient(180deg,${theme}88,${theme}88 6px,transparent 6px,transparent 12px);transform:translateX(-50%);}
.ckd-axis__label{position:absolute;top:8px;left:50%;transform:translateX(-50%);color:${theme};font-weight:900;background:#fff;padding:1px 6px;border-radius:999px;font-size:.8rem;}
.ckd-deco{position:absolute;font-size:1.8rem;line-height:1;transform:translate(-50%,-50%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));pointer-events:none;z-index:2;}
.ckd-deco--fixed{opacity:1;}
.ckd-deco--drop{animation:ckd-pop .3s ease;}
@keyframes ckd-pop{0%{transform:translate(-50%,-50%) scale(0)}70%{transform:translate(-50%,-50%) scale(1.3)}100%{transform:translate(-50%,-50%) scale(1)}}
.ckd-slot{position:absolute;width:40px;height:40px;border-radius:50%;transform:translate(-50%,-50%);border:2.5px dashed var(--ckd-c,#888);background:rgba(255,255,255,.6);cursor:pointer;padding:0;transition:transform .12s;z-index:3;}
.ckd-slot:hover{transform:translate(-50%,-50%) scale(1.1);}
.ckd-slot--filled{border:none;background:transparent;pointer-events:none;}
.ckd-shake{animation:ckd-shake .4s ease;}
@keyframes ckd-shake{0%,100%{transform:translate(-50%,-50%) rotate(0)}25%{transform:translate(-50%,-50%) rotate(-12deg)}75%{transform:translate(-50%,-50%) rotate(12deg)}}
.ckd-palette{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:460px;}
.ckd-pick{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:72px;padding:8px 6px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--ckd-c,#eee) 28%,#fff));box-shadow:0 4px 0 rgba(0,0,0,.1),0 6px 10px rgba(0,0,0,.12);cursor:pointer;transition:transform .12s,box-shadow .12s;}
.ckd-pick:active{transform:translateY(3px);}
.ckd-pick--sel{transform:translateY(-5px) scale(1.1);box-shadow:0 8px 14px rgba(0,0,0,.25),0 0 0 3px #fff,0 0 0 6px var(--ckd-c);}
.ckd-pick__emoji{font-size:1.7rem;}
.ckd-pick__name{font-size:.76rem;font-weight:800;color:#555;}
@media (max-width:380px){.ckd-cake{height:260px;}.ckd-deco{font-size:1.5rem;}.ckd-slot{width:34px;height:34px;}.ckd-pick{min-width:62px;}}
`;
}

export function create(): CakeDecorGame {
  return new CakeDecorGame();
}
