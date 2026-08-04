/* 红绿灯 Traffic Light —— 屏幕显示一个红/黄/绿灯，问"现在能过马路吗？"，
   孩子点"能"或"不能"。红灯和黄灯点不能，绿灯点能。10 轮随机。
   生活安全启蒙：3-5 岁，认识红绿灯过马路规则。前缀 tlg-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface Light {
  color: "red" | "yellow" | "green";
  emoji: string;
  name: string;
  /** 这个灯亮时，能不能过马路（正确答案） */
  canCross: boolean;
  /** 给孩子看的提示话 */
  hint: string;
}

const LIGHTS: Light[] = [
  {
    color: "red",
    emoji: "🔴",
    name: "红灯",
    canCross: false,
    hint: "红灯亮啦，要停下来等一等",
  },
  {
    color: "yellow",
    emoji: "🟡",
    name: "黄灯",
    canCross: false,
    hint: "黄灯亮啦，马上要变灯，别急着走",
  },
  {
    color: "green",
    emoji: "🟢",
    name: "绿灯",
    canCross: true,
    hint: "绿灯亮啦，可以走啦",
  },
];

export class TrafficLightGame extends BaseGame {
  constructor() {
    super("traffic-light");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 6 : this.difficulty === "medium" ? 8 : 10;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const light = sample(LIGHTS);

    const wrap = document.createElement("div");
    wrap.className = "tlg-wrap";

    const task = document.createElement("div");
    task.className = "tlg-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 现在亮的是<b>${light.name}</b>，能过马路吗？`;
    wrap.appendChild(task);

    // 红绿灯柱
    const pole = document.createElement("div");
    pole.className = "tlg-pole";
    const lightsRow = document.createElement("div");
    lightsRow.className = "tlg-lights";
    LIGHTS.forEach((l) => {
      const cell = document.createElement("div");
      cell.className = "tlg-light";
      cell.textContent = l.emoji;
      if (l.color === light.color) cell.classList.add("tlg-light--on");
      lightsRow.appendChild(cell);
    });
    pole.appendChild(lightsRow);
    wrap.appendChild(pole);

    const ask = document.createElement("div");
    ask.className = "tlg-ask";
    ask.textContent = "现在能过马路吗？";
    wrap.appendChild(ask);

    const opts = document.createElement("div");
    opts.className = "tlg-opts";
    const makeBtn = (label: string, value: boolean, icon: string): void => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tlg-opt";
      b.innerHTML = `<div class="tlg-opt__icon">${icon}</div><div class="tlg-opt__name">${label}</div>`;
      b.addEventListener("click", () => this.choose(value, light.canCross, b));
      opts.appendChild(b);
    };
    makeBtn("能", true, "✅");
    makeBtn("不能", false, "🛑");
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(
    picked: boolean,
    answer: boolean,
    btn: HTMLButtonElement,
  ): void {
    if (this.locked) return;
    if (picked === answer) {
      this.locked = true;
      sfxPop();
      btn.classList.add("tlg-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 900);
    } else {
      btn.classList.add("tlg-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("tlg-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "🚦",
      variant: "rest",
      body: "红灯停，绿灯行，黄灯亮了等一等～看看哪个灯亮着呢？",
      primary: { text: "继续", icon: "😊", onClick: () => ov.destroy() },
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
    if (document.getElementById("tlg-style")) return;
    const st = document.createElement("style");
    st.id = "tlg-style";
    st.textContent = TL_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function TL_CSS(theme: string): string {
  return `
.tlg-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(420px,100%);}
.tlg-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.tlg-task b{color:${theme};}
.tlg-pole{background:#333;border-radius:24px;padding:18px;box-shadow:var(--shadow);}
.tlg-lights{display:flex;flex-direction:column;gap:12px;}
.tlg-light{width:84px;height:84px;border-radius:50%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:2.6rem;opacity:.25;filter:grayscale(.6);transition:all .2s;}
.tlg-light--on{opacity:1;filter:none;box-shadow:0 0 24px currentColor;}
.tlg-ask{font-size:1.25rem;font-weight:900;color:#444;text-align:center;}
.tlg-opts{display:flex;gap:20px;}
.tlg-opt{display:flex;flex-direction:column;align-items:center;gap:8px;background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:18px 28px;cursor:pointer;transition:transform .12s;min-width:120px;min-height:110px;justify-content:center;}
.tlg-opt:active{transform:scale(.95);}
.tlg-opt__icon{font-size:2.6rem;line-height:1;}
.tlg-opt__name{font-size:1.3rem;font-weight:900;color:#444;}
.tlg-opt--done{background:#d4f4dd;outline:4px solid #34c759;animation:tlg-pop .4s ease;}
.tlg-opt--wrong{background:#ffe0e0;animation:tlg-shake .4s ease;}
@keyframes tlg-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes tlg-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): TrafficLightGame {
  return new TrafficLightGame();
}
