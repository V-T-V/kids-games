/* 任务切换 Task-Switch —— 规则会变，灵活切换思维点对的（执行功能·认知灵活性）。
   独特点：每轮任务类型可能变（"点大的"↔"点红色的"），孩子需抑制上一轮规则、
           按当前规则选目标，训练前额叶认知灵活性（区别于单一规则的反应游戏）。
   巧思：4 张候选图同时可按"大小"和"颜色"评判，切换规则时高亮提示，干扰随难度增加。 */

import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";

/** 一张候选图：同张图同时带"大小"和"颜色"两个可评判维度。 */
interface Item {
  emoji: string;
  /** 大 = true，小 = false */
  big: boolean;
  /** 颜色标识，用于"点红色的"这类规则 */
  color: "red" | "blue" | "green" | "yellow";
  /** 同等缩放参考用，big 渲染更大 */
}

/** 任务规则：按哪个维度选目标。 */
type Rule = "size" | "color";

/** 一套图卡的配色 token（仅用于 CSS 区分颜色块，不直接渲染）。 */
const COLOR_BY: Record<Item["color"], string> = {
  red: "🔴",
  blue: "🔵",
  green: "🟢",
  yellow: "🟡",
};

/** 备选 emoji 池，颜色由独立 token 标记（emoji 与颜色弱相关，强化"看规则"）。 */
const POOL: Item[] = [
  { emoji: "🍎", big: true, color: "red" },
  { emoji: "🍓", big: false, color: "red" },
  { emoji: "🐳", big: true, color: "blue" },
  { emoji: "🐟", big: false, color: "blue" },
  { emoji: "🌳", big: true, color: "green" },
  { emoji: "🍀", big: false, color: "green" },
  { emoji: "🌻", big: true, color: "yellow" },
  { emoji: "🐤", big: false, color: "yellow" },
];

/** 规则对应的中文提示。 */
function ruleText(rule: Rule): string {
  return rule === "size" ? "点【大的】" : "点【红色的】";
}

/** 规则图标。 */
function ruleIcon(rule: Rule): string {
  return rule === "size" ? "📏" : "🔴";
}

export class TaskSwitchGame extends BaseGame {
  constructor() {
    super("task-switch");
  }
  private roundsDone = 0;
  private roundTotal = 0;
  private answered = false;
  private currentRule: Rule = "size";
  /** 本局用过的颜色，保证"点红色的"规则始终指红色 token。 */
  private targetColor: Item["color"] = "red";

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy" ? 4 : this.difficulty === "medium" ? 6 : 8;
    this.injectStyle();
    this.currentRule = "size";
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 清空 */
  }

  /** 切换频率：easy 每 3 轮可能切一次，medium 每 2 轮，hard 每轮都可能切。 */
  private shouldSwitch(): boolean {
    if (this.difficulty === "easy") return this.roundsDone > 0 && this.roundsDone % 3 === 0;
    if (this.difficulty === "medium") return this.roundsDone > 0 && this.roundsDone % 2 === 0;
    return this.roundsDone > 0;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.answered = false;
    this.reportProgress(this.roundsDone, this.roundTotal);

    // 决定本轮规则：可能切换
    if (this.shouldSwitch()) {
      this.currentRule = this.currentRule === "size" ? "color" : "size";
    }
    // "点红色的"规则固定找红色 token
    this.targetColor = "red";

    // 从池中挑 4 张：保证恰好一张满足本轮规则（且其余都不是"大且红"那种双重满足）
    const candidates = shuffle(POOL);
    const isTarget = (it: Item): boolean =>
      this.currentRule === "size" ? it.big : it.color === this.targetColor;
    const target = candidates.find(isTarget)!;
    // 干扰项：不满足规则，且和目标在视觉上区分
    const distract = candidates.filter((c) => !isTarget(c) && c.emoji !== target.emoji).slice(0, 3);
    const shown = shuffle([target, ...distract]);

    const wrap = document.createElement("div");
    wrap.className = "tsk-wrap";

    // 规则横幅：切换时高亮提醒
    const rule = document.createElement("div");
    const switched = this.shouldSwitch();
    rule.className = "tsk-rule" + (switched ? " tsk-rule--switch" : "");
    rule.innerHTML = `<span class="tsk-rule__icon">${ruleIcon(this.currentRule)}</span><span class="tsk-rule__txt">${ruleText(this.currentRule)}</span>`;
    wrap.appendChild(rule);

    if (switched) {
      const hint = document.createElement("div");
      hint.className = "tsk-switch-hint";
      hint.textContent = "规则变啦，看清楚再点～";
      wrap.appendChild(hint);
    }

    const stage = document.createElement("div");
    stage.className = "tsk-stage";
    shown.forEach((it) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tsk-item" + (it.big ? " tsk-item--big" : " tsk-item--small");
      b.innerHTML = `<span class="tsk-item__emoji">${it.emoji}</span><span class="tsk-item__tag">${COLOR_BY[it.color]}</span>`;
      b.addEventListener("click", () => this.choose(it, target, b));
      stage.appendChild(b);
    });
    wrap.appendChild(stage);

    this.root.appendChild(wrap);
  }

  private choose(c: Item, target: Item, btn: HTMLButtonElement): void {
    if (this.answered) return;
    if (c.emoji === target.emoji && c.big === target.big && c.color === target.color) {
      this.answered = true;
      sfxPop();
      btn.classList.add("tsk-item--done");
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal)
          this.finishClear(starsByAccuracy(this.wrongCount));
        else this.startRound();
      }, 1000);
    } else {
      btn.classList.add("tsk-item--wrong");
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove("tsk-item--wrong"), 400);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: "🌙",
      variant: "rest",
      body: "先看上面的规则，再去找对应的～",
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
    if (document.getElementById("tsk-style")) return;
    const st = document.createElement("style");
    st.id = "tsk-style";
    st.textContent = TSK_CSS(getCssVar("--c-indigo"));
    document.head.appendChild(st);
  }
}

function TSK_CSS(theme: string): string {
  return `
.tsk-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(480px,100%);}
.tsk-rule{display:flex;align-items:center;gap:10px;background:#fff;padding:12px 26px;border-radius:999px;box-shadow:var(--shadow);}
.tsk-rule__icon{font-size:1.8rem;}
.tsk-rule__txt{font-size:1.3rem;font-weight:900;color:${theme};}
.tsk-rule--switch{animation:tsk-blink .6s ease 2;}
.tsk-switch-hint{font-size:.95rem;font-weight:700;color:#ff6348;background:#fff4f1;padding:6px 16px;border-radius:999px;}
.tsk-stage{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;width:min(420px,100%);}
.tsk-item{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#fff;border-radius:20px;box-shadow:var(--shadow);transition:transform .12s ease;min-height:96px;}
.tsk-item:active{transform:scale(.94);}
.tsk-item--big{padding:18px 10px;}
.tsk-item--small{padding:10px;}
.tsk-item__emoji{line-height:1;}
.tsk-item--big .tsk-item__emoji{font-size:3.6rem;}
.tsk-item--small .tsk-item__emoji{font-size:2rem;}
.tsk-item__tag{font-size:1.1rem;}
.tsk-item--done{background:#d4f4dd;outline:4px solid #34c759;animation:tsk-pop .4s ease;}
.tsk-item--wrong{animation:tsk-shake .4s ease;}
@keyframes tsk-pop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes tsk-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes tsk-blink{0%,100%{box-shadow:var(--shadow);}50%{box-shadow:0 0 0 6px ${theme}55;}}
`;
}

export function create(): TaskSwitchGame {
  return new TaskSwitchGame();
}
