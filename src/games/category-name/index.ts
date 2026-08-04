/* 说出类别 Category-Name —— 给 3-4 个同类词（如 苹果 香蕉 葡萄），
   从选项里选出它们的类别名（如 水果）。
   独特点：训练归纳/分类思维——从具体实例抽象出上位概念。
   巧思：实例用 emoji 直观呈现，干扰类别是孩子熟悉的"近义类"，需抓住共同点。
   视觉：同类卡片成组展示 + 类别选项。难度=选项数。通关=答对目标轮数。
   前缀 ctn-（category-name）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface Group {
  /** 同类成员：emoji + 名字 */
  members: { emoji: string; name: string }[];
  /** 正确类别名 */
  category: string;
  /** 干扰类别名 */
  distract: string[];
}

const GROUPS: Group[] = [
  {
    members: [
      { emoji: "🍎", name: "苹果" },
      { emoji: "🍌", name: "香蕉" },
      { emoji: "🍇", name: "葡萄" },
      { emoji: "🍓", name: "草莓" },
    ],
    category: "水果",
    distract: ["蔬菜", "颜色", "动物"],
  },
  {
    members: [
      { emoji: "🥕", name: "胡萝卜" },
      { emoji: "🥦", name: "西兰花" },
      { emoji: "🌽", name: "玉米" },
      { emoji: "🍅", name: "番茄" },
    ],
    category: "蔬菜",
    distract: ["水果", "食物", "花"],
  },
  {
    members: [
      { emoji: "🐶", name: "小狗" },
      { emoji: "🐱", name: "小猫" },
      { emoji: "🐰", name: "兔子" },
      { emoji: "🐟", name: "鱼" },
    ],
    category: "动物",
    distract: ["水果", "玩具", "车"],
  },
  {
    members: [
      { emoji: "🚗", name: "小汽车" },
      { emoji: "🚌", name: "公交车" },
      { emoji: "🚲", name: "自行车" },
      { emoji: "✈️", name: "飞机" },
    ],
    category: "交通工具",
    distract: ["玩具", "动物", "颜色"],
  },
  {
    members: [
      { emoji: "🔴", name: "红色" },
      { emoji: "🔵", name: "蓝色" },
      { emoji: "🟢", name: "绿色" },
      { emoji: "🟡", name: "黄色" },
    ],
    category: "颜色",
    distract: ["水果", "形状", "衣服"],
  },
  {
    members: [
      { emoji: "⬛", name: "正方形" },
      { emoji: "⭕", name: "圆形" },
      { emoji: "🔺", name: "三角形" },
      { emoji: "⭐", name: "星形" },
    ],
    category: "形状",
    distract: ["颜色", "玩具", "数字"],
  },
  {
    members: [
      { emoji: "👕", name: "上衣" },
      { emoji: "👖", name: "裤子" },
      { emoji: "👗", name: "裙子" },
      { emoji: "🧢", name: "帽子" },
    ],
    category: "衣服",
    distract: ["玩具", "颜色", "食物"],
  },
  {
    members: [
      { emoji: "⚽", name: "足球" },
      { emoji: "🪁", name: "风筝" },
      { emoji: "🧸", name: "小熊" },
      { emoji: "🎲", name: "骰子" },
    ],
    category: "玩具",
    distract: ["衣服", "动物", "形状"],
  },
  {
    members: [
      { emoji: "1️⃣", name: "一" },
      { emoji: "2️⃣", name: "二" },
      { emoji: "3️⃣", name: "三" },
      { emoji: "4️⃣", name: "四" },
    ],
    category: "数字",
    distract: ["颜色", "字母", "形状"],
  },
  {
    members: [
      { emoji: "✏️", name: "铅笔" },
      { emoji: "📐", name: "尺子" },
      { emoji: "✂️", name: "剪刀" },
      { emoji: "📓", name: "本子" },
    ],
    category: "文具",
    distract: ["玩具", "工具", "衣服"],
  },
  {
    members: [
      { emoji: "🎹", name: "钢琴" },
      { emoji: "🥁", name: "鼓" },
      { emoji: "🎸", name: "吉他" },
      { emoji: "🎺", name: "喇叭" },
    ],
    category: "乐器",
    distract: ["玩具", "工具", "家具"],
  },
  {
    members: [
      { emoji: "🏀", name: "篮球" },
      { emoji: "⚽", name: "足球" },
      { emoji: "🏐", name: "排球" },
      { emoji: "🎾", name: "网球" },
    ],
    category: "球类",
    distract: ["水果", "玩具", "食物"],
  },
  {
    members: [
      { emoji: "🐦", name: "小鸟" },
      { emoji: "🦅", name: "老鹰" },
      { emoji: "🦆", name: "鸭子" },
      { emoji: "🐧", name: "企鹅" },
    ],
    category: "鸟类",
    distract: ["动物", "昆虫", "鱼"],
  },
  {
    members: [
      { emoji: "🌧️", name: "下雨" },
      { emoji: "❄️", name: "下雪" },
      { emoji: "💨", name: "刮风" },
      { emoji: "⛈️", name: "打雷" },
    ],
    category: "天气",
    distract: ["季节", "颜色", "自然"],
  },
  {
    members: [
      { emoji: "🪑", name: "椅子" },
      { emoji: "🛏️", name: "床" },
      { emoji: "🚪", name: "门" },
      { emoji: "🪟", name: "窗户" },
    ],
    category: "家具",
    distract: ["文具", "工具", "建筑"],
  },
];

