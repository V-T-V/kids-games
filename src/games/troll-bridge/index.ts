/* 巨魔桥 Troll Bridge —— 巨魔守桥，出一道简单谜题（加法/比大小/数数），
   答对才能过桥，独特点：闯关问答 + 过桥动画。
   视觉：巨魔 + 木桥 + 选项木板。难度=题难度。通关=过桥目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, randInt, shuffle } from "../../lobby/util.ts";

interface Puzzle {
  /** 题面（HTML） */
  prompt: string;
  /** 选项 */
  choices: string[];
  /** 正确答案 */
  answer: string;
}

/** 生成一道谜题。保证有正确选项。 */
function genPuzzle(diff: string): Puzzle {
  const types =
    diff === "easy"
      ? (["add", "bigger"] as const)
      : diff === "medium"
        ? (["add", "sub", "bigger", "smaller"] as const)
        : (["add", "sub", "bigger", "smaller"] as const);
  const t = types[randInt(0, types.length - 1)]!;
  if (t === "add") {
    const max = diff === "easy" ? 5 : diff === "medium" ? 8 : 10;
    const a = randInt(1, max);
    const b = randInt(1, max);
    const ans = a + b;
    const opts = new Set<string>([String(ans)]);
    while (opts.size < 4) {
      const d = ans + randInt(-3, 3);
      if (d >= 0 && d !== ans) opts.add(String(d));
    }
    return {
      prompt: `${a} + ${b} = ?`,
      choices: shuffle([...opts]),
      answer: String(ans),
    };
  }
  if (t === "sub") {
    const max = diff === "medium" ? 8 : 12;
    const a = randInt(2, max);
    const b = randInt(1, a);
    const ans = a - b;
    const opts = new Set<string>([String(ans)]);
    while (opts.size < 4) {
      const d = ans + randInt(-3, 3);
      if (d >= 0 && d !== ans) opts.add(String(d));
    }
    return {
      prompt: `${a} − ${b} = ?`,
      choices: shuffle([...opts]),
      answer: String(ans),
    };
  }
  if (t === "bigger" || t === "smaller") {
    const max = diff === "easy" ? 5 : diff === "medium" ? 9 : 12;
    const a = randInt(1, max);
    let b = randInt(1, max);
    while (b === a) b = randInt(1, max);
    const ans = t === "bigger" ? Math.max(a, b) : Math.min(a, b);
    return {
      prompt: `${a} 和 ${b}，<b>${t === "bigger" ? "大" : "小"}</b>的是几？`,
      choices: shuffle([
        String(a),
        String(b),
        String(ans + 1 <= max ? ans + 1 : ans - 2),
        String(Math.abs(ans - 2) || ans + 3),
      ]),
      answer: String(ans),
    };
  }
  // 兜底（不会到达）
  return { prompt: "1 + 1 = ?", choices: ["1", "2", "3", "4"], answer: "2" };
}

