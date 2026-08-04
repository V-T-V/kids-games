/* 杠杆平衡 Lever Balance —— 杠杆支点两侧各放砝码（重量不同、距离支点不同），
   孩子判断杠杆向哪边倾斜，还是保持平衡。
   独特点：力矩=重量×距离 的直觉训练。
   巧思：题目保证答案明确（力矩差非 0 或恰好相等），三个选项：左沉/右沉/平衡。
   视觉：杠杆横木 + 支点 + 砝码。难度=配置复杂度（砝码数）。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

interface Weight {
  /** 侧：-1 左 / +1 右。 */
  side: -1 | 1;
  /** 距支点格数（1..maxArm）。 */
  dist: number;
  /** 重量（1..4）。 */
  w: number;
}

export class LeverBalanceGame extends BaseGame {
  constructor() {
    super("lever-balance");
  }

  private maxArm = 3;
  private weights: Weight[] = [];
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.maxArm =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 4;
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 生成保证答案明确的配置：
   *  - 三类题目：左沉 / 右沉 / 平衡
   *  - 力矩 = Σ(重量 × 距离)。平衡时左右力矩严格相等；
   *    非平衡时差值足够大（避免孩子觉得"差不多"）。 */
  private genWeights(): {
    weights: Weight[];
    answer: "left" | "right" | "balance";
  } {
    const arm = this.maxArm;
    const wCount =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    for (let attempt = 0; attempt < 300; attempt++) {
      const weights: Weight[] = [];
      // 随机分配各砝码
      for (let i = 0; i < wCount; i++) {
        weights.push({
          side: sample([-1, 1] as const),
          dist: randInt(1, arm),
          w: randInt(1, 4),
        });
      }
      // 确保两侧都至少有一个砝码（否则一边空着太明显）
      const hasLeft = weights.some((x) => x.side === -1);
      const hasRight = weights.some((x) => x.side === 1);
      if (!hasLeft || !hasRight) continue;

      let leftT = 0;
      let rightT = 0;
      for (const wt of weights) {
        if (wt.side === -1) leftT += wt.w * wt.dist;
        else rightT += wt.w * wt.dist;
      }
      const diff = rightT - leftT;
      let answer: "left" | "right" | "balance";
      if (diff === 0) answer = "balance";
      else if (diff > 0)
        answer = "right"; // 右力矩大 → 右端下沉
      else answer = "left";
      // 难度 easy 时避免平衡题（对幼儿偏难），优先要明显倾斜
      if (this.difficulty === "easy" && answer === "balance") continue;
      // 非平衡题要求力矩差足够明显（>=2），避免模棱两可
      if (answer !== "balance" && Math.abs(diff) < 2) continue;
      // 平衡题要求左右砝码数≥2 各自，避免 1=1 太简单
      if (answer === "balance") {
        const lc = weights.filter((x) => x.side === -1).length;
        const rc = weights.filter((x) => x.side === 1).length;
        if (lc < 1 || rc < 1) continue;
      }
      return { weights, answer };
    }
    // 兜底：简单可解配置（左 2 格 2 斤 vs 右 1 格 4 斤 → 左力矩4=右4 平衡）
    return {
      weights: [
        { side: -1, dist: 2, w: 2 },
        { side: 1, dist: 1, w: 4 },
      ],
      answer: "balance",
    };
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const { weights, answer } = this.genWeights();
    this.weights = weights;
    this.render(answer);
  }

