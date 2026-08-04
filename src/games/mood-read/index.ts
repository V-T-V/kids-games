/* 读表情 Mood Read —— 看表情 emoji 判断心情，选出正确的回应。
   社交启蒙：识别情绪 + 共情回应。独特点：表情 emoji + 候选回应，
   只有一个能让对方感觉被理解。前缀 mrd-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Choice {
  emoji: string;
  text: string;
  good: boolean;
}
interface Scene {
  face: string;
  mood: string;
  choices: Choice[];
}

const SCENES: Scene[] = [
  {
    face: "😢",
    mood: "难过",
    choices: [
      { emoji: "🤗", text: "陪陪你，给你一个抱抱", good: true },
      { emoji: "🤣", text: "大声笑你", good: false },
      { emoji: "🏃", text: "走开不理你", good: false },
    ],
  },
  {
    face: "😠",
    mood: "生气",
    choices: [
      { emoji: " calming", text: "先让他冷静一会儿", good: true },
      { emoji: "😤", text: "也冲他发脾气", good: false },
      { emoji: "🤣", text: "笑他小气", good: false },
    ],
  },
  {
    face: "😨",
    mood: "害怕",
    choices: [
      { emoji: "🤝", text: "牵着你的手陪着你", good: true },
      { emoji: "👻", text: "故意吓他更多", good: false },
      { emoji: "🙅", text: "说你胆子小", good: false },
    ],
  },
  {
    face: "🤕",
    mood: "受伤了",
    choices: [
      { emoji: "🩹", text: "帮他找老师处理伤口", good: true },
      { emoji: "🙈", text: "假装没看见", good: false },
      { emoji: "🤣", text: "笑他笨", good: false },
    ],
  },
  {
    face: "😀",
    mood: "开心",
    choices: [
      { emoji: "🎉", text: "跟他一起开心地说哇太棒啦", good: true },
      { emoji: "😞", text: "板着脸说没什么", good: false },
      { emoji: "💥", text: "故意泼冷水", good: false },
    ],
  },
  {
    face: "🥱",
    mood: "困了",
    choices: [
      { emoji: "🛏️", text: "轻声说让他去休息", good: true },
      { emoji: "📣", text: "大声吵他", good: false },
      { emoji: "🤣", text: "笑他懒", good: false },
    ],
  },
  {
    face: "😥",
    mood: "紧张",
    choices: [
      { emoji: "💪", text: "鼓励他说你能行的", good: true },
      { emoji: "🛑", text: "说他肯定做不好", good: false },
      { emoji: "🤐", text: "不理他", good: false },
    ],
  },
];

export class MoodReadGame extends BaseGame {
  constructor() {
    super("mood-read");
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
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.locked = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const sc = sample(SCENES);
    const choices = shuffle(sc.choices);

    const wrap = document.createElement("div");
    wrap.className = "mrd-wrap";

    const task = document.createElement("div");
    task.className = "mrd-task";
    task.innerHTML = `第 ${this.roundsDone + 1}/${this.roundTotal} 关 · 小朋友现在<b>${sc.mood}</b>了，我该<b>怎么回应</b>？`;
    wrap.appendChild(task);

    const face = document.createElement("div");
    face.className = "mrd-face";
    face.innerHTML = `<div class="mrd-face__emoji">${sc.face}</div><div class="mrd-face__mood">${sc.mood}</div>`;
    wrap.appendChild(face);

    const opts = document.createElement("div");
    opts.className = "mrd-opts";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mrd-opt";
      b.innerHTML = `<div class="mrd-opt__icon">${c.emoji}</div><div class="mrd-opt__text">${c.text}</div>`;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(c: Choice, btn: HTMLButtonElement): void {
    if (this.locked) return;
    if (c.good) {
      this.locked = true;
      sfxPop();
      btn.classList.add("mrd-opt--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1100);
    } else {
      btn.classList.add("mrd-opt--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("mrd-opt--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "想一想～",
      emoji: "💞",
      variant: "rest",
      body: "看见别人不开心，温柔的回应会让他感觉好一点～想想如果是你自己呢？",
      primary: { text: "继续", icon: "🤗", onClick: () => ov.destroy() },
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
    if (document.getElementById("mrd-style")) return;
    const st = document.createElement("style");
    st.id = "mrd-style";
    st.textContent = MRD_CSS(getCssVar("--c-pink"));
    document.head.appendChild(st);
  }
}

function MRD_CSS(theme: string): string {
  return `
.mrd-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(460px,100%);}
.mrd-task{font-size:1.05rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);}
.mrd-task b{color:${theme};}
.mrd-face{display:flex;flex-direction:column;align-items:center;gap:6px;background:linear-gradient(180deg,#fff5fa,#ffe9f3);padding:24px 40px;border-radius:24px;box-shadow:var(--shadow);}
.mrd-face__emoji{font-size:5rem;line-height:1;animation:mrd-bob 2s ease-in-out infinite;}
@keyframes mrd-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.mrd-face__mood{font-size:1.2rem;font-weight:900;color:#6a4555;}
.mrd-opts{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;}
.mrd-opt{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:14px 18px;text-align:left;cursor:pointer;transition:transform .12s;}
.mrd-opt:active{transform:scale(.97);}
.mrd-opt__icon{font-size:1.8rem;flex-shrink:0;width:48px;text-align:center;}
.mrd-opt__text{font-size:1.05rem;font-weight:800;color:#444;}
.mrd-opt--done{background:#d4f4dd;animation:mrd-pop .4s ease;}
.mrd-opt--wrong{background:#ffe0e0;animation:mrd-shake .4s ease;}
@keyframes mrd-pop{0%{transform:scale(.7)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes mrd-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): MoodReadGame {
  return new MoodReadGame();
}
