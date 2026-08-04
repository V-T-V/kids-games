/* 色怪饿了 Feed Monster Color —— 怪兽只吃特定颜色的食物。
   独特点：怪兽会说话"我只吃红色的！"，喂对变大、喂错吐出来。
   巧思：干扰色数随难度增加，颜色相近度提高。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface ColorFood {
  key: string;
  name: string;
  hex: string;
}

const COLORS: ColorFood[] = [
  { key: "red", name: "红色", hex: "#ff5a5a" },
  { key: "yellow", name: "黄色", hex: "#ffd93d" },
  { key: "blue", name: "蓝色", hex: "#4d96ff" },
  { key: "green", name: "绿色", hex: "#6bcf7f" },
  { key: "purple", name: "紫色", hex: "#a55eea" },
  { key: "orange", name: "橙色", hex: "#ff9f43" },
];

export class FeedMonsterColorGame extends BaseGame {
  constructor() {
    super("feed-monster-color");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private target: ColorFood | null = null;
  private fedCount = 0;
  private needFeed = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private foodCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 5
        : 6;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.fedCount = 0;
    // 本轮目标色
    this.target = sample(COLORS);
    this.needFeed = this.difficulty === "easy" ? 2 : 3;

    // 食物集合：包含 needFeed 个目标色 + 干扰色，保证有足够目标色可喂
    const targetFoods = Array.from(
      { length: this.needFeed },
      () => this.target!,
    );
    const pool = shuffle(
      COLORS.filter((c) => c.key !== this.target!.key),
    ).slice(0, this.foodCount() - this.needFeed);
    const foods = shuffle([...targetFoods, ...pool]);

    const wrap = document.createElement("div");
    wrap.className = "fmc-wrap";

    const task = document.createElement("div");
    task.className = "fmc-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 已喂对 <b id="fmc-fed">0</b>/${this.needFeed}`;
    wrap.appendChild(task);

    // 怪兽
    const stage = document.createElement("div");
    stage.className = "fmc-stage";
    const monster = document.createElement("div");
    monster.className = "fmc-monster";
    monster.style.setProperty("--fmc-scale", "1");
    monster.innerHTML = `
      <div class="fmc-bubble">我只吃<b style="color:${this.target!.hex}">${this.target!.name}</b>！</div>
      <div class="fmc-face">👾</div>
      <div class="fmc-mouth">👅</div>
    `;
    stage.appendChild(monster);
    wrap.appendChild(stage);

    // 食物
    const foodRow = document.createElement("div");
    foodRow.className = "fmc-foods";
    for (const f of foods) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fmc-food";
      b.style.setProperty("--fmc-color", f.hex);
      b.dataset.key = f.key;
      b.addEventListener("click", () => this.feed(b, f, monster));
      foodRow.appendChild(b);
    }
    wrap.appendChild(foodRow);

    this.root.appendChild(wrap);
  }

  private feed(
    btn: HTMLButtonElement,
    f: ColorFood,
    monster: HTMLElement,
  ): void {
    if (btn.classList.contains("fmc-food--used")) return;
    const correct = this.target !== null && f.key === this.target.key;
    if (correct) {
      sfxPop();
      btn.classList.add("fmc-food--used");
      btn.disabled = true;
      monster.classList.add("fmc-monster--eat");
      // 怪兽长大一点
      const cur = parseFloat(
        monster.style.getPropertyValue("--fmc-scale") ?? "1",
      );
      monster.style.setProperty("--fmc-scale", String(cur + 0.08));
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.fedCount += 1;
      const fedEl = this.root.querySelector("#fmc-fed");
      if (fedEl) fedEl.textContent = String(this.fedCount);
      this.trackTimeout(
        () => monster.classList.remove("fmc-monster--eat"),
        700,
      );
      if (this.fedCount >= this.needFeed) {
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
      // 喂错：吐出来
      btn.classList.add("fmc-food--spit", "fmc-shake");
      monster.classList.add("fmc-monster--spit");
      this.trackTimeout(() => {
        btn.classList.remove("fmc-food--spit", "fmc-shake");
        monster.classList.remove("fmc-monster--spit");
      }, 600);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再看看怪兽说的话，它只吃一种颜色哦～",
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
    if (document.getElementById("fmc-style")) return;
    const st = document.createElement("style");
    st.id = "fmc-style";
    st.textContent = FM_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function FM_CSS(theme: string): string {
  return `
.fmc-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.fmc-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.fmc-stage{position:relative;display:flex;flex-direction:column;align-items:center;}
.fmc-bubble{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#fff;padding:8px 16px;border-radius:18px;font-weight:800;font-size:1rem;white-space:nowrap;box-shadow:var(--shadow);}
.fmc-bubble::after{content:'';position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);border:8px solid transparent;border-top-color:#fff;}
.fmc-monster{position:relative;transform:scale(var(--fmc-scale,1));transform-origin:bottom center;transition:transform .3s;}
.fmc-face{font-size:6rem;line-height:1;filter:drop-shadow(0 6px 8px rgba(0,0,0,.25));}
.fmc-mouth{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);font-size:1.6rem;}
.fmc-monster--eat .fmc-face{animation:fmc-eat .7s ease;}
@keyframes fmc-eat{0%,100%{transform:scale(1)}30%{transform:scale(1.15) rotate(-4deg)}60%{transform:scale(1.08) rotate(4deg)}}
.fmc-monster--spit .fmc-face{animation:fmc-spit .6s ease;}
@keyframes fmc-spit{0%,100%{transform:translateY(0) rotate(0)}30%{transform:translateY(-6px) rotate(-8deg)}60%{transform:translateY(2px) rotate(8deg)}}
.fmc-foods{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:18px;background:rgba(255,255,255,.55);border-radius:22px;box-shadow:var(--shadow);max-width:440px;}
.fmc-food{width:72px;height:72px;border-radius:50%;border:none;background:radial-gradient(circle at 35% 30%,#fff8,var(--fmc-color,${theme}));cursor:pointer;box-shadow:inset 0 -4px 6px rgba(0,0,0,.18),0 4px 8px rgba(0,0,0,.15);transition:transform .12s;}
.fmc-food:active{transform:scale(.88);}
.fmc-food--used{transform:scale(.3);opacity:0;pointer-events:none;}
.fmc-food--spit{animation:fmc-spit-out .6s ease;}
@keyframes fmc-spit-out{0%{transform:translateY(0) scale(1)}40%{transform:translateY(-40px) scale(1.1)}100%{transform:translateY(0) scale(1)}}
.fmc-shake{animation:fmc-shake .5s ease;}
@keyframes fmc-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
@media (max-width:380px){.fmc-face{font-size:5rem;}.fmc-food{width:60px;height:60px;}.fmc-bubble{font-size:.9rem;}}
`;
}

export function create(): FeedMonsterColorGame {
  return new FeedMonsterColorGame();
}
