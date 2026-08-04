/* 手影猜谜 Shadow Puppet —— 显示一个动物黑色剪影，从选项里选它代表的动物。
   独特点：剪影（filter:brightness(0)）+ 形态识别，培养观察与联想。
   巧思：选项必含正确答案，干扰项用相似/常见动物，剪影可切换高亮揭晓。
   难度 = 选项数。通关 = 猜对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Animal {
  emoji: string;
  name: string;
}

const ANIMALS: Animal[] = [
  { emoji: "🐰", name: "兔子" },
  { emoji: "🐱", name: "小猫" },
  { emoji: "🐶", name: "小狗" },
  { emoji: "🐘", name: "大象" },
  { emoji: "🦒", name: "长颈鹿" },
  { emoji: "🐦", name: "小鸟" },
  { emoji: "🐢", name: "乌龟" },
  { emoji: "🦊", name: "狐狸" },
  { emoji: "🐸", name: "青蛙" },
  { emoji: "🦅", name: "老鹰" },
  { emoji: "🐠", name: "小鱼" },
  { emoji: "🦋", name: "蝴蝶" },
];

export class ShadowPuppetGame extends BaseGame {
  constructor() {
    super("shadow-puppet");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private currentAnswer: Animal | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root 清空，无定时器/RAF */
  }

  private optionCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 正确答案
    const answer = sample(ANIMALS);
    this.currentAnswer = answer;

    // 干扰项：与答案不同的动物
    const distract = shuffle(
      ANIMALS.filter((a) => a.emoji !== answer.emoji),
    ).slice(0, this.optionCount() - 1);
    // 选项 = 答案 + 干扰，打乱（保证含正确答案 → 有解）
    const options = shuffle([answer, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "shp-wrap";

    const task = document.createElement("div");
    task.className = "shp-task";
    task.innerHTML = `这个黑影是哪个小动物？第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关`;
    wrap.appendChild(task);

    // 剪影舞台
    const stage = document.createElement("div");
    stage.className = "shp-stage";
    const shadow = document.createElement("div");
    shadow.className = "shp-shadow";
    shadow.id = "shp-shadow";
    shadow.textContent = answer.emoji;
    const hint = document.createElement("div");
    hint.className = "shp-hint";
    hint.textContent = "看影子，猜动物";
    stage.appendChild(shadow);
    stage.appendChild(hint);
    wrap.appendChild(stage);

    // 选项
    const grid = document.createElement("div");
    grid.className = "shp-options";
    options.forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "shp-option";
      b.dataset.emoji = opt.emoji;
      b.innerHTML = `<div class="shp-option-emoji">${opt.emoji}</div><div class="shp-option-name">${opt.name}</div>`;
      b.addEventListener("click", () => this.choose(opt, b, shadow, answer));
      grid.appendChild(b);
    });
    wrap.appendChild(grid);

    this.root.appendChild(wrap);
  }

  private choose(
    opt: Animal,
    btn: HTMLButtonElement,
    shadow: HTMLElement,
    answer: Animal,
  ): void {
    if (this.locked || btn.classList.contains("shp-option--used")) return;

    if (opt.emoji === answer.emoji) {
      this.locked = true;
      btn.classList.add("shp-option--correct");
      shadow.classList.add("shp-shadow--reveal");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("shp-option--used");
      btn.disabled = true;
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再仔细看看影子的耳朵、尾巴，像哪个小动物呀～",
      primary: { text: "继续", icon: "🔦", onClick: () => ov.destroy() },
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
    if (document.getElementById("shp-style")) return;
    const st = document.createElement("style");
    st.id = "shp-style";
    st.textContent = SP_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function SP_CSS(theme: string): string {
  return `
.shp-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.shp-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.shp-stage{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;padding:24px;background:radial-gradient(ellipse at center,#2a2350 0%,#15102e 100%);border-radius:24px;box-shadow:var(--shadow);}
.shp-shadow{font-size:7rem;line-height:1;filter:brightness(0) drop-shadow(0 0 18px rgba(255,240,200,.35));transition:filter .5s;animation:sp-sway 3s ease-in-out infinite;}
@keyframes sp-sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
.shp-shadow--reveal{filter:brightness(1) drop-shadow(0 0 24px ${theme});animation:sp-reveal .6s ease;}
@keyframes sp-reveal{0%{transform:scale(.8)}50%{transform:scale(1.2) rotate(-5deg)}100%{transform:scale(1) rotate(0)}}
.shp-hint{color:rgba(255,255,255,.6);font-size:.9rem;font-weight:700;letter-spacing:.1em;}
.shp-options{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:20px;box-shadow:var(--shadow);max-width:440px;}
.shp-option{width:96px;border:none;background:linear-gradient(180deg,#fff,#f3f7ff);border-radius:16px;padding:10px 6px 8px;box-shadow:var(--shadow),inset 0 -4px 0 rgba(0,0,0,.06);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;transition:transform .12s;}
.shp-option:active{transform:translateY(2px) scale(.95);}
.shp-option-emoji{font-size:2.6rem;line-height:1;filter:drop-shadow(0 3px 3px rgba(0,0,0,.15));}
.shp-option-name{font-size:.85rem;font-weight:800;color:#555;}
.shp-option--used{opacity:.35;transform:scale(.9);pointer-events:none;}
.shp-option--correct{background:linear-gradient(180deg,#fff,color-mix(in srgb,${theme} 40%,#fff));animation:sp-correct .5s ease;border:3px solid ${theme};}
@keyframes sp-correct{0%{transform:scale(1)}40%{transform:scale(1.18) rotate(-4deg)}100%{transform:scale(1)}}
@media (max-width:380px){.shp-shadow{font-size:5.5rem;}.shp-option{width:80px;}.shp-option-emoji{font-size:2.2rem;}}
`;
}

export function create(): ShadowPuppetGame {
  return new ShadowPuppetGame();
}
