/* 蛋盒计数 Egg Carton —— 数一数蛋盒里有几颗蛋，选出正确的数字。
   独特点：点数训练（one-to-one correspondence）。蛋盒随机装蛋，孩子数
   清楚后从数字选项中选出对应数量。难度=格子数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

export class EggCartonGame extends BaseGame {
  constructor() {
    super("egg-carton");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private currentAnswer = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  /** 蛋盒列数：easy=2x3(6格), medium=2x4(8格), hard=2x6(12格)。 */
  private cols(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 6;
  }
  private optionCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const cols = this.cols();
    const total = cols * 2;
    // 至少 1 颗，最多 total-1 颗（避免全空/全满太简单）
    const eggs = randInt(1, total - 1);
    this.currentAnswer = eggs;

    // 随机决定哪些格子有蛋
    const slots: boolean[] = Array.from({ length: total }, (_, i) => i < eggs);
    const shuffled = shuffle(slots);

    const wrap = document.createElement("div");
    wrap.className = "ec2-wrap";

    const task = document.createElement("div");
    task.className = "ec2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 数一数蛋盒里有几颗 <b>🥚</b>？`;
    wrap.appendChild(task);

    // 蛋盒
    const carton = document.createElement("div");
    carton.className = "ec2-carton";
    carton.style.setProperty("--cols", String(cols));
    shuffled.forEach((has) => {
      const slot = document.createElement("div");
      slot.className = "ec2-slot";
      if (has) {
        const egg = document.createElement("div");
        egg.className = "ec2-egg";
        egg.textContent = "🥚";
        slot.appendChild(egg);
      }
      carton.appendChild(slot);
    });
    wrap.appendChild(carton);

    // 数字选项：保证正确答案在内，其余为相邻数字（合理的干扰）
    const optsSet = new Set<number>([eggs]);
    let guard = 0;
    while (optsSet.size < this.optionCount() && guard < 50) {
      guard++;
      const delta = randInt(1, 3) * (Math.random() < 0.5 ? -1 : 1);
      const v = eggs + delta;
      if (v >= 0 && v <= total) optsSet.add(v);
    }
    // 兜底补足
    let fill = 0;
    while (optsSet.size < this.optionCount() && fill <= total) {
      optsSet.add(fill);
      fill++;
    }
    const opts = shuffle([...optsSet]);

    const optsRow = document.createElement("div");
    optsRow.className = "ec2-options";
    opts.forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ec2-option";
      b.textContent = String(v);
      b.addEventListener("click", () => this.pick(b, v === eggs, carton));
      optsRow.appendChild(b);
    });
    wrap.appendChild(optsRow);

    this.root.appendChild(wrap);
  }

  private pick(
    btn: HTMLButtonElement,
    correct: boolean,
    carton: HTMLElement,
  ): void {
    if (btn.classList.contains("ec2-option--used")) return;
    if (correct) {
      btn.classList.add("ec2-option--correct");
      btn.classList.add("ec2-option--used");
      sfxPop();
      carton.classList.add("ec2-carton--happy");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("ec2-option--wrong");
      this.trackTimeout(() => btn.classList.remove("ec2-option--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `用小手指一个一个点着数：1、2、3……数清楚再选数字～`,
      primary: { text: "继续", icon: "🥚", onClick: () => ov.destroy() },
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
    if (document.getElementById("ec2-style")) return;
    const st = document.createElement("style");
    st.id = "ec2-style";
    st.textContent = EC2_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function EC2_CSS(theme: string): string {
  return `
.ec2-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(520px,100%);}
.ec2-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.ec2-carton{display:grid;grid-template-columns:repeat(var(--cols,3),1fr);gap:8px;padding:16px;background:linear-gradient(180deg,#e8d8b8,#cdb888);border-radius:18px;box-shadow:var(--shadow),inset 0 0 0 4px rgba(255,255,255,.3);transition:transform .25s;}
.ec2-carton--happy{animation:ec2-cheer .6s ease;}
@keyframes ec2-cheer{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
.ec2-slot{width:72px;height:72px;border-radius:50%;background:radial-gradient(circle at 50% 60%,#fff,#e8dcc0);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 4px 8px rgba(0,0,0,.18);}
.ec2-egg{font-size:2.2rem;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));animation:ec2-wobble 3s ease-in-out infinite;}
@keyframes ec2-wobble{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
.ec2-options{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
.ec2-option{width:72px;height:72px;border-radius:18px;border:none;cursor:pointer;font-size:2rem;font-weight:900;color:#fff;background:linear-gradient(180deg,color-mix(in srgb,${theme} 80%,#fff),${theme});box-shadow:inset 0 -4px 6px rgba(0,0,0,.18),0 4px 8px rgba(0,0,0,.15);transition:transform .12s;}
.ec2-option:active{transform:scale(.92);}
.ec2-option--correct{background:linear-gradient(180deg,#9ee5a8,#6bcf7f)!important;animation:ec2-pop .5s ease;}
.ec2-option--wrong{background:linear-gradient(180deg,#ffb0a0,#ff7a5f)!important;animation:ec2-shake .4s ease;}
.ec2-option--used{pointer-events:none;}
@keyframes ec2-pop{0%{transform:scale(1)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes ec2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.ec2-slot{width:56px;height:56px;}.ec2-egg{font-size:1.7rem;}.ec2-option{width:58px;height:58px;font-size:1.6rem;}}
`;
}

export function create(): EggCartonGame {
  return new EggCartonGame();
}
