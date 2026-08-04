/* 合作搭建 Coop Build —— 两个小朋友轮流放积木，按颜色顺序合作搭出目标塔。
   社交启蒙：轮流 + 协作完成共同目标。独特点：上方给出目标颜色顺序，
   玩家按顺序点击对应颜色的积木（模拟"我和小伙伴轮流"），错色或越序则失败。
   前缀 cpb-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

const COLORS: { key: string; hex: string; name: string }[] = [
  { key: "R", hex: "#ff6b6b", name: "红" },
  { key: "Y", hex: "#ffd93d", name: "黄" },
  { key: "B", hex: "#4d96ff", name: "蓝" },
  { key: "G", hex: "#6bcf7f", name: "绿" },
];

export class CoopBuildGame extends BaseGame {
  constructor() {
    super("coop-build");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private target: typeof COLORS = [];
  private placed = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private len(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.locked = false;
    this.placed = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 生成可解目标序列：随机但保证相邻不同色（更易看清楚顺序）
    const n = this.len();
    const seq: typeof COLORS = [];
    let last = "";
    for (let i = 0; i < n; i++) {
      const pool = COLORS.filter((c) => c.key !== last);
      const pick = sample(pool);
      seq.push(pick);
      last = pick.key;
    }
    this.target = seq;

    const wrap = document.createElement("div");
    wrap.className = "cpb-wrap";

    const task = document.createElement("div");
    task.className = "cpb-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 你和小伙伴<b>轮流</b>放积木，按上面的颜色顺序搭`;
    wrap.appendChild(task);

    // 目标顺序展示
    const goal = document.createElement("div");
    goal.className = "cpb-goal";
    goal.id = "cpb-goal";
    this.renderGoal(goal);
    wrap.appendChild(goal);

    // 已搭好的塔（从下往上）
    const tower = document.createElement("div");
    tower.className = "cpb-tower";
    tower.id = "cpb-tower";
    wrap.appendChild(tower);

    // 轮到谁
    const turn = document.createElement("div");
    turn.className = "cpb-turn";
    turn.id = "cpb-turn";
    turn.innerHTML = `现在轮到<b class="cpb-me">我</b>放第 1 块 👇`;
    wrap.appendChild(turn);

    // 颜色按钮
    const palette = document.createElement("div");
    palette.className = "cpb-palette";
    COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cpb-color";
      b.style.background = c.hex;
      b.setAttribute("aria-label", c.name);
      b.innerHTML = `<span class="cpb-color__n">${c.name}</span>`;
      b.addEventListener("click", () => this.pick(c, b));
      palette.appendChild(b);
    });
    wrap.appendChild(palette);
    this.root.appendChild(wrap);
  }

  private renderGoal(el: HTMLElement): void {
    el.innerHTML = "";
    const label = document.createElement("div");
    label.className = "cpb-goal__label";
    label.textContent = "要搭的颜色顺序（从下往上）";
    el.appendChild(label);
    const row = document.createElement("div");
    row.className = "cpb-goal__row";
    // 倒序展示（塔顶在上）
    for (let i = this.target.length - 1; i >= 0; i--) {
      const c = this.target[i]!;
      const dot = document.createElement("div");
      dot.className = "cpb-goal__dot";
      dot.style.background = c.hex;
      dot.dataset.idx = String(i);
      if (i < this.placed) dot.classList.add("cpb-goal__dot--done");
      row.appendChild(dot);
    }
    el.appendChild(row);
  }

  private pick(
    c: { key: string; hex: string; name: string },
    btn: HTMLButtonElement,
  ): void {
    if (this.locked) return;
    const expect = this.target[this.placed]!;
    if (c.key === expect.key) {
      sfxPop();
      // 加入塔
      const tower = this.root.querySelector<HTMLElement>("#cpb-tower");
      if (tower) {
        const block = document.createElement("div");
        block.className = "cpb-block";
        block.style.background = c.hex;
        // 塔顶在 DOM 最上，新块插入到最前
        tower.insertBefore(block, tower.firstChild);
      }
      this.placed += 1;
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 更新目标展示 + 轮次
      const goal = this.root.querySelector<HTMLElement>("#cpb-goal");
      if (goal) this.renderGoal(goal);
      const turn = this.root.querySelector<HTMLElement>("#cpb-turn");
      if (turn) {
        if (this.placed >= this.target.length) {
          turn.innerHTML = `塔搭好啦！🎉`;
        } else {
          const who = this.placed % 2 === 0 ? "我" : "小伙伴";
          turn.innerHTML = `现在轮到<b class="cpb-me">${who}</b>放第 ${this.placed + 1} 块 👇`;
        }
      }
      if (this.placed >= this.target.length) {
        this.locked = true;
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1100);
      }
    } else {
      btn.classList.add("cpb-color--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("cpb-color--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "看一看顺序～",
      emoji: "🧱",
      variant: "rest",
      body: "要照着上面的颜色顺序一块块放哦，轮到谁就谁来～",
      primary: { text: "继续", icon: "🤝", onClick: () => ov.destroy() },
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
    if (document.getElementById("cpb-style")) return;
    const st = document.createElement("style");
    st.id = "cpb-style";
    st.textContent = CPB_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function CPB_CSS(theme: string): string {
  return `
.cpb-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.cpb-task{font-size:1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.cpb-task b{color:${theme};}
.cpb-goal{width:100%;max-width:380px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:12px 16px;box-sizing:border-box;}
.cpb-goal__label{font-size:.85rem;font-weight:900;color:#7a6a55;text-align:center;margin-bottom:8px;}
.cpb-goal__row{display:flex;flex-direction:column-reverse;gap:4px;align-items:center;}
.cpb-goal__dot{width:60px;height:14px;border-radius:6px;opacity:.55;transition:all .25s;}
.cpb-goal__dot--done{opacity:1;transform:scaleX(1.1);box-shadow:0 0 0 2px #fff,0 0 0 4px ${theme};}
.cpb-tower{display:flex;flex-direction:column-reverse;align-items:center;gap:3px;min-height:40px;padding:6px;}
.cpb-block{width:120px;height:26px;border-radius:7px;box-shadow:0 3px 5px rgba(0,0,0,.15),inset 0 -3px 4px rgba(0,0,0,.12),inset 0 2px 3px rgba(255,255,255,.5);animation:cpb-in .3s ease;}
@keyframes cpb-in{0%{transform:translateY(-30px) scale(.6);opacity:0}100%{transform:none;opacity:1}}
.cpb-turn{font-size:1.05rem;font-weight:800;color:#555;}
.cpb-turn .cpb-me{color:${theme};font-size:1.25rem;}
.cpb-palette{display:flex;gap:14px;}
.cpb-color{width:64px;height:64px;border-radius:16px;box-shadow:var(--shadow);display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;cursor:pointer;transition:transform .12s;}
.cpb-color:active{transform:scale(.9);}
.cpb-color__n{font-size:.8rem;font-weight:900;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);}
.cpb-color--wrong{animation:cpb-shake .4s ease;}
@keyframes cpb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): CoopBuildGame {
  return new CoopBuildGame();
}
