/* 跟我做动作 Follow Action —— 屏幕依次播放一组大动作（举手/跺脚/扭腰/拍手/
   点头/转身），每个动作用大 emoji + 文字 + CSS 演示动画，播完一组后孩子照着
   做完身体动作，点"我做完了"得分。3-4 岁友好大动作模仿。前缀 fwa-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 动作库：emoji / 名称 / 动词 / 演示动画 class。 */
const ACTIONS: { emoji: string; name: string; verb: string; anim: string }[] = [
  { emoji: "🙌", name: "举手", verb: "把小手举高高", anim: "fwa-raise" },
  { emoji: "🦶", name: "跺脚", verb: "用力跺一跺脚", anim: "fwa-stomp" },
  { emoji: "💃", name: "扭腰", verb: "扭一扭小腰", anim: "fwa-twist" },
  { emoji: "👏", name: "拍手", verb: "拍几下手", anim: "fwa-clap" },
  { emoji: "🙆", name: "点头", verb: "点一点头", anim: "fwa-nod" },
  { emoji: "🔄", name: "转身", verb: "转一个圈", anim: "fwa-turn" },
];

export class FollowActionGame extends BaseGame {
  constructor() {
    super("follow-action");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private group: typeof ACTIONS = [];
  private playIdx = 0;
  private phase: "play" | "done" = "play";

  protected mount(): void {
    this.roundTotal = 3; // 共做 3 组
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* 所有定时器走 trackTimeout，无裸 setInterval 需清理 */
  }

  /** 一组里放几个动作。 */
  private groupSize(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.group = shuffle(ACTIONS).slice(0, this.groupSize());
    this.playIdx = 0;
    this.phase = "play";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.renderShell();
    this.trackTimeout(() => this.playNext(), 500);
  }

  /** 渲染静态壳子（任务条 + 大舞台 + 进度点）。 */
  private renderShell(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "fwa-wrap";

    const task = document.createElement("div");
    task.className = "fwa-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 组 · 仔细看<b>动作</b>，跟着做！`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "fwa-stage";
    stage.id = "fwa-stage";
    wrap.appendChild(stage);

    const hint = document.createElement("div");
    hint.className = "fwa-hint";
    hint.id = "fwa-hint";
    hint.textContent = "👀 看仔细…";
    wrap.appendChild(hint);

    const dots = document.createElement("div");
    dots.className = "fwa-dots";
    dots.id = "fwa-dots";
    wrap.appendChild(dots);

    const actionsHolder = document.createElement("div");
    actionsHolder.className = "fwa-actions";
    actionsHolder.id = "fwa-actions";
    wrap.appendChild(actionsHolder);

    this.root.appendChild(wrap);
    this.renderDots();
    this.renderActionList();
  }

  private renderDots(): void {
    const el = this.root.querySelector<HTMLElement>("#fwa-dots");
    if (!el) return;
    el.innerHTML = "";
    for (let i = 0; i < this.group.length; i++) {
      const d = document.createElement("div");
      d.className = "fwa-dot";
      if (i < this.playIdx) d.classList.add("fwa-dot--done");
      el.appendChild(d);
    }
  }

  /** 列出本组要做的动作（小卡片提示）。 */
  private renderActionList(): void {
    const el = this.root.querySelector<HTMLElement>("#fwa-actions");
    if (!el) return;
    el.innerHTML = "";
    this.group.forEach((a) => {
      const c = document.createElement("div");
      c.className = "fwa-chip";
      c.innerHTML = `<span class="fwa-chip__e">${a.emoji}</span><span>${a.name}</span>`;
      el.appendChild(c);
    });
  }

  private setStage(action: (typeof ACTIONS)[number]): void {
    const stage = this.root.querySelector<HTMLElement>("#fwa-stage");
    if (!stage) return;
    stage.innerHTML = `
      <div class="fwa-emoji fwa-anim--${action.anim}">${action.emoji}</div>
      <div class="fwa-name">${action.name}</div>
      <div class="fwa-verb">${action.verb}～</div>
    `;
  }

  private setHint(t: string): void {
    const h = this.root.querySelector<HTMLElement>("#fwa-hint");
    if (h) h.textContent = t;
  }

  /** 依次播放每个动作 2 秒，全部播完后给出"跟着做"确认按钮。 */
  private playNext(): void {
    if (this.phase !== "play") return;
    if (this.playIdx >= this.group.length) {
      this.afterGroup();
      return;
    }
    const action = this.group[this.playIdx]!;
    this.setStage(action);
    this.setHint(`👀 第 ${this.playIdx + 1} 个：${action.name}`);
    sfxPop();
    this.playIdx += 1;
    this.renderDots();
    this.trackTimeout(() => this.playNext(), 2000);
  }

  /** 一组播完：提示跟着做，显示确认按钮。 */
  private afterGroup(): void {
    this.setHint("🤸 该你做啦！站起来照着做～");
    const stage = this.root.querySelector<HTMLElement>("#fwa-stage");
    if (stage) {
      stage.innerHTML = `<div class="fwa-emoji fwa-anim--fwa-cheer">🎉</div>
        <div class="fwa-name">全部跟上！</div>`;
    }
    const wrap = this.root.querySelector(".fwa-wrap");
    if (!wrap) return;
    // 防重复按钮
    if (wrap.querySelector("#fwa-done")) return;
    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "fwa-done";
    doneBtn.id = "fwa-done";
    doneBtn.textContent = "✅ 我做完了！";
    doneBtn.addEventListener("click", () => this.confirm(doneBtn));
    wrap.appendChild(doneBtn);
  }

  private confirm(btn: HTMLButtonElement): void {
    if (this.phase !== "play") return;
    this.phase = "done";
    btn.classList.add("fwa-done--ok");
    sfxPop();
    const r = btn.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top);
    this.resetWrongStreak();
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.setHint("🎉 跟得太棒啦！");
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal)
        this.finishClear(starsByAccuracy(this.wrongCount));
      else this.startRound();
    }, 1200);
  }

  private injectStyle(): void {
    if (document.getElementById("fwa-style")) return;
    const st = document.createElement("style");
    st.id = "fwa-style";
    st.textContent = FA_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function FA_CSS(theme: string): string {
  return `
.fwa-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.fwa-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.fwa-task b{color:${theme};}
.fwa-stage{width:200px;height:200px;border-radius:50%;background:linear-gradient(135deg,#f3e8ff,#e9d5ff);box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;}
.fwa-emoji{font-size:5.4rem;line-height:1;}
.fwa-name{font-size:1.5rem;font-weight:900;color:${theme};}
.fwa-verb{font-size:.95rem;font-weight:700;color:var(--ink-soft);}
.fwa-hint{font-size:1.1rem;font-weight:900;color:${theme};min-height:1.4rem;text-align:center;}
.fwa-dots{display:flex;gap:8px;}
.fwa-dot{width:14px;height:14px;border-radius:50%;background:#e0e0e0;}
.fwa-dot--done{background:${theme};}
.fwa-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:340px;}
.fwa-chip{display:flex;align-items:center;gap:4px;background:#fff;padding:6px 12px;border-radius:999px;box-shadow:var(--shadow);font-size:.9rem;font-weight:700;color:var(--ink-soft);}
.fwa-chip__e{font-size:1.3rem;}
.fwa-done{margin-top:6px;padding:18px 48px;border:none;border-radius:999px;background:linear-gradient(135deg,${theme},#c084fc);color:#fff;font-size:1.3rem;font-weight:900;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;min-height:48px;animation:fwa-pulse 1s ease-in-out infinite;}
@keyframes fwa-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.fwa-done:active{transform:scale(.93);}
.fwa-done--ok{background:linear-gradient(135deg,#6bcf7f,#4a9d57);animation:none;}
/* 单个动作演示动画 —— 每个动作有不同的身体动作意象 */
@keyframes fwa-raise{0%,100%{transform:translateY(0)}50%{transform:translateY(-26px)}}
@keyframes fwa-stomp{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-6px) rotate(-6deg)}50%{transform:translateY(8px) rotate(6deg)}75%{transform:translateY(-6px) rotate(-4deg)}}
@keyframes fwa-twist{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg)}75%{transform:rotate(14deg)}}
@keyframes fwa-clap{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
@keyframes fwa-nod{0%,100%{transform:rotate(0)}25%{transform:rotate(14deg)}75%{transform:rotate(-14deg)}}
@keyframes fwa-turn{0%{transform:rotate(0) scale(1)}50%{transform:rotate(180deg) scale(.9)}100%{transform:rotate(360deg) scale(1)}}
@keyframes fwa-cheer{0%,100%{transform:scale(1) rotate(-6deg)}50%{transform:scale(1.18) rotate(6deg)}}
.fwa-anim--fwa-raise{animation:fwa-raise .8s ease-in-out infinite;}
.fwa-anim--fwa-stomp{animation:fwa-stomp .7s ease-in-out infinite;}
.fwa-anim--fwa-twist{animation:fwa-twist .8s ease-in-out infinite;}
.fwa-anim--fwa-clap{animation:fwa-clap .6s ease-in-out infinite;}
.fwa-anim--fwa-nod{animation:fwa-nod .7s ease-in-out infinite;}
.fwa-anim--fwa-turn{animation:fwa-turn 1.4s ease-in-out infinite;}
.fwa-anim--fwa-cheer{animation:fwa-cheer .8s ease-in-out infinite;}
@media (max-width:380px){.fwa-stage{width:170px;height:170px;}.fwa-emoji{font-size:4.4rem;}.fwa-name{font-size:1.3rem;}}
`;
}

export function create(): FollowActionGame {
  return new FollowActionGame();
}
