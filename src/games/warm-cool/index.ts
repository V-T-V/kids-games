/* 暖色冷色 Warm Cool —— 把颜色块拖到"暖色"或"冷色"两个篮子里。
   艺术启蒙：色彩情感分类。独特点：暖色（红橙黄）vs 冷色（蓝绿紫青），
   点击颜色块再点篮子即可分类（兼容触屏，不依赖复杂拖拽）。
   数据保证每轮两个篮子都至少有 1 个，整体可解。前缀 wcl-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Swatch {
  hex: string;
  name: string;
  warm: boolean;
}

const WARM: Swatch[] = [
  { hex: "#ff5252", name: "红", warm: true },
  { hex: "#ff8a3d", name: "橙", warm: true },
  { hex: "#ffd93d", name: "黄", warm: true },
  { hex: "#ff6b9d", name: "粉红", warm: true },
  { hex: "#e84545", name: "深红", warm: true },
];
const COOL: Swatch[] = [
  { hex: "#4d96ff", name: "蓝", warm: false },
  { hex: "#6bcf7f", name: "绿", warm: false },
  { hex: "#a55eea", name: "紫", warm: false },
  { hex: "#22d3ee", name: "青", warm: false },
  { hex: "#0099aa", name: "深蓝", warm: false },
];

export class WarmCoolGame extends BaseGame {
  constructor() {
    super("warm-cool");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private toSort: Swatch[] = [];
  private selected: Swatch | null = null;
  private locked = false;

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
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.locked = false;
    this.selected = null;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 保证暖冷都有
    const n = this.count();
    const half = Math.floor(n / 2);
    const warm = shuffle(WARM).slice(0, half);
    const cool = shuffle(COOL).slice(0, n - half);
    this.toSort = shuffle([...warm, ...cool]);

    const wrap = document.createElement("div");
    wrap.className = "wcl-wrap";

    const task = document.createElement("div");
    task.className = "wcl-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 先点一个颜色，再点<b>暖色</b>或<b>冷色</b>篮子`;
    wrap.appendChild(task);

    // 待分颜色池
    const pool = document.createElement("div");
    pool.className = "wcl-pool";
    pool.id = "wcl-pool";
    this.toSort.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wcl-swatch";
      b.style.background = s.hex;
      b.dataset.name = s.name;
      b.addEventListener("click", () => this.tapSwatch(s, b));
      pool.appendChild(b);
    });
    wrap.appendChild(pool);

    // 两个篮子
    const baskets = document.createElement("div");
    baskets.className = "wcl-baskets";
    baskets.appendChild(this.makeBasket(true));
    baskets.appendChild(this.makeBasket(false));
    wrap.appendChild(baskets);

    this.root.appendChild(wrap);
  }

  private tapSwatch(s: Swatch, btn: HTMLButtonElement): void {
    if (this.locked) return;
    this.selected = s;
    const pool = this.root.querySelector("#wcl-pool");
    pool
      ?.querySelectorAll(".wcl-swatch")
      .forEach((b) => b.classList.remove("wcl-swatch--sel"));
    btn.classList.add("wcl-swatch--sel");
    sfxPop();
  }

  private makeBasket(warm: boolean): HTMLElement {
    const b = document.createElement("div");
    b.className = `wcl-basket ${warm ? "wcl-basket--warm" : "wcl-basket--cool"}`;
    b.innerHTML = `<div class="wcl-basket__title">${warm ? "🔥 暖色" : "❄️ 冷色"}</div><div class="wcl-basket__items" id="wcl-items-${warm ? "warm" : "cool"}"></div>`;
    b.addEventListener("click", () => this.dropTo(warm));
    return b;
  }

  private dropTo(warm: boolean): void {
    if (this.locked || !this.selected) return;
    const s = this.selected;
    if (s.warm === warm) {
      // 正确：移入篮子
      const items = this.root.querySelector<HTMLElement>(
        `#wcl-items-${warm ? "warm" : "cool"}`,
      );
      if (items) {
        const dot = document.createElement("div");
        dot.className = "wcl-basket__dot";
        dot.style.background = s.hex;
        items.appendChild(dot);
      }
      // 从池子里移除
      const pool = this.root.querySelector("#wcl-pool");
      pool?.querySelectorAll<HTMLButtonElement>(".wcl-swatch").forEach((b) => {
        if (b.dataset.name === s.name) b.remove();
      });
      this.selected = null;
      const r = items?.getBoundingClientRect();
      if (r) this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      sfxPop();
      // 检查是否分完
      const remaining = pool?.querySelectorAll(".wcl-swatch").length ?? 0;
      if (remaining === 0) {
        this.locked = true;
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 900);
      }
    } else {
      // 错了：摇晃
      const basket = this.root.querySelector(
        `#wcl-items-${warm ? "warm" : "cool"}`,
      );
      const parent = basket?.parentElement;
      parent?.classList.add("wcl-basket--wrong");
      const paused = this.onWrong();
      this.trackTimeout(
        () => parent?.classList.remove("wcl-basket--wrong"),
        400,
      );
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🎨",
      variant: "rest",
      body: "红、橙、黄像太阳和火，是暖色；蓝、绿、紫像水和树，是冷色～",
      primary: { text: "继续", icon: "🖌️", onClick: () => ov.destroy() },
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
    if (document.getElementById("wcl-style")) return;
    const st = document.createElement("style");
    st.id = "wcl-style";
    st.textContent = WCL_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function WCL_CSS(theme: string): string {
  return `
.wcl-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(460px,100%);}
.wcl-task{font-size:1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.wcl-task b{color:${theme};}
.wcl-pool{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;background:#fff;padding:16px;border-radius:20px;box-shadow:var(--shadow);min-height:70px;width:100%;box-sizing:border-box;}
.wcl-swatch{width:54px;height:54px;border-radius:14px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;border:3px solid transparent;}
.wcl-swatch:active{transform:scale(.9);}
.wcl-swatch--sel{border-color:#222;transform:scale(1.12);}
.wcl-baskets{display:flex;gap:18px;width:100%;justify-content:center;}
.wcl-basket{flex:1;max-width:200px;min-height:120px;border-radius:22px;padding:12px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;display:flex;flex-direction:column;gap:8px;}
.wcl-basket:active{transform:scale(.97);}
.wcl-basket--warm{background:linear-gradient(180deg,#fff0e6,#ffd9b3);}
.wcl-basket--cool{background:linear-gradient(180deg,#e6f3ff,#bfe0ff);}
.wcl-basket__title{font-size:1.1rem;font-weight:900;text-align:center;}
.wcl-basket__items{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-content:flex-start;flex:1;}
.wcl-basket__dot{width:36px;height:36px;border-radius:10px;box-shadow:0 2px 4px rgba(0,0,0,.2);animation:wcl-in .3s ease;}
@keyframes wcl-in{0%{transform:scale(.4)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
.wcl-basket--wrong{animation:wcl-shake .4s ease;}
@keyframes wcl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): WarmCoolGame {
  return new WarmCoolGame();
}
