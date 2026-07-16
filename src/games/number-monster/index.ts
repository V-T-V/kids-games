/* 数字小怪兽 Number Monster —— 屏幕显示数字 N，点 N 个食物喂怪兽。
   巧思：吃对怪兽变大变色 + 吃错打嗝 + 数量对应认知。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, sfxHiccup } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

const FOODS = ["🍎", "🍌", "🍇", "🍓", "🍪", "🌽", "🥕", "🍅"] as const;

export class NumberMonsterGame extends BaseGame {
  constructor() {
    super("number-monster");
  }

  private target = 0;
  private fed = 0;
  private roundsDone = 0;
  private roundTotal = 0;
  private monsterLevel = 0; // 0..3 视觉等级
  private monsterEl!: HTMLDivElement;
  private bubbleEl!: HTMLDivElement;
  private foodEls: HTMLButtonElement[] = [];

  protected mount(): void {
    this.roundTotal = this.roundsPerClear();
    this.injectStyle();
    this.startRound();
  }

  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private roundsPerClear(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 5
        : 6;
  }

  private numberRange(): [number, number] {
    if (this.difficulty === "easy") return [1, 5];
    if (this.difficulty === "medium") return [2, 10];
    return [5, 15];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const [minN, maxN] = this.numberRange();
    this.target = randInt(minN, maxN);
    this.fed = 0;

    const wrap = document.createElement("div");
    wrap.className = "nm-wrap";

    const task = document.createElement("div");
    task.className = "nm-task";
    task.innerHTML = `喂怪兽吃 <span class="nm-num">${this.target}</span> 个食物！`;
    wrap.appendChild(task);

    /* —— 怪兽 —— */
    const monsterBox = document.createElement("div");
    monsterBox.className = "nm-monster-box";
    this.monsterEl = document.createElement("div");
    this.monsterEl.className = `nm-monster nm-monster--lv${this.monsterLevel}`;
    this.monsterEl.innerHTML = `<div class="nm-monster__face">🦷</div>`;
    this.bubbleEl = document.createElement("div");
    this.bubbleEl.className = "nm-bubble";
    this.bubbleEl.textContent = `${this.fed}/${this.target}`;
    monsterBox.appendChild(this.monsterEl);
    monsterBox.appendChild(this.bubbleEl);
    wrap.appendChild(monsterBox);

    /* —— 食物区：放 target + 干扰食物 —— */
    const foodArea = document.createElement("div");
    foodArea.className = "nm-foods";
    // 至少 target 个，外加几个干扰，让孩子自己数
    const extra = this.difficulty === "easy" ? 1 : 2;
    const total = this.target + extra;
    const foodList = shuffle(
      Array.from({ length: total }, () => sample(FOODS)),
    );
    this.foodEls = [];
    foodList.forEach((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nm-food";
      b.dataset.food = f;
      b.textContent = f;
      b.addEventListener("click", () => this.feed(b));
      foodArea.appendChild(b);
      this.foodEls.push(b);
    });
    wrap.appendChild(foodArea);

    this.root.appendChild(wrap);
  }

  private feed(btn: HTMLButtonElement): void {
    if (btn.classList.contains("nm-food--eaten")) return;
    this.fed += 1;
    btn.classList.add("nm-food--eaten");
    btn.textContent = "";
    sfxPop();

    // 飞向怪兽动画
    const r = btn.getBoundingClientRect();
    const mr = this.monsterEl.getBoundingClientRect();
    btn.style.setProperty("--fx", `${mr.left - r.left}px`);
    btn.style.setProperty("--fy", `${mr.top - r.top}px`);

    this.bubbleEl.textContent = `${this.fed}/${this.target}`;
    this.monsterEl.classList.add("nm-monster--chew");
    this.trackTimeout(
      () => this.monsterEl.classList.remove("nm-monster--chew"),
      200,
    );

    if (this.fed === this.target) {
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.monsterLevel = (this.monsterLevel + 1) % 4;
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1200);
    } else if (this.fed > this.target) {
      // 吃多了，打嗝
      sfxHiccup();
      this.monsterEl.classList.add("nm-monster--hiccup");
      this.bubbleEl.textContent = "嗝！😣";
      const paused = this.onWrong();
      this.trackTimeout(
        () => this.monsterEl.classList.remove("nm-monster--hiccup"),
        500,
      );
      if (paused) this.showRest();
      // 撤销最后一次点击
      this.fed -= 1;
      btn.classList.remove("nm-food--eaten");
      btn.textContent = btn.dataset.food ?? "🍎";
      this.trackTimeout(() => {
        this.bubbleEl.textContent = `${this.fed}/${this.target}`;
      }, 700);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "数清楚再喂哦～歇一歇吧。",
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
    if (document.getElementById("nm-style")) return;
    const st = document.createElement("style");
    st.id = "nm-style";
    st.textContent = NM_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function NM_CSS(theme: string): string {
  return `
.nm-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.nm-task{font-size:1.3rem;font-weight:800;}
.nm-num{display:inline-block;color:${theme};font-size:1.6em;animation:nm-pop .5s ease infinite;}
.nm-monster-box{position:relative;display:flex;flex-direction:column;align-items:center;}
.nm-monster{width:130px;height:130px;border-radius:50% 50% 44% 44%;background:linear-gradient(160deg,${theme},color-mix(in srgb,${theme} 65%,#000));display:flex;align-items:center;justify-content:center;box-shadow:inset -8px -10px 0 rgba(0,0,0,.12),var(--shadow);transition:transform .2s ease;}
.nm-monster--lv1{transform:scale(1.05);background:linear-gradient(160deg,#4d96ff,color-mix(in srgb,#4d96ff 65%,#000));}
.nm-monster--lv2{transform:scale(1.12);background:linear-gradient(160deg,#a55eea,color-mix(in srgb,#a55eea 65%,#000));}
.nm-monster--lv3{transform:scale(1.2);background:linear-gradient(160deg,#ff6b9d,color-mix(in srgb,#ff6b9d 65%,#000));}
.nm-monster__face{font-size:3.2rem;}
.nm-monster--chew{animation:nm-chew .2s ease;}
.nm-monster--hiccup{animation:nm-shake .4s ease;}
.nm-bubble{margin-top:10px;padding:6px 18px;background:#fff;border-radius:999px;font-weight:800;font-size:1.1rem;box-shadow:var(--shadow);}
.nm-foods{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:360px;}
.nm-food{width:58px;height:58px;font-size:2rem;border-radius:50%;background:#fff;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;transition:transform .1s;}
.nm-food:active{transform:scale(.9);}
.nm-food--eaten{animation:nm-fly .4s ease forwards;pointer-events:none;}
@keyframes nm-pop{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
@keyframes nm-chew{0%,100%{transform:scale(1)}50%{transform:scale(.92)}}
@keyframes nm-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
@keyframes nm-fly{to{transform:translate(var(--fx),var(--fy)) scale(.2);opacity:0;}}
@media (max-width:380px){.nm-food{width:50px;height:50px;font-size:1.7rem;}}
`;
}

export function create(): NumberMonsterGame {
  return new NumberMonsterGame();
}
