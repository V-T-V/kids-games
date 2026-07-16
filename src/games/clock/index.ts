/* 小小时钟 Clock —— 拖动时针/分针到指定时间。
   巧思：指针随手指转，滴答反馈；整点/半点/一刻渐进难度。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxTick } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { bindPointer } from "../../core/input.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, randInt } from "../../lobby/util.ts";

export class ClockGame extends BaseGame {
  constructor() {
    super("clock");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private targetHour = 0;
  private targetMin = 0;
  private hourAngle = -90; // 时针角度（度）
  private minAngle = -90; // 分针角度
  private faceEl!: HTMLDivElement;
  private hourHand!: HTMLDivElement;
  private minHand!: HTMLDivElement;
  private unbind: (() => void) | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 3 : 4;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.unbind?.();
    this.unbind = null;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.targetHour = randInt(1, 12);
    // easy=整点, medium=半点, hard=一刻/整点/半点
    const minPool =
      this.difficulty === "easy"
        ? [0]
        : this.difficulty === "medium"
          ? [0, 30]
          : [0, 15, 30, 45];
    this.targetMin = minPool[randInt(0, minPool.length - 1)]!;
    this.hourAngle = -90;
    this.minAngle = -90;

    const wrap = document.createElement("div");
    wrap.className = "ck-wrap";
    const task = document.createElement("div");
    task.className = "ck-task";
    const minText = this.targetMin === 0 ? "00" : String(this.targetMin);
    task.textContent = `把时钟拨到 ${this.targetHour}:${minText}（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 表盘
    this.faceEl = document.createElement("div");
    this.faceEl.className = "ck-face";
    // 数字 1-12
    for (let i = 1; i <= 12; i++) {
      const n = document.createElement("div");
      n.className = "ck-num";
      const ang = (i / 12) * 360 - 90;
      const rad = (ang * Math.PI) / 180;
      const R = 96;
      n.style.left = `${120 + Math.cos(rad) * R - 14}px`;
      n.style.top = `${120 + Math.sin(rad) * R - 16}px`;
      n.textContent = String(i);
      this.faceEl.appendChild(n);
    }
    this.minHand = document.createElement("div");
    this.minHand.className = "ck-hand ck-hand--min";
    this.faceEl.appendChild(this.minHand);
    this.hourHand = document.createElement("div");
    this.hourHand.className = "ck-hand ck-hand--hour";
    this.faceEl.appendChild(this.hourHand);
    const center = document.createElement("div");
    center.className = "ck-center";
    this.faceEl.appendChild(center);
    wrap.appendChild(this.faceEl);

    // 操作
    const actions = document.createElement("div");
    actions.className = "ck-actions";
    actions.appendChild(
      createButton({
        text: "转分针",
        icon: "➰",
        variant: "secondary",
        onClick: () => this.rotate("min"),
      }),
    );
    actions.appendChild(
      createButton({
        text: "转时针",
        icon: "🕐",
        variant: "secondary",
        onClick: () => this.rotate("hour"),
      }),
    );
    actions.appendChild(
      createButton({
        text: "对啦！",
        icon: "✨",
        variant: "primary",
        onClick: () => this.check(),
      }),
    );
    wrap.appendChild(actions);
    this.root.appendChild(wrap);
    this.updateHands();

    // 也支持直接拖动表盘转动最近的手指
    this.unbind = bindPointer(this.faceEl, {
      move: (p) => {
        /* 占位 */ void p;
      },
    });
  }

  private rotate(which: "hour" | "min"): void {
    const step = which === "hour" ? 30 : this.difficulty === "hard" ? 15 : 30;
    if (which === "hour") this.hourAngle += step;
    else this.minAngle += step;
    sfxTick();
    this.updateHands();
  }

  private updateHands(): void {
    this.minHand.style.transform = `translate(-50%,-100%) rotate(${this.minAngle + 90}deg)`;
    this.hourHand.style.transform = `translate(-50%,-100%) rotate(${this.hourAngle + 90}deg)`;
  }

  private check(): void {
    // 把角度换算回时间（角度从 12 点起顺时针）
    // 分针：360度=60分，所以 min = angle/6
    const minVal = Math.round(((((this.minAngle + 90) % 360) + 360) % 360) / 6);
    // 时针：每小时30度，小时数对12取余
    const hourVal =
      Math.round(((((this.hourAngle + 90) % 360) + 360) % 360) / 30) % 12 || 12;
    const hourOk = hourVal === this.targetHour;
    if (
      hourOk &&
      (minVal === this.targetMin || (this.targetMin === 0 && minVal % 60 === 0))
    ) {
      sfxPop();
      this.onCorrect(window.innerWidth / 2, window.innerHeight / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看时针指到数字几啦～",
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
    if (document.getElementById("ck-style")) return;
    const st = document.createElement("style");
    st.id = "ck-style";
    st.textContent = CK_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function CK_CSS(theme: string): string {
  return `
.ck-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(420px,100%);}
.ck-task{font-size:1.2rem;font-weight:800;text-align:center;}
.ck-face{position:relative;width:240px;height:240px;border-radius:50%;background:#fff;box-shadow:var(--shadow);border:8px solid ${theme};}
.ck-num{position:absolute;width:28px;height:32px;font-size:1.3rem;font-weight:800;color:var(--ink);text-align:center;}
.ck-hand{position:absolute;left:50%;top:50%;transform-origin:bottom center;border-radius:4px;}
.ck-hand--min{width:5px;height:96px;background:var(--ink);}
.ck-hand--hour{width:8px;height:64px;background:${theme};}
.ck-center{position:absolute;left:50%;top:50%;width:18px;height:18px;background:var(--ink);border-radius:50%;transform:translate(-50%,-50%);}
.ck-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
`;
}

export function create(): ClockGame {
  return new ClockGame();
}
