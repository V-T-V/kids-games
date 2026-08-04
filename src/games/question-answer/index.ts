/* 问答选择 Question-Answer —— 看一个情景图 + 一个问题，
   从选项里选出最合理的答案（如"小男孩在哭，为什么？→ 他摔倒了"）。
   独特点：考察因果/情境推理，把"为什么/怎么办"做成可视化选择题。
   巧思：每个情景贴近儿童生活，干扰项"看起来合理但其实无关"，需结合画面判断。
   视觉：情景卡（emoji + 场景底色）+ 问题条 + 选项。难度=选项数。通关=答对目标轮数。
   前缀 qna-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface QAItem {
  /** 情景画面（emoji 拼图，HTML） */
  scene: string;
  /** 场景底色 */
  bg: string;
  /** 问题 */
  question: string;
  /** 正确答案 */
  right: string;
  /** 干扰答案 */
  wrongs: string[];
}

const ITEMS: QAItem[] = [
  {
    scene: `👦😭`,
    bg: "#fff0f0",
    question: "小男孩在哭，为什么？",
    right: "他摔倒了",
    wrongs: ["他在笑", "他在吃饭", "他很高兴"],
  },
  {
    scene: `🌧️👧☂️`,
    bg: "#eef4ff",
    question: "小女孩为什么撑伞？",
    right: "下雨了",
    wrongs: ["出太阳了", "下雪了", "天黑了"],
  },
  {
    scene: `🐶🦴`,
    bg: "#fff7e6",
    question: "小狗摇尾巴，想干什么？",
    right: "想吃骨头",
    wrongs: ["想睡觉", "想洗澡", "生气了"],
  },
  {
    scene: `🧒🍯😋`,
    bg: "#fffbe6",
    question: "小朋友舔蜂蜜，他感觉怎样？",
    right: "很甜很好吃",
    wrongs: ["很苦", "很辣", "很酸"],
  },
  {
    scene: `🏫🎒👦`,
    bg: "#eefeec",
    question: "小男孩背着书包去哪里？",
    right: "去上学",
    wrongs: ["去睡觉", "去游泳", "去吃饭"],
  },
  {
    scene: `🌞🥵🧒`,
    bg: "#fff3e0",
    question: "天很热，小朋友应该做什么？",
    right: "多喝水",
    wrongs: ["穿棉袄", "关风扇", "喝热水"],
  },
  {
    scene: `🌙🛏️😴`,
    bg: "#ede7ff",
    question: "天黑了，宝宝在做什么？",
    right: "睡觉",
    wrongs: ["起床", "跑步", "上学"],
  },
  {
    scene: `🍎🤒👧`,
    bg: "#fff0f0",
    question: "小女孩生病了，妈妈给她什么？",
    right: "吃药和水果",
    wrongs: ["给她冰淇淋", "让她跑步", "给她糖果"],
  },
];

export class QuestionAnswerGame extends BaseGame {
  constructor() {
    super("question-answer");
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

    const item = sample(ITEMS);
    const n = Math.min(this.optCount(), item.wrongs.length + 1);
    const wrongs = shuffle(item.wrongs).slice(0, n - 1);
    const options = shuffle([item.right, ...wrongs]);

    const wrap = document.createElement("div");
    wrap.className = "qna-wrap";

    const scene = document.createElement("div");
    scene.className = "qna-scene";
    scene.style.background = item.bg;
    scene.innerHTML = `<div class="qna-scene__emoji">${item.scene}</div>`;
    wrap.appendChild(scene);

    const q = document.createElement("div");
    q.className = "qna-q";
    q.innerHTML = `<span class="qna-q__icon">❓</span><span>${item.question}<br><span class="qna-hint">（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span></span>`;
    wrap.appendChild(q);

    const opts = document.createElement("div");
    opts.className = "qna-opts";
    options.forEach((text) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "qna-opt";
      b.textContent = text;
      b.addEventListener("click", () => this.choose(text, item.right, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(text: string, right: string, btn: HTMLButtonElement): void {
    if (btn.classList.contains("qna-opt--lock")) return;
    if (text === right) {
      btn.classList.add("qna-opt--right");
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
      btn.classList.add("qna-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("qna-opt--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private lockAll(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>(".qna-opt")
      .forEach((b) => b.classList.add("qna-opt--lock"));
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看看图里发生了什么，再想一想～",
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
    if (document.getElementById("qna-style")) return;
    const st = document.createElement("style");
    st.id = "qna-style";
    st.textContent = QNA_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function QNA_CSS(theme: string): string {
  return `
.qna-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(520px,100%);}
.qna-scene{width:min(420px,92%);min-height:140px;border-radius:24px;box-shadow:var(--shadow,0 6px 18px rgba(0,0,0,.12));display:flex;align-items:center;justify-content:center;border:4px solid #fff;}
.qna-scene__emoji{font-size:3.4rem;letter-spacing:6px;line-height:1;}
.qna-q{display:flex;align-items:center;gap:10px;background:#fff;border-left:8px solid ${theme};border-radius:14px;padding:12px 16px;font-size:1.1rem;font-weight:800;box-shadow:var(--shadow);width:min(460px,100%);}
.qna-q__icon{font-size:1.6rem;}
.qna-hint{font-size:.78rem;color:var(--ink-soft,#888);font-weight:600;}
.qna-opts{display:grid;grid-template-columns:1fr;gap:10px;width:min(460px,100%);}
.qna-opt{font-size:1.05rem;font-weight:700;color:var(--ink,#333);background:#fff;border:3px solid #e6e6ee;border-radius:16px;padding:14px 16px;cursor:pointer;transition:transform .12s,background .2s,border-color .2s;box-shadow:var(--shadow);}
.qna-opt:active{transform:scale(.97);}
.qna-opt--right{background:#d4f4dd;border-color:#6bcf7f;animation:qna-pop .35s ease;}
.qna-opt--wrong{background:#ffe0db;border-color:#ff6348;color:#c0392b;animation:qna-shake .4s ease;}
.qna-opt--lock{pointer-events:none;}
@keyframes qna-pop{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}
@keyframes qna-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.qna-scene__emoji{font-size:2.6rem;}.qna-opt{font-size:.98rem;padding:12px;}}
`;
}

export function create(): QuestionAnswerGame {
  return new QuestionAnswerGame();
}
