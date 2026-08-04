/* 魔药熬制 Potion Brew —— 展示一份配方（先加月亮草 → 再加龙鳞 → 最后搅拌），
   步骤卡片被打乱顺序摆在桌上，孩子按正确顺序一张张点。
   独特点：顺序还原。配方区按正确顺序展示带编号的步骤，下方乱序步骤卡要按序点。
   点对卡片飞入坩埚，全部完成药水变色冒泡。
   视觉：坩埚 + 冒泡药水 + 步骤卡片。难度=步骤数。通关=熬对目标轮数。
   解保证：每个步骤都有唯一编号，按编号顺序点击一定可完成。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Step {
  emoji: string;
  label: string;
  color: string;
}

/** 配方池：每条配方是一串步骤。 */
const RECIPES: Step[][] = [
  [
    { emoji: "🌿", label: "月亮草", color: "#6bcf7f" },
    { emoji: "🐉", label: "龙鳞", color: "#4d96ff" },
    { emoji: "🥄", label: "搅拌", color: "#ffd93d" },
  ],
  [
    { emoji: "🌙", label: "月光露", color: "#a55eea" },
    { emoji: "🔥", label: "凤凰羽", color: "#ff6348" },
    { emoji: "⭐", label: "星尘", color: "#ffd93d" },
    { emoji: "🥄", label: "搅拌", color: "#6bcf7f" },
  ],
  [
    { emoji: "🕷️", label: "蛛丝", color: "#3a2e4a" },
    { emoji: "🍄", label: "毒蘑菇", color: "#ff6348" },
    { emoji: "🦴", label: "骨粉", color: "#e0d8c8" },
    { emoji: "💧", label: "泉水", color: "#4d96ff" },
    { emoji: "🥄", label: "搅拌", color: "#ffd93d" },
  ],
  [
    { emoji: "🌺", label: "魔花瓣", color: "#ff6b9d" },
    { emoji: "🦋", label: "蝶翅粉", color: "#a55eea" },
    { emoji: "🌙", label: "月光", color: "#6366f1" },
    { emoji: "🔥", label: "加热", color: "#ff9f43" },
    { emoji: "🥄", label: "搅拌", color: "#6bcf7f" },
  ],
];

function pickRecipe(diff: "easy" | "medium" | "hard"): Step[] {
  if (diff === "easy") return RECIPES[0]!;
  if (diff === "medium") return shuffle([RECIPES[1]!, RECIPES[2]!])[0]!;
  return RECIPES[3]!;
}

