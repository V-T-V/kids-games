/* 音阶上行 Scale Up —— 听一段从低到高的上行音阶（Do Re Mi Fa Sol La Si），
   从选项里选出"弹对的顺序"。
   独特点：上行方向 + 顺序记忆。
   巧思：用 playMelody 播正确上行；选项里混入"下行/乱序/缺音"等错误顺序。
   难度=轮数；通关=答对目标轮数。前缀 scu-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { playMelody, sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

// 用唱名展示，便于 3-6 岁理解
const UP = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
const UP_NOTES = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"];

// 错误顺序模板（保证永远有正确选项 + 多个错误选项）
const WRONG_TEMPLATES: string[][] = [
  ["Si", "La", "Sol", "Fa", "Mi", "Re", "Do"], // 下行
  ["Do", "Mi", "Re", "Fa", "Sol", "La", "Si"], // 2/3 颠倒
  ["Do", "Re", "Mi", "Sol", "Fa", "La", "Si"], // 4/5 颠倒
  ["Re", "Do", "Mi", "Fa", "Sol", "La", "Si"], // 1/2 颠倒
];

export class ScaleUpGame extends BaseGame {
  constructor() {
    super("scale-up");
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
    this.trackTimeout(() => playMelody(UP_NOTES, 0.32), 500);
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "scu-wrap";

    const task = document.createElement("div");
    task.className = "scu-task";
    task.innerHTML = `听这段<b>上行</b>音阶，选出弹对的顺序。<small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const speaker = document.createElement("button");
    speaker.type = "button";
    speaker.className = "scu-speaker";
    speaker.textContent = "🔊 再听一遍";
    speaker.addEventListener("click", () => playMelody(UP_NOTES, 0.32));
    wrap.appendChild(speaker);

    // 生成选项：正确 + N 个错误（按难度取数）
    const choiceN =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const wrongs = shuffle(WRONG_TEMPLATES).slice(0, choiceN - 1);
    const options = shuffle([UP, ...wrongs]);

    const opts = document.createElement("div");
    opts.className = "scu-opts";
    for (const seq of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "scu-opt";
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
    const ok = seq.join("|") === UP.join("|");
    if (ok) {
      btn.classList.add("scu-opt--correct");
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
      btn.classList.add("scu-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".scu-opt--wrong")
          .forEach((el) => el.classList.remove("scu-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("scu-style")) return;
    const st = document.createElement("style");
    st.id = "scu-style";
    st.textContent = SCU_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function SCU_CSS(theme: string): string {
  return `
.scu-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.scu-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:460px;}
.scu-task b{color:${theme};}
.scu-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.scu-speaker{padding:16px 30px;border:none;border-radius:999px;background:linear-gradient(135deg,${theme},#6ab0ff);color:#fff;font-size:1.15rem;font-weight:900;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s ease;}
.scu-speaker:active{transform:scale(.94);}
.scu-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:460px;}
.scu-opt{padding:16px 14px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#e9f2ff);box-shadow:var(--shadow);cursor:pointer;font-size:1.05rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:56px;line-height:1.5;}
.scu-opt:active{transform:scale(.97);}
.scu-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:scu-yes .4s ease;}
@keyframes scu-yes{0%{transform:scale(1)}50%{transform:scale(1.04)}100%{transform:scale(1)}}
.scu-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:scu-no .3s ease;}
@keyframes scu-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ScaleUpGame {
  return new ScaleUpGame();
}
