/* 紧急电话 Emergency-Call —— 给出紧急场景，孩子选该打哪个电话。
   场景：着火 → 119 / 生病受伤 → 120 / 坏人来了 → 110。
   独特点：紧急号码认知 + 多选项。视觉：场景卡 + 号码按钮。
   巧思：选对高亮，选错抖动并提示。前缀 emc2-。 */

import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

interface Scene {
  emoji: string;
  text: string;
  answer: string; // 正确号码
}
interface Number {
  label: string;
  desc: string;
}

const NUMBERS: Number[] = [
  { label: "119", desc: "消防员" },
  { label: "120", desc: "救护车" },
  { label: "110", desc: "警察" },
];

const SCENES: Scene[] = [
  { emoji: "🔥🏠", text: "家里着火了！", answer: "119" },
  { emoji: "🤒💔", text: "奶奶突然晕倒生病了。", answer: "120" },
  { emoji: "🦹🏃", text: "有坏人跟着我。", answer: "110" },
  { emoji: "🔥🌳", text: "山上看到大火苗。", answer: "119" },
  { emoji: "🚴🩸", text: "弟弟摔破头流了好多血。", answer: "120" },
  { emoji: "🚪🦹", text: "有坏人在撬门。", answer: "110" },
  { emoji: "🏊‍♂️🌊", text: "看到有人掉进水里溺水了。", answer: "110" },
  { emoji: "💨🏠", text: "闻到家里有刺鼻的煤气味。", answer: "119" },
  { emoji: "⚡🔥", text: "电线冒火花着火了。", answer: "119" },
  { emoji: "🧭😟", text: "在街上迷路找不到家了。", answer: "110" },
  { emoji: "🍳🤕", text: "手指被热锅烫红了。", answer: "120" },
  { emoji: "🌐🏚️", text: "地震了，房子在摇晃。", answer: "119" },
];

export class EmergencyCallGame extends BaseGame {
  constructor() {
    super("emergency-call");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private order: Scene[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.order = shuffle(SCENES);
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private startRound(): void {
    this.answered = false;
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    const scene = this.order[this.roundsDone % this.order.length]!;
    const choices = shuffle(NUMBERS);

    const wrap = document.createElement("div");
    wrap.className = "emc2-wrap";
    const task = document.createElement("div");
    task.className = "emc2-task";
    task.innerHTML = `遇到这种情况，该打<b>哪个电话</b>？`;
    wrap.appendChild(task);

    const card = document.createElement("div");
    card.className = "emc2-card";
    card.innerHTML = `<div class="emc2-card__emoji">${scene.emoji}</div><div class="emc2-card__scene">${scene.text}</div>`;
    wrap.appendChild(card);

    const opts = document.createElement("div");
    opts.className = "emc2-opts";
    choices.forEach((nb) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "emc2-choice";
      b.innerHTML = `<span class="emc2-choice__num">${nb.label}</span><span class="emc2-choice__desc">${nb.desc}</span>`;
      b.addEventListener("click", () => this.choose(nb.label, scene.answer, b));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    this.root.appendChild(wrap);
  }

  private choose(label: string, answer: string, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (label === answer) {
      this.answered = true;
      btn.classList.add("emc2-choice--right");
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.reportProgress(this.roundsDone, this.roundTotal);
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("emc2-choice--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("emc2-choice--wrong"), 500);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "记一记～",
      emoji: "📞",
      variant: "rest",
      body: "着火打 <b>119</b>（消防员）；生病受伤打 <b>120</b>（救护车）；坏人打 <b>110</b>（警察）～",
      primary: { text: "继续", icon: "🛡️", onClick: () => ov.destroy() },
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
    if (document.getElementById("emc2-style")) return;
    const st = document.createElement("style");
    st.id = "emc2-style";
    st.textContent = EMC2_CSS(getCssVar("--c-red"));
    document.head.appendChild(st);
  }
}

function EMC2_CSS(theme: string): string {
  return `
.emc2-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(480px,100%);}
.emc2-task{font-size:1.1rem;font-weight:800;text-align:center;background:#fff;padding:10px 20px;border-radius:999px;box-shadow:var(--shadow);line-height:1.5;}
.emc2-task b{color:${theme};}
.emc2-card{display:flex;flex-direction:column;align-items:center;gap:8px;background:linear-gradient(180deg,#fff0ee,#ffd9d2);padding:22px 28px;border-radius:22px;box-shadow:var(--shadow);text-align:center;width:100%;box-sizing:border-box;}
.emc2-card__emoji{font-size:3rem;letter-spacing:4px;}
.emc2-card__scene{font-size:1.15rem;font-weight:800;color:#5a2a24;}
.emc2-opts{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;width:100%;max-width:420px;}
.emc2-choice{display:flex;flex-direction:column;align-items:center;gap:2px;width:108px;padding:16px 10px;border-radius:20px;border:3px solid #e0e0e8;background:#fff;box-shadow:var(--shadow);cursor:pointer;transition:transform .12s;}
.emc2-choice:active{transform:scale(.96);}
.emc2-choice__num{font-size:2rem;font-weight:900;color:${theme};line-height:1;}
.emc2-choice__desc{font-size:.9rem;font-weight:700;color:var(--ink);}
.emc2-choice--right{border-color:#6bcf7f;background:#d4f4dd;animation:emc2-pop .4s ease;}
.emc2-choice--wrong{border-color:#ff6348;background:#ffe0e0;animation:emc2-shake .4s ease;}
@keyframes emc2-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes emc2-pop{0%{transform:scale(.9)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
@media (max-width:380px){.emc2-choice{width:92px;padding:14px 8px;}.emc2-choice__num{font-size:1.7rem;}}
`;
}

export function create(): EmergencyCallGame {
  return new EmergencyCallGame();
}