export class CategoryNameGame extends BaseGame {
  constructor() {
    super("category-name");
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
    /* DOM 清空 */
  }

  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const group = sample(GROUPS);
    const n = Math.min(this.optCount(), group.distract.length + 1);
    const distract = shuffle(group.distract).slice(0, n - 1);
    const options = shuffle([group.category, ...distract]);
    const members = shuffle(group.members);

    const wrap = document.createElement("div");
    wrap.className = "ctn-wrap";

    const task = document.createElement("div");
    task.className = "ctn-task";
    task.innerHTML = `这些东西都属于<b>哪一类</b>？<br><span class="ctn-hint">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const cards = document.createElement("div");
    cards.className = "ctn-cards";
    members.forEach((m) => {
      const c = document.createElement("div");
      c.className = "ctn-card";
      c.innerHTML = `<div class="ctn-card__emoji">${m.emoji}</div><div class="ctn-card__name">${m.name}</div>`;
      cards.appendChild(c);
    });
    wrap.appendChild(cards);

    const opts = document.createElement("div");
    opts.className = "ctn-opts";
    options.forEach((text) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ctn-opt";
      b.textContent = text;
      b.addEventListener("click", () => this.choose(text, group.category, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(text: string, right: string, btn: HTMLButtonElement): void {
    if (btn.classList.contains("ctn-opt--lock")) return;
    if (text === right) {
      btn.classList.add("ctn-opt--right");
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
      }, 1100);
    } else {
      btn.classList.add("ctn-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ctn-opt--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private lockAll(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>(".ctn-opt")
      .forEach((b) => b.classList.add("ctn-opt--lock"));
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想一想这些东西有什么<b>相同</b>的地方～",
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
    if (document.getElementById("ctn-style")) return;
    const st = document.createElement("style");
    st.id = "ctn-style";
    st.textContent = CTN_CSS(getCssVar("--c-green"));
    document.head.appendChild(st);
  }
}

function CTN_CSS(theme: string): string {
  return `
.ctn-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.ctn-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.ctn-hint{font-size:.8rem;color:var(--ink-soft,#888);font-weight:600;}
.ctn-cards{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:16px;background:rgba(255,255,255,.6);border-radius:22px;box-shadow:var(--shadow);}
.ctn-card{width:84px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;border:3px solid ${theme}33;}
.ctn-card__emoji{font-size:2.4rem;line-height:1;}
.ctn-card__name{font-size:.82rem;font-weight:700;color:var(--ink,#333);}
.ctn-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:min(460px,100%);}
.ctn-opt{font-size:1.15rem;font-weight:800;color:var(--ink,#333);background:#fff;border:3px solid #e6e6ee;border-radius:16px;padding:16px 10px;cursor:pointer;transition:transform .12s,background .2s,border-color .2s;box-shadow:var(--shadow);}
.ctn-opt:active{transform:scale(.96);}
.ctn-opt--right{background:#d4f4dd;border-color:#6bcf7f;animation:ctn-pop .35s ease;}
.ctn-opt--wrong{background:#ffe0db;border-color:#ff6348;color:#c0392b;animation:ctn-shake .4s ease;}
.ctn-opt--lock{pointer-events:none;}
@keyframes ctn-pop{0%{transform:scale(1)}50%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes ctn-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.ctn-card{width:72px;}.ctn-card__emoji{font-size:2rem;}.ctn-opt{font-size:1rem;padding:14px 6px;}}
`;
}

export function create(): CategoryNameGame {
  return new CategoryNameGame();
}
