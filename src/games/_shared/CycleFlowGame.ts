/**
 * 循环/变化流程游戏公共基类 —— 消除 rock-cycle/water-cycle 等的重复代码。
 *
 * 与 StepOrderGame 的区别：用"➜ 箭头时间线"展示阶段流、按阶段索引（而非文字）匹配、
 * 完成时箭头流光高亮。适合科学/自然的变化序列（岩石循环、水循环、四季轮转等）。
 *
 * 子类传入 CycleFlowConfig 即可，无需再实现游戏逻辑。
 */
import { BaseGame } from "../../core/engine.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { sfxPop } from "../../core/audio.ts";
import { getCssVar, shuffle } from "../../lobby/util.ts";
import type { GameId } from "../../types.ts";

export interface FlowStage {
  emoji: string;
  name: string;
}
export interface FlowCycle {
  theme: string;
  stages: FlowStage[];
}

export interface CycleFlowConfig {
  prefix: string;
  themeVar: string;
  cycles: FlowCycle[];
  /** 各难度的阶段数上限。 */
  maxLen: { easy: number; medium: number; hard: number };
  roundTotal: { easy: number; medium: number; hard: number };
  /** 卡片渐变色（可选，默认取主题色淡化）。 */
  cardTint?: string;
}

export abstract class CycleFlowGame extends BaseGame {
  protected cfg: CycleFlowConfig;

