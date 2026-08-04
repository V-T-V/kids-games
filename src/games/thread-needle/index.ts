/* 穿针引线 Thread-Needle —— 把线头拖过针眼（拖到针眼目标区）。
   独特点：精细瞄准 + 穿越动作。视觉：针 + 线 + 针眼靶。
   巧思：线头进入针眼范围内即"穿过去"；偏了弹回并提示。难度=轮数。前缀 thr2-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

const COLORS = ["#ff6b9d", "#4d96ff", "#6bcf7f", "#ff9f43", "#a55eea"];

export class ThreadNeedleGame extends BaseGame {
  constructor() {
    super("thread-needle");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private unbind: (() => void) | null = null;
  private eye: HTMLDivElement | null = null;
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
    const color = sample(COLORS);

    const wrap = document.createElement("div");
    wrap.className = "thr2-wrap";
    const task = document.createElement("div");
    task.className = "thr2-task";
    task.innerHTML = `把线头<b>拖过</b>针眼～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "thr2-stage";

    const needle = document.createElement("div");
    needle.className = "thr2-needle";
    needle.innerHTML = `<div class="thr2-eye"><div class="thr2-eye__target"></div></div><div class="thr2-tip"></div>`;
    stage.appendChild(needle);

    const thread = document.createElement("div");
    thread.className = "thr2-thread";
    thread.innerHTML = `<div class="thr2-thread__tail" style="background:${color}"></div><div class="thr2-thread__head" style="background:${color}"></div>`;
    stage.appendChild(thread);
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
    this.eye = needle.querySelector(".thr2-eye");

    const head = thread.querySelector<HTMLElement>(".thr2-thread__head")!;
    let dragging = false;
    let ox = 0;
    let oy = 0;
    this.unbind = bindPointer(head, {
      down: (p) => {
        if (this.done) return;
        dragging = true;
        const r = head.getBoundingClientRect();
        ox = p.x - r.left;
        oy = p.y - r.top;
        head.classList.add("thr2-thread__head--drag");
        document.body.appendChild(head);
        head.style.position = "fixed";
        head.style.left = `${p.x - ox}px`;
        head.style.top = `${p.y - oy}px`;
        head.style.width = `${r.width}px`;
        head.style.height = `${r.height}px`;
        sfxPop();
      },
      move: (p) => {
        if (!dragging) return;
        head.style.left = `${p.x - ox}px`;
        head.style.top = `${p.y - oy}px`;
      },
      up: (p) => {
        if (!dragging || this.done || !this.eye) return;
        dragging = false;
        head.classList.remove("thr2-thread__head--drag");
        const r = this.eye.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(p.x - cx, p.y - cy);
        const tol =
          this.difficulty === "easy"
            ? 55
            : this.difficulty === "medium"
              ? 45
              : 36;
        if (dist <= tol) {
          this.done = true;
          this.eye.classList.add("thr2-eye--done");
          // 把线头放到针眼里
          this.eye.appendChild(head);
          head.style.position = "absolute";
          head.style.left = "50%";
          head.style.top = "50%";
          head.style.transform = "translate(-50%,-50%)";
          head.style.width = "";
          head.style.height = "";
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
          // 弹回
          thread.insertBefore(head, thread.firstChild);
          head.style.position = "";
          head.style.left = "";
          head.style.top = "";
          head.style.width = "";
          head.style.height = "";
          head.style.transform = "";
          const paused = this.onWrong();
          if (paused) this.showRest();
        }
      },
    });
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "对准针眼～",
      emoji: "🪡",
      variant: "rest",
      body: "把线头<b>慢慢</b>拖到针眼正中间，穿过去就成功啦～",
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
    if (document.getElementById("thr2-style")) return;
    const st = document.createElement("style");
    st.id = "thr2-style";
    st.textContent = THR2_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function THR2_CSS(theme: string): string {
  return `
.thr2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.thr2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.thr2-task b{color:${theme};}
.thr2-stage{position:relative;width:100%;max-width:380px;height:320px;display:flex;align-items:center;justify-content:space-around;gap:30px;flex-wrap:wrap;}
.thr2-needle{position:relative;width:160px;height:200px;display:flex;flex-direction:column;align-items:center;}
.thr2-eye{position:relative;width:46px;height:34px;border:6px solid #9aa0a6;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;}
.thr2-eye__target{width:14px;height:14px;border-radius:50%;border:3px dashed #b0b0b0;background:rgba(0,0,0,.06);}
.thr2-eye--done{border-color:${theme};}
.thr2-tip{width:6px;height:120px;background:linear-gradient(180deg,#9aa0a6,#cfd3d6);border-radius:0 0 3px 3px;position:relative;}
.thr2-tip::after{content:"";position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);border-left:8px solid transparent;border-right:8px solid transparent;border-top:14px solid #9aa0a6;}
.thr2-thread{display:flex;flex-direction:column;align-items:center;gap:2px;}
.thr2-thread__tail{width:6px;height:120px;border-radius:3px;opacity:.85;}
.thr2-thread__head{width:22px;height:22px;border-radius:50%;cursor:grab;touch-action:none;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));user-select:none;transition:transform .12s;}
.thr2-thread__head:active{transform:scale(1.1);}
.thr2-thread__head--drag{cursor:grabbing;transform:scale(1.3);z-index:100;filter:drop-shadow(0 6px 8px rgba(0,0,0,.35));}
@keyframes thr2-pop{0%{transform:translate(-50%,-50%) scale(.5)}60%{transform:translate(-50%,-50%) scale(1.3)}100%{transform:translate(-50%,-50%) scale(1)}}
.thr2-eye--done .thr2-thread__head{animation:thr2-pop .4s ease;}
@media (max-width:380px){.thr2-needle{width:140px;}.thr2-tip{height:100px;}.thr2-thread__tail{height:100px;}.thr2-stage{height:280px;}}
`;
}

export function create(): ThreadNeedleGame {
  return new ThreadNeedleGame();
}
