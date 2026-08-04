/* 看图说话 Picture-Talk —— 给一个 emoji 场景图，选出最贴切的描述句子。
   独特点：从「认字」上升到「读句子理解语义」（区别于单字词配图）。
   巧思：干扰句与正确句结构相似但主语/动作不同，需要真正读懂图；
         难度=干扰相似度（easy 选错主语、medium 选错动作、hard 选错方位）。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { createButton } from "../../ui/Button.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

/** 一道看图说话题。 */
interface Pic {
  /** 场景图（emoji 组合） */
  scene: string;
  /** 正确描述 */
  right: string;
  /** 干扰描述候选（按相似度从远到近） */
  wrong: string[];
}

const PICS: Pic[] = [
  {
    scene: "🐱💤",
    right: "小猫在睡觉",
    wrong: ["小狗在睡觉", "小猫在吃饭", "小猫坐在地上"],
  },
  {
    scene: "🐶🦴",
    right: "小狗吃骨头",
    wrong: ["小猫吃骨头", "小狗玩球", "小狗在跑"],
  },
  {
    scene: "🐰🥕",
    right: "小白兔吃萝卜",
    wrong: ["小灰兔吃萝卜", "小白兔吃草", "小白兔跳着走"],
  },
  {
    scene: "🌧️👧☂️",
    right: "小女孩打伞",
    wrong: ["小男孩打伞", "小女孩戴帽子", "小女孩在哭"],
  },
  {
    scene: "🐦🌳",
    right: "小鸟在树上",
    wrong: ["小鸟在天上", "小虫在树上", "小鸟在地上"],
  },
  {
    scene: "👦📚",
    right: "小男孩看书",
    wrong: ["小女孩看书", "小男孩写字", "小男孩玩玩具"],
  },
  {
    scene: "🐠🌊",
    right: "小鱼在水里游",
    wrong: ["小鱼在天上飞", "小船在水里游", "小鱼在沙里"],
  },
  {
    scene: "🌙🛌👶",
    right: "宝宝在睡觉",
    wrong: ["妈妈在睡觉", "宝宝在玩", "宝宝在吃饭"],
  },
  {
    scene: "🚲👦",
    right: "小男孩骑车",
    wrong: ["小女孩骑车", "小男孩跑步", "小男孩开车"],
  },
  {
    scene: "☀️🌻",
    right: "太阳照着花",
    wrong: ["月亮照着花", "太阳照着树", "雨打在花上"],
  },
];

/** 用语音合成朗读句子。 */
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

export class PictureTalkGame extends BaseGame {
  constructor() {
    super("picture-talk");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;

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

  /** 选项数=难度（难度越大干扰句越多 + 相似度越高）。 */
  private optionCount(): number {
    return this.difficulty === "easy"
      ? 3
      : this.difficulty === "medium"
        ? 4
        : 4;
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);

    const pic = sample(PICS);
    const need = this.optionCount();
    // 取最相似的 N-1 个干扰（数组末尾最相似）
    const wrongN = need - 1;
    const wrong = pic.wrong.slice(-wrongN);
    const options = shuffle([pic.right, ...wrong]);

    const wrap = document.createElement("div");
    wrap.className = "ptk-wrap";

    const task = document.createElement("div");
    task.className = "ptk-task";
    task.innerHTML = `看图，选出对的句子<br><span class="ptk-hint">第 ${this.roundsDone + 1}/${this.roundTotal} 题</span>`;
    wrap.appendChild(task);

    // 场景图卡片
    const scene = document.createElement("div");
    scene.className = "ptk-scene";
    scene.innerHTML = pic.scene
      .split("")
      .map((e) => `<span class="ptk-emoji">${e}</span>`)
      .join("");
    // 点击场景图朗读正确句（给还不能读字的孩子听）
    scene.addEventListener("click", () => speak(pic.right));
    scene.style.cursor = "pointer";
    scene.title = "点图听句子";
    wrap.appendChild(scene);

    // 听一听按钮（替代朗读，更明显）
    const player = document.createElement("div");
    player.className = "ptk-player";
    player.appendChild(
      createButton({
        text: "听正确句子",
        icon: "🔊",
        variant: "secondary",
        onClick: () => speak(pic.right),
      }),
    );
    wrap.appendChild(player);

    const opts = document.createElement("div");
    opts.className = "ptk-opts";
    options.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ptk-opt";
      b.textContent = s;
      b.addEventListener("click", () => this.choose(s, pic, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(s: string, pic: Pic, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (s === pic.right) {
      this.answered = true;
      sfxPop();
      btn.classList.add("ptk-opt--done");
      // 答对后朗读正确句作为正反馈
      this.trackTimeout(() => speak(pic.right), 250);
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1400);
    } else {
      btn.classList.add("ptk-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("ptk-opt--wrong"), 450);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "看清楚图里是<b>谁</b>、在<b>做啥</b>～",
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
    if (document.getElementById("ptk-style")) return;
    const st = document.createElement("style");
    st.id = "ptk-style";
    st.textContent = PTK_CSS(getCssVar("--c-teal"));
    document.head.appendChild(st);
  }
}

function PTK_CSS(theme: string): string {
  return `
.ptk-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(500px,100%);}
.ptk-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.5;}
.ptk-hint{font-size:.82rem;color:var(--ink-soft);font-weight:600;}
.ptk-scene{display:flex;gap:6px;padding:18px 30px;border-radius:24px;background:linear-gradient(135deg,#fff,${theme}33);box-shadow:var(--shadow-lg);user-select:none;}
.ptk-emoji{font-size:3rem;line-height:1;}
.ptk-player{display:flex;justify-content:center;}
.ptk-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:340px;}
.ptk-opt{padding:14px 18px;font-size:1.2rem;font-weight:700;font-family:'KaiTi','STKaiti',serif;background:#fff;border-radius:16px;box-shadow:var(--shadow);color:var(--ink);transition:transform .15s;text-align:center;}
.ptk-opt:active{transform:scale(.97);}
.ptk-opt--done{background:linear-gradient(135deg,#6bcf7f,#4ba85f);color:#fff;animation:ptk-pop .45s ease;}
.ptk-opt--wrong{animation:ptk-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes ptk-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes ptk-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): PictureTalkGame {
  return new PictureTalkGame();
}
