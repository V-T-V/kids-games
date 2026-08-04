/* 气球算术 Balloon Math —— 屏幕上飘着写算式的气球，找出所有等于目标数的气球戳掉。
   独特点：气球缓慢上飘，每只气球上都有一道小算式（如 2+1），孩子要找出结果等于
   目标数（如 3）的所有气球。难度=气球数与算式复杂度。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

interface Balloon {
  expr: string;
  value: number;
  correct: boolean;
  el: HTMLButtonElement;
}

/** 生成若干个值为 value 的算式字符串。 */
function genExprs(value: number, count: number, maxN: number): string[] {
  const out = new Set<string>();
  let guard = 0;
  while (out.size < count && guard < 200) {
    guard++;
    const op = sample(["+", "-", "+0"] as const);
    if (op === "+0") {
      out.add(`${value}+0`);
      continue;
    }
    const a = randInt(0, Math.min(maxN, value));
    if (op === "+") {
      const b = value - a;
      if (b >= 0) out.add(`${a}+${b}`);
    } else {
      // 减法：从 value + k 中减去 k
      const k = randInt(0, maxN - value);
      out.add(`${value + k}-${k}`);
    }
  }
  return [...out];
}

/** 生成结果不等于 value 的算式（作为干扰）。 */
function genWrongExprs(value: number, count: number, maxN: number): string[] {
  const out = new Set<string>();
  let guard = 0;
  while (out.size < count && guard < 300) {
    guard++;
    const a = randInt(0, maxN);
    const b = randInt(0, maxN);
    const r = a + b;
    if (r === value) continue;
    out.add(`${a}+${b}`);
  }
  return [...out];
}

export class BalloonMathGame extends BaseGame {
  constructor() {
    super("balloon-math");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private remaining = 0;
  private currentTarget = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private balloonCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }
  /** 目标值的最大值，决定算式复杂度。 */
  private maxNumber(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 8
        : 10;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const maxN = this.maxNumber();
    // 目标值，确保至少为 2（这样能多产生几只正确气球）
    const target = randInt(2, Math.max(2, maxN - 1));
    this.currentTarget = target;

    // 生成气球：保证至少 1 只正确，最多不超过气球总数一半
    const total = this.balloonCount();
    const correctCount = randInt(1, Math.max(1, Math.floor(total / 2)));
    const correctExprs = shuffle(genExprs(target, correctCount, maxN));
    const actualCorrect = correctExprs.length;
    const wrongCount = Math.max(1, total - actualCorrect);
    const wrongExprs = shuffle(genWrongExprs(target, wrongCount, maxN)).slice(
      0,
      wrongCount,
    );
    // 兜底：如果干扰数不够，补几个 +0 之外的结果不同的算式
    while (
      correctExprs.length + wrongExprs.length < total &&
      wrongExprs.length < 30
    ) {
      const a = randInt(0, maxN);
      const b = randInt(0, maxN);
      if (a + b !== target) {
        const e = `${a}+${b}`;
        if (!wrongExprs.includes(e)) wrongExprs.push(e);
      }
    }
    this.remaining = actualCorrect;

    const wrap = document.createElement("div");
    wrap.className = "bm2-wrap";

    const task = document.createElement("div");
    task.className = "bm2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 找出等于 <b class="bm2-target">${target}</b> 的气球`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "bm2-hint";
    hint.innerHTML = `还剩 <b id="bm2-left">${this.remaining}</b> 个没找到`;
    wrap.appendChild(hint);

    const sky = document.createElement("div");
    sky.className = "bm2-sky";

    const list: Balloon[] = [];
    correctExprs.forEach((expr) =>
      list.push({ expr, value: target, correct: true, el: null as never }),
    );
    wrongExprs.forEach((expr) => {
      // 解析值（仅用于显示，不参与判定）
      const [aStr, bStr] = expr.split("+");
      const v = (Number(aStr) || 0) + (Number(bStr) || 0);
      list.push({ expr, value: v, correct: false, el: null as never });
    });

    shuffle(list).forEach((b, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bm2-balloon";
      btn.style.setProperty("--bm2-color", sample(BALLOON_COLORS));
      btn.style.setProperty("--bm2-left", `${8 + ((i * 13) % 84)}%`);
      btn.style.setProperty("--bm2-dur", `${7 + ((i * 7) % 6)}s`);
      btn.style.setProperty("--bm2-delay", `${(i % 4) * -2}s`);
      btn.innerHTML = `<span class="bm2-expr">${b.expr}</span>`;
      btn.addEventListener("click", () => this.pop(btn, b));
      b.el = btn;
      sky.appendChild(btn);
    });
    wrap.appendChild(sky);

    this.root.appendChild(wrap);
  }

