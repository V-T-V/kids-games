/* 故事道理 Story Moral —— 读一个简短故事，从选项选出它的道理。
   独特点：把故事内容抽象成一句道德寓意（坚持、分享、谦虚等），训练归纳能力。
   巧思：每个故事配 emoji 插画，难度=选项数。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Story {
  emoji: string;
  text: string;
  moral: string;
  // 用来抽干扰项的池子
  distractors: string[];
}

const STORIES: Story[] = [
  {
    emoji: "🐢🐇",
    text: "兔子和乌龟赛跑，兔子跑得快却骄傲地睡着了，乌龟一步一步不停走，最后赢了。",
    moral: "坚持不懈就会成功",
    distractors: ["跑得快才厉害", "睡觉能赢比赛", "要嘲笑别人"],
  },
  {
    emoji: "🐜🕊️",
    text: "小蚂蚁掉进水里，鸽子衔了一片叶子救了它。后来猎人要抓鸽子，蚂蚁咬了猎人一口救了鸽子。",
    moral: "帮助别人也会得到帮助",
    distractors: ["小动物没有用", "不要接近鸟类", "猎人都是坏人"],
  },
  {
    emoji: "🦊🍇",
    text: "狐狸想吃高处的葡萄，跳了又跳都够不着，只好说「那葡萄一定是酸的」走开了。",
    moral: "得不到就说不好，是骗自己",
    distractors: ["葡萄都是酸的", "狐狸不会跳高", "应该多吃葡萄"],
  },
  {
    emoji: "🐦🐦🐦",
    text: "两只小鸟一起找到一块面包，互相让着给对方吃，最后开心地分着吃完了。",
    moral: "懂得分享更快乐",
    distractors: ["要抢着吃才对", "面包不能吃", "小鸟不吃面包"],
  },
  {
    emoji: "🦁🐭",
    text: "小老鼠吵醒了大狮子，狮子放了它。后来狮子被困在网里，小老鼠咬断绳子救了它。",
    moral: "不要小看任何人",
    distractors: ["狮子最厉害", "老鼠没有用", "不要接近狮子"],
  },
  {
    emoji: "🐎🦸",
    text: "小马要过河，问老牛说水很浅，问松鼠说水很深。它自己试了试，发现水既不深也不浅。",
    moral: "要自己去尝试",
    distractors: ["老牛说得对", "松鼠说得对", "河水很危险"],
  },
];

export class StoryMoralGame extends BaseGame {
  constructor() {
    super("story-moral");
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
    /* DOM 清空 */
  }

  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.locked = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    const story = sample(STORIES);
    const distractors = shuffle(story.distractors).slice(
      0,
      this.optCount() - 1,
    );
    const options = shuffle([story.moral, ...distractors]);

    const wrap = document.createElement("div");
    wrap.className = "smr-wrap";

    const card = document.createElement("div");
    card.className = "smr-card";
    const pic = document.createElement("div");
    pic.className = "smr-emoji";
    pic.textContent = story.emoji;
    card.appendChild(pic);
    const task = document.createElement("div");
    task.className = "smr-task";
    task.textContent = "读小故事，选它告诉我们什么：";
    card.appendChild(task);
    const body = document.createElement("div");
    body.className = "smr-body";
    body.textContent = story.text;
    card.appendChild(body);
    wrap.appendChild(card);

    const grid = document.createElement("div");
    grid.className = "smr-grid";
    for (const opt of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "smr-opt";
      b.textContent = opt;
      b.addEventListener("click", () => this.choose(opt, story.moral, b, grid));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }

  private choose(
    opt: string,
    moral: string,
    btn: HTMLButtonElement,
    grid: HTMLElement,
  ): void {
    if (this.locked) return;
    const r = btn.getBoundingClientRect();
    if (opt === moral) {
      this.locked = true;
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      grid.querySelectorAll(".smr-opt").forEach((el) => {
        (el as HTMLButtonElement).disabled = true;
      });
      btn.classList.add("smr-opt--right");
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 900);
    } else {
      btn.classList.add("smr-opt--wrong");
      const paused = this.onWrong();
      if (paused) this.showRest();
      this.trackTimeout(() => btn.classList.remove("smr-opt--wrong"), 500);
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再读一遍故事，想想它想告诉我们什么～",
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
    if (document.getElementById("smr-style")) return;
    const st = document.createElement("style");
    st.id = "smr-style";
    st.textContent = SMR_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function SMR_CSS(theme: string): string {
  return `
.smr-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.smr-card{background:#fff;border-radius:22px;padding:18px 20px;box-shadow:var(--shadow);width:100%;box-sizing:border-box;text-align:center;}
.smr-emoji{font-size:2.6rem;line-height:1.2;}
.smr-task{font-size:1.05rem;font-weight:800;margin-top:6px;color:${theme};}
.smr-body{font-size:1.05rem;line-height:1.7;margin-top:8px;color:#444;}
.smr-grid{display:flex;flex-direction:column;gap:12px;width:100%;}
.smr-opt{min-height:56px;padding:10px 18px;border-radius:16px;background:#fff;font-weight:700;font-size:1.05rem;box-shadow:var(--shadow);}
.smr-opt:active{transform:scale(.97);}
.smr-opt--right{background:#d4f4dd;outline:4px solid #34c759;}
.smr-opt--wrong{background:#ffe0e0;outline:4px solid #ff3b30;}
`;
}

export function create(): StoryMoralGame {
  return new StoryMoralGame();
}
