/* 观众席 Stadium Cheer —— 两个看台区域各坐一排观众（emoji），
   左右两边几乎一样，只有几处不同：比如左边某位举红旗🚩、右边那位没举。
   孩子点出"不同"的那位观众（任点左或右均可）。
   独特点：观察 + 专注 + 对比。视觉：两个看台 + 观众 emoji 排列。
   难度=差异数（1~4 处）。通关=找全目标轮数。前缀 stc2-（star-catch 用 stc-）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

/** 看台一排观众的"基本"造型；差异造型 = 基础 + 红旗/不同动作 */
const BASE_LOOKS = ["🧑", "👧", "👦", "👩", "👨", "🧒", "👩‍🦰", "👨‍🦱"];
const FLAG_LOOKS = ["🚩", "🙋", "🎉", "👏"];

export class StadiumCheerGame extends BaseGame {
  constructor() {
    super("stadium-cheer");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  /** 当前轮的差异数（需要找到的数量） */
  private diffCount = 0;
  /** 已找到的数量 */
  private found = 0;
  /** 差异位置集合（用 index 标识，左右共用同一 index） */
  private diffIndexes = new Set<number>();

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private rowSize(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 6
        : 8;
  }
  private diffs(): number {
    return this.difficulty === "easy" ? 3: this.difficulty === "medium"
        ? 4
        : 6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.found = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const size = this.rowSize();
    this.diffCount = this.diffs();
    this.diffIndexes = new Set();

    // 生成基础行：每个位置一个"基础造型"
    const baseRow: string[] = [];
    for (let i = 0; i < size; i++) {
      baseRow.push(BASE_LOOKS[randInt(0, BASE_LOOKS.length - 1)]!);
    }
    // 选差异位置
    const allIndexes = shuffle(Array.from({ length: size }, (_, i) => i));
    for (let i = 0; i < this.diffCount; i++) {
      this.diffIndexes.add(allIndexes[i]!);
    }
    // 左行：在某些差异位置改成"举旗造型"
    // 右行：保持基础，但在另外的差异位置改成"举旗造型"
    // 即：左右在差异位置上各自随机决定是否变化，但保证不同
    const leftRow: string[] = [...baseRow];
    const rightRow: string[] = [...baseRow];
    this.diffIndexes.forEach((idx) => {
      const flag = FLAG_LOOKS[randInt(0, FLAG_LOOKS.length - 1)]!;
      // 左随机决定谁举旗，右必相反
      if (Math.random() < 0.5) {
        leftRow[idx] = flag;
      } else {
        rightRow[idx] = flag;
      }
    });

    const wrap = document.createElement("div");
    wrap.className = "stc2-wrap";

    const task = document.createElement("div");
    task.className = "stc2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 找出两边<b>不一样</b>的观众！还剩 <b id="stc2-left">${this.diffCount - this.found}</b> 处`;
    wrap.appendChild(task);

    const stadium = document.createElement("div");
    stadium.className = "stc2-stadium";

    // 左看台
    stadium.appendChild(this.buildStand("左看台", leftRow, "left"));
    // 中间分隔（球场）
    const field = document.createElement("div");
    field.className = "stc2-field";
    field.textContent = "⚽";
    stadium.appendChild(field);
    // 右看台
    stadium.appendChild(this.buildStand("右看台", rightRow, "right"));

    wrap.appendChild(stadium);
    this.root.appendChild(wrap);
  }

  private buildStand(
    label: string,
    row: string[],
    side: "left" | "right",
  ): HTMLElement {
    const stand = document.createElement("div");
    stand.className = `stc2-stand stc2-stand--${side}`;
    const labelEl = document.createElement("div");
    labelEl.className = "stc2-stand-label";
    labelEl.textContent = label;
    stand.appendChild(labelEl);
    const seats = document.createElement("div");
    seats.className = "stc2-seats";
    row.forEach((emoji, idx) => {
      const seat = document.createElement("button");
      seat.type = "button";
      seat.className = "stc2-seat";
      seat.dataset.index = String(idx);
      seat.dataset.side = side;
      seat.setAttribute("aria-label", `${label} 第 ${idx + 1} 位`);
      seat.textContent = emoji;
      seat.addEventListener("click", () => this.clickSeat(idx, seat));
      seats.appendChild(seat);
    });
    stand.appendChild(seats);
    return stand;
  }

  private clickSeat(idx: number, seat: HTMLButtonElement): void {
    if (this.locked) return;
    if (seat.classList.contains("stc2-seat--found")) return;
    if (seat.classList.contains("stc2-seat--miss")) return;
    if (this.diffIndexes.has(idx)) {
      // 正确：点亮左右两边同 index 的座位
      seat.classList.add("stc2-seat--found");
      // 同时点亮另一边对应座位
      const otherSide = seat.dataset.side === "left" ? "right" : "left";
      const other = this.root.querySelector(
        `.stc2-seat[data-side="${otherSide}"][data-index="${idx}"]`,
      );
      other?.classList.add("stc2-seat--found");
      sfxPop();
      this.found += 1;
      const r = seat.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 更新剩余
      const left = this.root.querySelector("#stc2-left");
      if (left)
        left.textContent = String(Math.max(0, this.diffCount - this.found));
      if (this.found >= this.diffCount) {
        this.locked = true;
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 900);
      }
    } else {
      // 错误：抖动
      seat.classList.add("stc2-seat--miss");
      this.trackTimeout(() => seat.classList.remove("stc2-seat--miss"), 500);
      this.onWrong();
    }
  }

  private injectStyle(): void {
    if (document.getElementById("stc2-style")) return;
    const st = document.createElement("style");
    st.id = "stc2-style";
    st.textContent = STC2_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function STC2_CSS(theme: string): string {
  void theme;
  return `
.stc2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(640px,100%);}
.stc2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.stc2-stadium{display:flex;align-items:stretch;justify-content:center;gap:8px;width:100%;padding:16px 8px;background:linear-gradient(180deg,#e8f5e8,#b8d8b8);border-radius:20px;box-shadow:var(--shadow);}
.stc2-stand{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 4px;background:linear-gradient(180deg,#9fc8e8,#6a9fc8);border-radius:14px;}
.stc2-stand-label{font-size:.95rem;font-weight:900;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);}
.stc2-seats{display:flex;flex-wrap:wrap;justify-content:center;gap:4px;}
.stc2-seat{width:44px;height:44px;font-size:1.6rem;line-height:1;border:none;background:rgba(255,255,255,.6);border-radius:8px;cursor:pointer;padding:0;transition:transform .1s,background .15s;display:flex;align-items:center;justify-content:center;}
.stc2-seat:active{transform:scale(.88);}
.stc2-seat--found{background:linear-gradient(135deg,#ffe580,#e8b020);box-shadow:0 0 0 3px rgba(255,200,40,.6);animation:stc2-found .4s ease;}
@keyframes stc2-found{0%{transform:scale(1);}50%{transform:scale(1.25);}100%{transform:scale(1);}}
.stc2-seat--miss{background:linear-gradient(135deg,#ff9c8c,#e74c3c);animation:stc2-shake .4s ease;}
@keyframes stc2-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-5px);}75%{transform:translateX(5px);}}
.stc2-field{display:flex;align-items:center;justify-content:center;font-size:2rem;width:40px;}
@media (max-width:380px){.stc2-seat{width:36px;height:36px;font-size:1.3rem;}.stc2-field{width:28px;font-size:1.5rem;}}
`;
}

export function create(): StadiumCheerGame {
  return new StadiumCheerGame();
}
