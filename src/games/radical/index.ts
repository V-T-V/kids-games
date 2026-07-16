/* 部首配对 Radical —— 给一个部首，选出含该部首的字。
   独特点：部首→汉字的结构归属识别（区别于形近字的笔画辨析）。
   巧思：部首用毛笔风大字，选中正确字卡片亮金边，错卡摇晃。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface RadicalEntry {
  radical: string;
  words: string[];
  distract: string[];
}

const DATA: RadicalEntry[] = [
  {
    radical: "氵",
    words: ["河", "海", "洗", "清"],
    distract: ["山", "木", "日", "田", "口", "人"],
  },
  {
    radical: "木",
    words: ["树", "林", "桥", "桌"],
    distract: ["水", "火", "日", "月", "石", "手"],
  },
  {
    radical: "口",
    words: ["唱", "吃", "叫", "听"],
    distract: ["山", "水", "木", "日", "天", "人"],
  },
  {
    radical: "日",
    words: ["明", "晴", "早", "晚"],
    distract: ["水", "木", "山", "月", "人", "田"],
  },
  {
    radical: "心",
    words: ["想", "忘", "念", "意"],
    distract: ["水", "木", "山", "日", "口", "人"],
  },
  {
    radical: "扌",
    words: ["打", "拍", "拉", "拿"],
    distract: ["水", "木", "山", "日", "口", "月"],
  },
];

export class RadicalGame extends BaseGame {
  constructor() {
    super("radical");
  }
  private roundsDone = 0;
  private roundTotal = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 3 : this.difficulty === "medium" ? 4 : 5;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 root 清空 */
  }

  private startRound(): void {
    this.root.innerHTML = "";
    const entry = sample(DATA);
    // 正确数与干扰数随难度；至少 2 正确
    const okN =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 3;
    const badN =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    const correct = shuffle(entry.words).slice(0, okN);
    const distract = shuffle(entry.distract).slice(0, badN);
    const options = shuffle([...correct, ...distract]);
    let found = 0;

    const wrap = document.createElement("div");
    wrap.className = "rd-wrap";

    const task = document.createElement("div");
    task.className = "rd-task";
    task.innerHTML = `选出含有部首「<b>${entry.radical}</b>」的字<br><span class="rd-hint">一共 ${correct.length} 个，全部找出来～</span>`;
    wrap.appendChild(task);

    const brush = document.createElement("div");
    brush.className = "rd-brush";
    brush.textContent = entry.radical;
    wrap.appendChild(brush);

    const grid = document.createElement("div");
    grid.className = "rd-grid";
    options.forEach((ch) => {
      const isRight = correct.includes(ch);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rd-card";
      b.textContent = ch;
      b.addEventListener("click", () => {
        if (
          b.classList.contains("rd-card--done") ||
          b.classList.contains("rd-card--miss")
        )
          return;
        if (isRight) {
          b.classList.add("rd-card--done");
          const r = b.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          found += 1;
          if (found >= correct.length) {
            this.roundsDone += 1;
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal)
                this.finishClear(starsByAccuracy(this.wrongCount));
              else this.startRound();
            }, 900);
          }
        } else {
          b.classList.add("rd-card--miss");
          const paused = this.onWrong();
          this.trackTimeout(() => b.classList.remove("rd-card--miss"), 450);
          if (paused) this.showRest();
        }
      });
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
    sfxPop();
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "仔细看看哪个字里有这个部首～",
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
    if (document.getElementById("rd-style")) return;
    const st = document.createElement("style");
    st.id = "rd-style";
    st.textContent = RD_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function RD_CSS(theme: string): string {
  return `
.rd-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(480px,100%);}
.rd-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.rd-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;}
.rd-brush{width:110px;height:110px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:4.5rem;font-weight:800;color:#fff;background:radial-gradient(circle at 35% 30%,${theme},#4f46e5);box-shadow:var(--shadow-lg);font-family:'KaiTi','STKaiti',serif;animation:rd-float 3s ease-in-out infinite;}
.rd-grid{display:grid;grid-template-columns:repeat(3,84px);gap:14px;justify-content:center;}
.rd-card{width:84px;height:84px;border-radius:18px;font-size:2.4rem;font-weight:800;background:#fff;color:var(--ink);box-shadow:var(--shadow);font-family:'KaiTi','STKaiti',serif;transition:transform .15s;}
.rd-card:active{transform:scale(.92);}
.rd-card--done{background:linear-gradient(135deg,#6bcf7f,#4ba85f);color:#fff;animation:rd-pop .4s ease;}
.rd-card--miss{animation:rd-shake .4s ease;background:#ffd0cc;}
@keyframes rd-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes rd-pop{0%{transform:scale(.6)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes rd-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): RadicalGame {
  return new RadicalGame();
}
