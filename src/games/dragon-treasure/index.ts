/* 龙宝藏 Dragon Treasure —— 几件宝物各有"价值"，孩子按从低到高点击排序。
   独特点：宝物带价值数字标签，培养数值排序；龙守护宝箱，排对则欢呼。
   巧思：价值用金币数表示，宝物类型不同（金币/宝石/王冠/宝珠）；
   先点小的，逐个亮起；难度=宝物数量。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 宝物类型池：每个有 emoji 与一个固定的"基础价值"区间（保证可排序）。 */
const TREASURE_TYPES = [
  { emoji: "🪙", name: "金币" },
  { emoji: "💍", name: "戒指" },
  { emoji: "💎", name: "宝石" },
  { emoji: "👑", name: "王冠" },
  { emoji: "🔮", name: "宝珠" },
  { emoji: "🏆", name: "奖杯" },
  { emoji: "📿", name: "项链" },
];

interface Treasure {
  emoji: string;
  name: string;
  value: number;
}

export class DragonTreasureGame extends BaseGame {
  constructor() {
    super("dragon-treasure");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private expected = 1;
  private sortedList: Treasure[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.expected = 1;

    // 生成 N 个价值互不相同的宝物（保证唯一排序）
    const n = this.count();
    const types = shuffle(TREASURE_TYPES).slice(0, n);
    // 生成 1..n*2 内互不相同的奇数价值，便于排序
    const values = shuffle(
      Array.from({ length: n * 3 }, (_, i) => i + 1),
    ).slice(0, n);
    values.sort((a, b) => a - b);
    const treasures: Treasure[] = types.map((t, i) => ({
      emoji: t.emoji,
      name: t.name,
      value: values[i]!,
    }));
    this.sortedList = [...treasures].sort((a, b) => a.value - b.value);
    const shown = shuffle(treasures);

    const wrap = document.createElement("div");
    wrap.className = "drt-wrap";

    const task = document.createElement("div");
    task.className = "drt-task";
    task.innerHTML = `按价值从<span style="color:var(--c-green)">小</span>到<span style="color:var(--c-red)">大</span>点宝物～<span class="drt-prog">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "drt-hint";
    hint.id = "drt-hint";
    hint.textContent = "看宝物下面的金币数，先点最少的～";
    wrap.appendChild(hint);

    const stage = document.createElement("div");
    stage.className = "drt-stage";
    shown.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "drt-treasure";
      b.innerHTML = `<div class="drt-emoji">${t.emoji}</div><div class="drt-value"><span class="drt-coin">🪙</span> ${t.value}</div><div class="drt-order"></div>`;
      b.addEventListener("click", () => this.click(t, b));
      stage.appendChild(b);
    });
    wrap.appendChild(stage);

    // 龙守护
    const dragon = document.createElement("div");
    dragon.className = "drt-dragon";
    dragon.id = "drt-dragon";
    dragon.innerHTML = `🐉 <span class="drt-dragon__msg" id="drt-msg">守好宝藏！</span>`;
    wrap.appendChild(dragon);

    this.root.appendChild(wrap);
  }

  private click(t: Treasure, btn: HTMLButtonElement): void {
    if (btn.classList.contains("drt-treasure--done")) return;
    const correctValue = this.sortedList[this.expected - 1]!.value;
    if (t.value === correctValue) {
      btn.classList.add("drt-treasure--done");
      const orderEl = btn.querySelector(".drt-order")!;
      orderEl.textContent = `${this.expected}`;
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.expected += 1;
      this.setDragon(
        this.expected > this.count() ? "全部排对啦！🎉" : "对！继续～",
      );
      if (this.expected > this.count()) {
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1000);
      }
    } else {
      const paused = this.onWrong();
      this.setDragon("再想想，哪个更小？");
      if (paused) this.showRest();
    }
  }

  private setDragon(msg: string): void {
    const m = this.root.querySelector("#drt-msg");
    if (m) m.textContent = msg;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "比一比下面的金币数，找最小的那个～",
      primary: { text: "继续", icon: "🎈", onClick: () => ov.destroy() },
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
    if (document.getElementById("drt-style")) return;
    const st = document.createElement("style");
    st.id = "drt-style";
    st.textContent = DRT_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function DRT_CSS(theme: string): string {
  void theme;
  return `
.drt-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(540px,100%);}
.drt-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.drt-prog{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.drt-hint{font-size:.95rem;color:var(--ink-soft);font-weight:600;min-height:1.4em;}
.drt-stage{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:16px;background:linear-gradient(180deg,#2a1a0e,#3d2618);border-radius:20px;box-shadow:var(--shadow);}
.drt-treasure{position:relative;width:88px;background:linear-gradient(180deg,#fffbe6,#ffe9a8);border:3px solid #d4a017;border-radius:14px;box-shadow:var(--shadow);padding:12px 4px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;}
.drt-treasure:active{transform:scale(.93);}
.drt-emoji{font-size:2.6rem;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3));}
.drt-value{display:flex;align-items:center;gap:2px;font-size:.95rem;font-weight:800;color:#7a4f00;background:#fff;border-radius:8px;padding:1px 8px;}
.drt-coin{font-size:.8rem;}
.drt-order{position:absolute;top:-10px;right:-8px;width:26px;height:26px;border-radius:50%;background:var(--c-green);color:#fff;font-size:.9rem;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow);opacity:0;transform:scale(0);}
.drt-treasure--done{background:linear-gradient(180deg,#d4f4dd,#a8e6b8);border-color:var(--c-green);opacity:.85;}
.drt-treasure--done .drt-order{opacity:1;transform:scale(1);animation:drt-pop .3s ease;}
@keyframes drt-pop{0%{transform:scale(0)}70%{transform:scale(1.25)}100%{transform:scale(1)}}
.drt-dragon{display:flex;align-items:center;gap:8px;font-size:1.6rem;font-weight:800;}
.drt-dragon__msg{font-size:1rem;color:var(--ink);background:#fff;padding:4px 14px;border-radius:999px;box-shadow:var(--shadow);}
@media (max-width:380px){.drt-treasure{width:74px;}.drt-emoji{font-size:2.1rem;}}
`;
}

export function create(): DragonTreasureGame {
  return new DragonTreasureGame();
}
