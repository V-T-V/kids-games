/* 色彩调配师 —— 玩法：把颜料滴入烧杯，调出目标色。
   巧思：真实颜料混合观感 + 调出后"颜色精灵"跳舞 + 渐进难度目标色库。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { createButton } from "../../ui/Button.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { sample, shuffle, getCssVar } from "../../lobby/util.ts";
import {
  mix,
  toHex,
  fromHex,
  isMatch,
  nameOf,
  PRIMARY_COLORS,
  type Drop,
  type RGB,
} from "./colorMath.ts";

/** 关卡：不同难度的目标色库（都是三原色可调出来的）。 */
const TARGETS: Record<string, string[]> = {
  easy: ["#ff8c1a", "#a040a0", "#2cae4f", "#e85a8a", "#6a5acd"],
  medium: ["#d2691e", "#8b4513", "#2e8b57", "#9966cc", "#cd5c5c", "#4682b4"],
  hard: ["#b8860b", "#778899", "#bc8f8f", "#9370db", "#5f9ea0", "#da70d6"],
};

const INK_NAMES = ["红", "黄", "蓝", "白", "黑"] as const;

export class ColorMixerGame extends BaseGame {
  constructor() {
    super("color-mixer");
  }

  private drops: Drop[] = [];
  private currentHex = "#ffffff";
  private target: RGB = fromHex("#ff8c1a");
  private targetHex = "#ff8c1a";
  private roundsDone = 0;
  private roundTotal = 0;
  private unbind: (() => void) | null = null;
  private beaker!: HTMLDivElement;
  private currentDot!: HTMLDivElement;
  private targetDot!: HTMLDivElement;
  private hint!: HTMLDivElement;
  private restShieldPause = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.root.classList.add("cm-root");
    this.nextTarget();
    this.render();
  }

  protected unmount(): void {
    this.unbind?.();
    this.unbind = null;
  }

  private render(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "cm-wrap";

    /* —— 目标色展示 —— */
    const task = document.createElement("div");
    task.className = "cm-task";
    task.innerHTML = `<div class="cm-task__label">调出这个颜色 👇 <small>（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</small></div>`;
    const targetBox = document.createElement("div");
    targetBox.className = "cm-target";
    this.targetDot = document.createElement("div");
    this.targetDot.className = "cm-target__dot";
    this.targetDot.style.background = this.targetHex;
    targetBox.appendChild(this.targetDot);
    task.appendChild(targetBox);
    wrap.appendChild(task);

    /* —— 烧杯 —— */
    const beakerWrap = document.createElement("div");
    beakerWrap.className = "cm-beaker-wrap";
    this.beaker = document.createElement("div");
    this.beaker.className = "cm-beaker";
    const liquid = document.createElement("div");
    liquid.className = "cm-beaker__liquid";
    liquid.id = "cm-liquid";
    liquid.style.background = this.currentHex;
    this.beaker.appendChild(liquid);
    this.currentDot = document.createElement("div");
    this.currentDot.className = "cm-current-dot";
    this.currentDot.style.background = this.currentHex;
    beakerWrap.appendChild(this.beaker);
    beakerWrap.appendChild(this.currentDot);

    this.hint = document.createElement("div");
    this.hint.className = "cm-hint";
    this.hint.textContent = "点颜料瓶，滴进烧杯～";
    beakerWrap.appendChild(this.hint);
    wrap.appendChild(beakerWrap);

    /* —— 颜料瓶 —— */
    const palette = document.createElement("div");
    palette.className = "cm-palette";
    for (const name of INK_NAMES) {
      const ink = document.createElement("button");
      ink.type = "button";
      ink.className = "cm-ink";
      const col = toHex(PRIMARY_COLORS[name]!);
      ink.style.setProperty("--ink", col);
      ink.innerHTML = `<span class="cm-ink__bottle"></span><span class="cm-ink__name">${name}</span>`;
      ink.addEventListener("click", (e) => this.addDrop(name, e));
      palette.appendChild(ink);
    }
    wrap.appendChild(palette);

    /* —— 操作按钮 —— */
    const actions = document.createElement("div");
    actions.className = "cm-actions";
    actions.appendChild(
      createButton({
        text: "倒掉",
        icon: "🧽",
        variant: "secondary",
        onClick: () => this.resetBeaker(),
      }),
    );
    actions.appendChild(
      createButton({
        text: "我调好啦！",
        icon: "✨",
        variant: "primary",
        onClick: () => this.check(),
      }),
    );
    wrap.appendChild(actions);

    this.root.appendChild(wrap);

    // 注入样式（仅一次）
    if (!document.getElementById("cm-style")) {
      const st = document.createElement("style");
      st.id = "cm-style";
      st.textContent = CM_CSS(getCssVar("--c-pink"));
      document.head.appendChild(st);
    }
  }

  private addDrop(name: string, e: Event): void {
    sfxPop();
    this.drops.push({ color: PRIMARY_COLORS[name]!, amount: 1 });
    this.updateLiquid();
    // 颜料瓶跳动反馈
    const btn = e.currentTarget as HTMLButtonElement;
    btn.classList.remove("cm-ink--pop");
    void btn.offsetWidth;
    btn.classList.add("cm-ink--pop");
  }

  private updateLiquid(): void {
    const mixed = mix(this.drops);
    this.currentHex = toHex(mixed);
    const liquid = this.root.querySelector(
      "#cm-liquid",
    ) as HTMLDivElement | null;
    if (liquid) liquid.style.background = this.currentHex;
    this.currentDot.style.background = this.currentHex;
    // 液面高度随滴数上升（巧思：视觉反馈）
    const h = Math.min(70, 18 + this.drops.length * 5);
    if (liquid) liquid.style.height = `${h}%`;
  }

  private resetBeaker(): void {
    this.drops = [];
    this.currentHex = "#ffffff";
    this.updateLiquid();
    this.hint.textContent = "烧杯空啦，再来～";
  }

  private nextTarget(): void {
    const pool = TARGETS[this.difficulty] ?? TARGETS.easy!;
    this.targetHex = sample(shuffle(pool));
    this.target = fromHex(this.targetHex);
  }

  private check(): void {
    if (this.drops.length === 0) {
      this.hint.textContent = "先滴点颜料吧～";
      return;
    }
    if (isMatch(fromHex(this.currentHex), this.target)) {
      this.roundsDone += 1;
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      const colorName = nameOf(fromHex(this.currentHex));
      this.hint.textContent = `太棒了！你调出了${colorName}！🌟`;
      // 成就：调出 5 种目标色
      if (this.roundsDone >= this.roundTotal) {
        this.unlock("color-artist");
      }
      // 连续答对清零护盾计数
      this.resetWrongStreak();
      // 短暂展示后进入下一题；roundTotal 题后通关
      const reached = this.roundsDone >= this.roundTotal;
      this.trackTimeout(() => {
        if (reached) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.resetBeaker();
          this.nextTarget();
          this.render();
        }
      }, 1400);
    } else {
      this.hint.textContent = `现在是${nameOf(fromHex(this.currentHex))}，再试试～`;
      const paused = this.onWrong();
      if (paused) {
        this.showRest();
      }
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "玩得真好！让小眼睛休息一会儿吧～",
      primary: { text: "继续玩", icon: "🎈", onClick: () => ov.destroy() },
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

  protected override afterClear(): void {
    /* first-clear / all-clear 由 App 层统一处理 */
  }
}

