/* 回声唱歌 Echo Song —— 听一句简单的旋律，数一数"听到了几个音"，选出来。
   独特点：听觉计数（把音乐和数数结合）。
   巧思：用 playMelody 合成一小段旋律，音符数 2-5 个；可重听；难度=轮数。
   通关=答对目标轮数。前缀 ecs-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { playMelody, sfxPop } from "../../core/audio.ts";
import { getCssVar, randInt, sample } from "../../lobby/util.ts";

// 可用音名池（C 大调中音区）
const POOL = ["C4", "D4", "E4", "G4", "A4", "C5"];

export class EchoSongGame extends BaseGame {
  constructor() {
    super("echo-song");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private count = 3; // 本轮正确音符数

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root.innerHTML 清空；定时器由基类清理 */
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    // 音符数范围随难度
    const minN = this.difficulty === "easy" ? 2 : 3;
    const maxN = this.difficulty === "hard" ? 5 : 4;
    this.count = randInt(minN, maxN);
    this.render();
    this.trackTimeout(() => this.playSong(), 500);
  }

  private render(): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "ecs-wrap";

    const task = document.createElement("div");
    task.className = "ecs-task";
    task.innerHTML = `听这句小旋律，<b>听到了几个音？</b><small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const speaker = document.createElement("button");
    speaker.type = "button";
    speaker.className = "ecs-speaker";
    speaker.textContent = "🔊 再听一遍";
    speaker.addEventListener("click", () => this.playSong());
    wrap.appendChild(speaker);

    // 选项：2-5 四个数字
    const opts = document.createElement("div");
    opts.className = "ecs-opts";
    const choices = sample([["2", "3", "4", "5"]])!;
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ecs-opt";
      b.textContent = c;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  /** 生成并播放本轮旋律。 */
  private playSong(): void {
    const notes: string[] = [];
    for (let i = 0; i < this.count; i++) {
      notes.push(sample(POOL));
    }
    playMelody(notes, 0.34);
  }

  private choose(c: string, btn: HTMLButtonElement): void {
    if (this.answered) return;
    this.answered = true;
    const ok = Number(c) === this.count;
    if (ok) {
      btn.classList.add("ecs-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      sfxPop();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("ecs-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".ecs-opt--wrong")
          .forEach((el) => el.classList.remove("ecs-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("ecs-style")) return;
    const st = document.createElement("style");
    st.id = "ecs-style";
    st.textContent = ECS_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function ECS_CSS(theme: string): string {
  return `
.ecs-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.ecs-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.ecs-task b{color:${theme};}
.ecs-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.ecs-speaker{padding:18px 32px;border:none;border-radius:999px;background:linear-gradient(135deg,${theme},#ffb84d);color:#5a4500;font-size:1.2rem;font-weight:900;cursor:pointer;box-shadow:var(--shadow);transition:transform .12s ease;animation:ecs-pulse 1.6s ease-in-out infinite;}
@keyframes ecs-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.ecs-speaker:active{transform:scale(.94);}
.ecs-opts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;width:100%;max-width:420px;}
@media (max-width:380px){.ecs-opts{grid-template-columns:repeat(2,1fr);}}
.ecs-opt{padding:22px 8px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#fff7d6);box-shadow:var(--shadow);cursor:pointer;font-size:2rem;font-weight:900;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:72px;}
.ecs-opt:active{transform:scale(.93);}
.ecs-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:ecs-yes .4s ease;}
@keyframes ecs-yes{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
.ecs-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:ecs-no .3s ease;}
@keyframes ecs-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): EchoSongGame {
  return new EchoSongGame();
}
