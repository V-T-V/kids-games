/* 附魔 Enchantment —— 几件装备（剑/盾/盔甲/弓）需要附魔，每件需要对应颜色的
   附魔粉。孩子拖动粉末到对应装备上，颜色匹配则装备被附魔发光。
   独特点：颜色匹配 + 拖拽。粉末有固定颜色，装备头顶气泡显示需要的粉末色。
   拖动粉末时跟随指针，松手时检测是否落在正确装备上。
   视觉：装备架 + 彩色粉末堆。难度=装备数。通关=附魔目标轮数。
   使用 bindPointer 实现拖拽。
   解保证：每件装备的目标色都对应一份粉末。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

const COLORS = [
  { name: "红", hex: "#ff6b6b" },
  { name: "蓝", hex: "#4d96ff" },
  { name: "绿", hex: "#6bcf7f" },
  { name: "紫", hex: "#a55eea" },
  { name: "金", hex: "#ffd93d" },
] as const;

const GEAR = ["⚔️", "🛡️", "🪖", "🏹", "🧥"] as const;

interface Gear {
  el: HTMLDivElement;
  color: number;
  enchanted: boolean;
}

interface Powder {
  el: HTMLDivElement;
  color: number;
  used: boolean;
  /** 原始位置（用于归位）。 */
  homeX: number;
  homeY: number;
}

export class EnchantmentGame extends BaseGame {
  constructor() {
    super("enchantment");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private gears: Gear[] = [];
  private powders: Powder[] = [];
  private remaining = 0;
  private unbind: (() => void) | null = null;
  /** 当前正在拖动的粉末。 */
  private drag: Powder | null = null;
  private dragOffset = { x: 0, y: 0 };
  private stage!: HTMLDivElement;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbind?.();
    this.unbind = null;
  }

