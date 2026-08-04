/* 花店 Florist —— 上方展示一个花束样板（几朵不同颜色的花按规律排成），
   孩子从下方花朵里按颜色选，依次插出一样的花束。
   独特点：规律模仿 + 颜色序列记忆，孩子「照着插」。
   视觉：花束（用 emoji 花和包装纸）+ 花朵色盘。难度=花数/规律复杂度。
   通关=插对目标轮数。前缀 fl2-（避免与 feed-order/fishing 等冲突）。
   玩法：样板可见，孩子依次点色盘填下一个空位，错则提示重来该位。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Flower {
  name: string;
  hex: string;
  emoji: string;
}

const FLOWERS: Flower[] = [
  { name: "红", hex: "#ef5350", emoji: "🌹" },
  { name: "黄", hex: "#ffca28", emoji: "🌻" },
  { name: "粉", hex: "#ff8fb1", emoji: "🌷" },
  { name: "紫", hex: "#ab47bc", emoji: "🪻" },
  { name: "白", hex: "#e0e0e0", emoji: "🌼" },
  { name: "橙", hex: "#ff9f43", emoji: "🧡" },
];

export class FloristGame extends BaseGame {
  constructor() {
    super("florist");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private pattern: Flower[] = [];
  private filled = 0;
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

  /** 一束花有几朵 */
  private bloomCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.locked = false;
    this.filled = 0;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.bloomCount();
    // 生成有规律的样板：用 2-3 种花交替。保证有规律、可模仿。
    const period =
      this.difficulty === "easy" ? 3: this.difficulty === "medium" ? 4 : 6;
    const base = shuffle(FLOWERS).slice(0, Math.min(period, n));
    const pattern: Flower[] = [];
    for (let i = 0; i < n; i++) pattern.push(base[i % base.length]!);
    this.pattern = pattern;

    const wrap = document.createElement("div");
    wrap.className = "fl2-wrap";

    const task = document.createElement("div");
    task.className = "fl2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 照着上面的<b>花束样子</b>，从下面选一样的花插进去 💐`;
    wrap.appendChild(task);

    // 样板花束
    const sampleBouquet = document.createElement("div");
    sampleBouquet.className = "fl2-sample";
    const sampleTitle = document.createElement("div");
    sampleTitle.className = "fl2-label";
    sampleTitle.textContent = "花束样子";
    sampleBouquet.appendChild(sampleTitle);
    const sampleRow = document.createElement("div");
    sampleRow.className = "fl2-row";
    pattern.forEach((f) => {
      const c = document.createElement("div");
      c.className = "fl2-bloom";
      c.style.setProperty("--fl2-c", f.hex);
      c.textContent = f.emoji;
      sampleRow.appendChild(c);
    });
    sampleBouquet.appendChild(sampleRow);
    wrap.appendChild(sampleBouquet);

    // 我的花束（待填充）
    const mine = document.createElement("div");
    mine.className = "fl2-mine";
    const mineTitle = document.createElement("div");
    mineTitle.className = "fl2-label";
    mineTitle.textContent = "我的花束";
    mine.appendChild(mineTitle);
    const slots = document.createElement("div");
    slots.className = "fl2-slots";
    slots.id = "fl2-slots";
    for (let i = 0; i < n; i++) {
      const slot = document.createElement("div");
      slot.className = "fl2-slot";
      slot.dataset.idx = String(i);
      if (i === 0) slot.classList.add("fl2-slot--active");
      slots.appendChild(slot);
    }
    mine.appendChild(slots);
    wrap.appendChild(mine);

    // 花朵色盘
    const palette = document.createElement("div");
    palette.className = "fl2-palette";
    // 色盘 = 样板里出现的花 + 1-2 个干扰，确保都能选到正确花
    const used = new Map<string, Flower>();
    pattern.forEach((f) => used.set(f.name, f));
    const usedList = [...used.values()];
    const distract = shuffle(FLOWERS.filter((f) => !used.has(f.name))).slice(
      0,
      this.difficulty === "hard" ? 2 : 1,
    );
    const choices = shuffle([...usedList, ...distract]);
    choices.forEach((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fl2-choice";
      b.style.setProperty("--fl2-c", f.hex);
      b.innerHTML = `${f.emoji}<span class="fl2-choice__name">${f.name}</span>`;
      b.addEventListener("click", () => this.pick(f, b));
      palette.appendChild(b);
    });
    wrap.appendChild(palette);

    this.root.appendChild(wrap);
  }

  private pick(f: Flower, btn: HTMLButtonElement): void {
    if (this.locked) return;
    const idx = this.filled;
    const expect = this.pattern[idx]!;
    const slotsEl = this.root.querySelector("#fl2-slots");
    const slot = slotsEl?.querySelector(
      `.fl2-slot[data-idx="${idx}"]`,
    ) as HTMLElement | null;
    if (!slot) return;
    if (f.name === expect.name) {
      // 正确：填充该位
      slot.classList.remove("fl2-slot--active");
      slot.classList.add("fl2-slot--done");
      slot.style.setProperty("--fl2-c", expect.hex);
      slot.textContent = expect.emoji;
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.filled += 1;
      // 高亮下一个
      const next = slotsEl?.querySelector(
        `.fl2-slot[data-idx="${this.filled}"]`,
      );
      if (next) next.classList.add("fl2-slot--active");
      if (this.filled >= this.pattern.length) {
        this.locked = true;
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1100);
      }
    } else {
      btn.classList.add("fl2-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("fl2-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌷",
      variant: "rest",
      body: "看看上面花束里下一个该是什么颜色的花，再选哦～",
      primary: { text: "继续", icon: "💐", onClick: () => ov.destroy() },
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
    if (document.getElementById("fl2-style")) return;
    const st = document.createElement("style");
    st.id = "fl2-style";
    st.textContent = FL2_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function FL2_CSS(theme: string): string {
  return `
.fl2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.fl2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.fl2-task b{color:${theme};}
.fl2-sample{width:100%;max-width:440px;background:linear-gradient(180deg,#fff0f6,#ffe3ef);border-radius:22px;box-shadow:var(--shadow);padding:14px 16px;box-sizing:border-box;}
.fl2-mine{width:100%;max-width:440px;background:linear-gradient(180deg,#f6fff0,#e3ffe9);border-radius:22px;box-shadow:var(--shadow);padding:14px 16px;box-sizing:border-box;}
.fl2-label{font-size:.95rem;font-weight:900;color:#666;text-align:center;margin-bottom:8px;}
.fl2-row{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}
.fl2-slots{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}
.fl2-bloom{width:54px;height:54px;border-radius:50%;background:var(--fl2-c,#fff);font-size:2rem;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.12);}
.fl2-slot{width:54px;height:54px;border-radius:50%;border:3px dashed #bbb;background:#fff;font-size:2rem;display:flex;align-items:center;justify-content:center;}
.fl2-slot--active{border-color:${theme};animation:fl2-pulse 1s ease-in-out infinite;}
.fl2-slot--done{border:none;box-shadow:0 2px 6px rgba(0,0,0,.12);animation:fl2-pop .35s ease;}
@keyframes fl2-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes fl2-pop{0%{transform:scale(.5)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
.fl2-palette{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:14px;background:rgba(255,255,255,.7);border-radius:22px;box-shadow:var(--shadow);max-width:480px;}
.fl2-choice{width:70px;height:78px;border-radius:18px;background:#fff;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:2rem;cursor:pointer;transition:transform .12s;}
.fl2-choice:active{transform:scale(.92);}
.fl2-choice--wrong{animation:fl2-shake .4s ease;}
.fl2-choice__name{font-size:.8rem;font-weight:900;color:var(--fl2-c,#333);}
@keyframes fl2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.fl2-bloom,.fl2-slot{width:46px;height:46px;font-size:1.7rem;}.fl2-choice{width:60px;height:68px;font-size:1.7rem;}}
`;
}

export function create(): FloristGame {
  return new FloristGame();
}