  private pop(btn: HTMLButtonElement, b: Balloon): void {
    if (btn.classList.contains("bm2-balloon--popped")) return;
    if (b.correct) {
      btn.classList.add("bm2-balloon--popped");
      btn.disabled = true;
      sfxPop();
      this.remaining -= 1;
      this.resetWrongStreak();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      const left = this.root.querySelector("#bm2-left");
      if (left) left.textContent = String(this.remaining);
      if (this.remaining <= 0) {
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 700);
      }
    } else {
      btn.classList.add("bm2-balloon--shake");
      this.trackTimeout(() => btn.classList.remove("bm2-balloon--shake"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `算一算气球上的算式，等于 ${this.currentTarget} 才能戳掉哦～`,
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
    if (document.getElementById("bm2-style")) return;
    const st = document.createElement("style");
    st.id = "bm2-style";
    st.textContent = BM2_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

const BALLOON_COLORS = [
  "#ff6b9d",
  "#4d96ff",
  "#6bcf7f",
  "#ffd93d",
  "#a55eea",
  "#ff9f43",
];

function BM2_CSS(theme: string): string {
  return `
.bm2-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;width:min(560px,100%);}
.bm2-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.bm2-target{color:${theme};font-size:1.4rem;}
.bm2-hint{font-size:.95rem;font-weight:700;color:var(--ink);opacity:.85;}
.bm2-sky{position:relative;width:100%;height:60vh;min-height:380px;max-height:520px;overflow:hidden;border-radius:24px;background:linear-gradient(180deg,#bfeaff 0%,#e8f7ff 70%,#fff 100%);box-shadow:var(--shadow);}
.bm2-balloon{
  position:absolute;bottom:-130px;left:var(--bm2-left,10%);
  width:84px;height:104px;border:none;cursor:pointer;
  background:radial-gradient(circle at 32% 28%,#fff9,var(--bm2-color,${theme}));
  border-radius:50% 50% 48% 48%;
  box-shadow:inset 0 -6px 10px rgba(0,0,0,.18),0 6px 10px rgba(0,0,0,.15);
  display:flex;align-items:center;justify-content:center;
  animation:bm2-float var(--bm2-dur,9s) linear var(--bm2-delay,0s) infinite;
  transition:transform .12s ease;
}
.bm2-balloon:active{transform:scale(.92);}
.bm2-balloon::after{content:"";position:absolute;bottom:-26px;left:50%;width:2px;height:26px;background:rgba(120,120,120,.6);transform:translateX(-50%);}
.bm2-balloon::before{content:"";position:absolute;bottom:-34px;left:50%;width:10px;height:8px;background:var(--bm2-color,${theme});transform:translateX(-50%);clip-path:polygon(50% 0,100% 100%,0 100%);}
.bm2-expr{font-size:1.15rem;font-weight:900;color:#fff;text-shadow:0 2px 3px rgba(0,0,0,.35);}
.bm2-balloon--popped{animation:bm2-pop .45s ease forwards;pointer-events:none;}
.bm2-balloon--shake{animation:bm2-shake .5s ease;}
@keyframes bm2-float{0%{transform:translateY(0) translateX(0)}50%{transform:translateY(-50vh) translateX(10px)}100%{transform:translateY(-100vh) translateX(-10px)}}
@keyframes bm2-pop{0%{transform:scale(1)}60%{transform:scale(1.35);opacity:.4}100%{transform:scale(.2);opacity:0}}
@keyframes bm2-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px) rotate(-6deg)}60%{transform:translateX(8px) rotate(6deg)}}
@media (max-width:380px){.bm2-balloon{width:68px;height:86px;}.bm2-expr{font-size:.95rem;}}
`;
}

export function create(): BalloonMathGame {
  return new BalloonMathGame();
}
