/* 颜色快闪 Color Flash —— Simon Says 风格：看颜色闪烁序列，然后按顺序重复。
   巧思：每轮序列+1，颜色越多越难；正确播放音阶；通关解锁"记忆好手"。
   3-6 岁：训练短期记忆 + 序列跟踪。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop, playNote } from "../../core/audio.ts";
import { burst, confetti } from "../../core/particles.ts";

const COLORS = [
  { id: 0, bg: "#e74c3c", lit: "#ff6b6b", note: "C4" }, // 红
  { id: 1, bg: "#3498db", lit: "#5dade2", note: "E4" }, // 蓝
  { id: 2, bg: "#f1c40f", lit: "#f7dc6f", note: "G4" }, // 黄
  { id: 3, bg: "#27ae60", lit: "#52be80", note: "C5" }, // 绿
] as const;

export class ColorFlashGame extends BaseGame {
  constructor() {
    super("color-flash");
  }

  private sequence: number[] = [];
  private roundTotal = 0;
  private userInput: number[] = [];
  private buttons: HTMLButtonElement[] = [];
  private acceptingInput = false;
  private statusEl: HTMLElement | null = null;
  private locked = false;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 5 : 7;
    this.injectStyle();
    this.buildUI();
    this.startNextRound();
  }

  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private buildUI(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "cfls-wrap";

    this.statusEl = document.createElement("div");
    this.statusEl.className = "cfls-status";
    wrap.appendChild(this.statusEl);

    const grid = document.createElement("div");
    grid.className = "cfls-grid";
    for (const c of COLORS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cfls-btn";
      btn.dataset["id"] = String(c.id);
      btn.style.setProperty("--cfls-bg", c.bg);
      btn.style.setProperty("--cfls-lit", c.lit);
      btn.addEventListener("click", () => this.handleClick(c.id));
      grid.appendChild(btn);
      this.buttons.push(btn);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private startNextRound(): void {
    if (this.sequence.length >= this.roundTotal) {
      this.finishClear(
        this.wrongCount === 0 ? 3 : this.wrongCount <= 2 ? 2 : 1,
      );
      return;
    }
    // 序列加一个随机色
    this.sequence.push(Math.floor(Math.random() * COLORS.length));
    this.userInput = [];
    this.acceptingInput = false;
    if (this.statusEl)
      this.statusEl.textContent = `第 ${this.sequence.length}/${this.roundTotal} 轮 · 仔细看...`;
    void this.playSequence();
  }

  private async playSequence(): Promise<void> {
    this.locked = true;
    await this.delay(600);
    for (const id of this.sequence) {
      await this.flashButton(id);
      await this.delay(250);
    }
    this.locked = false;
    this.acceptingInput = true;
    if (this.statusEl)
      this.statusEl.textContent = `第 ${this.sequence.length}/${this.roundTotal} 轮 · 该你了！`;
  }

  private async flashButton(id: number): Promise<void> {
    const btn = this.buttons[id];
    if (!btn) return;
    const c = COLORS[id]!;
    btn.classList.add("cfls-lit");
    playNote(c.note, 0.3);
    await this.delay(400);
    btn.classList.remove("cfls-lit");
  }

  private handleClick(id: number): void {
    if (!this.acceptingInput || this.locked) return;
    // 闪烁反馈
    void this.flashButton(id);

    this.userInput.push(id);
    const idx = this.userInput.length - 1;
    if (this.userInput[idx] !== this.sequence[idx]) {
      // 答错
      this.acceptingInput = false;
      this.onWrong();
      this.wrongCount++;
      if (this.statusEl) this.statusEl.textContent = "差点儿！再来一轮...";
      this.resetWrongStreak();
      // 原地重试本轮（不清空 sequence）
      this.userInput = [];
      setTimeout(() => {
        this.acceptingInput = false;
        if (this.statusEl)
          this.statusEl.textContent = `第 ${this.sequence.length}/${this.roundTotal} 轮 · 仔细看...`;
        void this.playSequence();
      }, 1000);
      return;
    }
    // 正确：播放音效 + 粒子
    this.onCorrect();
    sfxPop();
    burst(window.innerWidth / 2, window.innerHeight / 2, 6);

    // 本轮全部正确？
    if (this.userInput.length === this.sequence.length) {
      this.acceptingInput = false;
      this.resetWrongStreak();
      if (this.statusEl) this.statusEl.textContent = "✅ 棒极了！";
      confetti(30);
      setTimeout(() => this.startNextRound(), 800);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private injectStyle(): void {
    if (document.getElementById("cfls-style")) return;
    const style = document.createElement("style");
    style.id = "cfls-style";
    style.textContent = `
.cfls-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;padding:20px;}
.cfls-status{font-size:1.1rem;font-weight:700;color:var(--ink);text-align:center;min-height:2em;}
.cfls-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:min(280px,80vw);aspect-ratio:1;}
.cfls-btn{border:none;border-radius:16px;background:var(--cfls-bg);cursor:pointer;transition:filter .1s,transform .1s;box-shadow:var(--shadow);}
.cfls-btn:hover{filter:brightness(1.1);}
.cfls-btn:active{transform:scale(0.96);}
.cfls-btn.cfls-lit{background:var(--cfls-lit);filter:brightness(1.4);box-shadow:0 0 24px var(--cfls-lit);}
@media(min-width:600px){.cfls-grid{width:320px;}}
`;
    document.head.appendChild(style);
  }

  protected override afterClear(): void {
    // 困难零失误通关可以解锁成就（如果需要）
  }
}

export function create(): BaseGame {
  return new ColorFlashGame();
}
