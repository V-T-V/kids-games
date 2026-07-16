/* 小指令机器人 Robot Code —— 排指令（前进/左转/右转）让机器人走到终点。
   巧思：编程启蒙；执行时机器人按指令逐步移动并转向。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxTick } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { createButton } from "../../ui/Button.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

type Dir = 0 | 1 | 2 | 3; // 0=上 1=右 2=下 3=左
type Cmd = "F" | "L" | "R";

export class RobotCodeGame extends BaseGame {
  constructor() {
    super("robot-code");
  }
  private grid = 4;
  private robotEl!: HTMLDivElement;
  private px = 0;
  private py = 0;
  private dir: Dir = 1;
  private cmds: Cmd[] = [];
  private running = false;
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.grid =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.roundTotal =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.px = 0;
    this.py = 0;
    this.dir = 1;
    this.cmds = [];
    this.running = false;
    const goalX = this.grid - 1,
      goalY = this.grid - 1;

    const wrap = document.createElement("div");
    wrap.className = "rc-wrap";
    const task = document.createElement("div");
    task.className = "rc-task";
    task.textContent = `帮 🤖 走到 🎯（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const board = document.createElement("div");
    board.className = "rc-board";
    board.style.setProperty("--n", String(this.grid));
    const cellPx = 56;
    board.style.width = `${this.grid * cellPx}px`;
    board.style.height = `${this.grid * cellPx}px`;
    for (let i = 0; i < this.grid * this.grid; i++) {
      const c = document.createElement("div");
      c.className = "rc-cell";
      board.appendChild(c);
    }
    const goal = document.createElement("div");
    goal.className = "rc-goal";
    goal.textContent = "🎯";
    goal.style.left = `${goalX * cellPx}px`;
    goal.style.top = `${goalY * cellPx}px`;
    board.appendChild(goal);
    this.robotEl = document.createElement("div");
    this.robotEl.className = "rc-robot";
    this.robotEl.textContent = "🤖";
    board.appendChild(this.robotEl);
    this.updateRobot();
    wrap.appendChild(board);

    // 程序区
    const prog = document.createElement("div");
    prog.className = "rc-prog";
    prog.id = "rc-prog";
    wrap.appendChild(prog);

    // 指令按钮
    const pad = document.createElement("div");
    pad.className = "rc-pad";
    pad.appendChild(this.cmdBtn("⬆️ 前进", () => this.add("F")));
    pad.appendChild(this.cmdBtn("↪️ 左转", () => this.add("L")));
    pad.appendChild(this.cmdBtn("↩️ 右转", () => this.add("R")));
    wrap.appendChild(pad);

    const actions = document.createElement("div");
    actions.className = "rc-actions";
    actions.appendChild(
      createButton({
        text: "清空",
        icon: "🗑️",
        variant: "secondary",
        onClick: () => this.clear(),
      }),
    );
    actions.appendChild(
      createButton({
        text: "出发！",
        icon: "▶️",
        variant: "primary",
        onClick: () => this.run(goalX, goalY),
      }),
    );
    wrap.appendChild(actions);
    this.root.appendChild(wrap);
  }

  private cmdBtn(text: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rc-cmdbtn";
    b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  }

  private add(c: Cmd): void {
    if (this.running) return;
    this.cmds.push(c);
    sfxTick();
    this.renderProg();
  }

  private clear(): void {
    if (this.running) return;
    this.cmds = [];
    this.renderProg();
  }

  private renderProg(): void {
    const prog = this.root.querySelector("#rc-prog") as HTMLElement;
    if (!prog) return;
    prog.innerHTML = "";
    this.cmds.forEach((c) => {
      const t = document.createElement("span");
      t.className = "rc-cmd";
      t.textContent = c === "F" ? "⬆️" : c === "L" ? "↪️" : "↩️";
      prog.appendChild(t);
    });
  }

  private async run(goalX: number, goalY: number): Promise<void> {
    if (this.running || this.cmds.length === 0) return;
    this.running = true;
    const DX = [0, 1, 0, -1];
    const DY = [-1, 0, 1, 0];
    for (const c of this.cmds) {
      await this.wait(380);
      if (c === "L") this.dir = ((this.dir + 3) % 4) as Dir;
      else if (c === "R") this.dir = ((this.dir + 1) % 4) as Dir;
      else {
        const nx = this.px + DX[this.dir]!;
        const ny = this.py + DY[this.dir]!;
        if (nx >= 0 && nx < this.grid && ny >= 0 && ny < this.grid) {
          this.px = nx;
          this.py = ny;
          sfxPop();
        }
      }
      this.updateRobot();
    }
    await this.wait(300);
    this.running = false;
    if (this.px === goalX && this.py === goalY) {
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1200);
    } else {
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.trackTimeout(r, ms));
  }

  private updateRobot(): void {
    const cell = 56;
    this.robotEl.style.left = `${this.px * cell + 4}px`;
    this.robotEl.style.top = `${this.py * cell + 4}px`;
    const rot = this.dir * 90;
    this.robotEl.style.transform = `rotate(${rot}deg)`;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再想想该先转还是先走～",
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
    if (document.getElementById("rc-style")) return;
    const st = document.createElement("style");
    st.id = "rc-style";
    st.textContent = RC_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function RC_CSS(_theme: string): string {
  return `
.rc-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(420px,100%);}
.rc-task{font-size:1.1rem;font-weight:800;}
.rc-board{position:relative;background:rgba(255,255,255,.5);border-radius:14px;box-shadow:var(--shadow);display:grid;grid-template-columns:repeat(var(--n),56px);grid-template-rows:repeat(var(--n),56px);gap:2px;padding:6px;}
.rc-cell{background:#fff;border-radius:6px;}
.rc-goal{position:absolute;font-size:1.8rem;transition:all .3s;}
.rc-robot{position:absolute;font-size:2rem;width:48px;height:48px;display:flex;align-items:center;justify-content:center;transition:left .3s ease,top .3s ease,transform .3s ease;z-index:2;}
.rc-prog{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;min-height:44px;padding:8px;background:#fff;border-radius:12px;box-shadow:var(--shadow);width:100%;max-width:340px;}
.rc-cmd{font-size:1.4rem;}
.rc-pad{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.rc-cmdbtn{min-height:52px;padding:0 18px;font-size:1rem;font-weight:700;border-radius:14px;background:#fff;box-shadow:var(--shadow);}
.rc-cmdbtn:active{transform:scale(.94);}
.rc-actions{display:flex;gap:10px;}
`;
}

export function create(): RobotCodeGame {
  return new RobotCodeGame();
}
