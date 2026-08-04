/* 红绿灯指挥 Color Traffic —— 绿灯时点车让车走，红灯时车要停。
   独特点：CSS 红绿灯会随机切换红/绿，孩子要判断此刻能走的车。
   巧思：每轮多辆车依次出发，点错（红灯放行）会触发急刹车。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

type Light = "red" | "green";

interface Car {
  el: HTMLButtonElement;
  dispatched: boolean;
}

const CAR_EMOJIS = ["🚗", "🚕", "🚙", "🚌", "🚐", "🚎", "🚛", "🚑"];

export class ColorTrafficGame extends BaseGame {
  constructor() {
    super("color-traffic");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private light: Light = "red";
  private cars: Car[] = [];
  private dispatchedCount = 0;
  private lightTimer = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* trackTimeout 会自动清理 */
  }

  private carCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.cars = [];
    this.dispatchedCount = 0;
    this.light = sample(["red", "green"] as const);

    const wrap = document.createElement("div");
    wrap.className = "ct-wrap";

    const task = document.createElement("div");
    task.className = "ct-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 看红绿灯：<b>绿灯</b>才能让车走，<b>红灯</b>别点！`;
    wrap.appendChild(task);

    // 红绿灯
    const light = document.createElement("div");
    light.className = "ct-light";
    light.innerHTML = `
      <div class="ct-light-housing">
        <span class="ct-bulb ct-red">🔴</span>
        <span class="ct-bulb ct-green">🟢</span>
      </div>
      <div class="ct-light-pole"></div>
    `;
    wrap.appendChild(light);
    this.updateLightClass(light);

    // 路面 + 车队
    const road = document.createElement("div");
    road.className = "ct-road";
    const lane = document.createElement("div");
    lane.className = "ct-lane";
    const colors = [
      "#ff6b9d",
      "#4d96ff",
      "#6bcf7f",
      "#ffd93d",
      "#ff9f43",
      "#a55eea",
    ];
    for (let i = 0; i < this.carCount(); i++) {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "ct-car";
      c.style.setProperty("--ct-car-color", colors[i % colors.length]!);
      c.innerHTML = `<span class="ct-car-emoji">${sample(CAR_EMOJIS)}</span>`;
      lane.appendChild(c);
      const car: Car = {
        el: c,
        dispatched: false,
      };
      c.addEventListener("click", () => this.tryDispatch(car));
      this.cars.push(car);
    }
    road.appendChild(lane);
    wrap.appendChild(road);

    this.root.appendChild(wrap);

    // 启动信号灯切换循环
    this.scheduleLightToggle(light);
  }

  private scheduleLightToggle(light: HTMLElement): void {
    const interval = randInt(1800, 2600);
    this.lightTimer = this.trackTimeout(() => {
      this.light = this.light === "red" ? "green" : "red";
      this.updateLightClass(light);
      this.scheduleLightToggle(light);
    }, interval);
  }

  private updateLightClass(light: HTMLElement): void {
    light.classList.toggle("ct-light--green", this.light === "green");
    light.classList.toggle("ct-light--red", this.light === "red");
  }

  private tryDispatch(car: Car): void {
    if (car.dispatched) return;
    // 当前是绿灯 → 正确放行；红灯 → 错误（车冲出去急刹）
    if (this.light === "green") {
      sfxPop();
      car.dispatched = true;
      car.el.classList.add("ct-car--go");
      const r = car.el.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.dispatchedCount += 1;
      if (this.dispatchedCount >= this.cars.length) {
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
      // 红灯放行：急刹
      car.el.classList.add("ct-car--brake", "ct-shake");
      this.trackTimeout(
        () => car.el.classList.remove("ct-car--brake", "ct-shake"),
        600,
      );
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "红灯亮着呢，车要先停下来等一等哦～",
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
    if (document.getElementById("ct-style")) return;
    const st = document.createElement("style");
    st.id = "ct-style";
    st.textContent = CT_CSS(getCssVar("--c-red"), getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function CT_CSS(red: string, green: string): string {
  return `
.ct-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.ct-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ct-light{display:flex;flex-direction:column;align-items:center;gap:0;}
.ct-light-housing{display:flex;flex-direction:column;gap:6px;background:#2d2d2d;padding:10px 12px;border-radius:18px;box-shadow:var(--shadow);}
.ct-bulb{font-size:1.6rem;opacity:.25;transition:all .2s;}
.ct-light--red .ct-red{opacity:1;filter:drop-shadow(0 0 12px ${red});transform:scale(1.1);}
.ct-light--green .ct-green{opacity:1;filter:drop-shadow(0 0 12px ${green});transform:scale(1.1);}
.ct-light-pole{width:14px;height:36px;background:#444;border-radius:0 0 6px 6px;}
.ct-road{width:100%;background:repeating-linear-gradient(90deg,#3a3a3a 0 24px,#4a4a4a 24px 30px);border-radius:18px;padding:14px 8px;box-shadow:inset 0 0 20px rgba(0,0,0,.3);}
.ct-lane{display:flex;gap:10px;align-items:center;min-height:64px;padding:0 6px;}
.ct-car{flex:0 0 auto;width:64px;height:54px;border:none;cursor:pointer;background:transparent;border-radius:12px;display:flex;align-items:center;justify-content:center;transition:transform .3s,margin .5s;}
.ct-car:active{transform:scale(.94);}
.ct-car-emoji{font-size:2.4rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));display:inline-block;}
.ct-car--go{animation:ct-go 1s ease forwards;}
@keyframes ct-go{0%{transform:translateX(0)}100%{transform:translateX(120vw) rotate(8deg);opacity:0;}}
.ct-car--brake{outline:3px dashed ${red};outline-offset:2px;}
.ct-shake{animation:ct-shake .5s ease;}
@keyframes ct-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.ct-car{width:54px;height:48px;}.ct-car-emoji{font-size:2rem;}}
`;
}

export function create(): ColorTrafficGame {
  return new ColorTrafficGame();
}
