/* 同音字 Homophone —— 给一个字，选出和它读音相同（同音）的字。
   独特点：语音相同字形不同的辨析（区别于形近字的长相辨析）。
   巧思：字卡上显示拼音音标提示，让孩子用耳朵听辨字形差异。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface HGroup {
  pinyin: string;
  chars: string[];
}

// 真实同音字组（带拼音音标）
const GROUPS: HGroup[] = [
  { pinyin: "cháng", chars: ["长", "常"] },
  { pinyin: "míng", chars: ["明", "名"] },
  { pinyin: "yǒu", chars: ["有", "友"] },
  { pinyin: "shí", chars: ["时", "石"] },
  { pinyin: "lǐ", chars: ["里", "李"] },
  { pinyin: "shí", chars: ["十", "石"] },
  { pinyin: "huā", chars: ["花", "哗"] },
  { pinyin: "mǎ", chars: ["马", "码"] },
];

// 干扰字（读音不同）
const DISTRACTORS = [
  "大",
  "小",
  "水",
  "火",
  "山",
  "天",
  "口",
  "日",
  "月",
  "木",
  "人",
  "上",
];

export class HomophoneGame extends BaseGame {
  constructor() {
    super("homophone");
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
    const group = sample(GROUPS);
    // 题面字与答案字（同组两个，互为同音）
    const [target, answer] = shuffle(group.chars) as [string, string];
    const distractN =
      this.difficulty === "easy" ? 2 : this.difficulty === "medium" ? 3 : 4;
    const distract = shuffle(
      DISTRACTORS.filter((d) => d !== target && d !== answer),
    ).slice(0, distractN);
    const options = shuffle([answer, ...distract]);
    let answered = false;

    const wrap = document.createElement("div");
    wrap.className = "ho-wrap";

    const task = document.createElement("div");
    task.className = "ho-task";
    task.innerHTML = `找出和「<b>${target}</b>」读音<b>一样</b>的字<span class="ho-hint">（第 ${this.roundsDone + 1}/${this.roundTotal} 题）</span>`;
    wrap.appendChild(task);

    // 题面字卡（带音标）
    const targetCard = document.createElement("div");
    targetCard.className = "ho-target";
    targetCard.innerHTML = `<div class="ho-target__pinyin">${group.pinyin}</div><div class="ho-target__char">${target}</div>`;
    wrap.appendChild(targetCard);

    const tray = document.createElement("div");
    tray.className = "ho-tray";
    options.forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ho-opt";
      b.textContent = opt;
      b.addEventListener("click", () => {
        if (answered) return;
        if (opt === answer) {
          answered = true;
          b.classList.add("ho-opt--done");
          const r = b.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          this.roundsDone += 1;
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 1000);
        } else {
          b.classList.add("ho-opt--miss");
          const paused = this.onWrong();
          this.trackTimeout(() => b.classList.remove("ho-opt--miss"), 450);
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
      body: "把每个字念一念，听哪个读音一样～",
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
    if (document.getElementById("ho-style")) return;
    const st = document.createElement("style");
    st.id = "ho-style";
    st.textContent = HO_CSS(getCssVar("--c-yellow"));
    document.head.appendChild(st);
  }
}

function HO_CSS(theme: string): string {
  return `
.ho-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(460px,100%);}
.ho-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.ho-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;margin-left:4px;}
.ho-target{width:130px;padding:14px;border-radius:22px;background:linear-gradient(135deg,#fff,${theme}55);box-shadow:var(--shadow-lg);display:flex;flex-direction:column;align-items:center;gap:6px;}
.ho-target__pinyin{font-size:1.1rem;font-weight:700;color:var(--ink-soft);font-style:italic;}
.ho-target__char{font-size:4rem;font-weight:800;color:var(--ink);font-family:'KaiTi','STKaiti',serif;line-height:1;}
.ho-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding-top:10px;border-top:2px dashed #ddd;width:100%;max-width:380px;}
.ho-opt{width:72px;height:72px;border-radius:16px;font-size:2.2rem;font-weight:800;background:${theme};color:#5a4a20;box-shadow:var(--shadow);font-family:'KaiTi','STKaiti',serif;transition:transform .15s;}
.ho-opt:active{transform:scale(.92);}
.ho-opt--done{background:linear-gradient(135deg,#6bcf7f,#4ba85f);color:#fff;animation:ho-pop .45s ease;}
.ho-opt--miss{animation:ho-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes ho-pop{0%{transform:scale(.5)}60%{transform:scale(1.22)}100%{transform:scale(1)}}
@keyframes ho-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): HomophoneGame {
  return new HomophoneGame();
}
