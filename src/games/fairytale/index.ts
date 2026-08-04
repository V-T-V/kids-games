/* 童话配对 Fairytale —— 显示童话角色 emoji，选出对应的童话名。
   独特点：经典童话角色与故事名配对，培养文化常识与符号联想。
   巧思：每个童话配双 emoji 更生动，难度=选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Tale {
  emoji: string;
  name: string;
}

const TALES: Tale[] = [
  { emoji: "👸🍎", name: "白雪公主" },
  { emoji: "🧚✨", name: "彼得·潘" },
  { emoji: "🐹🐹", name: "三只小猪" },
  { emoji: "🐰🐺", name: "龟兔赛跑" },
  { emoji: "👠👸", name: "灰姑娘" },
  { emoji: "🐎🦸", name: "小马过河" },
  { emoji: "🐠🤲", name: "渔夫和金鱼" },
  { emoji: "👧🧦", name: "小红帽" },
  { emoji: "🦆🦢", name: "丑小鸭" },
  { emoji: "🌙🐱", name: "穿靴子的猫" },
];

export class FairytaleGame extends BaseGame {
  constructor() {
    super("fairytale");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const target = sample(TALES);
    const distractors = shuffle(
      TALES.filter((t) => t.name !== target.name),
    ).slice(0, this.optCount() - 1);
    const options = shuffle([target, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "fty-wrap";

    const task = document.createElement("div");
    task.className = "fty-task";
    task.textContent = "这是哪个童话里的角色？";
    wrap.appendChild(task);

    const emoji = document.createElement("div");
    emoji.className = "fty-emoji";
    emoji.textContent = target.emoji;
    wrap.appendChild(emoji);

    const grid = document.createElement("div");
    grid.className = "fty-grid";
    for (const opt of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fty-opt";
      b.textContent = opt.name;
      b.addEventListener("click", () => this.choose(opt, target, b, grid));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private choose(
    opt: Tale,
    target: Tale,
    btn: HTMLButtonElement,
    grid: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (opt.name === target.name) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".fty-opt").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      btn.classList.add("fty-opt--right");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 800);
    } else {
      btn.classList.add("fty-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("fty-opt--wrong"), 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想一想这个角色出自哪个故事～",
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
    if (document.getElementById("fty-style")) return;
    const st = document.createElement("style");
    st.id = "fty-style";
    st.textContent = FTY_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function FTY_CSS(theme: string): string {
  return `
.fty-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.fty-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.fty-emoji{font-size:4.5rem;line-height:1.2;filter:drop-shadow(0 6px 10px rgba(0,0,0,.18));animation:fty-float 2.4s ease-in-out infinite;}
@keyframes fty-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.fty-grid{display:flex;flex-direction:column;gap:12px;width:100%;}
.fty-opt{min-height:56px;padding:10px 22px;border-radius:16px;background:#fff;font-weight:800;font-size:1.1rem;color:${theme};box-shadow:var(--shadow);}
.fty-opt:active{transform:scale(.97);}
.fty-opt--right{background:#d4f4dd;outline:4px solid #34c759;}
.fty-opt--wrong{background:#ffe0e0;outline:4px solid #ff3b30;}
`;
}

export function create(): FairytaleGame {
  return new FairytaleGame();
}
