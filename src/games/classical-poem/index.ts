/* 古诗学习 Classical Poem —— 展示一首简单古诗，随机挖掉一句，从 3 个选项选出正确的那一句。
   语言启蒙：经典古诗启蒙（咏鹅/静夜思/春晓等），培养语感与记忆。
   独特点：古诗排版古风化，挖空处显眼，让娃感受诗意美。前缀 cpm-。 */

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
    title: "咏鹅",
    author: "骆宾王",
    lines: ["鹅鹅鹅", "曲项向天歌", "白毛浮绿水", "红掌拨清波"],
  },
  {
    title: "静夜思",
    author: "李白",
    lines: ["床前明月光", "疑是地上霜", "举头望明月", "低头思故乡"],
  },
  {
    title: "春晓",
    author: "孟浩然",
    lines: ["春眠不觉晓", "处处闻啼鸟", "夜来风雨声", "花落知多少"],
  },
  {
    title: "悯农",
    author: "李绅",
    lines: ["锄禾日当午", "汗滴禾下土", "谁知盘中餐", "粒粒皆辛苦"],
  },
  {
    title: "登鹳雀楼",
    author: "王之涣",
    lines: ["白日依山尽", "黄河入海流", "欲穷千里目", "更上一层楼"],
  },
  {
    title: "江雪",
    author: "柳宗元",
    lines: ["千山鸟飞绝", "万径人踪灭", "孤舟蓑笠翁", "独钓寒江雪"],
  },
  {
    title: "寻隐者不遇",
    author: "贾岛",
    lines: ["松下问童子", "言师采药去", "只在此山中", "云深不知处"],
  },
  {
    title: "鹿柴",
    author: "王维",
    lines: ["空山不见人", "但闻人语响", "返景入深林", "复照青苔上"],
  },
];

export class ClassicalPoemGame extends BaseGame {
  constructor() {
    super("classical-poem");
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
    // 干扰项：从其他诗中随机抽 2 句，长度相近避免一眼假
    const pool: string[] = [];
    for (const p of POEMS) {
      if (p.title === poem.title) continue;
      for (const ln of p.lines) {
        if (ln.length === answer.length) pool.push(ln);
      }
    }
    const distractors = shuffle(pool).slice(0, 2);
    // 若干扰不足 2 个（极少），从全集中补
    if (distractors.length < 2) {
      const extras = shuffle(
        POEMS.flatMap((p) => p.lines).filter(
          (l) => l !== answer && !distractors.includes(l),
        ),
      );
      while (distractors.length < 2 && extras.length > 0) {
        distractors.push(extras.shift()!);
      }
    }
    const options = shuffle([answer, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "cpm-wrap";

    const task = document.createElement("div");
    task.className = "cpm-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 《${poem.title}》缺了哪一句？选出来～`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "cpm-card";
    const head = document.createElement("div");
    head.className = "cpm-card__head";
    head.innerHTML = `<span class="cpm-title">${poem.title}</span><span class="cpm-author">【${poem.author}】</span>`;
    card.appendChild(head);

    const body = document.createElement("div");
    body.className = "cpm-body";
    poem.lines.forEach((ln, i) => {
      const lineEl = document.createElement("div");
      lineEl.className = "cpm-line";
      if (i === blankIdx) {
        lineEl.classList.add("cpm-line--blank");
        lineEl.innerHTML = `<span class="cpm-blank">？（缺了哪一句）</span>`;
      } else {
        lineEl.textContent = ln;
      }
      body.appendChild(lineEl);
    });
    card.appendChild(body);
    wrap.appendChild(card);

    const opts = document.createElement("div");
    opts.className = "cpm-opts";
    options.forEach((text) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cpm-opt";
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
      btn.classList.add("cpm-opt--right");
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".cpm-opt").forEach((el) => {
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
      btn.classList.add("cpm-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("cpm-opt--wrong"), 400);
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
    if (document.getElementById("cpm-style")) return;
    const st = document.createElement("style");
    st.id = "cpm-style";
    st.textContent = CP_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function CP_CSS(theme: string): string {
  return `
.cpm-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.cpm-task{font-size:1.02rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);max-width:100%;}
.cpm-card{background:linear-gradient(180deg,#fffaf0,#fdf2cf);border:3px double ${theme};border-radius:22px;padding:22px 26px;width:100%;box-sizing:border-box;box-shadow:var(--shadow);}
.cpm-card__head{text-align:center;margin-bottom:14px;}
.cpm-title{font-size:1.5rem;font-weight:900;color:#8a5a1a;letter-spacing:4px;}
.cpm-author{font-size:0.95rem;color:#a8842f;margin-left:8px;}
.cpm-body{display:flex;flex-direction:column;gap:8px;}
.cpm-line{font-size:1.35rem;font-weight:700;color:#5a3a10;text-align:center;letter-spacing:2px;font-family:"STKaiti","KaiTi",serif;}
.cpm-line--blank{min-height:2rem;}
.cpm-blank{display:inline-block;color:${theme};font-weight:900;font-size:1.1rem;background:rgba(255,217,61,.3);padding:2px 12px;border-radius:8px;animation:cpm-blink 1.2s ease-in-out infinite;}
@keyframes cpm-blink{0%,100%{opacity:.7}50%{opacity:1}}
.cpm-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.cpm-opt{min-height:54px;background:#fff;border-radius:16px;box-shadow:var(--shadow);padding:12px 20px;font-size:1.25rem;font-weight:800;color:#5a3a10;letter-spacing:2px;font-family:"STKaiti","KaiTi",serif;cursor:pointer;transition:transform .12s;}
.cpm-opt:active{transform:scale(.97);}
.cpm-opt--right{background:#d4f4dd;outline:4px solid #34c759;}
.cpm-opt--wrong{background:#ffe0e0;outline:4px solid #ff3b30;animation:cpm-shake .4s ease;}
@keyframes cpm-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): ClassicalPoemGame {
  return new ClassicalPoemGame();
}