  private gearCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.unbind?.();
    this.unbind = null;
    this.gears = [];
    this.powders = [];
    this.drag = null;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.gearCount();
    const wrap = document.createElement("div");
    wrap.className = "enc-wrap";
    const task = document.createElement("div");
    task.className = "enc-task";
    task.innerHTML = `把彩色粉末拖到对应颜色的装备上！（第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    this.stage = document.createElement("div");
    this.stage.className = "enc-stage";
    this.stage.id = "enc-stage";

    // 装备架（顶部一排）
    const rack = document.createElement("div");
    rack.className = "enc-rack";
    rack.id = "enc-rack";
    const colorOrder = shuffle(COLORS.map((_, i) => i)).slice(0, n);
    const gearList = shuffle(GEAR.map((_, i) => i)).slice(0, n);
    for (let i = 0; i < n; i++) {
      const ci = colorOrder[i]!;
      const c = COLORS[ci]!;
      const g = document.createElement("div");
      g.className = "enc-gear";
      g.dataset.color = String(ci);
      g.innerHTML = `<span class="enc-need" style="--enc-color:${c.hex}">●</span><span class="enc-gear-emoji">${gearList[i] !== undefined ? GEAR[gearList[i]!] : "⚔️"}</span>`;
      rack.appendChild(g);
      this.gears.push({ el: g, color: ci, enchanted: false });
    }
    this.stage.appendChild(rack);

    // 粉末盘（底部一排）—— 每件装备一份对应色粉末 + 1 干扰
    const tray = document.createElement("div");
    tray.className = "enc-tray";
    tray.id = "enc-tray";
    const powderColors = [...colorOrder];
    const distract = shuffle(
      COLORS.map((_, i) => i).filter((i) => !colorOrder.includes(i)),
    ).slice(0, 1);
    powderColors.push(...distract);
    for (const ci of shuffle(powderColors)) {
      const c = COLORS[ci]!;
      const p = document.createElement("div");
      p.className = "enc-powder";
      p.dataset.color = String(ci);
      p.style.setProperty("--enc-color", c.hex);
      p.innerHTML = `<span class="enc-puff"></span>`;
      tray.appendChild(p);
    }
    this.stage.appendChild(tray);
    wrap.appendChild(this.stage);
    this.root.appendChild(wrap);

    // 布局完成后再记录粉末初始位置
    requestAnimationFrame(() => this.bindDrag());
    this.remaining = n;
  }

  private bindDrag(): void {
    // 记录每份粉末的原始位置
    this.powders = [];
    this.root.querySelectorAll<HTMLDivElement>(".enc-powder").forEach((el) => {
      const r = el.getBoundingClientRect();
      const sr = this.stage.getBoundingClientRect();
      const ci = Number(el.dataset.color);
      this.powders.push({
        el,
        color: ci,
        used: false,
        homeX: r.left - sr.left,
        homeY: r.top - sr.top,
      });
    });

    this.unbind = bindPointer(this.stage, {
      down: (p) => {
        // 通过 elementFromPoint 找到被按下的粉末（Pointer 只有 x/y/id，无 target）
        const hit = document.elementFromPoint(p.x, p.y) as HTMLElement | null;
        const powderEl = this.findPowderEl(hit);
        if (!powderEl) return;
        const powder = this.powders.find((x) => x.el === powderEl);
        if (!powder || powder.used) return;
        this.drag = powder;
        const r = powder.el.getBoundingClientRect();
        this.dragOffset = { x: p.x - r.left, y: p.y - r.top };
        powder.el.classList.add("enc-powder--drag");
        this.movePowder(p);
      },
      move: (p) => {
        if (this.drag) this.movePowder(p);
      },
      up: (p) => {
        if (!this.drag) return;
        this.drop(p);
        this.drag = null;
      },
    });
  }

  /** 从事件目标向上找到 .enc-powder 元素。 */
  private findPowderEl(el: HTMLElement | null): HTMLDivElement | null {
    let cur: HTMLElement | null = el;
    while (cur && cur !== this.stage) {
      if (cur.classList && cur.classList.contains("enc-powder")) {
        return cur as HTMLDivElement;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  private movePowder(p: { x: number; y: number }): void {
    if (!this.drag) return;
    const sr = this.stage.getBoundingClientRect();
    const x = p.x - sr.left - this.dragOffset.x;
    const y = p.y - sr.top - this.dragOffset.y;
    this.drag.el.style.left = `${x}px`;
    this.drag.el.style.top = `${y}px`;
  }

  private drop(p: { x: number; y: number }): void {
    const powder = this.drag!;
    // 检测落在哪件装备上
    const hit = document.elementFromPoint(p.x, p.y) as HTMLElement | null;
    let gearEl: HTMLElement | null = hit;
    while (gearEl && gearEl !== this.stage) {
      if (gearEl.classList && gearEl.classList.contains("enc-gear")) break;
      gearEl = gearEl.parentElement;
    }
    const gear = gearEl ? this.gears.find((g) => g.el === gearEl) : undefined;

    if (gear && !gear.enchanted && gear.color === powder.color) {
      // 附魔成功
      gear.enchanted = true;
      powder.used = true;
      gear.el.classList.add("enc-gear--enchanted");
      powder.el.classList.add("enc-powder--used");
      sfxPop();
      const r = gear.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.remaining -= 1;
      if (this.remaining <= 0) {
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 800);
      }
    } else if (gear && !gear.enchanted && gear.color !== powder.color) {
      // 颜色不对：抖动装备 + 归位
      gear.el.classList.add("enc-shake");
      this.trackTimeout(() => gear.el.classList.remove("enc-shake"), 400);
      const paused = this.onWrong();
      this.returnHome(powder);
      if (paused) this.showRest();
    } else {
      // 没拖到装备：归位
      this.returnHome(powder);
    }
  }

  private returnHome(powder: Powder): void {
    powder.el.classList.remove("enc-powder--drag");
    powder.el.classList.add("enc-powder--return");
    powder.el.style.left = `${powder.homeX}px`;
    powder.el.style.top = `${powder.homeY}px`;
    this.trackTimeout(
      () => powder.el.classList.remove("enc-powder--return"),
      300,
    );
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "装备头顶的圆点是什么颜色，就拖一样颜色的粉末给它～",
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
    if (document.getElementById("enc-style")) return;
    const st = document.createElement("style");
    st.id = "enc-style";
    st.textContent = ENC_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function ENC_CSS(_theme: string): string {
  return `
.enc-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);}
.enc-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.enc-stage{position:relative;width:100%;height:62vh;min-height:380px;display:flex;flex-direction:column;justify-content:space-between;padding:16px;gap:18px;background:linear-gradient(160deg,#3a2a4a,#1f1830);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;touch-action:none;}
.enc-stage::before{content:"✨";position:absolute;top:8px;left:0;right:0;text-align:center;font-size:1.2rem;opacity:.5;letter-spacing:8px;}
.enc-rack{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:flex-end;padding-top:18px;}
.enc-gear{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;width:74px;padding:12px 6px 8px;background:linear-gradient(160deg,#4a3a5a,#2f2440);border-radius:14px;box-shadow:var(--shadow);border:2px solid #5a4a6a;transition:all .25s;}
.enc-need{position:absolute;top:-10px;font-size:1.4rem;line-height:1;filter:drop-shadow(0 0 6px var(--enc-color));animation:enc-bob 1.4s ease-in-out infinite;}
@keyframes enc-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.enc-gear-emoji{font-size:2.4rem;line-height:1;filter:grayscale(.4) opacity(.85);}
.enc-gear--enchanted{background:linear-gradient(160deg,var(--enc-color),#2f2440);border-color:#fff;box-shadow:0 0 18px var(--enc-color),var(--shadow);}
.enc-gear--enchanted .enc-gear-emoji{filter:none;animation:enc-shine .5s ease;}
.enc-gear--enchanted .enc-need{opacity:0;}
@keyframes enc-shine{0%{transform:scale(.8)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
.enc-tray{position:relative;display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:center;min-height:90px;padding:14px;background:rgba(255,255,255,.08);border-radius:16px;}
.enc-powder{position:relative;width:58px;height:58px;border-radius:50%;background:transparent;cursor:grab;touch-action:none;transition:left .28s cubic-bezier(.3,1.4,.5,1),top .28s cubic-bezier(.3,1.4,.5,1);}
.enc-powder--drag{cursor:grabbing;transition:none;z-index:20;filter:drop-shadow(0 6px 8px rgba(0,0,0,.4));}
.enc-powder--return{}
.enc-puff{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,var(--enc-color));box-shadow:0 0 14px var(--enc-color),inset 0 -4px 8px rgba(0,0,0,.2);}
.enc-powder--used{opacity:0;transform:scale(0);pointer-events:none;}
.enc-shake{animation:enc-shake .4s ease;}
@keyframes enc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.enc-gear{width:60px;}.enc-powder{width:50px;height:50px;}}
`;
}

export function create(): EnchantmentGame {
  return new EnchantmentGame();
}
