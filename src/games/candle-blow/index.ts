/* 吹蜡烛 Candle Blow —— 蛋糕上有若干蜡烛，题目要求"吹灭 3 根"或"吹灭偶数根"，
   孩子点击对应数量的蜡烛吹灭，吹够且只吹这么多即过关。
   独特点：计数 + 规则理解（偶数/奇数/指定数）。点"完成"按钮校验。
   视觉：蛋糕 + 火焰摇曳的蜡烛。难度=蜡烛数/规则。
   通关=吹对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

type Rule = { kind: "exact"; n: number } | { kind: "even" } | { kind: "odd" };

export class CandleBlowGame extends BaseGame {
  constructor() {
    super("candle-blow");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private rule: Rule = { kind: "exact", n: 3 };
  /** 全部蜡烛总数 */
  private candleN = 5;
  /** 已吹灭数 */
  private blown = 0;
  /** 蜡烛 DOM 列表，记录是否已灭 */
  private candles: HTMLButtonElement[] = [];
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

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.blown = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    /* 难度：蜡烛数 + 规则类型 */
    this.candleN =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 9;

    /* 规则生成：保证有解（蜡烛数 >= 目标数） */
    if (this.difficulty === "easy") {
      /* 简单：固定数量 */
      const n = randInt(2, Math.min(4, this.candleN));
      this.rule = { kind: "exact", n };
    } else if (this.difficulty === "medium") {
      /* 中等：偶数 / 奇数 */
      this.rule = Math.random() < 0.5 ? { kind: "even" } : { kind: "odd" };
    } else {
      /* 困难：随机混合 */
      const r = randInt(0, 2);
      if (r === 0) {
        this.rule = { kind: "exact", n: randInt(3, this.candleN - 1) };
      } else if (r === 1) {
        this.rule = { kind: "even" };
      } else {
        this.rule = { kind: "odd" };
      }
    }

    const wrap = document.createElement("div");
    wrap.className = "cb2-wrap";

    const task = document.createElement("div");
    task.className = "cb2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · <span id="cb2-rule">${this.ruleText()}</span>`;
    wrap.appendChild(task);

    /* 蛋糕 + 蜡烛 */
    const cake = document.createElement("div");
    cake.className = "cb2-cake";
    const candleRow = document.createElement("div");
    candleRow.className = "cb2-candles";
    this.candles = [];
    for (let i = 0; i < this.candleN; i++) {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "cb2-candle";
      c.setAttribute("aria-label", `蜡烛 ${i + 1}`);
      c.innerHTML = `<span class="cb2-flame"></span><span class="cb2-stick"></span>`;
      c.addEventListener("click", () => this.blow(c));
      candleRow.appendChild(c);
      this.candles.push(c);
    }
    cake.appendChild(candleRow);
    const body = document.createElement("div");
    body.className = "cb2-cake-body";
    cake.appendChild(body);
    wrap.appendChild(cake);

    /* 计数 + 完成按钮 */
    const ctrl = document.createElement("div");
    ctrl.className = "cb2-ctrl";
    ctrl.innerHTML = `已吹灭 <b id="cb2-blown">0</b> 根`;
    const done = document.createElement("button");
    done.type = "button";
    done.className = "cb2-done";
    done.textContent = "✅ 完成啦";
    done.addEventListener("click", () => this.check());
    ctrl.appendChild(done);
    wrap.appendChild(ctrl);

    this.root.appendChild(wrap);
  }

  private ruleText(): string {
    const r = this.rule;
    if (r.kind === "exact") return `吹灭 <b>${r.n}</b> 根蜡烛`;
    if (r.kind === "even") return `吹灭 <b>偶数</b> 根蜡烛（2、4、6…）`;
    return `吹灭 <b>奇数</b> 根蜡烛（1、3、5…）`;
  }

  private blow(c: HTMLButtonElement): void {
    if (this.locked) return;
    if (c.classList.contains("cb2-candle--out")) return;
    c.classList.add("cb2-candle--out");
    sfxPop();
    this.blown += 1;
    const b = this.root.querySelector("#cb2-blown");
    if (b) b.textContent = String(this.blown);
  }

  private check(): void {
    if (this.locked) return;
    this.locked = true;
    const ok = this.isCorrect(this.blown);
    if (ok) {
      const done = this.root.querySelector(
        ".cb2-done",
      ) as HTMLButtonElement | null;
      done?.classList.add("cb2-done--right");
      const r = done?.getBoundingClientRect();
      this.onCorrect(
        r ? r.left + r.width / 2 : window.innerWidth / 2,
        r ? r.top + r.height / 2 : window.innerHeight / 2,
      );
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      const done = this.root.querySelector(
        ".cb2-done",
      ) as HTMLButtonElement | null;
      done?.classList.add("cb2-done--wrong");
      this.trackTimeout(() => done?.classList.remove("cb2-done--wrong"), 500);
      this.onWrong();
      /* 允许继续修正 */
      this.locked = false;
    }
  }

  private isCorrect(n: number): boolean {
    const r = this.rule;
    if (r.kind === "exact") return n === r.n;
    if (r.kind === "even") return n > 0 && n % 2 === 0;
    return n > 0 && n % 2 === 1;
  }

  private injectStyle(): void {
    if (document.getElementById("cb2-style")) return;
    const st = document.createElement("style");
    st.id = "cb2-style";
    st.textContent = CB2_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function CB2_CSS(theme: string): string {
  return `
.cb2-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(560px,100%);}
.cb2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.cb2-cake{display:flex;flex-direction:column;align-items:center;gap:0;}
.cb2-candles{display:flex;justify-content:center;align-items:flex-end;gap:14px;flex-wrap:wrap;padding:0 10px;}
.cb2-candle{position:relative;width:40px;height:80px;border:none;background:transparent;cursor:pointer;padding:0;display:flex;justify-content:center;}
.cb2-stick{position:absolute;left:0;right:0;bottom:0;height:60px;background:repeating-linear-gradient(180deg,#fff 0 8px,#ffe0e0 8px 16px);border-radius:3px;box-shadow:inset -2px 0 3px rgba(0,0,0,.15);}
.cb2-flame{position:absolute;left:50%;bottom:60px;width:14px;height:22px;transform:translateX(-50%);background:radial-gradient(ellipse at 50% 70%,#fff,#ffd93d 40%,#ff9f43 80%);border-radius:50% 50% 50% 50%/70% 70% 40% 40%;box-shadow:0 0 12px ${theme};animation:cb2-flick .3s ease-in-out infinite alternate;transform-origin:50% 100%;}
@keyframes cb2-flick{0%{transform:translateX(-50%) scale(1) rotate(-3deg);}100%{transform:translateX(-50%) scale(1.1) rotate(3deg);}}
.cb2-candle--out{opacity:.7;}
.cb2-candle--out .cb2-flame{opacity:0;transform:translateX(-50%) scale(0);animation:none;}
.cb2-candle--out .cb2-stick{filter:grayscale(.5);}
.cb2-cake-body{width:320px;max-width:90vw;height:90px;background:linear-gradient(180deg,#fff5e0,#ffd9a8 60%,#e8b878);border-radius:14px 14px 30px 30px;box-shadow:var(--shadow);position:relative;}
.cb2-cake-body::before{content:"";position:absolute;top:14px;left:0;right:0;height:18px;background:repeating-linear-gradient(90deg,#ff6b9d 0 20px,#fff 20px 40px);border-radius:0 0 12px 12px;opacity:.7;}
.cb2-ctrl{display:flex;align-items:center;gap:18px;font-size:1.2rem;font-weight:800;}
.cb2-done{font-size:1.2rem;font-weight:800;padding:14px 28px;border:none;border-radius:999px;background:linear-gradient(135deg,#6bcf7f,#4ed976);color:#fff;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s ease;}
.cb2-done:active{transform:scale(.94);}
.cb2-done--right{background:linear-gradient(135deg,#4ed976,#6bcf7f);}
.cb2-done--wrong{background:linear-gradient(135deg,#ff6348,#e74c3c);animation:cb2-shake .3s ease;}
@keyframes cb2-shake{25%{transform:translateX(-5px);}75%{transform:translateX(5px);}}
@media (max-width:380px){.cb2-candle{height:70px;}.cb2-stick{height:52px;}.cb2-flame{bottom:52px;}.cb2-cake-body{height:80px;}}
`;
}

export function create(): CandleBlowGame {
  return new CandleBlowGame();
}
