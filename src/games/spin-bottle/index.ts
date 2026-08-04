/* 转瓶子 Spin Bottle —— 点转瓶子，瓶口停在哪个任务卡就做哪个，做完点完成。
   独特点：CSS 瓶子旋转减速动画，创造性游戏（学猫叫、跳一下等身体/语言任务）。
   巧思：通关=完成目标轮数，沙盒氛围偏轻松。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Task {
  emoji: string;
  text: string;
}

const TASKS: Task[] = [
  { emoji: "🐱", text: "学猫叫三声" },
  { emoji: "🤸", text: "原地跳一下" },
  { emoji: "😊", text: "做一个大笑脸" },
  { emoji: "👏", text: "给自己鼓鼓掌" },
  { emoji: "👅", text: "伸舌头扮鬼脸" },
  { emoji: "🦆", text: "学小鸭子走路" },
  { emoji: "🎵", text: "哼一首喜欢的歌" },
  { emoji: "🤗", text: "抱抱身边的人" },
  { emoji: "🦁", text: "学狮子吼一声" },
  { emoji: "💃", text: "扭扭屁股跳舞" },
];

export class SpinBottleGame extends BaseGame {
  constructor() {
    super("spin-bottle");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private spinning = false;
  private currentTask: Task | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private taskCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.spinning = false;
    this.currentTask = null;

    const tasks = shuffle(TASKS).slice(0, this.taskCount());

    const wrap = document.createElement("div");
    wrap.className = "sb-wrap";

    const task = document.createElement("div");
    task.className = "sb-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 完成任务数 <b id="sb-done">${this.roundsDone}</b>/${this.roundTotal}`;
    wrap.appendChild(task);

    // 圆盘：瓶子在中央，任务卡围一圈
    const dial = document.createElement("div");
    dial.className = "sb-dial";
    dial.style.setProperty("--sb-n", String(tasks.length));

    // 任务卡（按角度分布）
    const n = tasks.length;
    for (let i = 0; i < n; i++) {
      const angle = (360 / n) * i - 90; // 顶部开始
      const card = document.createElement("div");
      card.className = "sb-card";
      card.style.setProperty("--sb-angle", `${angle}deg`);
      card.dataset.idx = String(i);
      card.innerHTML = `<span class="sb-card-emoji">${tasks[i]!.emoji}</span><span class="sb-card-text">${tasks[i]!.text}</span>`;
      dial.appendChild(card);
    }

    // 中央瓶子（指针朝上）
    const bottle = document.createElement("div");
    bottle.className = "sb-bottle";
    bottle.innerHTML = `<span class="sb-bottle-icon">🍾</span><span class="sb-bottle-pointer">⬆️</span>`;
    dial.appendChild(bottle);

    // 转瓶按钮
    const spinBtn = document.createElement("button");
    spinBtn.type = "button";
    spinBtn.className = "sb-spin-btn";
    spinBtn.textContent = "🎲 转瓶子！";
    spinBtn.addEventListener("click", () => this.spin(bottle, tasks, spinBtn));

    wrap.appendChild(dial);
    wrap.appendChild(spinBtn);
    this.root.appendChild(wrap);
  }

  private spin(
    bottle: HTMLElement,
    tasks: Task[],
    spinBtn: HTMLButtonElement,
  ): void {
    if (this.spinning) return;
    this.spinning = true;
    spinBtn.disabled = true;
    sfxPop();

    // 随机停在哪个任务（最少转 2 圈 + 多余角度）
    const n = tasks.length;
    const targetIdx = Math.floor(Math.random() * n);
    // 瓶子旋转后，pointer(向上) 对应任务 i：瓶子角度 = -angle_i
    // task i 的 angle = (360/n)*i - 90
    const targetAngle = (360 / n) * targetIdx - 90;
    // 瓶子要让 pointer 指向 target，需要旋转 -targetAngle（让任务卡"转到顶部"）
    const turns = 2 + Math.floor(Math.random() * 2);
    const finalRot = turns * 360 - targetAngle;
    bottle.style.setProperty("--sb-final", `${finalRot}deg`);
    bottle.classList.add("sb-bottle--spin");

    this.trackTimeout(() => {
      bottle.classList.remove("sb-bottle--spin");
      bottle.style.setProperty("--sb-rot", `${finalRot % 360}deg`);
      this.spinning = false;
      this.currentTask = tasks[targetIdx]!;
      this.highlightTask(targetIdx);
      this.askComplete(this.currentTask!, spinBtn);
    }, 2200);
  }

  private highlightTask(idx: number): void {
    this.root
      .querySelectorAll(".sb-card")
      .forEach((c) => c.classList.remove("sb-card--active"));
    const card = this.root.querySelector(`.sb-card[data-idx="${idx}"]`);
    card?.classList.add("sb-card--active");
  }

  private askComplete(task: Task, spinBtn: HTMLButtonElement): void {
    const ov = new Overlay({
      title: "瓶子停在这啦！",
      emoji: task.emoji,
      variant: "default",
      body: `<div style="font-size:1.4rem;font-weight:800;text-align:center;padding:6px;">${task.text}</div>`,
      primary: {
        text: "做完啦！",
        icon: "✅",
        onClick: () => {
          ov.destroy();
          this.completeOne(spinBtn);
        },
      },
      secondary: {
        text: "换一个",
        icon: "🔄",
        onClick: () => {
          ov.destroy();
          spinBtn.disabled = false;
        },
      },
    });
    ov.show();
  }

  private completeOne(spinBtn: HTMLButtonElement): void {
    const r = (this.root.querySelector(".sb-dial") as HTMLElement) ?? null;
    if (r) {
      const rect = r.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    this.resetWrongStreak();
    this.roundsDone += 1;
    const doneEl = this.root.querySelector("#sb-done");
    if (doneEl) doneEl.textContent = String(this.roundsDone);
    if (this.roundsDone >= this.roundTotal) {
      this.trackTimeout(() => this.finishClear(3), 500);
    } else {
      spinBtn.disabled = false;
    }
  }

  private injectStyle(): void {
    if (document.getElementById("sb-style")) return;
    const st = document.createElement("style");
    st.id = "sb-style";
    st.textContent = SB_CSS(getCssVar("--c-pink"), getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function SB_CSS(theme: string, accent: string): string {
  return `
.sb-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(560px,100%);}
.sb-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.sb-dial{position:relative;width:min(360px,90vw);height:min(360px,90vw);background:radial-gradient(circle at 50% 50%,#fff,${accent}44);border-radius:50%;box-shadow:var(--shadow);}
.sb-card{position:absolute;left:50%;top:50%;width:96px;transform:translate(-50%,-50%) rotate(var(--sb-angle,0deg)) translateY(calc(-1 * min(150px,38vw))) rotate(calc(-1 * var(--sb-angle,0deg)));background:#fff;border-radius:14px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;box-shadow:var(--shadow);transition:transform .2s,box-shadow .2s;}
.sb-card--active{background:linear-gradient(135deg,${theme},${accent});color:#fff;transform:translate(-50%,-50%) rotate(var(--sb-angle,0deg)) translateY(calc(-1 * min(150px,38vw))) rotate(calc(-1 * var(--sb-angle,0deg))) scale(1.12);box-shadow:0 0 0 4px ${theme};}
.sb-card-emoji{font-size:1.8rem;}
.sb-card-text{font-size:.75rem;font-weight:700;text-align:center;line-height:1.1;}
.sb-bottle{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(var(--sb-rot,0deg));width:90px;height:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;filter:drop-shadow(0 4px 8px rgba(0,0,0,.3));}
.sb-bottle-icon{font-size:3.4rem;}
.sb-bottle-pointer{font-size:1rem;margin-top:-6px;}
.sb-bottle--spin{animation:sb-spin 2.2s cubic-bezier(.2,.7,.25,1) forwards;}
@keyframes sb-spin{0%{transform:translate(-50%,-50%) rotate(0)}100%{transform:translate(-50%,-50%) rotate(var(--sb-final,720deg))}}
.sb-spin-btn{font-size:1.2rem;font-weight:800;color:#fff;background:linear-gradient(135deg,${theme},${accent});border:none;padding:14px 36px;border-radius:999px;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s;}
.sb-spin-btn:active{transform:scale(.94);}
.sb-spin-btn:disabled{opacity:.5;cursor:not-allowed;}
@media (max-width:380px){.sb-card{width:80px;}.sb-card-emoji{font-size:1.4rem;}.sb-card-text{font-size:.7rem;}.sb-bottle-icon{font-size:2.6rem;}}
`;
}

export function create(): SpinBottleGame {
  return new SpinBottleGame();
}
