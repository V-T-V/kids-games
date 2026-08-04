/* 拉拉链 Zipper Pull —— 把拉链头从底部拖到顶部，拉链随之合拢。
   独特点：单向拖拽 + 视觉连续反馈（拉链齿逐个咬合）。沙盒类，完成即通关。
   视觉：竖向拉链（左右两排齿）+ 拉链头（slider）。bindPointer 拖拽。
   巧思：拉链头只能向上拖（往下拖无效，避免来回拉空）；到达顶部 finishClear(3)。
   前缀 zpl-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { bindPointer } from "../../core/input.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

export class ZipperPullGame extends BaseGame {
  constructor() {
    super("zipper-pull");
  }
  private unbind = (): void => {};
  private slider!: HTMLDivElement;
  private track!: HTMLDivElement;
  private filled!: HTMLDivElement;
  /** 拉链头当前进度 0..1（0=底部，1=顶部）。 */
  private t = 0;
  private done = false;

  protected mount(): void {
    this.injectStyle();
    this.startScene();
  }
  protected unmount(): void {
    this.unbind();
    this.unbind = () => {};
  }

  private startScene(): void {
    this.root.innerHTML = "";
    this.unbind();
    this.t = 0;
    this.done = false;

    const wrap = document.createElement("div");
    wrap.className = "zpl-wrap";
    const task = document.createElement("div");
    task.className = "zpl-task";
    task.textContent = "捏住拉链头，从下往上拉到顶部～";
    const helpBtn = document.createElement("button");
    helpBtn.type = "button";
    helpBtn.className = "zpl-help";
    helpBtn.textContent = "❓";
    helpBtn.setAttribute("aria-label", "怎么玩");
    helpBtn.addEventListener("click", () => this.showRest());
    const head = document.createElement("div");
    head.className = "zpl-head";
    head.appendChild(task);
    head.appendChild(helpBtn);
    wrap.appendChild(head);

    const scene = document.createElement("div");
    scene.className = "zpl-scene";

    this.track = document.createElement("div");
    this.track.className = "zpl-track";

    // 左右两排齿
    const leftTeeth = document.createElement("div");
    leftTeeth.className = "zpl-teeth zpl-teeth--left";
    const rightTeeth = document.createElement("div");
    rightTeeth.className = "zpl-teeth zpl-teeth--right";
    const teethCount = 14;
    for (let i = 0; i < teethCount; i++) {
      const lt = document.createElement("div");
      lt.className = "zpl-tooth";
      leftTeeth.appendChild(lt);
      const rt = document.createElement("div");
      rt.className = "zpl-tooth";
      rightTeeth.appendChild(rt);
    }
    // 已合拢部分高亮
    this.filled = document.createElement("div");
    this.filled.className = "zpl-filled";

    this.slider = document.createElement("div");
    this.slider.className = "zpl-slider";
    this.slider.innerHTML = `<div class="zpl-slider__body">🔒</div><div class="zpl-slider__tab"></div>`;

    this.track.appendChild(leftTeeth);
    this.track.appendChild(rightTeeth);
    this.track.appendChild(this.filled);
    this.track.appendChild(this.slider);
    scene.appendChild(this.track);

    // 顶部目标标记
    const top = document.createElement("div");
    top.className = "zpl-target";
    top.textContent = "🎯 到这里";
    scene.appendChild(top);

    wrap.appendChild(scene);
    this.root.appendChild(wrap);

    this.place();
    this.unbind = bindPointer(this.slider, {
      down: (p) => this.onDown(p),
      move: (p) => this.onMove(p),
      up: () => this.onUp(),
    });
  }

  private place(): void {
    const r = this.track.getBoundingClientRect();
    const h = r.height;
    const sliderH = 36;
    // t=0 在底部，t=1 在顶部
    const top = (1 - this.t) * (h - sliderH);
    this.slider.style.top = `${top}px`;
    this.filled.style.height = `${h - top}px`;
    this.filled.style.top = `${top}px`;
  }

  private onDown(p: { x: number; y: number }): void {
    void p;
    sfxPop();
  }

  private onMove(p: { x: number; y: number }): void {
    if (this.done) return;
    const r = this.track.getBoundingClientRect();
    const sliderH = 36;
    // 指针相对 track 的 y
    const localY = p.y - r.top - sliderH / 2;
    const usable = r.height - sliderH;
    // t = 1 - localY/usable（向上拖 t 增大）
    let nt = 1 - localY / usable;
    nt = Math.max(this.t, Math.min(1, nt)); // 只能向上
    if (nt > this.t) {
      this.t = nt;
      sfxPop();
      this.place();
      if (this.t >= 0.98) {
        this.done = true;
        const sr = this.slider.getBoundingClientRect();
        this.onCorrect(sr.left + sr.width / 2, sr.top + sr.height / 2);
        this.resetWrongStreak();
        this.trackTimeout(() => this.finishClear(3), 500);
      }
    }
  }

  private onUp(): void {
    /* 松手不回弹 */
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "怎么拉？",
      emoji: "🧥",
      variant: "rest",
      body: "捏住拉链头，<b>向上</b>拖到顶部的🎯～",
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
    if (document.getElementById("zpl-style")) return;
    const st = document.createElement("style");
    st.id = "zpl-style";
    st.textContent = ZPL_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function ZPL_CSS(theme: string): string {
  return `
.zpl-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.zpl-head{display:flex;align-items:center;gap:10px;width:100%;justify-content:center;}
.zpl-task{font-size:1.1rem;font-weight:800;text-align:center;flex:1;}
.zpl-help{flex:none;width:38px;height:38px;border-radius:50%;border:none;background:#fff;font-size:1.2rem;box-shadow:var(--shadow);cursor:pointer;}
.zpl-scene{position:relative;width:160px;height:min(420px,60vh);display:flex;justify-content:center;}
.zpl-track{position:relative;width:90px;height:100%;background:linear-gradient(180deg,#e8e8ee,#d4d4dd);border-radius:14px;box-shadow:var(--shadow);touch-action:none;overflow:hidden;}
.zpl-teeth{position:absolute;top:8px;bottom:8px;display:flex;flex-direction:column;justify-content:space-between;width:18px;}
.zpl-teeth--left{left:8px;align-items:flex-start;}
.zpl-teeth--right{right:8px;align-items:flex-end;}
.zpl-tooth{width:16px;height:8px;background:${theme};border-radius:3px;opacity:.85;}
.zpl-teeth--left .zpl-tooth{transform:rotate(20deg);}
.zpl-teeth--right .zpl-tooth{transform:rotate(-20deg);}
.zpl-filled{position:absolute;left:8px;right:8px;background:linear-gradient(180deg,${theme},${theme}cc);opacity:0;transition:none;}
.zpl-slider{position:absolute;left:50%;transform:translateX(-50%);width:44px;height:36px;z-index:5;cursor:grab;touch-action:none;display:flex;flex-direction:column;align-items:center;}
.zpl-slider:active{cursor:grabbing;}
.zpl-slider__body{width:34px;height:26px;background:linear-gradient(180deg,#9aa,#667);border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:1rem;}
.zpl-slider__tab{width:14px;height:10px;background:#556;border-radius:0 0 6px 6px;}
.zpl-target{position:absolute;top:-6px;left:50%;transform:translateX(-50%);background:#fff;padding:3px 10px;border-radius:999px;font-size:.8rem;font-weight:800;color:${theme};box-shadow:var(--shadow);white-space:nowrap;}
`;
}

export function create(): ZipperPullGame {
  return new ZipperPullGame();
}
