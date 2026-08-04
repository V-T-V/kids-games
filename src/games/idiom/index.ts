/* 成语填字 Idiom —— 给一个缺字的成语，从选项选正确的字补全。
   独特点：固定四字成语的结构补全（区别于量词搭配的语法填空）。
   巧思：成语横排大字卡片，缺字处闪烁高亮，选对字弹跳嵌入。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Idiom {
  chars: [string, string, string, string];
  gap: number;
}

const IDIOMS: Idiom[] = [
  { chars: ["一", "心", "一", "意"], gap: 1 },
  { chars: ["三", "心", "二", "意"], gap: 2 },
  { chars: ["七", "上", "八", "下"], gap: 1 },
  { chars: ["九", "牛", "一", "毛"], gap: 2 },
  { chars: ["十", "全", "十", "美"], gap: 3 },
  { chars: ["五", "光", "十", "色"], gap: 1 },
  { chars: ["四", "面", "八", "方"], gap: 2 },
  { chars: ["一", "帆", "风", "顺"], gap: 3 },
  { chars: ["一", "诺", "千", "金"], gap: 2 },
  { chars: ["画", "蛇", "添", "足"], gap: 1 },
  { chars: ["守", "株", "待", "兔"], gap: 3 },
  { chars: ["井", "底", "之", "蛙"], gap: 2 },
  { chars: ["狐", "假", "虎", "威"], gap: 1 },
  { chars: ["对", "牛", "弹", "琴"], gap: 3 },
  { chars: ["拔", "苗", "助", "长"], gap: 2 },
  { chars: ["自", "相", "矛", "盾"], gap: 1 },
  { chars: ["掩", "耳", "盗", "铃"], gap: 3 },
  { chars: ["亡", "羊", "补", "牢"], gap: 2 },
  { chars: ["刻", "舟", "求", "剑"], gap: 1 },
  { chars: ["杯", "水", "车", "薪"], gap: 3 },
  { chars: ["朝", "三", "暮", "四"], gap: 2 },
  { chars: ["大", "海", "捞", "针"], gap: 1 },
  { chars: ["春", "暖", "花", "开"], gap: 3 },
  { chars: ["鸦", "雀", "无", "声"], gap: 2 },
  { chars: ["马", "到", "成", "功"], gap: 1 },
  { chars: ["鸡", "飞", "狗", "跳"], gap: 3 },
  { chars: ["虎", "头", "蛇", "尾"], gap: 2 },
  { chars: ["风", "和", "日", "丽"], gap: 1 },
  { chars: ["鸟", "语", "花", "香"], gap: 3 },
  { chars: ["金", "枝", "玉", "叶"], gap: 2 },
];

// 干扰字库
const DistrACTORS = [
  "人",
  "大",
  "小",
  "天",
  "口",
  "日",
  "月",
  "水",
  "火",
  "山",
  "上",
  "下",
  "左",
  "右",
  "多",
  "少",
];

export class IdiomGame extends BaseGame {
  constructor() {
    super("idiom");
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
    const idiom = sample(IDIOMS);
    const answer = idiom.chars[idiom.gap]!;
    const distractN =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    // 干扰字不能与答案重复，也不与成语中其它字重复
    const used = new Set([...idiom.chars]);
    const distract = shuffle(DistrACTORS.filter((d) => !used.has(d))).slice(
      0,
      distractN,
    );
    const options = shuffle([answer, ...distract]);
    let answered = false;

    const wrap = document.createElement("div");
    wrap.className = "id-wrap";

    const task = document.createElement("div");
    task.className = "id-task";
    task.innerHTML = `猜猜缺的字是哪个？<span class="id-hint">（第 ${this.roundsDone + 1}/${this.roundTotal} 题）</span>`;
    wrap.appendChild(task);

    // 成语卡片
    const card = document.createElement("div");
    card.className = "id-card";
    idiom.chars.forEach((c, i) => {
      const cell = document.createElement("div");
      cell.className = "id-cell";
      if (i === idiom.gap) {
        cell.classList.add("id-cell--gap");
        cell.textContent = "？";
        cell.id = "id-gap";
      } else {
        cell.textContent = c;
      }
      card.appendChild(cell);
    });
    wrap.appendChild(card);

    const tray = document.createElement("div");
    tray.className = "id-tray";
    options.forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "id-opt";
      b.textContent = opt;
      b.addEventListener("click", () => {
        if (answered) return;
        if (opt === answer) {
          answered = true;
          b.classList.add("id-opt--done");
          const gap = document.getElementById("id-gap");
          if (gap) {
            gap.textContent = answer;
            gap.classList.remove("id-cell--gap");
            gap.classList.add("id-cell--fill");
            const r = gap.getBoundingClientRect();
            this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          }
          this.resetWrongStreak();
          this.roundsDone += 1;
          this.trackTimeout(() => {
            if (this.roundsDone >= this.roundTotal)
              this.finishClear(starsByAccuracy(this.wrongCount));
            else this.startRound();
          }, 1000);
        } else {
          b.classList.add("id-opt--miss");
          const paused = this.onWrong();
          this.trackTimeout(() => b.classList.remove("id-opt--miss"), 450);
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
      body: "想想这个成语平时怎么说～",
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
    if (document.getElementById("id-style")) return;
    const st = document.createElement("style");
    st.id = "id-style";
    st.textContent = ID_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function ID_CSS(theme: string): string {
  return `
.id-wrap{display:flex;flex-direction:column;align-items:center;gap:24px;width:min(460px,100%);}
.id-task{font-size:1.1rem;font-weight:800;text-align:center;}
.id-hint{font-size:.85rem;color:var(--ink-soft);font-weight:600;margin-left:4px;}
.id-card{display:flex;gap:10px;padding:18px;border-radius:22px;background:linear-gradient(135deg,#fff,${theme}22);box-shadow:var(--shadow-lg);}
.id-cell{width:72px;height:84px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:2.6rem;font-weight:800;color:var(--ink);background:#fff;box-shadow:var(--shadow);font-family:'KaiTi','STKaiti',serif;}
.id-cell--gap{background:color-mix(in srgb,${theme} 18%,#fff);color:${theme};animation:id-blink 1s ease-in-out infinite;}
.id-cell--fill{background:#d4f4dd;color:#4ba85f;animation:id-pop .5s ease;}
.id-tray{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding-top:10px;border-top:2px dashed #ddd;width:100%;max-width:380px;}
.id-opt{width:68px;height:68px;border-radius:16px;font-size:2rem;font-weight:800;background:${theme};color:#fff;box-shadow:var(--shadow);font-family:'KaiTi','STKaiti',serif;transition:transform .15s;}
.id-opt:active{transform:scale(.92);}
.id-opt--done{opacity:.35;pointer-events:none;}
.id-opt--miss{animation:id-shake .4s ease;background:#ff6348;}
@keyframes id-blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.08)}}
@keyframes id-pop{0%{transform:scale(.5) rotate(-10deg)}60%{transform:scale(1.25) rotate(5deg)}100%{transform:scale(1) rotate(0)}}
@keyframes id-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): IdiomGame {
  return new IdiomGame();
}
