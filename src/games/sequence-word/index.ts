/* 词语排序 Sequence-Word —— 一组动作词被打乱（如 穿鞋/穿袜/出门），
   孩子按正确顺序依次点出来。
   独特点：训练"做事的先后顺序"——生活常识 + 时序逻辑。
   巧思：用孩子熟悉的日常流程（穿衣、洗漱、做饭），按对一词填一格并出现序号；
         区别于 story-order 的"图片排序"，这里只有文字，更考察语言理解。
   视觉：序号槽 + 乱序词卡。难度=词数。通关=排对目标轮数。
   前缀 sqw-（sequence-word）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

/** 一组动作序列：按正确顺序排列的词。 */
interface Seq {
  /** 流程标题 */
  title: string;
  /** 图标（emoji，用于装饰） */
  icon: string;
  /** 正确顺序的词 */
  order: string[];
}

const SEQS: Seq[] = [
  {
    title: "穿衣服",
    icon: "👕",
    order: ["穿内裤", "穿上衣", "穿裤子", "穿袜子", "穿鞋"],
  },
  {
    title: "刷牙",
    icon: "🪥",
    order: ["拿牙刷", "挤牙膏", "刷牙", "漱口", "放好牙刷"],
  },
  {
    title: "吃早饭",
    icon: "🥣",
    order: ["洗手", "盛饭", "坐下", "吃饭", "收拾碗"],
  },
  {
    title: "画画",
    icon: "🎨",
    order: ["拿画笔", "蘸颜料", "画图案", "晾干", "收画笔"],
  },
  {
    title: "种花",
    icon: "🌱",
    order: ["挖坑", "放种子", "盖土", "浇水", "晒太阳"],
  },
  {
    title: "出门上学",
    icon: "🎒",
    order: ["背书包", "穿鞋", "开门", "走路", "到学校"],
  },
  {
    title: "洗手",
    icon: "🚰",
    order: ["开水龙头", "打湿手", "抹肥皂", "搓手", "冲干净"],
  },
  {
    title: "睡觉",
    icon: "😴",
    order: ["洗脸", "换睡衣", "上床", "盖被子", "关灯"],
  },
];

export class SequenceWordGame extends BaseGame {
  constructor() {
    super("sequence-word");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  /** 当前已排对的词数。 */
  private picked = 0;

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 难度=词数：easy=3 / medium=4 / hard=5。 */
  private wordCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.picked = 0;

    const seq = sample(SEQS);
    const n = Math.min(this.wordCount(), seq.order.length);
    const correctOrder = seq.order.slice(0, n);
    const shown = shuffle(correctOrder);

    const wrap = document.createElement("div");
    wrap.className = "sqw-wrap";

    const task = document.createElement("div");
    task.className = "sqw-task";
    task.innerHTML = `${seq.icon} <b>${seq.title}</b>：按<b>先后顺序</b>点词<br><span class="sqw-hint">先做的先点（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    // 序号槽：显示已点对的词
    const slots = document.createElement("div");
    slots.className = "sqw-slots";
    for (let i = 0; i < n; i++) {
      const slot = document.createElement("div");
      slot.className = "sqw-slot";
      slot.dataset.idx = String(i);
      slot.innerHTML = `<span class="sqw-slot__num">${i + 1}</span><span class="sqw-slot__text">？</span>`;
      slots.appendChild(slot);
    }
    wrap.appendChild(slots);

    // 词卡库：乱序
    const pool = document.createElement("div");
    pool.className = "sqw-pool";
    shown.forEach((word, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sqw-card";
      b.dataset.idx = String(idx);
      b.textContent = word;
      b.addEventListener("click", () =>
        this.choose(word, correctOrder, b, slots),
      );
      pool.appendChild(b);
    });
    wrap.appendChild(pool);
    this.root.appendChild(wrap);
  }

  private choose(
    word: string,
    correctOrder: string[],
    btn: HTMLButtonElement,
    slots: HTMLElement,
  ): void {
    if (btn.classList.contains("sqw-card--used")) return;
    const expect = correctOrder[this.picked];
    if (expect && expect === word) {
      btn.classList.add("sqw-card--used");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      // 在对应槽位填充
      const slot = slots.querySelector<HTMLElement>(
        `.sqw-slot[data-idx="${this.picked}"]`,
      );
      if (slot) {
        slot.classList.add("sqw-slot--filled");
        const txt = slot.querySelector(".sqw-slot__text");
        if (txt) txt.textContent = word;
      }
      this.picked += 1;
      if (this.picked >= correctOrder.length) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal)
            this.finishClear(starsByAccuracy(this.wrongCount));
          else this.startRound();
        }, 1200);
      }
    } else {
      btn.classList.add("sqw-card--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("sqw-card--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想一想这件事<b>第一步</b>该做什么～",
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
    if (document.getElementById("sqw-style")) return;
    const st = document.createElement("style");
    st.id = "sqw-style";
    st.textContent = SQW_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function SQW_CSS(theme: string): string {
  return `
.sqw-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.sqw-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.sqw-hint{font-size:.82rem;color:var(--ink-soft,#888);font-weight:600;}
.sqw-slots{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding:12px 16px;background:rgba(255,255,255,.6);border-radius:18px;box-shadow:var(--shadow);min-height:64px;}
.sqw-slot{min-width:84px;height:60px;padding:0 12px;border:3px dashed #c7c7d1;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:8px;position:relative;background:#fff;font-weight:800;color:var(--ink,#333);font-size:1rem;}
.sqw-slot__num{background:#999;color:#fff;width:24px;height:24px;border-radius:50%;font-size:.85rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sqw-slot__text{color:#aaa;font-weight:700;}
.sqw-slot--filled{border:3px solid ${theme};background:#e8eafe;animation:sqw-fill .35s ease;}
.sqw-slot--filled .sqw-slot__num{background:${theme};}
.sqw-slot--filled .sqw-slot__text{color:var(--ink,#333);}
.sqw-pool{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding-top:6px;}
.sqw-card{min-width:90px;background:#fff;border:3px solid #e6e6ee;border-radius:18px;box-shadow:var(--shadow);padding:14px 16px;font-size:1.05rem;font-weight:800;color:var(--ink,#333);cursor:pointer;transition:transform .15s,opacity .2s;}
.sqw-card:active{transform:scale(.93);}
.sqw-card--used{opacity:.3;pointer-events:none;background:#eee;text-decoration:line-through;}
.sqw-card--wrong{background:#ff6348;color:#fff;border-color:#ff6348;animation:sqw-shake .4s ease;}
@keyframes sqw-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes sqw-fill{0%{transform:scale(.5)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
@media (max-width:380px){.sqw-card{min-width:76px;padding:11px 10px;font-size:.95rem;}.sqw-slot{min-width:70px;font-size:.9rem;}}
`;
}

export function create(): SequenceWordGame {
  return new SequenceWordGame();
}
