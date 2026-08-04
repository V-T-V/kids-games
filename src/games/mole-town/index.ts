/* 鼹鼠洞 Mole Town —— 几个洞口，先有若干只鼹鼠探头（1秒）再躲回，
   孩子选"看到了几只"。独特点：瞬时计数 + 短时记忆。
   视觉：草地上一排洞口 + 🦫 探头。难度=鼹鼠数范围。通关=答对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

export class MoleTownGame extends BaseGame {
  constructor() {
    super("mole-town");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private busy = false;
  /** 本关正确答案（出现几只） */
  private answer = 0;
  /** 洞口总数 */
  private holeCount = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* trackTimeout 自动清理 */
  }

  private holes(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 5
        : 6;
  }
  /** 答案最大值（不超过洞数） */
  private maxMoles(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = true;
    this.holeCount = this.holes();
    // 答案至少 1 只，最多 min(maxMoles, holeCount)
    const top = Math.min(this.maxMoles(), this.holeCount);
    this.answer = randInt(1, top);
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "mt2-wrap";

    const task = document.createElement("div");
    task.className = "mt2-task";
    task.id = "mt2-task";
    task.textContent = "盯紧有几只鼹鼠探头！";
    wrap.appendChild(task);

    // 草地 + 洞口
    const ground = document.createElement("div");
    ground.className = "mt2-ground";
    for (let i = 0; i < this.holeCount; i++) {
      const hole = document.createElement("div");
      hole.className = "mt2-hole";
      const mole = document.createElement("div");
      mole.className = "mt2-mole";
      mole.textContent = "🦫";
      hole.appendChild(mole);
      ground.appendChild(hole);
    }
    wrap.appendChild(ground);
    this.root.appendChild(wrap);

    // 选出 answer 个洞口让鼹鼠探头
    const idxs = shuffle([...Array(this.holeCount).keys()]).slice(
      0,
      this.answer,
    );
    const moleEls = this.root.querySelectorAll<HTMLElement>(".mt2-mole");
    this.trackTimeout(() => {
      idxs.forEach((i) => moleEls[i]?.classList.add("mt2-mole--up"));
      // 1秒后全部躲回，然后出选项
      this.trackTimeout(() => {
        moleEls.forEach((m) => m.classList.remove("mt2-mole--up"));
        this.trackTimeout(() => this.showChoices(), 450);
      }, 1000);
    }, 500);
  }

  private showChoices(): void {
    const task = this.root.querySelector("#mt2-task");
    if (task) task.textContent = "你看到了几只鼹鼠？";
    // 生成 1..maxMoles 的选项，保证答案在其中
    const choices = document.createElement("div");
    choices.className = "mt2-choices";
    const max = Math.min(this.maxMoles(), this.holeCount);
    for (let n = 1; n <= max; n++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mt2-choice";
      b.textContent = String(n);
      b.addEventListener("click", () => this.pick(n, b));
      choices.appendChild(b);
    }
    this.root.querySelector(".mt2-wrap")?.appendChild(choices);
    this.busy = false;
  }

  private pick(n: number, btn: HTMLButtonElement): void {
    if (this.busy) return;
    this.busy = true;
    if (n === this.answer) {
      btn.classList.add("mt2-choice--ok");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("mt2-choice--no");
      // 揭示正确答案
      this.root
        .querySelectorAll<HTMLButtonElement>(".mt2-choice")
        .forEach((b) => {
          if (Number(b.textContent) === this.answer)
            b.classList.add("mt2-choice--ok");
        });
      const paused = this.onWrong();
      if (paused) {
        this.trackTimeout(() => this.showRest(), 1200);
      }
      this.trackTimeout(() => this.startRound(), 1500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再仔细数数洞里有几只鼹鼠～",
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
    if (document.getElementById("mt2-style")) return;
    const st = document.createElement("style");
    st.id = "mt2-style";
    st.textContent = MT2_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function MT2_CSS(theme: string): string {
  return `
.mt2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.mt2-task{font-size:1.15rem;font-weight:800;text-align:center;min-height:1.6em;}
.mt2-ground{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 18px;padding:24px 16px;background:linear-gradient(180deg,#a8d8a8,#7cc47c);border-radius:24px;box-shadow:var(--shadow);width:100%;}
.mt2-hole{position:relative;width:92px;height:74px;background:radial-gradient(ellipse at 50% 35%,#5a3a1a,#3a2410);border-radius:50%;box-shadow:inset 0 6px 10px rgba(0,0,0,.5);overflow:hidden;}
/* 洞口外圈泥土 */
.mt2-hole::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:106px;height:30px;background:${theme};border-radius:50%;opacity:.25;z-index:0;}
.mt2-mole{position:absolute;left:50%;bottom:-90%;transform:translateX(-50%);font-size:3rem;transition:bottom .25s cubic-bezier(.4,1.6,.5,1);z-index:1;filter:drop-shadow(0 3px 3px rgba(0,0,0,.3));}
.mt2-mole--up{bottom:6px;}
.mt2-choices{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;}
.mt2-choice{width:64px;height:64px;border-radius:50%;border:none;font-size:1.6rem;font-weight:800;color:#fff;background:radial-gradient(circle at 35% 30%,#fff6,${theme});box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;}
.mt2-choice:active{transform:scale(.9);}
.mt2-choice--ok{background:radial-gradient(circle at 35% 30%,#fff6,#6bcf7f);animation:mt2-pop .3s;}
.mt2-choice--no{background:radial-gradient(circle at 35% 30%,#fff6,#ff6348);animation:mt2-pop .3s;}
@keyframes mt2-pop{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
@media (max-width:380px){.mt2-hole{width:76px;height:60px;}.mt2-mole{font-size:2.4rem;}}
`;
}

export function create(): MoleTownGame {
  return new MoleTownGame();
}
