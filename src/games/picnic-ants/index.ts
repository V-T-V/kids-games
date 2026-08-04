/* 野餐蚂蚁 Picnic Ants —— 把食物平均分给蚂蚁，每只分到几块？
   独特点：除法启蒙——用"分东西"具象化等分概念。N 块食物，M 只蚂蚁，N 能被 M 整除。
   玩法：题目展示食物总数和蚂蚁数，孩子从选项里选"每只几块"。
         答对后会把食物一格一格分到蚂蚁旁边（动画演示等分）。
   解保证：答案 = N / M，N 选为 M 的倍数，整除必成立。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const FOODS = ["🍬", "🍪", "🍩", "🧁", "🍫", "🍭"] as const;

function config(diff: "easy" | "medium" | "hard"): {
  ants: number;
  per: number;
} {
  // ants：蚂蚁数；per：每只分到的食物数；food = ants * per
  if (diff === "easy") {
    const ants = 2;
    const per = Math.floor(Math.random() * 3) + 2; // 2~4
    return { ants, per };
  }
  if (diff === "medium") {
    const ants = Math.random() < 0.5 ? 3 : 4;
    const per = Math.floor(Math.random() * 3) + 2; // 2~4
    return { ants, per };
  }
  // hard
  const ants = Math.random() < 0.5 ? 4 : 5;
  const per = Math.floor(Math.random() * 4) + 2; // 2~5
  return { ants, per };
}
function roundTotal(diff: "easy" | "medium" | "hard"): number {
  return diff === "easy" ? 3 : diff === "medium" ? 3 : 4;
}

export class PicnicAntsGame extends BaseGame {
  constructor() {
    super("picnic-ants");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private ants = 0;
  private per = 0;
  private food = 0;
  private foodEmoji = "🍬";
  private answered = false;

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
    this.answered = false;
    const { ants, per } = config(this.difficulty);
    this.ants = ants;
    this.per = per;
    this.food = ants * per;
    this.foodEmoji = FOODS[Math.floor(Math.random() * FOODS.length)]!;

    const wrap = document.createElement("div");
    wrap.className = "pa-wrap";

    const task = document.createElement("div");
    task.className = "pa-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · <b>${this.food}</b> 块糖分给 <b>${this.ants}</b> 只蚂蚁，每只一样多，每只几块？🧺`;
    wrap.appendChild(task);

    // 食物堆
    const pile = document.createElement("div");
    pile.className = "pa-pile";
    pile.id = "pa-pile";
    for (let i = 0; i < this.food; i++) {
      const f = document.createElement("span");
      f.className = "pa-food";
      f.textContent = this.foodEmoji;
      pile.appendChild(f);
    }
    wrap.appendChild(pile);

    // 蚂蚁行（分好后每只蚂蚁下面有 per 个食物）
    const antRow = document.createElement("div");
    antRow.className = "pa-ants";
    antRow.id = "pa-ants";
    for (let i = 0; i < this.ants; i++) {
      const a = document.createElement("div");
      a.className = "pa-ant";
      a.innerHTML = `<div class="pa-ant-emoji">🐜</div><div class="pa-ant-plate" data-i="${i}"></div>`;
      antRow.appendChild(a);
    }
    wrap.appendChild(antRow);

    // 选项：正确 + 干扰
    const choices = document.createElement("div");
    choices.className = "pa-choices";
    const opts = new Set<number>([this.per]);
    while (opts.size < 4) {
      const d = this.per + (Math.floor(Math.random() * 5) - 2);
      if (d >= 1 && d !== this.per) opts.add(d);
    }
    for (const v of shuffle([...opts])) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pa-opt";
      b.dataset.v = String(v);
      b.textContent = `${v} 块`;
      b.addEventListener("click", () => this.choose(v, b));
      choices.appendChild(b);
    }
    wrap.appendChild(choices);

    this.root.appendChild(wrap);
  }

  private choose(v: number, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (v === this.per) {
      this.answered = true;
      btn.classList.add("pa-opt--right");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 动画演示：把食物堆一个个分到蚂蚁盘子里
      this.distribute();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1400);
    } else {
      btn.classList.add("pa-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("pa-opt--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  /** 动画：把食物堆里的糖果依次分到每只蚂蚁（轮流一人一个）。 */
  private distribute(): void {
    const pileFoods =
      this.root.querySelectorAll<HTMLElement>("#pa-pile .pa-food");
    const plates = this.root.querySelectorAll<HTMLElement>(".pa-ant-plate");
    // 轮流分配：第 k 个食物给第 (k % ants) 只蚂蚁
    pileFoods.forEach((f, k) => {
      this.trackTimeout(() => {
        f.classList.add("pa-food--fly");
        const target = plates[k % this.ants]!;
        const tr = target.getBoundingClientRect();
        const fr = f.getBoundingClientRect();
        const dx = tr.left + tr.width / 2 - (fr.left + fr.width / 2);
        const dy = tr.top + tr.height / 2 - (fr.top + fr.height / 2);
        f.style.transform = `translate(${dx}px,${dy}px) scale(.7)`;
        f.style.opacity = "0";
        // 在目标盘子里加一个糖果
        this.trackTimeout(() => {
          sfxPop();
          const piece = document.createElement("span");
          piece.className = "pa-piece";
          piece.textContent = this.foodEmoji;
          target.appendChild(piece);
        }, 240);
      }, k * 90);
    });
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "试着一只蚂蚁分一块，轮流分，分到没为止，数数每只有几块～",
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
    if (document.getElementById("pa-style")) return;
    const st = document.createElement("style");
    st.id = "pa-style";
    st.textContent = PA_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function PA_CSS(theme: string): string {
  return `
.pa-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(460px,100%);}
.pa-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);line-height:1.6;}
.pa-pile{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:14px;background:linear-gradient(160deg,#fff8e7,#ffe9b8);border-radius:18px;box-shadow:var(--shadow);width:min(360px,92%);min-height:60px;}
.pa-food{font-size:1.7rem;transition:transform .35s ease,opacity .35s ease;will-change:transform;}
.pa-food--fly{position:relative;z-index:5;}
.pa-ants{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;width:min(360px,92%);}
.pa-ant{display:flex;flex-direction:column;align-items:center;gap:4px;}
.pa-ant-emoji{font-size:2rem;line-height:1;animation:pa-wiggle 1.6s ease-in-out infinite;}
@keyframes pa-wiggle{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
.pa-ant-plate{display:flex;flex-wrap:wrap;gap:2px;justify-content:center;min-width:60px;min-height:32px;padding:4px 6px;background:rgba(255,255,255,.6);border-radius:10px;box-shadow:inset 0 0 6px rgba(0,0,0,.08);}
.pa-piece{font-size:1.2rem;animation:pa-drop .25s ease;}
@keyframes pa-drop{from{transform:translateY(-12px) scale(.4);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
.pa-choices{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:20px;box-shadow:var(--shadow);}
.pa-opt{font-family:inherit;font-size:1.1rem;font-weight:900;color:var(--ink);background:#fff;border:none;width:84px;height:54px;border-radius:14px;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s,background .15s;}
.pa-opt:hover{transform:translateY(-3px);}
.pa-opt:active{transform:scale(.93);}
.pa-opt--right{background:linear-gradient(160deg,#6bcf7f,#4ba85f);color:#fff;animation:pa-pop .3s ease;}
.pa-opt--wrong{background:linear-gradient(160deg,#ff8a8a,#ff6348);color:#fff;animation:pa-shake .4s ease;}
@keyframes pa-pop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes pa-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
${/* theme 占位 */ ""}
.pa-theme{color:${theme};}
`;
}

export function create(): PicnicAntsGame {
  return new PicnicAntsGame();
}
