/* 偏旁组字 Radical-Build —— 给一个偏旁和若干部件，选出能和偏旁组成真字的部件。
   独特点：从"识别偏旁"进阶到"用偏旁构造汉字"——理解汉字是形旁+声旁的组合。
   巧思：偏旁与部件用积木块呈现，选中即拼合成完整大字并朗读；难度=形近干扰项数量。
   前缀 rdb-（radical-build）。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle, sample } from "../../lobby/util.ts";

interface RadicalBuild {
  /** 偏旁 */
  radical: string;
  /** 能组真字的部件 → 组成的字 */
  parts: { comp: string; word: string }[];
  /** 干扰部件（拼不出常见真字）。easy 用明显不同的，hard 用形近的 */
  distract: string[];
  /** 形近干扰项（hard 用，看起来像能组字但其实不能/不常用） */
  similar: string[];
}

const DATA: RadicalBuild[] = [
  {
    radical: "氵",
    parts: [
      { comp: "工", word: "江" },
      { comp: "可", word: "河" },
      { comp: "青", word: "清" },
      { comp: "白", word: "泉" },
    ],
    distract: ["山", "口", "木", "日"],
    similar: ["土", "寸", "十"],
  },
  {
    radical: "木",
    parts: [
      { comp: "目", word: "相" },
      { comp: "几", word: "机" },
      { comp: "兆", word: "桃" },
      { comp: "交", word: "校" },
    ],
    distract: ["水", "火", "日", "月"],
    similar: ["本", "禾", "术"],
  },
  {
    radical: "口",
    parts: [
      { comp: "十", word: "叶" },
      { comp: "八", word: "只" },
      { comp: "鸟", word: "鸣" },
      { comp: "下", word: "吓" },
    ],
    distract: ["山", "水", "木", "田"],
    similar: ["中", "日", "田"],
  },
  {
    radical: "日",
    parts: [
      { comp: "月", word: "明" },
      { comp: "生", word: "星" },
      { comp: "十", word: "早" },
      { comp: "免", word: "晚" },
    ],
    distract: ["水", "木", "山", "人"],
    similar: ["目", "白", "田"],
  },
  {
    radical: "女",
    parts: [
      { comp: "马", word: "妈" },
      { comp: "且", word: "姐" },
      { comp: "未", word: "妹" },
      { comp: "乃", word: "奶" },
    ],
    distract: ["水", "木", "山", "口"],
    similar: ["子", "也", "好"],
  },
  {
    radical: "扌",
    parts: [
      { comp: "丁", word: "打" },
      { comp: "白", word: "拍" },
      { comp: "立", word: "拉" },
      { comp: "合", word: "拾" },
    ],
    distract: ["水", "木", "山", "日"],
    similar: ["手", "才", "木"],
  },
  {
    radical: "火",
    parts: [
      { comp: "丁", word: "灯" },
      { comp: "少", word: "炒" },
      { comp: "尧", word: "烧" },
      { comp: "因", word: "烟" },
    ],
    distract: ["水", "木", "山", "月"],
    similar: ["灭", "灰", "炎"],
  },
  {
    radical: "土",
    parts: [
      { comp: "也", word: "地" },
      { comp: "成", word: "城" },
      { comp: "坐", word: "座" },
      { comp: "里", word: "埋" },
    ],
    distract: ["水", "木", "日", "人"],
    similar: ["工", "士", "王"],
  },
  {
    radical: "心",
    parts: [
      { comp: "相", word: "想" },
      { comp: "亡", word: "忘" },
      { comp: "今", word: "念" },
      { comp: "中", word: "忠" },
    ],
    distract: ["水", "木", "山", "口"],
    similar: ["必", "志", "思"],
  },
  {
    radical: "日",
    parts: [
      { comp: "辰", word: "晨" },
      { comp: "立", word: "音" },
      { comp: "酉", word: "醒" },
      { comp: "门", word: "间" },
    ],
    distract: ["水", "木", "山", "人"],
    similar: ["目", "白", "田"],
  },
  {
    radical: "艹",
    parts: [
      { comp: "化", word: "花" },
      { comp: "早", word: "草" },
      { comp: "苗", word: "猫" },
      { comp: "蓝", word: "蓝" },
    ],
    distract: ["水", "火", "日", "月"],
    similar: ["木", "竹", "叶"],
  },
  {
    radical: "足",
    parts: [
      { comp: "包", word: "跑" },
      { comp: "兆", word: "跳" },
      { comp: "各", word: "路" },
      { comp: "易", word: "踢" },
    ],
    distract: ["水", "木", "山", "日"],
    similar: ["疋", "正", "走"],
  },
];

