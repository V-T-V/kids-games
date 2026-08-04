/* 找颜色 Color Find —— 上方给出目标颜色（如"找红色"），
   下方 3 个彩色圆球，孩子点对应颜色的。
   认知启蒙：识别并匹配颜色，巩固基础色彩认知。
   独特点：彩色圆球高光质感 + 目标色高亮提示。3-4 岁用基础色。前缀 cf-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Color {
  name: string;
  hex: string;
  emoji: string;
}

const COLORS: Color[] = [
  { name: "红色", hex: "#ff6348", emoji: "❤️" },
  { name: "黄色", hex: "#ffd93d", emoji: "💛" },
  { name: "蓝色", hex: "#4d96ff", emoji: "💙" },
  { name: "绿色", hex: "#6bcf7f", emoji: "💚" },
  { name: "紫色", hex: "#a55eea", emoji: "💜" },
  { name: "橙色", hex: "#ff9f43", emoji: "🧡" },
];

export class ColorFindGame extends BaseGame {
  constructor() {
    super("color-find");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
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

    const target = sample(COLORS);
    const distractors = shuffle(
      COLORS.filter((c) => c.name !== target.name),
    ).slice(0, 2);
    const options = shuffle([target, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "cf-wrap";

    const task = document.createElement("div");
    task.className = "cf-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 找出 <b>${target.emoji} ${target.name}</b> 的球～`;
    wrap.appendChild(task);

    // 目标色提示块
    const hint = document.createElement("div");
    hint.className = "cf-hint";
    hint.style.setProperty("--cf-c", target.hex);
    hint.textContent = target.name;
    wrap.appendChild(hint);

    const stage = document.createElement("div");
    stage.className = "cf-stage";
    options.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cf-ball";
      b.style.setProperty("--cf-c", c.hex);
      b.setAttribute("aria-label", c.name);
      b.addEventListener("click", () => this.choose(c, target, b, stage));
      stage.appendChild(b);
    });
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
  }

  private choose(
    c: Color,
    target: Color,
    btn: HTMLButtonElement,
    stage: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (c.name === target.name) {
      this.locked = true;
      sfxPop();
      btn.classList.add("cf-ball--done");
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      stage.querySelectorAll(".cf-ball").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 900);
    } else {
      btn.classList.add("cf-ball--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("cf-ball--wrong"), 400);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "看一看～",
      emoji: "🎨",
      variant: "rest",
      body: "上面的字告诉你找什么颜色，比一比三个小球，点出颜色一样的那个～",
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
    if (document.getElementById("cf-style")) return;
    const st = document.createElement("style");
    st.id = "cf-style";
    st.textContent = CF_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function CF_CSS(theme: string): string {
  return `
.cf-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.cf-task{font-size:1.12rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);max-width:100%;}
.cf-task b{color:${theme};}
.cf-hint{background:var(--cf-c,${theme});color:#fff;font-weight:900;font-size:1.4rem;padding:10px 28px;border-radius:18px;box-shadow:var(--shadow);text-shadow:0 1px 2px rgba(0,0,0,.2);animation:cf-bounce 1.6s ease-in-out infinite;}
@keyframes cf-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.cf-stage{display:flex;gap:24px;justify-content:center;align-items:center;padding:20px;background:linear-gradient(180deg,#fff,#f5f5f5);border-radius:24px;box-shadow:var(--shadow);width:100%;box-sizing:border-box;min-height:160px;}
.cf-ball{width:96px;height:96px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff9,var(--cf-c,${theme}));box-shadow:var(--shadow);border:none;cursor:pointer;transition:transform .12s;padding:0;}
.cf-ball:active{transform:scale(.92);}
.cf-ball--done{outline:6px solid #34c759;outline-offset:3px;animation:cf-pop .4s ease;}
.cf-ball--wrong{outline:6px solid #ff3b30;outline-offset:3px;animation:cf-shake .4s ease;}
@keyframes cf-pop{0%{transform:scale(.7)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes cf-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ColorFindGame {
  return new ColorFindGame();
}
