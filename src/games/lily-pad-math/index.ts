/* 荷叶算术 Lily Pad Math —— 河面上几片荷叶各写一个数字，青蛙在起点，
   题目说「跳到等于 N 的荷叶」，孩子点数字等于 N 的荷叶，青蛙跳过去。
   独特点：把加法/减法结果呈现为「目标数」，孩子要做的是辨识哪个算式
   （或数字）等于目标值。每片荷叶上是一个算式或数字。难度=算式复杂度。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, sample, shuffle } from "../../lobby/util.ts";

interface Pad {
  /** 显示在荷叶上的内容（数字或算式） */
  label: string;
  value: number;
  el: HTMLButtonElement;
}

/** 生成值为 value 的若干算式/数字标签。 */
function genLabels(value: number, count: number, maxN: number): string[] {
  const out = new Set<string>();
  out.add(String(value));
  let guard = 0;
  while (out.size < count && guard < 200) {
    guard++;
    const a = randInt(0, Math.min(maxN, value));
    const b = value - a;
    if (b >= 0) out.add(`${a}+${b}`);
    if (value + 1 <= maxN) {
      const k = randInt(0, maxN - value);
      out.add(`${value + k}-${k}`);
    }
  }
  return [...out];
}

/** 生成值不等于 value 的若干干扰标签。 */
function genWrongLabels(value: number, count: number, maxN: number): string[] {
  const out = new Set<string>();
  let guard = 0;
  while (out.size < count && guard < 300) {
    guard++;
    const a = randInt(0, maxN);
    const b = randInt(0, maxN);
    if (a + b === value) continue;
    out.add(`${a}+${b}`);
  }
  return [...out];
}

export class LilyPadMathGame extends BaseGame {
  constructor() {
    super("lily-pad-math");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private currentTarget = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空 */
  }

  private padCount(): number {
    return this.difficulty === "easy"
      ? 4
      : this.difficulty === "medium"
        ? 6
        : 8;
  }
  private maxNumber(): number {
    return this.difficulty === "easy"
      ? 5
      : this.difficulty === "medium"
        ? 8
        : 10;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const maxN = this.maxNumber();
    const target = randInt(1, maxN);
    this.currentTarget = target;

    // 正确荷叶：1~2 片（玩家只需点其中任意一片即可通关）
    const total = this.padCount();
    const correctCount = randInt(1, Math.max(1, Math.floor(total / 3)));
    const correctLabels = shuffle(genLabels(target, correctCount, maxN));
    const wrongCount = Math.max(1, total - correctLabels.length);
    const wrongLabels = shuffle(genWrongLabels(target, wrongCount, maxN)).slice(
      0,
      wrongCount,
    );

    const pads: Pad[] = [];
    correctLabels.forEach((label) =>
      pads.push({ label, value: target, el: null as never }),
    );
    wrongLabels.forEach((label) => {
      const [aStr, bStr] = label.split("+");
      const v = (Number(aStr) || 0) + (Number(bStr) || 0);
      pads.push({ label, value: v, el: null as never });
    });

    // 兜底
    while (pads.length < total) {
      const a = randInt(0, maxN);
      const b = randInt(0, maxN);
      if (a + b !== target)
        pads.push({ label: `${a}+${b}`, value: a + b, el: null as never });
    }

    const wrap = document.createElement("div");
    wrap.className = "lpm-wrap";

    const task = document.createElement("div");
    task.className = "lpm-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 让青蛙跳到等于 <b class="lpm-target">${target}</b> 的荷叶`;
    wrap.appendChild(task);

    const pond = document.createElement("div");
    pond.className = "lpm-pond";

    // 青蛙（起点，左下角）
    const frog = document.createElement("div");
    frog.className = "lpm-frog";
    frog.id = "lpm-frog";
    frog.textContent = "🐸";
    pond.appendChild(frog);

    // 荷叶随机分布
    const positions = shuffle(Array.from({ length: total }, (_, i) => i));
    shuffle(pads).forEach((pad, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lpm-pad";
      const pos = positions[i]!;
      // 在池塘内分散布局
      const left = 8 + ((pos * 17) % 70);
      const top = 12 + ((pos * 29) % 65);
      btn.style.setProperty("--lpm-left", `${left}%`);
      btn.style.setProperty("--lpm-top", `${top}%`);
      btn.style.setProperty("--lpm-color", sample(PAD_COLORS));
      btn.style.setProperty("--lpm-delay", `${(pos % 5) * 0.4}s`);
      btn.innerHTML = `<span class="lpm-pad-label">${pad.label}</span>`;
      btn.addEventListener("click", () => this.jump(btn, pad, frog));
      pad.el = btn;
      pond.appendChild(btn);
    });

    wrap.appendChild(pond);
    this.root.appendChild(wrap);
  }

