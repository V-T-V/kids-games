/* 披萨配料 Pizza Top —— 照订单把指定数量的配料放到披萨饼上。
   独特点：按数量放置（区别于"选一个"），训练计数 + 数量对应。
   视觉：金黄披萨饼底 + emoji 配料散落。难度=配料种类/数量。通关=放对目标轮数。
   巧思：订单明确每种配料的数量，点按钮按数量累加，放满即过关。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle, sample } from "../../lobby/util.ts";

interface Topping {
  /** 配料键 */
  key: string;
  /** 显示 emoji */
  emoji: string;
  /** 中文名 */
  name: string;
  /** 本轮需要放的数量 */
  target: number;
  /** 已放数量 */
  placed: number;
}

const TOPPING_POOL: { key: string; emoji: string; name: string }[] = [
  { key: "mushroom", emoji: "🍄", name: "蘑菇" },
  { key: "pepper", emoji: "🫑", name: "青椒" },
  { key: "shrimp", emoji: "🦐", name: "虾" },
  { key: "tomato", emoji: "🍅", name: "番茄" },
  { key: "olive", emoji: "🫒", name: "橄榄" },
  { key: "cheese", emoji: "🧀", name: "奶酪" },
  { key: "corn", emoji: "🌽", name: "玉米" },
  { key: "pineapple", emoji: "🍍", name: "菠萝" },
];

const ENCOURAGE = [
  "放得真准！",
  "数对了，真棒！",
  "小厨师太厉害啦！",
  "再数一遍哦～",
];

export class PizzaTopGame extends BaseGame {
  constructor() {
    super("pizza-top");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private toppings: Topping[] = [];
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

  /** 不同难度：配料种类数 + 单种数量上限。 */
  private kinds(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }
  private maxPer(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    // 选配料种类并生成订单（保证每样至少 1 个，有解）
    const pool = shuffle(TOPPING_POOL).slice(0, this.kinds());
    this.toppings = pool.map((t) => ({
      key: t.key,
      emoji: t.emoji,
      name: t.name,
      target: randInt(1, this.maxPer()),
      placed: 0,
    }));

    const wrap = document.createElement("div");
    wrap.className = "pz-wrap";

    // 订单栏
    const task = document.createElement("div");
    task.className = "pz-task";
    const orderHtml = this.toppings
      .map(
        (t) =>
          `<span class="pz-order-item"><b class="pz-emoji">${t.emoji}</b>${t.name} <b id="pz-cnt-${t.key}">${t.target}</b> 个</span>`,
      )
      .join("");
    task.innerHTML = `<div class="pz-task-line">第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 照订单放配料 🧾</div><div class="pz-orders">${orderHtml}</div>`;
    wrap.appendChild(task);

    // 披萨饼底
    const stage = document.createElement("div");
    stage.className = "pz-stage";
    const pizza = document.createElement("div");
    pizza.className = "pz-pizza";
    pizza.id = "pz-pizza";
    // 饼面（配料落在上面）
    const crust = document.createElement("div");
    crust.className = "pz-crust";
    crust.id = "pz-crust";
    pizza.appendChild(crust);
    stage.appendChild(pizza);
    wrap.appendChild(stage);

    // 配料按钮
    const tray = document.createElement("div");
    tray.className = "pz-tray";
    this.toppings.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pz-btn";
      b.innerHTML = `<span class="pz-btn-emoji">${t.emoji}</span><span class="pz-btn-name">${t.name}</span><span class="pz-btn-done" id="pz-done-${t.key}">${t.placed}/${t.target}</span>`;
      b.addEventListener("click", () => this.addTopping(t, b));
      tray.appendChild(b);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private addTopping(t: Topping, btn: HTMLButtonElement): void {
    if (this.locked) return;
    const crust = this.root.querySelector("#pt-crust") as HTMLElement | null;
    if (!crust) return;

    // 已经放够了再多放 -> 提示错误（不计数超出）
    if (t.placed >= t.target) {
      btn.classList.add("pz-btn--wrong");
      this.trackTimeout(() => btn.classList.remove("pz-btn--wrong"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }

    t.placed += 1;
    sfxPop();
    this.resetWrongStreak();

    // 在饼面随机位置落一个配料
    const chip = document.createElement("span");
    chip.className = "pz-chip";
    chip.textContent = t.emoji;
    chip.style.left = `${randInt(18, 72)}%`;
    chip.style.top = `${randInt(18, 72)}%`;
    chip.style.setProperty("--pt-rot", `${randInt(-30, 30)}deg`);
    crust.appendChild(chip);

    // 更新计数
    const done = this.root.querySelector(`#pt-done-${t.key}`);
    if (done) done.textContent = `${t.placed}/${t.target}`;
    const r = btn.getBoundingClientRect();
    if (t.placed === t.target) {
      btn.classList.add("pz-btn--done");
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    }

    // 全部放满即过关
    if (this.toppings.every((x) => x.placed >= x.target)) {
      this.locked = true;
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 800);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🍕",
      variant: "rest",
      body: `看着订单上的数字，放够数量就别再点啦～ ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("pz-style")) return;
    const st = document.createElement("style");
    st.id = "pz-style";
    st.textContent = PT_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function PT_CSS(theme: string): string {
  return `
.pz-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.pz-task{width:100%;background:#fff;border-radius:20px;padding:12px 16px;box-shadow:var(--shadow);text-align:center;}
.pz-task-line{font-size:1.05rem;font-weight:800;color:#444;margin-bottom:8px;}
.pz-orders{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}
.pz-order-item{display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:999px;background:${theme}22;font-weight:800;font-size:.95rem;}
.pz-emoji{font-size:1.4rem;}
.pz-stage{display:flex;justify-content:center;}
.pz-pizza{position:relative;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,#f0c279,#e8a04a);box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;}
.pz-crust{position:relative;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,#ffe0a3,#ffd066);box-shadow:inset 0 0 0 8px #f0c279, inset 0 0 24px rgba(255,180,80,.4);overflow:hidden;}
.pz-chip{position:absolute;font-size:1.8rem;line-height:1;transform:translate(-50%,-50%) rotate(var(--pt-rot,0deg));filter:drop-shadow(0 2px 2px rgba(120,72,20,.35));animation:pt-drop .35s ease;}
@keyframes pt-drop{0%{transform:translate(-50%,-160%) rotate(var(--pt-rot,0deg)) scale(.6);opacity:0}100%{transform:translate(-50%,-50%) rotate(var(--pt-rot,0deg)) scale(1);opacity:1}}
.pz-tray{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:440px;}
.pz-btn{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:84px;padding:8px 6px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,${theme}22);box-shadow:0 4px 0 rgba(0,0,0,.1),0 6px 10px rgba(0,0,0,.12);cursor:pointer;transition:transform .1s;}
.pz-btn:active{transform:translateY(3px);}
.pz-btn-emoji{font-size:1.8rem;}
.pz-btn-name{font-size:.8rem;font-weight:800;color:#555;}
.pz-btn-done{font-size:.8rem;font-weight:900;color:${theme};background:#fff;padding:1px 8px;border-radius:999px;}
.pz-btn--done{background:linear-gradient(180deg,#bff0c1,#6bcf7f);}
.pz-btn--done .pz-btn-done{color:#1d6b2c;}
.pz-btn--wrong{animation:pt-shake .45s ease;}
@keyframes pt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.pz-pizza{width:220px;height:220px;}.pz-crust{width:168px;height:168px;}.pz-btn{min-width:72px;}}
`;
}

export function create(): PizzaTopGame {
  return new PizzaTopGame();
}
