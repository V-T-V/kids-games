/* 排日程 Calendar Event —— 月历网格上把活动卡拖到正确的日期格子里。
   巧思：用 bindPointer 做拖拽（鼠标/触摸通用）；活动卡贴到对应日期后归位。
   难度=活动数。通关=排对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { bindPointer } from "../../core/input.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Activity {
  id: string;
  icon: string;
  name: string;
  /** 应该排到的日期（1-28） */
  day: number;
}

const WEEK = ["一", "二", "三", "四", "五", "六", "日"];

/** 活动池 */
const ACTIVITY_TEMPLATES: { icon: string; name: string }[] = [
  { icon: "🎂", name: "生日派对" },
  { icon: "🦷", name: "看牙医" },
  { icon: "⚽", name: "足球课" },
  { icon: "📚", name: "图书馆" },
  { icon: "🎨", name: "画画班" },
  { icon: "🏊", name: "游泳" },
  { icon: "🌳", name: "公园野餐" },
  { icon: "🎬", name: "看电影" },
  { icon: "🚂", name: "坐火车" },
  { icon: "🍦", name: "吃冰淇淋" },
];

export class CalendarEventGame extends BaseGame {
  constructor() {
    super("calendar-event");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private remaining = 0;
  private unbinds: (() => void)[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  /** 活动数量随难度 */
  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 生成不重复的活动 + 不重复的日期
    const n = this.count();
    const templates = shuffle(ACTIVITY_TEMPLATES).slice(0, n);
    // 日期范围按难度：easy 1-10 / medium 1-20 / hard 1-28
    const dayMax =
      this.difficulty === "easy" ? 10 : this.difficulty === "medium" ? 20 : 28;
    const daySet = new Set<number>();
    while (daySet.size < n) daySet.add(Math.floor(Math.random() * dayMax) + 1);
    const days = shuffle([...daySet]);
    const activities: Activity[] = templates.map((t, i) => ({
      id: `ce2-act-${i}`,
      icon: t.icon,
      name: t.name,
      day: days[i]!,
    }));
    this.remaining = activities.length;

    const wrap = document.createElement("div");
    wrap.className = "ce2-wrap";

    const task = document.createElement("div");
    task.className = "ce2-task";
    task.textContent = `把活动卡拖到正确的日期格子（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 活动卡区
    const tray = document.createElement("div");
    tray.className = "ce2-tray";
    const trayTitle = document.createElement("div");
    trayTitle.className = "ce2-tray__title";
    trayTitle.textContent = "待安排的活动";
    tray.appendChild(trayTitle);
    const trayItems = document.createElement("div");
    trayItems.className = "ce2-tray__items";
    tray.appendChild(trayItems);
    wrap.appendChild(tray);

    // 日历
    const cal = document.createElement("div");
    cal.className = "ce2-cal";
    WEEK.forEach((w) => {
      const h = document.createElement("div");
      h.className = "ce2-dow";
      h.textContent = w;
      cal.appendChild(h);
    });
    // 前导空格：本月从周一开始（第 1 格 = 周一）
    const cells: HTMLDivElement[] = [];
    for (let d = 1; d <= dayMax; d++) {
      const cell = document.createElement("div");
      cell.className = "ce2-cell";
      cell.dataset.day = String(d);
      const num = document.createElement("div");
      num.className = "ce2-cell__num";
      num.textContent = String(d);
      cell.appendChild(num);
      cal.appendChild(cell);
      cells.push(cell);
    }
    wrap.appendChild(cal);

    this.root.appendChild(wrap);

    // 创建活动卡并启用拖拽
    const shuffled = shuffle(activities);
    shuffled.forEach((a) => {
      const card = document.createElement("div");
      card.className = "ce2-card";
      card.dataset.id = a.id;
      card.innerHTML = `<span class="ce2-card__icon">${a.icon}</span><span class="ce2-card__name">${a.name}</span><span class="ce2-card__day">${a.day} 号</span>`;
      trayItems.appendChild(card);
      this.enableDrag(card, a, cells);
    });
    void sample;
  }

  private enableDrag(
    card: HTMLDivElement,
    a: Activity,
    cells: HTMLDivElement[],
  ): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    let origin: HTMLElement | null = null;
    let placed = false;
    const u = bindPointer(card, {
      down: (p) => {
        if (placed) return;
        dragging = true;
        const r = card.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        origin = card.parentElement;
        card.classList.add("ce2-card--drag");
        card.style.position = "fixed";
        card.style.left = `${p.x - ox}px`;
        card.style.top = `${p.y - oy}px`;
        card.style.zIndex = "200";
        document.body.appendChild(card);
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        card.style.left = `${p.x - ox}px`;
        card.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        card.classList.remove("ce2-card--drag");
        // 找命中的格子
        const cell = cells.find((c) => {
          const r = c.getBoundingClientRect();
          return (
            p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
          );
        });
        if (cell && Number(cell.dataset.day) === a.day) {
          placed = true;
          card.style.position = "";
          card.style.left = "";
          card.style.top = "";
          card.style.zIndex = "";
          card.classList.add("ce2-card--placed");
          cell.appendChild(card);
          cell.classList.add("ce2-cell--done");
          this.remaining -= 1;
          const r = cell.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top);
          this.resetWrongStreak();
          if (this.remaining <= 0) {
            this.roundsDone += 1;
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal)
                this.finishClear(starsByAccuracy(this.wrongCount));
              else this.startRound();
            }, 900);
          }
        } else {
          // 错：回原位
          card.style.position = "";
          card.style.left = "";
          card.style.top = "";
          card.style.zIndex = "";
          origin?.appendChild(card);
          const paused = this.onWrong();
          if (paused) this.showRest();
        }
      },
    });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看卡片上写着几号，再找对应的格子～",
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
    if (document.getElementById("ce2-style")) return;
    const st = document.createElement("style");
    st.id = "ce2-style";
    st.textContent = CE2_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function CE2_CSS(theme: string): string {
  return `
.ce2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.ce2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ce2-tray{width:100%;background:rgba(255,255,255,.6);border-radius:16px;padding:10px 12px;box-shadow:var(--shadow);}
.ce2-tray__title{font-size:.9rem;font-weight:800;color:var(--ink-soft);margin-bottom:6px;text-align:center;}
.ce2-tray__items{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;min-height:54px;}
.ce2-card{display:flex;align-items:center;gap:6px;background:#fff;border:3px solid ${theme};border-radius:12px;padding:6px 10px;box-shadow:var(--shadow);font-weight:700;cursor:grab;touch-action:none;user-select:none;transition:transform .1s;}
.ce2-card:active{transform:scale(1.04);}
.ce2-card--drag{cursor:grabbing;box-shadow:0 8px 18px rgba(0,0,0,.25);}
.ce2-card--placed{opacity:.92;cursor:default;}
.ce2-card__icon{font-size:1.3rem;}
.ce2-card__name{font-size:.95rem;}
.ce2-card__day{font-size:.85rem;color:${theme};font-weight:800;background:color-mix(in srgb,${theme} 18%,#fff);padding:1px 7px;border-radius:8px;}
.ce2-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;width:100%;max-width:520px;background:rgba(255,255,255,.5);padding:8px;border-radius:16px;box-shadow:var(--shadow);}
.ce2-dow{text-align:center;font-size:.8rem;font-weight:800;color:var(--ink-soft);padding:3px 0;}
.ce2-cell{position:relative;aspect-ratio:1/1;min-height:46px;background:#fff;border-radius:8px;display:flex;flex-direction:column;align-items:center;padding:3px;gap:2px;transition:background .2s;overflow:hidden;}
.ce2-cell__num{font-size:.8rem;font-weight:700;color:var(--ink-soft);align-self:flex-start;}
.ce2-cell--done{background:color-mix(in srgb,${theme} 16%,#fff);}
.ce2-cell .ce2-card{border-width:2px;padding:2px 4px;font-size:.75rem;flex:1;width:100%;justify-content:center;}
.ce2-cell .ce2-card__icon{font-size:1.1rem;}
.ce2-cell .ce2-card__name,.ce2-cell .ce2-card__day{display:none;}
@media (max-width:400px){.ce2-cell{min-height:38px;}.ce2-cell__num{font-size:.7rem;}}
`;
}

export function create(): CalendarEventGame {
  return new CalendarEventGame();
}
