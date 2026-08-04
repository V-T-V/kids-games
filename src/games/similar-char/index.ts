/* 形近字 Similar Char —— 给一个字，选"长得最像但不同"的字配对。
   独特点：字形相近字的视觉辨析（区别于同音字的语音辨析）。
   巧思：题面字与选项放大对比，找对后两字并排高亮，配放大镜动画。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Pair {
  base: string;
  twin: string;
}

const PAIRS: Pair[] = [
  { base: "人", twin: "入" },
  { base: "大", twin: "太" },
  { base: "王", twin: "玉" },
  { base: "日", twin: "目" },
  { base: "田", twin: "由" },
  { base: "木", twin: "本" },
  { base: "土", twin: "士" },
  { base: "未", twin: "末" },
  { base: "牛", twin: "午" },
  { base: "刀", twin: "力" },
  { base: "己", twin: "已" },
  { base: "人", twin: "八" },
  { base: "贝", twin: "见" },
  { base: "白", twin: "日" },
  { base: "月", twin: "用" },
  { base: "开", twin: "井" },
  { base: "儿", twin: "几" },
  { base: "甲", twin: "由" },
];

// 干扰字（与题面字不像）
const DISTRACTORS = [
  "水",
  "火",
  "山",
  "天",
  "口",
  "月",
  "上",
  "下",
  "多",
  "少",
];

export class SimilarCharGame extends BaseGame {
  constructor() {
    super("similar-char");
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

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const pair = sample(PAIRS);
    const target = pair.base;
    const answer = pair.twin;
    const distractN =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    // 干扰字不能与题面/答案重复，也不能与题面字太像（仅用池中其他字）
    const distract = shuffle(
      DISTRACTORS.filter((d) => d !== target && d !== answer),
    ).slice(0, distractN);
    const options = shuffle([answer, ...distract]);
    let answered = false;

    const wrap = document.createElement("div");
    wrap.className = "sc-wrap";

    const task = document.createElement("div");
    task.className = "sc-task";
    task.innerHTML = `哪个字和「<b>${target}</b>」长得<b>最像</b>？<span class="sc-hint">（第 ${this.roundsDone + 1}/${this.roundTotal} 题）</span>`;
    wrap.appendChild(task);

    const targetCard = document.createElement("div");
    targetCard.className = "sc-target";
    targetCard.innerHTML = `<div class="sc-magnifier">🔍</div><div class="sc-target__char">${target}</div>`;
    wrap.appendChild(targetCard);

    const tray = document.createElement("div");
    tray.className = "sc-tray";
    options.forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sc-opt";
      b.textContent = opt;
      b.addEventListener("click", () => {
        if (answered) return;
        if (opt === answer) {
          answered = true;
          b.classList.add("sc-opt--done");
          // 在题面旁并排显示配对结果
          targetCard.classList.add("sc-target--match");
          const match = document.createElement("div");
          match.className = "sc-match";
          match.textContent = opt;
          targetCard.appendChild(match);
          const r = b.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          this.roundsDone += 1;
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 1100);
        } else {
          b.classList.add("sc-opt--miss");
          const paused = this.onWrong();
          this.trackTimeout(() => b.classList.remove("sc-opt--miss"), 450);
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
      body: "比一比每个字的笔画，差一点点哦～",
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
    if (document.getElementById("sc-style")) return;
    const st = document.createElement("style");
    st.id = "sc-style";
    st.textContent = SC_CSS(getCssVar("--c-cyan"));
    document.head.appendChild(st);
  }
}

function SC_CSS(theme: string): string {
  return `
.sc-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(460px,100%);}
.sc-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.sc-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;margin-left:4px;}
.sc-target{position:relative;width:140px;height:140px;border-radius:24px;background:linear-gradient(135deg,#fff,${theme}44);box-shadow:var(--shadow-lg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:all .3s;}
.sc-magnifier{font-size:1.6rem;position:absolute;top:8px;right:10px;opacity:.6;animation:sc-search 2s ease-in-out infinite;}
.sc-target__char{font-size:5rem;font-weight:800;color:var(--ink);font-family:'KaiTi','STKaiti',serif;line-height:1;}
.sc-target--match{flex-direction:row;gap:8px;justify-content:center;}
.sc-target--match .sc-magnifier{display:none;}
.sc-target--match .sc-target__char{color:${theme};}
.sc-match{font-size:5rem;font-weight:800;color:#4ba85f;font-family:'KaiTi','STKaiti',serif;line-height:1;animation:sc-pop .5s ease;}
.sc-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding-top:10px;border-top:2px dashed #ddd;width:100%;max-width:380px;}
.sc-opt{width:74px;height:74px;border-radius:16px;font-size:2.2rem;font-weight:800;background:${theme};color:#064e4e;box-shadow:var(--shadow);font-family:'KaiTi','STKaiti',serif;transition:transform .15s;}
.sc-opt:active{transform:scale(.92);}
.sc-opt--done{background:linear-gradient(135deg,#6bcf7f,#4ba85f);color:#fff;animation:sc-pop .45s ease;}
.sc-opt--miss{animation:sc-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes sc-search{0%,100%{transform:translate(0,0) rotate(-8deg)}50%{transform:translate(-4px,3px) rotate(8deg)}}
@keyframes sc-pop{0%{transform:scale(.5)}60%{transform:scale(1.22)}100%{transform:scale(1)}}
@keyframes sc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): SimilarCharGame {
  return new SimilarCharGame();
}
