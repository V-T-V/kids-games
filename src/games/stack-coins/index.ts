/* 叠硬币 Stack-Coins —— 把硬币一枚枚拖到塔顶精确叠上去。
   独特点：精细对准 + 堆叠。视觉：硬币塔 + 待叠硬币。
   巧思：要叠在"最上面那枚"附近才能放稳，偏太多会弹回并抖动；越叠越高。难度=硬币数。前缀 stk-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

interface Coin {
  color: string;
  el: HTMLDivElement;
  placed: boolean;
}

const COLORS = [
  "#ffd93d",
  "#ff9f43",
  "#6bcf7f",
  "#4d96ff",
  "#a55eea",
  "#ff6b9d",
];

export class StackCoinsGame extends BaseGame {
  constructor() {
    super("stack-coins");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private coins: Coin[] = [];
  private tower: HTMLDivElement | null = null;
  private base: HTMLDivElement | null = null;
  private remaining = 0;

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
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbinds.forEach((u) => u());
    this.unbinds = [];
    this.coins = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    this.remaining = n;

    const wrap = document.createElement("div");
    wrap.className = "stk-wrap";
    const task = document.createElement("div");
    task.className = "stk-task";
    task.innerHTML = `把硬币<b>一枚枚</b>叠到塔顶，要对准哦～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "stk-stage";

    const tower = document.createElement("div");
    tower.className = "stk-tower";
    const base = document.createElement("div");
    base.className = "stk-base"; // 起始底座（算第 0 层）
    tower.appendChild(base);
    stage.appendChild(tower);
    wrap.appendChild(stage);
    this.tower = tower;
    this.base = base;

    const tray = document.createElement("div");
    tray.className = "stk-tray";
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      el.className = "stk-coin";
      const color = COLORS[i % COLORS.length]!;
      el.style.setProperty("--stk-color", color);
      el.innerHTML = `<span class="stk-coin__center" style="color:${color}">¤</span>`;
      tray.appendChild(el);
      this.coins.push({ color, el, placed: false });
    }
    wrap.appendChild(tray);
    this.root.appendChild(wrap);

    this.coins.forEach((c) => this.enableDrag(c));
  }

  private enableDrag(c: Coin): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    const u = bindPointer(c.el, {
      down: (p) => {
        if (c.placed) return;
        dragging = true;
        const r = c.el.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        c.el.classList.add("stk-coin--drag");
        document.body.appendChild(c.el);
        c.el.style.position = "fixed";
        c.el.style.left = `${p.x - ox}px`;
        c.el.style.top = `${p.y - oy}px`;
        c.el.style.width = `${r.width}px`;
        c.el.style.height = `${r.height}px`;
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        c.el.style.left = `${p.x - ox}px`;
        c.el.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging || c.placed) return;
        dragging = false;
        c.el.classList.remove("stk-coin--drag");
        // 目标 = 当前塔顶（最后放置的那枚，或底座）
        const top = this.currentTop();
        if (!top) return;
        const r = top.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(p.x - cx, p.y - cy);
        const tol =
          this.difficulty === "easy"
            ? 70
            : this.difficulty === "medium"
              ? 56
              : 44;
        if (dist <= tol) {
          c.placed = true;
          c.el.style.position = "";
          c.el.style.left = "";
          c.el.style.top = "";
          c.el.style.width = "";
          c.el.style.height = "";
          c.el.style.transform = "";
          // 叠到塔顶（插入到底座之前，保持顺序从下到上）
          this.tower?.insertBefore(c.el, this.base?.nextSibling ?? null);
          c.el.classList.add("stk-coin--placed");
          this.onCorrect(cx, cy);
          this.resetWrongStreak();
          this.remaining -= 1;
          if (this.remaining <= 0) {
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
          // 弹回托盘
          c.el.parentElement?.removeChild(c.el);
          this.root.querySelector(".stk-tray")?.appendChild(c.el);
          c.el.style.position = "";
          c.el.style.left = "";
          c.el.style.top = "";
          c.el.style.width = "";
          c.el.style.height = "";
          c.el.style.transform = "";
          c.el.classList.add("stk-coin--shake");
          const paused = this.onWrong();
          this.trackTimeout(
            () => c.el.classList.remove("stk-coin--shake"),
            450,
          );
          if (paused) this.showRest();
        }
      },
    });
    this.unbinds.push(u);
  }

  /** 当前塔顶：最后一个 placed 硬币，没有则返回底座。 */
  private currentTop(): HTMLElement | null {
    const placed = this.coins.find((c) => c.placed);
    if (!placed) return this.base;
    // 返回最后一个 placed
    let last: HTMLElement = placed.el;
    for (const c of this.coins) {
      if (c.placed) last = c.el;
    }
    return last;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "对准塔顶～",
      emoji: "🪙",
      variant: "rest",
      body: "把硬币<b>对准</b>最上面那枚的中间，叠稳了再松手～",
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
    if (document.getElementById("stk-style")) return;
    const st = document.createElement("style");
    st.id = "stk-style";
    st.textContent = STK_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function STK_CSS(theme: string): string {
  return `
.stk-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.stk-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.stk-task b{color:${theme};}
.stk-stage{display:flex;align-items:flex-end;justify-content:center;width:100%;height:260px;background:linear-gradient(180deg,rgba(255,255,255,.4),rgba(255,255,255,.7));border-radius:20px;box-shadow:var(--shadow);}
.stk-tower{display:flex;flex-direction:column-reverse;align-items:center;gap:3px;padding-bottom:6px;}
.stk-base{width:96px;height:16px;border-radius:8px;background:linear-gradient(180deg,#b08968,#8d6e53);box-shadow:0 2px 4px rgba(0,0,0,.25);}
.stk-coin{width:74px;height:22px;border-radius:50%;background:radial-gradient(ellipse at 50% 30%,#fff8,var(--stk-color,#888));border:2px solid rgba(0,0,0,.12);box-shadow:0 2px 4px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;user-select:none;transition:transform .12s;}
.stk-coin__center{font-size:.9rem;font-weight:900;opacity:.5;}
.stk-coin:active{transform:scale(1.05);}
.stk-coin--drag{cursor:grabbing;transform:scale(1.15);z-index:100;filter:drop-shadow(0 6px 8px rgba(0,0,0,.35));}
.stk-coin--placed{cursor:default;animation:stk-drop .35s ease;}
.stk-coin--shake{animation:stk-shake .4s ease;}
@keyframes stk-drop{0%{transform:translateY(-30px) scale(1.1)}100%{transform:translateY(0) scale(1)}}
@keyframes stk-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.stk-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:14px 18px;background:rgba(255,255,255,.6);border-radius:18px;min-height:60px;width:100%;max-width:420px;}
@media (max-width:380px){.stk-coin{width:62px;height:20px;}.stk-base{width:84px;}}
`;
}

export function create(): StackCoinsGame {
  return new StackCoinsGame();
}