  private jump(btn: HTMLButtonElement, pad: Pad, frog: HTMLElement): void {
    if (btn.classList.contains("lpm-pad--used")) return;
    if (pad.value === this.currentTarget) {
      btn.classList.add("lpm-pad--used");
      sfxPop();
      // 青蛙跳到该荷叶
      const pond = btn.parentElement;
      if (pond) {
        const pRect = pond.getBoundingClientRect();
        const bRect = btn.getBoundingClientRect();
        frog.style.left = `${bRect.left - pRect.left + bRect.width / 2 - 22}px`;
        frog.style.top = `${bRect.top - pRect.top + bRect.height / 2 - 18}px`;
        frog.classList.add("lpm-frog--jump");
        this.trackTimeout(() => frog.classList.remove("lpm-frog--jump"), 500);
      }
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
      }, 800);
    } else {
      btn.classList.add("lpm-pad--shake");
      this.trackTimeout(() => btn.classList.remove("lpm-pad--shake"), 500);
      const paused = this.onWrong();
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: `算一算荷叶上的算式，等于 ${this.currentTarget} 才能跳上去哦～`,
      primary: { text: "继续", icon: "🐸", onClick: () => ov.destroy() },
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
    if (document.getElementById("lpm-style")) return;
    const st = document.createElement("style");
    st.id = "lpm-style";
    st.textContent = LPM_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

const PAD_COLORS = ["#6bcf7f", "#4d96ff", "#a55eea", "#ff9f43", "#22d3ee"];

function LPM_CSS(theme: string): string {
  return `
.lpm-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(560px,100%);}
.lpm-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.lpm-target{color:${theme};font-size:1.4rem;}
.lpm-pond{position:relative;width:100%;height:60vh;min-height:380px;max-height:520px;border-radius:24px;overflow:hidden;background:
  radial-gradient(circle at 20% 30%,rgba(255,255,255,.4),transparent 40%),
  radial-gradient(circle at 70% 60%,rgba(255,255,255,.3),transparent 35%),
  linear-gradient(180deg,#7fc8e8 0%,#5ba8d8 60%,#4a8fb8 100%);
  box-shadow:var(--shadow);}
.lpm-pond::before{content:"";position:absolute;inset:0;background:
  repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,.08) 40px,rgba(255,255,255,.08) 80px);
  animation:lpm-ripple 8s linear infinite;pointer-events:none;}
@keyframes lpm-ripple{0%{transform:translateX(0)}100%{transform:translateX(80px)}}
.lpm-pad{
  position:absolute;left:var(--lpm-left,10%);top:var(--lpm-top,20%);
  width:78px;height:60px;border:none;cursor:pointer;
  background:radial-gradient(ellipse at 50% 40%,color-mix(in srgb,var(--lpm-color,${theme}) 85%,#fff),var(--lpm-color,${theme}));
  border-radius:50%;
  box-shadow:inset 0 -6px 8px rgba(0,0,0,.2),0 4px 8px rgba(0,0,0,.2);
  display:flex;align-items:center;justify-content:center;
  animation:lpm-bob 3s ease-in-out var(--lpm-delay,0s) infinite;
  transition:transform .12s;
}
.lpm-pad::before{content:"";position:absolute;inset:18% 30% 22% 18%;background:rgba(0,0,0,.08);border-radius:50%;pointer-events:none;}
.lpm-pad:active{transform:scale(.92);}
.lpm-pad-label{font-size:1rem;font-weight:900;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);z-index:1;}
.lpm-pad--used{animation:lpm-sink .5s ease forwards;pointer-events:none;}
.lpm-pad--shake{animation:lpm-shake .5s ease;}
@keyframes lpm-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes lpm-sink{0%{transform:scale(1);opacity:1}100%{transform:scale(.5);opacity:0}}
@keyframes lpm-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px) rotate(-4deg)}75%{transform:translateX(6px) rotate(4deg)}}
.lpm-frog{position:absolute;left:6px;bottom:6px;font-size:2.6rem;transition:left .4s cubic-bezier(.5,-.3,.5,1.3),top .4s cubic-bezier(.5,-.3,.5,1.3);z-index:5;filter:drop-shadow(0 3px 3px rgba(0,0,0,.3));}
.lpm-frog--jump{animation:lpm-hop .5s ease;}
@keyframes lpm-hop{0%{transform:scale(1)}50%{transform:scale(1.2) translateY(-10px)}100%{transform:scale(1)}}
@media (max-width:380px){.lpm-pad{width:62px;height:48px;}.lpm-pad-label{font-size:.85rem;}.lpm-frog{font-size:2rem;}}
`;
}

export function create(): LilyPadMathGame {
  return new LilyPadMathGame();
}
