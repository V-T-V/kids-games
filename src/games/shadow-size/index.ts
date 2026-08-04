/* 影子比大小 Shadow Size —— 不同时间物体影子长短不同（早晨长/中午短）。
   给两个场景（同一物体 + 不同时间 + 不同影子长度），问"哪个时间的影子更长？"。
   科学启蒙：观察影子与太阳高度的关系，培养测量与科学认知。前缀 ss-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface TimeShadow {
  /** 时间标签 */
  time: string;
  timeEmoji: string;
  /** 影子相对长度（数值越大越长），用于比较 */
  length: number;
  /** 影子在视觉上的高度比例（px 高度系数） */
  px: number;
}

/** 一天三个典型时段，长度关系固定：早晨/傍晚最长，中午最短。 */
const TIMES: TimeShadow[] = [
  { time: "早上", timeEmoji: "🌅", length: 3, px: 80 },
  { time: "中午", timeEmoji: "🌞", length: 1, px: 26 },
  { time: "傍晚", timeEmoji: "🌇", length: 3, px: 80 },
];

interface ItemObj {
  emoji: string;
  name: string;
}

const ITEMS: ItemObj[] = [
  { emoji: "🌳", name: "小树" },
  { emoji: "🚶", name: "小人" },
  { emoji: "🪨", name: "石头" },
  { emoji: "🏡", name: "小房子" },
  { emoji: "🚗", name: "小汽车" },
  { emoji: "🌵", name: "仙人掌" },
];

/** 两种问法随机切换 */
const ASKS: { text: string; longer: boolean }[] = [
  { text: "哪个时间的影子更长？", longer: true },
  { text: "哪个时间的影子更短？", longer: false },
];

export class ShadowSizeGame extends BaseGame {
  constructor() {
    super("shadow-size");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
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

    const item = sample(ITEMS);
    const ask = sample(ASKS);
    // 取一对 length 不同的时间（保证答案唯一）
    const a = sample(TIMES);
    let b = sample(TIMES);
    let guard = 0;
    while (b.length === a.length && guard < 20) {
      b = sample(TIMES);
      guard += 1;
    }
    const two = shuffle([a, b]);
    // 答案：longer 问法 → length 更大者；shorter → length 更小者
    const targetLen = ask.longer
      ? Math.max(two[0]!.length, two[1]!.length)
      : Math.min(two[0]!.length, two[1]!.length);

    const wrap = document.createElement("div");
    wrap.className = "ss-wrap";

    const task = document.createElement("div");
    task.className = "ss-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · <b>${ask.text}</b>`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "ss-hint";
    hint.textContent = "太阳越高，影子越短；太阳越低，影子越长～";
    wrap.appendChild(hint);

    const board = document.createElement("div");
    board.className = "ss-board";
    two.forEach((t) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "ss-card";
      card.innerHTML = `
        <div class="ss-card__time">${t.timeEmoji} ${t.time}</div>
        <div class="ss-scene">
          <div class="ss-sun">${t.timeEmoji}</div>
          <div class="ss-obj">${item.emoji}</div>
          <div class="ss-shadow" style="height:${t.px}px"></div>
          <div class="ss-ground"></div>
        </div>`;
      card.addEventListener("click", () =>
        this.choose(t.length, targetLen, card),
      );
      board.appendChild(card);
    });
    wrap.appendChild(board);
    this.root.appendChild(wrap);
  }

  private choose(
    pickedLen: number,
    targetLen: number,
    btn: HTMLButtonElement,
  ): void {
    if (this.locked) return;
    if (pickedLen === targetLen) {
      this.locked = true;
      sfxPop();
      btn.classList.add("ss-card--done");
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
      btn.classList.add("ss-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ss-card--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🌤️",
      variant: "rest",
      body: "太阳高高挂在天上（中午）时，影子短短的；太阳低低快落山（傍晚）或刚升起（早上）时，影子长长的～",
      primary: { text: "继续", icon: "😊", onClick: () => ov.destroy() },
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
    if (document.getElementById("ss-style")) return;
    const st = document.createElement("style");
    st.id = "ss-style";
    st.textContent = SS_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function SS_CSS(theme: string): string {
  return `
.ss-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(460px,100%);}
.ss-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.ss-task b{color:${theme};}
.ss-hint{font-size:.95rem;color:var(--ink-soft);text-align:center;}
.ss-board{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;width:100%;}
.ss-card{display:flex;flex-direction:column;align-items:center;gap:8px;background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:16px 20px;cursor:pointer;transition:transform .12s;min-height:160px;justify-content:center;}
.ss-card:active{transform:scale(.97);}
.ss-card__time{font-size:1.1rem;font-weight:900;color:#444;}
.ss-scene{position:relative;width:120px;height:120px;display:flex;align-items:flex-end;justify-content:center;}
.ss-sun{position:absolute;top:0;right:6px;font-size:1.6rem;}
.ss-obj{font-size:2.6rem;line-height:1;position:relative;z-index:2;}
.ss-shadow{position:absolute;bottom:14px;left:50%;transform:translateX(-50%) rotate(0deg);width:54px;background:radial-gradient(ellipse at center,rgba(60,60,60,.55),rgba(60,60,60,.15) 70%,transparent);border-radius:50%;opacity:.7;min-height:18px;}
.ss-ground{position:absolute;bottom:10px;left:0;right:0;height:6px;background:linear-gradient(90deg,transparent,#b5e0a0,#b5e0a0,transparent);border-radius:4px;}
.ss-card--done{background:#d4f4dd;outline:4px solid #34c759;animation:ss-pop .4s ease;}
.ss-card--wrong{background:#ffe0e0;animation:ss-shake .4s ease;}
@keyframes ss-pop{0%{transform:scale(.85)}60%{transform:scale(1.05)}100%{transform:scale(1)}}
@keyframes ss-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ShadowSizeGame {
  return new ShadowSizeGame();
}
