/* 寿司大师 Sushi Master —— 显示一张配方卡（如 三文鱼→米饭→海苔），
   配料打乱展示，孩子照配方顺序依次点击把寿司卷起来。
   独特点：顺序记忆 + 卷制视觉（每点对一项，海苔向前卷一格，配料飞入卷心）。
   视觉：配方卡（带序号） + 卷帘 + 配料按钮。难度=配料数。
   通关=做对目标轮数。前缀 sm2-（与 star-map 的 smg-、shape-match 的 sm- 不冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Ingredient {
  emoji: string;
  name: string;
  color: string;
}

const INGREDIENTS: Ingredient[] = [
  { emoji: "🐟", name: "三文鱼", color: "#ff8a65" },
  { emoji: "🍚", name: "米饭", color: "#fff8e7" },
  { emoji: "🌿", name: "海苔", color: "#43a047" },
  { emoji: "🥒", name: "黄瓜", color: "#66bb6a" },
  { emoji: "🥚", name: "蛋皮", color: "#ffca28" },
  { emoji: "🥑", name: "牛油果", color: "#8bc34a" },
  { emoji: "🦐", name: "虾仁", color: "#ff6b9d" },
];

const ENCOURAGE = [
  "卷得真整齐！",
  "顺序记得真清楚！",
  "你是寿司大师！",
  "看准配方再点哦～",
];

export class SushiMasterGame extends BaseGame {
  constructor() {
    super("sushi-master");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  /** 本轮配方顺序（目标） */
  private recipe: Ingredient[] = [];
  /** 当前应点第几个 */
  private expected = 0;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  /** 难度=配料数 */
  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;
    this.expected = 0;

    // 从配料库选 count 个，确定唯一目标顺序
    this.recipe = shuffle([...INGREDIENTS]).slice(0, this.count());
    // 操作区打乱顺序（保证与目标不同更有挑战；至少打乱）
    let shown = shuffle([...this.recipe]);
    let guard = 0;
    while (guard < 8 && this.isSameOrder(shown)) {
      shown = shuffle([...this.recipe]);
      guard += 1;
    }

    const wrap = document.createElement("div");
    wrap.className = "sm2-wrap";

    // 配方卡
    const task = document.createElement("div");
    task.className = "sm2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 照配方从 1 到 ${this.recipe.length} 依次点配料卷寿司 🍣`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "sm2-card";
    card.innerHTML = `<div class="sm2-card__title">📜 配方</div>`;
    const cardList = document.createElement("div");
    cardList.className = "sm2-card__list";
    this.recipe.forEach((ing, i) => {
      const it = document.createElement("div");
      it.className = "sm2-recipe-item";
      it.innerHTML = `<span class="sm2-num">${i + 1}</span><span class="sm2-emoji">${ing.emoji}</span><span class="sm2-name">${ing.name}</span>`;
      cardList.appendChild(it);
    });
    card.appendChild(cardList);
    wrap.appendChild(card);

    // 卷帘 + 卷心
    const stage = document.createElement("div");
    stage.className = "sm2-stage";
    const mat = document.createElement("div");
    mat.className = "sm2-mat";
    const roll = document.createElement("div");
    roll.className = "sm2-roll";
    roll.id = "sm2-roll";
    roll.innerHTML = `<div class="sm2-roll__core" id="sm2-core"></div>`;
    mat.appendChild(roll);
    stage.appendChild(mat);
    wrap.appendChild(stage);

    // 配料按钮
    const tray = document.createElement("div");
    tray.className = "sm2-tray";
    shown.forEach((ing) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sm2-btn";
      b.dataset.name = ing.name;
      b.style.setProperty("--sm2-c", ing.color);
      b.innerHTML = `<span class="sm2-btn__emoji">${ing.emoji}</span><span class="sm2-btn__name">${ing.name}</span>`;
      b.addEventListener("click", () => this.pick(ing, b));
      tray.appendChild(b);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private isSameOrder(a: Ingredient[]): boolean {
    for (let i = 0; i < a.length; i++) {
      if (a[i]!.name !== this.recipe[i]!.name) return false;
    }
    return true;
  }

  private pick(ing: Ingredient, btn: HTMLButtonElement): void {
    if (this.locked) return;
    const target = this.recipe[this.expected]!;
    if (ing.name !== target.name) {
      // 顺序错了
      btn.classList.add("sm2-btn--wrong");
      this.trackTimeout(() => btn.classList.remove("sm2-btn--wrong"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }
    // 点对：飞入卷心，卷一格
    this.locked = true;
    btn.classList.add("sm2-btn--done");
    btn.disabled = true;
    sfxPop();
    this.resetWrongStreak();

    const core = this.root.querySelector("#sm2-core");
    if (core) {
      const chip = document.createElement("span");
      chip.className = "sm2-chip";
      chip.textContent = ing.emoji;
      chip.style.setProperty("--sm2-c", ing.color);
      core.appendChild(chip);
    }
    const roll = this.root.querySelector("#sm2-roll");
    roll?.classList.add("sm2-roll--fold");
    this.trackTimeout(() => roll?.classList.remove("sm2-roll--fold"), 220);

    const r = btn.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);

    this.expected += 1;
    this.trackTimeout(() => {
      this.locked = false;
      if (this.expected >= this.recipe.length) {
        // 一卷完成
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 850);
      }
    }, 260);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🍣",
      variant: "rest",
      body: `看看配方上当前要放哪个，从 1 开始一个一个按顺序点～ ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("sm2-style")) return;
    const st = document.createElement("style");
    st.id = "sm2-style";
    st.textContent = SM2_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function SM2_CSS(theme: string): string {
  return `
.sm2-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.sm2-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.sm2-card{width:100%;max-width:420px;background:linear-gradient(180deg,#fffef7,#fff4d6);border:2px solid ${theme}55;border-radius:18px;padding:10px 14px;box-shadow:var(--shadow);}
.sm2-card__title{font-size:.95rem;font-weight:900;color:${theme};margin-bottom:6px;}
.sm2-card__list{display:flex;flex-wrap:wrap;gap:8px;}
.sm2-recipe-item{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;background:#fff;border:1.5px dashed ${theme}66;font-weight:800;font-size:.9rem;}
.sm2-num{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${theme};color:#fff;font-size:.85rem;}
.sm2-emoji{font-size:1.2rem;}
.sm2-stage{display:flex;justify-content:center;width:100%;}
.sm2-mat{position:relative;width:min(360px,92%);height:120px;background:repeating-linear-gradient(90deg,#f4ede0,#f4ede0 12px,#e6dac4 12px,#e6dac4 24px);border-radius:16px;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;overflow:hidden;}
.sm2-roll{position:relative;width:200px;height:60px;background:linear-gradient(180deg,#3a2e1a,#5a4628);border-radius:30px;box-shadow:inset 0 0 12px rgba(0,0,0,.4),var(--shadow);transition:transform .2s;}
.sm2-roll--fold{transform:translateX(8px) rotate(-1deg);}
.sm2-roll__core{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:2px;padding:0 16px;}
.sm2-chip{font-size:1.5rem;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4));animation:sm2-fly .3s ease;}
@keyframes sm2-fly{0%{transform:translateY(-50px) scale(.4) rotate(-30deg);opacity:0}70%{transform:translateY(4px) scale(1.2);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}
.sm2-tray{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:440px;}
.sm2-btn{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:78px;padding:8px 6px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--sm2-c,#eee) 30%,#fff));box-shadow:0 4px 0 rgba(0,0,0,.1),0 6px 10px rgba(0,0,0,.12);cursor:pointer;transition:transform .1s;}
.sm2-btn:active{transform:translateY(3px);}
.sm2-btn__emoji{font-size:1.8rem;}
.sm2-btn__name{font-size:.8rem;font-weight:800;color:#555;}
.sm2-btn--done{opacity:.45;filter:grayscale(.6);}
.sm2-btn--wrong{animation:sm2-shake .45s ease;}
@keyframes sm2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.sm2-mat{height:104px;}.sm2-roll{width:170px;height:52px;}.sm2-btn{min-width:68px;}}
`;
}

export function create(): SushiMasterGame {
  return new SushiMasterGame();
}
