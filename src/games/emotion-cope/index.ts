/* 情绪应对 Emotion Cope —— 看一个情绪场景（如"玩具坏了很伤心"），选出正确的应对方式。
   独特点：情绪教育 + 同理心，教孩子健康地处理情绪。
   巧思：场景大 emoji + 应对方式选项；难度=选项数；通关=答对目标轮数。前缀 emc-。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";

interface Scene {
  emoji: string;
  text: string; // 场景描述
  cope: string; // 正确应对方式
}

const SCENES: Scene[] = [
  { emoji: "😢", text: "玩具坏了，很伤心", cope: "告诉爸爸妈妈" },
  { emoji: "😠", text: "和朋友吵架，很生气", cope: "深呼吸数到十" },
  { emoji: "😨", text: "晚上一个人害怕", cope: "抱着小熊抱枕" },
  { emoji: "😰", text: "第一次上学很紧张", cope: "想想开心的事" },
  { emoji: "😭", text: "摔倒了很疼", cope: "找大人帮忙" },
  { emoji: "😞", text: "比赛输了很难过", cope: "下次再努力" },
  { emoji: "😡", text: "搭的积木被推倒", cope: "说出自己的感受" },
  { emoji: "😱", text: "做噩梦吓醒了", cope: "开小灯说说话" },
];

// 错误应对（干扰项，都不健康）
const BAD_COPES = ["大哭打人", "躲起来不说话", "把气撒别人身上"];

export class EmotionCopeGame extends BaseGame {
  constructor() {
    super("emotion-cope");
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private target: Scene | null = null;
  private usedIdx: number[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.roundsDone = 0;
    this.usedIdx = [];
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private choiceN(): number {
    return this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
  }

  private startRound(): void {
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    let pool = SCENES.map((_, i) => i).filter((i) => !this.usedIdx.includes(i));
    if (pool.length === 0) {
      this.usedIdx = [];
      pool = SCENES.map((_, i) => i);
    }
    const ansIdx = sample(pool);
    this.usedIdx.push(ansIdx);
    const answer = SCENES[ansIdx]!;
    this.target = answer;

    const n = Math.min(this.choiceN(), SCENES.length);
    // 干扰项：从其他场景的正确应对里取（也是健康方式），不足再用坏应对
    const otherCopes = shuffle(
      SCENES.filter((s) => s.cope !== answer.cope).map((s) => s.cope),
    );
    const badCopes = shuffle(BAD_COPES);
    const distractors: string[] = [];
    let oi = 0;
    let bi = 0;
    while (distractors.length < n - 1) {
      if (oi < otherCopes.length) {
        distractors.push(otherCopes[oi]!);
        oi++;
      } else if (bi < badCopes.length) {
        distractors.push(badCopes[bi]!);
        bi++;
      } else {
        break;
      }
    }
    const choices = shuffle([answer.cope, ...distractors]);
    this.render(answer, choices);
  }

  private render(answer: Scene, choices: string[]): void {
    this.root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "emc-wrap";

    const task = document.createElement("div");
    task.className = "emc-task";
    task.innerHTML = `怎么做<b>最好</b>呢？ <small>${this.roundsDone + 1} / ${this.roundTotal}</small>`;
    wrap.appendChild(task);

    const stage = document.createElement("div");
    stage.className = "emc-stage";
    const emoji = document.createElement("div");
    emoji.className = "emc-emoji";
    emoji.textContent = answer.emoji;
    stage.appendChild(emoji);
    const text = document.createElement("div");
    text.className = "emc-text";
    text.textContent = answer.text;
    stage.appendChild(text);
    wrap.appendChild(stage);

    const opts = document.createElement("div");
    opts.className = "emc-opts";
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "emc-opt";
      b.textContent = c;
      b.addEventListener("click", () => this.choose(c, b));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);

    this.root.appendChild(wrap);
  }

  private choose(c: string, btn: HTMLButtonElement): void {
    if (this.answered || !this.target) return;
    this.answered = true;
    const ok = c === this.target.cope;
    if (ok) {
      btn.classList.add("emc-opt--correct");
      const rect = btn.getBoundingClientRect();
      this.onCorrect(rect.left + rect.width / 2, rect.top + rect.height / 2);
      sfxPop();
      this.trackTimeout(() => {
        this.roundsDone += 1;
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1000);
    } else {
      btn.classList.add("emc-opt--wrong");
      this.onWrong();
      this.trackTimeout(() => {
        this.answered = false;
        this.root
          .querySelectorAll(".emc-opt--wrong")
          .forEach((el) => el.classList.remove("emc-opt--wrong"));
      }, 750);
    }
  }

  private injectStyle(): void {
    if (document.getElementById("emc-style")) return;
    const st = document.createElement("style");
    st.id = "emc-style";
    st.textContent = EMC_CSS(getCssVar("--c-purple"));
    document.head.appendChild(st);
  }
}

function EMC_CSS(theme: string): string {
  return `
.emc-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(520px,100%);}
.emc-task{font-size:1.15rem;font-weight:800;text-align:center;line-height:1.6;color:var(--ink);max-width:440px;}
.emc-task b{color:${theme};}
.emc-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;margin-left:6px;}
.emc-stage{display:flex;flex-direction:column;align-items:center;gap:6px;padding:22px 36px;background:linear-gradient(160deg,#fff,color-mix(in srgb,${theme} 10%,#fff));border-radius:24px;box-shadow:var(--shadow);min-width:240px;}
.emc-emoji{font-size:4.5rem;line-height:1;filter:drop-shadow(0 4px 6px rgba(0,0,0,.15));}
.emc-text{font-size:1.25rem;font-weight:900;color:${theme};text-align:center;}
.emc-opts{display:grid;grid-template-columns:1fr;gap:12px;width:100%;max-width:440px;}
.emc-opt{padding:16px 16px;border:3px solid transparent;border-radius:16px;background:linear-gradient(160deg,#fff,#f3f0fa);box-shadow:var(--shadow);cursor:pointer;font-size:1.1rem;font-weight:800;color:var(--ink);transition:transform .12s ease,border-color .2s ease,background .2s ease;min-height:58px;text-align:center;}
.emc-opt:active{transform:scale(.97);}
.emc-opt--correct{border-color:#6bcf7f;background:#e8fbe8;animation:emc-yes .4s ease;}
@keyframes emc-yes{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}
.emc-opt--wrong{border-color:#ff6348;background:#ffeae6;animation:emc-no .3s ease;}
@keyframes emc-no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
}

export function create(): EmotionCopeGame {
  return new EmotionCopeGame();
}
