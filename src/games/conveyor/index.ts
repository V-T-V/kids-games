/* 传送带 Conveyor —— 物品在传送带上向右移动，末端有 2-3 个分类筐
   （按颜色分），孩子在物品到达末端前点对应筐把物品送进去。
   独特点：节奏紧迫感 + 颜色匹配，传送带条纹滚动 + 物品随带移动。
   巧思：一次只判定"最前端"的物品（避免歧义），点筐后物品飞入对应筐；
   速度/物品数=难度，间隔足够长保证可操作。通关=分对目标轮数。
   RAF 驱动（物品移动），unmount 取消。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { burst } from "../../core/particles.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { createRafLoop } from "../../core/loop.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Item {
  el: HTMLDivElement;
  x: number; // 中心 x（相对传送带）
  color: string;
  done: boolean;
}

interface Bin {
  el: HTMLElement;
  color: string;
}

const ITEMS = ["🎁", "📦", "🎈", "🧸"] as const;

export class ConveyorGame extends BaseGame {
  constructor() {
    super("conveyor");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private belt!: HTMLDivElement;
  private track!: HTMLDivElement;
  private stop?: () => void;
  private items: Item[] = [];
  private bins: Bin[] = [];
  private colors: string[] = [];
  private speed = 0;
  private spawnTimer = 0;
  private spawnBudget = 0; // 本关还要投放的物品数
  private sorted = 0; // 本关已正确分拣数
  private need = 0; // 本关目标
  private beltW = 0;
  private itemR = 26;
  private busy = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.stop?.();
    this.stop = undefined;
  }

  private binCount(): number {
    return this.difficulty === "easy" ? 4: this.difficulty === "medium"
        ? 5
        : 6;
  }
  private speedOf(): number {
    // px/s
    return this.difficulty === "easy"
      ? 55
      : this.difficulty === "medium"
        ? 72
        : 92;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.busy = true;
    this.items = [];
    this.bins = [];
    this.sorted = 0;
    this.speed = this.speedOf();
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 颜色选择（筐数 = 颜色数）
    const palette = shuffle([
      "#ff6b9d",
      "#4d96ff",
      "#6bcf7f",
      "#ffd93d",
      "#a55eea",
    ]);
    this.colors = palette.slice(0, this.binCount());

    const wrap = document.createElement("div");
    wrap.className = "cv-wrap";

    const task = document.createElement("div");
    task.className = "cv-task";
    task.innerHTML = `看物品颜色，点对应的筐把它收好！<br>（第 ${this.roundsDone + 1}/${this.roundTotal} 关） · 已收 <span id="cv-sorted">0</span>`;
    wrap.appendChild(task);

    // 传送带
    this.belt = document.createElement("div");
    this.belt.className = "cv-belt";
    this.track = document.createElement("div");
    this.track.className = "cv-track";
    this.track.id = "cv-track";
    this.belt.appendChild(this.track);
    // 滚轮
    const roller = document.createElement("div");
    roller.className = "cv-roller";
    this.belt.appendChild(roller);
    wrap.appendChild(this.belt);

    // 筐区
    const bins = document.createElement("div");
    bins.className = "cv-bins";
    for (const c of this.colors) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cv-bin";
      b.style.setProperty("--cv-c", c);
      b.innerHTML = `<span class="cv-bin__label">收</span>`;
      b.addEventListener("click", () => this.sortInto(c, b));
      bins.appendChild(b);
      this.bins.push({ el: b, color: c });
    }
    wrap.appendChild(bins);
    this.root.appendChild(wrap);

    // 本关物品数 = need
    this.need =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 5 : 6;
    this.spawnBudget = this.need;
    this.spawnTimer = 0.5;

    requestAnimationFrame(() => {
      const r = this.track.getBoundingClientRect();
      this.beltW = r.width;
      this.busy = false;
    });

    this.stop = createRafLoop((dt) => this.tick(dt));
  }

  private spawnItem(): void {
    if (this.spawnBudget <= 0) return;
    this.spawnBudget -= 1;
    const color = sample(this.colors);
    const emoji = sample(ITEMS);
    const el = document.createElement("div");
    el.className = "cv-item";
    el.style.setProperty("--cv-c", color);
    el.textContent = emoji;
    el.style.left = `-40px`;
    this.track.appendChild(el);
    this.items.push({ el, x: 0, color, done: false });
    sfxPop();
  }

  private tick = (dt: number): void => {
    if (this.busy) return;
    // 滚动条纹
    const scroll = (performance.now() * this.speed * 0.001 * 0.4) % 40;
    this.track.style.setProperty("--cv-scroll", `${scroll}px`);

    // 投放
    if (this.spawnBudget > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnItem();
        this.spawnTimer = 1.6; // 间隔足以让玩家判断
      }
    }

    // 移动物品
    const endX = this.beltW - 16; // 末端 x（筐口位置）
    for (const it of this.items) {
      if (it.done) continue;
      it.x += this.speed * dt;
      it.el.style.left = `${it.x - this.itemR}px`;
      // 到末端未被收：漏掉
      if (it.x > endX) {
        it.done = true;
        it.el.classList.add("cv-item--miss");
        this.onWrong();
        this.trackTimeout(() => {
          it.el.remove();
          this.items = this.items.filter((x) => x !== it);
          this.checkRoundEnd();
        }, 400);
      }
    }
  };

  /** 点筐：把当前最靠右（最前端）的未收物品送进匹配筐。 */
  private sortInto(color: string, binEl: HTMLButtonElement): void {
    if (this.busy) return;
    // 选最靠右且未 done 的物品
    let target: Item | null = null;
    let maxX = -Infinity;
    for (const it of this.items) {
      if (it.done) continue;
      if (it.x > maxX) {
        maxX = it.x;
        target = it;
      }
    }
    if (!target) return;
    target.done = true;
    const correct = target.color === color;
    if (correct) {
      this.sorted += 1;
      const r = binEl.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + 4, 12, ["star", "circle"]);
      this.onCorrect(r.left + r.width / 2, r.top + 4);
      this.resetWrongStreak();
      const sc = this.root.querySelector("#cv-sorted");
      if (sc) sc.textContent = String(this.sorted);
      // 飞入筐动画
      target.el.classList.add("cv-item--sorted");
      this.trackTimeout(() => {
        target!.el.remove();
        this.items = this.items.filter((x) => x !== target);
        this.checkRoundEnd();
      }, 450);
    } else {
      // 分错筐：反馈，物品继续（不算 done，给重试机会）
      target.done = false;
      binEl.classList.add("cv-bin--shake");
      this.trackTimeout(() => binEl.classList.remove("cv-bin--shake"), 350);
      this.onWrong();
    }
  }

  private checkRoundEnd(): void {
    // 本关物品已全部生成且场上无未处理物品，且已正确分拣达到 need → 关卡完成
    if (
      this.spawnBudget <= 0 &&
      this.items.filter((x) => !x.done).length === 0
    ) {
      if (this.sorted >= this.need) {
        // 通关本关
        this.busy = true;
        this.stop?.();
        this.stop = undefined;
        this.roundsDone += 1;
        this.reportProgress(this.roundsDone, this.roundTotal);
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 800);
      }
      // 若 sorted < need（漏了太多），本关不算通过：自动补投放差额，保证可通关
      else if (this.spawnBudget <= 0) {
        const lack = this.need - this.sorted;
        this.spawnBudget = lack + 1; // 多投一个容错
        this.spawnTimer = 0.6;
      }
    }
  }

  private injectStyle(): void {
    if (document.getElementById("cv-style")) return;
    const st = document.createElement("style");
    st.id = "cv-style";
    st.textContent = CV_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function CV_CSS(theme: string): string {
  return `
.cv-wrap{display:flex;flex-direction:column;align-items:center;gap:22px;width:min(540px,100%);}
.cv-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:8px 20px;border-radius:999px;box-shadow:var(--shadow);}
.cv-task span{color:${theme};font-weight:900;}
.cv-belt{position:relative;width:100%;height:96px;margin-bottom:6px;}
.cv-track{position:relative;width:100%;height:72px;background:repeating-linear-gradient(90deg,#9e9e9e 0 20px,#bdbdbd 20px 40px);background-position:var(--cv-scroll,0) 0;border-radius:14px;box-shadow:inset 0 3px 6px rgba(0,0,0,.2),inset 0 -3px 6px rgba(0,0,0,.25),var(--shadow);overflow:hidden;}
.cv-roller{position:absolute;right:-14px;bottom:6px;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#e0e0e0,#757575);box-shadow:var(--shadow);animation:cv-roll .6s linear infinite;}
@keyframes cv-roll{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.cv-item{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;background:var(--cv-c);border-radius:12px;box-shadow:0 3px 6px rgba(0,0,0,.25),inset 0 0 0 3px rgba(255,255,255,.5);will-change:left;}
.cv-item--sorted{animation:cv-fly .45s ease forwards;}
@keyframes cv-fly{0%{transform:translateY(-50%) scale(1)}100%{transform:translateY(-50%) scale(.3) translateY(40px);opacity:0}}
.cv-item--miss{animation:cv-drop .4s ease forwards;}
@keyframes cv-drop{0%{transform:translateY(-50%) rotate(0)}100%{transform:translateY(-50%) translateY(50px) rotate(40deg);opacity:0}}
.cv-bins{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;}
.cv-bin{position:relative;width:88px;height:74px;border:none;border-radius:0 0 14px 14px;background:var(--cv-c);box-shadow:inset 0 0 0 4px rgba(255,255,255,.5),var(--shadow);cursor:pointer;transition:transform .12s;}
.cv-bin:active{transform:scale(.94);}
.cv-bin::before{content:"";position:absolute;top:-8px;left:6px;right:6px;height:14px;background:var(--cv-c);border-radius:8px 8px 0 0;box-shadow:inset 0 0 0 4px rgba(255,255,255,.5);}
.cv-bin__label{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);color:#fff;font-size:.95rem;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.35);}
.cv-bin--shake{animation:cv-shake .35s ease;}
@keyframes cv-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (max-width:380px){.cv-bin{width:72px;height:64px;}}
`;
}

export function create(): ConveyorGame {
  return new ConveyorGame();
}
