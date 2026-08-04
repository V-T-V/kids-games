/* 节拍速度 Tempo Game —— 听两段节奏（一快一慢），按要求选出更快/更慢的那段。
   独特点：节奏速度（tempo）的比较听感。
   巧思：两段都用同样的 4 拍"嗒嗒嗒嗒"，只有间隔不同；题目随机问"哪个更快"或"哪个更慢"。
   难度=轮数；通关=答对目标轮数。前缀 tmp-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

export class TempoGame extends BaseGame {
  constructor() {
    super("tempo-game");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  // 哪一段更快：0 = 第一段更快，1 = 第二段更快
  private fasterIdx = 0;
  // 本轮问题：true=问"哪个更快"，false=问"哪个更慢"
  private askFaster = true;
  private playing = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空；定时器由基类清理 */
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.fasterIdx = sample([0, 1]);
    this.askFaster = sample([true, false]);
    this.render();
    // 自动先播放两段
    this.trackTimeout(() => this.playBoth(), 500);
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "tmp-wrap";

    const task = document.createElement("div");
    task.className = "tmp-task";
    task.innerHTML = `听两段节奏，选出<b>${this.askFaster ? "更快" : "更慢"}</b>的那段。<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "tmp-hint";
    hint.id = "tmp-hint";
    hint.textContent = "正在播放…仔细听哦";
    wrap.appendChild(hint);

    const stages = document.createElement("div");
    stages.className = "tmp-stages";
    for (let i = 0; i < 2; i++) {
      const s = document.createElement("button");
      s.type = "button";
      s.className = "tmp-stage";
      s.dataset.idx = String(i);
      s.innerHTML = `<span class="tmp-stage__emoji">🥁</span><span class="tmp-stage__n">第 ${i + 1} 段</span>`;
      s.addEventListener("click", () => this.choose(i, s));
      stages.appendChild(s);
    }
    wrap.appendChild(stages);

    const replay = document.createElement("button");
    replay.type = "button";
    replay.className = "tmp-replay";
    replay.textContent = "🔁 再听一遍";
    replay.addEventListener("click", () => {
      if (!this.playing) this.playBoth();
    });
    wrap.appendChild(replay);

    this.root.appendChild(wrap);
  }

  /** 依次播放两段：快的间隔短，慢的间隔长。每段 4 拍。 */
  private playBoth(): void {
    if (this.playing) return;
    this.playing = true;
    const fastGap = this.difficulty === "hard" ? 180 : 220;
    const slowGap = this.difficulty === "hard" ? 480 : 460;
    const gaps = [
      this.fasterIdx === 0 ? fastGap : slowGap,
      this.fasterIdx === 1 ? fastGap : slowGap,
    ];
    let elapsed = 0;
    for (let seg = 0; seg < 2; seg++) {
      const stage = this.root.querySelector<HTMLElement>(
        `.tmp-stage[data-idx="${seg}"]`,
      );
      for (let beat = 0; beat < 4; beat++) {
        const segIdx = seg;
        const stIdx = beat;
        this.trackTimeout(() => {
          this.tick(segIdx);
          if (stage) {
            stage.classList.add("tmp-stage--beat");
            this.trackTimeout(
              () => stage.classList.remove("tmp-stage--beat"),
              gaps[segIdx]! / 2,
            );
          }
          void stIdx;
        }, elapsed);
        elapsed += gaps[seg]!;
      }
      elapsed += 500; // 两段之间留白
    }
    this.trackTimeout(() => {
      this.playing = false;
      const h = this.root.querySelector("#tmp-hint");
      if (h) h.textContent = "选一选吧～";
    }, elapsed);
  }

  /** 单个节拍音（短促鼓点）。 */
  private tick(_seg: number): void {
    void _seg;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    let ctx = (window as unknown as { __tmpCtx?: AudioContext }).__tmpCtx;
    if (!ctx) {
      try {
        ctx = new AC();
        (window as unknown as { __tmpCtx?: AudioContext }).__tmpCtx = ctx;
      } catch {
        return;
      }
    }
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(300, t0);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.12);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.18);
  }

  private choose(i: number, btn: HTMLButtonElement): void {
    if (this.answered || this.playing) return;
    this.answered = true;
    const correct = this.askFaster ? this.fasterIdx : 1 - this.fasterIdx;
    const ok = i === correct;
    if (ok) {
      btn.classList.add("tmp-stage--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      sfxPop();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("tmp-stage--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".tmp-stage--wrong")
          .forEach((el) => el.classList.remove("tmp-stage--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("tmp-style")) return;
    const st = document.createElement("style");
    st.id = "tmp-style";
    st.textContent = TMP_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function TMP_CSS(theme: string): string {
  return `
.tmp-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.tmp-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.tmp-task b{color:${theme};}
.tmp-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.tmp-hint{font-size:1rem;font-weight:800;color:${theme};background:rgba(255,255,255,.7);padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.tmp-stages{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;width:100%;max-width:420px;}
@media (max-width:380px){.tmp-stages{grid-template-columns:1fr;}}
.tmp-stage{padding:24px 12px;border:3px solid transparent;border-radius:18px;background:linear-gradient(160deg,#fff,#fff2e6);box-shadow:var(--shadow);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;transition:transform .12s ease,border-color .2s ease,background .2s ease;}
.tmp-stage:active{transform:scale(.96);}
.tmp-stage__emoji{font-size:3rem;filter:drop-shadow(0 3px 4px rgba(0,0,0,.15));}
.tmp-stage__n{font-size:1.05rem;font-weight:800;color:var(--ink);}
.tmp-stage--beat{background:linear-gradient(160deg,#fff3df,#ffd9a8);transform:scale(1.04);}
.tmp-stage--correct{border-color:#6bcf7f;background:#e8fbe8;animation:tmp-yes .4s ease;}
@keyframes tmp-yes{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
.tmp-stage--wrong{border-color:#ff6348;background:#ffeae6;animation:tmp-no .3s ease;}
@keyframes tmp-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.tmp-replay{margin-top:4px;padding:10px 22px;border:none;border-radius:999px;background:rgba(255,255,255,.8);color:var(--ink);font-size:.95rem;font-weight:800;cursor:pointer;box-shadow:var(--shadow);}
.tmp-replay:active{transform:scale(.94);}
`;
}

export function create(): TempoGame {
  return new TempoGame();
}
