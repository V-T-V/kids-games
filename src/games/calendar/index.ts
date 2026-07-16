/* 日历认知 Calendar —— 月历网格，问"星期三是几号"或"15 号是星期几"。
   巧思：CSS 表格日历，今天高亮；点对应格子作答。难度 = 问题复杂度。
   通关 = 答对目标题数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

type QType = "date2weekday" | "weekday2date";

interface CalQuestion {
  type: QType;
  /** 题干 */
  prompt: string;
  /** 答案：星期几(0-6) 或 日期(1-31) */
  answer: number;
}

export class CalendarGame extends BaseGame {
  constructor() {
    super("calendar");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  /** 本月 1 号是星期几（0=日 … 6=六） */
  private firstWeekday = 0;
  /** 本月天数 */
  private daysInMonth = 31;
  private currentQ!: CalQuestion;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.firstWeekday = randInt(0, 6);
    this.daysInMonth = randInt(28, 31);
    this.currentQ = this.makeQuestion();

    const wrap = document.createElement("div");
    wrap.className = "ca-wrap";

    const task = document.createElement("div");
    task.className = "ca-task";
    task.textContent = `${this.currentQ.prompt}（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const cal = document.createElement("div");
    cal.className = "ca-cal";
    const head = document.createElement("div");
    head.className = "ca-head";
    WEEK.forEach((w) => {
      const d = document.createElement("div");
      d.className = "ca-dow";
      d.textContent = w;
      head.appendChild(d);
    });
    cal.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "ca-grid";
    for (let i = 0; i < this.firstWeekday; i++) {
      const blank = document.createElement("div");
      blank.className = "ca-cell ca-cell--blank";
      grid.appendChild(blank);
    }
    for (let day = 1; day <= this.daysInMonth; day++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "ca-cell";
      cell.textContent = String(day);
      cell.dataset.day = String(day);
      const weekday = (this.firstWeekday + day - 1) % 7;
      cell.dataset.weekday = String(weekday);
      if (weekday === 0 || weekday === 6)
        cell.classList.add("ca-cell--weekend");
      cell.addEventListener("click", () => this.onPick(day, weekday, cell));
      grid.appendChild(cell);
    }
    cal.appendChild(grid);
    wrap.appendChild(cal);

    // 提示：若是问星期几，给候选星期按钮（年幼孩子不认字时也支持直接点日历格作答）
    if (this.currentQ.type === "date2weekday") {
      const wk = document.createElement("div");
      wk.className = "ca-week-opts";
      WEEK.forEach((name, wd) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ca-wk";
        b.textContent = `星期${name}`;
        b.dataset.weekday = String(wd);
        b.addEventListener("click", () => this.onPickWeekday(wd, b));
        wk.appendChild(b);
      });
      wrap.appendChild(wk);
    }

    this.root.appendChild(wrap);
  }

  private makeQuestion(): CalQuestion {
    const targetDay = randInt(2, this.daysInMonth);
    const targetWeekday = (this.firstWeekday + targetDay - 1) % 7;
    if (this.difficulty === "easy") {
      // easy：15 号是星期几 / 星期三是几号（5 号附近）
      if (Math.random() < 0.5) {
        return {
          type: "date2weekday",
          prompt: `${targetDay} 号是星期几？点下面的星期`,
          answer: targetWeekday,
        };
      }
      const wd = sample([0, 1, 2, 3, 4, 5, 6])!;
      const day = this.firstDayOf(wd);
      return {
        type: "weekday2date",
        prompt: `这个月第一个星期${WEEK[wd]} 是几号？点日历`,
        answer: day,
      };
    }
    if (this.difficulty === "medium") {
      return {
        type: "date2weekday",
        prompt: `${targetDay} 号是星期几？`,
        answer: targetWeekday,
      };
    }
    // hard：随机问"某号是星期几"或"第一个星期X是几号"，含周末干扰
    if (Math.random() < 0.5) {
      return {
        type: "date2weekday",
        prompt: `${targetDay} 号是星期几？`,
        answer: targetWeekday,
      };
    }
    const wd = sample([0, 1, 2, 3, 4, 5, 6])!;
    const day = this.firstDayOf(wd);
    return {
      type: "weekday2date",
      prompt: `这个月第一个星期${WEEK[wd]} 是几号？点日历`,
      answer: day,
    };
  }

  /** 该星期几在本月的第一个日期 */
  private firstDayOf(wd: number): number {
    const diff = (wd - this.firstWeekday + 7) % 7;
    return 1 + diff;
  }

  private onPick(day: number, _weekday: number, cell: HTMLButtonElement): void {
    if (this.locked) return;
    const q = this.currentQ;
    // date2weekday 模式由星期按钮判定；count 模式已废弃；点格子忽略
    if (q.type !== "weekday2date") return;
    this.respond(day === q.answer, cell);
  }

  private onPickWeekday(wd: number, btn: HTMLButtonElement): void {
    if (this.locked) return;
    const q = this.currentQ;
    if (q.type !== "date2weekday") return;
    this.respond(wd === q.answer, btn);
  }

  private respond(correct: boolean, btn: HTMLElement): void {
    if (correct) {
      this.locked = true;
      sfxPop();
      if (btn instanceof HTMLButtonElement) btn.classList.add("ca-cell--done");
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
      if (btn instanceof HTMLButtonElement) btn.classList.add("ca-cell--wrong");
      const paused = this.onWrong();
      this.trackTimeout(
        () =>
          btn instanceof HTMLButtonElement &&
          btn.classList.remove("ca-cell--wrong"),
        400,
      );
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "从 1 号开始数，1、2、3……看看是星期几～",
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
    if (document.getElementById("ca-style")) return;
    const st = document.createElement("style");
    st.id = "ca-style";
    st.textContent = CA_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function CA_CSS(theme: string): string {
  return `
.ca-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.ca-task{font-size:1.12rem;font-weight:800;text-align:center;line-height:1.5;}
.ca-cal{background:#fff;border-radius:20px;padding:14px;box-shadow:var(--shadow);width:min(380px,92vw);}
.ca-head{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px;}
.ca-dow{text-align:center;font-size:.85rem;font-weight:800;color:var(--ink-soft);padding:4px 0;}
.ca-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
.ca-cell{aspect-ratio:1;border-radius:10px;background:#f6f3ff;color:var(--ink);font-size:1rem;font-weight:700;display:flex;align-items:center;justify-content:center;transition:transform .1s ease;border:2px solid transparent;}
.ca-cell--blank{background:transparent;}
.ca-cell--weekend{color:#ff6b9d;background:#fff0f5;}
.ca-cell:active{transform:scale(.92);}
.ca-cell--done{background:${theme};color:#fff;animation:ca-pop .4s ease;}
.ca-cell--wrong{animation:ca-shake .4s ease;border-color:#ff6348;}
.ca-week-opts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.ca-wk{min-height:52px;padding:0 16px;font-size:1rem;font-weight:800;border-radius:999px;background:#fff;box-shadow:var(--shadow);}
.ca-wk:active{transform:scale(.95);}
@keyframes ca-pop{0%{transform:scale(.7)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes ca-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
`;
}

export function create(): CalendarGame {
  return new CalendarGame();
}
