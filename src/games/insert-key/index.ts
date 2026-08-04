/* 钥匙开锁 Insert-Key —— 把钥匙拖到锁孔里（要精确对准锁孔）。
   独特点：精细瞄准拖拽。视觉：锁 + 钥匙 + 锁孔靶心。
   巧思：放准锁孔范围内钥匙"咔"地插入并解锁；偏了弹回并提示。难度=轮数。前缀 iky-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

const KEYS = ["🗝️", "🔑"];

export class InsertKeyGame extends BaseGame {
  constructor() {
    super("insert-key");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbind: (() => void) | null = null;
  private hole: HTMLDivElement | null = null;
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

  private startRound(): void {
    this.done = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const keyEmoji = sample(KEYS);

    const wrap = document.createElement("div");
    wrap.className = "iky-wrap";
    const task = document.createElement("div");
    task.className = "iky-task";
    task.innerHTML = `把钥匙<b>对准</b>锁孔放进去～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "iky-stage";
    const lock = document.createElement("div");
    lock.className = "iky-lock";
    lock.innerHTML = `<div class="iky-lock__shackle"></div><div class="iky-lock__body">🔒</div>`;
    const hole = document.createElement("div");
    hole.className = "iky-hole";
    hole.id = "iky-hole";
    hole.innerHTML = `<div class="iky-hole__target"></div>`;
    lock.appendChild(hole);
    stage.appendChild(lock);

    const key = document.createElement("div");
    key.className = "iky-key";
    key.textContent = keyEmoji;
    stage.appendChild(key);
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
    this.hole = hole;

    let dragging = false;
    let ox = 0;
    let oy = 0;
    this.unbind = bindPointer(key, {
      down: (p) => {
        if (this.done) return;
        dragging = true;
        const r = key.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        key.classList.add("iky-key--drag");
        key.style.position = "fixed";
        key.style.left = `${p.x - ox}px`;
        key.style.top = `${p.y - oy}px`;
        key.style.width = `${r.width}px`;
        key.style.height = `${r.height}px`;
        document.body.appendChild(key);
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        key.style.left = `${p.x - ox}px`;
        key.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging || this.done || !this.hole) return;
        dragging = false;
        key.classList.remove("iky-key--drag");
        const r = this.hole.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(p.x - cx, p.y - cy);
        // 精确对准：容差随难度收紧
        const tol =
          this.difficulty === "easy"
            ? 60
            : this.difficulty === "medium"
              ? 48
              : 38;
        if (
          dist <= tol &&
          p.x >= r.left - 10 &&
          p.x <= r.right + 10 &&
          p.y >= r.top - 10 &&
          p.y <= r.bottom + 10
        ) {
          this.done = true;
          key.style.position = "absolute";
          key.style.left = "50%";
          key.style.top = "50%";
          key.style.transform = "translate(-50%,-50%) rotate(-8deg)";
          key.style.width = "";
          key.style.height = "";
          this.hole.appendChild(key);
          this.hole.classList.add("iky-hole--done");
          this.onCorrect(cx, cy);
          this.resetWrongStreak();
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 900);
        } else {
          // 弹回原位
          key.parentElement?.removeChild(key);
          stage.appendChild(key);
          key.style.position = "";
          key.style.left = "";
          key.style.top = "";
          key.style.width = "";
          key.style.height = "";
          key.style.transform = "";
          const paused = this.onWrong();
          if (paused) this.showRest();
        }
      },
    });
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "对准一点～",
      emoji: "🔑",
      variant: "rest",
      body: "把钥匙<b>慢慢</b>拖到锁孔正中间，对准了再松手～",
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
    if (document.getElementById("iky-style")) return;
    const st = document.createElement("style");
    st.id = "iky-style";
    st.textContent = IKY_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function IKY_CSS(theme: string): string {
  return `
.iky-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.iky-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.iky-task b{color:${theme};}
.iky-stage{position:relative;width:100%;max-width:380px;height:300px;display:flex;align-items:center;justify-content:space-around;flex-wrap:wrap;gap:20px;}
.iky-lock{position:relative;display:flex;flex-direction:column;align-items:center;}
.iky-lock__shackle{width:50px;height:34px;border:9px solid #9aa0a6;border-bottom:none;border-radius:24px 24px 0 0;}
.iky-lock__body{font-size:4rem;line-height:1;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));}
.iky-hole{position:absolute;left:50%;top:62%;transform:translate(-50%,-50%);width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.iky-hole__target{width:30px;height:30px;border-radius:50%;border:3px dashed #5a5a5a;background:rgba(0,0,0,.15);}
.iky-hole--done .iky-hole__target{border-color:${theme};background:rgba(109,207,127,.4);}
.iky-key{font-size:3.4rem;line-height:1;cursor:grab;touch-action:none;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25));user-select:none;transition:transform .12s;}
.iky-key:active{transform:scale(1.08);}
.iky-key--drag{cursor:grabbing;transform:scale(1.2);z-index:100;filter:drop-shadow(0 6px 8px rgba(0,0,0,.35));}
@keyframes iky-pop{0%{transform:translate(-50%,-50%) scale(.6)}60%{transform:translate(-50%,-50%) scale(1.2)}100%{transform:translate(-50%,-50%) scale(1)}}
.iky-hole--done .iky-key{animation:iky-pop .4s ease;}
@media (max-width:380px){.iky-lock__body{font-size:3.4rem;}.iky-key{font-size:3rem;}.iky-stage{height:260px;}}
`;
}

export function create(): InsertKeyGame {
  return new InsertKeyGame();
}
