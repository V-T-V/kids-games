/* 等式填空 Equation —— 在等式中填入运算符或数字，让等式成立。
   独特点：逆向思维——不是计算结果，而是让等式平衡（区别于 farm-math 正向计算）。
   巧思：填对等式两边亮起天平图标；难度=加减/乘除。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

interface Eq {
  text: string;
  ops: string[];
  answer: string;
}

function genEquation(diff: string): Eq {
  // 生成 "? op ?" 形式，问孩子选哪个运算符使等式成立
  const a = randInt(1, 6);
  const b = randInt(1, 6);
  const ops = diff === "hard" ? ["+", "-", "×"] : ["+", "-"];
  const op = shuffle(ops)[0]!;
  let result: number;
  if (op === "+") result = a + b;
  else if (op === "-") {
    const [x, y] = a >= b ? [a, b] : [b, a];
    result = x - y;
    return mk(x, y, op, result, ops);
  } else result = a * b;
  return mk(a, b, op, result, ops);
}

function mk(
  a: number,
  b: number,
  op: string,
  result: number,
  ops: string[],
): Eq {
  const opSym: Record<string, string> = { "+": "➕", "-": "➖", "×": "✖️" };
  const choices = shuffle([
    ...new Set([op, ...ops.filter((o) => o !== op).slice(0, 2)]),
  ]);
  return {
    text: `${a}  ?  ${b}  =  ${result}`,
    ops: choices.map((o) => opSym[o]!),
    answer: opSym[op]!,
  };
}

export class EquationGame extends BaseGame {
  constructor() {
    super("equation");
  }
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    const eq = genEquation(this.difficulty);

    const wrap = document.createElement("div");
    wrap.className = "eq-wrap";
    const task = document.createElement("div");
    task.className = "eq-task";
    task.textContent = `选一个符号，让等式成立～`;
    wrap.appendChild(task);

    const formula = document.createElement("div");
    formula.className = "eq-formula";
    formula.textContent = eq.text;
    wrap.appendChild(formula);

    const opts = document.createElement("div");
    opts.className = "eq-opts";
    eq.ops.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "eq-opt";
      b.textContent = o;
      b.addEventListener("click", () => this.choose(o, eq.answer, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(o: string, answer: string, btn: HTMLButtonElement): void {
    if (o === answer) {
      sfxPop();
      btn.classList.add("eq-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("eq-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("eq-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "算算两边是不是一样多～",
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
    if (document.getElementById("eq-style")) return;
    const st = document.createElement("style");
    st.id = "eq-style";
    st.textContent = EQ_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function EQ_CSS(theme: string): string {
  return `
.eq-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(440px,100%);}
.eq-task{font-size:1.1rem;font-weight:800;}
.eq-formula{font-size:2.4rem;font-weight:900;background:#fff;padding:20px 30px;border-radius:20px;box-shadow:var(--shadow);color:${theme};}
.eq-opts{display:flex;gap:16px;}
.eq-opt{width:80px;height:80px;font-size:2rem;border-radius:18px;background:#fff;box-shadow:var(--shadow);}
.eq-opt:active{transform:scale(.92);}
.eq-opt--done{background:#d4f4dd;animation:eq-pop .4s ease;}
.eq-opt--wrong{animation:eq-shake .4s ease;}
@keyframes eq-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes eq-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): EquationGame {
  return new EquationGame();
}
