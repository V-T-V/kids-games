/* 舞步记忆 Dance Step —— 4-6 个动作 emoji 按顺序展示（高亮播放），
   孩子按相同顺序点击复现。顺序对通关；错则重看一遍。
   独特点：序列记忆 + 身体动作联想（拍手/跺脚/转圈/挥手）。
   难度=序列长度。前缀 dstp-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxTick } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

const MOVES: { emoji: string; name: string }[] = [
  { emoji: "👏", name: "拍手" },
  { emoji: "🦶", name: "跺脚" },
  { emoji: "🔄", name: "转圈" },
  { emoji: "👋", name: "挥手" },
  { emoji: "💃", name: "扭腰" },
  { emoji: "🤸", name: "跳跃" },
];

type Phase = "playing" | "input" | "feedback";

export class DanceStepGame extends BaseGame {
  constructor() {
    super("dance-step");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private seq: { emoji: string; name: string }[] = [];
  private pool: { emoji: string; name: string }[] = [];
  private inputIdx = 0;
  private phase: Phase = "playing";
  private showing = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 与定时器由基类清理 */
  }

  private startRound(): void {
    this.reportProgress(this.roundsDone, this.roundTotal);
    const len =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 6;
    // 选 4 个动作作为本关按钮池，序列从中取
    this.pool = shuffle(MOVES).slice(0, 4);
    this.seq = [];
    for (let i = 0; i < len; i++) {
      this.seq.push(sample(this.pool));
    }
    this.inputIdx = 0;
    this.phase = "playing";
    this.render();
    this.trackTimeout(() => this.playSequence(), 600);
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "dstp-wrap";

    const task = document.createElement("div");
    task.className = "dstp-task";
    const phaseText =
      this.phase === "playing"
        ? "👀 看舞步…"
        : this.phase === "input"
          ? "🤔 轮到你跳啦！"
          : "";
    task.innerHTML = `${phaseText} <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    // 序列槽位（显示已输入进度）
    const slots = document.createElement("div");
    slots.className = "dstp-slots";
    for (let i = 0; i < this.seq.length; i++) {
      const s = document.createElement("div");
      s.className = "dstp-slot";
      s.dataset.i = String(i);
      if (this.phase === "input" && i < this.inputIdx) {
        s.textContent = this.seq[i]!.emoji;
        s.classList.add("dstp-slot--done");
      } else if (this.phase === "input") {
        s.textContent = "?";
      }
      slots.appendChild(s);
    }
    wrap.appendChild(slots);

    // 动作按钮池
    const pad = document.createElement("div");
    pad.className = "dstp-pad";
    for (const m of this.pool) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dstp-move";
      b.dataset.emoji = m.emoji;
      b.innerHTML = `<span class="dstp-move__emoji">${m.emoji}</span><span class="dstp-move__name">${m.name}</span>`;
      b.addEventListener("click", () => this.tap(m, b));
      pad.appendChild(b);
    }
    wrap.appendChild(pad);

    // 重看按钮
    if (this.phase === "input") {
      const replay = document.createElement("button");
      replay.type = "button";
      replay.className = "dstp-replay";
      replay.textContent = "🔁 再看一遍";
      replay.addEventListener("click", () => {
        this.phase = "playing";
        this.inputIdx = 0;
        this.render();
        this.trackTimeout(() => this.playSequence(), 200);
      });
      wrap.appendChild(replay);
    }
    this.root.appendChild(wrap);
  }

  private playSequence(): void {
    if (this.showing) return;
    this.showing = true;
    this.render();
    let i = 0;
    const step = () => {
      if (i >= this.seq.length) {
        this.showing = false;
        this.phase = "input";
        this.inputIdx = 0;
        this.render();
        return;
      }
      const m = this.seq[i]!;
      sfxPop();
      // 高亮对应按钮 + 槽位
      const btn = this.root.querySelector<HTMLButtonElement>(
        `.dstp-move[data-emoji="${m.emoji}"]`,
      );
      if (btn) {
        btn.classList.add("dstp-move--show");
        this.trackTimeout(() => btn.classList.remove("dstp-move--show"), 450);
      }
      i++;
      this.trackTimeout(step, 650);
    };
    step();
  }

  private tap(
    m: { emoji: string; name: string },
    btn: HTMLButtonElement,
  ): void {
    if (this.phase !== "input" || this.showing) return;
    const expected = this.seq[this.inputIdx]!;
    if (m.emoji === expected.emoji) {
      btn.classList.add("dstp-move--correct");
      this.trackTimeout(() => btn.classList.remove("dstp-move--correct"), 350);
      // 更新槽位
      const slot = this.root.querySelector<HTMLElement>(
        `.dstp-slot[data-i="${this.inputIdx}"]`,
      );
      if (slot) {
        slot.textContent = expected.emoji;
        slot.classList.add("dstp-slot--done");
      }
      sfxPop();
      this.inputIdx++;
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top);
      if (this.inputIdx >= this.seq.length) {
        // 本关完成
        this.phase = "feedback";
        this.trackTimeout(() => {
          this.roundsDone++;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 700);
      }
    } else {
      btn.classList.add("dstp-move--wrong");
      sfxTick();
      this.onWrong();
      this.trackTimeout(() => {
        btn.classList.remove("dstp-move--wrong");
        // 重新播放序列
        this.phase = "playing";
        this.inputIdx = 0;
        this.render();
        this.trackTimeout(() => this.playSequence(), 500);
      }, 700);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("dstp-style")) return;
    const st = document.createElement("style");
    st.id = "dstp-style";
    st.textContent = DSTP_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function DSTP_CSS(theme: string): string {
  return `
.dstp-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.dstp-task{font-size:1.1rem;font-weight:800;color:var(--ink);background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.dstp-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.dstp-slots{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;min-height:56px;}
.dstp-slot{width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;background:linear-gradient(160deg,#fff,#f0e6ff);box-shadow:inset 0 -2px 3px rgba(0,0,0,.1);color:#bbb;font-weight:900;transition:background .2s;}
.dstp-slot--done{background:linear-gradient(160deg,#fff,#e8fbe8);color:inherit;animation:dstp-pop .3s ease;}
@keyframes dstp-pop{0%{transform:scale(1.2)}100%{transform:scale(1)}}
.dstp-pad{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:380px;}
.dstp-move{display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 8px;border:3px solid transparent;border-radius:18px;background:linear-gradient(160deg,#fff,#f5edff);box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s,background .2s;}
.dstp-move:active{transform:scale(.94);}
.dstp-move__emoji{font-size:2.4rem;line-height:1;}
.dstp-move__name{font-size:.9rem;font-weight:800;color:var(--ink-soft);}
.dstp-move--show{background:linear-gradient(160deg,${theme},#c89bff);transform:scale(1.1);box-shadow:0 0 24px ${theme};}
.dstp-move--correct{border-color:#6bcf7f;background:#e8fbe8;animation:dstp-yes .3s ease;}
.dstp-move--wrong{border-color:#ff6348;background:#ffeae6;animation:dstp-no .3s ease;}
@keyframes dstp-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes dstp-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.dstp-replay{padding:10px 22px;border:none;border-radius:999px;background:linear-gradient(135deg,#fff,#f0e6ff);color:${theme};font-weight:800;font-size:.95rem;box-shadow:var(--shadow);cursor:pointer;}
@media (max-width:380px){.dstp-slot{width:46px;height:46px;font-size:1.5rem;}.dstp-move__emoji{font-size:2rem;}}
`;
}

export function create(): DanceStepGame {
  return new DanceStepGame();
}
