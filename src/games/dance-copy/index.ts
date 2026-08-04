/* 舞蹈模仿 Dance Copy —— 看一组动作 emoji 卡片按顺序播放，再照顺序点出来。
   艺术启蒙：动作序列记忆 + 肢体模仿意识。独特点：4 个动作 emoji，
   先亮一遍顺序，玩家照点；和 beat-clap 的区别是"动作"主题，视觉是动作卡
   而非彩色圆圈。前缀 dnc-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

const MOVES = ["🙋", "👏", "🕺", "💃", "🤸", "🙏"];

export class DanceCopyGame extends BaseGame {
  constructor() {
    super("dance-copy");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private pads: string[] = []; // 本关用到的 4 个动作
  private seq: number[] = [];
  private playIdx = 0;
  private tapIdx = 0;
  private phase: "idle" | "playing" | "tapping" = "idle";
  private locked = false;
  private activeEl: HTMLElement | null = null;
  private clearActiveTimer = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    if (this.clearActiveTimer) window.clearTimeout(this.clearActiveTimer);
    this.clearActiveTimer = 0;
  }

  private len(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.tapIdx = 0;
    this.playIdx = 0;
    this.activeEl = null;
    this.pads = shuffle(MOVES).slice(0, 4);
    const n = this.len();
    this.seq = Array.from({ length: n }, () => randInt(0, 3));

    const wrap = document.createElement("div");
    wrap.className = "dnc-wrap";

    const task = document.createElement("div");
    task.className = "dnc-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 看清楚<b>动作顺序</b>，再照着点一遍`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "dnc-hint";
    hint.id = "dnc-hint";
    hint.textContent = "👀 仔细看…";
    wrap.appendChild(hint);

    const stage = document.createElement("div");
    stage.className = "dnc-stage";
    stage.id = "dnc-stage";
    wrap.appendChild(stage);

    const board = document.createElement("div");
    board.className = "dnc-board";
    this.pads.forEach((m, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dnc-pad";
      b.innerHTML = `<span class="dnc-pad__emoji">${m}</span>`;
      b.addEventListener("click", () => this.tap(i));
      board.appendChild(b);
    });
    wrap.appendChild(board);

    const progress = document.createElement("div");
    progress.className = "dnc-progress";
    progress.id = "dnc-progress";
    wrap.appendChild(progress);

    this.root.appendChild(wrap);
    this.renderProgress();
    this.trackTimeout(() => this.startPlay(), 700);
  }

  private startPlay(): void {
    this.phase = "playing";
    this.playIdx = 0;
    this.setHint("👀 仔细看…");
    this.scheduleNext(0);
  }

  private scheduleNext(delay: number): void {
    this.trackTimeout(() => {
      if (this.playIdx >= this.seq.length) {
        this.phase = "tapping";
        this.tapIdx = 0;
        this.setHint("🕺 轮到你啦，照顺序点！");
        return;
      }
      const padIdx = this.seq[this.playIdx]!;
      this.flash(padIdx);
      sfxPop();
      this.playIdx += 1;
      this.scheduleNext(700);
    }, delay);
  }

  private flash(padIdx: number): void {
    const board = this.root.querySelector(".dnc-board");
    const pad = board?.children[padIdx] as HTMLElement | undefined;
    if (!pad) return;
    pad.classList.add("dnc-pad--lit");
    // 同时在中间大舞台展示
    const stage = this.root.querySelector<HTMLElement>("#dnc-stage");
    if (stage) {
      stage.innerHTML = `<div class="dnc-stage__emoji">${this.pads[padIdx]}</div>`;
    }
    if (this.clearActiveTimer) window.clearTimeout(this.clearActiveTimer);
    this.activeEl = pad;
    this.clearActiveTimer = window.setTimeout(() => {
      pad.classList.remove("dnc-pad--lit");
      this.activeEl = null;
    }, 450);
  }

  private setHint(t: string): void {
    const h = this.root.querySelector<HTMLElement>("#dnc-hint");
    if (h) h.textContent = t;
  }

  private renderProgress(): void {
    const p = this.root.querySelector<HTMLElement>("#dnc-progress");
    if (!p) return;
    p.innerHTML = "";
    for (let i = 0; i < this.seq.length; i++) {
      const d = document.createElement("div");
      d.className = "dnc-dot";
      if (i < this.tapIdx) d.classList.add("dnc-dot--done");
      p.appendChild(d);
    }
  }

  private tap(padIdx: number): void {
    if (this.locked || this.phase !== "tapping") return;
    const expect = this.seq[this.tapIdx]!;
    this.flash(padIdx);
    if (padIdx === expect) {
      sfxPop();
      const board = this.root.querySelector(".dnc-board");
      const pad = board?.children[padIdx] as HTMLElement | undefined;
      if (pad) {
        const r = pad.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      }
      this.resetWrongStreak();
      this.tapIdx += 1;
      this.renderProgress();
      if (this.tapIdx >= this.seq.length) {
        this.locked = true;
        this.phase = "idle";
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.setHint("🎉 跳得太棒啦！");
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1000);
      }
    } else {
      const paused = this.onWrong();
      this.tapIdx = 0;
      this.renderProgress();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "再看一遍～",
      emoji: "💃",
      variant: "rest",
      body: "舞蹈要照着亮的动作顺序跳哦，看仔细再来一遍～",
      primary: { text: "继续", icon: "🕺", onClick: () => ov.destroy() },
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
    if (document.getElementById("dnc-style")) return;
    const st = document.createElement("style");
    st.id = "dnc-style";
    st.textContent = DNC_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function DNC_CSS(theme: string): string {
  return `
.dnc-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.dnc-task{font-size:1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.dnc-task b{color:${theme};}
.dnc-hint{font-size:1.1rem;font-weight:900;color:${theme};min-height:1.4rem;}
.dnc-stage{width:140px;height:140px;border-radius:50%;background:linear-gradient(135deg,#fff0f6,#ffe0ec);box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;}
.dnc-stage__emoji{font-size:5rem;animation:dnc-bounce .4s ease;}
@keyframes dnc-bounce{0%{transform:scale(.4) rotate(-10deg)}60%{transform:scale(1.2) rotate(8deg)}100%{transform:scale(1) rotate(0)}}
.dnc-board{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;background:#fff;padding:12px;border-radius:20px;box-shadow:var(--shadow);}
.dnc-pad{width:74px;height:74px;border-radius:18px;background:#f4f4f8;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s,background .15s;display:flex;align-items:center;justify-content:center;border:none;}
.dnc-pad:active{transform:scale(.9);}
.dnc-pad--lit{background:linear-gradient(135deg,${theme},#ffb3d1);transform:scale(1.12);}
.dnc-pad__emoji{font-size:2.4rem;}
.dnc-progress{display:flex;gap:8px;}
.dnc-dot{width:14px;height:14px;border-radius:50%;background:#e0e0e0;}
.dnc-dot--done{background:${theme};}
@media (max-width:360px){.dnc-pad{width:62px;height:62px;}.dnc-pad__emoji{font-size:2rem;}}
`;
}

export function create(): DanceCopyGame {
  return new DanceCopyGame();
}
