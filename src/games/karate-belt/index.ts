/* 腰带等级排序 Karate Belt —— 几条不同颜色的空手道腰带（白/黄/绿/蓝/红/黑），
   孩子按等级从低到高依次点击腰带排列。独特点：腰带做成真实的带扣色带
   视觉，颜色本身代表等级（白→黑越来越厉害）；按对顺序点亮。难度=腰带数
   （3/4/5/6）。通关=排对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Belt {
  level: number; // 等级（排序键，从低到高 0,1,2...）
  name: string; // 中文色名
  hex: string;
}

const BELTS: Belt[] = [
  { level: 0, name: "白带", hex: "#f5f5f5" },
  { level: 1, name: "黄带", hex: "#ffd93d" },
  { level: 2, name: "绿带", hex: "#6bcf7f" },
  { level: 3, name: "蓝带", hex: "#4d96ff" },
  { level: 4, name: "红带", hex: "#ff6348" },
  { level: 5, name: "黑带", hex: "#2b2b2b" },
];

export class KarateBeltGame extends BaseGame {
  constructor() {
    super("karate-belt");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private count = 0;
  private lineup: Belt[] = []; // 正确顺序（低→高）
  private nextIdx = 0;
  private placed = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.count =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 5 : 6;
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

    // 从 BELTS 中选 count 条连续等级腰带，保证等级直观（白黄绿…）
    // 用连续区间便于孩子联想颜色深浅
    const startMax = BELTS.length - this.count;
    const start = startMax > 0 ? Math.floor(Math.random() * (startMax + 1)) : 0;
    const picked = BELTS.slice(start, start + this.count);
    this.lineup = [...picked].sort((a, b) => a.level - b.level);
    const display = shuffle(picked);

    const wrap = document.createElement("div");
    wrap.className = "krt-wrap";

    const task = document.createElement("div");
    task.className = "krt-task";
    task.innerHTML = `先点最简单的腰带 🥋，一条条排好～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 提示：等级从浅到深
    const tip = document.createElement("div");
    tip.className = "krt-tip";
    tip.textContent = "颜色越深越厉害：白→黄→绿→蓝→红→黑";
    wrap.appendChild(tip);

    // 排序结果栏
    const ladder = document.createElement("div");
    ladder.className = "krt-ladder";
    this.lineup.forEach((b, i) => {
      const slot = document.createElement("div");
      slot.className = "krt-slot";
      const rank = document.createElement("span");
      rank.className = "krt-slot__rank";
      rank.textContent = `${i + 1}`;
      slot.appendChild(rank);
      const drop = document.createElement("span");
      drop.className = "krt-slot__drop";
      drop.dataset.level = String(b.level);
      slot.appendChild(drop);
      ladder.appendChild(slot);
    });
    wrap.appendChild(ladder);

    // 腰带卡片（待点）
    const tray = document.createElement("div");
    tray.className = "krt-tray";
    display.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "krt-card";
      btn.dataset.level = String(b.level);
      btn.innerHTML = `<span class="krt-card__belt" style="--belt:${b.hex}"></span><span class="krt-card__name">${b.name}</span>`;
      btn.addEventListener("click", () => this.tap(b, btn, ladder));
      tray.appendChild(btn);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private tap(b: Belt, btn: HTMLButtonElement, ladder: HTMLElement): void {
    if (btn.disabled) return;
    const expected = this.lineup[this.nextIdx];
    if (!expected) return;
    if (b.level === expected.level) {
      btn.disabled = true;
      btn.classList.add("krt-card--used");
      // 在对应槽位放上一条腰带
      const slots = ladder.querySelectorAll(".krt-slot");
      const slot = slots[this.nextIdx];
      if (slot) {
        slot.classList.add("krt-slot--on");
        const drop = slot.querySelector(
          ".krt-slot__drop",
        ) as HTMLElement | null;
        if (drop) {
          drop.style.setProperty("--belt", b.hex);
          drop.textContent = b.name;
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
      btn.classList.add("krt-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("krt-card--wrong"), 420);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "颜色越浅等级越低，先点最浅颜色的腰带～",
      primary: {
        text: "继续",
        icon: "🥋",
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
    if (document.getElementById("krt-style")) return;
    const st = document.createElement("style");
    st.id = "krt-style";
    st.textContent = KRT_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function KRT_CSS(theme: string): string {
  return `
.krt-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.krt-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.krt-task b{color:${theme};}
.krt-tip{font-size:.9rem;font-weight:700;color:var(--ink-soft);text-align:center;}
.krt-ladder{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.krt-slot{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;}
.krt-slot__rank{width:24px;height:24px;border-radius:50%;background:#e3e3e3;color:var(--ink);font-size:.85rem;font-weight:900;display:flex;align-items:center;justify-content:center;}
.krt-slot--on .krt-slot__rank{background:${theme};color:#fff;}
.krt-slot__drop{width:96px;height:26px;border-radius:6px;background:#f0e8e0;box-shadow:inset 0 0 0 2px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800;color:var(--ink);transition:all .3s cubic-bezier(.34,1.56,.64,1);opacity:.5;}
.krt-slot--on .krt-slot__drop{opacity:1;background:var(--belt,${theme});color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);box-shadow:0 3px 6px rgba(0,0,0,.2);transform:translateY(-3px);animation:krt-pop .35s ease;}
@keyframes krt-pop{0%{transform:translateY(-12px) scale(.8);opacity:0}100%{transform:translateY(-3px) scale(1);opacity:1}}
.krt-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:10px;min-height:90px;align-items:center;}
.krt-card{width:104px;height:90px;border:none;border-radius:16px;cursor:pointer;background:linear-gradient(180deg,#fff,#f7efe7);box-shadow:0 4px 0 #e0d0c0,var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;transition:transform .1s ease;}
.krt-card:active{transform:translateY(3px);box-shadow:0 1px 0 #e0d0c0,var(--shadow);}
.krt-card__belt{display:block;width:80px;height:22px;border-radius:5px;background:linear-gradient(180deg,var(--belt),color-mix(in srgb,var(--belt) 70%,#000));box-shadow:inset 0 2px 0 rgba(255,255,255,.4),0 2px 4px rgba(0,0,0,.25);position:relative;}
.krt-card__belt::after{content:"";position:absolute;right:8px;top:0;width:18px;height:22px;background:linear-gradient(180deg,var(--belt),color-mix(in srgb,var(--belt) 70%,#000));box-shadow:0 0 0 2px rgba(0,0,0,.15);border-radius:3px;}
.krt-card__name{font-size:1rem;font-weight:900;color:var(--ink);}
.krt-card--used{opacity:.28;cursor:default;transform:scale(.82);}
.krt-card--wrong{animation:krt-shake .4s ease;}
@keyframes krt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
@media (max-width:380px){.krt-card{width:84px;height:80px;}.krt-card__belt{width:64px;}.krt-slot__drop{width:78px;}}
`;
}

export function create(): KarateBeltGame {
  return new KarateBeltGame();
}
