/* 珊瑚礁 Coral Reef —— 几块珊瑚按颜色乱序排在海底，孩子按从浅到深的色调
   顺序依次点击。独特点：同一色相不同明度的渐变珊瑚，训练色阶排序。
   视觉：海底背景 + 珊瑚 emoji + 颜色填充。难度=珊瑚数量。
   通关=排对目标轮数。前缀 crr-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

/** 每个色系：从浅到深 3 档明度。孩子要按 light→deep 顺序点击。 */
const PALETTES: { hue: number; base: string }[] = [
  { hue: 340, base: "粉红" },
  { hue: 200, base: "蓝青" },
  { hue: 30, base: "橙黄" },
  { hue: 140, base: "绿" },
  { hue: 280, base: "紫" },
];

/** HSL 转字符串，l 控制明度 */
function hsl(h: number, l: number): string {
  return `hsl(${h}, 70%, ${l}%)`;
}

interface Coral {
  /** 明度排序键：越大越深 */
  level: number;
  color: string;
  el: HTMLButtonElement;
}

export class CoralReefGame extends BaseGame {
  constructor() {
    super("coral-reef");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private corals: Coral[] = [];
  private expect = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.corals = [];

    const n = this.count();
    // 选一个色系，生成 n 个明度档（保证可排序且唯一）
    const pal = sample(PALETTES);
    const h = pal.hue;
    // 明度从高(浅)到低(深)，均匀分布
    const levels: number[] = [];
    for (let i = 0; i < n; i++) {
      // 浅(75%)到深(35%)
      const l = 75 - (i * 40) / Math.max(1, n - 1);
      levels.push(Math.round(l));
    }
    // level 排序键：浅的 level 大 → 但孩子要按从浅到深，浅在前
    // 用 index 作为正确点击顺序（0=最浅）
    const ordered = levels.map((l, idx) => ({ l, idx }));

    const wrap = document.createElement("div");
    wrap.className = "crr-wrap";
    const task = document.createElement("div");
    task.className = "crr-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 按 <b>从浅到深</b> 的顺序点珊瑚！`;
    wrap.appendChild(task);

    const reef = document.createElement("div");
    reef.className = "crr-reef";

    // 已点到的序号
    this.expect = 0;

    // 打乱位置展示
    shuffle(ordered).forEach((o) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "crr-coral";
      el.style.setProperty("--coral-color", hsl(h, o.l));
      el.innerHTML = `<span class="crr-coral__emoji">🪸</span><span class="crr-coral__order"></span>`;
      el.addEventListener("click", () => this.pick(o.idx, el));
      reef.appendChild(el);
      this.corals.push({ level: o.idx, color: hsl(h, o.l), el });
    });

    wrap.appendChild(reef);
    this.root.appendChild(wrap);
  }

  private pick(idx: number, el: HTMLButtonElement): void {
    if (this.answered) return;
    if (idx === this.expect) {
      // 正确：标记顺序
      this.expect += 1;
      el.classList.add("crr-coral--done");
      const order = el.querySelector(".crr-coral__order") as HTMLElement | null;
      if (order) order.textContent = String(this.expect);
      const r = el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      if (this.expect >= this.corals.length) {
        this.answered = true;
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 700);
      }
    } else {
      el.classList.add("crr-coral--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => el.classList.remove("crr-coral--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "从最浅的颜色开始排哦～",
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
    if (document.getElementById("crr-style")) return;
    const st = document.createElement("style");
    st.id = "crr-style";
    st.textContent = CRR_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function CRR_CSS(theme: string): string {
  return `
.crr-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(540px,100%);}
.crr-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.crr-reef{position:relative;width:100%;max-width:500px;min-height:300px;background:linear-gradient(180deg,#5fb8e6,#2a6fb0 55%,#0e3a66);border-radius:24px;box-shadow:var(--shadow-lg),inset 0 0 40px rgba(0,0,0,.25);display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:14px;padding:24px 16px;overflow:hidden;}
.crr-reef::before{content:"🫧 🫧 🫧";position:absolute;top:10px;left:14px;font-size:1rem;opacity:.5;letter-spacing:8px;}
.crr-coral{position:relative;width:84px;height:104px;border:none;background:transparent;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;touch-action:manipulation;animation:crr-sway 3s ease-in-out infinite;}
.crr-coral__emoji{font-size:3rem;filter:drop-shadow(0 0 10px var(--coral-color)) drop-shadow(0 4px 4px rgba(0,0,0,.3));transition:transform .2s ease;}
.crr-coral__order{position:absolute;top:4px;left:50%;transform:translateX(-50%);min-width:26px;height:26px;border-radius:50%;background:${theme};color:#fff;font-size:.9rem;font-weight:800;display:flex;align-items:center;justify-content:center;opacity:0;transform:translateX(-50%) scale(0);}
.crr-coral:hover .crr-coral__emoji{transform:scale(1.12) translateY(-3px);}
.crr-coral--done .crr-coral__emoji{filter:drop-shadow(0 0 16px var(--coral-color)) drop-shadow(0 4px 4px rgba(0,0,0,.3));}
.crr-coral--done .crr-coral__order{opacity:1;transform:translateX(-50%) scale(1);}
.crr-coral--wrong .crr-coral__emoji{animation:crr-shake .4s ease;}
@keyframes crr-sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
@keyframes crr-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
@media (max-width:380px){.crr-coral{width:70px;height:90px;}.crr-coral__emoji{font-size:2.4rem;}}
`;
}

export function create(): CoralReefGame {
  return new CoralReefGame();
}
