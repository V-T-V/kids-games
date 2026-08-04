/* 数小鸡 Chicken Count —— 鸡舍里几只小鸡探头又缩回，
   问"看到了几只"，孩子从选项里选数量。
   独特点：先观察后作答的计数训练；小鸡错峰探头/缩回，增加趣味和挑战。
   视觉：木制鸡舍 + 多个洞口 + 探头小鸡 + 数量选项。
   难度=小鸡数(3-10)。通关=答对目标轮数。前缀 cc2-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle, sample } from "../../lobby/util.ts";

export class ChickenCountGame extends BaseGame {
  constructor() {
    super("chicken-count");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answer = 0;
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

  private range(): [number, number] {
    if (this.difficulty === "easy") return [3, 5];
    if (this.difficulty === "medium") return [4, 7];
    return [6, 10];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    const [lo, hi] = this.range();
    const count = randInt(lo, hi);
    this.answer = count;
    // 洞口数比小鸡数多一些，制造"哪些洞有鸡"
    const holes = Math.min(12, count + randInt(2, 4));

    const wrap = document.createElement("div");
    wrap.className = "cc2-wrap";

    const task = document.createElement("div");
    task.className = "cc2-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · <span id="cc2-prompt">看清楚有几只小鸡探头！</span>`;
    wrap.appendChild(task);

    const coop = document.createElement("div");
    coop.className = "cc2-coop";
    // 屋顶
    const roof = document.createElement("div");
    roof.className = "cc2-roof";
    coop.appendChild(roof);
    // 洞口网格
    const holesEl = document.createElement("div");
    holesEl.className = "cc2-holes";
    // 选择哪些洞有小鸡
    const chickenHoles = new Set<number>();
    const allIdx = shuffle([...Array(holes).keys()]);
    for (let i = 0; i < count; i++) chickenHoles.add(allIdx[i]!);

    const chickenEls: HTMLSpanElement[] = [];
    for (let i = 0; i < holes; i++) {
      const hole = document.createElement("div");
      hole.className = "cc2-hole";
      if (chickenHoles.has(i)) {
        const chick = document.createElement("span");
        chick.className = "cc2-chick";
        chick.textContent = sample(["🐤", "🐥"]);
        chick.style.transitionDelay = `${randInt(0, 200)}ms`;
        hole.appendChild(chick);
        chickenEls.push(chick);
      }
      holesEl.appendChild(hole);
    }
    coop.appendChild(holesEl);
    wrap.appendChild(coop);

    // 选项（先隐藏，观察阶段后再显示）
    const optsEl = document.createElement("div");
    optsEl.className = "cc2-options cc2-options--hidden";
    const opts = this.genOptions(count);
    optsEl.innerHTML = `<div class="cc2-options-label">看到了几只小鸡？</div>`;
    const btnsRow = document.createElement("div");
    btnsRow.className = "cc2-options-row";
    shuffle(opts).forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cc2-option";
      b.textContent = String(v);
      b.addEventListener("click", () => this.choose(b, v));
      btnsRow.appendChild(b);
    });
    optsEl.appendChild(btnsRow);
    wrap.appendChild(optsEl);
    this.root.appendChild(wrap);

    // 阶段控制：探头 → 停留 → 缩回 → 出选项
    // 1. 全部探头
    this.trackTimeout(() => {
      chickenEls.forEach((c) => c.classList.add("cc2-chick--up"));
    }, 300);
    // 2. 停留观察
    const stayMs = 1400 + count * 120;
    // 3. 缩回
    this.trackTimeout(() => {
      chickenEls.forEach((c) => c.classList.remove("cc2-chick--up"));
    }, 300 + stayMs);
    // 4. 显示选项
    this.trackTimeout(
      () => {
        optsEl.classList.remove("cc2-options--hidden");
        const prompt = this.root.querySelector("#cc2-prompt");
        if (prompt) prompt.textContent = "刚才有几只小鸡探头了？";
      },
      300 + stayMs + 700,
    );
  }

  /** 生成 4 个选项：正确答案 + 3 个邻近数 */
  private genOptions(count: number): number[] {
    const set = new Set<number>([count]);
    let guard = 0;
    while (set.size < 4 && guard < 50) {
      guard += 1;
      const delta = sample([-2, -1, 1, 2, 3]);
      const v = count + delta;
      if (v >= 1 && v <= 12) set.add(v);
    }
    let fill = 1;
    while (set.size < 4) {
      if (!set.has(fill)) set.add(fill);
      fill += 1;
    }
    return [...set];
  }

  private choose(btn: HTMLButtonElement, value: number): void {
    if (this.locked) return;
    if (value === this.answer) {
      this.locked = true;
      btn.classList.add("cc2-option--right");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 850);
    } else {
      btn.classList.add("cc2-option--wrong");
      this.trackTimeout(() => btn.classList.remove("cc2-option--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🐥",
      variant: "rest",
      body: "小鸡探头的时候，用手指点着数：1、2、3……再选答案～",
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
    if (document.getElementById("cc2-style")) return;
    const st = document.createElement("style");
    st.id = "cc2-style";
    st.textContent = CC2_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function CC2_CSS(theme: string): string {
  return `
.cc2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.cc2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.cc2-coop{position:relative;width:100%;max-width:440px;background:linear-gradient(180deg,#c89a6a,#a87848);border:5px solid #8a5a2b;border-radius:16px 16px 12px 12px;padding:30px 18px 22px;box-shadow:var(--shadow);overflow:hidden;}
.cc2-roof{position:absolute;left:-10px;right:-10px;top:-22px;height:36px;background:linear-gradient(180deg,#8a3a2a,#6a2a1a);clip-path:polygon(8% 100%,50% 0,92% 100%);}
.cc2-roof::after{content:"🐓";position:absolute;left:50%;top:-2px;transform:translateX(-50%);font-size:1.6rem;}
.cc2-holes{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
.cc2-hole{position:relative;height:64px;background:radial-gradient(ellipse at center top,#3a2a1a 0%,#1a1208 80%);border-radius:50% 50% 14px 14px;border:2px solid #5a3a1a;overflow:hidden;box-shadow:inset 0 4px 8px rgba(0,0,0,.5);}
.cc2-chick{position:absolute;left:50%;bottom:-100%;transform:translateX(-50%);font-size:2rem;transition:bottom .5s cubic-bezier(.34,1.56,.64,1);filter:drop-shadow(0 2px 2px rgba(0,0,0,.3));}
.cc2-chick--up{bottom:6px;}
.cc2-options{display:flex;flex-direction:column;align-items:center;gap:10px;transition:opacity .3s;}
.cc2-options--hidden{opacity:0;pointer-events:none;height:0;overflow:hidden;}
.cc2-options-label{font-size:1.05rem;font-weight:800;color:#5a4a2a;}
.cc2-options-row{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
.cc2-option{min-width:64px;height:64px;border:none;border-radius:16px;background:linear-gradient(180deg,#fff,${theme}33);font-size:1.8rem;font-weight:900;color:#333;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.1);transition:transform .1s;}
.cc2-option:active{transform:translateY(3px);}
.cc2-option--right{background:linear-gradient(180deg,#bff0c1,#6bcf7f);color:#1d6b2c;animation:cc2-bounce .5s ease;}
.cc2-option--wrong{background:linear-gradient(180deg,#ffd0c4,#ff8a72);animation:cc2-shake .5s ease;}
@keyframes cc2-bounce{0%,100%{transform:scale(1)}40%{transform:scale(1.18)}}
@keyframes cc2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.cc2-holes{grid-template-columns:repeat(3,1fr);}.cc2-hole{height:56px;}.cc2-chick{font-size:1.7rem;}.cc2-option{min-width:54px;height:56px;font-size:1.5rem;}}
`;
}

export function create(): ChickenCountGame {
  return new ChickenCountGame();
}
