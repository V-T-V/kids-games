/* 故事结尾 Story-End —— 一个简短故事的前半段（如"小兔子去采蘑菇，天黑了…"），
   从选项里选出最合理的结局（如"它赶紧回家了"）。
   独特点：考察故事理解 + 合情推理——预测"接下来最可能发生什么"。
   巧思：故事简短贴近儿童经验，干扰结局"也能讲通但不合理/不合常理"，
         需要孩子抓住故事的因果关系来判断。
   视觉：故事书卡片 + 结局选项。难度=选项数。通关=答对目标轮数。
   前缀 ste-（story-end）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Story {
  /** 故事图标 */
  icon: string;
  /** 前半段（已发生） */
  begin: string;
  /** 合理结局（正确） */
  right: string;
  /** 不太合理/不合常理的结局（干扰） */
  wrongs: string[];
}

const STORIES: Story[] = [
  {
    icon: "🐰",
    begin: "小兔子去森林采蘑菇，玩着玩着天黑了…",
    right: "它赶紧回家了",
    wrongs: ["它继续在森林里玩", "它跑进山洞睡觉", "它跳进河里"],
  },
  {
    icon: "🐦",
    begin: "小鸟从树上掉下来，翅膀受伤了…",
    right: "妈妈飞过来照顾它",
    wrongs: ["它马上飞走了", "它去水里游泳", "它躲进冰箱"],
  },
  {
    icon: "🌧️",
    begin: "放学时下大雨，小明没带伞…",
    right: "他等妈妈来接他",
    wrongs: ["他淋雨跑回家生病", "他飞回家", "他把书包扔了"],
  },
  {
    icon: "🍎",
    begin: "小猴子看到一个又红又大的苹果，可是够不到…",
    right: "它搬来凳子踩上去拿",
    wrongs: ["它生气地把树砍了", "它睡在树下等苹果飞来", "它跳进河里"],
  },
  {
    icon: "🐶",
    begin: "小狗的球掉进了河里，它不会游泳…",
    right: "它请大鹅帮忙捡回来",
    wrongs: ["它跳进河里", "它把河填平", "它对着河大哭一辈子"],
  },
  {
    icon: "🌙",
    begin: "晚上，宝宝的玩具熊不见了，房间很黑…",
    right: "妈妈开灯帮他找",
    wrongs: ["宝宝自己跑到街上找", "宝宝把家拆了", "宝宝睡了地上"],
  },
  {
    icon: "🐜",
    begin: "小蚂蚁发现一大块面包，自己搬不动…",
    right: "它叫来伙伴一起搬",
    wrongs: ["它一个人坐在那哭", "它把面包扔了", "它把家搬走"],
  },
  {
    icon: "🌻",
    begin: "小花苗一直没长大，叶子黄黄的…",
    right: "给它浇水和晒太阳",
    wrongs: ["把它拔出来", "把它放进冰箱", "用剪刀剪掉叶子"],
  },
];

export class StoryEndGame extends BaseGame {
  constructor() {
    super("story-end");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private recent: Story[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private pickStory(): Story {
    const avail = STORIES.filter((s) => !this.recent.includes(s));
    const chosen = avail.length > 0 ? sample(avail) : sample(STORIES);
    this.recent.push(chosen);
    if (this.recent.length > 3) this.recent.shift();
    return chosen;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const story = this.pickStory();
    const n = Math.min(this.optCount(), story.wrongs.length + 1);
    const wrongs = shuffle(story.wrongs).slice(0, n - 1);
    const options = shuffle([story.right, ...wrongs]);

    const wrap = document.createElement("div");
    wrap.className = "ste-wrap";

    const task = document.createElement("div");
    task.className = "ste-task";
    task.innerHTML = `听故事，选一个<b>最合理</b>的结局<br><span class="ste-hint">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const book = document.createElement("div");
    book.className = "ste-book";
    book.innerHTML = `<div class="ste-book__icon">${story.icon}</div><div class="ste-book__text">${story.begin}</div><div class="ste-book__dots">⋯</div>`;
    wrap.appendChild(book);

    const opts = document.createElement("div");
    opts.className = "ste-opts";
    options.forEach((text) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ste-opt";
      b.textContent = text;
      b.addEventListener("click", () => this.choose(text, story.right, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(text: string, right: string, btn: HTMLButtonElement): void {
    if (btn.classList.contains("ste-opt--lock")) return;
    if (text === right) {
      btn.classList.add("ste-opt--right");
      this.lockAll();
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1200);
    } else {
      btn.classList.add("ste-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ste-opt--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private lockAll(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>(".ste-opt")
      .forEach((b) => b.classList.add("ste-opt--lock"));
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想一想，故事里的小动物<b>最可能</b>怎么做～",
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
    if (document.getElementById("ste-style")) return;
    const st = document.createElement("style");
    st.id = "ste-style";
    st.textContent = STE_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function STE_CSS(theme: string): string {
  return `
.ste-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.ste-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.ste-hint{font-size:.8rem;color:var(--ink-soft,#888);font-weight:600;}
.ste-book{position:relative;width:min(460px,100%);min-height:150px;background:linear-gradient(135deg,#fffdf7,#fff5fa);border-radius:22px;box-shadow:var(--shadow);padding:24px 28px;display:flex;align-items:center;gap:16px;border-left:10px solid ${theme};}
.ste-book__icon{font-size:3rem;line-height:1;flex-shrink:0;background:#fff;border-radius:50%;width:64px;height:64px;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow);}
.ste-book__text{font-size:1.15rem;font-weight:700;color:var(--ink,#333);line-height:1.7;flex:1;}
.ste-book__dots{position:absolute;bottom:8px;right:18px;font-size:1.6rem;color:${theme};font-weight:900;letter-spacing:2px;}
.ste-opts{display:grid;grid-template-columns:1fr;gap:10px;width:min(460px,100%);}
.ste-opt{font-size:1.05rem;font-weight:700;color:var(--ink,#333);background:#fff;border:3px solid #e6e6ee;border-radius:16px;padding:14px 16px;cursor:pointer;transition:transform .12s,background .2s,border-color .2s;box-shadow:var(--shadow);text-align:left;}
.ste-opt:active{transform:scale(.97);}
.ste-opt--right{background:#d4f4dd;border-color:#6bcf7f;animation:ste-pop .35s ease;}
.ste-opt--wrong{background:#ffe0db;border-color:#ff6348;color:#c0392b;animation:ste-shake .4s ease;}
.ste-opt--lock{pointer-events:none;}
@keyframes ste-pop{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}
@keyframes ste-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.ste-book{padding:18px;}.ste-book__icon{width:52px;height:52px;font-size:2.2rem;}.ste-book__text{font-size:1rem;}.ste-opt{font-size:.98rem;padding:12px;}}
`;
}

export function create(): StoryEndGame {
  return new StoryEndGame();
}
