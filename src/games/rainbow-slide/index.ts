/* 彩虹滑道 Rainbow Slide —— 7 色彩虹块被乱序堆成滑道，
   孩子按「红橙黄绿青蓝紫」顺序从下往上点，重新搭出彩虹。
   独特点：每点对一块，弧形彩条滑入彩虹拱门，颜色 + 顺序双重认知。
   视觉：彩色弧形块层叠成拱门；难度=打乱程度。通关=搭完目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface RainbowColor {
  hex: string;
  name: string;
}

/* 标准彩虹顺序：从下到上 红→橙→黄→绿→青→蓝→紫 */
const RAINBOW: RainbowColor[] = [
  { hex: "#ff5252", name: "红" },
  { hex: "#ff9f43", name: "橙" },
  { hex: "#ffd93d", name: "黄" },
  { hex: "#6bcf7f", name: "绿" },
  { hex: "#22d3ee", name: "青" },
  { hex: "#4d96ff", name: "蓝" },
  { hex: "#a55eea", name: "紫" },
];

const ENCOURAGE = ["好棒！", "真漂亮！", "继续加油～", "搭得真高！"];

export class RainbowSlideGame extends BaseGame {
  constructor() {
    super("rainbow-slide");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 下一个该搭的颜色在 RAINBOW 中的索引 */
  private nextIdx = 0;
  /** 本轮参与的颜色数（弧形条数） */
  private bandCount = 7;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 不同难度的彩虹条数（条数越少越简单） */
  private bandsForDifficulty(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 7;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.bandCount = this.bandsForDifficulty();
    this.nextIdx = 0;

    /* 取彩虹的前 N 个颜色（保持真实顺序，有解） */
    const ordered = RAINBOW.slice(0, this.bandCount);
    /* 乱序展示在「滑道」区，供孩子点选 */
    const shuffled = shuffle(ordered);

    const wrap = document.createElement("div");
    wrap.className = "rsl-wrap";

    const task = document.createElement("div");
    task.className = "rsl-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 按 <b style="color:#ff5252">红</b><b style="color:#ff9f43">橙</b><b style="color:#c9a227">黄</b><b style="color:#6bcf7f">绿</b><b style="color:#22d3ee">青</b><b style="color:#4d96ff">蓝</b><b style="color:#a55eea">紫</b> 顺序，从下往上搭彩虹！`;
    wrap.appendChild(task);

    /* 目标彩虹拱门区：已搭好的弧形条会出现在这里 */
    const arch = document.createElement("div");
    arch.className = "rsl-arch";
    arch.id = "rsl-arch";
    wrap.appendChild(arch);

    /* 待搭的滑道块（打乱顺序，横向铺开） */
    const pool = document.createElement("div");
    pool.className = "rsl-pool";
    shuffled.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rsl-band";
      b.style.setProperty("--rsl-color", c.hex);
      b.setAttribute("aria-label", `${c.name}色彩虹块`);
      b.dataset.hex = c.hex;
      b.addEventListener("click", () => this.pick(b, c));
      pool.appendChild(b);
    });
    wrap.appendChild(pool);

    const tip = document.createElement("div");
    tip.className = "rsl-tip";
    tip.innerHTML = `下一个：<span id="rsl-next-name">${this.currentName()}</span>`;
    wrap.appendChild(tip);

