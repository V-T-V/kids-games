/* 表情配对 Emotion —— 给情境配上对应的情绪表情（情商启蒙）。
   独特点：情境→情绪的语义理解（区别于动物/物品/颜色配对）。
   巧思：情境用插画+文字，答对表情放大微笑。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Scene {
  emoji: string;
  mood: string;
  desc: string;
}
const SCENES: Scene[] = [
  { emoji: "🎂", desc: "过生日收到礼物", mood: "😀" },
  { emoji: "😢", desc: "心爱的气球飞走了", mood: "😢" },
  { emoji: "👹", desc: "看到大怪兽", mood: "😱" },
  { emoji: "😡", desc: "玩具被人抢走", mood: "😡" },
  { emoji: "🥱", desc: "该睡觉了好困", mood: "🥱" },
  { emoji: "🤔", desc: "遇到难题在想", mood: "🤔" },
  { emoji: "🤩", desc: "去游乐园玩", mood: "🤩" },
];
const ALL_MOODS = ["😀", "😢", "😱", "😡", "🥱", "🤔", "🤩"];

export class EmotionGame extends BaseGame {
  constructor() {
    super("emotion");
  }
  private roundsDone = 0;
  private answered = false;
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

  private startRound(): void {
    this.root.innerHTML = "";
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const target = sample(SCENES);
    const distract: string[] = [];
    while (distract.length < 3) {
      const m = sample(ALL_MOODS);
      if (m !== target.mood && !distract.includes(m)) distract.push(m);
    }
    const choices = shuffle([target.mood, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "em-wrap";
    const task = document.createElement("div");
    task.className = "em-task";
    task.textContent = "小朋友现在是什么心情？";
    wrap.appendChild(task);

    const scene = document.createElement("div");
    scene.className = "em-scene";
    scene.innerHTML = `<div class="em-icon">${target.emoji}</div><div class="em-desc">${target.desc}</div>`;
    wrap.appendChild(scene);

    const opts = document.createElement("div");
    opts.className = "em-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "em-opt";
      b.textContent = c;
      b.addEventListener("click", () => this.choose(c, target.mood, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(c: string, mood: string, btn: HTMLButtonElement): void {
    if (c === mood) {
      if (this.answered) return;
      this.answered = true;
      sfxPop();
      btn.classList.add("em-opt--done");
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
      btn.classList.add("em-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("em-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "想想这件事会让你怎么样～",
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
    if (document.getElementById("em-style")) return;
    const st = document.createElement("style");
    st.id = "em-style";
    st.textContent = EM_CSS(getCssVar("--c-orange"));
    document.head.appendChild(st);
  }
}

function EM_CSS(_theme: string): string {
  return `
.em-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;width:min(440px,100%);}
.em-task{font-size:1.2rem;font-weight:800;}
.em-scene{background:#fff;padding:20px 28px;border-radius:20px;box-shadow:var(--shadow);text-align:center;}
.em-icon{font-size:4rem;}
.em-desc{font-size:1.1rem;font-weight:700;margin-top:8px;color:var(--ink-soft);}
.em-opts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.em-opt{width:72px;height:72px;font-size:2.4rem;border-radius:18px;background:#fff;box-shadow:var(--shadow);}
.em-opt:active{transform:scale(.92);}
.em-opt--done{background:#d4f4dd;animation:em-pop .4s ease;}
.em-opt--wrong{animation:em-shake .4s ease;}
@keyframes em-pop{0%{transform:scale(.6)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes em-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): EmotionGame {
  return new EmotionGame();
}
