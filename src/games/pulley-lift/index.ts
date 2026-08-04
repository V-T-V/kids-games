/* 滑轮起重 Pulley Lift —— 定滑轮在上方，绳子一端挂重物（标了重量数字），
   另一端挂配重。孩子选配重让两边平衡。定滑轮不省力，所以两边重量必须相等才平衡。
   独特点：定滑轮"只改方向不改力"的直觉——两边相等才平衡。
   巧思：题目保证正确答案唯一且明确（重量差足够大避免模棱两可）。
   视觉：上方定滑轮（带转动）+ V 形绳子 + 两侧吊桶（标数字）。难度=重量差。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

export class PulleyLiftGame extends BaseGame {
  constructor() {
    super("pulley-lift");
  }

  private cargoW = 0; // 重物重量（固定一端）
  private options: number[] = []; // 备选配重
  private answer = 0; // 正确配重 = cargoW
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空，无 RAF */
  }

  /** 生成保证可解的题：重物重量随机，正确配重=重物；其它选项与正确值差距足够明显。 */
  private genRound(): { cargo: number; options: number[]; answer: number } {
    const maxW =
      this.difficulty === "easy" ? 6 : this.difficulty === "medium" ? 9 : 12;
    const cargo = randInt(2, maxW);
    const answer = cargo;
    // 备选：再生成 2 个不等于 answer 且彼此不同的配重，与答案差 >=2 避免模棱两可
    const others: number[] = [];
    let guard = 0;
    while (others.length < 2 && guard < 60) {
      guard += 1;
      const v = randInt(1, maxW);
      if (v === answer) continue;
      if (others.includes(v)) continue;
      if (Math.abs(v - answer) < 2) continue; // 差距够大才作为干扰项
      others.push(v);
    }
    // 兜底：保证两个干扰项存在
    let fill = 1;
    while (others.length < 2) {
      const v = answer + (fill % 2 === 0 ? fill : -fill) * 2;
      if (v >= 1 && v <= maxW && v !== answer && !others.includes(v)) {
        others.push(v);
      }
      fill += 1;
      if (fill > 20) break;
    }
    const options = shuffle([answer, ...others]);
    return { cargo, options, answer };
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const { cargo, options, answer } = this.genRound();
    this.cargoW = cargo;
    this.options = options;
    this.answer = answer;
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "pl2-wrap";

    const task = document.createElement("div");
    task.className = "pl2-task";
    task.innerHTML = `左边挂着 <b>${this.cargoW}</b> 公斤的重物。<br>定滑轮两边要一样重才平衡，选个配重让它<b>稳住</b>！ ${this.roundsDone + 1} / ${this.roundTotal}`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "pl2-stage";

    // 顶部横梁 + 滑轮
    const beam = document.createElement("div");
    beam.className = "pl2-beam";
    const wheel = document.createElement("div");
    wheel.className = "pl2-wheel";
    wheel.innerHTML = `<div class="pl2-wheel-inner"></div>`;
    beam.appendChild(wheel);
    stage.appendChild(beam);

    // V 形绳子（CSS 用两条线模拟）
    const ropeL = document.createElement("div");
    ropeL.className = "pl2-rope pl2-rope--left";
    const ropeR = document.createElement("div");
    ropeR.className = "pl2-rope pl2-rope--right";
    stage.appendChild(ropeL);
    stage.appendChild(ropeR);

    // 左侧重物（固定）
    const cargoEl = document.createElement("div");
    cargoEl.className = "pl2-bucket pl2-bucket--cargo";
    cargoEl.innerHTML = `<span class="pl2-w">${this.cargoW}</span><small>公斤</small>`;
    stage.appendChild(cargoEl);

    // 右侧待选位置（先显示问号，选对后挂上）
    const rightSlot = document.createElement("div");
    rightSlot.className = "pl2-bucket pl2-bucket--right pl2-bucket--empty";
    rightSlot.id = "pl2-right";
    rightSlot.innerHTML = `<span class="pl2-w">?</span><small>挂哪个？</small>`;
    stage.appendChild(rightSlot);

    wrap.appendChild(stage);

    // 平衡提示（作答后展示）
    const note = document.createElement("div");
    note.className = "pl2-note";
    note.id = "pl2-note";
    note.textContent = `${this.cargoW} 公斤 = ${this.cargoW} 公斤，两边一样重就稳住啦～`;
    wrap.appendChild(note);

    // 选项
    const opts = document.createElement("div");
    opts.className = "pl2-opts";
    for (const v of this.options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pl2-opt";
      b.innerHTML = `<span class="pl2-opt-num">${v}</span><span class="pl2-opt-unit">公斤</span>`;
      b.addEventListener("click", () => this.choose(v, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(v: number, btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    const ok = v === this.answer;
    const right = this.root.querySelector(
      "#pl2-right",
    ) as HTMLDivElement | null;
    if (right) {
      right.classList.remove("pl2-bucket--empty");
      right.innerHTML = `<span class="pl2-w">${v}</span><small>公斤</small>`;
      // 演示平衡/倾斜
      if (ok) {
        right.classList.add("pl2-bucket--balanced");
      } else {
        // 选错：重的一边下沉
        if (v > this.answer) right.classList.add("pl2-bucket--heavy");
        else right.classList.add("pl2-bucket--light");
      }
    }
    if (ok) {
      btn.classList.add("pl2-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1200);
    } else {
      btn.classList.add("pl2-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".pl2-opt--wrong")
          .forEach((el) => el.classList.remove("pl2-opt--wrong"));
        // 复位右侧桶
        if (right) {
          right.classList.remove(
            "pl2-bucket--balanced",
            "pl2-bucket--heavy",
            "pl2-bucket--light",
          );
          right.classList.add("pl2-bucket--empty");
          right.innerHTML = `<span class="pl2-w">?</span><small>挂哪个？</small>`;
        }
      }, 950);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("pl2-style")) return;
    const st = document.createElement("style");
    st.id = "pl2-style";
    st.textContent = PL2_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function PL2_CSS(theme: string): string {
  return `
.pl2-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;}
.pl2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;max-width:440px;}
.pl2-task b{color:${theme};}
.pl2-stage{position:relative;width:100%;max-width:420px;height:300px;}
.pl2-beam{position:absolute;top:6px;left:50%;transform:translateX(-50%);width:78%;height:14px;background:linear-gradient(180deg,#8d6e63,#5d4037);border-radius:6px;box-shadow:var(--shadow);z-index:3;}
.pl2-beam::before,.pl2-beam::after{content:"";position:absolute;top:-10px;width:14px;height:24px;background:#5d4037;border-radius:3px;}
.pl2-beam::before{left:-4px;}.pl2-beam::after{right:-4px;}
.pl2-wheel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff6,${theme} 60%,color-mix(in srgb,${theme} 60%,#000));box-shadow:inset 0 -3px 6px rgba(0,0,0,.25),0 3px 6px rgba(0,0,0,.25);animation:pl2-spin 6s linear infinite;}
.pl2-wheel-inner{position:absolute;inset:14px;border-radius:50%;background:rgba(255,255,255,.5);box-shadow:inset 0 0 0 3px rgba(0,0,0,.12);}
@keyframes pl2-spin{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}
.pl2-rope{position:absolute;top:28px;width:3px;height:200px;background:repeating-linear-gradient(180deg,#6d4c41 0 6px,transparent 6px 9px);transform-origin:top center;z-index:2;}
.pl2-rope--left{left:50%;transform:translateX(-50%) rotate(14deg);}
.pl2-rope--right{left:50%;transform:translateX(-50%) rotate(-14deg);}
.pl2-bucket{position:absolute;bottom:24px;width:84px;display:flex;flex-direction:column;align-items:center;gap:1px;z-index:4;transition:transform .5s ease;}
.pl2-bucket--cargo{left:50%;transform:translateX(-50%) translateX(-58px);}
.pl2-bucket--right{left:50%;transform:translateX(-50%) translateX(58px);}
.pl2-w{font-size:1.6rem;font-weight:900;color:#fff;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,.3);}
.pl2-bucket small{font-size:.65rem;color:#fff;font-weight:700;opacity:.9;}
.pl2-bucket::before{content:"";display:block;width:84px;height:62px;border-radius:10px 10px 26px 26px;background:linear-gradient(180deg,#7e57c2,#512da8);box-shadow:inset 0 -6px 0 rgba(0,0,0,.2),inset 0 3px 0 rgba(255,255,255,.3),0 4px 8px rgba(0,0,0,.2);display:flex;}
.pl2-bucket--cargo::before{background:linear-gradient(180deg,#ef5350,#c62828);}
.pl2-bucket--empty::before{background:linear-gradient(180deg,#bdbdbd,#757575);}
.pl2-bucket--right{display:flex;flex-direction:column;align-items:center;}
.pl2-bucket .pl2-w{margin-top:-46px;position:relative;z-index:2;}
.pl2-bucket small{margin-top:2px;position:relative;z-index:2;}
.pl2-bucket--balanced{transform:translateX(-50%) translateX(58px) translateY(0);animation:pl2-steady .6s ease;}
@keyframes pl2-steady{0%{transform:translateX(-50%) translateX(58px) translateY(-6px)}50%{transform:translateX(-50%) translateX(58px) translateY(2px)}100%{transform:translateX(-50%) translateX(58px) translateY(0)}}
.pl2-bucket--heavy{transform:translateX(-50%) translateX(58px) translateY(34px);}
.pl2-bucket--light{transform:translateX(-50%) translateX(58px) translateY(-30px);}
.pl2-note{font-size:.88rem;color:var(--ink-soft);font-weight:700;text-align:center;background:#fff;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);max-width:380px;text-align:center;}
.pl2-opts{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.pl2-opt{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:84px;padding:12px 16px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#f0f0f5);box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s ease,background .2s ease;}
.pl2-opt-num{font-size:1.8rem;font-weight:900;color:${theme};line-height:1;}
.pl2-opt-unit{font-size:.7rem;font-weight:700;color:var(--ink-soft);}
.pl2-opt:active{transform:scale(.95);}
.pl2-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:pl2-yes .4s ease;}
@keyframes pl2-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.pl2-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:pl2-no .3s ease;}
@keyframes pl2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.pl2-opt{min-width:70px;padding:10px;}.pl2-stage{height:270px;}}
`;
}

export function create(): PulleyLiftGame {
  return new PulleyLiftGame();
}
