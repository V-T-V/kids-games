/* 扣衬衫 Button-Shirt —— 把纽扣拖到对应位置的扣眼里，把衬衫扣好。
   独特点：竖向一排扣眼 + 同色纽扣配对，精细拖拽嵌入。
   巧思：纽扣放对同色扣眼会"扣上"并嵌入；放错弹回。难度=扣子数。前缀 btn-。 */

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
}

const COLORS = [
  { hex: "#ff6b9d", name: "粉" },
  { hex: "#4d96ff", name: "蓝" },
  { hex: "#6bcf7f", name: "绿" },
  { hex: "#ffd93d", name: "黄" },
  { hex: "#a55eea", name: "紫" },
];

export class ButtonShirtGame extends BaseGame {
  constructor() {
    super("button-shirt");
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
    wrap.className = "btn-wrap";
    const task = document.createElement("div");
    task.className = "btn-task";
    task.innerHTML = `把纽扣拖到<b>同色</b>扣眼扣好衬衫～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 衬衫（竖排扣眼）
    const shirt = document.createElement("div");
    shirt.className = "btn-shirt";
    picked.forEach((c) => {
      const hole = document.createElement("div");
      hole.className = "btn-hole";
      hole.style.setProperty("--btn-color", c.hex);
      hole.dataset.color = c.hex;
      hole.innerHTML = `<div class="btn-hole__ring"></div>`;
      shirt.appendChild(hole);
      this.holes.push(hole);
    });
    wrap.appendChild(shirt);

    // 纽扣托盘
    const tray = document.createElement("div");
    tray.className = "btn-tray";
    const shuffled = shuffle(picked);
    shuffled.forEach((c) => {
      const el = document.createElement("div");
      el.className = "btn-btn";
      el.style.setProperty("--btn-color", c.hex);
      el.innerHTML = `<div class="btn-btn__dot"></div><div class="btn-btn__dot"></div>`;
      tray.appendChild(el);
      this.buttons.push({ color: c.hex, el, placed: false });
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
        b.el.classList.add("btn-btn--drag");
        document.body.appendChild(b.el);
        b.el.style.position = "fixed";
        b.el.style.left = `${p.x - ox}px`;
        b.el.style.top = `${p.y - oy}px`;
        b.el.style.width = `${r.width}px`;
        b.el.style.height = `${r.height}px`;
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        b.el.style.left = `${p.x - ox}px`;
        b.el.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging || b.placed) return;
        dragging = false;
        b.el.classList.remove("btn-btn--drag");
        const hole = this.holes.find((h) => {
          const r = h.getBoundingClientRect();
          return (
            p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
          );
        });
        if (
          hole &&
          hole.dataset.color === b.color &&
          !hole.classList.contains("btn-hole--done")
        ) {
          b.placed = true;
          hole.classList.add("btn-hole--done");
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
          b.el.parentElement?.removeChild(b.el);
          this.root.querySelector(".btn-tray")?.appendChild(b.el);
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
      title: "想一想～",
      emoji: "👔",
      variant: "rest",
      body: "看看扣眼的颜色，把<b>同色</b>的纽扣拖过去扣好～",
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
    if (document.getElementById("btn-style")) return;
    const st = document.createElement("style");
    st.id = "btn-style";
    st.textContent = BTN_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function BTN_CSS(theme: string): string {
  return `
.btn-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.btn-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.btn-task b{color:${theme};}
.btn-shirt{display:flex;flex-direction:column;gap:14px;align-items:center;padding:24px 30px;width:min(220px,70vw);background:repeating-linear-gradient(45deg,#dbeafe 0 10px,#cfe4fd 10px 20px);border-radius:22px;box-shadow:var(--shadow);}
.btn-hole{position:relative;width:50px;height:50px;display:flex;align-items:center;justify-content:center;}
.btn-hole__ring{width:42px;height:42px;border-radius:50%;border:3px dashed var(--btn-color,#888);background:rgba(255,255,255,.5);}
.btn-hole--done .btn-hole__ring{opacity:.3;border-style:solid;}
.btn-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:14px 18px;background:rgba(255,255,255,.6);border-radius:18px;min-height:70px;width:100%;max-width:420px;}
.btn-btn{position:relative;width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8,var(--btn-color,#888));box-shadow:0 3px 5px rgba(0,0,0,.3),inset 0 -3px 4px rgba(0,0,0,.2);cursor:grab;touch-action:none;display:grid;grid-template-columns:1fr 1fr;place-items:center;user-select:none;}
.btn-btn__dot{width:5px;height:5px;border-radius:50%;background:rgba(0,0,0,.35);}
.btn-btn:active{transform:scale(1.05);}
.btn-btn--drag{cursor:grabbing;transform:scale(1.25);z-index:100;filter:drop-shadow(0 6px 6px rgba(0,0,0,.35));}
@keyframes btn-pop{0%{transform:translate(-50%,-50%) scale(.5)}60%{transform:translate(-50%,-50%) scale(1.25)}100%{transform:translate(-50%,-50%) scale(1)}}
.btn-hole--done .btn-btn{animation:btn-pop .35s ease;}
@media (max-width:380px){.btn-hole,.btn-btn{width:42px;height:42px;}.btn-hole__ring{width:36px;height:36px;}}
`;
}

export function create(): ButtonShirtGame {
  return new ButtonShirtGame();
}
