/* 颜色反应 Color Reaction —— 听颜色名，点对应颜色块。
   独特点：用语音合成（SpeechSynthesis）播报颜色，听觉驱动（区别于纯视觉游戏）。
   巧思：屏幕上多个色块干扰，反应越快星越多；防误触：颜色名也显示。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

const COLORS = [
  { name: "红色", hex: "#ff6b6b" },
  { name: "黄色", hex: "#ffd93d" },
  { name: "蓝色", hex: "#4d96ff" },
  { name: "绿色", hex: "#6bcf7f" },
  { name: "紫色", hex: "#a55eea" },
  { name: "橙色", hex: "#ff9f43" },
  { name: "黑色", hex: "#3a2e4a" },
  { name: "粉色", hex: "#ff8fb1" },
];

function speak(text: string): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* 不支持则忽略 */
  }
}

export class ColorReactionGame extends BaseGame {
  constructor() {
    super("color-reaction");
  }
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    speechSynthesis.cancel();
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const picked = shuffle(COLORS).slice(0, n);
    const target = sample(picked);

    const wrap = document.createElement("div");
    wrap.className = "cr-wrap";
    const task = document.createElement("div");
    task.className = "cr-task";
    task.innerHTML = `点击 <span style="color:${target.hex};text-shadow:0 1px 2px rgba(0,0,0,.2)">${target.name}</span> 的方块`;
    wrap.appendChild(task);

    const player = document.createElement("div");
    player.className = "cr-player";
    player.appendChild(
      createButton({
        text: "再听一遍",
        icon: "🔊",
        variant: "secondary",
        onClick: () => speak(target.name),
      }),
    );
    wrap.appendChild(player);

    const grid = document.createElement("div");
    grid.className = "cr-grid";
    shuffle(picked).forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cr-block";
      b.style.background = c.hex;
      b.addEventListener("click", () => {
        if (c.name === target.name) {
          b.classList.add("cr-block--done");
          sfxPop();
          const r = b.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          this.roundsDone += 1;
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 900);
        } else {
          b.classList.add("cr-block--wrong");
          const paused = this.onWrong();
          this.trackTimeout(() => b.classList.remove("cr-block--wrong"), 400);
          if (paused) this.showRest();
        }
      });
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
    speak(target.name);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再听一遍颜色名～",
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
    if (document.getElementById("cr-style")) return;
    const st = document.createElement("style");
    st.id = "cr-style";
    st.textContent = CR_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function CR_CSS(_theme: string): string {
  return `
.cr-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.cr-task{font-size:1.3rem;font-weight:800;text-align:center;}
.cr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
.cr-block{width:78px;height:78px;border-radius:18px;box-shadow:var(--shadow);}
.cr-block:active{transform:scale(.92);}
.cr-block--done{outline:5px solid #fff;outline-offset:3px;animation:cr-pop .4s ease;}
.cr-block--wrong{animation:cr-shake .4s ease;}
@keyframes cr-pop{0%{transform:scale(.7)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes cr-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ColorReactionGame {
  return new ColorReactionGame();
}
