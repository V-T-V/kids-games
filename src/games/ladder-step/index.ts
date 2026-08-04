/* 数字跳格子 Ladder Step —— 按题目要求跳到对应数字的格子。
   独特点：横排格子 + 一个会蹦跳的小角色，点格子后角色跳过去。
   巧思：题面随难度升级，从直接找数字到"比3大1""4和6中间的数"。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

interface Puzzle {
  /** 题目文案 */
  prompt: string;
  /** 正确答案 */
  answer: number;
}

export class LadderStepGame extends BaseGame {
  constructor() {
    super("ladder-step");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private current: Puzzle | null = null;
  private actor: HTMLElement | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.actor = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const puzzle = this.makePuzzle();
    this.current = puzzle;

    // 格子序列：从 1 开始连续若干格，包含答案
    const maxCell = puzzle.answer + randInt(1, 3);
    const cells: number[] = [];
    for (let i = 1; i <= maxCell; i++) cells.push(i);

    const wrap = document.createElement("div");
    wrap.className = "ls-wrap";

    const task = document.createElement("div");
    task.className = "ls-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · <b>${puzzle.prompt}</b>`;
    wrap.appendChild(task);

    // 起跳平台
    const stage = document.createElement("div");
    stage.className = "ls-stage";
    const track = document.createElement("div");
    track.className = "ls-track";

    // 起点格
    const home = document.createElement("div");
    home.className = "ls-home";
    home.textContent = "🏠";
    track.appendChild(home);

    // 数字格
    for (const n of cells) {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "ls-cell";
      c.textContent = String(n);
      c.dataset.num = String(n);
      c.addEventListener("click", () => this.step(c, n, puzzle));
      track.appendChild(c);
    }
    stage.appendChild(track);
    wrap.appendChild(stage);

    // 小角色
    const actor = document.createElement("div");
    actor.className = "ls-actor";
    actor.textContent = "🐰";
    wrap.appendChild(actor);
    this.actor = actor;

    this.root.appendChild(wrap);
  }

  private makePuzzle(): Puzzle {
    const diff = this.difficulty;
    if (diff === "easy") {
      const n = randInt(1, 6);
      return { prompt: `跳到数字 ${n} 的格子`, answer: n };
    }
    if (diff === "medium") {
      // "比 X 大 1" / "比 X 小 1" / "X 和 Y 中间"
      const kinds = ["plus", "minus", "between"] as const;
      const k = sample(kinds);
      if (k === "plus") {
        const x = randInt(1, 6);
        return { prompt: `跳到比 ${x} 大 1 的格子`, answer: x + 1 };
      }
      if (k === "minus") {
        const x = randInt(2, 7);
        return { prompt: `跳到比 ${x} 小 1 的格子`, answer: x - 1 };
      }
      const a = randInt(2, 6);
      return { prompt: `跳到 ${a - 1} 和 ${a + 1} 中间的格子`, answer: a };
    }
    // hard: 更大范围 + "比 X 大 2"
    const x = randInt(1, 8);
    return { prompt: `跳到比 ${x} 大 2 的格子`, answer: x + 2 };
  }

  private step(cell: HTMLButtonElement, n: number, puzzle: Puzzle): void {
    if (cell.classList.contains("ls-cell--done")) return;
    const correct = n === puzzle.answer;
    if (correct) {
      sfxPop();
      cell.classList.add("ls-cell--correct", "ls-cell--done");
      // 角色跳到该格
      this.moveActorTo(cell);
      const r = cell.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 950);
    } else {
      cell.classList.add("ls-cell--wrong", "ls-shake");
      this.trackTimeout(
        () => cell.classList.remove("ls-cell--wrong", "ls-shake"),
        600,
      );
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private moveActorTo(cell: HTMLElement): void {
    const actor = this.actor;
    if (!actor) return;
    const wrap = this.root.querySelector(".ls-wrap") as HTMLElement | null;
    const cellRect = cell.getBoundingClientRect();
    const wrapRect = wrap
      ? wrap.getBoundingClientRect()
      : { left: 0, top: 0, width: 0, height: 0 };
    const x = cellRect.left - wrapRect.left + cellRect.width / 2 - 18;
    const y = cellRect.top - wrapRect.top + cellRect.height / 2 - 36;
    actor.style.setProperty("--ls-tx", `${x}px`);
    actor.style.setProperty("--ls-ty", `${y}px`);
    actor.classList.add("ls-actor--hop");
    this.trackTimeout(() => actor.classList.remove("ls-actor--hop"), 700);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再读一遍题目，数一数格子的数字吧～",
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
    if (document.getElementById("ls-style")) return;
    const st = document.createElement("style");
    st.id = "ls-style";
    st.textContent = LS_CSS(getCssVar("--c-green"), getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function LS_CSS(theme: string, accent: string): string {
  return `
.ls-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(620px,100%);position:relative;padding-bottom:60px;}
.ls-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.ls-stage{width:100%;overflow-x:auto;padding:8px 4px;}
.ls-track{display:flex;align-items:flex-end;gap:8px;padding:12px;min-width:max-content;}
.ls-home{width:54px;height:54px;font-size:1.8rem;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.6);border-radius:12px;margin-right:4px;}
.ls-cell{position:relative;min-width:60px;height:60px;border:none;border-radius:14px 14px 10px 10px;background:linear-gradient(180deg,#fff,${accent}88);font-size:1.6rem;font-weight:800;color:#3a3a3a;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s;}
.ls-cell:active{transform:scale(.92) translateY(2px);}
.ls-cell--correct{background:linear-gradient(180deg,${accent},${theme});color:#fff;animation:ls-pop .5s ease;}
.ls-cell--wrong{background:linear-gradient(180deg,#ffd9d2,#ff8b7a);color:#fff;}
.ls-cell--done{pointer-events:none;}
@keyframes ls-pop{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}
.ls-shake{animation:ls-shake .5s ease;}
@keyframes ls-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
.ls-actor{position:absolute;left:0;top:0;font-size:2rem;transform:translate(8px,8px);transition:none;pointer-events:none;z-index:5;filter:drop-shadow(0 4px 6px rgba(0,0,0,.25));}
.ls-actor--hop{animation:ls-hop .7s cubic-bezier(.3,1.4,.4,1) forwards;}
@keyframes ls-hop{0%{transform:translate(8px,8px)}50%{transform:translate(calc(var(--ls-tx,8px) * .5),calc(var(--ls-ty,8px) * .5 - 40px))}100%{transform:translate(var(--ls-tx,8px),var(--ls-ty,8px))}}
@media (max-width:380px){.ls-cell{min-width:48px;height:50px;font-size:1.3rem;}.ls-home{width:44px;height:44px;}}
`;
}

export function create(): LadderStepGame {
  return new LadderStepGame();
}
