/* 唐诗三百首精选 Tang Sanbai —— 展示一首唐诗，挖掉一句，从 4 个选项选出正确句。
   与 classical-poem 不同诗库（游子吟/相思/绝句等），避免重复。
   语言启蒙：经典唐诗启蒙，培养语感与记忆。前缀 tsb-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Poem {
  title: string;
  author: string;
  lines: string[];
}

const POEMS: Poem[] = [
  {
    title: "游子吟",
    author: "孟郊",
    lines: ["慈母手中线", "游子身上衣", "临行密密缝", "意恐迟迟归"],
  },
  {
    title: "悯农·其二",
    author: "李绅",
    lines: ["春种一粒粟", "秋收万颗子", "四海无闲田", "农夫犹饿死"],
  },
  {
    title: "相思",
    author: "王维",
    lines: ["红豆生南国", "春来发几枝", "愿君多采撷", "此物最相思"],
  },
  {
    title: "杂诗",
    author: "王维",
    lines: ["君自故乡来", "应知故乡事", "来日绮窗前", "寒梅著花未"],
  },
  {
    title: "鸟鸣涧",
    author: "王维",
    lines: ["人闲桂花落", "夜静春山空", "月出惊山鸟", "时鸣春涧中"],
  },
  {
    title: "绝句",
    author: "杜甫",
    lines: [
      "两个黄鹂鸣翠柳",
      "一行白鹭上青天",
      "窗含西岭千秋雪",
      "门泊东吴万里船",
    ],
  },
  {
    title: "江畔独步寻花",
    author: "杜甫",
    lines: [
      "黄四娘家花满蹊",
      "千朵万朵压枝低",
      "留连戏蝶时时舞",
      "自在娇莺恰恰啼",
    ],
  },
  {
    title: "赠汪伦",
    author: "李白",
    lines: [
      "李白乘舟将欲行",
      "忽闻岸上踏歌声",
      "桃花潭水深千尺",
      "不及汪伦送我情",
    ],
  },
];

export class TangSanbaiGame extends BaseGame {
  constructor() {
    super("tang-sanbai");
  }
  private roundsDone = 0;
  private roundTotal = 0;
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

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const poem = sample(POEMS);
    const blankIdx = Math.floor(Math.random() * 4);
    const answer = poem.lines[blankIdx]!;
    // 干扰项：从其他诗中随机抽 3 句，长度相近优先
    const pool: string[] = [];
    for (const p of POEMS) {
      if (p.title === poem.title) continue;
      for (const ln of p.lines) {
        if (ln.length === answer.length) pool.push(ln);
      }
    }
    const distractors = shuffle(pool).slice(0, 3);
    // 若干扰不足 3 个，从全集中补齐
    if (distractors.length < 3) {
      const extras = shuffle(
        POEMS.flatMap((p) => p.lines).filter(
          (l) => l !== answer && !distractors.includes(l),
        ),
      );
      while (distractors.length < 3 && extras.length > 0) {
        distractors.push(extras.shift()!);
      }
    }
    const options = shuffle([answer, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "tsb-wrap";

    const task = document.createElement("div");
    task.className = "tsb-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 《${poem.title}》缺了哪一句？选出来～`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "tsb-card";
    const head = document.createElement("div");
    head.className = "tsb-card__head";
    head.innerHTML = `<span class="tsb-title">${poem.title}</span><span class="tsb-author">【${poem.author}】</span>`;
    card.appendChild(head);

    const body = document.createElement("div");
    body.className = "tsb-body";
    poem.lines.forEach((ln, i) => {
      const lineEl = document.createElement("div");
      lineEl.className = "tsb-line";
      if (i === blankIdx) {
        lineEl.classList.add("tsb-line--blank");
        lineEl.innerHTML = `<span class="tsb-blank">？（缺了哪一句）</span>`;
      } else {
        lineEl.textContent = ln;
      }
      body.appendChild(lineEl);
    });
    card.appendChild(body);
    wrap.appendChild(card);

    const opts = document.createElement("div");
    opts.className = "tsb-opts";
    options.forEach((text) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tsb-opt";
      b.textContent = text;
      b.addEventListener("click", () => this.choose(text, answer, b, opts));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(
    text: string,
    answer: string,
    btn: HTMLButtonElement,
    grid: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (text === answer) {
      this.locked = true;
      sfxPop();
      btn.classList.add("tsb-opt--right");
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".tsb-opt").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("tsb-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("tsb-opt--wrong"), 400);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "📜",
      variant: "rest",
      body: "读一读剩下的三句，想想这首诗讲的是什么，缺的那句该填哪一句～",
      primary: { text: "继续", icon: "✨", onClick: () => ov.destroy() },
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
    if (document.getElementById("tsb-style")) return;
    const st = document.createElement("style");
    st.id = "tsb-style";
    st.textContent = TSB_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function TSB_CSS(theme: string): string {
  return `
.tsb-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.tsb-task{font-size:1.02rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);max-width:100%;}
.tsb-card{background:linear-gradient(180deg,#fffaf0,#fdf2cf);border:3px double ${theme};border-radius:22px;padding:22px 26px;width:100%;box-sizing:border-box;box-shadow:var(--shadow);}
.tsb-card__head{text-align:center;margin-bottom:14px;}
.tsb-title{font-size:1.5rem;font-weight:900;color:#4a3a8a;letter-spacing:4px;}
.tsb-author{font-size:0.95rem;color:#7a6abf;margin-left:8px;}
.tsb-body{display:flex;flex-direction:column;gap:8px;}
.tsb-line{font-size:1.3rem;font-weight:700;color:#3a2a60;text-align:center;letter-spacing:2px;font-family:"STKaiti","KaiTi",serif;}
.tsb-line--blank{min-height:2rem;}
.tsb-blank{display:inline-block;color:${theme};font-weight:900;font-size:1.1rem;background:rgba(99,102,241,.25);padding:2px 12px;border-radius:8px;animation:tsb-blink 1.2s ease-in-out infinite;}
@keyframes tsb-blink{0%,100%{opacity:.7}50%{opacity:1}}
.tsb-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;max-width:460px;}
.tsb-opt{min-height:54px;background:#fff;border-radius:16px;box-shadow:var(--shadow);padding:10px 14px;font-size:1.15rem;font-weight:800;color:#3a2a60;letter-spacing:2px;font-family:"STKaiti","KaiTi",serif;cursor:pointer;transition:transform .12s;}
.tsb-opt:active{transform:scale(.97);}
.tsb-opt--right{background:#d4f4dd;outline:4px solid #34c759;}
.tsb-opt--wrong{background:#ffe0e0;outline:4px solid #ff3b30;animation:tsb-shake .4s ease;}
@keyframes tsb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): TangSanbaiGame {
  return new TangSanbaiGame();
}
