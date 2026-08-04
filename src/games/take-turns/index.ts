/* 轮流发言 Take Turns —— 几个人轮流说话/做事，判断现在该轮到谁了。
   社交启蒙：轮流意识（不抢话、不冷场）。独特点：一行小朋友按顺序，
   标记"刚刚是 X"，选出下一个该轮到的人。前缀 tkt-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Scene {
  /** 人物 emoji 列表 */
  kids: string[];
  /** 名字 */
  names: string[];
  /** 刚刚轮到的人的索引 */
  justSpoke: number;
  /** 场景 */
  activity: string;
}

const ACTIVITIES = ["讲故事", "分享玩具", "唱歌", "念儿歌", "介绍自己"];

function buildScene(): Scene {
  const POOL: { emoji: string; name: string }[] = [
    { emoji: "👦", name: "小明" },
    { emoji: "👧", name: "小红" },
    { emoji: "🧒", name: "小军" },
    { emoji: "👼", name: "小美" },
    { emoji: "👶", name: "小宝" },
  ];
  const n = 3 + Math.floor(Math.random() * 3); // 3..5
  const picked: typeof POOL = [];
  const used = new Set<string>();
  while (picked.length < n) {
    const p = sample(POOL);
    if (!used.has(p.name)) {
      used.add(p.name);
      picked.push(p);
    }
  }
  return {
    kids: picked.map((p) => p.emoji),
    names: picked.map((p) => p.name),
    justSpoke: Math.floor(Math.random() * n),
    activity: sample(ACTIVITIES),
  };
}

export class TakeTurnsGame extends BaseGame {
  constructor() {
    super("take-turns");
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
    const sc = buildScene();
    const next = (sc.justSpoke + 1) % sc.kids.length;

    const wrap = document.createElement("div");
    wrap.className = "tkt-wrap";

    const task = document.createElement("div");
    task.className = "tkt-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 大家<b>轮流</b>${sc.activity}，现在该<b>谁</b>了？`;
    wrap.appendChild(task);

    // 队伍展示
    const row = document.createElement("div");
    row.className = "tkt-row";
    sc.kids.forEach((emoji, i) => {
      const kid = document.createElement("div");
      kid.className = "tkt-kid";
      if (i === sc.justSpoke) kid.classList.add("tkt-kid--done");
      kid.innerHTML = `<div class="tkt-kid__emoji">${emoji}</div><div class="tkt-kid__name">${sc.names[i]}</div>${i === sc.justSpoke ? '<div class="tkt-kid__tag">刚刚</div>' : ""}`;
      row.appendChild(kid);
      if (i < sc.kids.length - 1) {
        const arrow = document.createElement("div");
        arrow.className = "tkt-arrow";
        arrow.textContent = "→";
        row.appendChild(arrow);
      }
    });
    wrap.appendChild(row);

    // 选项（人名）
    const opts = document.createElement("div");
    opts.className = "tkt-opts";
    const idxChoices = sc.kids.map((_, i) => i);
    for (const i of shuffle(idxChoices)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tkt-opt";
      b.innerHTML = `<span class="tkt-opt__emoji">${sc.kids[i]}</span><span class="tkt-opt__name">${sc.names[i]}</span>`;
      b.addEventListener("click", () => this.choose(i === next, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(right: boolean, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (right) {
      this.locked = true;
      sfxPop();
      btn.classList.add("tkt-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("tkt-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("tkt-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🗣️",
      variant: "rest",
      body: "按箭头的方向数一数，刚刚是那个人，下一个就是他后面的小朋友～",
      primary: { text: "继续", icon: "👉", onClick: () => ov.destroy() },
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
    if (document.getElementById("tkt-style")) return;
    const st = document.createElement("style");
    st.id = "tkt-style";
    st.textContent = TKT_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function TKT_CSS(theme: string): string {
  return `
.tkt-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(520px,100%);}
.tkt-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.tkt-task b{color:${theme};}
.tkt-row{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;background:#fff;padding:18px 14px;border-radius:22px;box-shadow:var(--shadow);width:100%;box-sizing:border-box;}
.tkt-kid{display:flex;flex-direction:column;align-items:center;gap:2px;position:relative;padding:6px 8px;border-radius:14px;background:#f6f7ff;}
.tkt-kid--done{background:#e8ecff;}
.tkt-kid__emoji{font-size:2.6rem;}
.tkt-kid__name{font-size:.85rem;font-weight:900;color:#445;}
.tkt-kid__tag{position:absolute;top:-8px;background:${theme};color:#fff;font-size:.65rem;font-weight:900;padding:2px 6px;border-radius:999px;white-space:nowrap;}
.tkt-arrow{font-size:1.4rem;font-weight:900;color:#aab;color:${theme};}
.tkt-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.tkt-opt{display:flex;flex-direction:column;align-items:center;gap:4px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;cursor:pointer;transition:transform .12s;}
.tkt-opt:active{transform:scale(.93);}
.tkt-opt__emoji{font-size:2.4rem;}
.tkt-opt__name{font-size:.95rem;font-weight:900;color:#555;}
.tkt-opt--done{background:#d4f4dd;animation:tkt-pop .4s ease;}
.tkt-opt--wrong{background:#ffe0e0;animation:tkt-shake .4s ease;}
@keyframes tkt-pop{0%{transform:scale(.7)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes tkt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): TakeTurnsGame {
  return new TakeTurnsGame();
}