/** 用语音合成朗读。 */
function speak(text: string): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export class RadicalBuildGame extends BaseGame {
  constructor() {
    super("radical-build");
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
    try {
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  /** 每轮可组字的正确部件数。 */
  private rightCount(): number {
    return this.difficulty === "easy" ? 2 : 3;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const entry = sample(DATA);

    // 正确部件数：2-3
    const okN = Math.min(this.rightCount(), entry.parts.length);
    const right = shuffle(entry.parts).slice(0, okN);
    const rightComps = right.map((r) => r.comp);
    // 干扰数 + 是否用形近：随难度
    const badN =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    const useSimilar = this.difficulty === "hard";
    const distractPool = useSimilar ? entry.similar : entry.distract;
    const distract = shuffle(distractPool).slice(0, badN);
    const options = shuffle([...rightComps, ...distract]);
    let found = 0;

    const wrap = document.createElement("div");
    wrap.className = "rdb-wrap";

    const task = document.createElement("div");
    task.className = "rdb-task";
    task.innerHTML = `选出能和「<b>${entry.radical}</b>」拼成一个真字的部件<br><span class="rdb-hint">一共 ${right.length} 个，全部找出来～（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</span>`;
    wrap.appendChild(task);

    // 积木展示区：偏旁 + 上次拼成的字
    const stage = document.createElement("div");
    stage.className = "rdb-stage";
    const block = document.createElement("div");
    block.className = "rdb-block rdb-block--radical";
    block.textContent = entry.radical;
    const wordShow = document.createElement("div");
    wordShow.className = "rdb-word";
    wordShow.textContent = "?";
    stage.appendChild(block);
    stage.appendChild(wordShow);
    wrap.appendChild(stage);

    const grid = document.createElement("div");
    grid.className = "rdb-grid";
    options.forEach((comp) => {
      const isRight = rightComps.includes(comp);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rdb-card";
      b.textContent = comp;
      b.addEventListener("click", () => {
        if (
          b.classList.contains("rdb-card--done") ||
          b.classList.contains("rdb-card--miss")
        )
          return;
        if (isRight) {
          b.classList.add("rdb-card--done");
          const word = right.find((r) => r.comp === comp)!.word;
          // 拼合展示
          wordShow.textContent = word;
          wordShow.classList.remove("rdb-word--pop");
          void wordShow.offsetWidth; // 重置动画
          wordShow.classList.add("rdb-word--pop");
          this.trackTimeout(() => speak(word), 150);
          const r = b.getBoundingClientRect();
          this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
          this.resetWrongStreak();
          found += 1;
          if (found >= right.length) {
            this.roundsDone += 1;
            this.trackTimeout(() => {
              if (this.roundsDone >= this.roundTotal)
                this.finishClear(starsByAccuracy(this.wrongCount));
              else this.startRound();
            }, 1100);
          }
        } else {
          b.classList.add("rdb-card--miss");
          const paused = this.onWrong();
          this.trackTimeout(() => b.classList.remove("rdb-card--miss"), 450);
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
      body: "把这个偏旁和部件拼在一起，看看是不是一个真字～",
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
    if (document.getElementById("rdb-style")) return;
    const st = document.createElement("style");
    st.id = "rdb-style";
    st.textContent = RDB_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function RDB_CSS(theme: string): string {
  return `
.rdb-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.rdb-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.5;}
.rdb-hint{font-size:.82rem;color:var(--ink-soft,#888);font-weight:600;}
.rdb-stage{display:flex;align-items:center;gap:18px;}
.rdb-block{width:78px;height:78px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:2.6rem;font-weight:800;background:#fff;color:var(--ink,#333);box-shadow:var(--shadow);font-family:'KaiTi','STKaiti',serif;}
.rdb-block--radical{background:linear-gradient(135deg,${theme},#4f46e5);color:#fff;animation:rdb-float 3s ease-in-out infinite;}
.rdb-word{width:96px;height:78px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:2.8rem;font-weight:800;color:${theme};background:rgba(255,255,255,.6);box-shadow:var(--shadow);font-family:'KaiTi','STKaiti',serif;border:3px dashed ${theme}55;}
.rdb-word--pop{animation:rdb-pop .5s ease;}
.rdb-grid{display:grid;grid-template-columns:repeat(3,80px);gap:12px;justify-content:center;}
.rdb-card{width:80px;height:80px;border-radius:18px;font-size:2.3rem;font-weight:800;background:#fff;color:var(--ink,#333);box-shadow:var(--shadow);font-family:'KaiTi','STKaiti',serif;transition:transform .15s;}
.rdb-card:active{transform:scale(.92);}
.rdb-card--done{background:linear-gradient(135deg,#6bcf7f,#4ba85f);color:#fff;animation:rdb-pop .4s ease;}
.rdb-card--miss{animation:rdb-shake .4s ease;background:#ffd0cc;}
@keyframes rdb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes rdb-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes rdb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (max-width:380px){.rdb-grid{grid-template-columns:repeat(3,70px);}.rdb-card{width:70px;height:70px;font-size:2rem;}}
`;
}

export function create(): RadicalBuildGame {
  return new RadicalBuildGame();
}
