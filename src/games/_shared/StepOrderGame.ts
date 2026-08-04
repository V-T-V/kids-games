/**
 * 步骤排序游戏公共基类 —— 消除 ~18 个"按正确顺序点步骤"游戏的重复代码。
 *
 * 这些游戏（brush-teeth/wash-hands/dress-order/fire-safety/fold-paper-2/tie-bow/
 * tie-hair/tie-shoe/bath-steps/sleep-routine/wake-up 等）在重构前几乎逐字符相同，
 * 仅 STEPS 数据、CSS 前缀、主题色、步数难度切片不同。
 *
 * 子类只需继承本类并在构造里传入 StepOrderConfig，无需再实现 mount/unmount/startRound/
 * choose/showRest/injectStyle/CSS。原本每个文件 ~180 行，迁移后 ~25 行。
 *
 * 玩法：给出 N 个打乱的步骤卡，孩子按正确顺序点；点对填入序号槽，点错抖动不前进。
 * 全部点对后进入下一关；通关 = 答对目标轮数。
 */
import { BaseGame } from "../../core/engine.ts";
import { sfxPop } from "../../core/audio.ts";
import { starsByAccuracy } from "../../core/scoring.ts";
import { Overlay } from "../../ui/Overlay.ts";
import { navigate } from "../../router.ts";
import { getCssVar, sample, shuffle } from "../../lobby/util.ts";
import type { GameId } from "../../types.ts";

/** 一张步骤卡。 */
export interface StepItem {
  emoji: string;
  text: string;
}

/** 一组步骤（单组游戏用一组；多组如"早晚两套流程"用多组）。 */
export type StepGroup = StepItem[];

export interface StepOrderConfig {
  /** CSS 前缀，所有 class 以它开头（如 "brt"）。 */
  prefix: string;
  /** 主题色 CSS 变量名（如 "--c-cyan"）。 */
  themeVar: string;
  /** 步骤数据。单组就传 [STEPS]；多组（每轮随机抽一组）就传多组。 */
  groups: StepGroup[];
  /** 各难度的步骤数。easy/medium/hard 分别取前 N 步（从头数）。 */
  stepCount: { easy: number; medium: number; hard: number };
  /** 各难度的通关轮数。 */
  roundTotal: { easy: number; medium: number; hard: number };
  /** 任务行模板，${n} 会被替换为当轮步数。如"刷牙分${n}步，按正确顺序点图～"。 */
  taskTemplate: (n: number) => string;
  /** 休息弹窗的 emoji 与正文（HTML）。 */
  restEmoji: string;
  restBody: string;
  /** 槽位序号 badge 背景色（默认 #999）。 */
  slotNumBg?: string;
}

export abstract class StepOrderGame extends BaseGame {
  protected cfg: StepOrderConfig;

  constructor(gameId: GameId, cfg: StepOrderConfig) {
    super(gameId);
    this.cfg = cfg;
  }

  private roundsDone = 0;
  private roundTotal = 0;
  private picked = 0;
  private curSteps: StepItem[] = [];
  /** 本轮抽中的那一组（多组数据时每轮换一组；单组则固定）。 */
  private curGroup: StepItem[] = [];

  protected mount(): void {
    const r =
      this.difficulty === "easy"
        ? this.cfg.roundTotal.easy
        : this.difficulty === "medium"
          ? this.cfg.roundTotal.medium
          : this.cfg.roundTotal.hard;
    this.roundTotal = r;
    this.injectStyle();
    this.startRound();
  }
  protected unmount(): void {
    /* DOM 由 destroy 清空 */
  }

  private stepCountN(): number {
    return this.difficulty === "easy"
      ? this.cfg.stepCount.easy
      : this.difficulty === "medium"
        ? this.cfg.stepCount.medium
        : this.cfg.stepCount.hard;
  }