export class TrollBridgeGame extends BaseGame {
  constructor() {
    super("troll-bridge");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  /** 当前勇士位置（0=左岸，1=过桥第一段，2=过桥第二段，3=右岸） */
  private heroStep = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由基类清空；定时器由基类清理 */
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const puzzle = genPuzzle(this.difficulty);

    const wrap = document.createElement("div");
    wrap.className = "trb-wrap";

    const task = document.createElement("div");
    task.className = "trb-task";
    task.innerHTML = `巨魔拦路啦！答对谜题才能过桥<br><span class="trb-hint">第 ${this.roundsDone + 1} / ${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "trb-stage";
    stage.innerHTML = `
      <div class="trb-banks">
        <span class="trb-hero" id="trb-hero">🧝</span>
        <span class="trb-troll">👹</span>
      </div>
      <div class="trb-bridge"></div>
    `;
    wrap.appendChild(stage);

    const q = document.createElement("div");
    q.className = "trb-q";
    q.innerHTML = puzzle.prompt;
    wrap.appendChild(q);

    const opts = document.createElement("div");
    opts.className = "trb-opts";
    puzzle.choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "trb-choice";
      b.textContent = c;
      b.addEventListener("click", () => this.choose(c, puzzle.answer, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
    this.heroStep = 0;
  }

  private choose(c: string, answer: string, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (c === answer) {
      this.answered = true;
      btn.classList.add("trb-choice--correct");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 勇士过桥动画
      this.advanceHero();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1200);
    } else {
      btn.classList.add("trb-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("trb-choice--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private advanceHero(): void {
    const hero = this.root.querySelector<HTMLElement>("#trb-hero");
    if (!hero) return;
    this.heroStep = 3; // 一次性走完桥
    hero.classList.add("trb-hero--cross");
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "算一算巨魔的谜题，答对就能过桥啦～",
      primary: { text: "继续", icon: "👹", onClick: () => ov.destroy() },
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
    if (document.getElementById("trb-style")) return;
    const st = document.createElement("style");
    st.id = "trb-style";
    st.textContent = TRB_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function TRB_CSS(theme: string): string {
  return `
.trb-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.trb-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;background:#fff;padding:10px 22px;border-radius:999px;box-shadow:var(--shadow);}
.trb-hint{font-size:.85rem;color:var(--ink-soft);font-weight:700;}
.trb-stage{position:relative;width:100%;height:140px;border-radius:20px;overflow:hidden;background:linear-gradient(180deg,#bfe3f5 0%,#7fc8e8 45%,#4a8fb8 100%);box-shadow:var(--shadow);}
.trb-stage::before{content:"";position:absolute;inset:auto 0 0 0;height:40%;background:repeating-linear-gradient(180deg,rgba(255,255,255,.4) 0 6px,transparent 6px 12px);}
.trb-banks{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:space-between;padding:0 8px;}
.trb-hero{position:absolute;left:6%;bottom:38%;font-size:2.6rem;z-index:3;transition:left 1s cubic-bezier(.5,0,.5,1);filter:drop-shadow(0 3px 3px rgba(0,0,0,.3));}
.trb-hero--cross{left:88% !important;animation:trb-walk 1s ease;}
@keyframes trb-walk{0%{transform:translateY(0)}25%{transform:translateY(-8px) rotate(-5deg)}50%{transform:translateY(0) rotate(5deg)}75%{transform:translateY(-8px) rotate(-5deg)}100%{transform:translateY(0)}}
.trb-troll{position:absolute;right:6%;bottom:38%;font-size:3rem;z-index:2;animation:trb-bounce 1.4s ease-in-out infinite;filter:drop-shadow(0 3px 3px rgba(0,0,0,.3));}
@keyframes trb-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.trb-bridge{position:absolute;left:12%;right:12%;bottom:32%;height:14px;background:repeating-linear-gradient(90deg,#b8893d 0 22px,#a87832 22px 24px);border-radius:4px;box-shadow:0 3px 5px rgba(0,0,0,.25);z-index:1;}
.trb-bridge::before,.trb-bridge::after{content:"";position:absolute;top:-22px;width:4px;height:30px;background:#a87832;border-radius:2px;}
.trb-bridge::before{left:8%;}.trb-bridge::after{right:8%;}
.trb-q{font-size:1.8rem;font-weight:900;text-align:center;background:#fff;padding:14px 28px;border-radius:18px;box-shadow:var(--shadow);color:#3a2e1a;}
.trb-q b{color:${theme};}
.trb-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.trb-choice{min-width:74px;height:64px;font-size:1.6rem;font-weight:900;border:none;border-radius:16px;background:linear-gradient(180deg,#fff,#f4e4c1);color:#3a2e1a;box-shadow:var(--shadow),inset 0 -3px 0 #d4b878;cursor:pointer;transition:transform .12s ease;}
.trb-choice:active{transform:translateY(2px);box-shadow:var(--shadow);}
.trb-choice--correct{background:linear-gradient(180deg,#d4f4dd,#a8e6b8);animation:trb-pop .4s ease;}
.trb-choice--wrong{animation:trb-shake .4s ease;}
@keyframes trb-pop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes trb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.trb-hero{font-size:2rem;}.trb-troll{font-size:2.4rem;}.trb-q{font-size:1.4rem;}.trb-choice{min-width:60px;height:54px;font-size:1.3rem;}}
`;
}

export function create(): TrollBridgeGame {
  return new TrollBridgeGame();
}
