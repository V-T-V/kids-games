/* 独角兽角 Unicorn Horn —— 几只独角兽的角颜色各不同，题目要求
   "找到彩虹色的角 / 找到粉色的角..."，孩子点对应颜色的独角兽。
   独特点：颜色辨识 + 注意力。视觉：彩虹独角兽 + 发光的彩色角。
   难度=独角兽数量。通关=找对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 角颜色（中文名 + 颜色值），都是儿童辨识度高的颜色。 */
const HORN_COLORS = [
  { name: "彩虹", color: "rainbow" },
  { name: "粉", color: "#ff6b9d" },
  { name: "蓝", color: "#4d96ff" },
  { name: "黄", color: "#ffd93d" },
  { name: "绿", color: "#6bcf7f" },
  { name: "紫", color: "#a55eea" },
  { name: "橙", color: "#ff9f43" },
] as const;

export class UnicornHornGame extends BaseGame {
  constructor() {
    super("unicorn-horn");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  /** 本关正确答案（HORN_COLORS 下标） */
  private target = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空；定时器由基类清理 */
  }

  private count(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 6;
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 选目标颜色：easy 固定彩虹，medium/hard 随机
    const targetPool =
      this.difficulty === "easy"
        ? [0]
        : this.difficulty === "medium"
          ? [0, 1, 2, 3]
          : [0, 1, 2, 3, 4, 5, 6];
    const ti = shuffle(targetPool)[0]!;
    this.target = ti;
    const n = this.count();
    // 选 n 个颜色：保证目标在内
    const others = shuffle(
      HORN_COLORS.map((_, i) => i).filter((i) => i !== ti),
    ).slice(0, n - 1);
    const set = shuffle([ti, ...others]);

    const wrap = document.createElement("div");
    wrap.className = "uch-wrap";

    const target = HORN_COLORS[ti]!;
    const swatch =
      target.color === "rainbow"
        ? `<span class="uch-rainbow"></span>`
        : `<span class="uch-swatch" style="background:${target.color}"></span>`;
    const task = document.createElement("div");
    task.className = "uch-task";
    task.innerHTML = `找到 <b>${target.name}色</b> 角的独角兽 ${swatch}<br><span class="uch-hint">第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const meadow = document.createElement("div");
    meadow.className = "uch-meadow";
    set.forEach((idx, i) => {
      const c = HORN_COLORS[idx]!;
      const u = document.createElement("button");
      u.type = "button";
      u.className = "uch-unicorn";
      u.style.setProperty("--delay", `${i * 0.08}s`);
      u.setAttribute("aria-label", `${c.name}色角的独角兽`);
      const hornStyle =
        c.color === "rainbow"
          ? "background:linear-gradient(180deg,#ff6b9d,#ffd93d,#6bcf7f,#4d96ff,#a55eea);"
          : `background:linear-gradient(180deg,#fff,${c.color});`;
      u.innerHTML = `
        <span class="uch-horn" style="${hornStyle}"></span>
        <span class="uch-body">🦄</span>
      `;
      u.addEventListener("click", () => this.pick(idx, u));
      meadow.appendChild(u);
    });
    wrap.appendChild(meadow);

    this.root.appendChild(wrap);
  }

  private pick(idx: number, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (idx === this.target) {
      this.answered = true;
      btn.classList.add("uch-unicorn--correct");
      sfxPop();
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
      btn.classList.add("uch-unicorn--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("uch-unicorn--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const t = HORN_COLORS[this.target]!;
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `仔细看看每只独角兽头上的角，找到 <b>${t.name}色</b> 的那一只～`,
      primary: { text: "继续", icon: "🦄", onClick: () => ov.destroy() },
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
    if (document.getElementById("uch-style")) return;
    const st = document.createElement("style");
    st.id = "uch-style";
    st.textContent = UCH_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function UCH_CSS(theme: string): string {
  return `
.uch-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(560px,100%);}
.uch-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.uch-task b{color:${theme};font-size:1.25rem;}
.uch-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.uch-swatch{display:inline-block;width:22px;height:22px;border-radius:50%;vertical-align:middle;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);margin:0 2px;}
.uch-rainbow{display:inline-block;width:22px;height:22px;border-radius:50%;vertical-align:middle;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);background:conic-gradient(#ff6b9d,#ffd93d,#6bcf7f,#4d96ff,#a55eea,#ff6b9d);}
.uch-meadow{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:22px 16px;width:100%;border-radius:24px;background:radial-gradient(circle at 30% 20%,#fff6,transparent),linear-gradient(180deg,#e8fbe0,#c9eebc);box-shadow:var(--shadow-lg);}
.uch-meadow::after{content:"🌼🌸🌷🌼🌸🌷";position:absolute;}
.uch-unicorn{position:relative;border:none;background:transparent;cursor:pointer;display:flex;flex-direction:column;align-items:center;padding:0;font-size:3rem;animation:uch-in .5s ease backwards;animation-delay:var(--delay,0s);filter:drop-shadow(0 4px 4px rgba(0,0,0,.15));transition:transform .12s ease;}
@keyframes uch-in{0%{transform:translateY(20px) scale(.6);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
.uch-unicorn:active{transform:scale(.93);}
.uch-horn{display:block;width:10px;height:26px;border-radius:50% 50% 30% 30% / 60% 60% 40% 40%;box-shadow:0 0 8px var(--horn-glow,#fff5),inset 0 -3px 4px rgba(0,0,0,.15);margin-bottom:-6px;z-index:1;animation:uch-shine 2s ease-in-out infinite;}
@keyframes uch-shine{0%,100%{filter:brightness(1)}50%{filter:brightness(1.25)}}
.uch-body{display:block;line-height:1;}
.uch-unicorn--correct{animation:uch-correct .8s ease;}
@keyframes uch-correct{0%{transform:scale(1)}30%{transform:scale(1.3) rotate(-8deg)}60%{transform:scale(1.15) rotate(8deg)}100%{transform:scale(1)}}
.uch-unicorn--wrong{animation:uch-shake .4s ease;}
@keyframes uch-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.uch-meadow{grid-template-columns:repeat(2,1fr);}.uch-unicorn{font-size:2.4rem;}}
`;
}

export function create(): UnicornHornGame {
  return new UnicornHornGame();
}