/** 动态注入的 CSS（带主题色）。 */
function CM_CSS(theme: string): string {
  return `
.cm-root { width:100%; }
.cm-wrap {
  display:flex; flex-direction:column; align-items:center; gap:20px;
  width:min(480px,100%); padding:8px;
}
.cm-task { text-align:center; }
.cm-task__label { font-size:1.2rem; font-weight:800; margin-bottom:10px; }
.cm-target__dot {
  width:80px; height:80px; border-radius:50%;
  box-shadow:0 8px 20px rgba(0,0,0,.2), inset -6px -6px 0 rgba(0,0,0,.1);
  margin:0 auto; border:4px solid #fff;
}
.cm-beaker-wrap { display:flex; flex-direction:column; align-items:center; gap:10px; }
.cm-beaker {
  width:130px; height:170px; border:6px solid ${theme};
  border-top:none; border-radius:0 0 30px 30px;
  position:relative; overflow:hidden; background:rgba(255,255,255,.5);
}
.cm-beaker__liquid {
  position:absolute; bottom:0; left:0; right:0; height:18%;
  transition:height .3s ease, background .3s ease;
  background:#fff;
}
.cm-beaker__liquid::after {
  content:''; position:absolute; top:-4px; left:0; right:0; height:8px;
  background:inherit; border-radius:50%; opacity:.7;
}
.cm-current-dot {
  width:28px; height:28px; border-radius:50%; border:3px solid #fff;
  box-shadow:var(--shadow);
}
.cm-hint { font-size:1.1rem; font-weight:700; color:var(--ink-soft); min-height:1.6em; text-align:center; }
.cm-palette { display:flex; gap:14px; flex-wrap:wrap; justify-content:center; }
.cm-ink {
  display:flex; flex-direction:column; align-items:center; gap:4px;
}
.cm-ink__bottle {
  width:48px; height:64px; border-radius:18px 18px 24px 24px;
  background:linear-gradient(160deg, var(--ink), color-mix(in srgb, var(--ink) 70%, #000));
  box-shadow:inset -4px -4px 0 rgba(0,0,0,.15), var(--shadow);
  position:relative; display:block;
}
.cm-ink__bottle::before {
  content:''; position:absolute; top:-8px; left:50%; transform:translateX(-50%);
  width:18px; height:12px; background:var(--ink); border-radius:6px 6px 0 0;
}
.cm-ink__name { font-size:0.95rem; font-weight:700; }
.cm-ink--pop { animation:cm-pop .3s ease; }
@keyframes cm-pop { 0%{transform:scale(1)} 40%{transform:scale(1.15) translateY(-6px)} 100%{transform:scale(1)} }
.cm-actions { display:flex; gap:14px; flex-wrap:wrap; justify-content:center; }
@media (max-width:380px){ .cm-ink__bottle{width:40px;height:54px;} .cm-palette{gap:8px;} }
`;
}

export function create(): ColorMixerGame {
  return new ColorMixerGame();
}
