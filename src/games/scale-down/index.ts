/* 音阶下行 Scale Down —— 听一段从高到低的下行音阶（Si La Sol Fa Mi Re Do），
   从选项里选出"弹对的顺序"。
   独特点：下行方向 + 顺序记忆（与 scale-up 互为对照）。
   巧思：用 playMelody 播正确下行；选项里混入"上行/乱序/颠倒"等错误顺序。
   难度=轮数；通关=答对目标轮数。前缀 scd-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { playMelody, sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const DOWN = ["Si", "La", "Sol", "Fa", "Mi", "Re", "Do"];
const DOWN_NOTES = ["B4", "A4", "G4", "F4", "E4", "D4", "C4"];

const WRONG_TEMPLATES: string[][] = [
  ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"], // 上行
  ["Si", "Sol", "La", "Fa", "Mi", "Re", "Do"], // 2/3 颠倒
  ["Si", "La", "Sol", "Mi", "Fa", "Re", "Do"], // 4/5 颠倒
  ["La", "Si", "Sol", "Fa", "Mi", "Re", "Do"], // 1/2 颠倒
];

export class ScaleDownGame extends BaseGame {
  constructor() {
    super("scale-down");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

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
    this.render();
    this.trackTimeout(() => playMelody(DOWN_NOTES, 0.32), 500);
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "scd-wrap";

    const task = document.createElement("div");
    task.className = "scd-task";
    task.innerHTML = `听这段<b>下行</b>音阶，选出弹对的顺序。<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const speaker = document.createElement("button");
    speaker.type = "button";
    speaker.className = "scd-speaker";
    speaker.textContent = "🔊 再听一遍";
    speaker.addEventListener("click", () => playMelody(DOWN_NOTES, 0.32));
    wrap.appendChild(speaker);

    const choiceN =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const wrongs = shuffle(WRONG_TEMPLATES).slice(0, choiceN - 1);
    const options = shuffle([DOWN, ...wrongs]);

    const opts = document.createElement("div");
    opts.className = "scd-opts";
    for (const seq of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "scd-opt";
      b.textContent = seq.join(" → ");
      b.addEventListener("click", () => this.choose(seq, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(seq: string[], btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    const ok = seq.join("|") === DOWN.join("|");
    if (ok) {
      btn.classList.add("scd-opt--correct");
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
      btn.classList.add("scd-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".scd-opt--wrong")
          .forEach((el) => el.classList.remove("scd-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("scd-style")) return;
    const st = document.createElement("style");
    st.id = "scd-style";
    st.textContent = SCD_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function SCD_CSS(theme: string): string {
  return `
.scd-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.scd-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:460px;}
.scd-task b{color:${theme};}
.scd-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.scd-speaker{padding:16px 30px;border:none;border-radius:999px;background:linear-gradient(135deg,${theme},#818cf8);color:#fff;font-size:1.15rem;font-weight:900;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s ease;}
.scd-speaker:active{transform:scale(.94);}
.scd-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:460px;}
.scd-opt{padding:16px 14px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#eaecff);box-shadow:var(--shadow);cursor:pointer;font-size:1.05rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:56px;line-height:1.5;}
.scd-opt:active{transform:scale(.97);}
.scd-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:scd-yes .4s ease;}
@keyframes scd-yes{0%{transform:scale(1)}50%{transform:scale(1.04)}100%{transform:scale(1)}}
.scd-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:scd-no .3s ease;}
@keyframes scd-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ScaleDownGame {
  return new ScaleDownGame();
}
