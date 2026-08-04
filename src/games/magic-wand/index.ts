/* 魔棒 Magic Wand —— 屏幕上漂浮着几个不同颜色的魔法球，题目"用魔棒点蓝色的"，
   孩子点对应颜色的球，球发光后消失。
   独特点：颜色识别 + 选择。屏幕上多球干扰（含同色多个），题目指定一种颜色，
   点对该色任一球都算对（颜色统一发光消除）。点错颜色球抖动提示。
   视觉：魔棒指针 + 漂浮发光魔法球。难度=球数。通关=点对目标轮数。
   解保证：每关目标颜色一定在球里至少出现一个。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample, randInt } from "../../lobby/util.ts";

const COLORS = [
  { name: "红色", hex: "#ff6b6b" },
  { name: "黄色", hex: "#ffd93d" },
  { name: "蓝色", hex: "#4d96ff" },
  { name: "绿色", hex: "#6bcf7f" },
  { name: "紫色", hex: "#a55eea" },
  { name: "橙色", hex: "#ff9f43" },
  { name: "粉色", hex: "#ff8fb1" },
] as const;

export class MagicWandGame extends BaseGame {
  constructor() {
    super("magic-wand");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private targetHex = "";
  private done = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private ballCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.done = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = this.ballCount();
    const picked = shuffle(COLORS).slice(0, Math.min(n, COLORS.length));
    // 扩充到 n 个球（允许重复颜色），但保证目标色在内
    const balls = [...picked];
    while (balls.length < n) balls.push(sample(picked));
    const target = sample(balls);
    this.targetHex = target.hex;

    const wrap = document.createElement("div");
    wrap.className = "mgw-wrap";
    const task = document.createElement("div");
    task.className = "mgw-task";
    task.innerHTML = `用魔棒点 <span style="color:${target.hex};text-shadow:0 1px 2px rgba(0,0,0,.2)">${target.name}</span> 的魔法球`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "mgw-stage";
    stage.id = "mgw-stage";
    shuffle(balls).forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mgw-orb";
      b.style.setProperty("--mgw-color", c.hex);
      // 随机漂浮起点 + 动画延迟
      b.style.left = `${randInt(8, 78)}%`;
      b.style.top = `${randInt(12, 70)}%`;
      b.style.animationDelay = `${Math.random() * 1.5}s`;
      b.style.animationDuration = `${2.4 + Math.random() * 1.6}s`;
      b.innerHTML = `<span class="mgw-core"></span>`;
      b.addEventListener("click", () => this.zap(c, b));
      stage.appendChild(b);
    });
    wrap.appendChild(stage);
    this.root.appendChild(wrap);
  }

  private zap(c: { hex: string; name: string }, btn: HTMLButtonElement): void {
    if (this.done || btn.classList.contains("mgw-orb--gone")) return;
    if (c.hex !== this.targetHex) {
      btn.classList.add("mgw-shake");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("mgw-shake"), 400);
      if (paused) this.showRest();
      return;
    }
    // 答对：所有目标色球一起发光消失
    this.done = true;
    sfxPop();
    const r = btn.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.root.querySelectorAll<HTMLButtonElement>(".mgw-orb").forEach((o) => {
      if (o.style.getPropertyValue("--mgw-color").trim() === this.targetHex) {
        o.classList.add("mgw-orb--burst");
        this.trackTimeout(() => o.remove(), 600);
      }
    });
    this.roundsDone += 1;
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.trackTimeout(() => {
      if (this.roundsDone >= this.roundTotal)
        this.finishClear(starsByAccuracy(this.wrongCount));
      else this.startRound();
    }, 800);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "题目说要什么颜色，就点那个颜色的球哦～",
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
    if (document.getElementById("mgw-style")) return;
    const st = document.createElement("style");
    st.id = "mgw-style";
    st.textContent = MGW_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function MGW_CSS(_theme: string): string {
  return `
.mgw-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(480px,100%);cursor:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><text y='26' font-size='26'>🪄</text></svg>") 4 26,auto;}
.mgw-task{font-size:1.2rem;font-weight:800;text-align:center;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.mgw-stage{position:relative;width:100%;height:58vh;min-height:340px;background:radial-gradient(circle at 50% 40%,rgba(165,94,234,.16),transparent 70%),linear-gradient(160deg,#1b1430,#2d1f4a);border-radius:24px;box-shadow:var(--shadow);overflow:hidden;}
.mgw-stage::before{content:"✨ ⭐ ✨";position:absolute;top:8px;left:0;right:0;text-align:center;color:#fff8;font-size:1rem;letter-spacing:6px;opacity:.6;}
.mgw-orb{position:absolute;width:64px;height:64px;border-radius:50%;border:none;background:transparent;padding:0;cursor:pointer;animation:mgw-float 3s ease-in-out infinite;}
.mgw-core{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,var(--mgw-color));box-shadow:0 0 18px 4px var(--mgw-color),inset 0 -6px 10px rgba(0,0,0,.25);transition:transform .15s;}
.mgw-orb:hover .mgw-core{transform:scale(1.1);box-shadow:0 0 28px 8px var(--mgw-color),inset 0 -6px 10px rgba(0,0,0,.25);}
.mgw-orb:active .mgw-core{transform:scale(.92);}
.mgw-orb--burst .mgw-core{animation:mgw-burst .6s ease forwards;}
.mgw-orb--gone{opacity:0;}
.mgw-shake{animation:mgw-shake .4s ease;}
@keyframes mgw-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes mgw-burst{0%{transform:scale(1);filter:brightness(1)}40%{transform:scale(1.8);filter:brightness(1.8)}100%{transform:scale(0);opacity:0;filter:brightness(2)}}
@keyframes mgw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.mgw-orb{width:54px;height:54px;}}
`;
}

export function create(): MagicWandGame {
  return new MagicWandGame();
}