export class PotionBrewGame extends BaseGame {
  constructor() {
    super("potion-brew");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private recipe: Step[] = [];
  private next = 0; // 下一个该点的步骤下标（0-based）

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4: this.difficulty === "medium" ? 5 : 6;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.recipe = pickRecipe(this.difficulty);
    this.next = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const wrap = document.createElement("div");
    wrap.className = "ptb-wrap";
    const task = document.createElement("div");
    task.className = "ptb-task";
    task.innerHTML = `照配方顺序，把材料加进坩埚！（第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 顶部：坩埚 + 配方序
    const top = document.createElement("div");
    top.className = "ptb-top";
    const cauldron = document.createElement("div");
    cauldron.className = "ptb-cauldron";
    cauldron.id = "ptb-cauldron";
    cauldron.innerHTML = `<div class="ptb-liquid" id="ptb-liquid"></div><div class="ptb-rim"></div><div class="ptb-bubbles" id="ptb-bubbles"></div>`;
    top.appendChild(cauldron);

    // 配方条（正确顺序展示，已完成的高亮）
    const recipeBar = document.createElement("div");
    recipeBar.className = "ptb-recipe";
    recipeBar.id = "ptb-recipe";
    this.recipe.forEach((s, i) => {
      const c = document.createElement("div");
      c.className = "ptb-step";
      c.dataset.idx = String(i);
      c.style.setProperty("--ptb-color", s.color);
      c.innerHTML = `<span class="ptb-step-n">${i + 1}</span><span class="ptb-step-emoji">${s.emoji}</span><span class="ptb-step-label">${s.label}</span>`;
      recipeBar.appendChild(c);
    });
    top.appendChild(recipeBar);
    wrap.appendChild(top);

    // 底部：打乱顺序的步骤卡
    const cards = document.createElement("div");
    cards.className = "ptb-cards";
    cards.id = "ptb-cards";
    shuffle(this.recipe.map((_, i) => i)).forEach((idx) => {
      const s = this.recipe[idx]!;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ptb-card";
      b.dataset.idx = String(idx);
      b.style.setProperty("--ptb-color", s.color);
      b.innerHTML = `<span class="ptb-card-emoji">${s.emoji}</span><span class="ptb-card-label">${s.label}</span>`;
      b.addEventListener("click", () => this.use(idx, b));
      cards.appendChild(b);
    });
    wrap.appendChild(cards);
    this.root.appendChild(wrap);
  }

  private use(idx: number, btn: HTMLButtonElement): void {
    if (btn.classList.contains("ptb-card--used")) return;
    if (idx !== this.next) {
      btn.classList.add("ptb-shake");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ptb-shake"), 400);
      if (paused) this.showRest();
      return;
    }
    // 答对
    btn.classList.add("ptb-card--used");
    sfxPop();
    const step = this.recipe[idx]!;
    // 配方条对应步骤高亮
    const stepEl = this.root.querySelector<HTMLElement>(
      `.ptb-step[data-idx="${idx}"]`,
    );
    stepEl?.classList.add("ptb-step--done");
    // 药水变色 + 冒泡
    const liquid = this.root.querySelector<HTMLElement>("#ptb-liquid");
    if (liquid) liquid.style.background = step.color;
    this.popBubble();

    const r = btn.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.resetWrongStreak();
    this.next += 1;

    if (this.next >= this.recipe.length) {
      // 完成：药水沸腾
      const cauldron = this.root.querySelector("#ptb-cauldron");
      cauldron?.classList.add("ptb-cauldron--boil");
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    }
  }

  private popBubble(): void {
    const layer = this.root.querySelector<HTMLElement>("#ptb-bubbles");
    if (!layer) return;
    const b = document.createElement("span");
    b.className = "ptb-bubble";
    b.style.left = `${15 + Math.random() * 70}%`;
    layer.appendChild(b);
    this.trackTimeout(() => b.remove(), 1200);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看配方条最前面那个还没亮的，就是下一个要加的～",
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
    if (document.getElementById("ptb-style")) return;
    const st = document.createElement("style");
    st.id = "ptb-style";
    st.textContent = PTB_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function PTB_CSS(_theme: string): string {
  return `
.ptb-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.ptb-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.ptb-top{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center;}
.ptb-cauldron{position:relative;width:130px;height:130px;}
.ptb-liquid{position:absolute;left:10px;right:10px;bottom:8px;height:62%;background:#6bcf7f;border-radius:0 0 50% 50%/0 0 70% 70%;box-shadow:inset 0 6px 10px rgba(255,255,255,.4);transition:background .3s;}
.ptb-rim{position:absolute;left:0;right:0;top:36px;height:14px;background:linear-gradient(#3a2e4a,#1a1320);border-radius:50%;box-shadow:var(--shadow);}
.ptb-cauldron::after{content:"";position:absolute;left:0;right:0;bottom:0;height:38%;background:linear-gradient(#3a2e4a,#1a1320);border-radius:0 0 46% 46%/0 0 70% 70%;box-shadow:var(--shadow);}
.ptb-bubbles{position:absolute;left:20px;right:20px;bottom:20px;top:50%;pointer-events:none;}
.ptb-bubble{position:absolute;bottom:0;width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,.5);animation:ptb-rise 1.2s ease-in forwards;}
@keyframes ptb-rise{0%{transform:translateY(0) scale(.5);opacity:.8}100%{transform:translateY(-50px) scale(1.2);opacity:0}}
.ptb-cauldron--boil .ptb-liquid{animation:ptb-boil .6s ease infinite;}
@keyframes ptb-boil{0%,100%{filter:brightness(1)}50%{filter:brightness(1.4) saturate(1.3)}}
.ptb-recipe{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:320px;}
.ptb-step{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.7);border:2px solid #ddd;min-width:56px;transition:all .2s;}
.ptb-step-n{font-size:.7rem;font-weight:900;color:#888;background:#eee;border-radius:999px;padding:0 6px;}
.ptb-step-emoji{font-size:1.6rem;line-height:1;}
.ptb-step-label{font-size:.65rem;color:#555;font-weight:700;}
.ptb-step--done{background:var(--ptb-color);border-color:#fff;box-shadow:0 0 10px var(--ptb-color);}
.ptb-step--done .ptb-step-n{background:#fff;color:var(--ptb-color);}
.ptb-step--done .ptb-step-label{color:#fff;}
.ptb-cards{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:14px;background:rgba(255,255,255,.65);border-radius:20px;box-shadow:var(--shadow);}
.ptb-card{display:flex;flex-direction:column;align-items:center;gap:4px;width:78px;padding:10px 6px;border-radius:16px;border:none;background:linear-gradient(160deg,#fff,#fff6);box-shadow:var(--shadow);cursor:pointer;transition:transform .12s,opacity .3s;border-top:5px solid var(--ptb-color);}
.ptb-card:active{transform:scale(.92);}
.ptb-card-emoji{font-size:2rem;line-height:1;}
.ptb-card-label{font-size:.8rem;font-weight:800;color:#444;}
.ptb-card--used{opacity:0;transform:scale(.4) translateY(-40px);pointer-events:none;}
.ptb-shake{animation:ptb-shake .4s ease;}
@keyframes ptb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): PotionBrewGame {
  return new PotionBrewGame();
}
