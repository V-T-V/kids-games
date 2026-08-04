/* 数饼干 Cookie Count —— 罐子里有若干饼干，孩子数清楚后从选项里选出数量。
   独特点：饼干在罐子内可视化堆叠，"数一数再选"，训练点数 + 数量对应。
   视觉：玻璃罐子 + 饼干堆叠。难度=饼干数(3-12)。通关=答对目标轮数。
   巧思：选项由正确答案 + 3 个邻近干扰数组成，确保唯一正确项。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle, sample } from "../../lobby/util.ts";

const COOKIE_EMOJIS = ["🍪", "🟎", "🍩"];
/* 用图形化的饼干，避免不同 emoji 宽高不一 */
const COOKIE_MARK = ["🍪", "🍪", "🍪"];

const ENCOURAGE = [
  "数得真准！",
  "再数一次试试～",
  "你真聪明！",
  "点一个数一个哦！",
];

export class CookieCountGame extends BaseGame {
  constructor() {
    super("cookie-count");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private currentAnswer = 0;
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

  /** 不同难度的饼干数区间 */
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
    this.currentAnswer = count;

    /* 生成 4 个选项：正确答案 + 3 个邻近干扰（去重） */
    const opts = new Set<number>([count]);
    let guard = 0;
    while (opts.size < 4 && guard < 50) {
      guard += 1;
      const delta = sample([-2, -1, 1, 2, 3]);
      const v = count + delta;
      if (v >= 1 && v <= 15) opts.add(v);
    }
    /* 兜底：若仍不足 4 个，用任意正数补齐 */
    let fill = 1;
    while (opts.size < 4) {
      if (!opts.has(fill)) opts.add(fill);
      fill += 1;
    }

    const wrap = document.createElement("div");
    wrap.className = "cc-wrap";

    const task = document.createElement("div");
    task.className = "cc-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 罐子里有几块饼干？数一数！`;
    wrap.appendChild(task);

    /* 罐子 + 饼干堆叠区 */
    const stage = document.createElement("div");
    stage.className = "cc-stage";
    const jar = document.createElement("div");
    jar.className = "cc-jar";
    const lid = document.createElement("div");
    lid.className = "cc-lid";
    jar.appendChild(lid);
    const inner = document.createElement("div");
    inner.className = "cc-jar-inner";
    for (let i = 0; i < count; i++) {
      const ck = document.createElement("span");
      ck.className = "cc-cookie";
      ck.textContent = sample(COOKIE_MARK);
      ck.style.setProperty("--cc-rot", `${randInt(-18, 18)}deg`);
      inner.appendChild(ck);
    }
    jar.appendChild(inner);
    stage.appendChild(jar);
    wrap.appendChild(stage);

    /* 选项 */
    const optsEl = document.createElement("div");
    optsEl.className = "cc-options";
    shuffle([...opts]).forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cc-option";
      b.textContent = String(v);
      b.addEventListener("click", () => this.choose(b, v));
      optsEl.appendChild(b);
    });
    wrap.appendChild(optsEl);

    void COOKIE_EMOJIS;
    this.root.appendChild(wrap);
  }

  private choose(btn: HTMLButtonElement, value: number): void {
    if (this.locked) return;
    if (value === this.currentAnswer) {
      this.locked = true;
      btn.classList.add("cc-option--right");
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
      btn.classList.add("cc-option--wrong");
      this.trackTimeout(() => btn.classList.remove("cc-option--wrong"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🍪",
      variant: "rest",
      body: `用手指点着饼干，一个一个地数：1、2、3……${sample(ENCOURAGE)}`,
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
    if (document.getElementById("cc-style")) return;
    const st = document.createElement("style");
    st.id = "cc-style";
    st.textContent = CC_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function CC_CSS(theme: string): string {
  return `
.cc-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(440px,100%);}
.cc-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.cc-stage{display:flex;justify-content:center;}
.cc-jar{position:relative;width:200px;background:linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,.08));border:4px solid rgba(255,255,255,.7);border-top:none;border-radius:0 0 28px 28px;backdrop-filter:blur(2px);box-shadow:var(--shadow),inset 0 0 20px rgba(255,255,255,.3);overflow:hidden;}
.cc-lid{height:26px;background:linear-gradient(180deg,#8a5a2b,#6b4423);border-radius:10px 10px 0 0;margin:-4px -4px 0;box-shadow:0 3px 6px rgba(0,0,0,.2);position:relative;z-index:2;}
.cc-lid::after{content:"";position:absolute;left:50%;top:6px;transform:translateX(-50%);width:30px;height:8px;background:#a8722f;border-radius:4px;}
.cc-jar-inner{display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-end;gap:2px;padding:30px 12px 20px;min-height:180px;}
.cc-cookie{font-size:2rem;line-height:1;transform:rotate(var(--cc-rot,0deg));filter:drop-shadow(0 2px 2px rgba(120,72,20,.35));display:inline-block;}
.cc-options{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);max-width:440px;}
.cc-option{min-width:72px;height:72px;border:none;border-radius:18px;background:linear-gradient(180deg,#fff,${theme}33);font-size:2rem;font-weight:900;color:#333;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 10px rgba(0,0,0,.12);transition:transform .1s,box-shadow .1s;}
.cc-option:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.12);}
.cc-option--right{background:linear-gradient(180deg,#bff0c1,#6bcf7f);color:#1d6b2c;animation:cc-bounce .5s ease;}
.cc-option--wrong{background:linear-gradient(180deg,#ffd0c4,#ff8a72);animation:cc-shake .5s ease;}
@keyframes cc-bounce{0%,100%{transform:scale(1)}40%{transform:scale(1.18)}}
@keyframes cc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.cc-jar{width:170px;}.cc-cookie{font-size:1.7rem;}.cc-option{min-width:60px;height:62px;font-size:1.6rem;}}
`;
}

export function create(): CookieCountGame {
  return new CookieCountGame();
}
