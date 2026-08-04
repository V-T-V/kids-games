/* 字母快打 Speed-Typing —— 屏幕显示一个字母，孩子按键盘或点屏幕按钮。
   独特点：限时按键反应，训练字母识别 + 手眼/手耳协调。
   视觉：超大字母 + 倒计时进度环 + 字母键盘按钮。难度=字母范围/时限/目标。
   通关=限时内按对目标轮数。用 RAF 驱动倒计时，unmount 必须 cancelAnimationFrame。
   前缀 sp2- 避免冲突。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByScore } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

const ENCOURAGE = ["打字真快！", "再快点试试～", "认得真准！", "差一点点！"];

export class SpeedTypingGame extends BaseGame {
  constructor() {
    super("speed-typing");
  }

  private raf = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private hits = 0;
  private target = 0;
  private timeLimit = 0;
  private roundEndAt = 0;
  private current = "";
  private pool: string[] = [];
  private locked = true;
  private onKey: ((e: KeyboardEvent) => void) | null = null;
  private ringEl: HTMLElement | null = null;
  private bigEl: HTMLElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 1 : 2;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.onKey) {
      window.removeEventListener("keydown", this.onKey);
      this.onKey = null;
    }
  }

  /** 字母范围：easy 前 8 个，medium 前 16 个，hard 全 26 */
  private makePool(): string[] {
    const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const n =
      this.difficulty === "easy" ? 8 : this.difficulty === "medium" ? 16 : 26;
    return all.slice(0, n)!;
  }

  private startRound(): void {
    this.pool = this.makePool();
    this.hits = 0;
    this.target =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 10;
    this.timeLimit =
      this.difficulty === "easy" ? 20 : this.difficulty === "medium" ? 22 : 28;
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "sp2-wrap";

    const task = document.createElement("div");
    task.className = "sp2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · ${this.timeLimit} 秒内按对 <b>${this.target}</b> 个字母`;
    wrap.appendChild(task);

    /* 得分行 */
    const scoreRow = document.createElement("div");
    scoreRow.className = "sp2-score";
    scoreRow.innerHTML = `已按对 <b id="sp2-hits">0</b> / ${this.target}`;
    wrap.appendChild(scoreRow);

    /* 大字母 + 倒计时环 */
    const stage = document.createElement("div");
    stage.className = "sp2-stage";
    const ring = document.createElement("div");
    ring.className = "sp2-ring";
    ring.innerHTML = `<svg viewBox="0 0 120 120"><circle class="sp2-ring-bg" cx="60" cy="60" r="52"/><circle class="sp2-ring-fg" id="sp2-ring-fg" cx="60" cy="60" r="52"/></svg>`;
    const big = document.createElement("div");
    big.className = "sp2-big";
    big.id = "sp2-big";
    ring.appendChild(big);
    stage.appendChild(ring);
    wrap.appendChild(stage);

    /* 字母按钮键盘 */
    const kb = document.createElement("div");
    kb.className = "sp2-kb";
    this.pool.forEach((ch) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sp2-key";
      b.textContent = ch;
      b.dataset.ch = ch;
      b.addEventListener("click", () => this.input(ch));
      kb.appendChild(b);
    });
    wrap.appendChild(kb);

    const hint = document.createElement("div");
    hint.className = "sp2-hint";
    hint.textContent = "按键盘字母键，或点下面的字母按钮";
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
    this.ringEl = this.root.querySelector<HTMLElement>("#sp2-ring-fg");
    this.bigEl = this.root.querySelector<HTMLElement>("#sp2-big");

    /* 键盘监听 */
    this.onKey = (e: KeyboardEvent) => {
      const ch = e.key.toUpperCase();
      if (this.pool.includes(ch)) this.input(ch);
    };
    window.addEventListener("keydown", this.onKey);

    this.nextLetter();
    this.roundEndAt = Date.now() + this.timeLimit * 1000;
    this.tick();
  }

  private nextLetter(): void {
    /* 避免连续同一个字母 */
    let next = sample(this.pool);
    if (this.pool.length > 1) {
      let guard = 0;
      while (next === this.current && guard < 8) {
        next = sample(this.pool);
        guard++;
      }
    }
    this.current = next;
    if (this.bigEl) this.bigEl.textContent = next;
  }

  private input(ch: string): void {
    if (this.locked) return;
    const keyBtn = this.root.querySelector<HTMLButtonElement>(
      `.sp2-key[data-ch="${ch}"]`,
    );
    if (ch === this.current) {
      this.hits += 1;
      sfxPop();
      if (this.bigEl) {
        const r = this.bigEl.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      }
      this.resetWrongStreak();
      const hitsEl = this.root.querySelector("#sp2-hits");
      if (hitsEl) hitsEl.textContent = String(this.hits);
      if (keyBtn) {
        keyBtn.classList.add("sp2-key--right");
        this.trackTimeout(() => keyBtn.classList.remove("sp2-key--right"), 250);
      }
      if (this.hits >= this.target) {
        this.endRound(true);
        return;
      }
      this.nextLetter();
    } else {
      if (keyBtn) {
        keyBtn.classList.add("sp2-key--wrong");
        this.trackTimeout(() => keyBtn.classList.remove("sp2-key--wrong"), 300);
      }
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private tick = (): void => {
    const remain = this.roundEndAt - Date.now();
    const ratio = Math.max(0, remain) / (this.timeLimit * 1000);
    if (this.ringEl) {
      const circ = 2 * Math.PI * 52;
      this.ringEl.style.strokeDasharray = `${circ}`;
      this.ringEl.style.strokeDashoffset = `${circ * (1 - ratio)}`;
    }
    if (remain <= 0) {
      this.endRound(false);
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private endRound(success: boolean): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.locked = true;
    if (success) {
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
    }
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal) {
        /* 按本局累计按对数算星 */
        this.finishClear(
          starsByScore(this.hits, [this.target, Math.ceil(this.target * 0.6)]),
        );
      } else {
        this.startRound();
      }
    }, 800);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "⌨️",
      variant: "rest",
      body: `看清楚屏幕上是哪个字母，再按对应的键。 ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("sp2-style")) return;
    const st = document.createElement("style");
    st.id = "sp2-style";
    st.textContent = SP2_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function SP2_CSS(theme: string): string {
  return `
.sp2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.sp2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.sp2-score{font-size:1rem;font-weight:700;color:#555;background:rgba(255,255,255,.6);padding:6px 16px;border-radius:999px;}
.sp2-score b{color:${theme};font-size:1.2rem;}
.sp2-stage{display:flex;align-items:center;justify-content:center;padding:6px;}
.sp2-ring{position:relative;width:220px;height:220px;}
.sp2-ring svg{width:100%;height:100%;transform:rotate(-90deg);}
.sp2-ring-bg{fill:none;stroke:rgba(0,0,0,.1);stroke-width:10;}
.sp2-ring-fg{fill:none;stroke:${theme};stroke-width:10;stroke-linecap:round;transition:stroke-dashoffset .12s linear;filter:drop-shadow(0 0 6px ${theme}88);}
.sp2-big{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:7rem;font-weight:900;color:${theme};font-family:system-ui,sans-serif;text-shadow:0 4px 10px rgba(0,0,0,.15);animation:sp2-pop .2s ease;}
@keyframes sp2-pop{0%{transform:scale(.6);opacity:.4}100%{transform:scale(1);opacity:1}}
.sp2-kb{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;max-width:480px;padding:12px;background:rgba(255,255,255,.6);border-radius:18px;box-shadow:var(--shadow);}
.sp2-key{font-size:1.1rem;font-weight:900;color:#444;background:#fff;border:none;border-radius:10px;padding:10px 0;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.12);transition:transform .1s,box-shadow .1s;}
.sp2-key:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.12);}
.sp2-key--right{background:linear-gradient(180deg,#e0ffe4,#6bcf7f);color:#1a7a30;animation:sp2-flash .25s ease;}
.sp2-key--wrong{background:linear-gradient(180deg,#ffe0d8,#ff6348);color:#a02020;animation:sp2-shake .3s ease;}
@keyframes sp2-flash{0%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes sp2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
.sp2-hint{font-size:.85rem;color:#777;font-weight:600;}
@media (max-width:380px){.sp2-ring{width:170px;height:170px;}.sp2-big{font-size:5rem;}.sp2-kb{grid-template-columns:repeat(7,1fr);}.sp2-key{font-size:.95rem;padding:8px 0;}}
`;
}

export function create(): SpeedTypingGame {
  return new SpeedTypingGame();
}
