/* 团队任务 Team Task —— 把任务分给最合适的小朋友（谁做什么）。
   社交启蒙：分工协作，按特长分配。独特点：给出一项任务 + 几个小朋友，
   每人各有特长标记，选出最合适的人。前缀 tmt-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Kid {
  emoji: string;
  name: string;
  /** 特长标签 */
  skill: string;
}
interface Task {
  /** 任务图 */
  icon: string;
  /** 任务描述 */
  text: string;
  /** 需要的特长（与 Kid.skill 匹配） */
  need: string;
}

const KIDS_POOL: Kid[] = [
  { emoji: "👦", name: "小明", skill: "力气大" },
  { emoji: "👧", name: "小红", skill: "会画画" },
  { emoji: "🧒", name: "小军", skill: "会唱歌" },
  { emoji: "👼", name: "小美", skill: "认识字" },
  { emoji: "👶", name: "小宝", skill: "个子高" },
  { emoji: "🧑", name: "小乐", skill: "跑得快" },
];

const TASKS: Task[] = [
  { icon: "🪣", text: "搬一桶水", need: "力气大" },
  { icon: "🎨", text: "画一张海报", need: "会画画" },
  { icon: "🎤", text: "领唱儿歌", need: "会唱歌" },
  { icon: "📖", text: "念一段故事", need: "认识字" },
  { icon: "🏀", text: "高处挂东西", need: "个子高" },
  { icon: "📨", text: "跑去送信", need: "跑得快" },
  { icon: "📦", text: "搬动大箱子", need: "力气大" },
  { icon: "🖼️", text: "布置黑板画", need: "会画画" },
];

export class TeamTaskGame extends BaseGame {
  constructor() {
    super("team-task");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const task = sample(TASKS);
    // 选出"对的"小朋友 + 2 个干扰
    const right = KIDS_POOL.filter((k) => k.skill === task.need);
    const rightKid = sample(right);
    const others = shuffle(
      KIDS_POOL.filter((k) => k.skill !== task.need),
    ).slice(0, 2);
    const choices = shuffle([rightKid, ...others]);

    const wrap = document.createElement("div");
    wrap.className = "tmt-wrap";

    const taskEl = document.createElement("div");
    taskEl.className = "tmt-task";
    taskEl.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 这个任务<b>交给谁</b>最合适？`;
    wrap.appendChild(taskEl);

    const card = document.createElement("div");
    card.className = "tmt-job";
    card.innerHTML = `<div class="tmt-job__icon">${task.icon}</div><div class="tmt-job__text">${task.text}</div>`;
    wrap.appendChild(card);

    const hint = document.createElement("div");
    hint.className = "tmt-hint";
    hint.innerHTML = `👉 看看每个小朋友<b>擅长什么</b>`;
    wrap.appendChild(hint);

    const opts = document.createElement("div");
    opts.className = "tmt-opts";
    choices.forEach((k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tmt-opt";
      b.innerHTML = `<div class="tmt-opt__emoji">${k.emoji}</div><div class="tmt-opt__name">${k.name}</div><div class="tmt-opt__skill">${k.skill}</div>`;
      b.addEventListener("click", () => this.choose(k.skill === task.need, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(right: boolean, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (right) {
      this.locked = true;
      sfxPop();
      btn.classList.add("tmt-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("tmt-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("tmt-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "👥",
      variant: "rest",
      body: "把任务交给最擅长的人去做，又快又好～看看每个小朋友的特长卡片～",
      primary: { text: "继续", icon: "👍", onClick: () => ov.destroy() },
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
    if (document.getElementById("tmt-style")) return;
    const st = document.createElement("style");
    st.id = "tmt-style";
    st.textContent = TMT_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function TMT_CSS(theme: string): string {
  return `
.tmt-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.tmt-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.tmt-task b{color:${theme};}
.tmt-job{display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,#e9fbe9,#d4f4d4);padding:18px 24px;border-radius:20px;box-shadow:var(--shadow);}
.tmt-job__icon{font-size:2.8rem;}
.tmt-job__text{font-size:1.2rem;font-weight:900;color:#3a5a3a;}
.tmt-hint{font-size:.95rem;font-weight:800;color:#666;}
.tmt-hint b{color:${theme};}
.tmt-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.tmt-opt{display:flex;flex-direction:column;align-items:center;gap:4px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;cursor:pointer;transition:transform .12s;width:104px;}
.tmt-opt:active{transform:scale(.93);}
.tmt-opt__emoji{font-size:2.6rem;}
.tmt-opt__name{font-size:1rem;font-weight:900;color:#444;}
.tmt-opt__skill{font-size:.8rem;font-weight:900;color:#fff;background:${theme};padding:2px 10px;border-radius:999px;}
.tmt-opt--done{background:#d4f4dd;animation:tmt-pop .4s ease;}
.tmt-opt--wrong{background:#ffe0e0;animation:tmt-shake .4s ease;}
@keyframes tmt-pop{0%{transform:scale(.7)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes tmt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): TeamTaskGame {
  return new TeamTaskGame();
}
