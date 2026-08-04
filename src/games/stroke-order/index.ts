/* 笔画顺序 Stroke Order —— 把字拆成笔画，按正确笔顺依次点击。
   独特点：笔顺序列的有序还原（区别于形近字的辨析选择）。
   巧思：笔画卡乱序排列，点对依次上色并显示顺序号，组成完整字。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface CharEntry {
  char: string;
  strokes: string[];
}

// 笔顺数据（按规范书写顺序）
const CHARS: CharEntry[] = [
  { char: "一", strokes: ["横"] },
  { char: "二", strokes: ["横", "横"] },
  { char: "十", strokes: ["横", "竖"] },
  { char: "三", strokes: ["横", "横", "横"] },
  { char: "口", strokes: ["竖", "横折", "横"] },
  { char: "日", strokes: ["竖", "横折", "横", "横"] },
];

export class StrokeOrderGame extends BaseGame {
  constructor() {
    super("stroke-order");
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
    /* DOM 由 root 清空 */
  }

  private pool(): CharEntry[] {
    // easy: 笔画<=2；medium: <=3；hard: 全部
    const max =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 99;
    return CHARS.filter((c) => c.strokes.length <= max);
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const entry = sample(this.pool());
    const ordered = entry.strokes;
    // 卡片：打乱顺序，记录每张卡的原始 label
    const cards = shuffle(ordered.map((label) => ({ label })));
    let step = 0;

    const wrap = document.createElement("div");
    wrap.className = "so-wrap";

    const task = document.createElement("div");
    task.className = "so-task";
    task.innerHTML = `按笔顺把「<b>${entry.char}</b>」写出来～<br><span class="so-hint">从第一笔开始，一笔一笔点（第 ${this.roundsDone + 1}/${this.roundTotal} 字）</span>`;
    wrap.appendChild(task);

    const bigChar = document.createElement("div");
    bigChar.className = "so-bigchar";
    bigChar.textContent = entry.char;
    wrap.appendChild(bigChar);

    // 已点笔画进度条（显示顺序号）
    const progress = document.createElement("div");
    progress.className = "so-progress";
    progress.id = "so-progress";
    for (let i = 0; i < ordered.length; i++) {
      const s = document.createElement("div");
      s.className = "so-seq";
      s.textContent = "？";
      progress.appendChild(s);
    }
    wrap.appendChild(progress);

    const tray = document.createElement("div");
    tray.className = "so-tray";
    cards.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "so-card";
      b.textContent = c.label;
      b.addEventListener("click", () => {
        if (b.classList.contains("so-card--used")) return;
        const expected = ordered[step];
        if (c.label === expected) {
          b.classList.add("so-card--used");
          b.dataset.seq = String(step + 1);
          b.textContent = `${step + 1}`;
          // 进度条
          const seqs = progress.querySelectorAll(".so-seq");
          const cur = seqs[step] as HTMLElement | undefined;
          if (cur) {
            cur.textContent = `${step + 1}`;
            cur.classList.add("so-seq--done");
          }
          const r = b.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          step += 1;
          if (step >= ordered.length) {
            this.roundsDone += 1;
            bigChar.classList.add("so-bigchar--done");
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal)
                this.finishClear(starsByAccuracy(this.wrongCount));
              else this.startRound();
            }, 1100);
          }
        } else {
          b.classList.add("so-card--miss");
          const paused = this.onWrong();
          this.trackTimeout(() => b.classList.remove("so-card--miss"), 450);
          if (paused) this.showRest();
        }
      });
      tray.appendChild(b);
    });
    wrap.appendChild(tray);
    this.root.appendChild(wrap);
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "写字要从上到下、从左到右哦～",
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
    if (document.getElementById("so-style")) return;
    const st = document.createElement("style");
    st.id = "so-style";
    st.textContent = SO_CSS(getCssVar("--c-brown"));
    document.head.appendChild(st);
  }
}

function SO_CSS(theme: string): string {
  return `
.so-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.so-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.so-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.so-bigchar{width:120px;height:120px;border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:5rem;font-weight:800;color:#fff;background:linear-gradient(135deg,${theme},#8a6d52);box-shadow:var(--shadow-lg);font-family:'KaiTi','STKaiti',serif;transition:transform .3s;}
.so-bigchar--done{animation:so-pop .5s ease;background:linear-gradient(135deg,#6bcf7f,#4ba85f);}
.so-progress{display:flex;gap:8px;}
.so-seq{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:800;background:#fff;color:var(--ink-soft);box-shadow:var(--shadow);}
.so-seq--done{background:${theme};color:#fff;animation:so-pop .35s ease;}
.so-tray{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding-top:8px;border-top:2px dashed #ddd;width:100%;max-width:380px;}
.so-card{min-width:78px;height:62px;padding:0 14px;border-radius:16px;font-size:1.5rem;font-weight:800;background:#fff;color:var(--ink);box-shadow:var(--shadow);font-family:'KaiTi','STKaiti',serif;transition:transform .15s;}
.so-card:active{transform:scale(.92);}
.so-card--used{background:linear-gradient(135deg,#6bcf7f,#4ba85f);color:#fff;animation:so-pop .4s ease;pointer-events:none;}
.so-card--miss{animation:so-shake .4s ease;background:#ffd0cc;}
@keyframes so-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes so-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): StrokeOrderGame {
  return new StrokeOrderGame();
}
