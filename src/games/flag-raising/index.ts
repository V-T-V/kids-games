/* 升旗排高矮 Flag Raising —— 几面旗杆高度不同的旗子，孩子按杆从矮到高
   依次点击旗子排列。独特点：旗子竖立成排，杆高一眼可辨；按对顺序旗子
   升起飘扬。难度=旗数（3/4/5）。通关=排对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Flag {
  height: number; // 杆高（排序键，越大越高）
  emoji: string; // 旗帜 emoji
  color: string; // 旗布颜色
}

const FLAG_DESIGNS: { emoji: string; color: string }[] = [
  { emoji: "🚩", color: "#ff6348" },
  { emoji: "🏁", color: "#4d96ff" },
  { emoji: "🏳️", color: "#f5f5f5" },
  { emoji: "🚩", color: "#ffd93d" },
  { emoji: "🏁", color: "#6bcf7f" },
];

export class FlagRaisingGame extends BaseGame {
  constructor() {
    super("flag-raising");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private count = 0;
  private lineup: Flag[] = []; // 正确顺序（矮→高）
  private nextIdx = 0;
  private placed = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.count =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由基类清空；定时器由基类清理 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.nextIdx = 0;
    this.placed = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 生成 count 个高度明显不同的旗杆（保证可区分、有解）
    const base = 70; // 最矮杆 px
    const step = 28; // 每档高度差
    const flags: Flag[] = [];
    for (let i = 0; i < this.count; i++) {
      const d = FLAG_DESIGNS[i % FLAG_DESIGNS.length]!;
      flags.push({ height: base + i * step, emoji: d.emoji, color: d.color });
    }
    this.lineup = [...flags].sort((a, b) => a.height - b.height);
    const display = shuffle(flags);

    const wrap = document.createElement("div");
    wrap.className = "flg-wrap";

    const task = document.createElement("div");
    task.className = "flg-task";
    task.innerHTML = `先点最矮的 🚩，一面面升上去～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 排序结果栏：一排底座，按对顺序升起旗子（高度按 lineup 决定）
    const ground = document.createElement("div");
    ground.className = "flg-ground";
    this.lineup.forEach((f, i) => {
      const slot = document.createElement("div");
      slot.className = "flg-slot";
      slot.style.setProperty("--pole", `${f.height}px`);
      const rank = document.createElement("span");
      rank.className = "flg-slot__rank";
      rank.textContent = `${i + 1}`;
      slot.appendChild(rank);
      const flag = document.createElement("span");
      flag.className = "flg-slot__flag";
      flag.textContent = f.emoji;
      flag.style.setProperty("--pole", `${f.height}px`);
      slot.appendChild(flag);
      ground.appendChild(slot);
    });
    wrap.appendChild(ground);

    // 旗子卡片（待点）——展示真实杆高，便于比较
    const tray = document.createElement("div");
    tray.className = "flg-tray";
    display.forEach((f) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flg-card";
      btn.style.setProperty("--pole", `${f.height}px`);
      btn.dataset.height = String(f.height);
      btn.innerHTML = `<span class="flg-card__pole"><span class="flg-card__cloth">${f.emoji}</span></span>`;
      btn.addEventListener("click", () => this.tap(f, btn, ground));
      tray.appendChild(btn);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private tap(f: Flag, btn: HTMLButtonElement, ground: HTMLElement): void {
    if (btn.disabled) return;
    const expected = this.lineup[this.nextIdx];
    if (!expected) return;
    if (f.height === expected.height) {
      btn.disabled = true;
      btn.classList.add("flg-card--used");
      // 升起对应槽位的旗子
      const slots = ground.querySelectorAll(".flg-slot");
      const slot = slots[this.nextIdx];
      if (slot) {
        slot.classList.add("flg-slot--on");
        const flag = slot.querySelector(".flg-slot__flag");
        if (flag) {
          flag.textContent = f.emoji;
          flag.classList.add("flg-slot__flag--raised");
        }
      }
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.nextIdx += 1;
      this.placed += 1;
      if (this.placed >= this.count) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 950);
      }
    } else {
      btn.classList.add("flg-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("flg-card--wrong"), 420);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "比一比哪根杆最短，先点最矮的旗子～",
      primary: {
        text: "继续",
        icon: "🚩",
        onClick: () => ov.destroy(),
      },
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
    if (document.getElementById("flg-style")) return;
    const st = document.createElement("style");
    st.id = "flg-style";
    st.textContent = FLG_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function FLG_CSS(theme: string): string {
  return `
.flg-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.flg-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.flg-task b{color:${theme};}
.flg-ground{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;justify-content:center;min-height:160px;padding:16px;background:linear-gradient(180deg,#e3f2fd,#bbdefb 70%,#a5d6a7 100%);border-radius:20px;box-shadow:var(--shadow);}
.flg-slot{position:relative;display:flex;flex-direction:column;align-items:center;}
.flg-slot__rank{width:22px;height:22px;border-radius:50%;background:#e3e3e3;color:var(--ink);font-size:.8rem;font-weight:900;display:flex;align-items:center;justify-content:center;margin-top:4px;}
.flg-slot--on .flg-slot__rank{background:${theme};color:#fff;}
.flg-slot__flag{display:block;font-size:1.8rem;opacity:0;}
.flg-slot__flag--raised{opacity:1;animation:flg-raise .6s ease;animation-fill-mode:both;}
@keyframes flg-raise{0%{transform:translateY(40px);opacity:0}60%{transform:translateY(-4px);opacity:1}100%{transform:translateY(0);opacity:1}}
/* 每个槽位都有一个可见的空旗杆（灰）作为"待填"占位 */
.flg-slot::before{content:"";display:block;width:6px;height:var(--pole);background:linear-gradient(90deg,#999,#ccc);border-radius:3px 3px 0 0;margin-bottom:-22px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1);}
.flg-slot__flag{position:relative;z-index:2;margin-bottom:calc(var(--pole) * -1 + 14px);margin-top:-2px;}
.flg-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:flex-end;margin-top:10px;min-height:160px;}
.flg-card{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;border:none;background:transparent;cursor:pointer;transition:transform .1s ease;padding:0 4px;}
.flg-card:active{transform:scale(.94);}
.flg-card__pole{display:block;width:8px;height:var(--pole);background:linear-gradient(90deg,#8d6e63,#bcaaa4);border-radius:4px 4px 0 0;box-shadow:0 2px 4px rgba(0,0,0,.2);position:relative;}
.flg-card__pole::after{content:"";position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:24px;height:6px;background:#6d4c41;border-radius:3px;}
.flg-card__cloth{position:absolute;top:0;left:8px;font-size:1.7rem;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));animation:flg-wave 2.2s ease-in-out infinite;transform-origin:left center;}
@keyframes flg-wave{0%,100%{transform:rotate(0)}50%{transform:rotate(8deg)}}
.flg-card--used{opacity:.25;cursor:default;transform:scale(.8);}
.flg-card--wrong{animation:flg-shake .4s ease;}
@keyframes flg-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
@media (max-width:380px){.flg-card__cloth{font-size:1.4rem;}.flg-slot__flag{font-size:1.5rem;}}
`;
}

export function create(): FlagRaisingGame {
  return new FlagRaisingGame();
}
