/* 搭桥 Bridge Build —— 河面上有几段缺口，下方放着不同长度的木板，
   孩子点选一块木板，再点对应长度的缺口，木板就会"飞过去"架好。
   独特点：长度匹配——缺口宽度和木板长度一一对应（区别于随意填）。
   视觉：河流（流动）+ 河岸 + 缺口（空缺）+ 木板。
   难度=缺口数量。通关=搭完目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, shuffle, randInt } from "../../lobby/util.ts";

interface Gap {
  el: HTMLButtonElement;
  /** 缺口长度（像素单位，整数） */
  size: number;
  filled: boolean;
}

interface Plank {
  el: HTMLButtonElement;
  size: number;
  used: boolean;
}

export class BridgeBuildGame extends BaseGame {
  constructor() {
    super("bridge-build");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private over = false;
  private gaps: Gap[] = [];
  private planks: Plank[] = [];
  private selected: Plank | null = null;
  private placed = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
  }

  private startRound(): void {
    this.over = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.root.innerHTML = "";
    this.gaps = [];
    this.planks = [];
    this.selected = null;
    this.placed = 0;

    const count =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;

    // 生成不同长度（保证彼此不重复，便于唯一匹配）
    const sizes = new Set<number>();
    while (sizes.size < count) sizes.add(randInt(3, 7)); // 3..7 个单位长
    const sizeList = [...sizes];

    const wrap = document.createElement("div");
    wrap.className = "bb3-wrap";

    const task = document.createElement("div");
    task.className = "bb3-task";
    task.id = "bb3-task";
    task.innerHTML = `先点一块<b>木板</b>，再点<b>同样长</b>的缺口把它搭上去！<br><span class="bb3-hint">已搭好 <b id="bb3-done">0</b> / ${count} · 第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    // 河流 + 桥面（含缺口）
    const river = document.createElement("div");
    river.className = "bb3-river";
    const bridge = document.createElement("div");
    bridge.className = "bb3-bridge";
    bridge.id = "bb3-bridge";

    // 顺序铺桥：按 size 升序排列，便于视觉对齐
    const gapOrder = [...sizeList].sort((a, b) => a - b);
    for (const size of gapOrder) {
      const gapEl = document.createElement("button");
      gapEl.type = "button";
      gapEl.className = "bb3-gap";
      gapEl.style.setProperty("--u", String(size));
      gapEl.innerHTML = `<span class="bb3-gap-water"></span>`;
      bridge.appendChild(gapEl);
      const g: Gap = { el: gapEl, size, filled: false };
      gapEl.addEventListener("click", () => this.place(g));
      this.gaps.push(g);
    }
    river.appendChild(bridge);
    wrap.appendChild(river);

    // 木板库（乱序）
    const tray = document.createElement("div");
    tray.className = "bb3-tray";
    tray.id = "bb3-tray";
    for (const size of shuffle(sizeList)) {
      const pe = document.createElement("button");
      pe.type = "button";
      pe.className = "bb3-plank";
      pe.style.setProperty("--u", String(size));
      pe.innerHTML = `<span class="bb3-plank-wood"></span>`;
      tray.appendChild(pe);
      const p: Plank = { el: pe, size, used: false };
      pe.addEventListener("click", () => this.select(p));
      this.planks.push(p);
    }
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private select(p: Plank): void {
    if (this.over || p.used) return;
    // 取消上一次选中
    this.planks.forEach((x) => x.el.classList.remove("bb3-plank--sel"));
    this.selected = p;
    p.el.classList.add("bb3-plank--sel");
    sfxPop();
  }

  private place(g: Gap): void {
    if (this.over || g.filled) return;
    if (!this.selected) {
      // 没选木板，温和提示
      g.el.classList.add("bb3-gap--shake");
      this.trackTimeout(() => g.el.classList.remove("bb3-gap--shake"), 300);
      return;
    }
    const p = this.selected;
    if (p.size === g.size) {
      p.used = true;
      g.filled = true;
      this.placed += 1;
      // 把木板"飞"到缺口里：复制一个木板填进缺口
      const fill = document.createElement("div");
      fill.className = "bb3-fill";
      fill.style.setProperty("--u", String(p.size));
      fill.innerHTML = `<span class="bb3-plank-wood"></span>`;
      g.el.appendChild(fill);
      g.el.classList.add("bb3-gap--filled");
      p.el.classList.add("bb3-plank--used");
      p.el.disabled = true;
      g.el.disabled = true;
      this.resetWrongStreak();
      sfxPop();
      const r = g.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      const doneEl = this.root.querySelector("#bb3-done");
      if (doneEl) doneEl.textContent = String(this.placed);
      this.selected = null;
      if (this.placed >= this.gaps.length) {
        this.over = true;
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 900);
      }
    } else {
      // 长度不符
      g.el.classList.add("bb3-gap--shake");
      this.trackTimeout(() => g.el.classList.remove("bb3-gap--shake"), 300);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = document.createElement("div");
    ov.className = "bb3-rest";
    ov.textContent = "比一比，木板要和缺口一样长～";
    this.root.appendChild(ov);
    this.trackTimeout(() => ov.remove(), 1300);
  }

  private injectStyle(): void {
    if (document.getElementById("bb3-style")) return;
    const st = document.createElement("style");
    st.id = "bb3-style";
    st.textContent = BB3_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function BB3_CSS(theme: string): string {
  return `
.bb3-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.bb3-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);max-width:480px;}
.bb3-task b{color:${theme};}
.bb3-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.bb3-river{position:relative;width:min(480px,94vw);padding:34px 14px 14px;background:linear-gradient(180deg,#4fc3f7,#0277bd);border-radius:24px;box-shadow:var(--shadow-lg);overflow:hidden;}
.bb3-river::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.1) 0 18px,transparent 18px 36px);animation:bb3-flow 3s linear infinite;pointer-events:none;}
@keyframes bb3-flow{from{transform:translateX(0)}to{transform:translateX(36px)}}
.bb3-bridge{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;position:relative;z-index:2;}
.bb3-gap{position:relative;width:calc(var(--u) * 26px);height:40px;border:none;border-radius:8px;background:transparent;cursor:pointer;padding:0;box-shadow:inset 0 -3px 8px rgba(0,0,0,.35),inset 0 0 0 2px rgba(255,255,255,.15);overflow:hidden;transition:transform .12s ease;}
.bb3-gap-water{position:absolute;inset:2px;border-radius:6px;background:linear-gradient(180deg,#29b6f6,#01579b);}
.bb3-gap:active{transform:scale(.97);}
.bb3-gap--shake{animation:bb3-shake .3s ease;}
@keyframes bb3-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.bb3-gap--filled{cursor:default;}
.bb3-fill{position:absolute;inset:0;animation:bb3-drop .35s ease;}
@keyframes bb3-drop{0%{transform:translateY(-26px);opacity:0}100%{transform:translateY(0);opacity:1}}
.bb3-plank-wood{position:absolute;inset:0;border-radius:6px;background:repeating-linear-gradient(90deg,#a1887f 0 14px,#8d6e63 14px 16px);box-shadow:inset 0 -3px 0 rgba(0,0,0,.2),inset 0 2px 0 rgba(255,255,255,.25);border:2px solid #5d4037;}
.bb3-tray{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:16px;background:#fff7e8;border-radius:18px;box-shadow:var(--shadow);min-height:64px;align-items:center;}
.bb3-plank{position:relative;width:calc(var(--u) * 26px);height:40px;border:none;background:transparent;padding:0;cursor:pointer;transition:transform .12s ease;}
.bb3-plank:active{transform:scale(.96);}
.bb3-plank--sel{transform:translateY(-6px);filter:drop-shadow(0 6px 6px rgba(0,0,0,.25));}
.bb3-plank--sel .bb3-plank-wood{box-shadow:inset 0 -3px 0 rgba(0,0,0,.2),inset 0 2px 0 rgba(255,255,255,.25),0 0 0 3px ${theme};}
.bb3-plank--used{opacity:0;pointer-events:none;transform:scale(.5);}
.bb3-rest{position:fixed;left:50%;top:24%;transform:translateX(-50%);background:#fff;padding:10px 20px;border-radius:999px;font-weight:800;box-shadow:var(--shadow-lg);z-index:30;}
@media (max-width:380px){.bb3-river{padding:28px 10px 10px;}.bb3-tray{gap:8px;padding:12px;}}
`;
}

export function create(): BridgeBuildGame {
  return new BridgeBuildGame();
}
