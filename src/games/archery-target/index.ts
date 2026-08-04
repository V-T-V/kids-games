/* 射箭环数 Archery Target —— 一张同心圆靶（标 10/8/6/4 环），题目喊
   "射中 8 环"，孩子点击对应环。独特点：靶子做四色同心圆，每个环上写
   大号环数，点对了飞来一支箭钉中该环并冒星星。难度=要求精度（环数越小
   环越靠外更好认）。通关=射对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample } from "../../lobby/util.ts";

interface Ring {
  score: number; // 环数 10/8/6/4
  color: string;
}

const RINGS: Ring[] = [
  { score: 4, color: "#ffffff" }, // 最外白
  { score: 6, color: "#1f2937" }, // 黑
  { score: 8, color: "#4d96ff" }, // 蓝
  { score: 10, color: "#ff6348" }, // 红心
];

export class ArcheryTargetGame extends BaseGame {
  constructor() {
    super("archery-target");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private targetScore = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由基类清空；定时器由基类清理 */
  }

  /** 不同难度可要求的目标环数（保证有解：四个环都在靶上）。 */
  private pickTarget(): number {
    const easy: number[] = [4, 6, 8];
    const med: number[] = [6, 8, 10];
    const hard: number[] = [8, 10, 4];
    const pool =
      this.difficulty === "easy"
        ? easy
        : this.difficulty === "medium"
          ? med
          : hard;
    return sample(pool);
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.targetScore = this.pickTarget();

    const wrap = document.createElement("div");
    wrap.className = "arc-wrap";

    const task = document.createElement("div");
    task.className = "arc-task";
    task.innerHTML = `射中 <b>${this.targetScore}</b> 环！（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "arc-stage";

    // 同心圆靶：从外到内依次绘制更大的圆作底，内环覆盖在上
    const target = document.createElement("div");
    target.className = "arc-target";
    // 从最外到最内放环（外环最先放，被内环盖住，所以外环更大）
    for (let i = 0; i < RINGS.length; i++) {
      const ring = RINGS[i]!;
      const size = 320 - i * 64; // 320 / 256 / 192 / 128
      const el = document.createElement("button");
      el.type = "button";
      el.className = "arc-ring";
      el.style.setProperty("--ring-color", ring.color);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.setAttribute("aria-label", `${ring.score}环`);
      // 仅最内层环可点（其它层被覆盖），通过 z-index 与命中判定实现：
      // 这里每个环都绑定点击，由于内环在上覆盖外环，点击会命中最上层可见环。
      el.addEventListener("click", (ev) => {
        this.shoot(ring.score, ev, target);
      });
      const lbl = document.createElement("span");
      lbl.className = "arc-ring__lbl";
      lbl.textContent = String(ring.score);
      el.appendChild(lbl);
      target.appendChild(el);
    }
    stage.appendChild(target);

    const bow = document.createElement("div");
    bow.className = "arc-bow";
    bow.textContent = "🏹";
    stage.appendChild(bow);

    wrap.appendChild(stage);
    this.root.appendChild(wrap);
  }

  private shoot(score: number, ev: MouseEvent, target: HTMLDivElement): void {
    // 命中点坐标（相对靶）
    const r = target.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    // 已有箭则不再点（本轮只射一箭）
    if (target.querySelector(".arc-arrow")) return;
    // 插一支箭
    const arrow = document.createElement("div");
    arrow.className = "arc-arrow";
    arrow.style.left = `${x}px`;
    arrow.style.top = `${y}px`;
    target.appendChild(arrow);

    if (score === this.targetScore) {
      sfxPop();
      arrow.classList.add("arc-arrow--hit");
      this.onCorrect(ev.clientX, ev.clientY);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      arrow.classList.add("arc-arrow--miss");
      const paused = this.onWrong();
      // 短暂提示后重开本关（拔箭重来），保证可通关
      this.trackTimeout(() => this.startRound(), 800);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `认一认靶上的数字，找到写着 <b>${this.targetScore}</b> 的那一圈～`,
      primary: {
        text: "继续",
        icon: "🎯",
        onClick: () => ov.destroy(),
      },
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
    if (document.getElementById("arc-style")) return;
    const st = document.createElement("style");
    st.id = "arc-style";
    st.textContent = ARC_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function ARC_CSS(theme: string): string {
  return `
.arc-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.arc-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.arc-task b{color:${theme};font-size:1.5rem;}
.arc-stage{position:relative;display:flex;align-items:center;justify-content:center;width:360px;height:380px;background:radial-gradient(circle at 50% 40%,#e9f5ff,#cfe8ff 70%);border-radius:24px;box-shadow:var(--shadow-lg);overflow:hidden;}
.arc-stage::after{content:"🌳🌳";position:absolute;bottom:6px;left:8px;font-size:1.4rem;opacity:.7;}
.arc-target{position:relative;width:320px;height:320px;display:flex;align-items:center;justify-content:center;}
.arc-ring{position:absolute;border:none;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:inset 0 0 0 2px rgba(0,0,0,.12);transition:transform .1s ease;}
.arc-ring:active{transform:scale(.985);}
.arc-ring:first-child{box-shadow:inset 0 0 0 3px #3a2e4a;}
/* 仅最外环（白）显示数字在边缘，其它显示在中心 */
.arc-ring__lbl{font-size:1.5rem;font-weight:900;color:#3a2e4a;opacity:.9;}
.arc-ring[style*="320px"] .arc-ring__lbl{position:absolute;top:6px;color:#3a2e4a;}
.arc-arrow{position:absolute;width:34px;height:6px;background:linear-gradient(90deg,#8b5a2b,#a87142 80%,#ff6348);border-radius:3px;transform:translate(-90%,-50%) rotate(-35deg);box-shadow:0 2px 4px rgba(0,0,0,.3);pointer-events:none;animation:arc-fly .25s ease-out;}
@keyframes arc-fly{0%{transform:translate(-90%,-50%) rotate(-35deg) scale(.3);opacity:.3}100%{transform:translate(-90%,-50%) rotate(-35deg) scale(1);opacity:1}}
.arc-arrow::after{content:"";position:absolute;left:-4px;top:-2px;width:0;height:0;border:5px solid transparent;border-right-color:#3a2e4a;}
.arc-arrow--hit{filter:drop-shadow(0 0 6px #6bcf7f);animation:arc-fly .25s ease-out,arc-wiggle .6s ease .25s;}
@keyframes arc-wiggle{0%,100%{rotate:-35deg}50%{rotate:-28deg}}
.arc-arrow--miss{filter:grayscale(.5);opacity:.7;}
.arc-bow{position:absolute;bottom:10px;right:14px;font-size:2rem;animation:arc-draw 2s ease-in-out infinite;}
@keyframes arc-draw{0%,100%{transform:translateX(0)}50%{transform:translateX(-4px) rotate(-5deg)}}
@media (max-width:380px){.arc-stage{width:300px;height:320px;}.arc-target{width:260px;height:260px;}}
`;
}

export function create(): ArcheryTargetGame {
  return new ArcheryTargetGame();
}