  constructor(gameId: GameId, cfg: CycleFlowConfig) {
    super(gameId);
    this.cfg = cfg;
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private cycle: FlowCycle | null = null;
  private next = 0;
  private display: number[] = [];

  protected mount(): void {
    this.roundTotal =
      this.difficulty === "easy"
        ? this.cfg.roundTotal.easy
        : this.difficulty === "medium"
          ? this.cfg.roundTotal.medium
          : this.cfg.roundTotal.hard;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private maxLenN(): number {
    return this.difficulty === "easy"
      ? this.cfg.maxLen.easy
      : this.difficulty === "medium"
        ? this.cfg.maxLen.medium
        : this.cfg.maxLen.hard;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.reportProgress(this.roundsDone, this.roundTotal);
    this.next = 0;
    const p = this.cfg.prefix;
    const base = this.cfg.cycles[this.roundsDone % this.cfg.cycles.length]!;
    const len = Math.min(this.maxLenN(), base.stages.length);
    this.cycle = { theme: base.theme, stages: base.stages.slice(0, len) };
    this.display = shuffle(this.cycle.stages.map((_, i) => i));

    const wrap = document.createElement("div");
    wrap.className = `${p}-wrap`;
    const task = document.createElement("div");
    task.className = `${p}-task`;
    task.innerHTML = `按<b>变化顺序</b>点出来：先有什么，再变什么<br><small>${this.cycle.theme}（第 ${this.roundsDone + 1}/${this.roundTotal} 关）</small>`;
    wrap.appendChild(task);

    const result = document.createElement("div");
    result.className = `${p}-result`;
    result.id = `${p}-result`;
    for (let i = 0; i < this.cycle.stages.length; i++) {
      if (i > 0) {
        const arrow = document.createElement("div");
        arrow.className = `${p}-arrow`;
        arrow.textContent = "➜";
        result.appendChild(arrow);
      }
      const slot = document.createElement("div");
      slot.className = `${p}-slot`;
      slot.id = `${p}-slot-${i}`;
      result.appendChild(slot);
    }
    wrap.appendChild(result);

    const pool = document.createElement("div");
    pool.className = `${p}-pool`;
    this.display.forEach((stepIdx) => {
      const s = this.cycle!.stages[stepIdx]!;
      const b = document.createElement("div");
      b.className = `${p}-card`;
      b.dataset.idx = String(stepIdx);
      b.innerHTML = `<span class="${p}-card__emoji">${s.emoji}</span><span class="${p}-card__name">${s.name}</span>`;
      b.addEventListener("click", () => this.onCard(stepIdx, b));
      pool.appendChild(b);
    });
    wrap.appendChild(pool);
    this.root.appendChild(wrap);
  }

  private onCard(stepIdx: number, el: HTMLDivElement): void {
    const p = this.cfg.prefix;
    if (el.classList.contains(`${p}-card--used`) || !this.cycle) return;
    if (stepIdx !== this.next) {
      el.classList.add(`${p}-card--shake`);
      this.trackTimeout(() => el.classList.remove(`${p}-card--shake`), 360);
      this.onWrong();
      return;
    }
    sfxPop();
    el.classList.add(`${p}-card--used`);
    const s = this.cycle.stages[stepIdx]!;
    const slot = this.root.querySelector<HTMLElement>(`#${p}-slot-${stepIdx}`);
    if (slot) {
      slot.classList.add(`${p}-slot--filled`);
      slot.innerHTML = `<span class="${p}-slot__emoji">${s.emoji}</span><span class="${p}-slot__name">${s.name}</span>`;
    }
    const r = el.getBoundingClientRect();
    this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
    this.next += 1;
    this.resetWrongStreak();

    if (this.next >= this.cycle.stages.length) {
      this.root
        .querySelector(`#${p}-result`)
        ?.classList.add(`${p}-result--done`);
      this.roundsDone += 1;
      this.trackTimeout(() => {
        if (this.roundsDone >= this.roundTotal) {
          this.finishClear(starsByAccuracy(this.wrongCount));
        } else {
          this.startRound();
        }
      }, 1200);
    }
  }

  protected injectStyle(): void {
    const p = this.cfg.prefix;
    if (document.getElementById(`${p}-style`)) return;
    const st = document.createElement("style");
    st.id = `${p}-style`;
    st.textContent = CYCLE_FLOW_CSS(
      p,
      getCssVar(this.cfg.themeVar),
      this.cfg.cardTint,
    );
    document.head.appendChild(st);
  }
}

function CYCLE_FLOW_CSS(p: string, theme: string, tint?: string): string {
  const t = tint ?? `${theme}29`; // 透明度淡化主题色
  return `
.${p}-wrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(640px,100%);}
.${p}-task{font-size:1.05rem;font-weight:800;text-align:center;line-height:1.7;color:var(--ink);}
.${p}-task b{color:${theme};}
.${p}-task small{color:var(--ink-soft);font-weight:700;font-size:.85rem;}
.${p}-result{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;min-height:88px;padding:14px 16px;background:rgba(255,255,255,.7);border-radius:20px;box-shadow:var(--shadow);}
.${p}-slot{width:72px;height:78px;border-radius:16px;border:2.5px dashed rgba(58,46,74,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:rgba(255,255,255,.4);}
.${p}-slot--filled{border:2.5px solid ${theme};background:#fff;animation:${p}-drop .35s ease;}
@keyframes ${p}-drop{0%{transform:scale(.6);opacity:.3}100%{transform:scale(1);opacity:1}}
.${p}-slot__emoji{font-size:1.9rem;}
.${p}-slot__name{font-size:.72rem;font-weight:800;color:var(--ink);}
.${p}-arrow{font-size:1.3rem;color:${theme};font-weight:900;opacity:.4;transition:opacity .3s ease;}
.${p}-result--done .${p}-arrow{opacity:1;animation:${p}-flow 1.2s ease-in-out infinite;}
@keyframes ${p}-flow{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}
.${p}-result--done .${p}-slot--filled{box-shadow:0 0 14px ${theme}88;}
.${p}-pool{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.${p}-card{width:84px;height:96px;border-radius:18px;background:#fff;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease;position:relative;overflow:hidden;}
.${p}-card::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,${t},transparent 50%);}
.${p}-card:hover{transform:translateY(-5px) scale(1.04);box-shadow:0 12px 22px rgba(58,46,74,.2);}
.${p}-card:active{transform:scale(.95);}
.${p}-card__emoji{font-size:2.1rem;}
.${p}-card__name{font-size:.8rem;font-weight:800;color:var(--ink);position:relative;}
.${p}-card--used{opacity:.32;transform:scale(.85);pointer-events:none;filter:grayscale(.4);}
.${p}-card--shake{animation:${p}-shake .36s ease;}
@keyframes ${p}-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-4px)}}
`;
}
