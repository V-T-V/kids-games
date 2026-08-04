/* 面包师 Baker —— 照订单把指定数量的面包装进袋子。
   独特点：按数量装袋（区别于"拖一个"），训练精确计数 + 数量对应。
   视觉：面包 emoji + 纸袋 + 订单清单。难度=种类/数量。通关=装对目标轮数。
   巧思：每按一次按钮装一个，装够数量按钮变绿；多装提示错误。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle, sample } from "../../lobby/util.ts";

interface Bread {
  key: string;
  emoji: string;
  name: string;
  target: number;
  packed: number;
}

const BREAD_POOL: { key: string; emoji: string; name: string }[] = [
  { key: "croissant", emoji: "🥐", name: "牛角包" },
  { key: "baguette", emoji: "🥖", name: "法棍" },
  { key: "donut", emoji: "🍩", name: "甜甜圈" },
  { key: "pretzel", emoji: "🥨", name: "椒盐饼" },
  { key: "cake", emoji: "🧁", name: "纸杯蛋糕" },
  { key: "cookie", emoji: "🍪", name: "饼干" },
];

const ENCOURAGE = [
  "装得真准！",
  "数量分毫不差！",
  "你是面包大师！",
  "数清楚再装哦～",
];

export class BakerGame extends BaseGame {
  constructor() {
    super("baker");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private breads: Bread[] = [];
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

    const pool = shuffle(BREAD_POOL).slice(0, this.kinds());
    this.breads = pool.map((b) => ({
      key: b.key,
      emoji: b.emoji,
      name: b.name,
      target: randInt(1, this.maxPer()),
      packed: 0,
    }));

    const wrap = document.createElement("div");
    wrap.className = "bk-wrap";

    // 订单栏
    const task = document.createElement("div");
    task.className = "bk-task";
    const orderHtml = this.breads
      .map(
        (b) =>
          `<span class="bk-order-item"><b class="bk-emoji">${b.emoji}</b>${b.name} × <b id="bk-cnt-${b.key}">${b.target}</b></span>`,
      )
      .join("");
    task.innerHTML = `<div class="bk-task-line">第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 照订单把面包装进袋子 🛍️</div><div class="bk-orders">${orderHtml}</div>`;
    wrap.appendChild(task);

    // 纸袋 + 装好的面包
    const stage = document.createElement("div");
    stage.className = "bk-stage";
    const bag = document.createElement("div");
    bag.className = "bk-bag";
    bag.innerHTML = `<div class="bk-bag-inner" id="bk-bag-inner"></div>`;
    stage.appendChild(bag);
    wrap.appendChild(stage);

    // 面包按钮
    const tray = document.createElement("div");
    tray.className = "bk-tray";
    this.breads.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bk-btn";
      btn.innerHTML = `<span class="bk-btn-emoji">${b.emoji}</span><span class="bk-btn-name">${b.name}</span><span class="bk-btn-done" id="bk-done-${b.key}">${b.packed}/${b.target}</span>`;
      btn.addEventListener("click", () => this.pack(b, btn));
      tray.appendChild(btn);
    });
    wrap.appendChild(tray);

    this.root.appendChild(wrap);
  }

  private pack(b: Bread, btn: HTMLButtonElement): void {
    if (this.locked) return;
    const bag = this.root.querySelector("#bk-bag-inner");
    if (!bag) return;

    if (b.packed >= b.target) {
      btn.classList.add("bk-btn--wrong");
      this.trackTimeout(() => btn.classList.remove("bk-btn--wrong"), 450);
      const paused = this.onWrong();
      if (paused) this.showRest();
      return;
    }

    b.packed += 1;
    sfxPop();
    this.resetWrongStreak();

    const chip = document.createElement("span");
    chip.className = "bk-chip";
    chip.textContent = b.emoji;
    chip.style.setProperty("--bk-rot", `${randInt(-25, 25)}deg`);
    bag.appendChild(chip);

    const done = this.root.querySelector(`#bk-done-${b.key}`);
    if (done) done.textContent = `${b.packed}/${b.target}`;
    const r = btn.getBoundingClientRect();
    if (b.packed === b.target) {
      btn.classList.add("bk-btn--done");
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    }

    if (this.breads.every((x) => x.packed >= x.target)) {
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
      emoji: "🥐",
      variant: "rest",
      body: `看着订单上的数量，装够了就别再点啦～ ${sample(ENCOURAGE)}`,
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
    if (document.getElementById("bk-style")) return;
    const st = document.createElement("style");
    st.id = "bk-style";
    st.textContent = BK_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function BK_CSS(theme: string): string {
  return `
.bk-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(480px,100%);}
.bk-task{width:100%;background:#fff;border-radius:20px;padding:12px 16px;box-shadow:var(--shadow);text-align:center;}
.bk-task-line{font-size:1.05rem;font-weight:800;color:#444;margin-bottom:8px;}
.bk-orders{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}
.bk-order-item{display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:999px;background:${theme}22;font-weight:800;font-size:.95rem;}
.bk-emoji{font-size:1.4rem;}
.bk-stage{display:flex;justify-content:center;}
.bk-bag{position:relative;width:180px;height:200px;background:linear-gradient(180deg,#f3e2c0,#e6c98a);clip-path:polygon(0 14%,16% 0,84% 0,100% 14%,100% 100%,0 100%);box-shadow:var(--shadow);display:flex;align-items:flex-end;justify-content:center;padding:10px;}
.bk-bag-inner{display:flex;flex-wrap:wrap-reverse;justify-content:center;align-content:flex-end;gap:2px;width:150px;min-height:120px;}
.bk-chip{font-size:1.7rem;line-height:1;transform:rotate(var(--bk-rot,0deg));filter:drop-shadow(0 2px 2px rgba(120,72,20,.35));animation:bk-drop .3s ease;}
@keyframes bk-drop{0%{transform:rotate(var(--bk-rot,0deg)) translateY(-40px) scale(.6);opacity:0}100%{transform:rotate(var(--bk-rot,0deg)) translateY(0) scale(1);opacity:1}}
.bk-tray{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:14px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:440px;}
.bk-btn{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:84px;padding:8px 6px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,${theme}22);box-shadow:0 4px 0 rgba(0,0,0,.1),0 6px 10px rgba(0,0,0,.12);cursor:pointer;transition:transform .1s;}
.bk-btn:active{transform:translateY(3px);}
.bk-btn-emoji{font-size:1.8rem;}
.bk-btn-name{font-size:.8rem;font-weight:800;color:#555;}
.bk-btn-done{font-size:.8rem;font-weight:900;color:${theme};background:#fff;padding:1px 8px;border-radius:999px;}
.bk-btn--done{background:linear-gradient(180deg,#bff0c1,#6bcf7f);}
.bk-btn--done .bk-btn-done{color:#1d6b2c;}
.bk-btn--wrong{animation:bk-shake .45s ease;}
@keyframes bk-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.bk-bag{width:150px;height:170px;}.bk-bag-inner{width:124px;}.bk-btn{min-width:72px;}}
`;
}

export function create(): BakerGame {
  return new BakerGame();
}
