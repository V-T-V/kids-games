/* 外星语 Alien Translate —— 先展示一组"外星符号"和它们对应的中文翻译，
   翻面后给一个符号问它代表什么，从选项里选对。
   独特点：用 emoji 当外星符号，配中文词，记忆+符号抽象启蒙；
   每轮符号随机抽取且翻译唯一映射，保证有解。
   视觉：外星符号卡 + 翻译文字 + 选项按钮。难度 = 符号数。通关 = 翻译对目标轮数。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { shuffle, sample, getCssVar } from "../../lobby/util.ts";

interface Pair {
  sym: string;
  word: string;
}

const DICT: Pair[] = [
  { sym: "🌟", word: "星星" },
  { sym: "🔥", word: "火" },
  { sym: "🌈", word: "彩虹" },
  { sym: "💧", word: "水" },
  { sym: "⚡", word: "闪电" },
  { sym: "❄️", word: "雪" },
  { sym: "🌻", word: "太阳" },
  { sym: "🌙", word: "月亮" },
  { sym: "🌳", word: "树" },
  { sym: "🌻", word: "花" },
  { sym: "🍃", word: "叶子" },
  { sym: "🪨", word: "石头" },
];

export class AlienTranslateGame extends BaseGame {
  constructor() {
    super("alien-translate");
  }

  private pairs: Pair[] = [];
  private roundsDone = 0;
  private roundTotal = 0;
  private locked = false;
  private phase: "show" | "ask" = "show";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private count(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.phase = "show";
    this.reportProgress(this.roundsDone, this.roundTotal);

    /* 选取本关符号（去掉重复翻译，保证每词唯一） */
    const unique = this.uniqueDict();
    this.pairs = shuffle(unique).slice(0, this.count());

    const wrap = document.createElement("div");
    wrap.className = "alt-wrap";
    const task = document.createElement("div");
    task.className = "alt-task";
    task.innerHTML = `👽 学外星语！记住符号的意思（第 ${this.roundsDone + 1}/${this.roundTotal} 关）`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "alt-stage";
    stage.id = "alt-stage";
    wrap.appendChild(stage);
    this.renderShow(stage);

    this.root.appendChild(wrap);
  }

  /** 去掉翻译重复的条目，保证每个词只出现一次（有唯一答案） */
  private uniqueDict(): Pair[] {
    const seen = new Set<string>();
    const out: Pair[] = [];
    for (const p of DICT) {
      if (!seen.has(p.word)) {
        seen.add(p.word);
        out.push(p);
      }
    }
    return out;
  }

  private renderShow(stage: HTMLElement): void {
    stage.innerHTML = "";
    stage.className = "alt-stage alt-stage--show";
    this.pairs.forEach((p) => {
      const card = document.createElement("div");
      card.className = "alt-card";
      const sym = document.createElement("div");
      sym.className = "alt-sym";
      sym.textContent = p.sym;
      const word = document.createElement("div");
      word.className = "alt-word";
      word.textContent = p.word;
      card.appendChild(sym);
      card.appendChild(word);
      stage.appendChild(card);
    });
    /* 一段时间后进入提问 */
    const showMs =
      this.difficulty === "easy"
        ? 3200
        : this.difficulty === "medium"
          ? 3000
          : 2800;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "alt-go";
    btn.textContent = "我记好了！";
    btn.addEventListener("click", () => this.toAsk());
    stage.parentElement!.appendChild(btn);

    /* 自动翻面 */
    this.trackTimeout(() => {
      if (this.phase === "show") this.toAsk();
    }, showMs);
  }

  private toAsk(): void {
    if (this.phase !== "show") return;
    this.phase = "ask";
    const wrap = this.root.querySelector(".alt-wrap") as HTMLElement | null;
    if (!wrap) return;
    /* 移除"我记好了"按钮 */
    const go = wrap.querySelector(".alt-go");
    if (go) go.remove();
    const stage = this.root.querySelector("#alt-stage") as HTMLElement | null;
    if (!stage) return;

    /* 随机挑一个符号问 */
    const target = sample(this.pairs);
    /* 构造选项：正确 + 其余词里的干扰项 */
    const distractors = shuffle(
      this.uniqueDict().filter(
        (p) => !this.pairs.some((q) => q.word === p.word),
      ),
    ).slice(0, 3);
    const opts = shuffle([target, ...distractors]);

    stage.className = "alt-stage alt-stage--ask";
    stage.innerHTML = "";
    const prompt = document.createElement("div");
    prompt.className = "alt-prompt";
    prompt.innerHTML = `<span class="alt-prompt-sym">${target.sym}</span><span class="alt-prompt-q">这个外星符号是什么意思？</span>`;
    stage.appendChild(prompt);

    const optsEl = document.createElement("div");
    optsEl.className = "alt-opts";
    opts.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "alt-opt";
      b.textContent = o.word;
      b.addEventListener("click", () => this.answer(o, target, b));
      optsEl.appendChild(b);
    });
    stage.appendChild(optsEl);
  }

  private answer(chosen: Pair, target: Pair, btn: HTMLButtonElement): void {
    if (this.locked) return;
    this.locked = true;
    if (chosen.word === target.word) {
      btn.classList.add("alt-opt--ok");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 900);
    } else {
      btn.classList.add("alt-opt--bad");
      this.onWrong();
      /* 高亮正确答案，短暂后允许再选 */
      const stage = this.root.querySelector("#alt-stage");
      if (stage) {
        stage.querySelectorAll<HTMLElement>(".alt-opt").forEach((el) => {
          if (el.textContent === target.word) el.classList.add("alt-opt--hint");
        });
      }
      this.trackTimeout(() => {
        this.locked = false;
        btn.classList.remove("alt-opt--bad");
        btn.disabled = true;
      }, 800);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("alt-style")) return;
    const st = document.createElement("style");
    st.id = "alt-style";
    st.textContent = ALT_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function ALT_CSS(theme: string): string {
  return `
.alt-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);}
.alt-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:8px 18px;border-radius:999px;box-shadow:var(--shadow);}
.alt-stage{width:100%;display:flex;flex-direction:column;align-items:center;gap:14px;}
.alt-stage--show{flex-direction:row;flex-wrap:wrap;justify-content:center;}
.alt-card{display:flex;flex-direction:column;align-items:center;gap:6px;background:linear-gradient(160deg,#1a2a4a,#0d1830);border:2px solid ${theme};border-radius:16px;padding:14px 18px;min-width:88px;box-shadow:0 4px 12px rgba(0,0,0,.3);animation:alt-pop .3s ease;}
@keyframes alt-pop{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
.alt-sym{font-size:2.6rem;line-height:1;filter:drop-shadow(0 0 8px ${theme});}
.alt-word{font-size:1.1rem;font-weight:800;color:#fff;}
.alt-go{align-self:center;font-size:1rem;font-weight:800;padding:12px 28px;border:none;border-radius:999px;background:linear-gradient(180deg,${theme},#2a8a3a);color:#fff;box-shadow:var(--shadow);cursor:pointer;animation:alt-pulse 1s ease-in-out infinite alternate;}
@keyframes alt-pulse{from{transform:scale(1)}to{transform:scale(1.06)}}
.alt-go:active{transform:scale(.94);}
.alt-prompt{display:flex;flex-direction:column;align-items:center;gap:8px;background:#fff;padding:16px 24px;border-radius:18px;box-shadow:var(--shadow);}
.alt-prompt-sym{font-size:3rem;line-height:1;animation:alt-float 1.4s ease-in-out infinite alternate;}
@keyframes alt-float{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(-6px) rotate(4deg)}}
.alt-prompt-q{font-size:1rem;font-weight:700;color:#444;}
.alt-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;width:100%;max-width:340px;}
.alt-opt{font-size:1.1rem;font-weight:800;padding:16px 12px;border:none;border-radius:14px;background:#fff;box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;}
.alt-opt:active{transform:scale(.95);}
.alt-opt--ok{background:linear-gradient(135deg,#6bcf7f,#4CAF50);color:#fff;animation:alt-ok .4s ease;}
@keyframes alt-ok{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
.alt-opt--bad{background:#ffb3b3;color:#fff;animation:alt-shake .4s ease;}
@keyframes alt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.alt-opt--hint{outline:3px solid #6bcf7f;}
@media (max-width:380px){.alt-sym{font-size:2.2rem;}.alt-card{min-width:74px;padding:10px 14px;}.alt-opt{font-size:1rem;padding:14px 8px;}}
`;
}

export function create(): AlienTranslateGame {
  return new AlienTranslateGame();
}
