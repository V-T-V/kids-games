/* 饺子数 Dumpling Count —— 蒸笼里有若干只饺子（不同排列），
   孩子数清楚后从选项里选出数量。
   独特点：点数 + 数量对应。饺子在蒸笼里随机散布，避免成行成列的快速识数。
   视觉：竹蒸笼（带盖纹）+ 饺子 emoji 散布。难度=饺子数(3~12)。
   通关=答对目标轮数。前缀 dpc-。
   可解性：饺子总数即唯一答案，选项含正确答案 + 3 个邻近数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle, sample } from "../../lobby/util.ts";

const ENCOURAGE = [
  "数得真准！",
  "一个一个数哦！",
  "你真聪明！",
  "再数一遍试试～",
];

export class DumplingCountGame extends BaseGame {
  constructor() {
    super("dumpling-count");
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
    if (this.difficulty === "easy") return [3, 6];
    if (this.difficulty === "medium") return [5, 9];
    return [8, 12];
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.locked = false;

    const [lo, hi] = this.range();
    const count = randInt(lo, hi);
    this.answer = count;

    // 生成 4 个选项
    const opts = new Set<number>([count]);
    let guard = 0;
    while (opts.size < 4 && guard < 50) {
      guard += 1;
      const delta = sample([-2, -1, 1, 2, 3]);
      const v = count + delta;
      if (v >= 1 && v <= 15) opts.add(v);
    }
    let fill = 1;
    while (opts.size < 4) {
      if (!opts.has(fill)) opts.add(fill);
      fill += 1;
    }

    const wrap = document.createElement("div");
    wrap.className = "dpc-wrap";

    const task = document.createElement("div");
    task.className = "dpc-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 蒸笼里有几只饺子？数一数！🥟`;
    wrap.appendChild(task);

    // 蒸笼
    const stage = document.createElement("div");
    stage.className = "dpc-stage";
    const steamer = document.createElement("div");
    steamer.className = "dpc-steamer";
    const inner = document.createElement("div");
    inner.className = "dpc-steamer__inner";
    for (let i = 0; i < count; i++) {
      const d = document.createElement("span");
      d.className = "dpc-dumpling";
      d.textContent = "🥟";
      d.style.left = `${randInt(8, 82)}%`;
      d.style.top = `${randInt(12, 80)}%`;
      d.style.setProperty("--dpc-rot", `${randInt(-25, 25)}deg`);
      d.style.fontSize = `${randInt(26, 34)}px`;
      inner.appendChild(d);
    }
    steamer.appendChild(inner);
    stage.appendChild(steamer);
    wrap.appendChild(stage);

    // 选项
    const optsEl = document.createElement("div");
    optsEl.className = "dpc-options";
    shuffle([...opts]).forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dpc-option";
      b.textContent = String(v);
      b.addEventListener("click", () => this.choose(b, v));
      optsEl.appendChild(b);
    });
    wrap.appendChild(optsEl);

    this.root.appendChild(wrap);
  }

  private choose(btn: HTMLButtonElement, v: number): void {
    if (this.locked) return;
    if (v === this.answer) {
      this.locked = true;
      btn.classList.add("dpc-option--right");
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
      btn.classList.add("dpc-option--wrong");
      this.trackTimeout(() => btn.classList.remove("dpc-option--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🥟",
      variant: "rest",
      body: `用手指点着饺子，一个一个地数：1、2、3……${sample(ENCOURAGE)}`,
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
    if (document.getElementById("dpc-style")) return;
    const st = document.createElement("style");
    st.id = "dpc-style";
    st.textContent = DPC_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function DPC_CSS(theme: string): string {
  return `
.dpc-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.dpc-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.dpc-stage{display:flex;justify-content:center;}
.dpc-steamer{position:relative;width:300px;height:280px;background:radial-gradient(circle,#e8c89a,#c9a06a);border-radius:24px;box-shadow:var(--shadow),inset 0 0 0 8px #a87a45,inset 0 0 30px rgba(120,72,20,.25);overflow:hidden;}
.dpc-steamer::before{content:"";position:absolute;inset:14px;border-radius:18px;background:repeating-radial-gradient(circle at 30% 30%,rgba(255,255,255,.12) 0 6px,transparent 6px 18px);pointer-events:none;}
.dpc-steamer::after{content:"";position:absolute;top:14px;left:50%;transform:translateX(-50%);width:60%;height:6px;background:rgba(0,0,0,.12);border-radius:3px;}
.dpc-steamer__inner{position:absolute;inset:24px;}
.dpc-dumpling{position:absolute;font-size:30px;line-height:1;transform:translate(-50%,-50%) rotate(var(--dpc-rot,0deg));filter:drop-shadow(0 2px 2px rgba(120,72,20,.4));}
.dpc-options{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:440px;}
.dpc-option{min-width:64px;height:64px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,color-mix(in srgb,${theme} 18%,#fff));font-size:1.8rem;font-weight:900;color:${theme};box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.12);cursor:pointer;transition:transform .1s;}
.dpc-option:active{transform:translateY(3px);}
.dpc-option--right{background:linear-gradient(180deg,#bff0c1,#6bcf7f);color:#1d6b2c;animation:dpc-pop .4s ease;}
.dpc-option--wrong{background:linear-gradient(180deg,#ffd0d0,#ff8a8a);color:#a32020;animation:dpc-shake .45s ease;}
@keyframes dpc-pop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes dpc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.dpc-steamer{width:260px;height:240px;}.dpc-dumpling{font-size:26px;}.dpc-option{min-width:54px;height:54px;font-size:1.5rem;}}
`;
}

export function create(): DumplingCountGame {
  return new DumplingCountGame();
}
