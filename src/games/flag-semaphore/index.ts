/* 旗语字母 Flag Semaphore —— 一个小人举两面旗子，旗子在不同角度代表不同字母。
   简化版：右旗 8 个固定角度对应 A–H。孩子从字母选项里选出对应的字母。
   独特点：角度→符号的编码认知。
   巧思：用 8 个等分角度（每 45°）映射 A–H，视觉直观；难度=字母池大小。
   视觉：小人（emoji）+ 可旋转旗杆 + 彩旗 + 字母选项。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** A–H 对应右旗角度（顺时针，0°=正下方）。按经典旗语"垂直下=Down"序列简化。 */
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
type Letter = (typeof LETTERS)[number];
const ANGLE_OF: Record<Letter, number> = {
  A: 0, // 正下
  B: 45, // 右下
  C: 90, // 右
  D: 135, // 右上
  E: 180, // 正上
  F: 225, // 左上
  G: 270, // 左
  H: 315, // 左下
};

export class FlagSemaphoreGame extends BaseGame {
  constructor() {
    super("flag-semaphore");
  }

  private answer: Letter = "A";
  private choices: Letter[] = [];
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空，无 RAF */
  }

  /** 当前难度可选字母集：easy A–D；medium A–F；hard A–H。 */
  private letterSet(): readonly Letter[] {
    if (this.difficulty === "easy") return ["A", "B", "C", "D"];
    if (this.difficulty === "medium") return ["A", "B", "C", "D", "E", "F"];
    return LETTERS;
  }

  /** 生成保证可解的题：从字母集里随机答案，干扰项互不相同。 */
  private genRound(): { answer: Letter; choices: Letter[] } {
    const set = this.letterSet();
    const answer = sample(set);
    const choiceN =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const pool = shuffle(set.filter((l) => l !== answer));
    const choices = shuffle([answer, ...pool.slice(0, choiceN - 1)]);
    return { answer, choices };
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const { answer, choices } = this.genRound();
    this.answer = answer;
    this.choices = choices;
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "fsf-wrap";

    const task = document.createElement("div");
    task.className = "fsf-task";
    task.innerHTML = `小人举旗在发信号，看看<b>右手的旗</b>朝哪，是哪个字母？ ${this.roundsDone + 1} / ${this.roundTotal}`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "fsf-stage";
    const person = document.createElement("div");
    person.className = "fsf-person";
    person.textContent = "🧍";
    stage.appendChild(person);

    // 右手旗（重点，可旋转）
    const flagR = document.createElement("div");
    flagR.className = "fsf-flag fsf-flag--right";
    flagR.style.setProperty("--fsf-deg", `${ANGLE_OF[this.answer]}deg`);
    flagR.innerHTML = `<span class="fsf-pole"></span><span class="fsf-cloth"></span>`;
    stage.appendChild(flagR);
    // 左手旗（始终朝下，作参考"静止"旗）
    const flagL = document.createElement("div");
    flagL.className = "fsf-flag fsf-flag--left";
    flagL.innerHTML = `<span class="fsf-pole"></span><span class="fsf-cloth"></span>`;
    stage.appendChild(flagL);

    // 角度对照小图（提示口诀）
    const legend = document.createElement("div");
    legend.className = "fsf-legend";
    legend.innerHTML = `下=A · 右下=B · 右=C · 右上=D · 上=E · 左上=F · 左=G · 左下=H`;
    wrap.appendChild(stage);
    wrap.appendChild(legend);

    // 字母选项
    const opts = document.createElement("div");
    opts.className = "fsf-opts";
    for (const l of this.choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fsf-opt";
      b.textContent = l;
      b.addEventListener("click", () => this.choose(l, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(l: Letter, btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    const ok = l === this.answer;
    if (ok) {
      btn.classList.add("fsf-opt--correct");
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
      }, 800);
    } else {
      btn.classList.add("fsf-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".fsf-opt--wrong")
          .forEach((el) => el.classList.remove("fsf-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("fsf-style")) return;
    const st = document.createElement("style");
    st.id = "fsf-style";
    st.textContent = FSF_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function FSF_CSS(theme: string): string {
  return `
.fsf-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;}
.fsf-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;max-width:420px;}
.fsf-task b{color:${theme};}
.fsf-stage{position:relative;width:240px;height:240px;background:radial-gradient(circle at 50% 30%,#fff,#fff3e0);border-radius:24px;box-shadow:var(--shadow);}
.fsf-person{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);font-size:3rem;line-height:1;z-index:2;filter:drop-shadow(0 2px 3px rgba(0,0,0,.2));}
/* 旗子：以小人为中心定位，绕该中心旋转 */
.fsf-flag{position:absolute;left:50%;bottom:48px;width:0;height:0;transform-origin:center center;z-index:3;transition:transform .5s cubic-bezier(.34,1.3,.64,1);}
.fsf-flag--right{transform:rotate(var(--fsf-deg,0deg));}
.fsf-flag--left{transform:rotate(0deg);}
.fsf-pole{position:absolute;left:-2px;top:-2px;width:4px;height:64px;background:linear-gradient(180deg,#8d6e63,#5d4037);border-radius:2px;transform-origin:bottom center;transform:translateY(0);}
.fsf-cloth{position:absolute;left:2px;top:-4px;width:34px;height:24px;background:linear-gradient(135deg,${theme},color-mix(in srgb,${theme} 60%,#000));clip-path:polygon(0 0,100% 30%,100% 70%,0 100%);box-shadow:0 1px 2px rgba(0,0,0,.2);}
/* 让旗杆从小人手部出发：把整组向上偏移并旋转。这里 pole 顶端挂布 */
.fsf-flag .fsf-pole{transform:rotate(0);}
.fsf-flag--left .fsf-cloth{background:linear-gradient(135deg,#ef5350,#c62828);}
.fsf-legend{font-size:.72rem;color:var(--ink-soft);font-weight:700;background:#fff;padding:6px 14px;border-radius:999px;box-shadow:var(--shadow);text-align:center;max-width:380px;line-height:1.5;}
.fsf-opts{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;max-width:380px;}
.fsf-opt{min-width:56px;min-height:56px;padding:6px 14px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#f0f0f5);box-shadow:var(--shadow);cursor:pointer;font-size:1.6rem;font-weight:900;color:${theme};transition:transform .12s ease,border-color .2s ease,background .2s ease;}
.fsf-opt:active{transform:scale(.94);}
.fsf-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:fsf-yes .4s ease;}
@keyframes fsf-yes{0%{transform:scale(1)}50%{transform:scale(1.14)}100%{transform:scale(1)}}
.fsf-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:fsf-no .3s ease;}
@keyframes fsf-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.fsf-stage{width:200px;height:200px;}.fsf-person{font-size:2.4rem;}}
`;
}

export function create(): FlagSemaphoreGame {
  return new FlagSemaphoreGame();
}
