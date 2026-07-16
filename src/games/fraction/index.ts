/* 分数披萨 Fraction —— 一个圆形披萨切成若干等份，认识分数。
   巧思：SVG 扇形每块深浅不同；题目"吃掉 1/3 是几块"或"这些是几分之几"。
   难度 = 份数（easy 2 / medium 4 / hard 6）。通关 = 答对目标题数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

interface Question {
  /** 题干文案 */
  prompt: string;
  /** 正确答案（块数或分母） */
  answer: number;
}

export class FractionGame extends BaseGame {
  constructor() {
    super("fraction");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private slices = 4;
  private currentQ!: Question;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.slices =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 4 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  /** 生成本轮题目：两种模式 */
  private makeQuestion(): Question {
    // 取分子（1 ~ slices-1）
    const numerator = randInt(1, Math.max(1, this.slices - 1));
    if (Math.random() < 0.5) {
      // 模式 A：吃掉 numerator/slices 是几块？
      return {
        prompt: `吃掉 ${numerator}/${this.slices} 是几块？点对应块数`,
        answer: numerator,
      };
    }
    // 模式 B：高亮 numerator 块，问是几分之几（答分母）
    return {
      prompt: `高亮的 ${numerator} 块是整个披萨的几分之几？（点分母）`,
      answer: this.slices,
    };
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.currentQ = this.makeQuestion();
    // 模式 B 时高亮的块数 = numerator（从 prompt 解析不便，单独存）
    const highlightN = this.currentQ.prompt.startsWith("高亮")
      ? Number(this.currentQ.prompt.match(/高亮的 (\d+) 块/)?.[1] ?? 1)
      : 0;

    const wrap = document.createElement("div");
    wrap.className = "fr-wrap";

    const task = document.createElement("div");
    task.className = "fr-task";
    task.textContent = `${this.currentQ.prompt}（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 披萨（SVG 扇形）
    const pizzaBox = document.createElement("div");
    pizzaBox.className = "fr-pizza-box";
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 200 200");
    svg.setAttribute("class", "fr-pizza");
    const cx = 100;
    const cy = 100;
    const r = 92;
    const palette = this.pizzaPalette(this.slices);
    const highlightIdxs =
      highlightN > 0
        ? shuffle([...Array(this.slices).keys()]).slice(0, highlightN)
        : [];
    for (let i = 0; i < this.slices; i++) {
      const a0 = (i / this.slices) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / this.slices) * Math.PI * 2 - Math.PI / 2;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute(
        "d",
        `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
      );
      const isHi = highlightIdxs.includes(i);
      path.setAttribute("fill", isHi ? "#fff3b0" : palette[i]!);
      path.setAttribute("stroke", "#b5651d");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("class", isHi ? "fr-slice fr-slice--hi" : "fr-slice");
      svg.appendChild(path);
    }
    // 中心小圆（芝士）
    const hub = document.createElementNS(svgNS, "circle");
    hub.setAttribute("cx", String(cx));
    hub.setAttribute("cy", String(cy));
    hub.setAttribute("r", "10");
    hub.setAttribute("fill", "#ffe08a");
    svg.appendChild(hub);
    pizzaBox.appendChild(svg);
    wrap.appendChild(pizzaBox);

    // 选项
    const opts = document.createElement("div");
    opts.className = "fr-opts";
    const pool =
      highlightN > 0
        ? // 模式 B：选分母
          [2, 3, 4, 5, 6]
        : [...Array(this.slices + 1).keys()].slice(1); // 1..slices
    const choices = shuffle(pool).slice(0, Math.min(4, pool.length));
    if (!choices.includes(this.currentQ.answer)) {
      choices[0] = this.currentQ.answer;
    }
    shuffle(choices).forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fr-choice";
      b.textContent = String(v);
      b.addEventListener("click", () => this.choose(v, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
    void sample;
  }

  private pizzaPalette(n: number): string[] {
    // 同色系深浅渐变（番茄红→暖橙）
    const base: Record<number, string[]> = {
      2: ["#ff7a5c", "#ffb199"],
      4: ["#e8533b", "#ff7a5c", "#ff9f6b", "#ffc59e"],
      6: ["#d9402a", "#e8533b", "#ff7a5c", "#ff9f6b", "#ffb88a", "#ffd2b3"],
    };
    return base[n] ?? base[4]!;
  }

  private choose(v: number, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (v === this.currentQ.answer) {
      this.locked = true;
      sfxPop();
      btn.classList.add("fr-choice--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("fr-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("fr-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "数数披萨一共几块，再想想答案～",
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
    if (document.getElementById("fr-style")) return;
    const st = document.createElement("style");
    st.id = "fr-style";
    st.textContent = FR_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function FR_CSS(theme: string): string {
  return `
.fr-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(440px,100%);}
.fr-task{font-size:1.18rem;font-weight:800;text-align:center;line-height:1.5;}
.fr-pizza-box{filter:drop-shadow(0 12px 24px rgba(0,0,0,.18));animation:fr-pop .5s ease;}
.fr-pizza{width:min(280px,72vw);height:auto;display:block;}
.fr-slice{transition:transform .25s ease;transform-origin:100px 100px;cursor:default;}
.fr-slice--hi{animation:fr-glow 1.2s ease-in-out infinite;}
@keyframes fr-glow{0%,100%{opacity:1}50%{opacity:.55}}
.fr-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.fr-choice{min-width:72px;height:72px;font-size:1.7rem;font-weight:800;border-radius:20px;background:#fff;color:var(--ink);box-shadow:var(--shadow);transition:transform .1s ease;}
.fr-choice:active{transform:scale(.94);}
.fr-choice--done{background:${theme};color:#fff;animation:fr-pop .4s ease;}
.fr-choice--wrong{animation:fr-shake .4s ease;}
@keyframes fr-pop{0%{transform:scale(.7)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes fr-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): FractionGame {
  return new FractionGame();
}
