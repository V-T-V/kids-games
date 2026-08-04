/* 投球练习 Throw Ball —— 屏幕演示球划弧线飞进篮筐，孩子站起来模仿投球动作，
   按计数按钮记下投了几次，做够目标次数点"我投完啦"得分。
   大动作启蒙：真实身体投掷练习，鼓励孩子动起来。前缀 tb-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

const TARGETS = ["🗑️", "🧺", "📦", "🛒"];

export class ThrowBallGame extends BaseGame {
  constructor() {
    super("throw-ball");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private goal = 0; // 本关要投几次
  private count = 0; // 当前已投次数
  private target = "🗑️";
  private phase: "demo" | "play" = "demo";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* 所有定时器走 trackTimeout，无裸 setInterval 需清理 */
  }

  private throws(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 5
        : 8;
  }

  private startRound(): void {
    this.count = 0;
    this.goal = this.throws();
    this.target = TARGETS[Math.floor(Math.random() * TARGETS.length)]!;
    this.phase = "demo";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.renderDemo();
    // 演示播放约 2.2s 后进入"该你啦"
    this.trackTimeout(() => this.renderPlay(), 2400);
  }

  /** 演示阶段：球划弧线飞向篮筐。 */
  private renderDemo(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "tb-wrap";

    const task = document.createElement("div");
    task.className = "tb-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 看准<b>篮筐</b>，把球投进去！`;
    wrap.appendChild(task);

    const arena = document.createElement("div");
    arena.className = "tb-arena";
    arena.innerHTML = `
      <div class="tb-ball tb-ball--demo">🤾</div>
      <div class="tb-orbit"></div>
      <div class="tb-target">${this.target}</div>
    `;
    wrap.appendChild(arena);

    const hint = document.createElement("div");
    hint.className = "tb-hint";
    hint.innerHTML = `👀 看演示～ 投球要<b>举手、瞄准、用力扔</b>`;
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
  }

  /** 互动阶段：孩子真实投球，点计数。 */
  private renderPlay(): void {
    this.phase = "play";
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "tb-wrap";

    const task = document.createElement("div");
    task.className = "tb-task";
    task.innerHTML = `该你啦！站起来<b>投 ${this.goal} 次球</b>`;
    wrap.appendChild(task);

    const arena = document.createElement("div");
    arena.className = "tb-arena";
    arena.innerHTML = `
      <div class="tb-cheer">🙌</div>
      <div class="tb-target tb-target--play">${this.target}</div>
    `;
    wrap.appendChild(arena);

    const counter = document.createElement("div");
    counter.className = "tb-counter";
    counter.id = "tb-counter";
    counter.innerHTML = this.counterHTML();
    wrap.appendChild(counter);

    const btnRow = document.createElement("div");
    btnRow.className = "tb-row";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "tb-add";
    addBtn.id = "tb-add";
    addBtn.innerHTML = `➕ 投了 1 次`;
    addBtn.addEventListener("click", () => this.addOne(addBtn));
    btnRow.appendChild(addBtn);

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "tb-done";
    doneBtn.id = "tb-done";
    doneBtn.disabled = true;
    doneBtn.textContent = "✅ 我投完啦";
    doneBtn.addEventListener("click", () => this.finish(doneBtn));
    btnRow.appendChild(doneBtn);

    wrap.appendChild(btnRow);
    this.root.appendChild(wrap);
  }

  private counterHTML(): string {
    const dots = Array.from({ length: this.goal }, (_, i) => {
      const done = i < this.count;
      return `<span class="tb-dot${done ? " tb-dot--done" : ""}"></span>`;
    }).join("");
    return `<div class="tb-count">${this.count}<small> / ${this.goal}</small></div>
            <div class="tb-dots">${dots}</div>`;
  }

  private refreshCounter(): void {
    const el = this.root.querySelector<HTMLElement>("#tb-counter");
    if (el) el.innerHTML = this.counterHTML();
  }

  private addOne(btn: HTMLButtonElement): void {
    if (this.phase !== "play") return;
    if (this.count >= this.goal) return;
    this.count += 1;
    sfxPop();
    const r = btn.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top);
    this.resetWrongStreak();
    this.refreshCounter();
    const doneBtn = this.root.querySelector<HTMLButtonElement>("#tb-done");
    if (this.count >= this.goal && doneBtn) {
      doneBtn.disabled = false;
      doneBtn.classList.add("tb-done--ready");
    }
  }

  private finish(btn: HTMLButtonElement): void {
    if (this.phase !== "play") return;
    if (this.count < this.goal) {
      // 还没投够 —— 温柔提示，不算对也不算错（不调用 onWrong 以免误触护盾）
      this.showRest();
      return;
    }
    this.phase = "demo";
    const r = btn.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    // 庆祝一瞬
    this.root
      .querySelector(".tb-cheer")
      ?.setAttribute("style", "animation:tb-pop .4s ease");
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal)
        this.finishClear(starsByAccuracy(this.wrongCount));
      else this.startRound();
    }, 1200);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "再多投几次哦～",
      emoji: "🤾",
      variant: "rest",
      body: "站起来，举手瞄准篮筐，用力把球投出去！投够次数再点「我投完啦」。",
      primary: { text: "继续投", icon: "➕", onClick: () => ov.destroy() },
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
    if (document.getElementById("tb-style")) return;
    const st = document.createElement("style");
    st.id = "tb-style";
    st.textContent = TB_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function TB_CSS(theme: string): string {
  return `
.tb-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(440px,100%);}
.tb-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.tb-task b{color:${theme};}
.tb-arena{position:relative;width:300px;height:180px;border-radius:24px;background:linear-gradient(180deg,#fff7ed 0%,#ffe8d1 60%,#ffd5a8 100%);box-shadow:var(--shadow);overflow:hidden;display:flex;align-items:flex-end;justify-content:center;}
.tb-target{font-size:4.5rem;line-height:1;margin-bottom:8px;filter:drop-shadow(0 4px 6px rgba(0,0,0,.15));}
.tb-target--play{animation:tb-wiggle 1.6s ease-in-out infinite;}
@keyframes tb-wiggle{0%,100%{transform:translateX(-6px) rotate(-3deg)}50%{transform:translateX(6px) rotate(3deg)}}
.tb-ball{font-size:3rem;line-height:1;position:absolute;left:30px;bottom:20px;}
.tb-ball--demo{animation:tb-throw 1s cubic-bezier(.34,1.1,.64,1) .8s both;}
@keyframes tb-throw{0%{transform:translate(0,0) rotate(-20deg);opacity:0}10%{opacity:1}55%{transform:translate(140px,-130px) rotate(180deg)}90%{transform:translate(230px,-10px) rotate(360deg);opacity:1}100%{transform:translate(230px,0) rotate(360deg);opacity:.4}}
.tb-orbit{position:absolute;left:30px;bottom:40px;width:240px;height:150px;border-top:3px dashed ${theme};border-radius:50%/100% 100% 0 0;opacity:.35;}
.tb-hint{font-size:1rem;font-weight:700;color:var(--ink-soft);text-align:center;}
.tb-hint b{color:${theme};}
.tb-cheer{position:absolute;top:18px;font-size:3.2rem;animation:tb-bob 1s ease-in-out infinite;}
@keyframes tb-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes tb-pop{0%{transform:scale(1)}50%{transform:scale(1.4)}100%{transform:scale(1)}}
.tb-counter{display:flex;flex-direction:column;align-items:center;gap:8px;background:#fff;padding:12px 24px;border-radius:20px;box-shadow:var(--shadow);}
.tb-count{font-size:2rem;font-weight:900;color:${theme};line-height:1;}
.tb-count small{font-size:1.1rem;color:var(--ink-soft);font-weight:700;}
.tb-dots{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:240px;}
.tb-dot{width:16px;height:16px;border-radius:50%;background:#ececec;}
.tb-dot--done{background:${theme};}
.tb-row{display:flex;gap:12px;}
.tb-add,.tb-done{padding:16px 26px;border:none;border-radius:999px;font-size:1.2rem;font-weight:900;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;min-height:48px;}
.tb-add{background:linear-gradient(135deg,${theme},#ffb877);color:#fff;}
.tb-add:active{transform:scale(.93);}
.tb-done{background:linear-gradient(135deg,#bbb,#ccc);color:#fff;}
.tb-done:disabled{opacity:.55;cursor:not-allowed;}
.tb-done--ready{background:linear-gradient(135deg,#6bcf7f,#4a9d57);animation:tb-pulse 1s ease-in-out infinite;}
@keyframes tb-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.tb-done--ready:active{transform:scale(.93);}
@media (max-width:380px){.tb-arena{width:260px;height:160px;}.tb-target{font-size:3.6rem;}.tb-ball{font-size:2.4rem;}}
`;
}

export function create(): ThrowBallGame {
  return new ThrowBallGame();
}
