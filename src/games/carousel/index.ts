/* 旋转木马 Carousel —— 一个旋转的木马（CSS 旋转动画），上面有不同颜色的木马，
   题目"坐上红色的木马"，等红色转到上面的"上马门"时点它。
   独特点：CSS 旋转动画 + 时机判断，用 getBoundingClientRect 判定目标木马
   是否转到顶部上马门位置。
   视觉：旋转的木马（彩色小马 + 顶棚 + 立柱）。难度=木马数/转速。
   通关=坐对目标轮数。前缀 cr2-（确保不冲突）。CSS 动画游戏（无 RAF 需取消）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Horse {
  key: string;
  name: string;
  hex: string;
  emoji: string;
}

const HORSES: Horse[] = [
  { key: "red", name: "红", hex: "#ef5350", emoji: "🎠" },
  { key: "blue", name: "蓝", hex: "#42a5f5", emoji: "🎠" },
  { key: "yellow", name: "黄", hex: "#ffca28", emoji: "🎠" },
  { key: "green", name: "绿", hex: "#66bb6a", emoji: "🎠" },
  { key: "purple", name: "紫", hex: "#ab47bc", emoji: "🎠" },
  { key: "pink", name: "粉", hex: "#ff8fb1", emoji: "🎠" },
];

export class CarouselGame extends BaseGame {
  constructor() {
    super("carousel");
  }

  private unbind: (() => void) | null = null;
  private horseEls: Record<string, HTMLElement> = {};
  private target!: Horse;
  private roundsDone = 0;
  private roundTotal = 0;
  private done = false;

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

  /** 木马数 */
  private horseCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 5
        : 6;
  }
  /** 旋转一周秒数（难度越高越快） */
  private spinDuration(): number {
    return this.difficulty === "easy"
      ? 9
      : this.difficulty === "medium"
        ? 6
        : 4;
  }

  private startRound(): void {
    this.done = false;
    this.unbind?.();
    this.unbind = null;
    this.horseEls = {};
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.horseCount();
    const horses = shuffle(HORSES).slice(0, n);
    this.target = sample(horses);

    const wrap = document.createElement("div");
    wrap.className = "cr2-wrap";

    const task = document.createElement("div");
    task.className = "cr2-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 坐上<span style="color:${this.target.hex}">${this.target.name}色</span>的小马，等它转到<b>上马门</b>时点它！`;
    wrap.appendChild(task);

    // 旋转木马舞台
    const stage = document.createElement("div");
    stage.className = "cr2-stage";

    // 顶棚
    const top = document.createElement("div");
    top.className = "cr2-top";
    top.innerHTML = "🎪";
    stage.appendChild(top);

    // 上马门标记（顶部正中）
    const gate = document.createElement("div");
    gate.className = "cr2-gate";
    gate.innerHTML = `<span>上马门</span>▾`;
    stage.appendChild(gate);

    // 旋转盘
    const wheel = document.createElement("div");
    wheel.className = "cr2-wheel";
    wheel.id = "cr2-wheel";
    wheel.style.animationDuration = `${this.spinDuration()}s`;
    // 中心立柱
    const pole = document.createElement("div");
    pole.className = "cr2-pole";
    wheel.appendChild(pole);

    const radius = 110;
    horses.forEach((h, i) => {
      const angle = (360 / n) * i;
      const slot = document.createElement("div");
      slot.className = "cr2-horse";
      slot.style.setProperty("--cr2-angle", `${angle}deg`);
      slot.style.setProperty("--cr2-r", `${radius}px`);
      slot.style.setProperty("--cr2-c", h.hex);
      slot.dataset.key = h.key;
      slot.innerHTML = `<div class="cr2-horse__emoji">${h.emoji}</div><div class="cr2-horse__ring" style="background:${h.hex}"></div>`;
      wheel.appendChild(slot);
      this.horseEls[h.key] = slot;
    });
    stage.appendChild(wheel);
    wrap.appendChild(stage);

    // 点击区：整个舞台都可点（点中哪个木马由位置判定）
    this.unbind = bindPointer(stage, {
      down: (p) => this.handleClick(p),
    });

    this.root.appendChild(wrap);
  }

  private handleClick(p: { x: number; y: number }): void {
    if (this.done) return;
    // 找到指针下方的木马（用 hit 检测：哪个木马 rect 包含指针）
    let hitKey: string | null = null;
    for (const k of Object.keys(this.horseEls)) {
      const el = this.horseEls[k]!;
      const r = el.getBoundingClientRect();
      // 给小马一个稍大的可点区
      if (
        p.x >= r.left - 6 &&
        p.x <= r.right + 6 &&
        p.y >= r.top - 6 &&
        p.y <= r.bottom + 6
      ) {
        hitKey = k;
        break;
      }
    }
    if (hitKey === null) return; // 没点中小马

    if (hitKey !== this.target.key) {
      // 点错了颜色
      const el = this.horseEls[hitKey]!;
      el.classList.add("cr2-horse--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => el.classList.remove("cr2-horse--wrong"), 400);
      if (paused) this.showRest();
      return;
    }

    // 点对了颜色，再判定是否在上马门（顶部附近）：
    // 该木马中心 y 应接近 wheel 顶部。用 rect 比较它与 wheel 顶部。
    const wheel = this.root.querySelector("#cr2-wheel");
    if (!wheel) return;
    const el = this.horseEls[hitKey]!;
    const er = el.getBoundingClientRect();
    const wr = wheel.getBoundingClientRect();
    const horseCenterY = er.top + er.height / 2;
    const wheelTopY = wr.top;
    // 上马门容差：木马中心在 wheel 顶部 ~1/3 半径内
    const tolerance = wr.height * 0.28;
    if (horseCenterY - wheelTopY > tolerance) {
      // 颜色对但还没转到上马门
      el.classList.add("cr2-horse--early");
      const paused = this.onWrong();
      this.trackTimeout(() => el.classList.remove("cr2-horse--early"), 400);
      if (paused) this.showRest();
      return;
    }

    // 成功！
    this.done = true;
    el.classList.add("cr2-horse--win");
    sfxPop();
    this.onCorrect(er.left + er.width / 2, er.top + er.height / 2);
    this.resetWrongStreak();
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

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🎠",
      variant: "rest",
      body: `找${this.target.name}色的小马，等它转到最上面的"上马门"再点哦～`,
      primary: { text: "继续", icon: "🎡", onClick: () => ov.destroy() },
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
    if (document.getElementById("cr2-style")) return;
    const st = document.createElement("style");
    st.id = "cr2-style";
    st.textContent = CR2_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function CR2_CSS(theme: string): string {
  return `
.cr2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.cr2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.cr2-task b{color:${theme};}
.cr2-stage{position:relative;width:340px;height:360px;max-width:90vw;max-height:60vh;display:flex;align-items:center;justify-content:center;touch-action:none;}
.cr2-top{position:absolute;top:0;left:50%;transform:translateX(-50%);font-size:2.6rem;z-index:6;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25));}
.cr2-gate{position:absolute;top:38px;left:50%;transform:translateX(-50%);z-index:7;font-weight:900;color:${theme};font-size:.85rem;display:flex;flex-direction:column;align-items:center;line-height:1;background:#fff;padding:4px 10px;border-radius:10px;box-shadow:var(--shadow);}
.cr2-wheel{position:relative;width:300px;height:300px;border-radius:50%;animation:cr2-spin linear infinite;background:radial-gradient(circle,#fff6 0%,#fff0 60%),conic-gradient(from 0deg,#ffe0ec,#fff0f6,#ffe0ec,#fff0f6,#ffe0ec,#fff0f6,#ffe0ec,#fff0f6);box-shadow:inset 0 0 0 6px rgba(255,255,255,.7),var(--shadow);}
@keyframes cr2-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.cr2-pole{position:absolute;top:20%;left:50%;width:8px;height:60%;background:linear-gradient(180deg,#ffd1e3,#ff8fb1);border-radius:4px;transform:translateX(-50%);box-shadow:0 0 0 2px rgba(255,255,255,.5);}
.cr2-horse{position:absolute;top:50%;left:50%;width:64px;height:64px;margin:-32px 0 0 -32px;transform:rotate(var(--cr2-angle)) translateY(calc(-1 * var(--cr2-r))) rotate(calc(-1 * var(--cr2-angle)));display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:transform .12s;}
.cr2-horse__emoji{font-size:2.2rem;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));}
.cr2-horse__ring{width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);margin-top:-4px;}
/* 悬停时暂停转盘，方便瞄准点击（桌面）；触屏用实时命中检测 */
.cr2-wheel:hover{animation-play-state:paused;}
.cr2-horse--wrong .cr2-horse__emoji{animation:cr2-shake .4s ease;filter:grayscale(.5);}
.cr2-horse--early .cr2-horse__emoji{animation:cr2-shake .4s ease;opacity:.6;}
.cr2-horse--win{animation:cr2-bounce .5s ease;}
@keyframes cr2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@keyframes cr2-bounce{0%{transform:rotate(var(--cr2-angle)) translateY(calc(-1 * var(--cr2-r))) rotate(calc(-1 * var(--cr2-angle))) scale(1)}50%{transform:rotate(var(--cr2-angle)) translateY(calc(-1 * var(--cr2-r))) rotate(calc(-1 * var(--cr2-angle))) scale(1.35)}100%{transform:rotate(var(--cr2-angle)) translateY(calc(-1 * var(--cr2-r))) rotate(calc(-1 * var(--cr2-angle))) scale(1)}}
@media (max-width:380px){.cr2-stage{width:280px;height:300px;}.cr2-wheel{width:250px;height:250px;}.cr2-horse{width:54px;height:54px;margin:-27px 0 0 -27px;}.cr2-horse__emoji{font-size:1.8rem;}}
`;
}

export function create(): CarouselGame {
  return new CarouselGame();
}
