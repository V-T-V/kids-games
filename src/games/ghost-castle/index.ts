/* 鬼城堡 Ghost Castle —— 城堡有一排窗户，鬼会在其中一个窗户出现又消失，
   展示后问"鬼刚才在哪个窗户"，孩子点对应窗户。
   独特点：短时空间记忆。视觉：夜空下的城堡 + 发光的窗户 + 鬼 emoji。
   难度=窗户数量（也影响展示时长）。通关=记对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

export class GhostCastleGame extends BaseGame {
  constructor() {
    super("ghost-castle");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  /** 本关鬼所在窗户的下标 */
  private ghostIdx = -1;
  /** 阶段：show 展示 / hide 答题 */
  private phase: "show" | "hide" = "show";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空；定时器由基类清理 */
  }

  private windowCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = this.windowCount();
    this.ghostIdx = randInt(0, n - 1);
    this.phase = "show";

    const wrap = document.createElement("div");
    wrap.className = "gct-wrap";

    const task = document.createElement("div");
    task.className = "gct-task";
    task.id = "gct-task";
    task.innerHTML = `看好 <b>👻</b> 从哪个窗户冒出来！<br><span class="gct-hint">第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const castle = document.createElement("div");
    castle.className = "gct-castle";
    // 城堡塔楼 + 窗户
    const wall = document.createElement("div");
    wall.className = "gct-wall";
    wall.id = "gct-wall";
    for (let i = 0; i < n; i++) {
      const w = document.createElement("button");
      w.type = "button";
      w.className = "gct-window";
      w.dataset.idx = String(i);
      w.setAttribute("aria-label", `窗户 ${i + 1}`);
      w.addEventListener("click", () => this.pick(i, w));
      wall.appendChild(w);
    }
    castle.appendChild(wall);
    // 屋顶塔尖
    const roof = document.createElement("div");
    roof.className = "gct-roof";
    roof.innerHTML = `<span class="gct-tower">🏰</span><span class="gct-flag">🚩</span>`;
    castle.appendChild(roof);
    wrap.appendChild(castle);

    this.root.appendChild(wrap);

    // 展示鬼（难度高展示更短）
    const showMs =
      this.difficulty === "easy"
        ? 1500
        : this.difficulty === "medium"
          ? 1200
          : 900;
    this.showGhost();
    this.trackTimeout(() => {
      this.hideGhost();
      this.phase = "hide";
      const t = this.root.querySelector<HTMLElement>("#gct-task");
      if (t)
        t.innerHTML = `鬼躲起来了～它刚才在 <b>哪个窗户</b>？<br><span class="gct-hint">第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    }, showMs);
  }

  private showGhost(): void {
    const wall = this.root.querySelector<HTMLElement>("#gct-wall");
    if (!wall) return;
    const w = wall.children[this.ghostIdx];
    if (w) w.classList.add("gct-window--ghost");
  }

  private hideGhost(): void {
    const wall = this.root.querySelector<HTMLElement>("#gct-wall");
    if (!wall) return;
    Array.from(wall.children).forEach((c) =>
      c.classList.remove("gct-window--ghost"),
    );
  }

  private pick(idx: number, btn: HTMLButtonElement): void {
    if (this.answered || this.phase !== "hide") return;
    this.answered = true;
    if (idx === this.ghostIdx) {
      btn.classList.add("gct-window--correct");
      // 显示鬼庆祝
      btn.classList.add("gct-window--ghost");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("gct-window--wrong");
      // 揭示正确窗户
      const wall = this.root.querySelector<HTMLElement>("#gct-wall");
      const correct = wall?.children[this.ghostIdx];
      if (correct) correct.classList.add("gct-window--reveal");
      const paused = this.onWrong();
      // 1 秒后允许再答（不直接重置整关，避免鬼位置变化让孩子困惑）
      this.trackTimeout(() => {
        btn.classList.remove("gct-window--wrong");
        if (correct) correct.classList.remove("gct-window--reveal");
        this.answered = false;
      }, 900);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "鬼出现的时候要盯紧它躲在哪个窗户哦～",
      primary: { text: "继续", icon: "👻", onClick: () => ov.destroy() },
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
    if (document.getElementById("gct-style")) return;
    const st = document.createElement("style");
    st.id = "gct-style";
    st.textContent = GCT_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function GCT_CSS(theme: string): string {
  return `
.gct-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.gct-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.gct-task b{color:${theme};}
.gct-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.gct-castle{position:relative;width:100%;max-width:480px;padding:54px 14px 22px;border-radius:0 0 24px 24px;background:linear-gradient(180deg,#5a4a6e,#3e3253);box-shadow:var(--shadow-lg);}
.gct-roof{position:absolute;top:-6px;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-end;padding:0 24px;height:54px;}
.gct-tower{font-size:2.4rem;filter:drop-shadow(0 3px 3px rgba(0,0,0,.4));}
.gct-flag{font-size:1.4rem;animation:gct-wave 2s ease-in-out infinite;}
@keyframes gct-wave{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
.gct-wall{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:10px;background:rgba(0,0,0,.15);border-radius:14px;}
.gct-window{position:relative;aspect-ratio:3/4;border:none;border-radius:50% 50% 8px 8px;background:linear-gradient(180deg,#2a2340 0%,#1a1530 100%);box-shadow:inset 0 0 0 3px #6a5a80,inset 0 4px 8px rgba(0,0,0,.5);cursor:pointer;transition:transform .12s ease;overflow:hidden;}
.gct-window:active{transform:scale(.94);}
.gct-window::after{content:"";position:absolute;left:50%;top:0;bottom:0;width:3px;background:#6a5a80;transform:translateX(-50%);}
.gct-window--ghost::before{content:"👻";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2rem;animation:gct-pop .4s ease;}
@keyframes gct-pop{0%{transform:scale(0) translateY(10px);opacity:0}100%{transform:scale(1) translateY(0);opacity:1}}
.gct-window--correct{background:linear-gradient(180deg,#a8e6b8,#6bcf7f);box-shadow:inset 0 0 0 3px #4a9a5a,0 0 14px #6bcf7f;}
.gct-window--wrong{animation:gct-shake .4s ease;background:linear-gradient(180deg,#ffb3b3,#ff6b6b);}
.gct-window--reveal{background:linear-gradient(180deg,#fff3b0,#ffd93d);box-shadow:inset 0 0 0 3px #d4a056;}
.gct-window--reveal::before{content:"👻";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2rem;}
@keyframes gct-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.gct-wall{grid-template-columns:repeat(3,1fr);gap:10px;}.gct-window--ghost::before{font-size:1.5rem;}}
`;
}

export function create(): GhostCastleGame {
  return new GhostCastleGame();
}