  private startRound(): void {
    this.root.innerHTML = "";
    this.picked = 0;
    this.reportProgress(this.roundsDone, this.roundTotal);
    const n = this.stepCountN();
    // 多组数据时每轮随机抽一组；单组（groups.length===1）则固定。
    this.curGroup = (
      this.cfg.groups.length > 1 ? sample(this.cfg.groups) : this.cfg.groups[0]!
    ) as StepItem[];
    this.curSteps = this.curGroup.slice(0, Math.min(n, this.curGroup.length));
    const shown = shuffle(this.curSteps);
    const p = this.cfg.prefix;

    const wrap = document.createElement("div");
    wrap.className = `${p}-wrap`;
    const task = document.createElement("div");
    task.className = `${p}-task`;
    task.innerHTML = `${this.cfg.taskTemplate(this.curSteps.length)}<br><span class="${p}-hint">第 ${this.roundsDone + 1}/${this.roundTotal} 关</span>`;
    wrap.appendChild(task);

    const slots = document.createElement("div");
    slots.className = `${p}-slots`;
    for (let i = 0; i < this.curSteps.length; i++) {
      const slot = document.createElement("div");
      slot.className = `${p}-slot`;
      slot.dataset.idx = String(i);
      slot.innerHTML = `<span class="${p}-slot__num">${i + 1}</span>`;
      slots.appendChild(slot);
    }
    wrap.appendChild(slots);

    const pool = document.createElement("div");
    pool.className = `${p}-pool`;
    shown.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `${p}-card`;
      b.innerHTML = `<div class="${p}-card__emoji">${s.emoji}</div><div class="${p}-card__text">${s.text}</div>`;
      b.addEventListener("click", () => this.choose(s, b, slots));
      pool.appendChild(b);
    });
    wrap.appendChild(pool);
    this.root.appendChild(wrap);
  }

  private choose(
    s: StepItem,
    btn: HTMLButtonElement,
    slots: HTMLElement,
  ): void {
    const p = this.cfg.prefix;
    if (btn.classList.contains(`${p}-card--used`)) return;
    const expect = this.curSteps[this.picked];
    if (expect && expect.text === s.text) {
      btn.classList.add(`${p}-card--used`);
      sfxPop();
      const r = btn.getBoundingClientRect();
      this.onCorrect(r.left + r.width / 2, r.top + r.height / 2);
      this.resetWrongStreak();
      const slot = slots.querySelector<HTMLElement>(
        `.${p}-slot[data-idx="${this.picked}"]`,
      );
      if (slot) {
        slot.classList.add(`${p}-slot--filled`);
        slot.insertAdjacentHTML(
          "beforeend",
          `<div class="${p}-slot__emoji">${s.emoji}</div><div class="${p}-slot__cap">${s.text}</div>`,
        );
      }
      this.picked += 1;
      if (this.picked >= this.curSteps.length) {
        this.roundsDone += 1;
        this.trackTimeout(() => {
          if (this.roundsDone >= this.roundTotal) {
            this.finishClear(starsByAccuracy(this.wrongCount));
          } else {
            this.startRound();
          }
        }, 1100);
      }
    } else {
      btn.classList.add(`${p}-card--wrong`);
      const paused = this.onWrong();
      this.trackTimeout(() => btn.classList.remove(`${p}-card--wrong`), 450);
      if (paused) this.showRest();
    }
  }

  private showRest(): void {
    const ov = new Overlay({
      title: "休息一下～",
      emoji: this.cfg.restEmoji,
      variant: "rest",
      body: this.cfg.restBody,
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

  protected injectStyle(): void {
    const p = this.cfg.prefix;
    if (document.getElementById(`${p}-style`)) return;
    const st = document.createElement("style");
    st.id = `${p}-style`;
    st.textContent = STEP_ORDER_CSS(p, getCssVar(this.cfg.themeVar));
    document.head.appendChild(st);
  }
}

/** 统一的 CSS 模板，所有步骤排序游戏共用（仅前缀与主题色不同）。 */
function STEP_ORDER_CSS(p: string, theme: string): string {
  return `
.${p}-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:min(520px,100%);}
.${p}-task{font-size:1.1rem;font-weight:800;text-align:center;line-height:1.4;}
.${p}-hint{font-size:.85rem;font-weight:600;color:var(--ink-soft);}
.${p}-slots{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:10px 12px;background:rgba(255,255,255,.6);border-radius:18px;box-shadow:var(--shadow);max-width:100%;}
.${p}-slot{width:64px;height:82px;border:3px dashed #c7c7d1;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;position:relative;background:#fff;}
.${p}-slot__num{position:absolute;top:-10px;left:-8px;background:#999;color:#fff;width:24px;height:24px;border-radius:50%;font-size:.85rem;font-weight:800;display:flex;align-items:center;justify-content:center;}
.${p}-slot--filled{border:3px solid ${theme};background:color-mix(in srgb,${theme} 22%,#fff);animation:${p}-fill .35s ease;}
.${p}-slot__emoji{font-size:1.8rem;line-height:1;}
.${p}-slot__cap{font-size:.66rem;font-weight:700;color:var(--ink);text-align:center;line-height:1.1;}
.${p}-pool{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding-top:6px;}
.${p}-card{width:82px;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:5px;transition:transform .15s;}
.${p}-card:active{transform:scale(.93);}
.${p}-card__emoji{font-size:2.4rem;line-height:1;}
.${p}-card__text{font-size:.76rem;font-weight:700;color:var(--ink);text-align:center;}
.${p}-card--used{opacity:.35;pointer-events:none;background:#eee;}
.${p}-card--wrong{animation:${p}-shake .4s ease;background:#ff6348;color:#fff;}
@keyframes ${p}-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes ${p}-fill{0%{transform:scale(.5)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
@media (max-width:380px){.${p}-slot{width:56px;height:72px;}.${p}-card{width:72px;}}
`;
}
