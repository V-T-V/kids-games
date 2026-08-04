/* 毛毛虫 Caterpillar Grow —— 叶子从大到小排成一排，孩子要按"从大到小"的顺序
   点击叶子让毛毛虫吃掉。每吃一片毛毛虫就长一节，全部吃完后化茧成蝶。
   视觉：树枝上的毛毛虫 + 由大到小的叶子 + 破茧蝴蝶。
   独特点：大小排序 + 成长反馈。难度 = 叶子数。通关 = 吃完目标轮数。
   前缀 cpg-（注意：cg- 已被 color-gradient 占用，故用 cpg-）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Leaf {
  size: number; // 1=最小 ... max=最大
  el: HTMLButtonElement;
  eaten: boolean;
}

export class CaterpillarGrowGame extends BaseGame {
  constructor() {
    super("caterpillar-grow");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private leaves: Leaf[] = [];
  private nextSize = 0;
  private maxLevel = 0;
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
    if (this.difficulty === "easy") return 4;
    if (this.difficulty === "medium") return 5;
    return 6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    const n = this.count();
    this.maxLevel = n;
    this.nextSize = n; // 先吃最大（最长的）叶子
    this.leaves = [];

    const wrap = document.createElement("div");
    wrap.className = "cpg-wrap";

    const task = document.createElement("div");
    task.className = "cpg-task";
    task.innerHTML = `先点最大的 🍃，一片片喂毛毛虫！第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关`;
    wrap.appendChild(task);

    // 毛毛虫（头 + 身体节）
    const bug = document.createElement("div");
    bug.className = "cpg-bug";
    const head = document.createElement("div");
    head.className = "cpg-head";
    head.textContent = "🐛";
    bug.appendChild(head);
    const body = document.createElement("div");
    body.className = "cpg-body";
    body.id = "cpg-body";
    bug.appendChild(body);
    wrap.appendChild(bug);

    // 叶子排：打乱位置展示，但大小不同（视觉宽度/高度按 size 缩放）
    const leavesRow = document.createElement("div");
    leavesRow.className = "cpg-leaves";
    const sizes: number[] = [];
    for (let s = 1; s <= n; s++) sizes.push(s);
    shuffle(sizes).forEach((size) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cpg-leaf";
      b.textContent = "🍃";
      // 大小映射：size=n 最大 → scale 1；size=1 → scale ~0.55
      const scale = 0.55 + (size / n) * 0.5;
      b.style.setProperty("--cpg-scale", `${scale}`);
      b.dataset.size = String(size);
      b.addEventListener("click", () => this.eat(b, size));
      leavesRow.appendChild(b);
      this.leaves.push({ size, el: b, eaten: false });
    });
    wrap.appendChild(leavesRow);
    this.root.appendChild(wrap);
  }

  private eat(btn: HTMLButtonElement, size: number): void {
    if (this.locked || btn.classList.contains("cpg-leaf--eaten")) return;
    if (size === this.nextSize) {
      this.locked = true;
      btn.classList.add("cpg-leaf--eaten");
      const leaf = this.leaves.find((l) => l.size === size && !l.eaten);
      if (leaf) leaf.eaten = true;
      // 长一节身体
      const body = this.root.querySelector("#cpg-body");
      if (body) {
        const seg = document.createElement("span");
        seg.className = "cpg-seg";
        body.appendChild(seg);
      }
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.nextSize -= 1;
      this.trackTimeout(() => {
        this.locked = false;
        if (this.nextSize <= 0) {
          // 全部吃完 → 化茧成蝶
          this.transform();
        }
      }, 350);
    } else {
      btn.classList.add("cpg-leaf--shake");
      this.trackTimeout(() => btn.classList.remove("cpg-leaf--shake"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private transform(): void {
    // 展示化茧成蝶动画
    const bug = this.root.querySelector(".cpg-bug") as HTMLElement | null;
    if (bug) {
      bug.classList.add("cpg-bug--cocoon");
    }
    this.trackTimeout(() => {
      if (bug) {
        bug.classList.remove("cpg-bug--cocoon");
        bug.classList.add("cpg-bug--butterfly");
        bug.innerHTML = "";
        const fly = document.createElement("div");
        fly.className = "cpg-butterfly";
        fly.textContent = "🦋";
        bug.appendChild(fly);
      }
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    }, 1200);
  }

  private showRest(): void {
    this.locked = true;
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🐛",
      variant: "rest",
      body: "先找最大（最长）的那片叶子点它，再找第二大的……一个比一个小～",
      primary: {
        text: "继续",
        icon: "🍃",
        onClick: () => {
          ov.destroy();
          this.locked = false;
        },
      },
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
    if (document.getElementById("cpg-style")) return;
    const st = document.createElement("style");
    st.id = "cpg-style";
    st.textContent = CPG_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function CPG_CSS(theme: string): string {
  return `
.cpg-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.cpg-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.cpg-task b{color:${theme};}
.cpg-bug{display:flex;align-items:center;justify-content:center;min-height:70px;background:linear-gradient(180deg,#dcfce7,#bbf7d0);padding:10px 18px;border-radius:999px;box-shadow:var(--shadow);transition:transform .4s ease;position:relative;}
.cpg-head{font-size:2.6rem;line-height:1;animation:cpg-wiggle 1.4s ease-in-out infinite alternate;}
@keyframes cpg-wiggle{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}
.cpg-body{display:flex;align-items:center;margin-left:-6px;}
.cpg-seg{display:inline-block;width:18px;height:18px;margin:0 2px;border-radius:50%;background:linear-gradient(180deg,#86efac,#4ade80);border:2px solid #16a34a;animation:cpg-grow .3s ease;}
@keyframes cpg-grow{0%{transform:scale(0)}100%{transform:scale(1)}}
.cpg-bug--cocoon{transform:scale(.7) rotate(0);animation:cpg-spin 1.2s ease-in-out;}
@keyframes cpg-spin{0%{transform:scale(.7) rotate(0)}50%{transform:scale(.55) rotate(180deg)}100%{transform:scale(.7) rotate(360deg)}}
.cpg-bug--butterfly{animation:cpg-fly 1s ease;}
.cpg-butterfly{font-size:3rem;line-height:1;filter:drop-shadow(0 4px 4px rgba(0,0,0,.2));}
@keyframes cpg-fly{0%{transform:translateY(0) scale(.8)}60%{transform:translateY(-10px) scale(1.3)}100%{transform:translateY(0) scale(1)}}
.cpg-leaves{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;background:linear-gradient(180deg,#a3e635,#65a30d);padding:20px 16px;border-radius:18px;box-shadow:var(--shadow);width:100%;max-width:440px;}
.cpg-leaf{border:none;background:transparent;cursor:pointer;font-size:calc(2.4rem * var(--cpg-scale,1));line-height:1;padding:4px;filter:drop-shadow(0 3px 3px rgba(0,0,0,.2));transition:transform .12s;}
.cpg-leaf:active{transform:scale(1.12);}
.cpg-leaf--eaten{opacity:0;transform:scale(0) rotate(90deg);pointer-events:none;transition:all .35s ease;}
.cpg-leaf--shake{animation:cpg-shake .45s ease;}
@keyframes cpg-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.cpg-head{font-size:2.2rem;}.cpg-leaf{font-size:calc(2rem * var(--cpg-scale,1));}.cpg-leaves{gap:10px;padding:16px 12px;}}
`;
}

export function create(): CaterpillarGrowGame {
  return new CaterpillarGrowGame();
}
