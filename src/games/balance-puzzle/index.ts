/* 天平谜题 Balance Puzzle —— 天平两边已有砝码，左边比右边轻 x，
   问"该往哪边加几才能平衡"。给出几个候选（如"左+3""右+1"），选正确的。
   独特点：把"等式平衡"做成直观选择题，低龄用小数字保证心算可行；
   候选保证唯一正确答案。前缀 bpz2-（bpz- 已被 balance-puzzle 自身旧游戏潜在占用）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

interface Option {
  side: "L" | "R";
  add: number;
  label: string;
}

export class BalancePuzzleGame extends BaseGame {
  constructor() {
    super("balance-puzzle");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private leftSum = 0;
  private rightSum = 0;
  private correct!: Option;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 与定时器由基类清理 */
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 生成两边重量，左 != 右，差值 = diff
    const max =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 9;
    this.leftSum = randInt(1, max);
    let r: number;
    do {
      r = randInt(1, max);
    } while (r === this.leftSum);
    this.rightSum = r;
    const diff = Math.abs(this.leftSum - this.rightSum);
    // 正确操作：往轻的一边加 diff
    const lighterSide: "L" | "R" = this.leftSum < this.rightSum ? "L" : "R";
    this.correct = {
      side: lighterSide,
      add: diff,
      label: `${lighterSide === "L" ? "左" : "右"}边 +${diff}`,
    };

    // 生成 3 个干扰：往错边加、加错量
    const opts: Option[] = [{ ...this.correct }];
    const seen = new Set([`${this.correct.side}-${this.correct.add}`]);
    let guard = 0;
    while (opts.length < 4 && guard < 60) {
      guard++;
      const side = Math.random() < 0.5 ? "L" : "R";
      const add = randInt(1, max);
      const key = `${side}-${add}`;
      // 排除也能平衡的其它组合（唯一正确性）
      const newL = side === "L" ? this.leftSum + add : this.leftSum;
      const newR = side === "R" ? this.rightSum + add : this.rightSum;
      if (seen.has(key)) continue;
      if (newL === newR) continue; // 会导致另一个正确答案
      seen.add(key);
      opts.push({
        side,
        add,
        label: `${side === "L" ? "左" : "右"}边 +${add}`,
      });
    }
    // 兜底：若干扰不足 4 个，补不影响的
    while (opts.length < 4) {
      opts.push({ side: "L", add: max + 10, label: `左边 +${max + 10}` });
    }

    const shuffled = shuffle(opts);
    this.render(shuffled);
  }

  private render(opts: Option[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "bpz2-wrap";

    const task = document.createElement("div");
    task.className = "bpz2-task";
    task.innerHTML = `天平<b>不平衡</b>，怎么加砝码让它<b>平衡</b>？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const scale = document.createElement("div");
    scale.className = "bpz2-scale";
    const tilt = this.leftSum > this.rightSum ? -1 : 1;
    scale.innerHTML = `
      <div class="bpz2-beam" style="transform:rotate(${tilt * 7}deg)">
        <div class="bpz2-pan bpz2-pan--l"><span class="bpz2-w">${this.leftSum}</span></div>
        <div class="bpz2-pan bpz2-pan--r"><span class="bpz2-w">${this.rightSum}</span></div>
      </div>
      <div class="bpz2-stand">⚖️</div>
    `;
    wrap.appendChild(scale);

    const hint = document.createElement("div");
    hint.className = "bpz2-hint";
    hint.textContent = this.leftSum > this.rightSum ? "右边轻了" : "左边轻了";
    wrap.appendChild(hint);

    const optsEl = document.createElement("div");
    optsEl.className = "bpz2-opts";
    for (const o of opts) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bpz2-opt";
      b.textContent = o.label;
      b.addEventListener("click", () => this.choose(o, b));
      optsEl.appendChild(b);
    }
    wrap.appendChild(optsEl);
    this.root.appendChild(wrap);
  }

  private choose(o: Option, btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    const ok = o.side === this.correct.side && o.add === this.correct.add;
    if (ok) {
      btn.classList.add("bpz2-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      sfxPop();
      this.trackTimeout(() => {
        this.roundsDone++;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("bpz2-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".bpz2-opt--wrong")
          .forEach((el) => el.classList.remove("bpz2-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("bpz2-style")) return;
    const st = document.createElement("style");
    st.id = "bpz2-style";
    st.textContent = BPZ2_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function BPZ2_CSS(theme: string): string {
  return `
.bpz2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.bpz2-task{font-size:1.05rem;font-weight:800;text-align:center;color:var(--ink);}
.bpz2-task b{color:${theme};}
.bpz2-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.bpz2-scale{position:relative;width:300px;height:160px;margin:6px 0;}
.bpz2-beam{position:absolute;top:30px;left:0;width:100%;height:50px;display:flex;justify-content:space-between;align-items:flex-start;transition:transform .4s ease;transform-origin:center;}
.bpz2-pan{width:80px;height:50px;border-radius:0 0 50px 50px;background:linear-gradient(180deg,#fff,#ffe8cc);border:3px solid ${theme};display:flex;align-items:flex-end;justify-content:center;box-shadow:var(--shadow);}
.bpz2-w{font-size:1.6rem;font-weight:900;color:${theme};padding-bottom:6px;}
.bpz2-stand{position:absolute;bottom:0;left:50%;transform:translateX(-50%);font-size:3.2rem;line-height:1;}
.bpz2-hint{font-size:.95rem;font-weight:800;color:var(--ink-soft);background:#fff;padding:4px 14px;border-radius:999px;box-shadow:var(--shadow);}
.bpz2-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;width:100%;max-width:420px;}
.bpz2-opt{padding:18px 8px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#fff4e6);box-shadow:var(--shadow);cursor:pointer;font-size:1.3rem;font-weight:900;color:var(--ink);transition:transform .12s ease,border-color .2s,background .2s;}
.bpz2-opt:active{transform:scale(.94);}
.bpz2-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:bpz2-yes .4s ease;}
@keyframes bpz2-yes{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
.bpz2-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:bpz2-no .3s ease;}
@keyframes bpz2-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): BalancePuzzleGame {
  return new BalancePuzzleGame();
}
