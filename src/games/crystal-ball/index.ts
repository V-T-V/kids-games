/* 水晶球 Crystal Ball —— 水晶球里浮现一串按规律重复的图案序列
   （如 ⭐🌙⭐🌙⭐?），问"下一个是什么"，孩子从选项里挑。
   独特点：规律预测 + 单选。序列在水晶球内逐个亮起展示，末尾是问号，
   下方选项卡含答案 + 干扰项。点对问号变成答案图案并闪光。
   视觉：发光水晶球 + 序列图案。难度=循环节长度/序列长度。通关=预测对目标轮数。
   解保证：循环节长度 ≤ 图案池大小，序列按周期严格重复，答案唯一确定。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

const ICONS = [
  "⭐",
  "🌙",
  "☀️",
  "🌈",
  "❄️",
  "🔥",
  "💧",
  "🌿",
  "⚡",
  "🌸",
] as const;

/** 生成长度 len、循环节 period 的重复序列。 */
function genSequence(
  len: number,
  period: number,
  pool: readonly string[],
): string[] {
  const cycle = shuffle(pool).slice(0, period);
  const seq: string[] = [];
  for (let i = 0; i < len; i++) seq.push(cycle[i % period]!);
  return seq;
}

/** 序列下一个 = 第 (len % period) 位的循环元。 */
function nextOf(seq: string[], period: number): string {
  return seq[seq.length % period] ?? seq[0]!;
}

export class CrystalBallGame extends BaseGame {
  constructor() {
    super("crystal-ball");
  }

  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const period =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 2 : 3;
    const len =
      this.difficulty === "easy" ? 5 : this.difficulty === "medium" ? 7 : 8;
    const seq = genSequence(len, period, ICONS as unknown as string[]);
    const answer = nextOf(seq, period);

    // 选项：答案 + 3 个干扰（来自池且不等于答案）
    const distract: string[] = [];
    while (distract.length < 3) {
      const c = sample(ICONS);
      if (c !== answer && !distract.includes(c)) distract.push(c);
    }
    const choices = shuffle([answer, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "crb-wrap";
    const task = document.createElement("div");
    task.className = "crb-task";
    task.innerHTML = `水晶球里的图案在重复，猜猜 <b>？</b> 处该是什么？（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    // 水晶球
    const ball = document.createElement("div");
    ball.className = "crb-ball";
    ball.innerHTML = `<div class="crb-glow"></div>`;
    const seqEl = document.createElement("div");
    seqEl.className = "crb-seq";
    seqEl.id = "crb-seq";
    ball.appendChild(seqEl);
    const base = document.createElement("div");
    base.className = "crb-base";
    ball.appendChild(base);
    wrap.appendChild(ball);

    // 逐个亮起序列图案
    seq.forEach((s, i) => {
      this.trackTimeout(
        () => {
          const cell = document.createElement("span");
          cell.className = "crb-icon crb-icon--show";
          cell.textContent = s;
          seqEl.appendChild(cell);
          sfxPop();
        },
        i * 350 + 300,
      );
    });
    // 末尾问号
    this.trackTimeout(
      () => {
        const q = document.createElement("span");
        q.className = "crb-icon crb-icon--q";
        q.id = "crb-q";
        q.textContent = "？";
        seqEl.appendChild(q);
      },
      seq.length * 350 + 300,
    );

    // 选项
    const opts = document.createElement("div");
    opts.className = "crb-opts";
    opts.id = "crb-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "crb-choice";
      b.textContent = c;
      b.addEventListener("click", () => this.choose(c, answer, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(c: string, answer: string, btn: HTMLButtonElement): void {
    if (btn.disabled) return;
    if (c === answer) {
      btn.classList.add("crb-choice--done");
      // 锁定所有选项
      this.root
        .querySelectorAll<HTMLButtonElement>(".crb-choice")
        .forEach((x) => (x.disabled = true));
      // 问号变答案 + 闪光
      const q = this.root.querySelector("#crb-q");
      if (q) {
        q.textContent = answer;
        q.classList.add("crb-icon--reveal");
      }
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("crb-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("crb-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "找找图案是怎么重复的，下一个就会是重复的那个～",
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
    if (document.getElementById("crb-style")) return;
    const st = document.createElement("style");
    st.id = "crb-style";
    st.textContent = CRB_CSS(getCssVar("--c-blue"));
    document.head.appendChild(st);
  }
}

function CRB_CSS(theme: string): string {
  return `
.crb-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.crb-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.crb-ball{position:relative;width:min(340px,92%);min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 16px 24px;background:radial-gradient(circle at 38% 30%,rgba(255,255,255,.6),rgba(77,150,255,.25) 55%,rgba(99,102,241,.35));border-radius:50% 50% 44% 44%/55% 55% 45% 45%;box-shadow:inset -10px -14px 30px rgba(40,60,140,.3),0 0 30px rgba(77,150,255,.35),var(--shadow);overflow:hidden;}
.crb-glow{position:absolute;top:14%;left:18%;width:30%;height:24%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.8),transparent 70%);filter:blur(2px);}
.crb-seq{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:280px;}
.crb-icon{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,.85);font-size:1.5rem;box-shadow:var(--shadow);}
.crb-icon--show{animation:crb-appear .35s ease;}
.crb-icon--q{background:${theme};color:#fff;font-weight:900;font-size:1.6rem;animation:crb-blink 1s ease infinite;}
.crb-icon--reveal{background:#d4f4dd;color:#1a7a3a;animation:crb-pop .4s ease;}
@keyframes crb-appear{0%{transform:scale(0) rotate(-20deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes crb-blink{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes crb-pop{0%{transform:scale(.5)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
.crb-base{width:62%;height:26px;margin-top:8px;background:linear-gradient(#6b4a2a,#3a2810);border-radius:50%;box-shadow:var(--shadow);align-self:center;z-index:1;}
.crb-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.crb-choice{width:72px;height:72px;font-size:2rem;border-radius:18px;background:#fff;box-shadow:var(--shadow);border:none;cursor:pointer;transition:transform .12s;}
.crb-choice:active{transform:scale(.92);}
.crb-choice--done{background:#d4f4dd;outline:4px solid ${theme};outline-offset:2px;animation:crb-pop .4s ease;}
.crb-choice--wrong{animation:crb-shake .4s ease;}
.crb-choice:disabled{cursor:default;}
@keyframes crb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): CrystalBallGame {
  return new CrystalBallGame();
}
