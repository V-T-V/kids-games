/* 各国货币 Currency World —— 看一个货币符号或名称，选出它对应的国家。
   独特点：世界常识启蒙，认识钱。
   巧思：货币符号大字展示；难度=选项数；通关=答对目标轮数。前缀 cuw-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Currency {
  symbol: string; // 大字展示
  name: string; // 货币名
  country: string;
  flag: string;
}

const CURRENCIES: Currency[] = [
  { symbol: "¥", name: "人民币", country: "中国", flag: "🇨🇳" },
  { symbol: "$", name: "美元", country: "美国", flag: "🇺🇸" },
  { symbol: "€", name: "欧元", country: "法国", flag: "🇫🇷" },
  { symbol: "£", name: "英镑", country: "英国", flag: "🇬🇧" },
  { symbol: "¥", name: "日元", country: "日本", flag: "🇯🇵" },
  { symbol: "₩", name: "韩元", country: "韩国", flag: "🇰🇷" },
  { symbol: "₹", name: "卢比", country: "印度", flag: "🇮🇳" },
  { symbol: "₽", name: "卢布", country: "俄罗斯", flag: "🇷🇺" },
];

export class CurrencyWorldGame extends BaseGame {
  constructor() {
    super("currency-world");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Currency | null = null;
  /** 记录已用过的目标索引，避免重复出题（同符号¥的人民币/日元需区分） */
  private usedIdx: number[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.usedIdx = [];
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private choiceN(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 选一个未用过的目标（用尽则重置）
    let pool = CURRENCIES.map((_, i) => i).filter(
      (i) => !this.usedIdx.includes(i),
    );
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = CURRENCIES.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = CURRENCIES[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), CURRENCIES.length);
    const distractors = shuffle(
      CURRENCIES.filter((c) => c.country !== answer.country),
    ).slice(0, n - 1);
    const choices = shuffle([answer, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Currency, choices: Currency[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "cuw-wrap";

    const task = document.createElement("div");
    task.className = "cuw-task";
    task.innerHTML = `这是<b>哪个国家</b>的钱？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "cuw-stage";
    const sym = document.createElement("div");
    sym.className = "cuw-symbol";
    sym.textContent = answer.symbol;
    stage.appendChild(sym);
    const nm = document.createElement("div");
    nm.className = "cuw-currency-name";
    nm.textContent = answer.name;
    stage.appendChild(nm);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "cuw-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cuw-opt";
      b.innerHTML = `<span class="cuw-opt__flag">${c.flag}</span><span class="cuw-opt__name">${c.country}</span>`;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(c: Currency, btn: HTMLButtonElement): void {
    if (this.answered || !this.target) return;
    this.answered = true;
    const ok = c.country === this.target.country;
    if (ok) {
      btn.classList.add("cuw-opt--correct");
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
      btn.classList.add("cuw-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".cuw-opt--wrong")
          .forEach((el) => el.classList.remove("cuw-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("cuw-style")) return;
    const st = document.createElement("style");
    st.id = "cuw-style";
    st.textContent = CUW_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function CUW_CSS(theme: string): string {
  return `
.cuw-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.cuw-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.cuw-task b{color:${theme};}
.cuw-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.cuw-stage{display:flex;flex-direction:column;align-items:center;gap:6px;padding:24px 40px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 14%,#fff));border-radius:24px;box-shadow:var(--shadow);min-width:200px;}
.cuw-symbol{font-size:5.5rem;font-weight:900;line-height:1;color:${theme};text-shadow:0 4px 6px rgba(0,0,0,.12);}
.cuw-currency-name{font-size:1.2rem;font-weight:800;color:var(--ink-soft);}
.cuw-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:420px;}
@media (max-width:380px){.cuw-opts{grid-template-columns:1fr;}}
.cuw-opt{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 12px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#fff3e6);box-shadow:var(--shadow);cursor:pointer;transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;}
.cuw-opt:active{transform:scale(.95);}
.cuw-opt__flag{font-size:1.7rem;line-height:1;}
.cuw-opt__name{font-size:1.05rem;font-weight:800;color:var(--ink);}
.cuw-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:cuw-yes .4s ease;}
@keyframes cuw-yes{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
.cuw-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:cuw-no .3s ease;}
@keyframes cuw-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): CurrencyWorldGame {
  return new CurrencyWorldGame();
}
