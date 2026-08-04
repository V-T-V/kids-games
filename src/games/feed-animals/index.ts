/* 喂小动物 Feed Animals —— 根据动物食性点对的食物喂它。
   独特点：动物张嘴吃东西的吞咽动画 + 食性认知（猫鱼/狗骨头/兔胡萝卜/猴香蕉）。
   巧思：干扰食物数随难度增加，答对动物开心摇摆，答错摇头。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Animal {
  emoji: string;
  name: string;
  food: string;
  foodEmoji: string;
  call: string;
}

const ANIMALS: Animal[] = [
  { emoji: "🐱", name: "小猫", food: "鱼", foodEmoji: "🐟", call: "喵～" },
  { emoji: "🐶", name: "小狗", food: "骨头", foodEmoji: "🦴", call: "汪～" },
  {
    emoji: "🐰",
    name: "小兔",
    food: "胡萝卜",
    foodEmoji: "🥕",
    call: "吱吱～",
  },
  { emoji: "🐵", name: "小猴", food: "香蕉", foodEmoji: "🍌", call: "吱吱～" },
];

const DISTRACTORS = ["🍎", "🍬", "🍪", "🍩", "🍔", "🌮", "🌽", "🍦"];

export class FeedAnimalsGame extends BaseGame {
  constructor() {
    super("feed-animals");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private currentAnimal: Animal | null = null;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private distractorCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const animal = sample(ANIMALS);
    this.currentAnimal = animal;

    // 构造食物按钮：1 个正确 + N 个干扰
    const foods: { emoji: string; correct: boolean }[] = [
      { emoji: animal.foodEmoji, correct: true },
    ];
    const distract = shuffle(DISTRACTORS.filter((f) => f !== animal.foodEmoji))
      .slice(0, this.distractorCount())
      .map((f) => ({ emoji: f, correct: false }));
    foods.push(...distract);

    const wrap = document.createElement("div");
    wrap.className = "fa-wrap";

    const task = document.createElement("div");
    task.className = "fa-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 给 <b>${animal.name}</b> 喂它爱吃的`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "fa-stage";
    const bowl = document.createElement("div");
    bowl.className = "fa-bowl";
    bowl.innerHTML = `
      <div class="fa-animal">${animal.emoji}</div>
      <div class="fa-plate">🍽️</div>
    `;
    stage.appendChild(bowl);
    wrap.appendChild(stage);

    const foodRow = document.createElement("div");
    foodRow.className = "fa-foods";
    shuffle(foods).forEach((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fa-food";
      b.textContent = f.emoji;
      b.addEventListener("click", () => this.feed(b, f.correct, bowl));
      foodRow.appendChild(b);
    });
    wrap.appendChild(foodRow);

    this.root.appendChild(wrap);
  }

  private feed(
    btn: HTMLButtonElement,
    correct: boolean,
    bowl: HTMLElement,
  ): void {
    if (btn.classList.contains("fa-food--used")) return;
    btn.classList.add("fa-food--used");
    btn.disabled = true;
    const animalEl = bowl.querySelector(".fa-animal") as HTMLElement | null;
    if (correct) {
      sfxPop();
      animalEl?.classList.add("fa-animal--eat");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        animalEl?.classList.remove("fa-animal--eat");
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      animalEl?.classList.add("fa-animal--shake");
      this.trackTimeout(
        () => animalEl?.classList.remove("fa-animal--shake"),
        500,
      );
      const paused = this.onWrong();
      if (paused) this.showRest();
      // 错的食物恢复可点
      this.trackTimeout(() => {
        btn.classList.remove("fa-food--used");
        btn.disabled = false;
      }, 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想这个小动物爱吃什么呀～",
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
    if (document.getElementById("fa-style")) return;
    const st = document.createElement("style");
    st.id = "fa-style";
    st.textContent = FA_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function FA_CSS(theme: string): string {
  return `
.fa-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.fa-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.fa-stage{display:flex;flex-direction:column;align-items:center;gap:4px;}
.fa-bowl{display:flex;flex-direction:column;align-items:center;gap:10px;}
.fa-animal{font-size:6.5rem;line-height:1;filter:drop-shadow(0 8px 10px rgba(0,0,0,.2));transition:transform .2s;}
.fa-animal--eat{animation:fa-eat .9s ease;}
@keyframes fa-eat{0%,100%{transform:scale(1)}20%{transform:scale(1.15) rotate(-5deg)}40%{transform:scale(1.05) rotate(5deg)}60%{transform:scale(1.12) rotate(-3deg)}}
.fa-animal--shake{animation:fa-shake .5s ease;}
@keyframes fa-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg)}75%{transform:rotate(10deg)}}
.fa-plate{font-size:2.4rem;opacity:.8;}
.fa-foods{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:18px;background:rgba(255,255,255,.55);border-radius:22px;box-shadow:var(--shadow);max-width:420px;}
.fa-food{width:78px;height:78px;border-radius:50%;border:none;background:radial-gradient(circle at 35% 30%,#fff6,${theme});font-size:2.6rem;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:inset 0 -4px 6px rgba(0,0,0,.15),0 4px 8px rgba(0,0,0,.15);transition:transform .12s;}
.fa-food:active{transform:scale(.88);}
.fa-food--used{transform:scale(.82);opacity:.4;pointer-events:none;}
@media (max-width:380px){.fa-animal{font-size:5rem;}.fa-food{width:64px;height:64px;font-size:2.1rem;}}
`;
}

export function create(): FeedAnimalsGame {
  return new FeedAnimalsGame();
}
