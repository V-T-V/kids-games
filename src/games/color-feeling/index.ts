/* 颜色与情绪 Color Feeling —— 显示一种情绪，选对应的颜色。
   独特点：把抽象情绪和颜色感受联结起来（开心=黄、悲伤=蓝、愤怒=红、平静=绿）。
   巧思：表情用 emoji 呈现，颜色块带高光，难度=选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Feeling {
  mood: string; // 情绪名
  emoji: string; // 表情
  color: string; // 颜色 hex
  colorName: string; // 颜色名
}

const FEELINGS: Feeling[] = [
  { mood: "开心", emoji: "😄", color: "#ffd93d", colorName: "黄色" },
  { mood: "悲伤", emoji: "😢", color: "#4d96ff", colorName: "蓝色" },
  { mood: "愤怒", emoji: "😠", color: "#ff6348", colorName: "红色" },
  { mood: "平静", emoji: "😌", color: "#6bcf7f", colorName: "绿色" },
];

export class ColorFeelingGame extends BaseGame {
  constructor() {
    super("color-feeling");
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

    // 保证有解：先选正确答案，再补干扰项
    const target = sample(FEELINGS);
    const distractors = shuffle(
      FEELINGS.filter((f) => f.mood !== target.mood),
    ).slice(0, this.optCount() - 1);
    const options = shuffle([target, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "clf-wrap";

    const task = document.createElement("div");
    task.className = "clf-task";
    task.textContent = `哪个颜色更像「${target.emoji} ${target.mood}」的感觉？`;
    wrap.appendChild(task);

    const face = document.createElement("div");
    face.className = "clf-face";
    face.textContent = target.emoji;
    wrap.appendChild(face);

    const grid = document.createElement("div");
    grid.className = "clf-grid";
    for (const opt of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "clf-opt";
      b.style.setProperty("--clf-c", opt.color);
      b.setAttribute("aria-label", opt.colorName);
      b.addEventListener("click", () => this.choose(opt, target, b, grid));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private choose(
    opt: Feeling,
    target: Feeling,
    btn: HTMLButtonElement,
    grid: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (opt.color === target.color) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".clf-opt").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      btn.classList.add("clf-opt--right");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 800);
    } else {
      btn.classList.add("clf-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("clf-opt--wrong"), 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想一想这种心情是什么颜色的～",
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
    if (document.getElementById("clf-style")) return;
    const st = document.createElement("style");
    st.id = "clf-style";
    st.textContent = CLF_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function CLF_CSS(theme: string): string {
  return `
.clf-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.clf-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.clf-face{font-size:5rem;line-height:1;filter:drop-shadow(0 6px 10px rgba(0,0,0,.18));animation:clf-bounce 2s ease-in-out infinite;}
@keyframes clf-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.clf-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
.clf-opt{width:110px;height:110px;border-radius:24px;border:none;cursor:pointer;background:radial-gradient(circle at 35% 30%,#fff6,var(--clf-c,${theme}));box-shadow:var(--shadow);transition:transform .12s ease;}
.clf-opt:active{transform:scale(.92);}
.clf-opt--right{outline:5px solid #34c759;outline-offset:3px;animation:clf-pop .3s ease;}
.clf-opt--wrong{outline:5px solid #ff3b30;outline-offset:3px;animation:clf-shake .35s ease;}
@keyframes clf-pop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes clf-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ColorFeelingGame {
  return new ColorFeelingGame();
}