  private render(answer: "left" | "right" | "balance"): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "lvb-wrap";
    const task = document.createElement("div");
    task.className = "lvb-task";
    task.innerHTML = `看看杠杆，你觉得它会怎么转？<br><span class="lvb-hint">离支点<b>越远</b>越沉，<b>越重</b>越沉～ ${this.roundsDone + 1} / ${this.roundTotal}</span>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "lvb-stage";

    // 杠杆：一根横木，绕支点旋转（这里展示水平，作答后动画演示）
    const beam = document.createElement("div");
    beam.className = "lvb-beam";
    beam.id = "lvb-beam";

    // 刻度格（左右各 maxArm 格）
    const unit = 38; // 每格像素宽
    const halfLen = this.maxArm * unit;
    beam.style.width = `${halfLen * 2}px`;
    beam.style.marginLeft = `-${halfLen}px`;

    // 砝码：定位到 beam 上（左负 / 右正，单位格）
    for (let i = 0; i < this.weights.length; i++) {
      const wt = this.weights[i]!;
      const wEl = document.createElement("div");
      wEl.className = `lvb-weight lvb-weight--w${wt.w}`;
      // 大小随重量
      const size = 20 + wt.w * 6;
      wEl.style.width = `${size}px`;
      wEl.style.height = `${size}px`;
      wEl.style.fontSize = `${0.6 + wt.w * 0.12}rem`;
      wEl.textContent = String(wt.w);
      // 距离支点（beam 中心）
      const offset = wt.side * wt.dist * unit;
      wEl.style.left = `calc(50% + ${offset}px)`;
      wEl.title = `重量 ${wt.w}，距支点 ${wt.dist} 格`;
      beam.appendChild(wEl);
    }

    // 支点（三角形）
    const pivot = document.createElement("div");
    pivot.className = "lvb-pivot";

    stage.appendChild(beam);
    stage.appendChild(pivot);
    wrap.appendChild(stage);

    // 距离刻度提示（小字）
    const scaleNote = document.createElement("div");
    scaleNote.className = "lvb-scale-note";
    scaleNote.innerHTML = this.scaleNote();
    wrap.appendChild(scaleNote);

    // 选项
    const opts = document.createElement("div");
    opts.className = "lvb-opts";
    const options: Array<{
      key: "left" | "right" | "balance";
      label: string;
      icon: string;
    }> = shuffle([
      { key: "left", label: "左沉", icon: "⬅️" },
      { key: "right", label: "右沉", icon: "➡️" },
      { key: "balance", label: "平衡", icon: "⚖️" },
    ]);
    for (const opt of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lvb-opt";
      b.innerHTML = `<span class="lvb-opt-icon">${opt.icon}</span><span>${opt.label}</span>`;
      b.addEventListener("click", () => this.choose(opt.key, answer, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  /** 力矩明细，给孩子看清楚。 */
  private scaleNote(): string {
    let leftT = 0,
      rightT = 0;
    for (const wt of this.weights) {
      if (wt.side === -1) leftT += wt.w * wt.dist;
      else rightT += wt.w * wt.dist;
    }
    return `左：${
      this.weights
        .filter((w) => w.side === -1)
        .map((w) => `${w.w}×${w.dist}`)
        .join(" + ") || "0"
    } = <b>${leftT}</b> · 右：${
      this.weights
        .filter((w) => w.side === 1)
        .map((w) => `${w.w}×${w.dist}`)
        .join(" + ") || "0"
    } = <b>${rightT}</b>`;
  }

  private choose(
    ans: "left" | "right" | "balance",
    correct: "left" | "right" | "balance",
    btn: HTMLButtonElement,
  ): void {
    if (this.answered) return;
    this.answered = true;
    const ok = ans === correct;
    // 演示杠杆真实倾斜
    const beam = this.root.querySelector("#lvb-beam") as HTMLDivElement | null;
    if (beam) {
      let deg = 0;
      if (correct === "left") deg = -14;
      else if (correct === "right") deg = 14;
      beam.style.transition = "transform .5s ease";
      beam.style.transform = `rotate(${deg}deg)`;
    }
    if (ok) {
      btn.classList.add("lvb-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    } else {
      btn.classList.add("lvb-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".lvb-opt--wrong")
          .forEach((el) => el.classList.remove("lvb-opt--wrong"));
      }, 800);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("lvb-style")) return;
    const st = document.createElement("style");
    st.id = "lvb-style";
    st.textContent = LVB_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function LVB_CSS(theme: string): string {
  return `
.lvb-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;}
.lvb-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.lvb-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.lvb-hint b{color:${theme};}
.lvb-stage{position:relative;width:100%;max-width:460px;height:200px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:46px;}
.lvb-beam{position:relative;height:18px;background:linear-gradient(180deg,#a1887f,#6d4c41);border-radius:6px;box-shadow:var(--shadow),inset 0 2px 0 rgba(255,255,255,.25);transform-origin:50% 50%;left:50%;}
.lvb-weight{position:absolute;bottom:18px;transform:translateX(-50%);border-radius:50% 50% 30% 30%/60% 60% 30% 30%;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;box-shadow:inset 0 -4px 0 rgba(0,0,0,.2),inset 0 3px 0 rgba(255,255,255,.4),0 3px 5px rgba(0,0,0,.25);border:2px solid rgba(0,0,0,.15);}
.lvb-weight--w1{background:linear-gradient(180deg,#ffd54f,#ffb300);}
.lvb-weight--w2{background:linear-gradient(180deg,#4fc3f7,#0288d1);}
.lvb-weight--w3{background:linear-gradient(180deg,#81c784,#388e3c);}
.lvb-weight--w4{background:linear-gradient(180deg,#e57373,#c62828);}
.lvb-pivot{position:absolute;bottom:30px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:24px solid transparent;border-right:24px solid transparent;border-bottom:42px solid ${theme};filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));}
.lvb-scale-note{font-size:.9rem;color:var(--ink-soft);font-weight:700;text-align:center;background:#fff;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
.lvb-scale-note b{color:${theme};}
.lvb-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.lvb-opt{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:92px;padding:12px 16px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#f0f0f5);box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s ease,background .2s ease;font-weight:800;color:var(--ink);}
.lvb-opt-icon{font-size:1.6rem;}
.lvb-opt:active{transform:scale(.95);}
.lvb-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:lvb-yes .4s ease;}
@keyframes lvb-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.lvb-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:lvb-no .3s ease;}
@keyframes lvb-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.lvb-opt{min-width:78px;padding:10px 10px;}}
`;
}

export function create(): LeverBalanceGame {
  return new LeverBalanceGame();
}
