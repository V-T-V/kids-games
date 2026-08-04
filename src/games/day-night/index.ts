/* 昼夜 Day-Night —— 把活动卡拖到白天或夜晚区域。
   独特点：左右两半场景（日/夜），训练「按时间分类活动」的生活认知。
   视觉：左半暖色白天 + 右半深蓝夜晚，活动 emoji 卡片。难度=卡片数。
   通关=分对目标轮数。用 bindPointer 拖拽。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

type Period = "day" | "night";

interface Activity {
  emoji: string;
  name: string;
  period: Period;
  el: HTMLElement;
  placed: boolean;
}

const DAY_POOL = [
  { emoji: "🎒", name: "上学" },
  { emoji: "🪁", name: "放风筝" },
  { emoji: "⚽", name: "踢球" },
  { emoji: "🚲", name: "骑车" },
  { emoji: "🌅", name: "看日出" },
  { emoji: "🌸", name: "赏花" },
];
const NIGHT_POOL = [
  { emoji: "💤", name: "睡觉" },
  { emoji: "⭐", name: "看星星" },
  { emoji: "🌙", name: "看月亮" },
  { emoji: "🦉", name: "听猫头鹰" },
  { emoji: "🎆", name: "看烟花" },
  { emoji: "🏮", name: "提灯笼" },
];

const ENCOURAGE = [
  "分得真清楚！",
  "想想这事什么时候做～",
  "真棒！",
  "差一点点！",
];

export class DayNightGame extends BaseGame {
  constructor() {
    super("day-night");
  }

  private unbinds: (() => void)[] = [];
  private zones: Record<Period, HTMLElement> = {
    day: null as unknown as HTMLElement,
    night: null as unknown as HTMLElement,
  };
  private items: Activity[] = [];
  private remaining = 0;
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
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
  }

  private count(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.locked = false;
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.items = [];
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    this.remaining = n;

    /* 生成活动：白天/夜晚都至少 1 张（保证两类都要分），其余随机补足 */
    const dayPick = shuffle(DAY_POOL);
    const nightPick = shuffle(NIGHT_POOL);
    const list: { emoji: string; name: string; period: Period }[] = [];
    list.push({ ...dayPick[0]!, period: "day" });
    list.push({ ...nightPick[0]!, period: "night" });
    let di = 1;
    let ni = 1;
    for (let i = 2; i < n; i++) {
      if (Math.random() < 0.5 && di < dayPick.length) {
        list.push({ ...dayPick[di]!, period: "day" });
        di++;
      } else if (ni < nightPick.length) {
        list.push({ ...nightPick[ni]!, period: "night" });
        ni++;
      } else {
        list.push({ ...dayPick[di % dayPick.length]!, period: "day" });
        di++;
      }
    }
    const acts = shuffle(list);

    const wrap = document.createElement("div");
    wrap.className = "dn-wrap";

    const task = document.createElement("div");
    task.className = "dn-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 把活动拖到 <b>白天</b> 或 <b>夜晚</b>`;
    wrap.appendChild(task);

    /* 双区域 */
    const sceneRow = document.createElement("div");
    sceneRow.className = "dn-scene";
    (["day", "night"] as Period[]).forEach((p) => {
      const zone = document.createElement("div");
      zone.className = `dn-zone dn-zone--${p}`;
      zone.dataset.period = p;
      zone.innerHTML = `
        <div class="dn-zone-head">${p === "day" ? "☀️ 白天" : "🌙 夜晚"}</div>
        <div class="dn-zone-body" id="dn-body-${p}"></div>
      `;
      sceneRow.appendChild(zone);
      this.zones[p] = zone;
    });
    wrap.appendChild(sceneRow);

    /* 活动托盘 */
    const tray = document.createElement("div");
    tray.className = "dn-tray";
    acts.forEach((a, i) => {
      const el = document.createElement("div");
      el.className = "dn-card";
      el.textContent = a.emoji;
      el.title = a.name;
      el.dataset.period = a.period;
      el.dataset.i = String(i);
      const lbl = document.createElement("span");
      lbl.className = "dn-card-name";
      lbl.textContent = a.name;
      el.appendChild(lbl);
      tray.appendChild(el);
      const it: Activity = {
        emoji: a.emoji,
        name: a.name,
        period: a.period,
        el,
        placed: false,
      };
      this.items.push(it);
      this.enableDrag(it);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private enableDrag(it: Activity): void {
    let dragging = false;
    let offX = 0;
    let offY = 0;
    let origin: HTMLElement | null = null;
    const onDown = (p: { x: number; y: number }) => {
      if (it.placed || this.locked) return;
      dragging = true;
      const r = it.el.getBoundingClientRect();
      offX = p.x - r.left;
      offY = p.y - r.top;
      origin = it.el.parentElement;
      it.el.classList.add("dn-card--drag");
      it.el.style.position = "fixed";
      it.el.style.left = `${p.x - offX}px`;
      it.el.style.top = `${p.y - offY}px`;
      document.body.appendChild(it.el);
      sfxPop();
    };
    const onMove = (p: { x: number; y: number }) => {
      if (!dragging) return;
      it.el.style.left = `${p.x - offX}px`;
      it.el.style.top = `${p.y - offY}px`;
    };
    const onUp = (p: { x: number; y: number }) => {
      if (!dragging) return;
      dragging = false;
      it.el.classList.remove("dn-card--drag");
      let hit: Period | null = null;
      for (const z of ["day", "night"] as Period[]) {
        const r = this.zones[z].getBoundingClientRect();
        if (
          p.x >= r.left &&
          p.x <= r.right &&
          p.y >= r.top &&
          p.y <= r.bottom
        ) {
          hit = z;
          break;
        }
      }
      if (hit === it.period) {
        it.placed = true;
        it.el.style.position = "";
        it.el.style.left = "";
        it.el.style.top = "";
        it.el.classList.add("dn-card--in");
        const body = this.root.querySelector(`#dn-body-${hit}`);
        if (body) body.appendChild(it.el);
        this.remaining -= 1;
        const r = this.zones[hit].getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        if (this.remaining <= 0) {
          this.locked = true;
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 900);
        }
      } else {
        it.el.style.position = "";
        it.el.style.left = "";
        it.el.style.top = "";
        origin?.appendChild(it.el);
        const paused = this.onWrong();
        if (paused) this.showRest();
      }
    };
    const u = bindPointer(it.el, { down: onDown, move: onMove, up: onUp });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌞",
      variant: "rest",
      body: `想想这件事是在太阳出来时做，还是天黑后做？ ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("dn-style")) return;
    const st = document.createElement("style");
    st.id = "dn-style";
    st.textContent = DN_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function DN_CSS(theme: string): string {
  return `
.dn-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.dn-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.dn-scene{display:flex;gap:10px;justify-content:center;width:100%;}
.dn-zone{flex:1;min-width:120px;border-radius:22px;padding:10px;box-shadow:var(--shadow);position:relative;overflow:hidden;min-height:200px;display:flex;flex-direction:column;}
.dn-zone--day{background:linear-gradient(180deg,#ffe9a8,#ffb86b);border:3px solid #ff9f43;}
.dn-zone--night{background:linear-gradient(180deg,#3a3f6b,#1b1f3b);border:3px solid #6366f1;}
.dn-zone-head{font-size:1rem;font-weight:900;text-align:center;border-radius:999px;padding:4px;margin-bottom:8px;}
.dn-zone--day .dn-zone-head{background:rgba(255,255,255,.7);color:#b35900;}
.dn-zone--night .dn-zone-head{background:rgba(255,255,255,.16);color:#fff;}
.dn-zone-body{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-content:flex-start;flex:1;padding:6px;border-radius:14px;}
.dn-zone--day .dn-zone-body{background:rgba(255,255,255,.3);}
.dn-zone--night .dn-zone-body{background:rgba(255,255,255,.08);}
.dn-tray{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:520px;min-height:72px;}
.dn-card{width:74px;height:84px;border-radius:16px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:grab;touch-action:none;user-select:none;box-shadow:0 3px 0 rgba(0,0,0,.1),0 5px 8px rgba(0,0,0,.1);font-size:2.1rem;line-height:1;transition:transform .12s;border:3px solid ${theme};}
.dn-card:active{transform:scale(1.08);}
.dn-card-name{font-size:.66rem;font-weight:700;color:#666;}
.dn-card--drag{cursor:grabbing;transform:scale(1.18);z-index:100;}
.dn-card--in{animation:dn-pop .4s ease;cursor:default;}
@keyframes dn-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@media (max-width:380px){.dn-card{width:60px;height:70px;font-size:1.7rem;}.dn-zone{min-height:170px;}.dn-card-name{font-size:.58rem;}}
`;
}

export function create(): DayNightGame {
  return new DayNightGame();
}
