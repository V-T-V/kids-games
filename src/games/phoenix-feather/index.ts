/* 凤凰羽毛 Phoenix Feather —— 几根羽毛颜色从冷到热
   （蓝→白→黄→橙→红），打乱后孩子按"从冷到热"顺序把它们一个个点进凹槽。
   独特点：温度梯度排序，用颜色直观映射"冷→热"。
   视觉：飘动的羽毛 + 温度槽 + 冷热两端图标。
   难度=羽毛数量。通关=排对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 从冷到热的固定温度梯度。 */
const HEAT = [
  { emoji: "🪶", color: "#4d96ff", name: "冰蓝" }, // 0 最冷
  { emoji: "🪶", color: "#e8f0ff", name: "雪白" },
  { emoji: "🪶", color: "#ffd93d", name: "暖黄" },
  { emoji: "🪶", color: "#ff9f43", name: "火橙" },
  { emoji: "🪶", color: "#ff4d4d", name: "烈焰红" }, // 4 最热
] as const;

export class PhoenixFeatherGame extends BaseGame {
  constructor() {
    super("phoenix-feather");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  /** 本关使用的羽毛（按温度索引升序排列） */
  private feathers: number[] = [];
  /** 当前该填第几个槽（0..feathers.length） */
  private cursor = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空；定时器由基类清理 */
  }

  /** 取难度对应的羽毛数：easy=3，medium=4，hard=5。 */
  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.cursor = 0;

    // 从 5 档温度中随机选 count 档（保证梯度可辨）
    const n = this.count();
    const picked = shuffle(HEAT.map((_, i) => i))
      .slice(0, n)
      .sort((a, b) => a - b);
    this.feathers = picked;

    const wrap = document.createElement("div");
    wrap.className = "pxf-wrap";

    const task = document.createElement("div");
    task.className = "pxf-task";
    task.innerHTML = `把羽毛按 <b>从冷到热</b> 排进凹槽<br><span class="pxf-hint">第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    // 温度槽（从左冷到右热）
    const stage = document.createElement("div");
    stage.className = "pxf-stage";
    stage.innerHTML = `
      <div class="pxf-ends"><span class="pxf-cold">❄️ 冷</span><span class="pxf-hot">🔥 热</span></div>
      <div class="pxf-slots" id="pxf-slots"></div>
    `;
    wrap.appendChild(stage);

    // 待排序的羽毛（打乱）
    const tray = document.createElement("div");
    tray.className = "pxf-tray";
    tray.id = "pxf-tray";
    const order = shuffle(picked);
    order.forEach((idx) => tray.appendChild(this.makeFeather(idx)));
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
    this.buildSlots();
  }

  private buildSlots(): void {
    const slots = this.root.querySelector<HTMLElement>("#pxf-slots");
    if (!slots) return;
    slots.innerHTML = "";
    this.feathers.forEach((_, i) => {
      const s = document.createElement("div");
      s.className = "pxf-slot";
      s.id = `pxf-slot-${i}`;
      s.dataset.target = String(this.feathers[i]);
      if (i === this.cursor) s.classList.add("pxf-slot--active");
      slots.appendChild(s);
    });
  }

  private makeFeather(idx: number): HTMLButtonElement {
    const h = HEAT[idx]!;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pxf-feather";
    b.dataset.idx = String(idx);
    b.style.setProperty("--feather", h.color);
    b.setAttribute("aria-label", `${h.name}羽毛`);
    b.innerHTML = `<span class="pxf-feather-emoji">${h.emoji}</span>`;
    b.addEventListener("click", () => this.pick(idx, b));
    return b;
  }

  private pick(idx: number, btn: HTMLButtonElement): void {
    // 当前应填的槽位的目标
    const target = this.feathers[this.cursor]!;
    if (idx === target) {
      const slot = this.root.querySelector<HTMLElement>(
        `#pxf-slot-${this.cursor}`,
      );
      if (slot) {
        const h = HEAT[idx]!;
        slot.classList.remove("pxf-slot--active");
        slot.classList.add("pxf-slot--filled");
        slot.style.setProperty("--feather", h.color);
        slot.innerHTML = `<span class="pxf-feather-emoji">${h.emoji}</span>`;
      }
      btn.classList.add("pxf-feather--used");
      btn.disabled = true;
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.cursor += 1;
      // 激活下一槽
      const next = this.root.querySelector<HTMLElement>(
        `#pxf-slot-${this.cursor}`,
      );
      if (next) next.classList.add("pxf-slot--active");
      if (this.cursor >= this.feathers.length) {
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 900);
      }
    } else {
      btn.classList.add("pxf-feather--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("pxf-feather--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "左边是最冷的蓝色，右边是最热的红色，按顺序放进去～",
      primary: { text: "继续", icon: "🔥", onClick: () => ov.destroy() },
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
    if (document.getElementById("pxf-style")) return;
    const st = document.createElement("style");
    st.id = "pxf-style";
    st.textContent = PXF_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function PXF_CSS(theme: string): string {
  return `
.pxf-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.pxf-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.pxf-task b{color:${theme};}
.pxf-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.pxf-stage{width:100%;padding:18px 14px;border-radius:24px;background:linear-gradient(90deg,#e0f0ff 0%,#fff7e0 50%,#ffe0e0 100%);box-shadow:var(--shadow-lg);}
.pxf-ends{display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:1rem;padding:0 6px 10px;}
.pxf-cold{color:#4d96ff;}
.pxf-hot{color:#ff4d4d;}
.pxf-slots{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
.pxf-slot{width:58px;height:78px;border-radius:14px;border:3px dashed #cbb;background:#ffffffcc;display:flex;align-items:center;justify-content:center;transition:all .2s ease;position:relative;}
.pxf-slot--active{border-color:${theme};border-style:solid;background:#fff7e6;animation:pxf-glow 1.2s ease-in-out infinite;}
@keyframes pxf-glow{0%,100%{box-shadow:0 0 0 0 ${theme}55}50%{box-shadow:0 0 0 6px ${theme}22}}
.pxf-slot--filled{border:none;background:linear-gradient(180deg,#fff,var(--feather,${theme}));box-shadow:inset 0 -4px 8px rgba(0,0,0,.15),var(--shadow);animation:pxf-drop .4s ease;}
@keyframes pxf-drop{0%{transform:translateY(-12px) scale(.7);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
.pxf-feather-emoji{font-size:1.9rem;filter:drop-shadow(0 2px 3px rgba(0,0,0,.2));}
.pxf-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:14px;border-radius:20px;background:rgba(255,255,255,.7);box-shadow:var(--shadow);}
.pxf-feather{width:60px;height:80px;border:none;border-radius:14px;cursor:pointer;background:linear-gradient(180deg,#fff,var(--feather,${theme}));box-shadow:inset 0 -5px 8px rgba(0,0,0,.12),var(--shadow);display:flex;align-items:center;justify-content:center;transition:transform .12s ease;animation:pxf-bob 3s ease-in-out infinite;}
@keyframes pxf-bob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-4px) rotate(2deg)}}
.pxf-feather:active{transform:scale(.92);}
.pxf-feather--wrong{animation:pxf-shake .4s ease;}
.pxf-feather--used{opacity:.25;pointer-events:none;filter:grayscale(.7);}
@keyframes pxf-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.pxf-slot,.pxf-feather{width:48px;height:66px;}.pxf-feather-emoji{font-size:1.5rem;}}
`;
}

export function create(): PhoenixFeatherGame {
  return new PhoenixFeatherGame();
}
