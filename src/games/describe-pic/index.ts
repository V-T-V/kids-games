/* 描述图片 Describe-Pic —— 看一张由 emoji 组成的"图片"（如三个苹果在桌上），
   从选项里选出最准确的描述。
   独特点：把抽象的"看图说话"做成选择题，考察数量、方位、颜色的综合理解。
   巧思：场景用 emoji 拼搭直观呈现，干扰选项只错一个要素（数/位/色），需精读。
   视觉：卡片式"画框"展示场景，下方选项卡。难度=选项数。通关=答对目标轮数。
   前缀 dpc2-（dumpling-count 用 dpc-，故此处用 dpc2- 防冲突）。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

/** 一道题：场景（emoji 拼图）+ 正确描述 + 干扰描述。 */
interface PicItem {
  /** 场景画面：HTML，可用 emoji + 简单排版 */
  scene: string;
  /** 正确描述 */
  right: string;
  /** 干扰描述（每个错一个要素） */
  wrongs: string[];
}

const ITEMS: PicItem[] = [
  {
    scene: `<div class="dpc2-table">🪵🪵🪵🪵🪵</div><div class="dpc2-row">🍎🍎🍎</div>`,
    right: "三个苹果在桌子上",
    wrongs: ["两个苹果在桌子上", "三个香蕉在桌子上", "三个苹果在椅子上"],
  },
  {
    scene: `<div class="dpc2-sky">☁️ ☀️</div><div class="dpc2-row">🐦</div>`,
    right: "一只小鸟在天上飞",
    wrongs: ["两只小鸟在天上飞", "一只小鸟在水里游", "一只小猫在天上飞"],
  },
  {
    scene: `<div class="dpc2-box">🧸🧸</div>`,
    right: "盒子里有两只小熊",
    wrongs: ["盒子里有三只小熊", "盒子里有两辆小车", "桌子上有两只小熊"],
  },
  {
    scene: `<div class="dpc2-row">🌸🌸🌸🌸🌸</div>`,
    right: "开了五朵花",
    wrongs: ["开了四朵花", "开了六朵花", "开了五棵树"],
  },
  {
    scene: `<div class="dpc2-water">🌊</div><div class="dpc2-row">🐟🐟🐟🐟</div>`,
    right: "水里有四条鱼",
    wrongs: ["水里有三条鱼", "天上有四条鱼", "水里有四只鸟"],
  },
  {
    scene: `<div class="dpc2-row">⭐</div><div class="dpc2-row">🌙</div>`,
    right: "晚上有一颗星星和一个月亮",
    wrongs: ["白天有一颗星星", "晚上有两颗星星", "晚上有一个太阳"],
  },
  {
    scene: `<div class="dpc2-row">🟥🟦🟩🟨</div>`,
    right: "有四个不同颜色的方块",
    wrongs: ["有三个不同颜色的方块", "有四个相同的方块", "有四个不同颜色的球"],
  },
  {
    scene: `<div class="dpc2-row">👦🚲</div>`,
    right: "小男孩在骑自行车",
    wrongs: ["小女孩在骑自行车", "小男孩在跑步", "小男孩在骑车，旁边没人"],
  },
];

export class DescribePicGame extends BaseGame {
  constructor() {
    super("describe-pic");
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

  /** 难度=选项数：easy=3 / medium=4 / hard=5。 */
  private optCount(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const item = sample(ITEMS);
    const n = Math.min(this.optCount(), item.wrongs.length + 1);
    const wrongs = shuffle(item.wrongs).slice(0, n - 1);
    const options = shuffle([item.right, ...wrongs]);

    const wrap = document.createElement("div");
    wrap.className = "dpc2-wrap";

    const task = document.createElement("div");
    task.className = "dpc2-task";
    task.innerHTML = `仔细看图，选出<b>最准确</b>的一句话<br><span class="dpc2-hint">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    const frame = document.createElement("div");
    frame.className = "dpc2-frame";
    frame.innerHTML = item.scene;
    wrap.appendChild(frame);

    const opts = document.createElement("div");
    opts.className = "dpc2-opts";
    options.forEach((text) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dpc2-opt";
      b.textContent = text;
      b.addEventListener("click", () => this.choose(text, item.right, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(text: string, right: string, btn: HTMLButtonElement): void {
    if (btn.classList.contains("dpc2-opt--lock")) return;
    if (text === right) {
      btn.classList.add("dpc2-opt--right");
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
      btn.classList.add("dpc2-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("dpc2-opt--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private lockAll(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>(".dpc2-opt")
      .forEach((b) => b.classList.add("dpc2-opt--lock"));
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "再看看图里有几个、在哪里、是什么～",
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
    if (document.getElementById("dpc2-style")) return;
    const st = document.createElement("style");
    st.id = "dpc2-style";
    st.textContent = DPC2_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function DPC2_CSS(theme: string): string {
  return `
.dpc2-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.dpc2-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.5;}
.dpc2-hint{font-size:.8rem;color:var(--ink-soft,#888);font-weight:600;}
.dpc2-frame{width:min(420px,92%);min-height:170px;background:linear-gradient(135deg,#fffaf0,#fef6e4);border:6px solid ${theme};border-radius:24px;box-shadow:var(--shadow,0 6px 18px rgba(0,0,0,.12));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:22px 16px;position:relative;}
.dpc2-frame::before{content:"🖼️";position:absolute;top:-18px;left:50%;transform:translateX(-50%);background:#fff;border-radius:50%;font-size:1.4rem;padding:2px 6px;box-shadow:var(--shadow);}
.dpc2-table{font-size:1.6rem;letter-spacing:2px;line-height:1;}
.dpc2-row{font-size:2.6rem;line-height:1;letter-spacing:6px;}
.dpc2-sky{font-size:1.8rem;letter-spacing:10px;line-height:1;opacity:.9;}
.dpc2-water{font-size:1.8rem;letter-spacing:2px;line-height:1;}
.dpc2-box{font-size:2.6rem;line-height:1;border:3px dashed #c7c7d1;border-radius:16px;padding:10px 22px;background:#fff;}
.dpc2-opts{display:grid;grid-template-columns:1fr;gap:10px;width:min(460px,100%);}
.dpc2-opt{font-size:1.05rem;font-weight:700;color:var(--ink,#333);background:#fff;border:3px solid #e6e6ee;border-radius:16px;padding:14px 16px;cursor:pointer;transition:transform .12s,background .2s,border-color .2s;box-shadow:var(--shadow);}
.dpc2-opt:active{transform:scale(.97);}
.dpc2-opt--right{background:#d4f4dd;border-color:#6bcf7f;animation:dpc2-pop .35s ease;}
.dpc2-opt--wrong{background:#ffe0db;border-color:#ff6348;color:#c0392b;animation:dpc2-shake .4s ease;}
.dpc2-opt--lock{pointer-events:none;}
@keyframes dpc2-pop{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}
@keyframes dpc2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.dpc2-row{font-size:2.1rem;}.dpc2-opt{font-size:.98rem;padding:12px;}}
`;
}

export function create(): DescribePicGame {
  return new DescribePicGame();
}
