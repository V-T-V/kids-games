/* 踢球练习 Kick Ball —— 屏幕演示球被脚踢飞，孩子站起来模仿踢腿动作，
   按计数按钮记下踢了几次，做够目标次数点"我踢完啦"得分。
   大动作启蒙：真实踢腿练习，鼓励孩子动起来。前缀 kb-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

const GOALS = ["🥅", "🏥", "🎯", "🏁"];

export class KickBallGame extends BaseGame {
  constructor() {
    super("kick-ball");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private goal = 0;
  private count = 0;
  private goalMark = "🥅";
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

  private kicks(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 5
        : 8;
  }

  private startRound(): void {
    this.count = 0;
    this.goal = this.kicks();
    this.goalMark = GOALS[Math.floor(Math.random() * GOALS.length)]!;
    this.phase = "demo";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.renderDemo();
    this.trackTimeout(() => this.renderPlay(), 2400);
  }

  /** 演示阶段：球被脚踢飞向目标。 */
  private renderDemo(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "kb-wrap";

    const task = document.createElement("div");
    task.className = "kb-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 用脚把球<b>踢出去</b>！`;
    wrap.appendChild(task);

    const arena = document.createElement("div");
    arena.className = "kb-arena";
    arena.innerHTML = `
      <div class="kb-foot">🦶</div>
      <div class="kb-ball kb-ball--demo">⚽</div>
      <div class="kb-trail"></div>
      <div class="kb-goal">${this.goalMark}</div>
    `;
    wrap.appendChild(arena);

    const hint = document.createElement("div");
    hint.className = "kb-hint";
    hint.innerHTML = `👀 看演示～ 踢球要<b>站稳、摆腿、用力踢</b>`;
    wrap.appendChild(hint);

    this.root.appendChild(wrap);
  }

  /** 互动阶段：孩子真实踢球，点计数。 */
  private renderPlay(): void {
    this.phase = "play";
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "kb-wrap";

    const task = document.createElement("div");
    task.className = "kb-task";
    task.innerHTML = `该你啦！站起来<b>踢 ${this.goal} 次球</b>`;
    wrap.appendChild(task);

    const arena = document.createElement("div");
    arena.className = "kb-arena";
    arena.innerHTML = `
      <div class="kb-cheer">🦵</div>
      <div class="kb-goal kb-goal--play">${this.goalMark}</div>
    `;
    wrap.appendChild(arena);

    const counter = document.createElement("div");
    counter.className = "kb-counter";
    counter.id = "kb-counter";
    counter.innerHTML = this.counterHTML();
    wrap.appendChild(counter);

    const btnRow = document.createElement("div");
    btnRow.className = "kb-row";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "kb-add";
    addBtn.id = "kb-add";
    addBtn.innerHTML = `➕ 踢了 1 次`;
    addBtn.addEventListener("click", () => this.addOne(addBtn));
    btnRow.appendChild(addBtn);

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "kb-done";
    doneBtn.id = "kb-done";
    doneBtn.disabled = true;
    doneBtn.textContent = "✅ 我踢完啦";
    doneBtn.addEventListener("click", () => this.finish(doneBtn));
    btnRow.appendChild(doneBtn);

    wrap.appendChild(btnRow);
    this.root.appendChild(wrap);
  }

  private counterHTML(): string {
    const dots = Array.from({ length: this.goal }, (_, i) => {
      const done = i < this.count;
      return `<span class="kb-dot${done ? " kb-dot--done" : ""}"></span>`;
    }).join("");
    return `<div class="kb-count">${this.count}<small> / ${this.goal}</small></div>
            <div class="kb-dots">${dots}</div>`;
  }

  private refreshCounter(): void {
    const el = this.root.querySelector<HTMLElement>("#kb-counter");
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
    const doneBtn = this.root.querySelector<HTMLButtonElement>("#kb-done");
    if (this.count >= this.goal && doneBtn) {
      doneBtn.disabled = false;
      doneBtn.classList.add("kb-done--ready");
    }
  }

  private finish(btn: HTMLButtonElement): void {
    if (this.phase !== "play") return;
    if (this.count < this.goal) {
      this.showRest();
      return;
    }
    this.phase = "demo";
    const r = btn.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root
      .querySelector(".kb-cheer")
      ?.setAttribute("style", "animation:kb-pop .4s ease");
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal)
        this.finishClear(starsByAccuracy(this.wrongCount));
      else this.startRound();
    }, 1200);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "再多踢几次哦～",
      emoji: "⚽",
      variant: "rest",
      body: "站稳一只脚，另一只脚摆起来，用力把球踢出去！踢够次数再点「我踢完啦」。",
      primary: { text: "继续踢", icon: "➕", onClick: () => ov.destroy() },
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
    if (document.getElementById("kb-style")) return;
    const st = document.createElement("style");
    st.id = "kb-style";
    st.textContent = KB_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function KB_CSS(theme: string): string {
  return `
.kb-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(440px,100%);}
.kb-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.kb-task b{color:${theme};}
.kb-arena{position:relative;width:300px;height:180px;border-radius:24px;background:linear-gradient(180deg,#eafaf1 0%,#d4f5e0 60%,#b8ebc9 100%);box-shadow:var(--shadow);overflow:hidden;display:flex;align-items:flex-end;justify-content:center;}
.kb-goal{font-size:4.2rem;line-height:1;margin-bottom:8px;filter:drop-shadow(0 4px 6px rgba(0,0,0,.15));}
.kb-goal--play{animation:kb-wiggle 1.6s ease-in-out infinite;}
@keyframes kb-wiggle{0%,100%{transform:translateX(-5px)}50%{transform:translateX(5px)}}
.kb-foot{position:absolute;left:24px;bottom:18px;font-size:2.6rem;line-height:1;animation:kb-kickfoot 1s ease .8s both;transform-origin:bottom left;}
@keyframes kb-kickfoot{0%,60%{transform:rotate(0)}75%{transform:rotate(-50deg)}90%{transform:rotate(10deg)}100%{transform:rotate(0)}}
.kb-ball{font-size:2.6rem;line-height:1;position:absolute;left:60px;bottom:24px;}
.kb-ball--demo{animation:kb-kickfly 1s cubic-bezier(.3,.8,.5,1) .8s both;}
@keyframes kb-kickfly{0%{transform:translate(0,0) rotate(0);opacity:0}15%{opacity:1}70%{transform:translate(160px,-40px) rotate(420deg)}100%{transform:translate(210px,-8px) rotate(720deg);opacity:.5}}
.kb-trail{position:absolute;left:60px;bottom:40px;width:160px;height:2px;background:linear-gradient(90deg,transparent,${theme});opacity:.3;transform:rotate(-12deg);transform-origin:left;}
.kb-hint{font-size:1rem;font-weight:700;color:var(--ink-soft);text-align:center;}
.kb-hint b{color:${theme};}
.kb-cheer{position:absolute;top:18px;font-size:3.2rem;animation:kb-swing 1s ease-in-out infinite;transform-origin:bottom center;}
@keyframes kb-swing{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(12deg)}}
@keyframes kb-pop{0%{transform:scale(1)}50%{transform:scale(1.4)}100%{transform:scale(1)}}
.kb-counter{display:flex;flex-direction:column;align-items:center;gap:8px;background:#fff;padding:12px 24px;border-radius:20px;box-shadow:var(--shadow);}
.kb-count{font-size:2rem;font-weight:900;color:${theme};line-height:1;}
.kb-count small{font-size:1.1rem;color:var(--ink-soft);font-weight:700;}
.kb-dots{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:240px;}
.kb-dot{width:16px;height:16px;border-radius:50%;background:#ececec;}
.kb-dot--done{background:${theme};}
.kb-row{display:flex;gap:12px;}
.kb-add,.kb-done{padding:16px 26px;border:none;border-radius:999px;font-size:1.2rem;font-weight:900;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;min-height:48px;}
.kb-add{background:linear-gradient(135deg,${theme},#48d1cc);color:#fff;}
.kb-add:active{transform:scale(.93);}
.kb-done{background:linear-gradient(135deg,#bbb,#ccc);color:#fff;}
.kb-done:disabled{opacity:.55;cursor:not-allowed;}
.kb-done--ready{background:linear-gradient(135deg,#ffd93d,#ff9f43);animation:kb-pulse 1s ease-in-out infinite;}
@keyframes kb-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.kb-done--ready:active{transform:scale(.93);}
@media (max-width:380px){.kb-arena{width:260px;height:160px;}.kb-goal{font-size:3.4rem;}.kb-ball{font-size:2.2rem;}}
`;
}

export function create(): KickBallGame {
  return new KickBallGame();
}
