/* 温度计认读 Thermometer —— 红色液柱停在某个刻度，读出温度或比哪个更热。
   巧思：CSS 温度计（球形底 + 管 + 红色液柱 + 刻度）；难度 = 刻度范围。
   通关 = 答对目标题数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

export class ThermometerGame extends BaseGame {
  constructor() {
    super("thermometer");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  /** 模式：'read' 读温度 / 'hotter' 比哪个更热（双温度计） */
  private mode: "read" | "hotter" = "read";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  /** 根据难度返回温度范围 [min, max] */
  private range(): [number, number] {
    if (this.difficulty === "easy") return [0, 10];
    if (this.difficulty === "medium") return [0, 20];
    return [10, 40];
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.mode = Math.random() < 0.4 ? "hotter" : "read";
    const [lo, hi] = this.range();

    const wrap = document.createElement("div");
    wrap.className = "th-wrap";

    const task = document.createElement("div");
    task.className = "th-task";
    task.textContent =
      this.mode === "read"
        ? `读出温度，点对的数字（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`
        : `哪个更热？点更热的那支（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "th-stage";

    let answer: number;
    let tempA = 0;
    let tempB = 0;
    if (this.mode === "read") {
      tempA = randInt(lo, hi);
      answer = tempA;
      stage.appendChild(this.buildThermo(tempA, lo, hi, "A"));
    } else {
      tempA = randInt(lo, hi);
      do {
        tempB = randInt(lo, hi);
      } while (tempB === tempA);
      answer = Math.max(tempA, tempB);
      const duo = document.createElement("div");
      duo.className = "th-duo";
      duo.appendChild(this.buildThermo(tempA, lo, hi, "A"));
      duo.appendChild(this.buildThermo(tempB, lo, hi, "B"));
      stage.appendChild(duo);
    }
    wrap.appendChild(stage);

    // 选项
    const opts = document.createElement("div");
    opts.className = "th-opts";
    let choices: number[];
    if (this.mode === "read") {
      const set = new Set<number>([answer]);
      while (set.size < 4) {
        const d = answer + sample([-3, -2, -1, 1, 2, 3]);
        if (d >= lo && d <= hi) set.add(d);
      }
      choices = shuffle([...set]);
    } else {
      choices = [tempA, tempB];
    }
    choices.forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "th-choice";
      b.textContent = this.mode === "read" ? `${v} 度` : `${v} 度`;
      b.dataset.val = String(v);
      b.addEventListener("click", () => this.choose(v, answer, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  /** 构建一支温度计 DOM */
  private buildThermo(
    temp: number,
    lo: number,
    hi: number,
    key: string,
  ): HTMLDivElement {
    const box = document.createElement("div");
    box.className = "th-meter";
    box.dataset.key = key;
    const ratio = (temp - lo) / Math.max(1, hi - lo);
    const fillPct = Math.max(6, Math.min(100, 12 + ratio * 82)); // 液柱最低留点底色

    // 刻度
    const scale = document.createElement("div");
    scale.className = "th-scale";
    const ticks = this.difficulty === "hard" ? 4 : 3;
    for (let i = 0; i <= ticks; i++) {
      const t = document.createElement("div");
      t.className = "th-tick";
      const val = Math.round(lo + ((hi - lo) * i) / ticks);
      t.textContent = String(val);
      scale.appendChild(t);
    }
    box.appendChild(scale);

    const tube = document.createElement("div");
    tube.className = "th-tube";
    const fill = document.createElement("div");
    fill.className = "th-fill";
    fill.style.height = `${fillPct}%`;
    tube.appendChild(fill);
    const bulb = document.createElement("div");
    bulb.className = "th-bulb";
    tube.appendChild(bulb);
    box.appendChild(tube);

    return box;
  }

  private choose(v: number, answer: number, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (v === answer) {
      this.locked = true;
      sfxPop();
      btn.classList.add("th-choice--done");
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
      btn.classList.add("th-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("th-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看红色柱子升到了哪个刻度～",
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
    if (document.getElementById("th-style")) return;
    const st = document.createElement("style");
    st.id = "th-style";
    st.textContent = TH_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function TH_CSS(theme: string): string {
  return `
.th-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(440px,100%);}
.th-task{font-size:1.18rem;font-weight:800;text-align:center;}
.th-stage{display:flex;align-items:flex-end;justify-content:center;gap:40px;min-height:280px;}
.th-duo{display:flex;gap:48px;align-items:flex-end;}
.th-meter{display:flex;align-items:flex-end;gap:6px;height:280px;}
.th-scale{display:flex;flex-direction:column-reverse;justify-content:space-between;height:240px;font-size:.8rem;font-weight:700;color:var(--ink-soft);padding-bottom:32px;}
.th-tick{line-height:1;}
.th-tube{position:relative;width:34px;height:240px;background:#f1f1f4;border-radius:18px;border:3px solid var(--ink);box-shadow:var(--shadow);overflow:visible;}
.th-fill{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,#ff8a5c,${theme});border-radius:0 0 14px 14px;transition:height .6s cubic-bezier(.34,1.56,.64,1);box-shadow:inset 2px 0 0 rgba(255,255,255,.35);}
.th-bulb{position:absolute;left:50%;bottom:-22px;width:52px;height:52px;transform:translateX(-50%);background:radial-gradient(circle at 35% 30%,#ff9f6c,${theme});border-radius:50%;border:3px solid var(--ink);box-shadow:var(--shadow);}
.th-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.th-choice{min-width:88px;min-height:60px;padding:0 18px;font-size:1.3rem;font-weight:800;border-radius:18px;background:#fff;color:var(--ink);box-shadow:var(--shadow);transition:transform .1s ease;}
.th-choice:active{transform:scale(.94);}
.th-choice--done{background:${theme};color:#fff;animation:th-pop .4s ease;}
.th-choice--wrong{animation:th-shake .4s ease;}
@keyframes th-pop{0%{transform:scale(.7)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes th-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ThermometerGame {
  return new ThermometerGame();
}
