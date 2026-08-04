/* 爆米花 Popcorn Pop —— 锅里的玉米粒一颗一颗爆开变成爆米花，
   爆完后问"爆了几颗"，孩子从数字按钮里选出正确答案。
   独特点：先观察事件序列（计数），再回忆作答。训练短期计数 + 记忆。
   视觉：锅 + 🌽 玉米粒 → 🍿 爆米花 + 顶盖跳动。难度=玉米数(5-12)。通关=答对目标轮数。前缀 pcp-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

interface Kernel {
  el: HTMLElement;
  popped: boolean;
  /** 计划爆开的时间（毫秒，相对 startAt） */
  popAt: number;
}

export class PopcornPopGame extends BaseGame {
  constructor() {
    super("popcorn-pop");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private raf = 0;
  private last = 0;
  private startAt = 0;
  private over = false;
  private locked = false;
  /** 本轮玉米数（也是正确答案） */
  private answer = 0;
  private kernels: Kernel[] = [];
  private fieldEl: HTMLElement | null = null;
  private lidEl: HTMLElement | null = null;
  private phase: "pop" | "ask" = "pop";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 3 : 4;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private kernelCount(): number {
    if (this.difficulty === "easy") return randInt(5, 7);
    if (this.difficulty === "medium") return randInt(7, 9);
    return randInt(9, 12);
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.over = false;
    this.locked = false;
    this.phase = "pop";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const n = this.kernelCount();
    this.answer = n;
    this.kernels = [];

    const wrap = document.createElement("div");
    wrap.className = "pcp-wrap";

    const task = document.createElement("div");
    task.className = "pcp-task";
    task.id = "pcp-task";
    task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 数一数爆了几颗 🍿`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "pcp-stage";
    // 锅
    const pot = document.createElement("div");
    pot.className = "pcp-pot";
    const potBody = document.createElement("div");
    potBody.className = "pcp-pot-body";
    // 盖
    const lid = document.createElement("div");
    lid.className = "pcp-pot-lid";
    potBody.appendChild(lid);
    // 玉米粒容器
    const field = document.createElement("div");
    field.className = "pcp-field";
    potBody.appendChild(field);
    pot.appendChild(potBody);
    stage.appendChild(pot);
    wrap.appendChild(stage);

    this.root.appendChild(wrap);
    this.fieldEl = field;
    this.lidEl = lid;

    // 散布玉米粒位置 + 计划爆开时间
    const positions = this.scatter(n);
    const popTimes: number[] = [];
    for (let i = 0; i < n; i++) {
      // 爆开时间错落，从 0.8s 开始，每颗间隔 0.4~0.9s
      const base = i === 0 ? 800 : popTimes[i - 1]! + randInt(380, 850);
      popTimes.push(base);
    }
    // 时间打乱（更随机感）
    const shuffledTimes = shuffle(popTimes);
    for (let i = 0; i < n; i++) {
      const k = document.createElement("div");
      k.className = "pcp-kernel";
      k.textContent = "🌽";
      const p = positions[i]!;
      k.style.left = `${p[0]}%`;
      k.style.top = `${p[1]}%`;
      field.appendChild(k);
      this.kernels.push({
        el: k,
        popped: false,
        popAt: shuffledTimes[i]!,
      });
    }

    this.startAt = performance.now();
    this.last = this.startAt;
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (): void => {
    if (this.over) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    void dt;

    if (this.phase === "pop") {
      const elapsed = now - this.startAt;
      let allPopped = true;
      for (const k of this.kernels) {
        if (!k.popped && elapsed >= k.popAt) {
          k.popped = true;
          k.el.classList.add("pcp-kernel--pop");
          k.el.textContent = "🍿";
          sfxPop();
          // 盖子跳一下
          this.lidEl?.classList.add("pcp-pot-lid--jump");
          this.trackTimeout(
            () => this.lidEl?.classList.remove("pcp-pot-lid--jump"),
            220,
          );
        }
        if (!k.popped) allPopped = false;
      }
      if (allPopped) {
        // 全爆完，等待 0.8s 进入提问
        this.phase = "ask";
        this.trackTimeout(() => this.showQuestion(), 850);
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  /** 在锅里均匀散布玉米粒位置（保证不重叠且都在锅内）。 */
  private scatter(n: number): [number, number][] {
    const pts: [number, number][] = [];
    let guard = 0;
    while (pts.length < n && guard < 500) {
      guard += 1;
      const x = randInt(12, 88);
      const y = randInt(20, 82);
      const ok = pts.every(
        (p) => Math.abs(p[0] - x) > 14 || Math.abs(p[1] - y) > 14,
      );
      if (ok) pts.push([x, y]);
    }
    // 兜底：网格分布
    let i = 0;
    while (pts.length < n) {
      const cols = Math.ceil(Math.sqrt(n));
      const r = Math.floor(i / cols);
      const c = i % cols;
      pts.push([
        14 + (c * 72) / Math.max(1, cols - 1),
        24 + (r * 60) / Math.max(1, Math.ceil(n / cols) - 1 || 1),
      ]);
      i += 1;
    }
    return pts;
  }

  /** 显示提问与数字选项。 */
  private showQuestion(): void {
    if (this.over) return;
    this.phase = "ask";
    // 生成 4 个选项，包含正确答案，其余为相近数字
    const opts = new Set<number>([this.answer]);
    let guard = 0;
    while (opts.size < 4 && guard < 100) {
      guard += 1;
      const d = randInt(1, 3);
      const sign = Math.random() < 0.5 ? -1 : 1;
      const v = this.answer + sign * d;
      if (v >= 1 && v <= 15) opts.add(v);
    }
    // 兜底补齐
    let fill = this.answer + 1;
    while (opts.size < 4) {
      if (fill >= 1 && fill <= 15) opts.add(fill);
      fill += 1;
    }
    const options = shuffle([...opts]);

    // 替换 task 内容
    const task = this.root.querySelector("#pcp-task");
    if (task) {
      task.innerHTML = `第 <b>${this.roundsDone + 1}</b>/${this.roundTotal} 关 · 刚才爆了几颗 🍿？`;
    }

    const wrap = this.root.querySelector(".pcp-wrap");
    const choiceBox = document.createElement("div");
    choiceBox.className = "pcp-choices";
    options.forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pcp-choice";
      b.textContent = String(v);
      b.addEventListener("click", () => this.answerQ(v, b));
      choiceBox.appendChild(b);
    });
    if (wrap) wrap.appendChild(choiceBox);
  }

  private answerQ(v: number, btn: HTMLButtonElement): void {
    if (this.over || this.locked) return;
    this.locked = true;
    if (v === this.answer) {
      btn.classList.add("pcp-choice--right");
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
      btn.classList.add("pcp-choice--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        btn.classList.remove("pcp-choice--wrong");
        btn.disabled = true;
        this.locked = false;
      }, 700);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("pcp-style")) return;
    const st = document.createElement("style");
    st.id = "pcp-style";
    st.textContent = PCP_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function PCP_CSS(theme: string): string {
  void theme;
  return `
.pcp-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.pcp-task{font-size:1.15rem;font-weight:800;text-align:center;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.pcp-stage{width:100%;display:flex;align-items:center;justify-content:center;}
.pcp-pot{position:relative;width:340px;max-width:90vw;}
.pcp-pot-body{position:relative;width:100%;height:340px;max-height:65vw;background:linear-gradient(180deg,#ffd98a 0%,#ff9f43 50%,#e06a1a 100%);border-radius:30px 30px 50% 50%/30px 30px 30% 30%;box-shadow:0 12px 24px rgba(0,0,0,.25),inset 0 -10px 18px rgba(0,0,0,.25);overflow:hidden;}
.pcp-pot-lid{position:absolute;top:-14px;left:50%;transform:translateX(-50%);width:78%;height:36px;background:linear-gradient(180deg,#e8e8e8,#a0a0a0);border-radius:18px 18px 8px 8px;box-shadow:0 6px 12px rgba(0,0,0,.3);z-index:6;}
.pcp-pot-lid::after{content:"";position:absolute;left:50%;top:-10px;transform:translateX(-50%);width:22px;height:18px;background:linear-gradient(180deg,#b0b0b0,#707070);border-radius:50%;}
.pcp-pot-lid--jump{animation:pcp-lid .22s ease;}
@keyframes pcp-lid{0%{transform:translateX(-50%) translateY(0);}50%{transform:translateX(-50%) translateY(-8px);}100%{transform:translateX(-50%) translateY(0);}}
.pcp-field{position:absolute;inset:0;}
.pcp-kernel{position:absolute;width:36px;height:36px;font-size:1.6rem;line-height:36px;text-align:center;transform:translate(-50%,-50%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));}
.pcp-kernel--pop{animation:pcp-pop .35s cubic-bezier(.3,1.6,.5,1) both;}
@keyframes pcp-pop{0%{transform:translate(-50%,-50%) scale(0) rotate(-30deg);opacity:0;}60%{transform:translate(-50%,-50%) scale(1.4) rotate(20deg);opacity:1;}100%{transform:translate(-50%,-50%) scale(1) rotate(0);opacity:1;}}
.pcp-choices{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:100%;max-width:420px;}
.pcp-choice{font-size:1.6rem;font-weight:900;padding:18px 0;border:none;border-radius:18px;background:#fff;color:#333;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;}
.pcp-choice:active{transform:scale(.94);}
.pcp-choice--right{background:linear-gradient(135deg,#6bcf7f,#4ed976);color:#fff;animation:pcp-bounce .4s ease;}
.pcp-choice--wrong{background:linear-gradient(135deg,#ff6348,#e74c3c);color:#fff;animation:pcp-shake .3s ease;}
@keyframes pcp-bounce{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
@keyframes pcp-shake{25%{transform:translateX(-5px);}75%{transform:translateX(5px);}}
@media (max-width:380px){.pcp-pot{width:280px;}.pcp-pot-body{height:280px;}.pcp-kernel{width:30px;height:30px;font-size:1.3rem;}.pcp-choice{font-size:1.3rem;padding:14px 0;}}
`;
}

export function create(): PopcornPopGame {
  return new PopcornPopGame();
}
