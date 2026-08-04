/* 分蛋糕 Fraction Cake —— 一个圆形蛋糕切成若干等份，
   题目"吃掉 1/N 是几块"或"高亮了几块，是整个的几分之几"，孩子选答案。
   独特点：SVG 扇形深浅渐变 + 蜡烛装饰；吃掉的块变浅 + 笑脸反馈。
   视觉：圆形蛋糕分扇形 + 樱桃中心。难度 = 份数（easy 2/3, medium 4, hard 6/8）。
   通关 = 答对目标轮数。注意前缀 fck-（farm-harvest=fh-, fraction=fr-, 不冲突）。
   保证有解：正确答案始终包含在选项里。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

interface Question {
  prompt: string;
  answer: number;
  /** 高亮块数（模式 B 用），模式 A 为 0 */
  highlightN: number;
}

export class FractionCakeGame extends BaseGame {
  constructor() {
    super("fraction-cake");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private slices = 4;
  private currentQ!: Question;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.slices =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  /** 生成题目：模式 A "吃掉 1/N 是几块"（答分子块数）；
      模式 B "高亮 k 块是整个的几分之几"（答分母）。 */
  private makeQuestion(): Question {
    const s = this.slices;
    if (Math.random() < 0.5) {
      // 模式 A：吃掉 1/s 是几块？答 1
      // 进阶：吃掉 k/s 是几块？答 k
      const k = randInt(1, Math.max(1, s - 1));
      return {
        prompt: `吃掉 ${k}/${s} 是几块？点对应块数`,
        answer: k,
        highlightN: 0,
      };
    }
    // 模式 B：高亮 k 块是几分之几（答分母 s）
    const k = randInt(1, Math.max(1, s - 1));
    return {
      prompt: `高亮的 ${k} 块是整个蛋糕的几分之几？（点分母）`,
      answer: s,
      highlightN: k,
    };
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.currentQ = this.makeQuestion();
    const s = this.slices;
    const highlightN = this.currentQ.highlightN;
    const highlightIdxs =
      highlightN > 0 ? shuffle([...Array(s).keys()]).slice(0, highlightN) : [];

    const wrap = document.createElement("div");
    wrap.className = "fck-wrap";

    const task = document.createElement("div");
    task.className = "fck-task";
    task.innerHTML = `${this.currentQ.prompt} <span class="fck-prog">· 第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    // 蛋糕（SVG 扇形）
    const cakeBox = document.createElement("div");
    cakeBox.className = "fck-cake-box";
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 200 200");
    svg.setAttribute("class", "fck-cake");
    const cx = 100;
    const cy = 100;
    const r = 92;
    const palette = this.cakePalette(s);
    for (let i = 0; i < s; i++) {
      const a0 = (i / s) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / s) * Math.PI * 2 - Math.PI / 2;
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
      path.setAttribute(
        "fill",
        isHi ? "#fff3b0" : palette[i % palette.length]!,
      );
      path.setAttribute("stroke", "#c2185b");
      path.setAttribute("stroke-width", "2");
      path.setAttribute(
        "class",
        isHi ? "fck-slice fck-slice--hi" : "fck-slice",
      );
      svg.appendChild(path);
    }
    // 中心樱桃
    const hub = document.createElementNS(svgNS, "circle");
    hub.setAttribute("cx", String(cx));
    hub.setAttribute("cy", String(cy));
    hub.setAttribute("r", "10");
    hub.setAttribute("fill", "#e91e63");
    svg.appendChild(hub);
    // 樱桃高光
    const gloss = document.createElementNS(svgNS, "circle");
    gloss.setAttribute("cx", String(cx - 3));
    gloss.setAttribute("cy", String(cy - 3));
    gloss.setAttribute("r", "3");
    gloss.setAttribute("fill", "#ff9eb5");
    svg.appendChild(gloss);
    cakeBox.appendChild(svg);
    wrap.appendChild(cakeBox);

    // 选项
    const opts = document.createElement("div");
    opts.className = "fck-opts";
    const pool =
      highlightN > 0
        ? [2, 3, 4, 5, 6, 8].filter((v) => v !== this.currentQ.answer)
        : [...Array(Math.max(s, 4) + 1).keys()].slice(1);
    let choices = shuffle(pool).slice(0, 4);
    if (!choices.includes(this.currentQ.answer)) {
      choices = [...choices.slice(0, 3), this.currentQ.answer];
    }
    shuffle(choices).forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fck-choice";
      b.textContent = String(v);
      b.addEventListener("click", () => this.choose(v, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private cakePalette(n: number): string[] {
    const base: Record<number, string[]> = {
      2: ["#ffb3c6", "#ff6b9d"],
      3: ["#ff8fab", "#ff6b9d", "#ffc2d4"],
      4: ["#ff6b9d", "#ff8fab", "#ffb3c6", "#ffc9d8"],
      6: ["#ff6b9d", "#ff8fab", "#ffb3c6", "#ffc9d8", "#ffdbe6", "#ffe9f0"],
      8: [
        "#ff6b9d",
        "#ff7fa9",
        "#ff8fab",
        "#ffa3bd",
        "#ffb3c6",
        "#ffc2d4",
        "#ffc9d8",
        "#ffdbe6",
      ],
    };
    return base[n] ?? base[4]!;
  }

  private choose(v: number, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (v === this.currentQ.answer) {
      this.locked = true;
      sfxPop();
      btn.classList.add("fck-choice--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("fck-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("fck-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "数数蛋糕一共几块，再想想答案～",
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
    if (document.getElementById("fck-style")) return;
    const st = document.createElement("style");
    st.id = "fck-style";
    st.textContent = FC2_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function FC2_CSS(theme: string): string {
  return `
.fck-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(440px,100%);}
.fck-task{font-size:1.12rem;font-weight:800;text-align:center;line-height:1.5;}
.fck-task .fck-prog{font-size:.9rem;color:#999;font-weight:700;}
.fck-cake-box{filter:drop-shadow(0 12px 24px rgba(233,30,99,.25));animation:fck-pop .5s ease;}
.fck-cake{width:min(280px,72vw);height:auto;display:block;}
.fck-slice{transition:transform .25s ease;transform-origin:100px 100px;}
.fck-slice--hi{animation:fck-glow 1.2s ease-in-out infinite;}
@keyframes fck-glow{0%,100%{opacity:1}50%{opacity:.55}}
.fck-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.fck-choice{min-width:72px;height:72px;font-size:1.7rem;font-weight:800;border-radius:20px;background:#fff;color:var(--ink);box-shadow:var(--shadow);transition:transform .1s ease;border:none;cursor:pointer;}
.fck-choice:active{transform:scale(.94);}
.fck-choice--done{background:${theme};color:#fff;animation:fck-pop .4s ease;}
.fck-choice--wrong{animation:fck-shake .4s ease;}
@keyframes fck-pop{0%{transform:scale(.7)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes fck-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): FractionCakeGame {
  return new FractionCakeGame();
}
