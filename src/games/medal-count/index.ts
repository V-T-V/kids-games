/* 奖牌数 Medal Count —— 领奖台上摆着金🥇、银🥈、铜🥉若干块（不同数量），
   问"有几块金牌"或"铜牌比银牌多几块"，孩子从数字选项作答。
   独特点：分类计数 + 简单比较（多/少几）。视觉：领奖台（金/银/铜台阶）+ 奖牌 emoji。
   难度=奖牌总数 + 是否含比较题。通关=答对目标轮数。前缀 mdc-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

type Medal = "gold" | "silver" | "bronze";

interface Question {
  text: string;
  answer: number;
}

export class MedalCountGame extends BaseGame {
  constructor() {
    super("medal-count");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private counts: Record<Medal, number> = { gold: 0, silver: 0, bronze: 0 };
  private currentAnswer = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 3 : 4;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  /** 根据难度生成每种奖牌的数量范围。 */
  private ranges(): {
    gold: [number, number];
    silver: [number, number];
    bronze: [number, number];
  } {
    if (this.difficulty === "easy") {
      return { gold: [1, 3], silver: [1, 3], bronze: [1, 3] };
    }
    if (this.difficulty === "medium") {
      return { gold: [2, 4], silver: [1, 4], bronze: [2, 5] };
    }
    return { gold: [2, 5], silver: [2, 5], bronze: [3, 6] };
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const r = this.ranges();
    this.counts = {
      gold: randInt(r.gold[0], r.gold[1]),
      silver: randInt(r.silver[0], r.silver[1]),
      bronze: randInt(r.bronze[0], r.bronze[1]),
    };

    // 生成问题
    const q = this.genQuestion();
    this.currentAnswer = q.answer;

    const wrap = document.createElement("div");
    wrap.className = "mdc-wrap";

    const task = document.createElement("div");
    task.className = "mdc-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · ${q.text}`;
    wrap.appendChild(task);

    // 领奖台
    const stage = document.createElement("div");
    stage.className = "mdc-stage";
    // 银在左、金在中（最高）、铜在右
    const podium: { medal: Medal; emoji: string; h: number; label: string }[] =
      [
        { medal: "silver", emoji: "🥈", h: 80, label: "银" },
        { medal: "gold", emoji: "🥇", h: 120, label: "金" },
        { medal: "bronze", emoji: "🥉", h: 56, label: "铜" },
      ];
    podium.forEach((p) => {
      const stand = document.createElement("div");
      stand.className = `mdc-stand mdc-stand--${p.medal}`;
      stand.style.setProperty("--stand-h", `${p.h}px`);
      // 奖牌堆
      const medalsEl = document.createElement("div");
      medalsEl.className = "mdc-medals";
      for (let i = 0; i < this.counts[p.medal]; i++) {
        const m = document.createElement("span");
        m.className = "mdc-medal-emoji";
        m.textContent = p.emoji;
        m.style.setProperty("--md", `${i * 22}px`);
        medalsEl.appendChild(m);
      }
      stand.appendChild(medalsEl);
      // 台阶
      const step = document.createElement("div");
      step.className = "mdc-step";
      step.innerHTML = `<span class="mdc-step-label">${p.label}牌 ${this.counts[p.medal]}</span>`;
      stand.appendChild(step);
      stage.appendChild(stand);
    });
    wrap.appendChild(stage);

    // 数字选项
    const opts = this.genOptions(this.currentAnswer);
    const choices = document.createElement("div");
    choices.className = "mdc-choices";
    opts.forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mdc-choice";
      b.textContent = String(v);
      b.addEventListener("click", () => this.answer(v, b));
      choices.appendChild(b);
    });
    wrap.appendChild(choices);
    this.root.appendChild(wrap);
  }

  /** 生成问题，保证答案 >= 0 且合理。 */
  private genQuestion(): Question {
    const types: ("count" | "compare")[] =
      this.difficulty === "easy"
        ? ["count"]
        : this.difficulty === "medium"
          ? ["count", "compare"]
          : ["count", "compare", "compare"];
    const t = shuffle(types)[0]!;
    if (t === "count") {
      // 问某一种有几块
      const medalPool: Medal[] = shuffle([
        "gold",
        "silver",
        "bronze",
      ] as Medal[]);
      const m = medalPool[0]!;
      const nameMap: Record<Medal, string> = {
        gold: "金",
        silver: "银",
        bronze: "铜",
      };
      return { text: `<b>${nameMap[m]}牌</b>有几块？`, answer: this.counts[m] };
    }
    // 比较题：A 比 B 多/少几块
    const pairs: [Medal, Medal][] = shuffle([
      ["gold", "silver"],
      ["silver", "bronze"],
      ["bronze", "gold"],
    ] as [Medal, Medal][]);
    for (const [a, b] of pairs) {
      const diff = this.counts[a] - this.counts[b];
      if (diff !== 0) {
        const nameMap: Record<Medal, string> = {
          gold: "金",
          silver: "银",
          bronze: "铜",
        };
        const more = diff > 0;
        return {
          text: `<b>${nameMap[a]}牌</b>比<b>${nameMap[b]}牌</b>${more ? "多" : "少"}几块？`,
          answer: Math.abs(diff),
        };
      }
    }
    // 兜底：所有相等时退回到计数
    const nameMap: Record<Medal, string> = {
      gold: "金",
      silver: "银",
      bronze: "铜",
    };
    return {
      text: `<b>${nameMap.gold}牌</b>有几块？`,
      answer: this.counts.gold,
    };
  }

  /** 生成 4 个数字选项（含正确答案）。 */
  private genOptions(answer: number): number[] {
    const set = new Set<number>([answer]);
    let guard = 0;
    while (set.size < 4 && guard < 100) {
      guard += 1;
      const d = randInt(1, 3);
      const sign = Math.random() < 0.5 ? -1 : 1;
      const v = answer + sign * d;
      if (v >= 0 && v <= 12) set.add(v);
    }
    let fill = answer + 1;
    while (set.size < 4) {
      if (fill >= 0 && fill <= 12) set.add(fill);
      fill += 1;
    }
    return shuffle([...set]);
  }

  private answer(v: number, btn: HTMLButtonElement): void {
    if (this.locked) return;
    this.locked = true;
    if (v === this.currentAnswer) {
      btn.classList.add("mdc-choice--right");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      sfxPop();
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 850);
    } else {
      btn.classList.add("mdc-choice--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        btn.classList.remove("mdc-choice--wrong");
        btn.disabled = true;
        this.locked = false;
      }, 700);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("mdc-style")) return;
    const st = document.createElement("style");
    st.id = "mdc-style";
    st.textContent = MDC_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function MDC_CSS(theme: string): string {
  void theme;
  return `
.mdc-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(520px,100%);}
.mdc-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:12px 24px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.mdc-stage{display:flex;align-items:flex-end;justify-content:center;gap:8px;width:100%;height:240px;padding:18px 12px;background:linear-gradient(180deg,#fff7e0,#ffe5a8);border-radius:20px;box-shadow:var(--shadow);}
.mdc-stand{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;width:90px;}
.mdc-medals{position:relative;height:60px;margin-bottom:4px;display:flex;justify-content:center;}
.mdc-medal-emoji{position:absolute;bottom:var(--md,0px);left:50%;transform:translateX(-50%);font-size:1.6rem;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));animation:mdc-pop .4s ease both;}
@keyframes mdc-pop{0%{transform:translateX(-50%) translateY(-12px) scale(.6);opacity:0;}100%{transform:translateX(-50%) translateY(0) scale(1);opacity:1;}}
.mdc-step{width:90px;height:var(--stand-h,80px);border-radius:10px 10px 4px 4px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px;box-shadow:0 4px 8px rgba(0,0,0,.2),inset 0 -4px 6px rgba(0,0,0,.15);}
.mdc-stand--gold .mdc-step{background:linear-gradient(180deg,#ffe580,#e8b020);}
.mdc-stand--silver .mdc-step{background:linear-gradient(180deg,#f0f0f0,#b0b0b0);}
.mdc-stand--bronze .mdc-step{background:linear-gradient(180deg,#e8a060,#b06030);}
.mdc-step-label{font-size:.9rem;font-weight:900;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);background:rgba(0,0,0,.25);padding:2px 8px;border-radius:999px;}
.mdc-choices{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:100%;max-width:420px;}
.mdc-choice{font-size:1.6rem;font-weight:900;padding:18px 0;border:none;border-radius:18px;background:#fff;color:#333;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;}
.mdc-choice:active{transform:scale(.94);}
.mdc-choice--right{background:linear-gradient(135deg,#6bcf7f,#4ed976);color:#fff;animation:mdc-bounce .4s ease;}
.mdc-choice--wrong{background:linear-gradient(135deg,#ff6348,#e74c3c);color:#fff;animation:mdc-shake .3s ease;}
@keyframes mdc-bounce{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
@keyframes mdc-shake{25%{transform:translateX(-5px);}75%{transform:translateX(5px);}}
@media (max-width:380px){.mdc-stand{width:72px;}.mdc-step{width:72px;}.mdc-choice{font-size:1.3rem;padding:14px 0;}}
`;
}

export function create(): MedalCountGame {
  return new MedalCountGame();
}
