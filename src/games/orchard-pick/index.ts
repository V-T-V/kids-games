/* 果园采摘 Orchard Pick —— 树上的水果成熟度不同（青→半红→全红），
   按"从生到熟"的顺序一个个摘下来。
   独特点：成熟度排序认知。水果颜色梯度直观表示生熟。
   玩法：树上挂着几种颜色的水果（每个对应一个成熟度 rank），
         孩子按从最生（青）到最熟（红）的顺序点击采摘。
   解保证：水果的 rank 集合 = 0..n-1，正确顺序唯一确定，逐个点对即可。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Fruit {
  rank: number;
  /** 颜色（按 rank 取梯度） */
  color: string;
  el: HTMLButtonElement;
  picked: boolean;
  /** 在树上的百分比位置 */
  x: number;
  y: number;
}

/** 成熟度梯度：青 → 黄青 → 半红 → 红橙 → 全红。 */
const RIPENESS = ["#9acd32", "#c0d84a", "#ff8a4c", "#ff5a36", "#e02020"];

function fruitCount(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 3 : diff === "medium" ? 4 : 5;
}
function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 2 : diff === "medium" ? 3 : 3;
}

export class OrchardPickGame extends BaseGame {
  constructor() {
    super("orchard-pick");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private fruits: Fruit[] = [];
  private nextRank = 0;

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
    this.nextRank = 0;
    const n = fruitCount(this.difficulty);

    // 生成 n 个水果，rank 为 0..n-1 的一个排列（颜色取自梯度）
    const ranks = shuffle(Array.from({ length: n }, (_, i) => i));
    this.fruits = [];

    const wrap = document.createElement("div");
    wrap.className = "op-wrap";

    const task = document.createElement("div");
    task.className = "op-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 按"<b>从生到熟</b>"的顺序摘苹果 🍎`;
    wrap.appendChild(task);

    // 树
    const tree = document.createElement("div");
    tree.className = "op-tree";
    tree.id = "op-tree";
    // 树冠（水果挂在树冠内随机位置）
    ranks.forEach((rank) => {
      const color = RIPENESS[Math.min(rank, RIPENESS.length - 1)]!;
      const x = 12 + Math.random() * 76; // 12%~88%
      const y = 12 + Math.random() * 60; // 12%~72%
      const f = document.createElement("button");
      f.type = "button";
      f.className = "op-fruit";
      f.dataset.rank = String(rank);
      f.style.left = `${x}%`;
      f.style.top = `${y}%`;
      f.style.setProperty("--op-color", color);
      f.addEventListener("click", () => this.pick(rank, f));
      tree.appendChild(f);
      this.fruits.push({ rank, color, el: f, picked: false, x, y });
    });
    wrap.appendChild(tree);

    // 篮子（已摘）
    const basket = document.createElement("div");
    basket.className = "op-basket";
    basket.id = "op-basket";
    basket.innerHTML = `<span class="op-basket-icon">🧺</span><div class="op-basket-items" id="op-items"></div>`;
    wrap.appendChild(basket);

    // 提示颜色顺序
    const hint = document.createElement("div");
    hint.className = "op-hint";
    hint.innerHTML = `顺序：<span style="color:${RIPENESS[0]!}">●生</span> → <span style="color:${RIPENESS[2]!}">●半熟</span> → <span style="color:${RIPENESS[4]!}">●熟</span>`;
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
  }

  private pick(rank: number, btn: HTMLButtonElement): void {
    if (btn.classList.contains("op-fruit--picked")) return;
    if (rank === this.nextRank) {
      btn.classList.add("op-fruit--picked");
      btn.disabled = true;
      this.nextRank += 1;
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 飞入篮子
      const items = this.root.querySelector("#op-items");
      if (items) {
        const piece = document.createElement("span");
        piece.className = "op-basket-fruit";
        piece.style.setProperty(
          "--op-color",
          RIPENESS[Math.min(rank, RIPENESS.length - 1)]!,
        );
        items.appendChild(piece);
      }
      if (this.nextRank >= this.fruits.length) {
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 800);
      }
    } else {
      btn.classList.remove("op-shake");
      void btn.offsetWidth;
      btn.classList.add("op-shake");
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先摘最青（绿）的，再摘越来越红的～",
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
    if (document.getElementById("op-style")) return;
    const st = document.createElement("style");
    st.id = "op-style";
    st.textContent = OP_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function OP_CSS(theme: string): string {
  return `
.op-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.op-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.op-tree{position:relative;width:min(360px,92%);height:300px;background:radial-gradient(ellipse at 50% 42%,#8bc34a 0%,#6ba23e 55%,transparent 72%);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;}
.op-tree::after{content:"";position:absolute;left:50%;bottom:0;width:18px;height:60px;margin-left:-9px;background:linear-gradient(#8d5524,#5d3a18);border-radius:4px;}
.op-fruit{position:absolute;width:40px;height:40px;border-radius:50%;border:none;background:radial-gradient(circle at 35% 30%,#fff9,var(--op-color));box-shadow:inset 0 -4px 6px rgba(0,0,0,.25),0 3px 5px rgba(0,0,0,.2);cursor:pointer;transform:translate(-50%,-50%);transition:transform .12s;animation:op-grow .3s ease;}
.op-fruit::before{content:"";position:absolute;top:-4px;left:50%;width:3px;height:8px;margin-left:-1px;background:#5d3a18;border-radius:2px;}
@keyframes op-grow{from{transform:translate(-50%,-50%) scale(0)}to{transform:translate(-50%,-50%) scale(1)}}
.op-fruit:hover{transform:translate(-50%,-50%) scale(1.12);}
.op-fruit--picked{animation:op-fly .5s ease forwards;pointer-events:none;}
@keyframes op-fly{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-50%) translateY(80px) scale(.3);opacity:0}}
.op-shake{animation:op-shake .4s ease;}
@keyframes op-shake{0%,100%{transform:translate(-50%,-50%) rotate(0)}25%{transform:translate(-50%,-50%) rotate(-12deg)}75%{transform:translate(-50%,-50%) rotate(12deg)}}
.op-basket{display:flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(255,255,255,.6);border-radius:16px;box-shadow:var(--shadow);min-height:48px;}
.op-basket-icon{font-size:1.8rem;}
.op-basket-items{display:flex;gap:4px;min-width:20px;}
.op-basket-fruit{width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff9,var(--op-color));box-shadow:inset 0 -2px 3px rgba(0,0,0,.25);animation:op-drop .25s ease;}
@keyframes op-drop{from{transform:translateY(-10px) scale(.4);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
.op-hint{font-size:.9rem;font-weight:700;color:var(--ink-soft);background:#fff;padding:5px 14px;border-radius:999px;box-shadow:var(--shadow);}
@media (max-width:380px){.op-tree{height:260px;}.op-fruit{width:34px;height:34px;}}
${/* theme 占位 */ ""}
.op-theme{color:${theme};}
`;
}

export function create(): OrchardPickGame {
  return new OrchardPickGame();
}
