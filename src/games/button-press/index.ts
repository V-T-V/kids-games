/* 按纽扣 Button Press —— 把 4 个彩色纽扣拖到对应颜色的扣眼里（扣眼在布料上）。
   独特点：颜色配对 + 精细拖拽嵌入。视觉：布料 + 圆扣眼（虚线圆）+ 立体纽扣。
   巧思：纽扣放对色扣眼会"咔"地嵌入并变色；放错弹回原位。
   难度 = 纽扣数（3/4/5）。通关 = 完成目标轮数。前缀 btp-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Button {
  color: string;
  el: HTMLDivElement;
  placed: boolean;
  origin: HTMLElement;
  originStyle: { left: string; top: string };
}

const COLORS = [
  { hex: "#ff5252", name: "红" },
  { hex: "#4d96ff", name: "蓝" },
  { hex: "#6bcf7f", name: "绿" },
  { hex: "#ffd93d", name: "黄" },
  { hex: "#a55eea", name: "紫" },
];

export class ButtonPressGame extends BaseGame {
  constructor() {
    super("button-press");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbinds: (() => void)[] = [];
  private buttons: Button[] = [];
  private holes: HTMLDivElement[] = [];
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
    this.buttons = [];
    this.holes = [];
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.count();
    this.remaining = n;
    const picked = shuffle(COLORS).slice(0, n);

    const wrap = document.createElement("div");
    wrap.className = "btp-wrap";
    const task = document.createElement("div");
    task.className = "btp-task";
    task.innerHTML = `把纽扣拖到<b>一样颜色</b>的扣眼里～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 布料区（含扣眼）
    const cloth = document.createElement("div");
    cloth.className = "btp-cloth";
    picked.forEach((c) => {
      const hole = document.createElement("div");
      hole.className = "btp-hole";
      hole.style.setProperty("--btp-color", c.hex);
      hole.dataset.color = c.hex;
      hole.innerHTML = `<div class="btp-hole__ring"></div>`;
      cloth.appendChild(hole);
      this.holes.push(hole);
    });
    wrap.appendChild(cloth);

    // 纽扣托盘
    const tray = document.createElement("div");
    tray.className = "btp-tray";
    const shuffled = shuffle(picked);
    shuffled.forEach((c) => {
      const el = document.createElement("div");
      el.className = "btp-btn";
      el.style.setProperty("--btp-color", c.hex);
      el.innerHTML = `<div class="btp-btn__dot"></div><div class="btp-btn__dot"></div><div class="btp-btn__dot"></div><div class="btp-btn__dot"></div>`;
      tray.appendChild(el);
      this.buttons.push({
        color: c.hex,
        el,
        placed: false,
        origin: tray,
        originStyle: { left: "", top: "" },
      });
    });
    wrap.appendChild(tray);
    this.root.appendChild(wrap);

    this.buttons.forEach((b) => this.enableDrag(b));
  }

  private enableDrag(b: Button): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    const u = bindPointer(b.el, {
      down: (p) => {
        if (b.placed) return;
        dragging = true;
        const r = b.el.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        b.el.classList.add("btp-btn--drag");
        b.el.style.position = "fixed";
        b.el.style.left = `${p.x - ox}px`;
        b.el.style.top = `${p.y - oy}px`;
        b.el.style.width = `${r.width}px`;
        b.el.style.height = `${r.height}px`;
        document.body.appendChild(b.el);
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        b.el.style.left = `${p.x - ox}px`;
        b.el.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging) return;
        dragging = false;
        b.el.classList.remove("btp-btn--drag");
        const hole = this.holes.find((h) => {
          const r = h.getBoundingClientRect();
          return (
            p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
          );
        });
        if (
          hole &&
          hole.dataset.color === b.color &&
          !hole.classList.contains("btp-hole--done")
        ) {
          // 扣对
          b.placed = true;
          hole.classList.add("btp-hole--done");
          hole.appendChild(b.el);
          b.el.style.position = "absolute";
          b.el.style.left = "50%";
          b.el.style.top = "50%";
          b.el.style.transform = "translate(-50%,-50%)";
          b.el.style.width = "";
          b.el.style.height = "";
          const r = hole.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
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
          // 放错或没放扣眼：弹回托盘
          b.origin.appendChild(b.el);
          b.el.style.position = "";
          b.el.style.left = "";
          b.el.style.top = "";
          b.el.style.width = "";
          b.el.style.height = "";
          b.el.style.transform = "";
          if (hole) {
            const paused = this.onWrong();
            if (paused) this.showRest();
          }
        }
      },
    });
    this.unbinds.push(u);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🧵",
      variant: "rest",
      body: "看看扣眼的颜色，再把<b>一样颜色</b>的纽扣拖过去～",
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
    if (document.getElementById("btp-style")) return;
    const st = document.createElement("style");
    st.id = "btp-style";
    st.textContent = BTP_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function BTP_CSS(_theme: string): string {
  return `
.btp-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(440px,100%);}
.btp-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.4;}
.btp-cloth{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;padding:24px 18px;width:min(360px,86vw);background:repeating-linear-gradient(45deg,#f5e9d4 0 10px,#ead9b8 10px 20px);border-radius:18px;box-shadow:var(--shadow);min-height:120px;align-items:center;}
.btp-hole{position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;}
.btp-hole__ring{width:48px;height:48px;border-radius:50%;border:3px dashed var(--btp-color,#888);background:rgba(255,255,255,.4);}
.btp-hole--done .btp-hole__ring{opacity:.3;border-style:solid;}
.btp-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:14px 18px;background:rgba(255,255,255,.55);border-radius:18px;min-height:72px;width:100%;max-width:420px;}
.btp-btn{position:relative;width:50px;height:50px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,var(--btp-color,#888));box-shadow:0 3px 5px rgba(0,0,0,.3),inset 0 -3px 4px rgba(0,0,0,.2);cursor:grab;touch-action:none;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;place-items:center;gap:0;}
.btp-btn__dot{width:5px;height:5px;border-radius:50%;background:rgba(0,0,0,.35);}
.btp-btn--drag{cursor:grabbing;transform:scale(1.2);z-index:100;filter:drop-shadow(0 6px 6px rgba(0,0,0,.35));}
@media (max-width:380px){.btp-hole,.btp-btn{width:44px;height:44px;}.btp-hole__ring{width:38px;height:38px;}}
`;
}

export function create(): ButtonPressGame {
  return new ButtonPressGame();
}
