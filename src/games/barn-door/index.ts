/* 谷仓门 Barn Door —— 几扇不同颜色的谷仓门，题目"打开红色的门"，
   孩子点对应颜色门，门打开露出小动物。
   独特点：颜色识别 + 门开合动画 + 随机动物惊喜，每次开门都有不同的"住客"。
   视觉：三角屋顶的谷仓 + 多扇彩色门 + 门内小动物 emoji。
   难度=门数（3/4/5）。通关=开对目标轮数。前缀 bd2-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface DoorColor {
  id: string;
  name: string;
  hex: string;
}

const COLORS: DoorColor[] = [
  { id: "red", name: "红色", hex: "#ff6348" },
  { id: "orange", name: "橙色", hex: "#ff9f43" },
  { id: "yellow", name: "黄色", hex: "#ffd93d" },
  { id: "green", name: "绿色", hex: "#6bcf7f" },
  { id: "blue", name: "蓝色", hex: "#4d96ff" },
  { id: "purple", name: "紫色", hex: "#a55eea" },
];

const ANIMALS = ["🐮", "🐷", "🐔", "🐑", "🦆", "🦙", "🐰", "🐈"];

export class BarnDoorGame extends BaseGame {
  constructor() {
    super("barn-door");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private answerColor: DoorColor = COLORS[0]!;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private doorCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    const n = this.doorCount();
    const picked = shuffle(COLORS).slice(0, n);
    this.answerColor = sample(picked);

    const wrap = document.createElement("div");
    wrap.className = "bd2-wrap";

    const task = document.createElement("div");
    task.className = "bd2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 打开 <b style="color:${this.answerColor.hex}">${this.answerColor.name}</b> 的门`;
    wrap.appendChild(task);

    const barns = document.createElement("div");
    barns.className = "bd2-barns";
    picked.forEach((c) => {
      const barn = document.createElement("button");
      barn.type = "button";
      barn.className = "bd2-barn";
      barn.style.setProperty("--bd2-color", c.hex);
      barn.dataset.id = c.id;
      barn.innerHTML = `
        <div class="bd2-barn__roof"></div>
        <div class="bd2-barn__body">
          <div class="bd2-barn__animal">${sample(ANIMALS)}</div>
          <div class="bd2-barn__door"></div>
        </div>`;
      barn.addEventListener("click", () => this.choose(barn, c));
      barns.appendChild(barn);
    });
    wrap.appendChild(barns);
    this.root.appendChild(wrap);
  }

  private choose(barn: HTMLButtonElement, c: DoorColor): void {
    if (this.locked) return;
    if (c.id === this.answerColor.id) {
      this.locked = true;
      barn.classList.add("bd2-barn--open");
      sfxPop();
      const r = barn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1100);
    } else {
      barn.classList.add("bd2-barn--shake");
      this.trackTimeout(() => barn.classList.remove("bd2-barn--shake"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🚪",
      variant: "rest",
      body: "看清楚题目要什么颜色，再点对应颜色的门哦～",
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
    if (document.getElementById("bd2-style")) return;
    const st = document.createElement("style");
    st.id = "bd2-style";
    st.textContent = BD2_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function BD2_CSS(_theme: string): string {
  return `
.bd2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(540px,100%);}
.bd2-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.bd2-barns{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:14px;background:rgba(255,255,255,.5);border-radius:22px;box-shadow:var(--shadow);}
.bd2-barn{position:relative;width:100px;height:130px;background:transparent;border:none;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;transition:transform .15s;}
.bd2-barn:hover{transform:translateY(-4px);}
.bd2-barn__roof{width:0;height:0;border-left:56px solid transparent;border-right:56px solid transparent;border-bottom:36px solid var(--bd2-color);align-self:center;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));}
.bd2-barn__body{position:relative;width:100px;height:100px;background:var(--bd2-color);border:3px solid rgba(0,0,0,.25);border-radius:8px;overflow:hidden;box-shadow:var(--shadow),inset 0 -8px 16px rgba(0,0,0,.15);}
.bd2-barn__animal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:2.6rem;opacity:0;transition:opacity .3s,transform .3s;z-index:1;}
.bd2-barn__door{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:60px;height:80px;background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.55));border:2px solid rgba(0,0,0,.4);border-radius:24px 24px 0 0;border-bottom:none;transition:transform .5s ease,opacity .5s;z-index:2;}
.bd2-barn__door::before{content:"⭕";position:absolute;left:50%;top:60%;transform:translate(-50%,-50%);font-size:1rem;color:rgba(255,255,255,.6);}
.bd2-barn--open .bd2-barn__door{transform:translateX(-50%) translateY(100%);opacity:.3;}
.bd2-barn--open .bd2-barn__animal{opacity:1;transform:translate(-50%,-60%) scale(1.1);animation:bd2-pop .6s ease;}
.bd2-barn--open{animation:bd2-bounce .5s ease;}
@keyframes bd2-bounce{0%{transform:scale(1)}40%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes bd2-pop{0%{transform:translate(-50%,-50%) scale(.3)}60%{transform:translate(-50%,-65%) scale(1.3)}100%{transform:translate(-50%,-60%) scale(1.1)}}
.bd2-barn--shake{animation:bd2-shake .5s ease;}
@keyframes bd2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.bd2-barn{width:78px;height:108px;}.bd2-barn__body{width:78px;height:80px;}.bd2-barn__roof{border-left:44px solid transparent;border-right:44px solid transparent;border-bottom:28px solid var(--bd2-color);}.bd2-barn__animal{font-size:2rem;}.bd2-barn__door{width:48px;height:64px;}}
`;
}

export function create(): BarnDoorGame {
  return new BarnDoorGame();
}
