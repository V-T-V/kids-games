/* 仙粉 Fairy Dust —— 题目"撒红色仙粉"，屏幕上有几个不同颜色的仙粉罐，
   孩子点对应色的罐子，仙粉飞洒。独特点：点击后仙粉粒子从罐口喷洒落下。
   巧思：颜色用文字 + 色块双重提示（识字前也能玩）；难度=罐子颜色数。
   通关=撒对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

const COLORS = [
  { color: "#ff6b9d", name: "红" },
  { color: "#ffd93d", name: "黄" },
  { color: "#4d96ff", name: "蓝" },
  { color: "#6bcf7f", name: "绿" },
  { color: "#a55eea", name: "紫" },
  { color: "#ff9f43", name: "橙" },
];

export class FairyDustGame extends BaseGame {
  constructor() {
    super("fairy-dust");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private targetColor = "";
  private targetName = "";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private jarCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.jarCount();
    const pick = shuffle(COLORS).slice(0, n);
    const target = sample(pick);
    this.targetColor = target.color;
    this.targetName = target.name;

    const wrap = document.createElement("div");
    wrap.className = "frd-wrap";

    const task = document.createElement("div");
    task.className = "frd-task";
    task.innerHTML = `撒 <b style="color:${this.targetColor}">${this.targetName}色</b> 仙粉～<span class="frd-prog">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const hint = document.createElement("div");
    hint.className = "frd-hint";
    hint.id = "frd-hint";
    hint.textContent = "点对应颜色的仙粉罐～";
    wrap.appendChild(hint);

    const stage = document.createElement("div");
    stage.className = "frd-stage";
    stage.id = "frd-stage";
    const jars = shuffle(pick);
    jars.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "frd-jar";
      b.style.setProperty("--jc", c.color);
      b.innerHTML = `
        <div class="frd-jar__lid"></div>
        <div class="frd-jar__neck"></div>
        <div class="frd-jar__body">
          <div class="frd-jar__glow"></div>
          <span class="frd-jar__label">${c.name}</span>
        </div>`;
      b.addEventListener("click", () => this.choose(c, b, stage));
      stage.appendChild(b);
    });
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
  }

  private choose(
    c: { color: string; name: string },
    btn: HTMLButtonElement,
    stage: HTMLElement,
  ): void {
    if (btn.classList.contains("frd-jar--used")) return;
    if (c.color === this.targetColor) {
      btn.classList.add("frd-jar--used");
      sfxPop();
      this.sprinkle(c.color, btn, stage);
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top);
      this.resetWrongStreak();
      const hint = this.root.querySelector("#frd-hint");
      if (hint) hint.textContent = `撒对啦！${this.targetName}色仙粉～ ✨`;
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      // 错误：轻轻摇晃
      btn.classList.add("frd-jar--shake");
      this.trackTimeout(() => btn.classList.remove("frd-jar--shake"), 400);
      const paused = this.onWrong();
      const hint = this.root.querySelector("#frd-hint");
      if (hint)
        hint.textContent = `这是${c.name}色哦，找${this.targetName}色～`;
      if (paused) this.showRest();
    }
  }

  /** 在罐口喷射仙粉粒子（纯 DOM 动画）。 */
  private sprinkle(color: string, btn: HTMLElement, stage: HTMLElement): void {
    const r = btn.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const ox = r.left - sr.left + r.width / 2;
    const oy = r.top - sr.top + 6;
    for (let i = 0; i < 14; i++) {
      const p = document.createElement("span");
      p.className = "frd-particle";
      p.style.background = color;
      p.style.left = `${ox}px`;
      p.style.top = `${oy}px`;
      const dx = (Math.random() - 0.5) * 80;
      const dy = -20 - Math.random() * 30;
      p.style.setProperty("--dx", `${dx}px`);
      p.style.setProperty("--dy", `${dy}px`);
      p.style.animationDelay = `${i * 18}ms`;
      stage.appendChild(p);
      this.trackTimeout(() => p.remove(), 1200);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先看题目要撒什么颜色，再找同色的罐子～",
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
    if (document.getElementById("frd-style")) return;
    const st = document.createElement("style");
    st.id = "frd-style";
    st.textContent = FRD_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function FRD_CSS(theme: string): string {
  void theme;
  return `
.frd-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(540px,100%);}
.frd-task{font-size:1.2rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.frd-prog{font-size:.85rem;color:var(--ink-soft);font-weight:700;margin-left:6px;}
.frd-hint{font-size:1rem;font-weight:700;color:var(--ink-soft);min-height:1.4em;}
.frd-stage{position:relative;display:flex;gap:16px;flex-wrap:wrap;justify-content:center;min-height:160px;padding:18px 10px;}
.frd-jar{display:flex;flex-direction:column;align-items:center;background:none;border:none;cursor:pointer;position:relative;transition:transform .15s ease;}
.frd-jar:active{transform:scale(.93);}
.frd-jar__lid{width:42px;height:10px;background:linear-gradient(180deg,#999,#666);border-radius:6px 6px 2px 2px;}
.frd-jar__neck{width:30px;height:8px;background:color-mix(in srgb,var(--jc) 50%,#fff);}
.frd-jar__body{width:64px;height:80px;background:linear-gradient(180deg,color-mix(in srgb,var(--jc) 80%,#fff),var(--jc));border-radius:14px 14px 26px 26px;position:relative;display:flex;align-items:center;justify-content:center;box-shadow:inset -5px -5px 0 rgba(0,0,0,.12),var(--shadow);}
.frd-jar__glow{position:absolute;inset:8px;border-radius:10px;background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.6),transparent 60%);}
.frd-jar__label{font-size:1rem;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);position:relative;z-index:1;}
.frd-jar--used{opacity:.45;pointer-events:none;}
.frd-jar--used .frd-jar__body{filter:saturate(.4);}
.frd-jar--shake{animation:frd-shake .4s ease;}
@keyframes frd-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px) rotate(-3deg)}75%{transform:translateX(6px) rotate(3deg)}}
.frd-particle{position:absolute;width:8px;height:8px;border-radius:50%;pointer-events:none;animation:frd-fly 1s ease-out forwards;box-shadow:0 0 6px currentColor;}
@keyframes frd-fly{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),calc(var(--dy) + 80px)) scale(.3);opacity:0}}
@media (max-width:380px){.frd-jar__body{width:54px;height:68px;}.frd-stage{gap:10px;}}
`;
}

export function create(): FairyDustGame {
  return new FairyDustGame();
}
