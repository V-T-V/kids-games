/* 过马路 Cross Road —— 红绿灯场景，根据灯的颜色判断"停"还是"走"。
   独特点：交通安全规则判断 + 反应力。视觉：马路 + 红绿灯 + 行人。
   巧思：每轮随机亮红/绿灯，孩子点对应按钮（红灯点"停"🛑，绿灯点"走"🚶）；
         点对前进一段，到达对面通关；点错退回一段。前缀 crmr-（避免 crs-/cr2- 冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar } from "../../lobby/util.ts";

type Light = "red" | "green";

export class CrossRoadGame extends BaseGame {
  constructor() {
    super("cross-road");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private curLight: Light = "red";
  private answered = false;
  private steps = 0;
  private goal = 3;
  private lightEl!: HTMLDivElement;
  private personEl!: HTMLDivElement;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.answered = false;
    this.steps = 0;
    this.goal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "crmr-wrap";
    const task = document.createElement("div");
    task.className = "crmr-task";
    task.innerHTML = `看<b>红绿灯</b>过马路～红灯点"停"，绿灯点"走"（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "crmr-scene";

    // 红绿灯柱
    const pole = document.createElement("div");
    pole.className = "crmr-pole";
    this.lightEl = document.createElement("div");
    this.lightEl.className = "crmr-light crmr-light--red";
    this.lightEl.innerHTML = `<span class="crmr-light__on">🔴</span><span class="crmr-light__off">🟢</span>`;
    pole.appendChild(this.lightEl);
    scene.appendChild(pole);

    // 马路
    const road = document.createElement("div");
    road.className = "crmr-road";
    // 起点和终点标记
    const start = document.createElement("div");
    start.className = "crmr-side crmr-side--start";
    start.textContent = "起点";
    const end = document.createElement("div");
    end.className = "crmr-side crmr-side--end";
    end.textContent = "对面";
    this.personEl = document.createElement("div");
    this.personEl.className = "crmr-person";
    this.personEl.textContent = "🚶";
    road.appendChild(start);
    road.appendChild(this.personEl);
    road.appendChild(end);
    scene.appendChild(road);
    wrap.appendChild(scene);

    // 按钮
    const controls = document.createElement("div");
    controls.className = "crmr-controls";
    const stopBtn = document.createElement("button");
    stopBtn.type = "button";
    stopBtn.className = "crmr-btn crmr-btn--stop";
    stopBtn.innerHTML = "🛑<span>停</span>";
    stopBtn.addEventListener("click", () => this.answer("red", stopBtn));
    const goBtn = document.createElement("button");
    goBtn.type = "button";
    goBtn.className = "crmr-btn crmr-btn--go";
    goBtn.innerHTML = "🚶<span>走</span>";
    goBtn.addEventListener("click", () => this.answer("green", goBtn));
    controls.appendChild(stopBtn);
    controls.appendChild(goBtn);
    wrap.appendChild(controls);
    this.root.appendChild(wrap);

    this.updatePerson();
    this.nextLight();
  }

  private nextLight(): void {
    this.answered = false;
    // 随机亮红或绿灯
    this.curLight = Math.random() < 0.5 ? "red" : "green";
    if (this.curLight === "red") {
      this.lightEl.className = "crmr-light crmr-light--red";
      this.lightEl.innerHTML = `<span class="crmr-light__on">🔴</span><span class="crmr-light__off">🟢</span>`;
    } else {
      this.lightEl.className = "crmr-light crmr-light--green";
      this.lightEl.innerHTML = `<span class="crmr-light__off">🔴</span><span class="crmr-light__on">🟢</span>`;
    }
  }

  private answer(light: Light, btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    if (light === this.curLight) {
      if (light === "green") {
        // 走：前进
        this.steps += 1;
        sfxPop();
        const r = btn.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
        this.updatePerson();
        if (this.steps >= this.goal) {
          // 过完马路
          this.roundsDone += 1;
          this.reportProgress(this.roundsDone, this.roundTotal);
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal) {
              this.finishClear(starsByAccuracy(this.wrongCount));
            } else {
              this.startRound();
            }
          }, 800);
          return;
        }
      } else {
        // 红灯点停：正确等待，给一次小反馈
        sfxPop();
        const r = btn.getBoundingClientRect();
        this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
        this.resetWrongStreak();
      }
      this.trackTimeout(() => this.nextLight(), 700);
    } else {
      // 判断错：退回一段（不低于 0）
      btn.classList.add("crmr-btn--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("crmr-btn--wrong"), 450);
      if (paused) this.showRest();
      else {
        this.steps = Math.max(0, this.steps - 1);
        this.updatePerson();
        this.trackTimeout(() => this.nextLight(), 700);
      }
    }
  }

  private updatePerson(): void {
    const pct = (this.steps / this.goal) * 100;
    this.personEl.style.left = `${pct}%`;
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🚦",
      variant: "rest",
      body: "<b>红灯</b>要停下来等，<b>绿灯</b>才能走～",
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
    if (document.getElementById("crmr-style")) return;
    const st = document.createElement("style");
    st.id = "crmr-style";
    st.textContent = CRM_R_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function CRM_R_CSS(_theme: string): string {
  return `
.crmr-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(460px,100%);}
.crmr-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.4;}
.crmr-scene{position:relative;width:min(400px,90vw);height:240px;display:flex;align-items:flex-start;justify-content:center;background:linear-gradient(180deg,#b3e5fc 0%,#b3e5fc 60%,#666 60%);border-radius:18px;box-shadow:var(--shadow);overflow:hidden;}
.crmr-pole{position:absolute;left:16px;top:10px;display:flex;flex-direction:column;align-items:center;}
.crmr-light{width:54px;height:96px;background:#222;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:space-around;padding:6px 0;box-shadow:0 4px 8px rgba(0,0,0,.4);}
.crmr-light__on{font-size:1.8rem;filter:drop-shadow(0 0 8px currentColor);opacity:1;}
.crmr-light__off{font-size:1.5rem;opacity:.25;}
.crmr-light--red .crmr-light__on{color:#ff5252;}
.crmr-light--green .crmr-light__on{color:#6bcf7f;}
.crmr-road{position:absolute;left:0;right:0;bottom:0;height:90px;background:repeating-linear-gradient(90deg,#3a3a3a 0 40px,#fff 40px 56px,#3a3a3a 56px 96px);display:flex;align-items:center;justify-content:space-between;padding:0 8px;}
.crmr-side{background:#8d6e63;color:#fff;padding:4px 8px;border-radius:8px;font-size:.7rem;font-weight:800;writing-mode:vertical-rl;}
.crmr-person{position:absolute;left:0;bottom:8px;font-size:2rem;transform:translateX(-50%);transition:left .4s ease;z-index:3;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));}
.crmr-controls{display:flex;gap:24px;}
.crmr-btn{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:1.6rem;font-weight:800;width:100px;height:84px;border:none;border-radius:18px;background:#fff;box-shadow:var(--shadow);cursor:pointer;user-select:none;touch-action:none;color:var(--ink);transition:transform .08s;}
.crmr-btn:active{transform:scale(.92);}
.crmr-btn span{font-size:.95rem;}
.crmr-btn--stop:active{background:#ffe0e0;}
.crmr-btn--go:active{background:#e0ffe0;}
.crmr-btn--wrong{animation:crmr-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes crmr-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): CrossRoadGame {
  return new CrossRoadGame();
}
