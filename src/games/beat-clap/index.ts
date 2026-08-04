/* 节奏打拍 Beat Clap —— 4 个圆圈依次亮起，按亮起的顺序点击（视觉节奏记忆）。
   艺术启蒙：节奏感 + 序列记忆。独特点：圆圈按节拍一个一个亮，亮完轮到玩家照顺序点；
   难度=序列长度。注意：beat-clap 用 bcl- 前缀（btc- 已被 butterfly-catch 占用）。
   使用 RAF 做高亮动画，unmount 必须 cancelAnimationFrame。前缀 bcl-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, playNote } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

const NOTES = ["C4", "E4", "G4", "C5"];
const PADS = [
  { color: "#ff6b9d", note: "C4" },
  { color: "#ffd93d", note: "E4" },
  { color: "#6bcf7f", note: "G4" },
  { color: "#4d96ff", note: "C5" },
];

export class BeatClapGame extends BaseGame {
  constructor() {
    super("beat-clap");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private seq: number[] = [];
  private playIdx = 0;
  private tapIdx = 0;
  private phase: "idle" | "playing" | "tapping" = "idle";
  private rafId = 0;
  private litPad = -1;
  private litUntil = 0;
  private pads: HTMLButtonElement[] = [];
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
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
    this.litPad = -1;
    this.pads = [];
    const n = this.len();
    this.seq = Array.from({ length: n }, () => randInt(0, 3));

    const wrap = document.createElement("div");
    wrap.className = "bcl-wrap";

    const task = document.createElement("div");
    task.className = "bcl-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 看清楚<b>亮的顺序</b>，再照着点一遍`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "bcl-hint";
    hint.id = "bcl-hint";
    hint.textContent = "👀 仔细看…";
    wrap.appendChild(hint);

    const board = document.createElement("div");
    board.className = "bcl-board";
    PADS.forEach((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bcl-pad";
      b.style.setProperty("--bcl-color", p.color);
      b.setAttribute("aria-label", `pad${i + 1}`);
      b.addEventListener("click", () => this.tap(i));
      board.appendChild(b);
      this.pads.push(b);
    });
    wrap.appendChild(board);

    const progress = document.createElement("div");
    progress.className = "bcl-progress";
    progress.id = "bcl-progress";
    wrap.appendChild(progress);

    this.root.appendChild(wrap);
    this.renderProgress();
    // 短暂停顿后开始播放序列
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
        this.setHint("👆 轮到你啦，照顺序点！");
        return;
      }
      const padIdx = this.seq[this.playIdx]!;
      this.lightPad(padIdx);
      playNote(NOTES[padIdx]!, 0.28);
      this.playIdx += 1;
      this.scheduleNext(560);
    }, delay);
  }

  /** RAF 循环：维持高亮的渐隐动画。 */
  private lightPad(padIdx: number): void {
    this.litPad = padIdx;
    this.litUntil = performance.now() + 380;
    const pad = this.pads[padIdx]!;
    pad.classList.add("bcl-pad--lit");
    if (!this.rafId) this.loop();
  }

  private loop = (): void => {
    if (performance.now() > this.litUntil && this.litPad >= 0) {
      this.pads[this.litPad]?.classList.remove("bcl-pad--lit");
      this.litPad = -1;
    }
    // tapping 阶段也需要 RAF 维持（防 litPad 未清）；无动作时停 RAF
    if (this.litPad >= 0 || this.phase === "tapping") {
      this.rafId = requestAnimationFrame(this.loop);
    } else {
      this.rafId = 0;
    }
  };

  private setHint(t: string): void {
    const h = this.root.querySelector<HTMLElement>("#bcl-hint");
    if (h) h.textContent = t;
  }

  private renderProgress(): void {
    const p = this.root.querySelector<HTMLElement>("#bcl-progress");
    if (!p) return;
    p.innerHTML = "";
    for (let i = 0; i < this.seq.length; i++) {
      const d = document.createElement("div");
      d.className = "bcl-dot";
      if (i < this.tapIdx) d.classList.add("bcl-dot--done");
      p.appendChild(d);
    }
  }

  private tap(padIdx: number): void {
    if (this.locked || this.phase !== "tapping") return;
    const expect = this.seq[this.tapIdx]!;
    // 短亮反馈
    this.lightPad(padIdx);
    playNote(NOTES[padIdx]!, 0.18);
    if (padIdx === expect) {
      sfxPop();
      const r = this.pads[padIdx]!.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.tapIdx += 1;
      this.renderProgress();
      if (this.tapIdx >= this.seq.length) {
        this.locked = true;
        this.phase = "idle";
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.setHint("🎉 太棒了！");
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1000);
      }
    } else {
      const paused = this.onWrong();
      // 答错后重置到 tapping 起点重新点（不直接失败整轮）
      this.tapIdx = 0;
      this.renderProgress();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "再听一次～",
      emoji: "🎵",
      variant: "rest",
      body: "节奏要照着亮的顺序点哦，看仔细再来一遍～",
      primary: { text: "继续", icon: "👏", onClick: () => ov.destroy() },
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
    if (document.getElementById("bcl-style")) return;
    const st = document.createElement("style");
    st.id = "bcl-style";
    st.textContent = BCL_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function BCL_CSS(theme: string): string {
  return `
.bcl-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(420px,100%);}
.bcl-task{font-size:1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.bcl-task b{color:${theme};}
.bcl-hint{font-size:1.15rem;font-weight:900;color:${theme};min-height:1.5rem;}
.bcl-board{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;padding:18px;background:#fff;border-radius:24px;box-shadow:var(--shadow);}
.bcl-pad{width:120px;height:120px;border-radius:24px;background:color-mix(in srgb,var(--bcl-color,#888) 35%,#fff);box-shadow:inset 0 -6px 8px rgba(0,0,0,.15),var(--shadow);cursor:pointer;transition:transform .1s,background .15s;border:none;}
.bcl-pad:active{transform:scale(.94);}
.bcl-pad--lit{background:var(--bcl-color,#888);transform:scale(1.05);box-shadow:0 0 24px var(--bcl-color,#888),inset 0 -4px 6px rgba(0,0,0,.2);}
.bcl-progress{display:flex;gap:8px;}
.bcl-dot{width:14px;height:14px;border-radius:50%;background:#e0e0e0;}
.bcl-dot--done{background:${theme};}
@media (max-width:360px){.bcl-pad{width:100px;height:100px;}}
`;
}

export function create(): BeatClapGame {
  return new BeatClapGame();
}