    this.root.appendChild(wrap);
  }

  private currentName(): string {
    if (this.nextIdx >= RAINBOW.length) return "搭完啦！";
    return RAINBOW[this.nextIdx]!.name + "色";
  }

  private pick(btn: HTMLButtonElement, color: RainbowColor): void {
    if (btn.classList.contains("rsl-band--used")) return;
    const expected = RAINBOW[this.nextIdx]!;
    if (color.hex === expected.hex) {
      /* 答对：把弧形条加进拱门，按正确层级堆叠 */
      btn.classList.add("rsl-band--used");
      btn.disabled = true;
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();

      const arch = this.root.querySelector("#rsl-arch") as HTMLElement | null;
      if (arch) {
        const band = document.createElement("div");
        band.className = "rsl-arch-band";
        band.style.setProperty("--rsl-color", color.hex);
        /* 层数从下往上：第 0 层在最底 */
        band.style.setProperty("--rsl-level", String(this.nextIdx));
        band.setAttribute("aria-label", `${color.name}色已搭好`);
        arch.appendChild(band);
        /* 强制重排后加 in 动画 */
        void band.offsetWidth;
        band.classList.add("rsl-arch-band--in");
      }

      this.nextIdx += 1;
      const nameEl = this.root.querySelector("#rsl-next-name");
      if (nameEl) nameEl.textContent = this.currentName();

      if (this.nextIdx >= this.bandCount) {
        /* 本轮彩虹搭完 */
        this.trackTimeout(() => {
          this.roundsDone += 1;
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 900);
      }
    } else {
      /* 答错：块抖一抖，恢复可点 */
      btn.classList.add("rsl-band--shake");
      this.trackTimeout(() => btn.classList.remove("rsl-band--shake"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌈",
      variant: "rest",
      body: `彩虹的颜色顺序：红、橙、黄、绿、青、蓝、紫。${sample(ENCOURAGE)}`,
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
    if (document.getElementById("rsl-style")) return;
    const st = document.createElement("style");
    st.id = "rsl-style";
    st.textContent = RSL_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function RSL_CSS(theme: string): string {
  return `
.rsl-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.rsl-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 18px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.rsl-task b{font-size:1.2rem;margin:0 1px;}
.rsl-arch{position:relative;width:min(440px,92vw);height:230px;display:flex;flex-direction:column-reverse;align-items:center;justify-content:flex-start;background:radial-gradient(120% 90% at 50% 110%,rgba(255,255,255,.55),transparent 70%);}
.rsl-arch-band{position:absolute;left:50%;bottom:6px;width:0;height:0;border-radius:50% 50% 0 0/100% 100% 0 0;background:var(--rsl-color,${theme});transform:translateX(-50%);box-shadow:0 2px 0 rgba(0,0,0,.06);opacity:0;}
.rsl-arch-band--in{opacity:1;animation:rsl-grow .45s cubic-bezier(.2,.9,.3,1.2) forwards;}
@keyframes rsl-grow{
  0%{width:0;height:0;}
  100%{
    /* 层数越大越高越窄（外层）。用 CSS 变量 --rsl-level 计算 */
    width:calc(420px - var(--rsl-level,0) * 50px);
    height:calc(40px + var(--rsl-level,0) * 30px);
    bottom:calc(4px + var(--rsl-level,0) * 26px);
  }
}
.rsl-pool{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:16px 14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:460px;}
.rsl-band{width:64px;height:34px;border:none;cursor:pointer;border-radius:50% 50% 0 0/100% 100% 0 0;background:var(--rsl-color,${theme});box-shadow:inset 0 -3px 6px rgba(0,0,0,.18),0 3px 6px rgba(0,0,0,.15);transition:transform .12s ease;}
.rsl-band:active{transform:translateY(2px) scale(.95);}
.rsl-band--shake{animation:rsl-shake .45s ease;}
@keyframes rsl-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
.rsl-band--used{opacity:.25;transform:scale(.7);pointer-events:none;}
.rsl-tip{font-size:1rem;font-weight:700;color:#555;background:#fff;padding:6px 16px;border-radius:999px;box-shadow:var(--shadow);}
.rsl-tip #rsl-next-name{color:${theme};font-weight:900;}
@media (max-width:380px){.rsl-band{width:52px;height:28px;}.rsl-arch{height:200px;}@keyframes rsl-grow{0%{width:0;height:0;}100%{width:calc(340px - var(--rsl-level,0) * 42px);height:calc(34px + var(--rsl-level,0) * 26px);bottom:calc(4px + var(--rsl-level,0) * 22px);}}}
`;
}

export function create(): RainbowSlideGame {
  return new RainbowSlideGame();
}
