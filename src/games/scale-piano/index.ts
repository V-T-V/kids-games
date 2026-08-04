/* 音阶钢琴 Scale Piano —— 按从低到高的顺序，依次点出 C 大调的 7 个音（Do Re Mi Fa Sol La Si）。
   独特点：音高顺序认知 + 真实听到每个音。
   巧思：7 个琴键按音高排成钢琴；点对就亮并响；点错温柔提示重来。
   难度=轮数；通关=答对目标轮数。前缀 scl-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { playNote, sfxPop } from "../../core/audio.ts";
import { getCssVar } from "../../lobby/util.ts";

interface KeyDef {
  note: string;
  label: string;
  color: string;
}

// C 大调七音，从低到高
const KEYS: KeyDef[] = [
  { note: "C4", label: "Do", color: "#ff6b9d" },
  { note: "D4", label: "Re", color: "#ff9f43" },
  { note: "E4", label: "Mi", color: "#ffd93d" },
  { note: "F4", label: "Fa", color: "#6bcf7f" },
  { note: "G4", label: "Sol", color: "#22d3ee" },
  { note: "A4", label: "La", color: "#4d96ff" },
  { note: "B4", label: "Si", color: "#a55eea" },
];

export class ScalePianoGame extends BaseGame {
  constructor() {
    super("scale-piano");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private next = 0; // 下一个该按的键的索引（0..6）
  private keyEls: HTMLButtonElement[] = [];

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
    this.root.innerHTML = "";
    this.next = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "scl-wrap";

    const task = document.createElement("div");
    task.className = "scl-task";
    task.innerHTML = `从<b>低</b>到<b>高</b>，按顺序弹出 7 个音（Do → Si）<br><span class="scl-sub">第 ${this.roundsDone + 1} / ${this.roundTotal} 关 · 已弹对 <b id="scl-next">0</b> / 7</span>`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "scl-hint";
    hint.id = "scl-hint";
    hint.textContent = "从最左边（粉色 Do）开始点～";
    wrap.appendChild(hint);

    const board = document.createElement("div");
    board.className = "scl-board";
    this.keyEls = [];
    KEYS.forEach((k, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "scl-key";
      b.style.setProperty("--kc", k.color);
      b.innerHTML = `<span class="scl-key__label">${k.label}</span><span class="scl-key__n">${i + 1}</span>`;
      b.addEventListener("click", () => this.press(i, b));
      board.appendChild(b);
      this.keyEls.push(b);
    });
    wrap.appendChild(board);

    this.root.appendChild(wrap);
  }

  private press(i: number, btn: HTMLButtonElement): void {
    const key = KEYS[i]!;
    // 点任何键都让它响（更有乐器感），但只有点对顺序才计分
    playNote(key.note, 0.35);
    btn.classList.add("scl-key--hit");
    this.trackTimeout(() => btn.classList.remove("scl-key--hit"), 220);

    if (i === this.next) {
      this.next += 1;
      btn.classList.add("scl-key--done");
      const n = this.root.querySelector("#scl-next");
      if (n) n.textContent = String(this.next);
      const hint = this.root.querySelector("#scl-hint");
      if (hint) {
        if (this.next < KEYS.length) {
          hint.textContent = `棒！下一个是 ${KEYS[this.next]!.label}`;
        } else {
          hint.textContent = "全部弹对啦！🎉";
        }
      }
      if (this.next >= KEYS.length) {
        this.resetWrongStreak();
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
        }, 1000);
      }
    } else {
      // 点错了：温柔提示，从头开始这一轮的顺序
      this.onWrong();
      this.next = 0;
      this.keyEls.forEach((el) => el.classList.remove("scl-key--done"));
      const n = this.root.querySelector("#scl-next");
      if (n) n.textContent = "0";
      const hint = this.root.querySelector("#scl-hint");
      if (hint) hint.textContent = "顺序错啦，从最左边重新开始～";
    }
  }

  private injectStyle(): void {
    if (document.getElementById("scl-style")) return;
    const st = document.createElement("style");
    st.id = "scl-style";
    st.textContent = SCL_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function SCL_CSS(theme: string): string {
  return `
.scl-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.scl-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:460px;}
.scl-task b{color:${theme};}
.scl-sub{display:block;margin-top:4px;font-size:.9rem;font-weight:700;color:var(--ink-soft);}
.scl-hint{font-size:1rem;font-weight:800;color:${theme};background:rgba(255,255,255,.7);padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.scl-board{display:flex;gap:6px;padding:14px 10px 18px;background:linear-gradient(#5a4a6a,#3a2e4a);border-radius:18px;box-shadow:var(--shadow);}
.scl-key{flex:1;min-width:0;min-height:150px;border:none;border-radius:0 0 10px 10px;background:linear-gradient(180deg,#fff,var(--kc,#eee));box-shadow:inset 0 -6px 0 rgba(0,0,0,.12);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:10px;gap:4px;transition:transform .08s ease,filter .2s ease;}
.scl-key:active{transform:translateY(3px);}
.scl-key__label{font-size:1.1rem;font-weight:900;color:var(--ink);}
.scl-key__n{font-size:.75rem;font-weight:800;color:var(--ink-soft);}
.scl-key--hit{filter:brightness(1.25);box-shadow:inset 0 -2px 0 rgba(0,0,0,.12),0 0 16px var(--kc);}
.scl-key--done{background:linear-gradient(180deg,#fff,var(--kc));filter:saturate(.7) brightness(1.05);position:relative;}
.scl-key--done::after{content:"✓";position:absolute;top:8px;font-size:1rem;color:#6bcf7f;font-weight:900;}
@media (max-width:420px){.scl-key{min-height:120px;}.scl-key__label{font-size:.95rem;}}
`;
}

export function create(): ScalePianoGame {
  return new ScalePianoGame();
}
